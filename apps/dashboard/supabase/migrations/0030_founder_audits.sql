-- Feature 3: Founder Brand Audit. Scores a founder's personal profiles (LinkedIn, X, GitHub,
-- Indie Hackers) for product/category signal, and stores generated optimized copy.
-- Append-only; cadence-gated in the API. RLS select-own; service-role writes.
create table if not exists founder_audits (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  linkedin_url text,
  twitter_handle text,
  github_url text,
  indiehackers_url text,
  overall_score integer not null default 0 check (overall_score between 0 and 100),
  scores jsonb not null default '[]'::jsonb,
  top_priority text,
  generated_copy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists founder_audits_product_idx on founder_audits(product_id, created_at desc);

alter table founder_audits enable row level security;
drop policy if exists "founder_audits_own" on founder_audits;
create policy "founder_audits_own" on founder_audits for select using (auth.uid() = user_id);
-- writes: service role only (API after ownership + cadence checks)
