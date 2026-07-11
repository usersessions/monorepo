-- Feature 1: Review Generation System. We REQUEST honest reviews from a founder's own
-- activated users — never fake, gate, or incentivize. Platforms are tracked_only for now
-- (we track the funnel; the user posts nothing automatically).
create table if not exists review_platforms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  category text not null,
  quality_score integer not null default 50,
  tier_unlock integer not null default 1,
  submission_type text not null default 'tracked_only' check (submission_type in ('tracked_only')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists review_campaigns (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','sending','sent','completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists review_campaigns_user_idx on review_campaigns(user_id, created_at desc);

create table if not exists review_requests (
  id uuid primary key default gen_random_uuid(),
  review_campaign_id uuid not null references review_campaigns(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  recipient_email text not null,
  recipient_name text,
  activation_event text,
  platform_id uuid references review_platforms(id),
  subject text,
  body text,
  status text not null default 'draft' check (status in ('draft','sent','opened','clicked','reviewed')),
  resend_count integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists review_requests_campaign_idx on review_requests(review_campaign_id);

-- RLS.
alter table review_platforms enable row level security;
alter table review_campaigns enable row level security;
alter table review_requests enable row level security;

drop policy if exists "review_platforms_read" on review_platforms;
create policy "review_platforms_read" on review_platforms for select using (auth.role() = 'authenticated');

drop policy if exists "review_campaigns_own" on review_campaigns;
create policy "review_campaigns_own" on review_campaigns for select using (auth.uid() = user_id);

drop policy if exists "review_requests_own" on review_requests;
create policy "review_requests_own" on review_requests for select using (auth.uid() = user_id);
-- writes for campaigns/requests: service role only (API routes after ownership + metering).

insert into review_platforms (name, url, category, quality_score, tier_unlock) values
  ('G2', 'https://www.g2.com', 'software', 90, 1),
  ('Capterra', 'https://www.capterra.com', 'software', 85, 1),
  ('Trustpilot', 'https://www.trustpilot.com', 'general', 80, 1),
  ('Product Hunt', 'https://www.producthunt.com', 'launch', 82, 1),
  ('Chrome Web Store', 'https://chromewebstore.google.com', 'extension', 78, 1)
on conflict do nothing;
