-- The dashboard may install this event-trigger helper with PUBLIC execution.
-- Its trigger remains active; only direct API execution privileges are removed.
do $$
begin
    if exists (
        select 1 from pg_catalog.pg_proc p
        join pg_catalog.pg_event_trigger e on e.evtfoid = p.oid
        where p.oid = pg_catalog.to_regprocedure('public.rls_auto_enable()')
            and p.prorettype = 'pg_catalog.event_trigger'::pg_catalog.regtype
            and e.evtname = 'ensure_rls'
    ) then
        revoke execute on function public.rls_auto_enable() from public, anon, authenticated, service_role;
    end if;
end;
$$;

-- Account and text-content foundation. No billing provider or production fixtures.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create table public.learners (
    id uuid primary key default gen_random_uuid(),
    state text not null default 'active' check (state in ('active', 'suspended', 'deletion_pending', 'deleted')),
    display_name text not null default '' check (char_length(display_name) <= 100),
    created_at timestamptz not null default statement_timestamp(),
    updated_at timestamptz not null default statement_timestamp()
);
create table private.learner_identities (
    auth_user_id uuid primary key references auth.users(id) on delete restrict,
    learner_id uuid not null unique references public.learners(id) on delete restrict,
    created_at timestamptz not null default statement_timestamp()
);
create table public.learning_sections (
    id uuid primary key default gen_random_uuid(),
    source_key text not null unique check (btrim(source_key) <> ''),
    current_revision integer not null default 1 check (current_revision > 0),
    state text not null default 'draft' check (state in ('draft', 'published', 'retired')),
    created_at timestamptz not null default statement_timestamp()
);
create table public.section_versions (
    id uuid primary key default gen_random_uuid(),
    section_id uuid not null references public.learning_sections(id) on delete restrict,
    access_level text not null check (access_level in ('free', 'paid')),
    revision integer not null check (revision > 0),
    body_text text not null check (btrim(body_text) <> ''),
    created_at timestamptz not null default statement_timestamp(),
    unique (section_id, access_level, revision),
    unique (id, section_id, access_level)
);
create table public.entitlements (
    id uuid primary key default gen_random_uuid(),
    learner_id uuid not null references public.learners(id) on delete restrict,
    scope text not null default 'oren-driving-course' check (scope = 'oren-driving-course'),
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    revoked_at timestamptz,
    source text not null default 'development' check (source = 'development'),
    source_reference text not null unique check (btrim(source_reference) <> ''),
    created_at timestamptz not null default statement_timestamp(),
    check (ends_at > starts_at)
);
create index entitlements_learner_idx on public.entitlements(learner_id);
create index entitlements_current_idx on public.entitlements(learner_id, starts_at, ends_at) where revoked_at is null;
create table public.section_progress (
    learner_id uuid not null references public.learners(id) on delete restrict,
    section_id uuid not null references public.learning_sections(id) on delete restrict,
    access_level text not null check (access_level in ('free', 'paid')),
    content_version_id uuid not null,
    position integer not null check (position between 0 and 10000),
    revision bigint not null check (revision > 0),
    updated_at timestamptz not null default statement_timestamp(),
    primary key (learner_id, section_id, access_level),
    foreign key (content_version_id, section_id, access_level)
        references public.section_versions(id, section_id, access_level) on delete restrict
);
create index section_progress_section_idx on public.section_progress(section_id);
create index section_progress_version_idx on public.section_progress(content_version_id, section_id, access_level);

alter table public.learners enable row level security;
alter table private.learner_identities enable row level security;
alter table public.learning_sections enable row level security;
alter table public.section_versions enable row level security;
alter table public.entitlements enable row level security;
alter table public.section_progress enable row level security;

revoke all on public.learners, private.learner_identities, public.learning_sections,
    public.section_versions, public.entitlements, public.section_progress from public, anon, authenticated, service_role;
grant select on public.learners, public.learning_sections, public.section_versions,
    public.entitlements, public.section_progress to authenticated;
grant update (display_name) on public.learners to authenticated;
grant select, insert, update, delete on public.learners, private.learner_identities,
    public.learning_sections, public.section_versions, public.entitlements, public.section_progress to service_role;

-- These helpers intentionally bypass RLS only to resolve the caller's current
-- identity and access. No learner ID or plan is accepted from the caller.
create function private.current_learner_id() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
    v_user uuid;
    v_session uuid;
begin
    begin
        v_user := auth.uid();
        v_session := (auth.jwt() ->> 'session_id')::uuid;
    exception when invalid_text_representation then
        return null;
    end;
    return (
        select i.learner_id
        from private.learner_identities i
        join auth.users u on u.id = i.auth_user_id
        join auth.sessions s on s.user_id = u.id and s.id = v_session
        where u.id = v_user and u.email_confirmed_at is not null and u.deleted_at is null
            and u.is_anonymous is false
            and (u.banned_until is null or u.banned_until <= statement_timestamp())
            and (s.not_after is null or statement_timestamp() < s.not_after)
    );
