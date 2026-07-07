-- 0018_competitor_automation.sql — recurring competitor scans + web push infrastructure.
-- The manual scanner stays for ad-hoc runs; watches are the saved, scheduled version.
-- Cadence is enforced in the cron route by plan: agency=daily, founder=weekly, free=monthly.

create table competitor_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  query text not null,
  competitor_name text not null,
  competitor_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index competitor_watches_user_idx on competitor_watches(user_id);
alter table competitor_watches enable row level security;
create policy "own competitor watches" on competitor_watches for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Link scan rows to their watch so due-ness is computable per watch.
alter table competitor_scans add column watch_id uuid references competitor_watches(id) on delete set null;
create index competitor_scans_watch_idx on competitor_scans(watch_id, scanned_at desc);

-- Web Push subscriptions (browser pushManager output; VAPID keys live in env).
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on push_subscriptions(user_id);
alter table push_subscriptions enable row level security;
create policy "own push subscriptions" on push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Allow the new notification kind.
alter table notifications drop constraint notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in
  ('dead_link','adapter_broken','score_delta','report_ready',
   'email_verification_needed','visibility_change','new_platforms','competitor_scan'));

-- Schedule: the route runs daily at 07:00 UTC; per-user cadence is enforced inside it.
do $$ begin
  perform cron.unschedule('cron_competitor_scan');
exception when others then null;
end $$;

select cron.schedule(
  'cron_competitor_scan',
  '0 7 * * *',
  $$ select public.trigger_cron_endpoint('/api/cron/competitor-scan'); $$
);
