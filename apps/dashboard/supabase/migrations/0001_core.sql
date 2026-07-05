-- 0001_core.sql — BUILD_SPEC §6: identity, portfolio, catalog, campaigns, scores, flags.
-- Banned by spec and deliberately absent: web2 category, proxy fields, domain_authority, Stripe columns.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('user','admin')),
  plan text not null default 'free' check (plan in ('free','founder','agency')),
  paystack_customer_code text,
  paystack_subscription_code text,
  paystack_email_token text,
  subscription_status text not null default 'none'
    check (subscription_status in ('none','active','non_renewing','attention','cancelled')),
  created_at timestamptz not null default now()
);

-- The ICP has a portfolio: everything hangs off products (per-product slots are the billing unit).
create table products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  url text not null,
  category text,
  created_at timestamptz not null default now()
);
create index products_user_idx on products(user_id);

create table platforms (
  id text primary key,
  name text not null,
  category text not null check (category in ('ai','startup','saas','dev')),
  editorial_score int,          -- labeled seed estimate, shown as 'editorial estimate' until quality_score exists
  quality_score numeric,        -- Platform Quality Score, computed nightly from M10 onward (one name, everywhere)
  tier_required text not null default 'free' check (tier_required in ('free','founder','agency')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  status text not null default 'running' check (status in ('running','completed','failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index campaigns_user_idx on campaigns(user_id);
create index campaigns_product_idx on campaigns(product_id);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  platform_id text not null references platforms(id),
  status text not null default 'submitted' check (status in
    ('submitted','awaiting_email_verification','live','indexed','failed','removed')),
  listing_url text,
  screenshot_url text,
  simulated boolean not null default false,
  created_at timestamptz not null default now()
);
create index submissions_user_idx on submissions(user_id);
create index submissions_campaign_idx on submissions(campaign_id);
create index submissions_platform_idx on submissions(platform_id);

-- Append-only. Renamed from the old 'health_scores' concept: this is the Distribution Score.
create table distribution_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  score int not null check (score between 0 and 100),
  platform_coverage numeric,
  avg_platform_quality numeric,
  link_survival_rate numeric,
  indexation_rate numeric,
  computed_at timestamptz not null default now()
);
create index distribution_scores_user_idx on distribution_scores(user_id, product_id, computed_at desc);

create table edits_telemetry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  platform_category text not null,
  original_hook text,
  edited_hook text,
  original_body text,
  edited_body text,
  was_edited boolean not null,
  created_at timestamptz not null default now()
);

create table feature_flags (
  flag_name text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ============ RLS: every table, no exceptions (platforms = public read) ============
alter table profiles enable row level security;
alter table products enable row level security;
alter table platforms enable row level security;
alter table campaigns enable row level security;
alter table submissions enable row level security;
alter table distribution_scores enable row level security;
alter table edits_telemetry enable row level security;
alter table feature_flags enable row level security;

create policy "own profile select" on profiles for select using (auth.uid() = id);
create policy "own profile insert" on profiles for insert with check (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id);

create policy "own products" on products for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "platforms public read" on platforms for select using (true);
-- platforms writes: service role only (no user-facing policy)

create policy "own campaigns" on campaigns for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own submissions" on submissions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own scores select" on distribution_scores for select using (auth.uid() = user_id);
-- distribution_scores writes: service role only (append-only from API/cron)

create policy "own telemetry insert" on edits_telemetry for insert with check (auth.uid() = user_id);

create policy "flags readable by authenticated" on feature_flags
  for select using (auth.role() = 'authenticated');
-- feature_flags writes: service role only (admin API routes)