end;
$$;
create function private.active_learner_id() returns uuid
language sql stable security definer set search_path = '' as $$
    select l.id from public.learners l
    where l.id = private.current_learner_id() and l.state = 'active';
$$;
create function private.has_paid_access() returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (
        select 1 from public.entitlements e
        where e.learner_id = private.active_learner_id()
            and e.scope = 'oren-driving-course' and e.revoked_at is null
            and e.starts_at <= statement_timestamp() and statement_timestamp() < e.ends_at
    );
$$;
revoke all on function private.current_learner_id(), private.active_learner_id(), private.has_paid_access()
    from public, anon, authenticated, service_role;
grant execute on function private.active_learner_id(), private.has_paid_access() to authenticated;

create policy learners_read_own on public.learners for select to authenticated
    using (id = (select private.active_learner_id()));
create policy learners_edit_own_name on public.learners for update to authenticated
    using (id = (select private.active_learner_id()))
    with check (id = (select private.active_learner_id()));
create policy sections_read_published on public.learning_sections for select to authenticated
    using ((select private.active_learner_id()) is not null and state = 'published');
create policy versions_read_accessible on public.section_versions for select to authenticated
    using (
        (select private.active_learner_id()) is not null
        and (access_level = 'free' or (select private.has_paid_access()))
        and exists (select 1 from public.learning_sections s
            where s.id = section_id and s.state = 'published' and s.current_revision = revision)
    );
create policy entitlements_read_own on public.entitlements for select to authenticated
    using (learner_id = (select private.active_learner_id()));
create policy progress_read_own on public.section_progress for select to authenticated
    using (learner_id = (select private.active_learner_id()));
-- private.learner_identities deliberately has no API policies or table grants.

create function private.touch_learner() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
    new.updated_at := statement_timestamp();
    return new;
end;
$$;
create trigger learners_updated_at before update on public.learners
    for each row execute function private.touch_learner();
create function private.refuse_version_update() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
    raise exception 'Content versions are immutable; publish a new revision' using errcode = '55000';
end;
$$;
create trigger section_versions_immutable before update on public.section_versions
    for each row execute function private.refuse_version_update();
revoke all on function private.touch_learner(), private.refuse_version_update() from public, anon, authenticated, service_role;

-- Service-only provisioning. The Auth UUID is never chosen by a browser.
create function private.provision_learner(p_auth_user_id uuid) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_learner uuid;
begin
    if not exists (select 1 from auth.users u where u.id = p_auth_user_id
        and u.email_confirmed_at is not null and u.deleted_at is null and u.is_anonymous is false
        and (u.banned_until is null or u.banned_until <= statement_timestamp())) then
        raise exception 'Verified account required' using errcode = '42501';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('provision:' || p_auth_user_id::text, 0));
    select learner_id into v_learner from private.learner_identities where auth_user_id = p_auth_user_id;
    if v_learner is null then
        insert into public.learners default values returning id into v_learner;
        insert into private.learner_identities(auth_user_id, learner_id) values (p_auth_user_id, v_learner);
    end if;
    return v_learner;
end;
$$;
create function public.provision_learner(p_auth_user_id uuid) returns uuid
language sql volatile security invoker set search_path = '' as $$
    select private.provision_learner(p_auth_user_id);
$$;
revoke all on function public.provision_learner(uuid), private.provision_learner(uuid) from public, anon, authenticated, service_role;
grant execute on function public.provision_learner(uuid), private.provision_learner(uuid) to service_role;

-- One transaction publishes a new revision and its free/paid bodies. Null omits
-- that access level from the new revision; old bodies remain referenced by progress.
create function public.publish_section(
    p_section_id uuid, p_source_key text, p_expected_revision integer,
    p_free_text text, p_paid_text text
) returns integer
language plpgsql volatile security invoker set search_path = '' as $$
declare v_section public.learning_sections; v_revision integer;
begin
    if p_section_id is null or p_source_key is null or btrim(p_source_key) = ''
        or p_expected_revision is null or p_expected_revision < 0
        or (p_free_text is null and p_paid_text is null)
        or (p_free_text is not null and btrim(p_free_text) = '')
        or (p_paid_text is not null and btrim(p_paid_text) = '') then
        raise exception 'Invalid publication' using errcode = '22023';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('publish:' || p_section_id::text, 0));
    select * into v_section from public.learning_sections where id = p_section_id for update;
    if not found then
        if p_expected_revision <> 0 then
            raise exception 'Publication revision conflict' using errcode = '40001';
        end if;
        insert into public.learning_sections(id, source_key) values (p_section_id, p_source_key);
        v_revision := 1;
    else
        if v_section.current_revision <> p_expected_revision or v_section.source_key <> p_source_key then
            raise exception 'Publication revision conflict' using errcode = '40001';
        end if;
        v_revision := v_section.current_revision + 1;
    end if;
    if p_free_text is not null then
        insert into public.section_versions(section_id, access_level, revision, body_text)
            values (p_section_id, 'free', v_revision, p_free_text);
    end if;
    if p_paid_text is not null then
        insert into public.section_versions(section_id, access_level, revision, body_text)
            values (p_section_id, 'paid', v_revision, p_paid_text);
    end if;
    update public.learning_sections set current_revision = v_revision, state = 'published' where id = p_section_id;
    return v_revision;
