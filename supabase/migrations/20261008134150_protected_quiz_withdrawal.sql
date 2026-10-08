-- Withdrawal stops unfinished instruction without rewriting immutable versions,
-- submitted grades, completion or the existing ten-day retention boundary.
create table private.quiz_version_withdrawals (
    version_id uuid primary key references private.quiz_versions(id),
    withdrawn_at timestamptz not null default clock_timestamp(),
    reason_reference text not null check (btrim(reason_reference) <> '' and length(reason_reference) <= 2000)
);
alter table private.quiz_version_withdrawals enable row level security;
revoke all on private.quiz_version_withdrawals from public, anon, authenticated, service_role;
create trigger quiz_version_withdrawals_immutable before update or delete on private.quiz_version_withdrawals
    for each row execute function private.refuse_version_update();

alter table public.quiz_attempts add column withdrawn_at timestamptz;
alter table public.quiz_attempts add constraint quiz_attempts_withdrawal_state_check
    check (withdrawn_at is null or submitted_at is null);
drop index public.quiz_attempts_one_draft_idx;
create unique index quiz_attempts_one_draft_idx on public.quiz_attempts(learner_id, topic_key)
    where submitted_at is null and withdrawn_at is null;

create function private.withdraw_quiz_version(p_version_id uuid, p_reason_reference text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_withdrawal private.quiz_version_withdrawals;
begin
    if p_version_id is null or p_reason_reference is null or btrim(p_reason_reference) = '' or length(p_reason_reference) > 2000 then
        raise exception 'Invalid withdrawal reference' using errcode = '22023';
    end if;
    -- Operators take only this version lock. They never acquire learner locks or
    -- update attempts, so they cannot invert the learner-first lock ordering.
    perform 1 from private.quiz_versions where id = p_version_id for update;
    if not found then raise exception 'Quiz version unavailable' using errcode = '42501'; end if;
    insert into private.quiz_version_withdrawals(version_id, reason_reference) values (p_version_id, p_reason_reference)
        on conflict (version_id) do nothing;
    select * into v_withdrawal from private.quiz_version_withdrawals where version_id = p_version_id;
    return jsonb_build_object('versionId', v_withdrawal.version_id, 'withdrawnAt', v_withdrawal.withdrawn_at);
end;
$$;
create function public.withdraw_quiz_version(p_version_id uuid, p_reason_reference text) returns jsonb
language sql volatile security invoker set search_path = '' as $$
    select private.withdraw_quiz_version(p_version_id, p_reason_reference);
$$;
revoke all on function public.withdraw_quiz_version(uuid,text), private.withdraw_quiz_version(uuid,text)
    from public, anon, authenticated, service_role;
grant execute on function public.withdraw_quiz_version(uuid,text), private.withdraw_quiz_version(uuid,text) to service_role;

-- All existing function grants remain restricted through CREATE OR REPLACE.
create or replace function private.attempt_json(p_attempt public.quiz_attempts) returns jsonb
language sql stable security definer set search_path = '' as $$
    select case when p_attempt.submitted_at is null and (p_attempt.withdrawn_at is not null or exists (
        select 1 from private.quiz_version_withdrawals w where w.version_id = p_attempt.version_id
    )) then jsonb_build_object('id', p_attempt.id, 'topicKey', p_attempt.topic_key,
        'revision', p_attempt.revision, 'status', 'withdrawn')
    else jsonb_build_object('id', p_attempt.id, 'topicKey', p_attempt.topic_key, 'title', v.title,
        'revision', p_attempt.revision, 'status', case when p_attempt.submitted_at is null then 'draft' else 'submitted' end,
        'questions', (select jsonb_agg(jsonb_build_object('id', q->>'id', 'prompt', q->>'prompt',
            'options', (select jsonb_agg(jsonb_build_object('id', o->>'id', 'text', o->>'text') order by n)
                from jsonb_array_elements(q->'options') with ordinality as choices(o,n))) order by n)
            from jsonb_array_elements(v.questions) with ordinality as questions(q,n)),
        'answers', p_attempt.answers, 'score', p_attempt.score,
        'passed', coalesce(p_attempt.score >= ceil(jsonb_array_length(v.questions) * 0.85), false),
        'submittedAt', p_attempt.submitted_at)
        || case when p_attempt.submitted_at is null then '{}'::jsonb else jsonb_build_object('results', p_attempt.results) end
    end from private.quiz_versions v where v.id = p_attempt.version_id;
$$;

create or replace function private.start_my_quiz(p_topic_key text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_learner uuid := private.require_learning(true); v_attempt public.quiz_attempts; v_version uuid; v_withdrawn timestamptz;
begin
    select current_version_id into v_version from private.quiz_topics where key = p_topic_key;
    if v_version is null then raise exception 'Learning unavailable' using errcode = '42501'; end if;
    select * into v_attempt from public.quiz_attempts
        where learner_id = v_learner and topic_key = p_topic_key and submitted_at is null and withdrawn_at is null for update;
    -- A restart may examine both an old draft and the current version. UUID
    -- ordering prevents two learners from acquiring these locks in opposite order.
    perform 1 from private.quiz_versions where id = any(array[v_attempt.version_id,v_version]) order by id for share;
    perform private.require_learning(true);
    if v_attempt.id is not null then
        select withdrawn_at into v_withdrawn from private.quiz_version_withdrawals where version_id = v_attempt.version_id;
        if not found then return private.attempt_json(v_attempt); end if;
        update public.quiz_attempts set withdrawn_at = v_withdrawn where id = v_attempt.id returning * into v_attempt;
    end if;
    if exists (select 1 from private.quiz_version_withdrawals where version_id = v_version) then
        if v_attempt.id is not null then return private.attempt_json(v_attempt); end if;
        raise exception 'Quiz withdrawn' using errcode = 'P4100';
    end if;
    insert into public.quiz_attempts(learner_id, topic_key, version_id) values (v_learner,p_topic_key,v_version) returning * into v_attempt;
    return private.attempt_json(v_attempt);
end;
$$;

create or replace function private.read_my_attempt(p_attempt_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_learner uuid := private.require_learning(true); v_attempt public.quiz_attempts;
begin
    select * into v_attempt from public.quiz_attempts where id = p_attempt_id and learner_id = v_learner;
    if not found then raise exception 'Learning unavailable' using errcode = '42501'; end if;
    if v_attempt.submitted_at is null then
        perform 1 from private.quiz_versions where id = v_attempt.version_id for share;
        perform private.require_learning(true);
    end if;
    return private.attempt_json(v_attempt);
end;
$$;

create or replace function private.save_my_quiz(p_attempt_id uuid, p_answers jsonb, p_expected_revision bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_learner uuid := private.require_learning(true); v_attempt public.quiz_attempts; v_questions jsonb; v_answer record;
begin
    select * into v_attempt from public.quiz_attempts where id = p_attempt_id and learner_id = v_learner for update;
    if not found then raise exception 'Learning unavailable' using errcode = '42501'; end if;
    if v_attempt.submitted_at is not null then
        if jsonb_typeof(p_answers) is distinct from 'object' or p_expected_revision is null or p_expected_revision < 0 then
            raise exception 'Invalid quiz answers' using errcode = '22023';
        end if;
        raise exception 'Attempt already submitted' using errcode = '40001';
    end if;
    select questions into v_questions from private.quiz_versions where id = v_attempt.version_id for share;
    perform private.require_learning(true);
    if v_attempt.withdrawn_at is not null or exists (select 1 from private.quiz_version_withdrawals where version_id = v_attempt.version_id) then
        raise exception 'Quiz withdrawn' using errcode = 'P4100';
    end if;
    if jsonb_typeof(p_answers) is distinct from 'object' or p_expected_revision is null or p_expected_revision < 0 then
        raise exception 'Invalid quiz answers' using errcode = '22023';
    end if;
    for v_answer in select * from jsonb_each(p_answers) loop
        if jsonb_typeof(v_answer.value) <> 'string' or not exists (
            select 1 from jsonb_array_elements(v_questions) q, jsonb_array_elements(q->'options') o
            where q->>'id' = v_answer.key and o->'id' = v_answer.value
        ) then raise exception 'Invalid quiz answers' using errcode = '22023'; end if;
    end loop;
    if v_attempt.answers = p_answers and p_expected_revision in (v_attempt.revision,v_attempt.revision-1) then return private.attempt_json(v_attempt); end if;
    if v_attempt.revision <> p_expected_revision then raise exception 'Quiz revision conflict' using errcode = '40001'; end if;
    update public.quiz_attempts set answers = p_answers, revision = revision+1 where id = p_attempt_id returning * into v_attempt;
    return private.attempt_json(v_attempt);
end;
$$;

create or replace function private.submit_my_quiz(p_attempt_id uuid, p_expected_revision bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_learner uuid := private.require_learning(true); v_attempt public.quiz_attempts; v_questions jsonb; v_results jsonb; v_score integer;
begin
    select * into v_attempt from public.quiz_attempts where id = p_attempt_id and learner_id = v_learner for update;
    if not found then raise exception 'Learning unavailable' using errcode = '42501'; end if;
    if v_attempt.submitted_at is not null then
        if p_expected_revision is null or p_expected_revision < 0 then raise exception 'Invalid revision' using errcode = '22023'; end if;
        if p_expected_revision in (v_attempt.revision,v_attempt.revision-1) then return private.attempt_json(v_attempt); end if;
        raise exception 'Quiz revision conflict' using errcode = '40001';
    end if;
    select questions into v_questions from private.quiz_versions where id = v_attempt.version_id for share;
    perform private.require_learning(true);
    if v_attempt.withdrawn_at is not null or exists (select 1 from private.quiz_version_withdrawals where version_id = v_attempt.version_id) then
        raise exception 'Quiz withdrawn' using errcode = 'P4100';
    end if;
    if p_expected_revision is null or p_expected_revision < 0 then raise exception 'Invalid revision' using errcode = '22023'; end if;
    if v_attempt.revision <> p_expected_revision then raise exception 'Quiz revision conflict' using errcode = '40001'; end if;
    if (select count(*) from jsonb_object_keys(v_attempt.answers)) <> jsonb_array_length(v_questions) then raise exception 'All questions require answers' using errcode = '22023'; end if;
    select count(*) filter (where v_attempt.answers->> (q->>'id') = q->>'correctOptionId'),
        jsonb_agg(jsonb_build_object('questionId',q->>'id','correctOptionId',q->>'correctOptionId',
            'explanation',q->>'explanation','correct',v_attempt.answers->> (q->>'id') = q->>'correctOptionId') order by n)
        into v_score,v_results from jsonb_array_elements(v_questions) with ordinality as questions(q,n);
    update public.quiz_attempts set score = v_score,results = v_results,submitted_at = clock_timestamp(),revision = revision+1
        where id = p_attempt_id returning * into v_attempt;
    return private.attempt_json(v_attempt);
end;
$$;

-- Preserve the newest paid-access-history and latest-submission contract.
create or replace function private.my_learning() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_learner uuid := private.require_learning(false); v_paid boolean := private.has_paid_access();
begin
    return jsonb_build_object(
        'paidAccess',v_paid,
        'hadPaidAccess',exists (
            select 1 from public.entitlements e
            where e.learner_id = v_learner and e.scope = 'oren-driving-course'
                and e.starts_at <= clock_timestamp()
                and e.starts_at < least(e.ends_at,coalesce(e.revoked_at,e.ends_at))
        ),
        'topics',coalesce((
            select jsonb_agg(jsonb_build_object('key',t.key,'title',v.title,'completedAt',c.completed_at,
                'latestAttempt',latest.summary) order by t.key)
            from private.quiz_topics t join private.quiz_versions v on v.id = t.current_version_id
            left join public.topic_completions c on c.topic_key = t.key and c.learner_id = v_learner
            left join lateral (
                select jsonb_build_object('id',a.id,'submittedAt',a.submitted_at,'score',a.score,
                    'questionCount',jsonb_array_length(attempt_version.questions)) as summary
                from public.quiz_attempts a join private.quiz_versions attempt_version on attempt_version.id = a.version_id
                where v_paid and a.learner_id = v_learner and a.topic_key = t.key and a.submitted_at is not null
                order by a.submitted_at desc,a.id desc limit 1
            ) latest on true
            where not exists (select 1 from private.quiz_version_withdrawals w where w.version_id = v.id)
        ),'[]'::jsonb));
end;
$$;
