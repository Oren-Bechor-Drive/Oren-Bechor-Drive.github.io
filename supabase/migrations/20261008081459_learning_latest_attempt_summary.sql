-- The learning overview owns each topic's latest submitted attempt summary.
-- Current paid access is required; retained completion remains independently visible.
create or replace function private.my_learning() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
    v_learner uuid := private.require_learning(false);
    v_paid boolean := private.has_paid_access();
begin
    return jsonb_build_object(
        'paidAccess', v_paid,
        'hadPaidAccess', exists (
            select 1 from public.entitlements e
            where e.learner_id = v_learner and e.scope = 'oren-driving-course'
                and e.starts_at <= clock_timestamp()
                and e.starts_at < least(e.ends_at, coalesce(e.revoked_at, e.ends_at))
        ),
        'topics', coalesce((
            select jsonb_agg(jsonb_build_object(
                'key', t.key, 'title', v.title, 'completedAt', c.completed_at,
                'latestAttempt', latest.summary
            ) order by t.key)
            from private.quiz_topics t join private.quiz_versions v on v.id = t.current_version_id
            left join public.topic_completions c on c.topic_key = t.key and c.learner_id = v_learner
            left join lateral (
                select jsonb_build_object(
                    'id', a.id, 'submittedAt', a.submitted_at, 'score', a.score,
                    'questionCount', jsonb_array_length(attempt_version.questions)
                ) as summary
                from public.quiz_attempts a join private.quiz_versions attempt_version on attempt_version.id = a.version_id
                where v_paid and a.learner_id = v_learner and a.topic_key = t.key and a.submitted_at is not null
                order by a.submitted_at desc, a.id desc limit 1
            ) latest on true
        ), '[]'::jsonb));
end;
$$;