end;
$$;
revoke all on function public.publish_section(uuid, text, integer, text, text) from public, anon, authenticated, service_role;
grant execute on function public.publish_section(uuid, text, integer, text, text) to service_role;

create function public.read_section(p_section_id uuid, p_access_level text)
returns setof public.section_versions
language sql stable security invoker set search_path = '' as $$
    select v.* from public.section_versions v where v.section_id = p_section_id and v.access_level = p_access_level;
$$;
revoke all on function public.read_section(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.read_section(uuid, text) to authenticated;

create function private.save_my_position(
    p_section_id uuid, p_access_level text, p_content_version_id uuid,
    p_position integer, p_expected_revision bigint
) returns public.section_progress
language plpgsql volatile security definer set search_path = '' as $$
declare
    v_learner uuid;
    v_section public.learning_sections;
    v_progress public.section_progress;
begin
    if p_section_id is null or p_content_version_id is null
        or p_access_level is null or p_access_level not in ('free', 'paid')
        or p_position is null or p_position < 0 or p_position > 10000
        or p_expected_revision is null or p_expected_revision < 0 then
        raise exception 'Invalid reading position' using errcode = '22023';
    end if;
    v_learner := private.active_learner_id();
    if v_learner is null then
        raise exception 'Active account required' using errcode = '42501';
    end if;
    -- Also serializes two first saves, for which no progress row exists to lock.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        'progress:' || v_learner::text || ':' || p_section_id::text || ':' || p_access_level, 0));
    -- A publication/retirement cannot change the target revision mid-save.
    select * into v_section from public.learning_sections where id = p_section_id for share;
    if not found or v_section.state <> 'published'
        or private.active_learner_id() is distinct from v_learner
        or (p_access_level = 'paid' and not private.has_paid_access())
        or not exists (select 1 from public.section_versions v
            where v.id = p_content_version_id and v.section_id = p_section_id
                and v.access_level = p_access_level and v.revision = v_section.current_revision) then
        raise exception 'Content unavailable' using errcode = '42501';
    end if;
    select * into v_progress from public.section_progress
        where learner_id = v_learner and section_id = p_section_id and access_level = p_access_level for update;
    if found then
        if v_progress.content_version_id = p_content_version_id and v_progress.position = p_position then
            return v_progress;
        end if;
        if v_progress.revision <> p_expected_revision then
            raise exception 'Reading position revision conflict' using errcode = '40001',
                detail = pg_catalog.jsonb_build_object('position', v_progress.position,
                    'revision', coalesce(v_progress.revision, 0), 'content_version_id', v_progress.content_version_id)::text;
        end if;
        update public.section_progress set content_version_id = p_content_version_id,
            position = p_position, revision = revision + 1, updated_at = statement_timestamp()
            where learner_id = v_learner and section_id = p_section_id and access_level = p_access_level
            returning * into v_progress;
    else
        if p_expected_revision <> 0 then
            raise exception 'Reading position revision conflict' using errcode = '40001',
                detail = pg_catalog.jsonb_build_object('position', v_progress.position,
                    'revision', coalesce(v_progress.revision, 0), 'content_version_id', v_progress.content_version_id)::text;
        end if;
        insert into public.section_progress(learner_id, section_id, access_level, content_version_id, position, revision)
            values (v_learner, p_section_id, p_access_level, p_content_version_id, p_position, 1)
            returning * into v_progress;
    end if;
    return v_progress;
end;
$$;
create function public.save_my_position(
    p_section_id uuid, p_access_level text, p_content_version_id uuid,
    p_position integer, p_expected_revision bigint
) returns public.section_progress
language sql volatile security invoker set search_path = '' as $$
    select private.save_my_position(p_section_id, p_access_level, p_content_version_id, p_position, p_expected_revision);
$$;
revoke all on function public.save_my_position(uuid, text, uuid, integer, bigint), private.save_my_position(uuid, text, uuid, integer, bigint)
    from public, anon, authenticated, service_role;
grant execute on function public.save_my_position(uuid, text, uuid, integer, bigint), private.save_my_position(uuid, text, uuid, integer, bigint)
    to authenticated;
