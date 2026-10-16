BEGIN;
CREATE TABLE IF NOT EXISTS tako_onboarding_owner_invites (
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 session_id uuid NOT NULL REFERENCES tako_onboarding_sessions(id),
 restaurant_id uuid NOT NULL REFERENCES restaurants(id),
 owner_phone text NOT NULL CHECK(owner_phone ~ '^whatsapp:\+[0-9]{8,15}$'),
 owner_name text NOT NULL,expires_at timestamptz NOT NULL,used_at timestamptz,
 owner_actor_id uuid REFERENCES users(id)
);
ALTER TABLE tako_onboarding_owner_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tako_onboarding_owner_invites FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON tako_onboarding_owner_invites TO takomenu_runtime;
DROP POLICY IF EXISTS runtime_onboarding_owner_invites ON tako_onboarding_owner_invites;
CREATE POLICY runtime_onboarding_owner_invites ON tako_onboarding_owner_invites TO takomenu_runtime USING(true) WITH CHECK(true);
COMMIT;
