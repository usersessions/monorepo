-- Feature A: AI-Readable Landing Page Audit (AIO Audit).
-- Append-only scorecards; rate-limited to ≤1/product/week (free/founder) or /day (pro/agency)
-- in the API layer. RLS: a user sees only audits for products they own.
create table if not exists landing_page_audits (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  overall_score integer not null check (overall_score between 0 and 100),
  categories jsonb not null default '[]'::jsonb,
  top_priority text,
  created_at timestamptz not null default now()
);

create index if not exists landing_page_audits_product_created_idx
  on landing_page_audits (product_id, created_at desc);

alter table landing_page_audits enable row level security;

drop policy if exists "audits_select_own" on landing_page_audits;
create policy "audits_select_own" on landing_page_audits
  for select using (user_id = auth.uid());

-- Inserts happen via the service-role client in /api/audit after ownership + metering
-- checks, so no INSERT policy is granted to authenticated users (fail-closed).
