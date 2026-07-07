-- 0020_platform_health.sql — per-platform adapter health snapshots for /admin (epic: 20 gaps, gap 7).
-- Written by adapter checks / crons via service role; read by admin surfaces only.

create table platform_health (
  id uuid primary key default gen_random_uuid(),
  platform_id text not null references platforms(id) on delete cascade,
  status text not null check (status in ('healthy','degraded','down','maintenance')),
  last_check_at timestamptz not null default now(),
  avg_response_ms int,
  error_rate numeric,
  adapter_version text,
  notes text,
  created_at timestamptz not null default now()
);
create index platform_health_platform_idx on platform_health(platform_id, last_check_at desc);

alter table platform_health enable row level security;
-- No user-facing policies on purpose — service role only.
