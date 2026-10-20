-- Additive transactional email storage. Run only through the authorized migration procedure.
CREATE TABLE IF NOT EXISTS tako_email_changes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 old_email text NOT NULL, new_email text NOT NULL, token_hash text NOT NULL UNIQUE, credential_hash text NOT NULL,
 expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tako_email_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), dedupe_key text NOT NULL UNIQUE,
 user_id uuid NOT NULL REFERENCES users(id), recipient text NOT NULL, template text NOT NULL,
 encrypted_payload text, guard_kind text CHECK(guard_kind IN ('reset','email-change','welcome')), guard_id text,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','cancelled')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 6),
 claim_token uuid, claimed_at timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '23 hours',
 provider_id text, last_error text,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '23 hours'),
 CHECK((guard_kind IS NULL)=(guard_id IS NULL))
);
CREATE INDEX IF NOT EXISTS tako_email_outbox_pending ON tako_email_outbox(next_attempt_at) WHERE status IN ('pending','sending');
ALTER TABLE tako_email_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tako_email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tako_email_changes,tako_email_outbox FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON tako_email_changes,tako_email_outbox TO takomenu_runtime;
DROP POLICY IF EXISTS runtime_email_changes ON tako_email_changes;
CREATE POLICY runtime_email_changes ON tako_email_changes TO takomenu_runtime USING(true) WITH CHECK(true);
DROP POLICY IF EXISTS runtime_email_outbox ON tako_email_outbox;
CREATE POLICY runtime_email_outbox ON tako_email_outbox TO takomenu_runtime USING(true) WITH CHECK(true);
