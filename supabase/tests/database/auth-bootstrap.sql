-- Test-only subset of Supabase's Auth contract. Never run this on hosted Supabase.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
    id uuid primary key,
    email_confirmed_at timestamptz,
    is_anonymous boolean not null default false,
    banned_until timestamptz,
    deleted_at timestamptz
);
create table auth.sessions (
    id uuid primary key,
    user_id uuid not null references auth.users(id),
    not_after timestamptz
);
create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt()->>'sub', '')::uuid;
$$;
-- Model inherited grants too: the migration must remove unsafe defaults on its objects.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
-- Model the dashboard's pre-existing automatic-RLS event trigger and broad ACL.
create function public.rls_auto_enable() returns event_trigger
language plpgsql security definer set search_path = pg_catalog as $$
declare command record;
begin
    for command in select * from pg_event_trigger_ddl_commands()
        where command_tag = 'CREATE TABLE' and schema_name = 'public' and object_type = 'table'
    loop
        execute format('alter table %s enable row level security', command.object_identity);
    end loop;
end;
$$;
create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();
