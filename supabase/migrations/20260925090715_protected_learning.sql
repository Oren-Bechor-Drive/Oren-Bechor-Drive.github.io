-- Quiz content is published only through a trusted operation. Nothing is seeded.
create table private.quiz_topics (
    key text primary key,
    current_version_id uuid
);
create table private.quiz_versions (
    id uuid primary key default gen_random_uuid(),
    topic_key text not null references private.quiz_topics(key),
    title text not null,
    questions jsonb not null,
    approval_reference text not null,
    published_at timestamptz not null default clock_timestamp(),
    unique (id, topic_key)
);
alter table private.quiz_topics add foreign key (current_version_id) references private.quiz_versions(id);
create index quiz_versions_topic_idx on private.quiz_versions(topic_key);
create table public.quiz_attempts (
    id uuid primary key default gen_random_uuid(),
    learner_id uuid not null references public.learners(id),
    topic_key text not null,
    version_id uuid not null,
    revision bigint not null default 0 check (revision >= 0),
    answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
    score integer check (score between 0 and 20),
    results jsonb,
    created_at timestamptz not null default clock_timestamp(),
    submitted_at timestamptz,
    foreign key (version_id, topic_key) references private.quiz_versions(id, topic_key),
    check ((submitted_at is null and score is null and results is null)
        or (submitted_at is not null and score is not null and results is not null))
);
create unique index quiz_attempts_one_draft_idx on public.quiz_attempts(learner_id, topic_key) where submitted_at is null;
create index quiz_attempts_history_idx on public.quiz_attempts(learner_id, topic_key, submitted_at desc, id desc) where submitted_at is not null;
create index quiz_attempts_version_idx on public.quiz_attempts(version_id, topic_key);
create table public.topic_completions (
    learner_id uuid not null references public.learners(id),
    topic_key text not null references private.quiz_topics(key),
    completed_at timestamptz not null default clock_timestamp(),
    primary key (learner_id, topic_key)
);
create index topic_completions_topic_idx on public.topic_completions(topic_key);
-- A cleared deadline never moves backwards, even if a trusted renewal is backdated.
create table private.learning_retention (
    learner_id uuid primary key references public.learners(id),
    cleared_through timestamptz not null
);
alter table private.quiz_topics enable row level security;
alter table private.quiz_versions enable row level security;
alter table private.learning_retention enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.topic_completions enable row level security;
revoke all on private.quiz_topics, private.quiz_versions, private.learning_retention,
    public.quiz_attempts, public.topic_completions from public, anon, authenticated, service_role;
grant select on public.quiz_attempts, public.topic_completions to authenticated;
-- Trusted operators also use RPCs for publication, attempts and cleanup.

alter table public.entitlements drop constraint entitlements_source_check;
alter table public.entitlements add constraint entitlements_source_check check (btrim(source) <> '' and char_length(source) <= 100);

