-- 0012_integrations.sql — user-configured outbound webhooks (Slack / Discord).
-- One row per (user, kind). RLS-scoped to the owner; service role reads for cron alerts.

create table integrations (
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('slack','discord')),
  webhook_url text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table integrations enable row level security;

create policy "own integrations" on integrations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
