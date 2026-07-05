-- 0002_monitoring.sql — BUILD_SPEC §9: the recurring-value engine.

create table resubmission_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  original_submission_id uuid not null references submissions(id),
  platform_id text not null references platforms(id),
  status text not null default 'queued' check (status in ('queued','picked_up','completed')),
  created_at timestamptz not null default now()
);
create index resubmission_queue_user_idx on resubmission_queue(user_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in
    ('dead_link','adapter_broken','score_delta','report_ready',
     'email_verification_needed','visibility_change','new_platforms')),
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, created_at desc);

-- Every cron writes a row here; /admin/system reads last-run timestamps from it.
create table cron_logs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null check (status in ('ok','failed')),
  detail jsonb,
  ran_at timestamptz not null default now()
);
create index cron_logs_job_idx on cron_logs(job_name, ran_at desc);

alter table resubmission_queue enable row level security;
alter table notifications enable row level security;
alter table cron_logs enable row level security;

create policy "own queue" on resubmission_queue for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own notifications" on notifications for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- cron_logs: no user policy on purpose — service role writes, admin routes read via service role.
