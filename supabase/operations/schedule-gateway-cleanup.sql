-- Run as database owner after gateway migrations and Supabase Cron are enabled.
-- Re-running replaces this named job. It never clears an uncertain reset barrier.
select cron.schedule(
    'oren-expired-gateway-cleanup',
    '* * * * *',
    $$select public.gateway_session('sweep'); select public.sweep_gateway_rate_limits();$$
);
-- Inspect cron.job and cron.job_run_details after installation.
