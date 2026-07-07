-- 0019_sandbox_activation.sql — blanket activation WITH truthful labeling (owner decision,
-- Option 2). Every catalog row becomes selectable for sandbox testing, and the new
-- live_verified column records which adapters have actually passed a watched live
-- submission (M6). The extension's M6 gate independently forces simulation while any
-- adapter is unverified, so activation here cannot cause a real post by itself.
--
-- PROMOTION RULE: when an adapter is verified, flip the extension registry to
-- verified:true AND set live_verified=true here in the same change. The UI badges
-- anything active-but-unverified as "simulation only" — never "live".

alter table platforms add column live_verified boolean not null default false;

update platforms set active = true;