create function private.learning_cutoff(p_learner uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
    -- Merge coverage intervals separated by less than ten days. A gap of exactly
    -- ten days starts a new retention period. Future grants cannot rescue a lapse
    -- until their access begins, and overlapping grants do not shorten coverage.
    with periods as (
        select starts_at, least(ends_at, coalesce(revoked_at, ends_at)) as ends_at
        from public.entitlements where learner_id = p_learner
            and starts_at <= clock_timestamp()
            and starts_at < least(ends_at, coalesce(revoked_at, ends_at))
    ), preceding as (
        select *, max(ends_at) over (order by starts_at, ends_at rows between unbounded preceding and 1 preceding) as preceding_end
        from periods
    ), grouped as (
        select *, sum(case when preceding_end is null or starts_at >= preceding_end + interval '10 days' then 1 else 0 end)
            over (order by starts_at, ends_at) as period_group from preceding
    ), deadlines as (
        select max(ends_at) + interval '10 days' as deadline from grouped group by period_group
    )
    select greatest(
        coalesce((select cleared_through from private.learning_retention where learner_id = p_learner), '-infinity'::timestamptz),
        coalesce((select max(deadline) from deadlines where deadline <= clock_timestamp()), '-infinity'::timestamptz)
    );
$$;
create function private.clean_learning(p_learner uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_cutoff timestamptz; v_count integer; v_deleted boolean := false;
begin
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('learning:' || p_learner::text, 0));
    v_cutoff := private.learning_cutoff(p_learner);
    if v_cutoff = '-infinity'::timestamptz then return false; end if;
    delete from public.section_progress where learner_id = p_learner and updated_at <= v_cutoff;
    get diagnostics v_count = row_count;
    v_deleted := v_count > 0;
    delete from public.quiz_attempts where learner_id = p_learner and created_at <= v_cutoff;
    get diagnostics v_count = row_count;
    insert into private.learning_retention(learner_id, cleared_through) values (p_learner, v_cutoff)
        on conflict (learner_id) do update set cleared_through = greatest(private.learning_retention.cleared_through, excluded.cleared_through);
    return v_deleted or v_count > 0;
end;
$$;
create function private.entitlement_learning_guard() returns trigger
language plpgsql volatile security definer set search_path = '' as $$
begin
    if tg_op = 'DELETE' then
        raise exception 'Retain entitlement records; revoke access instead' using errcode = '55000';
    end if;
    if tg_op = 'UPDATE' and new.learner_id <> old.learner_id then
        raise exception 'Entitlement ownership is immutable' using errcode = '55000';
    end if;
    perform private.clean_learning(new.learner_id);
    return new;
end;
$$;
create trigger entitlement_learning_before before insert or update or delete on public.entitlements
    for each row execute function private.entitlement_learning_guard();
create trigger entitlement_learning_after after insert or update on public.entitlements
    for each row execute function private.entitlement_learning_guard();

create function private.require_learning(p_paid boolean) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_learner uuid;
begin
    v_learner := private.active_learner_id();
    if v_learner is null then raise exception 'Learning unavailable' using errcode = '42501'; end if;
    perform private.clean_learning(v_learner);
    if private.active_learner_id() is distinct from v_learner
        or (p_paid and not private.has_paid_access()) then
        raise exception 'Learning unavailable' using errcode = '42501';
    end if;
    return v_learner;
end;
$$;
create function private.my_learning_cutoff() returns timestamptz
language sql stable security definer set search_path = '' as $$
    select private.learning_cutoff(private.active_learner_id());
$$;
create policy attempts_read_own on public.quiz_attempts for select to authenticated using (
    learner_id = (select private.active_learner_id()) and (select private.has_paid_access())
    and created_at > (select private.my_learning_cutoff())
);
create policy completions_read_own on public.topic_completions for select to authenticated using (
    learner_id = (select private.active_learner_id())
);
drop policy progress_read_own on public.section_progress;
create policy progress_read_own on public.section_progress for select to authenticated using (
    learner_id = (select private.active_learner_id())
    and updated_at > (select private.my_learning_cutoff())
);
-- Retain the existing validated position operation, but put the common learner
-- lock and cleanup before it. Entitlement DML and the sweep use that same lock.
alter function private.save_my_position(uuid, text, uuid, integer, bigint) rename to save_position_after_retention;
revoke all on function private.save_position_after_retention(uuid, text, uuid, integer, bigint) from public, anon, authenticated, service_role;
-- A request may begin before a retention deadline and wait past it. Timestamp
-- successful writes after every authorization and content lock has been acquired.
alter table public.section_progress alter column updated_at set default clock_timestamp();
create or replace function private.save_position_after_retention(
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
            position = p_position, revision = revision + 1, updated_at = clock_timestamp()
            where learner_id = v_learner and section_id = p_section_id and access_level = p_access_level
            returning * into v_progress;
    else
        if p_expected_revision <> 0 then
            raise exception 'Reading position revision conflict' using errcode = '40001',
                detail = pg_catalog.jsonb_build_object('position', v_progress.position,
                    'revision', coalesce(v_progress.revision, 0), 'content_version_id', v_progress.content_version_id)::text;
        end if;
        insert into public.section_progress(learner_id, section_id, access_level, content_version_id, position, revision, updated_at)
            values (v_learner, p_section_id, p_access_level, p_content_version_id, p_position, 1, clock_timestamp())
            returning * into v_progress;
    end if;
    return v_progress;
end;
$$;
create function private.save_my_position(p_section_id uuid, p_access_level text, p_content_version_id uuid, p_position integer, p_expected_revision bigint)
returns public.section_progress language plpgsql volatile security definer set search_path = '' as $$
begin
    perform private.require_learning(p_access_level = 'paid');
    return private.save_position_after_retention(p_section_id, p_access_level, p_content_version_id, p_position, p_expected_revision);
end;
$$;
create or replace function public.save_my_position(p_section_id uuid, p_access_level text, p_content_version_id uuid, p_position integer, p_expected_revision bigint)
returns public.section_progress language sql volatile security invoker set search_path = '' as $$
    select private.save_my_position(p_section_id, p_access_level, p_content_version_id, p_position, p_expected_revision);
$$;

create function private.publish_quiz(p_topic_key text, p_title text, p_questions jsonb, p_approval_reference text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_question jsonb; v_option jsonb; v_id uuid; v_ids text[] := '{}'; v_choices text[];
begin
    if p_topic_key is null or p_topic_key !~ '^[a-z0-9][a-z0-9-]{0,99}$'
        or p_title is null or btrim(p_title) = '' or length(p_title) > 300
        or p_approval_reference is null or btrim(p_approval_reference) = '' or length(p_approval_reference) > 2000
        or jsonb_typeof(p_questions) is distinct from 'array' then
        raise exception 'Invalid quiz publication' using errcode = '22023';
    end if;
    if jsonb_array_length(p_questions) <> 20 then raise exception 'A quiz requires 20 questions' using errcode = '22023'; end if;
    for v_question in select value from jsonb_array_elements(p_questions) loop
        if jsonb_typeof(v_question) is distinct from 'object'
            or jsonb_typeof(v_question->'id') is distinct from 'string'
            or (v_question->>'id') !~ '^[A-Za-z0-9_-]{1,100}$'
            or v_question->>'id' = any(v_ids)
            or jsonb_typeof(v_question->'prompt') is distinct from 'string' or btrim(v_question->>'prompt') = ''
            or length(v_question->>'prompt') > 10000
            or jsonb_typeof(v_question->'explanation') is distinct from 'string' or btrim(v_question->>'explanation') = ''
            or length(v_question->>'explanation') > 10000
            or jsonb_typeof(v_question->'correctOptionId') is distinct from 'string'
            or jsonb_typeof(v_question->'options') is distinct from 'array' then
            raise exception 'Invalid quiz question' using errcode = '22023';
        end if;
        if jsonb_array_length(v_question->'options') not between 2 and 6 then raise exception 'Invalid quiz choices' using errcode = '22023'; end if;
        v_ids := array_append(v_ids, v_question->>'id');
        v_choices := '{}';
        for v_option in select value from jsonb_array_elements(v_question->'options') loop
            if jsonb_typeof(v_option) is distinct from 'object'
                or jsonb_typeof(v_option->'id') is distinct from 'string'
                or (v_option->>'id') !~ '^[A-Za-z0-9_-]{1,100}$'
                or v_option->>'id' = any(v_choices)
                or jsonb_typeof(v_option->'text') is distinct from 'string' or btrim(v_option->>'text') = ''
                or length(v_option->>'text') > 10000 then
                raise exception 'Invalid quiz choice' using errcode = '22023';
            end if;
            v_choices := array_append(v_choices, v_option->>'id');
        end loop;
        if not (v_question->>'correctOptionId' = any(v_choices)) then raise exception 'Invalid answer key' using errcode = '22023'; end if;
    end loop;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('quiz-publication:' || p_topic_key, 0));
    insert into private.quiz_topics(key) values (p_topic_key) on conflict do nothing;
    insert into private.quiz_versions(topic_key, title, questions, approval_reference)
        values (p_topic_key, p_title, p_questions, p_approval_reference) returning id into v_id;
    update private.quiz_topics set current_version_id = v_id where key = p_topic_key;
    return v_id;
end;
$$;
create trigger quiz_versions_immutable before update or delete on private.quiz_versions
    for each row execute function private.refuse_version_update();
create function private.attempt_json(p_attempt public.quiz_attempts) returns jsonb
language sql stable security definer set search_path = '' as $$
    select jsonb_build_object('id', p_attempt.id, 'topicKey', p_attempt.topic_key, 'title', v.title,
        'revision', p_attempt.revision, 'status', case when p_attempt.submitted_at is null then 'draft' else 'submitted' end,
        'questions', (select jsonb_agg(jsonb_build_object('id', q->>'id', 'prompt', q->>'prompt',
            'options', (select jsonb_agg(jsonb_build_object('id', o->>'id', 'text', o->>'text') order by n)
                from jsonb_array_elements(q->'options') with ordinality as choices(o,n))) order by n)
            from jsonb_array_elements(v.questions) with ordinality as questions(q,n)),
        'answers', p_attempt.answers, 'score', p_attempt.score, 'passed', coalesce(p_attempt.score >= 17, false),
        'submittedAt', p_attempt.submitted_at)
        || case when p_attempt.submitted_at is null then '{}'::jsonb else jsonb_build_object('results', p_attempt.results) end
    from private.quiz_versions v where v.id = p_attempt.version_id;
$$;
create function private.my_learning() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_learner uuid := private.require_learning(false);
begin
    return jsonb_build_object('paidAccess', private.has_paid_access(), 'topics', coalesce((
        select jsonb_agg(jsonb_build_object('key', t.key, 'title', v.title, 'completedAt', c.completed_at) order by t.key)
        from private.quiz_topics t join private.quiz_versions v on v.id = t.current_version_id
        left join public.topic_completions c on c.topic_key = t.key and c.learner_id = v_learner
    ), '[]'::jsonb));
end;
$$;
create function private.start_my_quiz(p_topic_key text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_learner uuid := private.require_learning(true); v_attempt public.quiz_attempts; v_version uuid;
begin
    select current_version_id into v_version from private.quiz_topics where key = p_topic_key;
    if v_version is null then raise exception 'Learning unavailable' using errcode = '42501'; end if;
    select * into v_attempt from public.quiz_attempts where learner_id = v_learner and topic_key = p_topic_key and submitted_at is null;
    if not found then
        insert into public.quiz_attempts(learner_id, topic_key, version_id) values (v_learner, p_topic_key, v_version) returning * into v_attempt;
    end if;
    return private.attempt_json(v_attempt);
end;
$$;
create function private.read_my_attempt(p_attempt_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_learner uuid := private.require_learning(true); v_attempt public.quiz_attempts;
begin
    select * into v_attempt from public.quiz_attempts where id = p_attempt_id and learner_id = v_learner;
    if not found then raise exception 'Learning unavailable' using errcode = '42501'; end if;
    return private.attempt_json(v_attempt);
end;
$$;
create function private.save_my_quiz(p_attempt_id uuid, p_answers jsonb, p_expected_revision bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_learner uuid := private.require_learning(true); v_attempt public.quiz_attempts; v_questions jsonb; v_answer record;
begin
    if jsonb_typeof(p_answers) is distinct from 'object' or p_expected_revision is null or p_expected_revision < 0 then
        raise exception 'Invalid quiz answers' using errcode = '22023';
    end if;
    select * into v_attempt from public.quiz_attempts where id = p_attempt_id and learner_id = v_learner for update;
    if not found then raise exception 'Learning unavailable' using errcode = '42501'; end if;
    if v_attempt.submitted_at is not null then raise exception 'Attempt already submitted' using errcode = '40001'; end if;
    select questions into v_questions from private.quiz_versions where id = v_attempt.version_id;
    for v_answer in select * from jsonb_each(p_answers) loop
        if jsonb_typeof(v_answer.value) <> 'string' or not exists (
            select 1 from jsonb_array_elements(v_questions) q, jsonb_array_elements(q->'options') o
            where q->>'id' = v_answer.key and o->'id' = v_answer.value
        ) then raise exception 'Invalid quiz answers' using errcode = '22023'; end if;
    end loop;
    -- Only the immediately preceding identical save is a retry. Future or much
    -- older revisions cannot silently claim that an unrelated edit was saved.
    if v_attempt.answers = p_answers and p_expected_revision in (v_attempt.revision, v_attempt.revision - 1) then
        return private.attempt_json(v_attempt);
    end if;
    if v_attempt.revision <> p_expected_revision then raise exception 'Quiz revision conflict' using errcode = '40001'; end if;
    update public.quiz_attempts set answers = p_answers, revision = revision + 1 where id = p_attempt_id returning * into v_attempt;
    return private.attempt_json(v_attempt);
end;
$$;
create function private.submit_my_quiz(p_attempt_id uuid, p_expected_revision bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_learner uuid := private.require_learning(true); v_attempt public.quiz_attempts; v_questions jsonb; v_results jsonb; v_score integer;
begin
    if p_expected_revision is null or p_expected_revision < 0 then raise exception 'Invalid revision' using errcode = '22023'; end if;
    select * into v_attempt from public.quiz_attempts where id = p_attempt_id and learner_id = v_learner for update;
    if not found then raise exception 'Learning unavailable' using errcode = '42501'; end if;
    if v_attempt.submitted_at is not null then
        if p_expected_revision in (v_attempt.revision, v_attempt.revision - 1) then return private.attempt_json(v_attempt); end if;
        raise exception 'Quiz revision conflict' using errcode = '40001';
    end if;
    if v_attempt.revision <> p_expected_revision then raise exception 'Quiz revision conflict' using errcode = '40001'; end if;
    select questions into v_questions from private.quiz_versions where id = v_attempt.version_id;
    if (select count(*) from jsonb_object_keys(v_attempt.answers)) <> 20 then raise exception 'All questions require answers' using errcode = '22023'; end if;
    select count(*) filter (where v_attempt.answers->> (q->>'id') = q->>'correctOptionId'),
        jsonb_agg(jsonb_build_object('questionId', q->>'id', 'correctOptionId', q->>'correctOptionId',
            'explanation', q->>'explanation', 'correct', v_attempt.answers->> (q->>'id') = q->>'correctOptionId') order by n)
        into v_score, v_results from jsonb_array_elements(v_questions) with ordinality as questions(q,n);
    update public.quiz_attempts set score = v_score, results = v_results, submitted_at = clock_timestamp(), revision = revision + 1
        where id = p_attempt_id returning * into v_attempt;
    return private.attempt_json(v_attempt);
end;
$$;
create function private.my_quiz_history(p_topic_key text, p_before uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_learner uuid := private.require_learning(true); v_cursor public.quiz_attempts; v_page jsonb; v_more boolean; v_next uuid;
begin
    if not exists (select 1 from private.quiz_topics where key = p_topic_key) then raise exception 'Learning unavailable' using errcode = '42501'; end if;
    if p_before is not null then
        select * into v_cursor from public.quiz_attempts where id = p_before and learner_id = v_learner and topic_key = p_topic_key and submitted_at is not null;
        if not found then raise exception 'Invalid history cursor' using errcode = '22023'; end if;
    end if;
    with page as (
        select id, submitted_at, score from public.quiz_attempts
        where learner_id = v_learner and topic_key = p_topic_key and submitted_at is not null
            and (p_before is null or (submitted_at, id) < (v_cursor.submitted_at, v_cursor.id))
        order by submitted_at desc, id desc limit 51
    ), numbered as (select *, row_number() over (order by submitted_at desc, id desc) as n from page)
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'submittedAt', submitted_at, 'score', score, 'passed', score >= 17)
        order by n) filter (where n <= 50), '[]'::jsonb), count(*) > 50,
        (array_agg(id order by n) filter (where n = 50))[1]
        into v_page, v_more, v_next from numbered;
    return jsonb_build_object('attempts', v_page, 'hasMore', v_more, 'nextCursor', case when v_more then v_next else null end);
end;
$$;
create function private.complete_my_topic(p_topic_key text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_learner uuid := private.require_learning(true); v_completed timestamptz;
begin
    select completed_at into v_completed from public.topic_completions where learner_id = v_learner and topic_key = p_topic_key;
    if not found then
        if not exists (select 1 from public.quiz_attempts where learner_id = v_learner and topic_key = p_topic_key and score >= 17) then
            raise exception 'Passing attempt required' using errcode = '42501';
        end if;
        insert into public.topic_completions(learner_id, topic_key) values (v_learner, p_topic_key) returning completed_at into v_completed;
    end if;
    return jsonb_build_object('key', p_topic_key, 'completedAt', v_completed);
end;
$$;
create function private.sweep_expired_learning() returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare v_learner uuid; v_count integer := 0;
begin
    -- Stable learner order gives concurrent sweeps the same lock ordering.
    for v_learner in select learner_id from public.section_progress union select learner_id from public.quiz_attempts order by 1 loop
        if private.clean_learning(v_learner) then v_count := v_count + 1; end if;
    end loop;
    return v_count;
end;
$$;

-- Clock time is checked after a waiting writer acquires the shared learner lock.
create or replace function private.current_learner_id() returns uuid
language plpgsql volatile security definer set search_path = '' as $$
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
            and (u.banned_until is null or u.banned_until <= clock_timestamp())
            and (s.not_after is null or clock_timestamp() < s.not_after)
    );
end;
$$;
create or replace function private.has_paid_access() returns boolean
language sql volatile security definer set search_path = '' as $$
    select exists (select 1 from public.entitlements e
        where e.learner_id = private.active_learner_id() and e.scope = 'oren-driving-course'
            and e.revoked_at is null and e.starts_at <= clock_timestamp() and clock_timestamp() < e.ends_at);
$$;
create or replace function public.read_section(p_section_id uuid, p_access_level text)
returns setof public.section_versions language plpgsql volatile security invoker set search_path = '' as $$
begin
    if private.active_learner_id() is not null then perform private.my_learning(); end if;
    return query select v.* from public.section_versions v where v.section_id = p_section_id and v.access_level = p_access_level;
end;
$$;
create function public.read_my_position(p_section_id uuid, p_access_level text)
returns setof public.section_progress language plpgsql volatile security invoker set search_path = '' as $$
begin
    perform private.my_learning();
    return query select p.* from public.section_progress p where p.section_id = p_section_id and p.access_level = p_access_level;
end;
$$;
create function public.publish_quiz(p_topic_key text, p_title text, p_questions jsonb, p_approval_reference text) returns uuid
language sql volatile security invoker set search_path = '' as $$
    select private.publish_quiz(p_topic_key, p_title, p_questions, p_approval_reference);
$$;
create function public.my_learning() returns jsonb
language sql volatile security invoker set search_path = '' as $$
    select private.my_learning();
$$;
create function public.start_my_quiz(p_topic_key text) returns jsonb
language sql volatile security invoker set search_path = '' as $$
    select private.start_my_quiz(p_topic_key);
$$;
create function public.read_my_attempt(p_attempt_id uuid) returns jsonb
language sql volatile security invoker set search_path = '' as $$
    select private.read_my_attempt(p_attempt_id);
$$;
create function public.save_my_quiz(p_attempt_id uuid, p_answers jsonb, p_expected_revision bigint) returns jsonb
language sql volatile security invoker set search_path = '' as $$
    select private.save_my_quiz(p_attempt_id, p_answers, p_expected_revision);
$$;
create function public.submit_my_quiz(p_attempt_id uuid, p_expected_revision bigint) returns jsonb
language sql volatile security invoker set search_path = '' as $$
    select private.submit_my_quiz(p_attempt_id, p_expected_revision);
$$;
create function public.my_quiz_history(p_topic_key text, p_before uuid default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$
    select private.my_quiz_history(p_topic_key, p_before);
$$;
create function public.complete_my_topic(p_topic_key text) returns jsonb
language sql volatile security invoker set search_path = '' as $$
    select private.complete_my_topic(p_topic_key);
$$;
create function public.sweep_expired_learning() returns integer
language sql volatile security invoker set search_path = '' as $$
    select private.sweep_expired_learning();
$$;

-- Default grants may be inherited from the hosting project. Remove those grants
-- explicitly from every new function before granting its intended API role.
do $$
declare v_function record;
begin
    for v_function in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname in ('public','private') and p.proname = any(array[
            'learning_cutoff','my_learning_cutoff','clean_learning','entitlement_learning_guard','require_learning',
            'publish_quiz','attempt_json','my_learning','start_my_quiz','read_my_attempt','save_my_quiz',
            'submit_my_quiz','my_quiz_history','complete_my_topic','sweep_expired_learning','read_my_position','save_my_position'])
    loop
        execute format('revoke all on function %s from public, anon, authenticated, service_role', v_function.signature);
    end loop;
end;
$$;
grant execute on function private.my_learning_cutoff(), public.read_my_position(uuid,text),
    private.save_my_position(uuid,text,uuid,integer,bigint), public.save_my_position(uuid,text,uuid,integer,bigint) to authenticated;
grant execute on function public.publish_quiz(text, text, jsonb, text), private.publish_quiz(text, text, jsonb, text) to service_role;
grant execute on function public.my_learning(), private.my_learning() to authenticated;
grant execute on function public.start_my_quiz(text), private.start_my_quiz(text) to authenticated;
grant execute on function public.read_my_attempt(uuid), private.read_my_attempt(uuid) to authenticated;
grant execute on function public.save_my_quiz(uuid, jsonb, bigint), private.save_my_quiz(uuid, jsonb, bigint) to authenticated;
grant execute on function public.submit_my_quiz(uuid, bigint), private.submit_my_quiz(uuid, bigint) to authenticated;
grant execute on function public.my_quiz_history(text, uuid), private.my_quiz_history(text, uuid) to authenticated;
grant execute on function public.complete_my_topic(text), private.complete_my_topic(text) to authenticated;
grant execute on function public.sweep_expired_learning(), private.sweep_expired_learning() to service_role;

-- Legacy source keys are machine identifiers, not learner-facing titles. Leave
-- them untitled until an authored title is supplied through publication.
alter table public.learning_sections add column title text check (title is null or (btrim(title) <> '' and length(title) <= 300));
create function public.publish_learning_section(
    p_section_id uuid, p_source_key text, p_expected_revision integer,
    p_title text, p_free_text text, p_paid_text text
) returns integer
language plpgsql volatile security invoker set search_path = '' as $$
declare v_revision integer;
begin
    if p_title is null or btrim(p_title) = '' or length(p_title) > 300 then
        raise exception 'Invalid section title' using errcode = '22023';
    end if;
    v_revision := public.publish_section(p_section_id, p_source_key, p_expected_revision, p_free_text, p_paid_text);
    update public.learning_sections set title = p_title where id = p_section_id;
    return v_revision;
end;
$$;
revoke all on function public.publish_learning_section(uuid,text,integer,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.publish_learning_section(uuid,text,integer,text,text,text) to service_role;

-- Resolve version availability without recursing through the section/version
-- RLS relationship. The helper returns only access for the live caller.
create function private.section_has_accessible_version(p_section_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
    select private.active_learner_id() is not null and exists (
        select 1 from public.learning_sections s join public.section_versions v
            on v.section_id = s.id and v.revision = s.current_revision
        where s.id = p_section_id and s.state = 'published'
            and (v.access_level = 'free' or private.has_paid_access())
    );
$$;
revoke all on function private.section_has_accessible_version(uuid) from public, anon, authenticated, service_role;
grant execute on function private.section_has_accessible_version(uuid) to authenticated;
drop policy sections_read_published on public.learning_sections;
create policy sections_read_published on public.learning_sections for select to authenticated
    using (private.section_has_accessible_version(id));

create function private.read_my_sections() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
    perform private.require_learning(false);
    return jsonb_build_object('sections', coalesce((
        select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'accessLevel', v.access_level)
            order by s.title, s.id, v.access_level)
        from public.learning_sections s join public.section_versions v
            on v.section_id = s.id and v.revision = s.current_revision
        where s.state = 'published' and s.title is not null
            and (v.access_level = 'free' or private.has_paid_access())
    ), '[]'::jsonb));
end;
$$;
create function public.read_my_sections() returns jsonb
language sql volatile security invoker set search_path = '' as $$
    select private.read_my_sections();
$$;
revoke all on function private.read_my_sections(), public.read_my_sections() from public, anon, authenticated, service_role;
grant execute on function private.read_my_sections(), public.read_my_sections() to authenticated;
