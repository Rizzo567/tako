BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS temporary_password_expires_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique ON users(lower(username)) WHERE username IS NOT NULL;
CREATE TABLE IF NOT EXISTS tako_migration_access (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
 restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
 phone text NOT NULL,
 state text NOT NULL CHECK(state IN ('ready','delivered','completed')),
 temp_cipher text,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 last_requested_at timestamptz,
 completed_at timestamptz,
 CHECK((state='completed' AND temp_cipher IS NULL) OR (state<>'completed' AND temp_cipher IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS tako_migration_access_phone_tenant ON tako_migration_access(phone,restaurant_id);
ALTER TABLE tako_migration_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tako_migration_access FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON tako_migration_access TO takomenu_runtime;
DROP POLICY IF EXISTS tako_migration_access_runtime ON tako_migration_access;
CREATE POLICY tako_migration_access_runtime ON tako_migration_access TO takomenu_runtime USING (true) WITH CHECK (true);
COMMIT;
