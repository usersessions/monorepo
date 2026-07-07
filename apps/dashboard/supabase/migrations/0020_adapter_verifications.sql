-- 0020_adapter_verifications.sql — per-user, per-platform live-mode promotion.
-- The extension's M6 gate becomes PER-PLATFORM: an adapter runs live for a user only
-- when that user has marked it verified here (dashboard /platforms → Verify) or the
-- registry itself is verified. Everything else keeps running in simulation.

create table adapter_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  platform_id text not null references platforms(id) on delete cascade,
  verified boolean not null default false,
  verified_at timestamptz,
  verified_by text check (verified_by in ('user','admin','auto')),
  notes text,
  created_at timestamptz not null default now(),
  unique(user_id, platform_id)
);
create index adapter_verifications_user_idx on adapter_verifications(user_id);

alter table adapter_verifications enable row level security;
create policy "own adapter verifications" on adapter_verifications for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Campaign-sync notifications need a new kind.
alter table notifications drop constraint notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind in
  ('dead_link','adapter_broken','score_delta','report_ready',
   'email_verification_needed','visibility_change','new_platforms','campaign_synced'));
