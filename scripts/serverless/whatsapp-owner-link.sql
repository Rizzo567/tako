BEGIN;
-- Pre-collegamento del titolare: activated_at NULL = numero salvato in dashboard, in attesa del primo messaggio.
-- Il default now() lascia attivi i collegamenti esistenti (codice «collega tako …») senza riscrivere righe.
ALTER TABLE tako_whatsapp_links ADD COLUMN IF NOT EXISTS activated_at timestamptz DEFAULT now();
-- Un locale = un telefono (il telefono è già la chiave primaria: un telefono = un locale).
CREATE UNIQUE INDEX IF NOT EXISTS tako_whatsapp_links_one_per_restaurant ON tako_whatsapp_links(restaurant_id);
-- Guasti del bot: leggibili con scripts/whatsapp/errors.mjs (i log edge non lo sono).
CREATE TABLE IF NOT EXISTS tako_whatsapp_errors(id bigserial PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now(),kind text NOT NULL,restaurant_id uuid,phone_tail text,detail text,alerted boolean NOT NULL DEFAULT false);
CREATE INDEX IF NOT EXISTS tako_whatsapp_errors_created ON tako_whatsapp_errors(created_at);
-- Throttling degli avvisi a Manuel: una riga per canale, claim atomico (max 1 all'ora).
CREATE TABLE IF NOT EXISTS tako_whatsapp_alerts(channel text PRIMARY KEY,last_sent_at timestamptz NOT NULL);
ALTER TABLE tako_whatsapp_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tako_whatsapp_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tako_whatsapp_errors,tako_whatsapp_alerts FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE tako_whatsapp_errors_id_seq FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON tako_whatsapp_errors,tako_whatsapp_alerts TO takomenu_runtime;
GRANT USAGE ON SEQUENCE tako_whatsapp_errors_id_seq TO takomenu_runtime;
DROP POLICY IF EXISTS runtime_whatsapp_errors ON tako_whatsapp_errors;
CREATE POLICY runtime_whatsapp_errors ON tako_whatsapp_errors TO takomenu_runtime USING(true) WITH CHECK(true);
DROP POLICY IF EXISTS runtime_whatsapp_alerts ON tako_whatsapp_alerts;
CREATE POLICY runtime_whatsapp_alerts ON tako_whatsapp_alerts TO takomenu_runtime USING(true) WITH CHECK(true);
COMMIT;
