-- Feature 6: Referral Program Generator. AI proposes a referral structure + copy the founder
-- implements in their OWN product. RLS select-own + update-own (set implemented_url);
-- service-role insert after metering.
create table if not exists referral_programs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  structure_type text not null check (structure_type in ('give_get','credits','discount','cash','tiered')),
  generated_copy jsonb not null default '{}'::jsonb,
  implemented_url text,
  created_at timestamptz not null default now()
);
create index if not exists referral_programs_product_idx on referral_programs(product_id, created_at desc);

alter table referral_programs enable row level security;
drop policy if exists "referral_programs_select_own" on referral_programs;
create policy "referral_programs_select_own" on referral_programs for select using (auth.uid() = user_id);
drop policy if exists "referral_programs_update_own" on referral_programs;
create policy "referral_programs_update_own" on referral_programs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
