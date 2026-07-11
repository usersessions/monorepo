-- Feature B: Category Query Ownership.
-- Upgrade visibility_queries with a query type + category tag, and add a
-- denormalized competitor-appearance table for fast share-of-voice reads.

alter table visibility_queries
  add column if not exists category_tag text,
  add column if not exists query_type text not null default 'category_direct'
    check (query_type in ('category_direct', 'alternative', 'comparison', 'use_case'));

-- One row per (query, competitor) seen in a check. Denormalized for fast reads;
-- refreshed by the ai-visibility cron. Service-role writes; owner-scoped reads.
create table if not exists visibility_competitors (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references visibility_queries(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  competitor_name text not null,
  engine text not null,
  last_seen_at timestamptz not null default now(),
  unique (query_id, competitor_name, engine)
);
create index if not exists visibility_competitors_user_idx on visibility_competitors(user_id);
create index if not exists visibility_competitors_query_idx on visibility_competitors(query_id);

alter table visibility_competitors enable row level security;
drop policy if exists "own visibility competitors select" on visibility_competitors;
create policy "own visibility competitors select" on visibility_competitors
  for select using (auth.uid() = user_id);
-- writes: service role only (weekly cron)
