-- Server-only gateway state. Ciphertext is authenticated against its opaque key.
create table private.gateway_sessions (
    key text primary key check (key ~ '^[a-f0-9]{64}$'),
    payload text not null check (length(payload) between 40 and 65536),
    mode text not null check (mode in ('anonymous','authenticated','recovery')),
    user_key text check (user_key ~ '^[a-f0-9]{64}$'),
    expires_at timestamptz not null,
    lease uuid,
    lease_until timestamptz,
    check ((lease is null) = (lease_until is null)),
    check ((mode = 'anonymous') = (user_key is null))
);
create index gateway_sessions_expiry on private.gateway_sessions(expires_at);
create index gateway_sessions_lease_expiry on private.gateway_sessions(lease_until) where lease_until is not null;
create index gateway_sessions_user on private.gateway_sessions(user_key) where user_key is not null;
create table private.gateway_session_control (
    singleton boolean primary key default true check (singleton),
    generation bigint not null default 0,
    reset_key text,
    reset_lease uuid,
    reset_user_key text,
    check ((reset_key is null) = (reset_lease is null)),
    check ((reset_key is null) = (reset_user_key is null))
);
insert into private.gateway_session_control(singleton) values (true);
alter table private.gateway_sessions enable row level security;
alter table private.gateway_session_control enable row level security;
revoke all on private.gateway_sessions, private.gateway_session_control from public, anon, authenticated, service_role;

-- A short control-row lock orders database transitions across all instances.
-- External Auth requests never hold a database transaction. The nonrenewable
-- per-session lease protects those requests; an expired lease destroys the
-- session because its refresh token may already have been consumed.
create function private.gateway_session(p_action text, p_key text, p_lease uuid, p_data jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' set lock_timeout = '2s' as $$
declare
    control private.gateway_session_control;
    session private.gateway_sessions;
    operation_time timestamptz;
    capacity integer;
begin
    select * into control from private.gateway_session_control where singleton for update;
    operation_time := clock_timestamp();
    -- At most 10000 live records; cleanup is bounded by the same storage cap.
    delete from private.gateway_sessions where expires_at <= operation_time
        or (lease_until is not null and lease_until <= operation_time);
    if p_action in ('generation','sweep') then
        return jsonb_build_object('generation', control.generation);
    end if;
    if p_action = 'create' then
        capacity := (p_data->>'limit')::integer;
        if capacity is null or capacity < 2 or capacity > 10000 or p_data->>'mode' <> 'anonymous' then
            raise exception 'Invalid session capacity or mode' using errcode = '22023';
        end if;
        if (select count(*) from private.gateway_sessions) >= capacity
            or (select count(*) from private.gateway_sessions where mode = 'anonymous') >= greatest(1, capacity * 4 / 5) then
            return jsonb_build_object('status','capacity');
        end if;
        insert into private.gateway_sessions(key,payload,mode,user_key,expires_at)
            values (p_key,p_data->>'payload','anonymous',null,
                least((p_data->>'expires')::timestamptz,operation_time + interval '1 hour'));
        return jsonb_build_object('status','ok');
    end if;
    -- Reset barriers survive process failure. Only the matching completion or
    -- an explicit service-role operator reconciliation can clear one.
    if p_action in ('finish_reset','resolve_reset') then
        if control.reset_key is distinct from p_key or control.reset_lease is distinct from p_lease
            or control.reset_user_key is distinct from p_data->>'user_key' or p_key is null then
            return jsonb_build_object('status','expired');
        end if;
        delete from private.gateway_sessions where user_key = control.reset_user_key;
        update private.gateway_session_control set generation = generation + 1,
            reset_key = null, reset_lease = null, reset_user_key = null where singleton;
        return jsonb_build_object('status','ok');
    end if;
    select * into session from private.gateway_sessions where key = p_key;
    if p_action = 'get' then
        if session.key is null then return null; end if;
        return jsonb_build_object('payload',session.payload);
    end if;
    if p_action = 'live' then
        return jsonb_build_object('live',session.key is not null and session.lease = p_lease);
    end if;
    if session.key is null then return jsonb_build_object('status','expired'); end if;
    if p_action = 'acquire' then
        if session.lease is not null then return jsonb_build_object('status','busy'); end if;
        if p_lease is null then raise exception 'Lease required' using errcode = '22023'; end if;
        update private.gateway_sessions set lease = p_lease, lease_until = operation_time + interval '30 seconds' where key = p_key;
        return jsonb_build_object('payload',session.payload,'generation',control.generation);
    end if;
    if session.lease is distinct from p_lease or p_lease is null then return jsonb_build_object('status','expired'); end if;
    if p_action = 'remove' then
        delete from private.gateway_sessions where key = p_key;
    elsif p_action = 'begin_reset' then
        if control.reset_key is not null then return jsonb_build_object('status','reset_pending'); end if;
        if session.mode <> 'recovery' or session.user_key is distinct from p_data->>'user_key' then
            raise exception 'Recovery session required' using errcode = '42501';
        end if;
        update private.gateway_session_control set generation = generation + 1,
            reset_key = p_key, reset_lease = p_lease, reset_user_key = session.user_key where singleton;
        delete from private.gateway_sessions where user_key = session.user_key and key <> p_key;
    elsif p_action = 'save' then
        update private.gateway_sessions set payload = p_data->>'payload', lease = null, lease_until = null where key = p_key;
    elsif p_action = 'rotate' then
        if control.reset_key is not null then return jsonb_build_object('status','reset_pending'); end if;
        if control.generation is distinct from (p_data->>'generation')::bigint then
            delete from private.gateway_sessions where key = p_key;
            return jsonb_build_object('status','expired');
        end if;
        delete from private.gateway_sessions where key = p_key;
        insert into private.gateway_sessions(key,payload,mode,user_key,expires_at)
            values (p_data->>'key',p_data->>'payload',p_data->>'mode',p_data->>'user_key',
                least((p_data->>'expires')::timestamptz,operation_time + interval '12 hours'));
    else
        raise exception 'Unknown session operation' using errcode = '22023';
    end if;
    return jsonb_build_object('status','ok');
end;
$$;
create function public.gateway_session(p_action text, p_key text default null, p_lease uuid default null, p_data jsonb default '{}')
returns jsonb language sql volatile security invoker set search_path = '' as $$
    select private.gateway_session(p_action,p_key,p_lease,p_data);
$$;
revoke all on function public.gateway_session(text,text,uuid,jsonb), private.gateway_session(text,text,uuid,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.gateway_session(text,text,uuid,jsonb), private.gateway_session(text,text,uuid,jsonb) to service_role;
