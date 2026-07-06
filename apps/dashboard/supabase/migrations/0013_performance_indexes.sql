-- 0013_performance_indexes.sql — indexes matching how the app actually queries,
-- so Listings/Analytics/admin and the link-check cron stay flat as rows accumulate.
-- All idempotent; safe against indexes already created in 0001–0011.

-- link-check rotation: exactly the cron's filter + order
-- (simulated=false, checkable statuses, oldest-checked first, nulls first).
create index if not exists submissions_linkcheck_idx
  on submissions (last_checked_at asc nulls first)
  where simulated = false and status in ('submitted','live','indexed');

-- Listings page: every submission for a user, newest first.
create index if not exists submissions_user_created_idx
  on submissions (user_id, created_at desc);

-- Launches-per-month metering in POST /api/campaigns.
create index if not exists campaigns_product_started_idx
  on campaigns (product_id, started_at desc);

-- AI Visibility surfaces: per-user checks over time.
create index if not exists visibility_checks_user_checked_idx
  on visibility_checks (user_id, checked_at desc);

-- Admin signup metrics (today / 7 days).
create index if not exists profiles_created_idx
  on profiles (created_at desc);

-- Admin system page: latest cron runs.
create index if not exists cron_logs_ran_at_idx
  on cron_logs (ran_at desc);
