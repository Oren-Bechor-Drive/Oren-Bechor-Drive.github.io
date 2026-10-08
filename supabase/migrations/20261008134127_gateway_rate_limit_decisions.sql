-- Return the remaining window without changing the shared single-counter boundary.
create function private.gateway_rate_limit_decision(p_bucket_key text, p_limit integer, p_window_seconds integer)
returns jsonb language plpgsql volatile security definer set search_path = '' set lock_timeout = '2s' as $$
declare
    v_now timestamptz;
    v_bucket private.gateway_rate_buckets;
    v_expiry timestamptz;
begin
    if p_bucket_key is null or p_bucket_key !~ '^[0-9a-f]{64}$'
        or p_limit is null or p_limit < 1 or p_limit > 10000
        or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
        raise exception 'Invalid rate limit' using errcode = '22023';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('oren:gateway-rate-limits', 0));
    v_now := clock_timestamp();
    delete from private.gateway_rate_buckets where expires_at <= v_now;
    select * into v_bucket from private.gateway_rate_buckets where bucket_key = p_bucket_key;
    if found then
        if v_bucket.request_count >= p_limit then
            v_expiry := v_bucket.expires_at;
        else
            update private.gateway_rate_buckets set request_count = request_count + 1 where bucket_key = p_bucket_key;
        end if;
    else
        if (select count(*) from private.gateway_rate_buckets) >= 4000 then
            select min(expires_at) into v_expiry from private.gateway_rate_buckets;
        else
            insert into private.gateway_rate_buckets(bucket_key, request_count, expires_at)
                values (p_bucket_key, 1, v_now + pg_catalog.make_interval(secs => p_window_seconds));
        end if;
    end if;
    if v_expiry is not null then
        return pg_catalog.jsonb_build_object('allowed', false, 'retryAfterSeconds',
            greatest(1, ceil(extract(epoch from v_expiry - clock_timestamp())))::integer);
    end if;
    return pg_catalog.jsonb_build_object('allowed', true, 'retryAfterSeconds', 0);
end;
$$;
create function public.gateway_rate_limit_decision(p_bucket_key text, p_limit integer, p_window_seconds integer)
returns jsonb language sql volatile security invoker set search_path = '' as $$
    select private.gateway_rate_limit_decision(p_bucket_key, p_limit, p_window_seconds);
$$;

-- Older hosted callers continue using the same transaction and counter once.
create or replace function private.gateway_rate_limit(p_bucket_key text, p_limit integer, p_window_seconds integer)
returns boolean language sql volatile security definer set search_path = '' as $$
    select (private.gateway_rate_limit_decision(p_bucket_key, p_limit, p_window_seconds)->>'allowed')::boolean;
$$;
revoke all on function private.gateway_rate_limit_decision(text, integer, integer),
    public.gateway_rate_limit_decision(text, integer, integer) from public, anon, authenticated, service_role;
grant execute on function private.gateway_rate_limit_decision(text, integer, integer),
    public.gateway_rate_limit_decision(text, integer, integer) to service_role;
