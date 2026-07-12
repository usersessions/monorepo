-- Feature 5: Community Participation Engine. Assisted + human-posted only. Reddit intentionally
-- excluded (self-promotion detection bans real user accounts). Opportunities are added manually
-- or by a future curated scan; responses are drafted, edited, and posted by the human.
create table if not exists community_opportunities (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  surface text not null check (surface in ('indiehackers','stackoverflow','linkedin','hackernews','other')),
  url text not null,
  title text not null,
  content_snippet text,
  relevance_score integer not null default 50,
  status text not null default 'new' check (status in ('new','approved','responded','ignored')),
  created_at timestamptz not null default now()
);
create index if not exists community_opportunities_product_idx on community_opportunities(product_id, created_at desc);

create table if not exists community_responses (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references community_opportunities(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  draft_response text not null,
  final_response text,
  posted_at timestamptz,
  upvotes integer not null default 0,
  clicks integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists community_responses_opportunity_idx on community_responses(opportunity_id);

alter table community_opportunities enable row level security;
alter table community_responses enable row level security;

-- Founder owns their opportunities/responses end to end (manual add + status updates).
drop policy if exists "community_opps_own" on community_opportunities;
create policy "community_opps_own" on community_opportunities for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "community_responses_own" on community_responses;
create policy "community_responses_own" on community_responses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
