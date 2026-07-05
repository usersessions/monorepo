-- 0005_link_check.sql — M9 monitoring engine support.
-- 48h grace tracking: false dead-link alerts are trust-fatal (BUILD_SPEC §9), so a listing is
-- only marked removed after failing continuously for 48 hours, never on a single bad check.

alter table submissions add column link_check_failing_since timestamptz;
alter table submissions add column last_checked_at timestamptz;

create index submissions_check_order_idx on submissions(last_checked_at asc nulls first)
  where simulated = false and listing_url is not null;
