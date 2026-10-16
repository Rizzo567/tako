BEGIN;
-- Agency transport is separate from one-owner-phone / one-restaurant links.
CREATE TABLE IF NOT EXISTS tako_onboarding_agency_links (
 phone text PRIMARY KEY CHECK(phone ~ '^whatsapp:\+[0-9]{8,15}$'),
 actor_id uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tako_onboarding_agency_codes (
 code_hash text PRIMARY KEY CHECK(code_hash ~ '^[a-f0-9]{64}$'),
 actor_id uuid NOT NULL REFERENCES users(id),expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS tako_onboarding_sessions (
 id uuid PRIMARY KEY,actor_id uuid NOT NULL REFERENCES users(id),
 phone text NOT NULL CHECK(phone ~ '^whatsapp:\+[0-9]{8,15}$'),
 state text NOT NULL DEFAULT 'collecting' CHECK(state IN('collecting','review','activated','cancelled')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),data jsonb NOT NULL,
 restaurant_id uuid REFERENCES restaurants(id),
 preview_token_hash text CHECK(preview_token_hash ~ '^[a-f0-9]{64}$'),preview_expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((state='activated')=(restaurant_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS tako_onboarding_one_open ON tako_onboarding_sessions(actor_id,phone) WHERE state IN('collecting','review') AND (data->>'paused') IS DISTINCT FROM 'true';
CREATE INDEX IF NOT EXISTS tako_onboarding_actor ON tako_onboarding_sessions(actor_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS tako_onboarding_preview_token ON tako_onboarding_sessions(preview_token_hash) WHERE preview_token_hash IS NOT NULL;
ALTER TABLE tako_onboarding_agency_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE tako_onboarding_agency_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tako_onboarding_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tako_onboarding_agency_links,tako_onboarding_agency_codes,tako_onboarding_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON tako_onboarding_agency_links,tako_onboarding_agency_codes,tako_onboarding_sessions TO takomenu_runtime;
DROP POLICY IF EXISTS runtime_onboarding_agency_links ON tako_onboarding_agency_links;
CREATE POLICY runtime_onboarding_agency_links ON tako_onboarding_agency_links TO takomenu_runtime USING(true) WITH CHECK(true);
DROP POLICY IF EXISTS runtime_onboarding_agency_codes ON tako_onboarding_agency_codes;
CREATE POLICY runtime_onboarding_agency_codes ON tako_onboarding_agency_codes TO takomenu_runtime USING(true) WITH CHECK(true);
DROP POLICY IF EXISTS runtime_onboarding_sessions ON tako_onboarding_sessions;
CREATE POLICY runtime_onboarding_sessions ON tako_onboarding_sessions TO takomenu_runtime USING(true) WITH CHECK(true);
CREATE TABLE IF NOT EXISTS tako_onboarding_tokens (
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 session_id uuid NOT NULL REFERENCES tako_onboarding_sessions(id),
 kind text NOT NULL CHECK(kind IN('preview','claim')),revision integer NOT NULL CHECK(revision>0),expires_at timestamptz NOT NULL,used_at timestamptz
);
CREATE TABLE IF NOT EXISTS tako_onboarding_inbox_jobs (
 sid text PRIMARY KEY,actor_id uuid NOT NULL REFERENCES users(id),phone text NOT NULL,
 payload jsonb NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','running','done','failed')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tako_onboarding_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE tako_onboarding_inbox_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tako_onboarding_tokens,tako_onboarding_inbox_jobs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON tako_onboarding_tokens,tako_onboarding_inbox_jobs TO takomenu_runtime;
DROP POLICY IF EXISTS runtime_onboarding_tokens ON tako_onboarding_tokens;
CREATE POLICY runtime_onboarding_tokens ON tako_onboarding_tokens TO takomenu_runtime USING(true) WITH CHECK(true);
DROP POLICY IF EXISTS runtime_onboarding_inbox_jobs ON tako_onboarding_inbox_jobs;
CREATE POLICY runtime_onboarding_inbox_jobs ON tako_onboarding_inbox_jobs TO takomenu_runtime USING(true) WITH CHECK(true);
COMMIT;
