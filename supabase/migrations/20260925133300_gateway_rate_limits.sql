-- Short, service-only transactions share counters across gateway instances.
create table private.gateway_rate_buckets (
    bucket_key text primary key check (bucket_key ~ '^[0-9a-f]{64}$'),
    request_count integer not null check (request_count > 0),
    expires_at timestamptz not null
);
create index gateway_rate_buckets_expiry_idx on private.gateway_rate_buckets(expires_at);
alter table private.gateway_rate_buckets enable row level security;
revoke all on private.gateway_rate_buckets from public, anon, authenticated, service_role;

create function private.gateway_rate_limit(p_bucket_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql volatile security definer set search_path = '' set lock_timeout = '2s' as $$
declare
    v_now timestamptz;
    v_bucket private.gateway_rate_buckets;
begin
    if p_bucket_key is null or p_bucket_key !~ '^[0-9a-f]{64}$'
        or p_limit is null or p_limit < 1 or p_limit > 10000
        or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
        raise exception 'Invalid rate limit' using errcode = '22023';
    end if;
    -- Global capacity and counter changes share one brief transaction lock.
    -- No network/provider calls run while this lock is held.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('oren:gateway-rate-limits', 0));
    v_now := clock_timestamp();
    delete from private.gateway_rate_buckets where expires_at <= v_now;
    select * into v_bucket from private.gateway_rate_buckets where bucket_key = p_bucket_key;
    if found then
        if v_bucket.request_count >= p_limit then return false; end if;
        update private.gateway_rate_buckets set request_count = request_count + 1 where bucket_key = p_bucket_key;
    else
        if (select count(*) from private.gateway_rate_buckets) >= 4000 then return false; end if;
        insert into private.gateway_rate_buckets(bucket_key, request_count, expires_at)
            values (p_bucket_key, 1, v_now + pg_catalog.make_interval(secs => p_window_seconds));
    end if;
    return true;
end;
$$;
create function public.gateway_rate_limit(p_bucket_key text, p_limit integer, p_window_seconds integer)
returns boolean language sql volatile security invoker set search_path = '' as $$
    select private.gateway_rate_limit(p_bucket_key, p_limit, p_window_seconds);
$$;
revoke all on function public.gateway_rate_limit(text, integer, integer), private.gateway_rate_limit(text, integer, integer)
    from public, anon, authenticated, service_role;
grant execute on function public.gateway_rate_limit(text, integer, integer), private.gateway_rate_limit(text, integer, integer) to service_role;

create function private.sweep_gateway_rate_limits()
returns void language plpgsql volatile security definer set search_path = '' set lock_timeout = '2s' as $$
begin
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('oren:gateway-rate-limits', 0));
    delete from private.gateway_rate_buckets where expires_at <= clock_timestamp();
end;
$$;
create function public.sweep_gateway_rate_limits()
returns void language sql volatile security invoker set search_path = '' as $$
    select private.sweep_gateway_rate_limits();
$$;
revoke all on function public.sweep_gateway_rate_limits(), private.sweep_gateway_rate_limits()
    from public, anon, authenticated, service_role;
grant execute on function public.sweep_gateway_rate_limits(), private.sweep_gateway_rate_limits() to service_role;
