DO $$
DECLARE
    c_name text;
BEGIN
    SELECT con.conname INTO c_name
    FROM pg_constraint con
    JOIN pg_attribute attr ON attr.attnum = ANY(con.conkey)
    WHERE con.conrelid = 'profiles'::regclass
      AND attr.attrelid = 'profiles'::regclass
      AND attr.attname = 'plan'
      AND con.contype = 'c';

    IF c_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE profiles DROP CONSTRAINT ' || c_name;
    END IF;
END $$;

ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'starter', 'pro', 'agency'));
