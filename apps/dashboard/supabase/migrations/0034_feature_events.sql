-- Feature Usage Tracking. Append-only telemetry so we can see which features are actually used
-- and prune dead ones after a 30-day freeze. Fire-and-forget inserts from client + server.
-- NOTE: numbered 0034 (not 0028 as originally specced) — 0028_review_system and 0029_generated_content
-- already exist; reusing those numbers would collide.
create table if not exists feature_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  feature_name text not null check (feature_name in (
    'aio_audit','ai_visibility_query','ai_visibility_suggest','category_ownership_view',
    'surface_distribution','surface_verify','intelligence_briefing_view','intelligence_briefing_email',
    'competitor_scan','competitor_scan_run','review_campaign_create','review_request_send',
    'comparison_content_generate','founder_audit','referral_program_generate','community_response_draft',
    'campaign_launch','campaign_simulate','report_view','platform_browse','surface_browse',
    'analytics_view','settings_view','pricing_view','cancel_flow_start'
  )),
  event_type text not null check (event_type in ('view','click','generate','submit','export','email')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists feature_events_feature_created_idx on feature_events(feature_name, created_at desc);
create index if not exists feature_events_user_created_idx on feature_events(user_id, created_at desc);
create index if not exists feature_events_product_idx on feature_events(product_id) where product_id is not null;

alter table feature_events enable row level security;
-- Users may read and insert only their own events. Admin reads go through the service role.
drop policy if exists "feature_events_select_own" on feature_events;
create policy "feature_events_select_own" on feature_events for select using (auth.uid() = user_id);
drop policy if exists "feature_events_insert_own" on feature_events;
create policy "feature_events_insert_own" on feature_events for insert with check (auth.uid() = user_id);
