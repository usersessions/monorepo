-- 0003_measurement.sql — BUILD_SPEC §10: AI Visibility (the flagship recurring metric).

create table visibility_queries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  query text not null,                -- e.g. 'best AI tool for <category>'; AI-suggested, user-editable
  created_at timestamptz not null default now()
);
create index visibility_queries_product_idx on visibility_queries(product_id);

-- Append-only. Snippets stored VERBATIM and shown as-is; a 'not mentioned' week is displayed, never smoothed.
create table visibility_checks (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references visibility_queries(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  engine text not null check (engine in ('chatgpt','perplexity','gemini')),
  mentioned boolean not null,
  rank int,
  snippet text,
  checked_at timestamptz not null default now()
);
create index visibility_checks_query_idx on visibility_checks(query_id, checked_at desc);

alter table visibility_queries enable row level security;
alter table visibility_checks enable row level security;

create policy "own visibility queries" on visibility_queries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own visibility checks select" on visibility_checks for select using (auth.uid() = user_id);
-- visibility_checks writes: service role only (weekly cron)
