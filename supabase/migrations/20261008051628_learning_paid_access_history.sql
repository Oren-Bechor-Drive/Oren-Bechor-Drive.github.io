-- Expose only whether the current learner has had a started paid-access period.
-- This history flag is informational; current access and cleanup stay unchanged.
create or replace function private.my_learning() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_learner uuid := private.require_learning(false);
begin
    return jsonb_build_object(
        'paidAccess', private.has_paid_access(),
        'hadPaidAccess', exists (
            select 1 from public.entitlements e
            where e.learner_id = v_learner and e.scope = 'oren-driving-course'
                and e.starts_at <= clock_timestamp()
                and e.starts_at < least(e.ends_at, coalesce(e.revoked_at, e.ends_at))
        ),
        'topics', coalesce((
            select jsonb_agg(jsonb_build_object('key', t.key, 'title', v.title, 'completedAt', c.completed_at) order by t.key)
            from private.quiz_topics t join private.quiz_versions v on v.id = t.current_version_id
            left join public.topic_completions c on c.topic_key = t.key and c.learner_id = v_learner
        ), '[]'::jsonb));
end;
$$;
