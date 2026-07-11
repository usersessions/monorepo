-- Feature D: weekly competitive intelligence briefings.
-- Append-only snapshot of the 4 intelligence categories per user per week, so the
-- dashboard "Weekly Briefing" reads the last stored briefing and the email sends real data.
create table if not exists intelligence_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  new_competitor_listings jsonb not null default '[]'::jsonb,
  competitor_mention_changes jsonb not null default '[]'::jsonb,
  new_platforms jsonb not null default '[]'::jsonb,
  category_shifts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists intelligence_briefings_user_idx
  on intelligence_briefings (user_id, created_at desc);

alter table intelligence_briefings enable row level security;
drop policy if exists "briefings_select_own" on intelligence_briefings;
create policy "briefings_select_own" on intelligence_briefings
  for select using (auth.uid() = user_id);
-- writes: service role only (weekly cron)
