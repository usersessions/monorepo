-- 0007_admin_user.sql — pin the operator account.
-- info@usersessions.io is the admin. The auth callback also (re)applies this role on every
-- sign-in, so this migration covers the case where the profile already exists.

update profiles set role = 'admin' where lower(email) = 'info@usersessions.io';
