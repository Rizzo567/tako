BEGIN;
ALTER TABLE tako_onboarding_sessions ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;
ALTER TABLE tako_onboarding_sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz;
UPDATE tako_onboarding_sessions SET last_activity_at=updated_at WHERE last_activity_at IS NULL;
UPDATE tako_onboarding_sessions SET expires_at=last_activity_at+interval '10 minutes' WHERE expires_at IS NULL;
ALTER TABLE tako_onboarding_sessions ALTER COLUMN last_activity_at SET DEFAULT now(),ALTER COLUMN last_activity_at SET NOT NULL,ALTER COLUMN expires_at SET DEFAULT now()+interval '10 minutes',ALTER COLUMN expires_at SET NOT NULL;
CREATE TABLE IF NOT EXISTS tako_onboarding_agency_tokens(token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),actor_id uuid NOT NULL REFERENCES users(id),session_id uuid REFERENCES tako_onboarding_sessions(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL,used_at timestamptz);
ALTER TABLE tako_onboarding_agency_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tako_onboarding_agency_tokens FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON tako_onboarding_agency_tokens TO takomenu_runtime;
DROP POLICY IF EXISTS runtime_onboarding_agency_tokens ON tako_onboarding_agency_tokens;
CREATE POLICY runtime_onboarding_agency_tokens ON tako_onboarding_agency_tokens TO takomenu_runtime USING(true) WITH CHECK(true);
ALTER TABLE tako_onboarding_inbox_jobs ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES tako_onboarding_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tako_onboarding_jobs_session ON tako_onboarding_inbox_jobs(session_id);
CREATE OR REPLACE FUNCTION tako_purge_expired_onboarding() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE removed integer;
BEGIN
 DELETE FROM tako_onboarding_assets WHERE session_id IN(SELECT id FROM tako_onboarding_sessions WHERE state='cancelled' OR(state IN('collecting','review') AND expires_at<=now()));
 DELETE FROM tako_onboarding_tokens WHERE session_id IN(SELECT id FROM tako_onboarding_sessions WHERE state='cancelled' OR(state IN('collecting','review') AND expires_at<=now()));
 DELETE FROM tako_onboarding_owner_invites WHERE session_id IN(SELECT id FROM tako_onboarding_sessions WHERE state='cancelled' OR(state IN('collecting','review') AND expires_at<=now()));
 DELETE FROM tako_onboarding_agency_tokens WHERE expires_at<=now() OR session_id IN(SELECT id FROM tako_onboarding_sessions WHERE state='cancelled' OR(state IN('collecting','review') AND expires_at<=now()));
 UPDATE tako_onboarding_inbox_jobs SET payload='{}'::jsonb,status='done',updated_at=now() WHERE session_id IN(SELECT id FROM tako_onboarding_sessions WHERE state='cancelled' OR(state IN('collecting','review') AND expires_at<=now()));
 DELETE FROM tako_onboarding_sessions WHERE state='cancelled' OR(state IN('collecting','review') AND expires_at<=now());
 GET DIAGNOSTICS removed=ROW_COUNT;
 RETURN removed;
END $$;
REVOKE ALL ON FUNCTION tako_purge_expired_onboarding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tako_purge_expired_onboarding() TO takomenu_runtime;
SELECT tako_purge_expired_onboarding();
COMMIT;
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='takomenu-onboarding-expiry') THEN
  PERFORM cron.schedule('takomenu-onboarding-expiry','* * * * *','SELECT public.tako_purge_expired_onboarding()');
 END IF;
END $$;
-- Logical expiry is exact; physical cleanup follows within the next minute.
-- Logical expiry is enforced in every read/write even before physical cleanup.
