-- Enable required extensions (these are usually active on Supabase by default, but we ensure they exist)
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- Create a helper function that reads secrets from the vault and sends the HTTP POST request.
-- Note: Security definer allows this function to read from vault.decrypted_secrets.
create or replace function public.trigger_cron_endpoint(path text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  site_url text;
  cron_secret text;
  request_id bigint;
begin
  -- Fetch the SITE_URL and CRON_SECRET from the Supabase Vault.
  -- You must insert these into vault.secrets manually!
  select secret into site_url from vault.decrypted_secrets where name = 'SITE_URL';
  select secret into cron_secret from vault.decrypted_secrets where name = 'CRON_SECRET';

  if site_url is null or cron_secret is null then
    raise exception 'Missing SITE_URL or CRON_SECRET in vault.secrets';
  end if;

  -- Ensure site_url does not end with a slash, and path starts with a slash
  site_url := rtrim(site_url, '/');
  if left(path, 1) != '/' then
    path := '/' || path;
  end if;

  -- Send the HTTP POST request to the Vercel/Next.js API using pg_net
  select net.http_post(
    url := site_url || path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cron_secret
    )
  ) into request_id;

  return request_id;
end;
$$;

-- Revoke execute from public so anonymous users can't trigger cron jobs manually.
revoke execute on function public.trigger_cron_endpoint(text) from public;
revoke execute on function public.trigger_cron_endpoint(text) from anon;
revoke execute on function public.trigger_cron_endpoint(text) from authenticated;

-- Schedule the 4 background jobs using pg_cron.
-- Unschedule first to make this migration idempotent.
select cron.unschedule('cron_weekly_digest');
select cron.unschedule('cron_platform_quality');
select cron.unschedule('cron_link_check');
select cron.unschedule('cron_ai_visibility');

-- 1. Weekly Digest (Monday at 9AM)
select cron.schedule(
  'cron_weekly_digest',
  '0 9 * * 1',
  $$ select public.trigger_cron_endpoint('/api/cron/weekly-digest'); $$
);

-- 2. Platform Quality (Daily at midnight)
select cron.schedule(
  'cron_platform_quality',
  '0 0 * * *',
  $$ select public.trigger_cron_endpoint('/api/cron/platform-quality'); $$
);

-- 3. Link Check (Hourly)
select cron.schedule(
  'cron_link_check',
  '0 * * * *',
  $$ select public.trigger_cron_endpoint('/api/cron/link-check'); $$
);

-- 4. AI Visibility (Every 12 hours)
select cron.schedule(
  'cron_ai_visibility',
  '0 0,12 * * *',
  $$ select public.trigger_cron_endpoint('/api/cron/ai-visibility'); $$
);
