-- Platform Request / Voting. Users tell us which platforms to build adapters for next.
-- Public read on requests; authenticated insert; one vote per user per request (delete own vote).
-- NOTE: numbered 0035 (not 0029 as originally specced) to avoid colliding with 0029_generated_content.
create table if not exists platform_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  url text,
  category text not null check (category in ('ai','startup','saas','dev','marketplace','other')),
  description text,
  requester_id uuid references profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','under_review','approved','rejected','shipped')),
  vote_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists platform_requests_votes_idx on platform_requests(vote_count desc);
create index if not exists platform_requests_status_idx on platform_requests(status);

create table if not exists platform_request_votes (
  request_id uuid not null references platform_requests(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
create index if not exists platform_request_votes_user_idx on platform_request_votes(user_id);

alter table platform_requests enable row level security;
alter table platform_request_votes enable row level security;

-- Requests: anyone signed in can read the board; authenticated users can create a request.
-- Status transitions and vote_count writes go through the service role (API), never the client.
drop policy if exists "platform_requests_select_all" on platform_requests;
create policy "platform_requests_select_all" on platform_requests for select using (auth.role() = 'authenticated');
drop policy if exists "platform_requests_insert_auth" on platform_requests;
create policy "platform_requests_insert_auth" on platform_requests for insert with check (auth.uid() = requester_id);

-- Votes: users read all vote rows (to compute has_voted) but may only create/remove their own.
drop policy if exists "platform_request_votes_select" on platform_request_votes;
create policy "platform_request_votes_select" on platform_request_votes for select using (auth.role() = 'authenticated');
drop policy if exists "platform_request_votes_insert_own" on platform_request_votes;
create policy "platform_request_votes_insert_own" on platform_request_votes for insert with check (auth.uid() = user_id);
drop policy if exists "platform_request_votes_delete_own" on platform_request_votes;
create policy "platform_request_votes_delete_own" on platform_request_votes for delete using (auth.uid() = user_id);
