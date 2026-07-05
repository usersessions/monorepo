-- 0009_realtime.sql — dashboard realtime refresh (BUILD_SPEC §8: zero polling).
-- Adds the user-facing tables to the supabase_realtime publication so the
-- dashboard subscribes to changes and updates the moment the extension syncs.
-- Idempotent: re-running is a no-op.

do $$
declare
  t text;
begin
  foreach t in array array['submissions', 'campaigns', 'distribution_scores', 'notifications'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_table then null;
    end;
  end loop;
end $$;
