BEGIN;
CREATE TABLE IF NOT EXISTS tako_whatsapp_ai_usage(day date NOT NULL,model text NOT NULL,requests integer NOT NULL DEFAULT 0,prompt_tokens bigint NOT NULL DEFAULT 0,completion_tokens bigint NOT NULL DEFAULT 0,rate_limited integer NOT NULL DEFAULT 0,audio_seconds numeric NOT NULL DEFAULT 0,warned_at timestamptz,PRIMARY KEY(day,model));
ALTER TABLE tako_whatsapp_ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tako_whatsapp_ai_usage FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON tako_whatsapp_ai_usage TO takomenu_runtime;
DROP POLICY IF EXISTS runtime_whatsapp_ai_usage ON tako_whatsapp_ai_usage;
CREATE POLICY runtime_whatsapp_ai_usage ON tako_whatsapp_ai_usage TO takomenu_runtime USING(true) WITH CHECK(true);
COMMIT;
