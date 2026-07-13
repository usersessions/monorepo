-- 0036_platform_requests_realtime.sql — add platform_requests to the realtime publication
-- so the /platforms voting UI updates vote counts live without polling (BUILD_SPEC §8).
-- Idempotent: re-running is a no-op.

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.platform_requests';
  exception
    when duplicate_object then null;
    when undefined_table then null;
  end;
end $$;
