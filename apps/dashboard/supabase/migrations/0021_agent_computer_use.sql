-- 0021: Agent (Computer Use) — sessions + per-step planning logs.
-- Screenshots are deliberately NOT stored: plans and page metadata only.

create table if not exists agent_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid,
  product_id uuid,
  platform_id text not null,
  status text not null check (status in ('running', 'paused', 'completed', 'failed')),
  current_step integer not null default 0,
  total_steps integer not null default 0,
  paused_reason text,
  simulated boolean not null default true,
  run_context jsonb not null default '{}'::jsonb,
  history jsonb not null default '[]'::jsonb,
  result text check (result in ('success', 'already_exists', 'error', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references agent_sessions(id) on delete cascade,
  step_index integer not null,
  perception_url text,
  perception_page_type text,
  plan jsonb,
  execution_result jsonb,
  created_at timestamptz not null default now()
);

alter table agent_sessions enable row level security;
alter table agent_logs enable row level security;

create policy agent_sessions_user_isolation on agent_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy agent_logs_user_isolation on agent_logs
  for select using (session_id in (select id from agent_sessions where user_id = auth.uid()));

create index if not exists idx_agent_sessions_user on agent_sessions(user_id);
create index if not exists idx_agent_sessions_status on agent_sessions(status);
create index if not exists idx_agent_sessions_updated on agent_sessions(updated_at desc);
create index if not exists idx_agent_logs_session on agent_logs(session_id);

-- Realtime: the dashboard agent monitor subscribes to session changes.
alter publication supabase_realtime add table agent_sessions;
