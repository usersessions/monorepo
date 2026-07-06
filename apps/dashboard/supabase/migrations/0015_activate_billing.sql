-- 0015_activate_billing.sql — owner decision: Paystack live keys are configured,
-- pricing goes live. Force-enables the flags even where an explicit row was
-- previously false. The /admin/flags kill switch still works afterwards.

insert into feature_flags (flag_name, enabled) values
  ('pricing_page', true),
  ('billing', true)
on conflict (flag_name) do update set enabled = true, updated_at = now();
