-- 0004_admin.sql — BUILD_SPEC §7(pipeline) + §12(admin).

create table adapter_runs (
  id uuid primary key default gen_random_uuid(),
  platform_id text not null references platforms(id),
  run_type text not null check (run_type in ('nightly_check','fix_canary','staged_rollout')),
  status text not null check (status in ('passed','failed','pending_review')),
  dom_snapshot_url text,
  proposed_diff text,
  canary_results jsonb,               -- per-test-account pass/fail from simulation-mode canary batch
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Append-only. NEVER edited or deleted from the UI. Every impersonation, suspension,
-- billing override, and flag change writes a row here — no exceptions.
create table admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references profiles(id),
  action text not null,
  target_user_id uuid references profiles(id),
  detail jsonb,
  created_at timestamptz not null default now()
);

alter table adapter_runs enable row level security;
alter table admin_audit_log enable row level security;

create policy "admin only adapter_runs" on adapter_runs for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

create policy "admin only audit read" on admin_audit_log for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "admin only audit insert" on admin_audit_log for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
-- No update/delete policies on admin_audit_log by design: append-only.
