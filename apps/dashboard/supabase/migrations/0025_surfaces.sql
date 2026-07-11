-- Feature C: AI-training surfaces beyond directories (assisted distribution + tracking).
-- Reddit intentionally NOT seeded: its automation/self-promotion detection bans real user
-- accounts, which would harm the user (product principle: never damage the user's standing).
create table if not exists surfaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('github','blog','twitter','podcast','youtube','stackoverflow','community')),
  url_pattern text not null,
  submission_type text not null check (submission_type in ('automated','assisted_manual','tracked_only')),
  quality_score integer not null default 50,
  tier_unlock integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Surfaces are a public catalog (like platforms): readable by any authenticated user,
-- writable only by the service role.
alter table surfaces enable row level security;
drop policy if exists "surfaces_read" on surfaces;
create policy "surfaces_read" on surfaces for select using (auth.role() = 'authenticated');

-- Submissions already track directories via platform_id; surfaces reuse the same table
-- via a nullable surface_id (one or the other is set).
alter table submissions add column if not exists surface_id uuid references surfaces(id);

insert into surfaces (name, category, url_pattern, submission_type, quality_score, tier_unlock) values
  ('GitHub Awesome Lists', 'github', 'https://github.com/search?q=awesome+%s&type=repositories', 'assisted_manual', 82, 0),
  ('Dev.to', 'blog', 'https://dev.to/new', 'assisted_manual', 74, 0),
  ('Hashnode', 'blog', 'https://hashnode.com/create/story', 'assisted_manual', 70, 1),
  ('Indie Hackers', 'community', 'https://www.indiehackers.com/products/new', 'assisted_manual', 76, 1),
  ('Stack Overflow', 'stackoverflow', 'https://stackoverflow.com/search?q=%s', 'assisted_manual', 80, 2),
  ('X / Twitter', 'twitter', 'https://x.com/compose/post', 'tracked_only', 68, 0)
on conflict do nothing;
