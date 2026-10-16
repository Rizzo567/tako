BEGIN;
CREATE TABLE IF NOT EXISTS tako_onboarding_assets (
 id uuid PRIMARY KEY,
 session_id uuid NOT NULL REFERENCES tako_onboarding_sessions(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 bytes_base64 text NOT NULL CHECK(octet_length(bytes_base64)>0 AND octet_length(bytes_base64)<=11184812),
 mime text NOT NULL CHECK(mime IN('image/png','image/jpeg','image/webp')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tako_onboarding_assets_session ON tako_onboarding_assets(session_id,created_at);
ALTER TABLE tako_onboarding_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tako_onboarding_assets FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON tako_onboarding_assets TO takomenu_runtime;
DROP POLICY IF EXISTS runtime_onboarding_assets ON tako_onboarding_assets;
CREATE POLICY runtime_onboarding_assets ON tako_onboarding_assets TO takomenu_runtime USING(true) WITH CHECK(true);
COMMIT;
