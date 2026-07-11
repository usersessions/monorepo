-- Feature C refinement: dedicated per-surface status distinct from the generic
-- submission status (submitted/live/removed). Authoritative for surface rows;
-- monitoring keeps it in sync (submitted → verified when the post is reachable,
-- → rejected after the 48h dead-link window).
alter table submissions
  add column if not exists surface_status text
  check (surface_status is null or surface_status in ('in_progress','submitted','verified','rejected'));

create index if not exists submissions_surface_idx on submissions(surface_id) where surface_id is not null;
