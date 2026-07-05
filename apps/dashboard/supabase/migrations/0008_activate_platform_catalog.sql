-- 0008_activate_platform_catalog.sql — open the full launch catalog.
-- Owner decision: every catalog platform is visible and selectable at launch.
-- Adapters that have not yet passed M6 live-verification continue to run in
-- simulation mode, so activation here changes availability, not submission safety.

update platforms
set active = true
where active = false;
