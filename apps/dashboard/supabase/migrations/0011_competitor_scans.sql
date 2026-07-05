-- 0011_competitor_scans.sql
-- Ad-hoc competitor scans via AI (Billing form feature)

create table competitor_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  query text not null,
  competitor_name text not null,
  competitor_url text not null,
  engine text not null check (engine in ('gemini')),
  mentioned boolean not null,
  rank int,
  snippet text,
  scanned_at timestamptz not null default now()
);
create index competitor_scans_user_idx on competitor_scans(user_id, scanned_at desc);

alter table competitor_scans enable row level security;

create policy "own competitor scans" on competitor_scans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
