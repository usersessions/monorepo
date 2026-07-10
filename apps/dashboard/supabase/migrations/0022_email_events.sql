-- Email deliverability events, written by the svix-verified Resend webhook
-- (/api/webhooks/resend). Service-role only: RLS enabled with no policies.
create table if not exists email_events (
  id uuid primary key default gen_random_uuid(),
  email_id text,
  event_type text not null,
  recipient text,
  subject text,
  created_at timestamptz not null default now()
);

create index if not exists email_events_type_created_idx
  on email_events (event_type, created_at desc);

alter table email_events enable row level security;
