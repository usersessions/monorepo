-- 0006_activate_features.sql — activate user-facing features for launch.
-- Flags fail closed everywhere, so enabling here is the single switch.

update feature_flags
set enabled = true, updated_at = now()
where flag_name in ('pricing_page', 'billing');

-- Activate the three pilot platforms that have adapters (M6). They run in
-- simulation until each adapter is live-verified; the remaining 11 catalog
-- rows stay inactive per the adapter definition-of-done rule.
update platforms
set active = true
where id in ('theresanaiforthat', 'futurepedia', 'uneed');
