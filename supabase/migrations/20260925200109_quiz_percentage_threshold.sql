-- Grade each attempt against its immutable version's question count.
-- Existing 20-question attempts still require 17 correct answers.
alter table public.quiz_attempts drop constraint quiz_attempts_score_check;
alter table public.quiz_attempts add constraint quiz_attempts_score_check
    check (score >= 0 and score <= jsonb_array_length(results));

-- CREATE OR REPLACE retains the existing restricted function grants.
create or replace function private.publish_quiz(p_topic_key text, p_title text, p_questions jsonb, p_approval_reference text) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare v_question jsonb; v_option jsonb; v_id uuid; v_ids text[] := '{}'; v_choices text[];
begin
    if p_topic_key is null or p_topic_key !~ '^[a-z0-9][a-z0-9-]{0,99}$'
        or p_title is null or btrim(p_title) = '' or length(p_title) > 300
        or p_approval_reference is null or btrim(p_approval_reference) = '' or length(p_approval_reference) > 2000
        or jsonb_typeof(p_questions) is distinct from 'array' then
        raise exception 'Invalid quiz publication' using errcode = '22023';
    end if;
    if jsonb_array_length(p_questions) = 0 then raise exception 'A quiz requires at least one question' using errcode = '22023'; end if;
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

create or replace function private.attempt_json(p_attempt public.quiz_attempts) returns jsonb
language sql stable security definer set search_path = '' as $$
    select jsonb_build_object('id', p_attempt.id, 'topicKey', p_attempt.topic_key, 'title', v.title,
        'revision', p_attempt.revision, 'status', case when p_attempt.submitted_at is null then 'draft' else 'submitted' end,
        'questions', (select jsonb_agg(jsonb_build_object('id', q->>'id', 'prompt', q->>'prompt',
            'options', (select jsonb_agg(jsonb_build_object('id', o->>'id', 'text', o->>'text') order by n)
                from jsonb_array_elements(q->'options') with ordinality as choices(o,n))) order by n)
            from jsonb_array_elements(v.questions) with ordinality as questions(q,n)),
        'answers', p_attempt.answers, 'score', p_attempt.score, 'passed', coalesce(p_attempt.score >= ceil(jsonb_array_length(v.questions) * 0.85), false),
        'submittedAt', p_attempt.submitted_at)
        || case when p_attempt.submitted_at is null then '{}'::jsonb else jsonb_build_object('results', p_attempt.results) end
    from private.quiz_versions v where v.id = p_attempt.version_id;
$$;

create or replace function private.submit_my_quiz(p_attempt_id uuid, p_expected_revision bigint) returns jsonb
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
    if (select count(*) from jsonb_object_keys(v_attempt.answers)) <> jsonb_array_length(v_questions) then raise exception 'All questions require answers' using errcode = '22023'; end if;
    select count(*) filter (where v_attempt.answers->> (q->>'id') = q->>'correctOptionId'),
        jsonb_agg(jsonb_build_object('questionId', q->>'id', 'correctOptionId', q->>'correctOptionId',
            'explanation', q->>'explanation', 'correct', v_attempt.answers->> (q->>'id') = q->>'correctOptionId') order by n)
        into v_score, v_results from jsonb_array_elements(v_questions) with ordinality as questions(q,n);
    update public.quiz_attempts set score = v_score, results = v_results, submitted_at = clock_timestamp(), revision = revision + 1
        where id = p_attempt_id returning * into v_attempt;
    return private.attempt_json(v_attempt);
end;
$$;

create or replace function private.my_quiz_history(p_topic_key text, p_before uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_learner uuid := private.require_learning(true); v_cursor public.quiz_attempts; v_page jsonb; v_more boolean; v_next uuid;
begin
    if not exists (select 1 from private.quiz_topics where key = p_topic_key) then raise exception 'Learning unavailable' using errcode = '42501'; end if;
    if p_before is not null then
        select * into v_cursor from public.quiz_attempts where id = p_before and learner_id = v_learner and topic_key = p_topic_key and submitted_at is not null;
        if not found then raise exception 'Invalid history cursor' using errcode = '22023'; end if;
    end if;
    with page as (
        select a.id, a.submitted_at, a.score, jsonb_array_length(v.questions) as question_count
        from public.quiz_attempts a join private.quiz_versions v on v.id = a.version_id
        where a.learner_id = v_learner and a.topic_key = p_topic_key and a.submitted_at is not null
            and (p_before is null or (a.submitted_at, a.id) < (v_cursor.submitted_at, v_cursor.id))
        order by a.submitted_at desc, a.id desc limit 51
    ), numbered as (select *, row_number() over (order by submitted_at desc, id desc) as n from page)
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'submittedAt', submitted_at, 'score', score, 'questionCount', question_count, 'passed', score >= ceil(question_count * 0.85))
        order by n) filter (where n <= 50), '[]'::jsonb), count(*) > 50,
        (array_agg(id order by n) filter (where n = 50))[1]
        into v_page, v_more, v_next from numbered;
    return jsonb_build_object('attempts', v_page, 'hasMore', v_more, 'nextCursor', case when v_more then v_next else null end);
end;
$$;

create or replace function private.complete_my_topic(p_topic_key text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_learner uuid := private.require_learning(true); v_completed timestamptz;
begin
    select completed_at into v_completed from public.topic_completions where learner_id = v_learner and topic_key = p_topic_key;
    if not found then
        if not exists (select 1 from public.quiz_attempts a join private.quiz_versions v on v.id = a.version_id
            where a.learner_id = v_learner and a.topic_key = p_topic_key
                and a.score >= ceil(jsonb_array_length(v.questions) * 0.85)) then
            raise exception 'Passing attempt required' using errcode = '42501';
        end if;
        insert into public.topic_completions(learner_id, topic_key) values (v_learner, p_topic_key) returning completed_at into v_completed;
    end if;
    return jsonb_build_object('key', p_topic_key, 'completedAt', v_completed);
end;
$$;
