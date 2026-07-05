-- 0010_notification_prefs.sql
-- Adds per-user notification preference columns to profiles.
-- Defaults are ON (opt-out model) so existing users keep receiving all notifications.

alter table profiles
  add column if not exists notif_weekly_digest boolean not null default true,
  add column if not exists notif_link_alerts   boolean not null default true,
  add column if not exists notif_new_platforms  boolean not null default true;
