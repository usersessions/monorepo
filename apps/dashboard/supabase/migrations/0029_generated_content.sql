-- Feature 2: Comparison Content Generator. Founder-published content drafts (vs pages,
-- roundups, alternative posts, FAQ). RLS select-own; writes via service role after metering.
create table if not exists generated_content (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  content_type text not null check (content_type in ('vs_page','best_tools_roundup','alternative_post','faq_page')),
  draft_markdown text not null,
  published_url text,
  ai_citation_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists generated_content_product_idx on generated_content(product_id, created_at desc);

alter table generated_content enable row level security;
drop policy if exists "generated_content_own" on generated_content;
create policy "generated_content_own" on generated_content for select using (auth.uid() = user_id);
-- The founder may set the published_url on their own rows.
drop policy if exists "generated_content_update_own" on generated_content;
create policy "generated_content_update_own" on generated_content
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
