-- 0014_admin_expansion.sql — suspension, revenue tracking, support, GDPR requests, admin alerts.
-- Admin surfaces read via service role; RLS below covers the user-facing side only.

-- Enforced suspension (checked in bearer auth + auth callback).
alter table profiles add column if not exists suspended_at timestamptz;

-- Append-only revenue facts, written by the Paystack webhook. Never updated or deleted.
create table revenue_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  event_type text not null check (event_type in
    ('subscription_created','subscription_renewed','subscription_cancelled',
     'payment_succeeded','payment_failed','refund_issued','plan_upgraded','plan_downgraded')),
  amount numeric,
  currency text,
  paystack_reference text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index revenue_events_user_idx on revenue_events(user_id, created_at desc);
create index revenue_events_created_idx on revenue_events(created_at desc);

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  subject text not null,
  body text not null,
  status text not null default 'open' check (status in ('open','pending','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references profiles(id),
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_user_idx on support_tickets(user_id, created_at desc);
create index support_tickets_status_idx on support_tickets(status, priority);

create table support_ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  author_id uuid not null references profiles(id),
  is_internal boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);
create index support_ticket_replies_ticket_idx on support_ticket_replies(ticket_id, created_at);

create table gdpr_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  request_type text not null check (request_type in ('access','deletion','portability','rectification')),
  status text not null default 'pending' check (status in ('pending','in_progress','completed','rejected')),
  admin_notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index gdpr_requests_user_idx on gdpr_requests(user_id, created_at desc);

create table admin_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in
    ('security_alert','revenue_spike','system_error','adapter_failure','user_report','compliance_flag')),
  severity text not null check (severity in ('info','warning','critical')),
  title text not null,
  body text,
  metadata jsonb,
  read boolean not null default false,
  dismissed boolean not null default false,
  created_at timestamptz not null default now()
);
create index admin_notifications_created_idx on admin_notifications(created_at desc);

-- ============ RLS ============
alter table revenue_events enable row level security;
alter table support_tickets enable row level security;
alter table support_ticket_replies enable row level security;
alter table gdpr_requests enable row level security;
alter table admin_notifications enable row level security;

-- Users can see their own revenue facts; writes are service-role only (webhook).
create policy "own revenue select" on revenue_events for select using (auth.uid() = user_id);

create policy "own tickets select" on support_tickets for select using (auth.uid() = user_id);
create policy "own tickets insert" on support_tickets for insert with check (auth.uid() = user_id);

-- Users see only non-internal replies on their own tickets; may reply to their own tickets.
create policy "own ticket replies select" on support_ticket_replies for select using (
  is_internal = false
  and exists (select 1 from support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
);
create policy "own ticket replies insert" on support_ticket_replies for insert with check (
  author_id = auth.uid()
  and is_internal = false
  and exists (select 1 from support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
);

create policy "own gdpr select" on gdpr_requests for select using (auth.uid() = user_id);
create policy "own gdpr insert" on gdpr_requests for insert with check (auth.uid() = user_id);

-- admin_notifications: no user-facing policies — service role only.
