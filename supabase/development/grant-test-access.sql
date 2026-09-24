-- Development operator only, never called by the gateway or a learner.
-- Set oren.test_auth_user_id and oren.test_access_until on this SQL connection.
begin;
do $$
declare
    auth_user_id uuid := nullif(current_setting('oren.test_auth_user_id', true), '')::uuid;
    access_until timestamptz := nullif(current_setting('oren.test_access_until', true), '')::timestamptz;
    learner uuid;
begin
    if auth_user_id is null or access_until is null or not isfinite(access_until)
        or access_until <= statement_timestamp()
        or access_until > statement_timestamp() + interval '7 days' then
        raise exception 'Supply a verified test Auth user and an access end within seven days';
    end if;
    learner := public.provision_learner(auth_user_id);
    insert into public.entitlements(learner_id, starts_at, ends_at, source_reference)
        values (learner, statement_timestamp(), access_until, 'test-lessons:' || auth_user_id::text)
        on conflict (source_reference) do update
            set ends_at = excluded.ends_at, revoked_at = null;
end;
$$;
commit;
