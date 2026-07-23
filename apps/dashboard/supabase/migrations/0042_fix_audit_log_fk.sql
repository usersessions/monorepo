-- Fix foreign key constraints on admin_audit_log so deleting a user doesn't crash

ALTER TABLE admin_audit_log ALTER COLUMN admin_id DROP NOT NULL;

-- Drop existing foreign keys
ALTER TABLE admin_audit_log DROP CONSTRAINT admin_audit_log_admin_id_fkey;
ALTER TABLE admin_audit_log DROP CONSTRAINT admin_audit_log_target_user_id_fkey;

-- Re-add with ON DELETE SET NULL
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_admin_id_fkey 
    FOREIGN KEY (admin_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_user_id_fkey 
    FOREIGN KEY (target_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
