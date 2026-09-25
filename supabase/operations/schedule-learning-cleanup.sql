-- Run as the database owner after deploying the protected-learning migration
-- and enabling Supabase Cron. Do not apply this to the test-only Auth fixture.
-- Re-running replaces the named job; the cleanup RPC itself is idempotent.
select cron.schedule(
    'oren-expired-learning-cleanup',
    '* * * * *',
    $$select public.sweep_expired_learning();$$
);
-- Inspect cron.job and cron.job_run_details after installation. Access checks
-- hide expired records at the deadline even if a scheduled run is delayed.
