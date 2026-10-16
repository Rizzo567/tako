-- F2 Preset settimanali per menu (16/10/2026). Migrazione ADDITIVA: solo tabelle nuove, nessuna
-- colonna o tabella esistente toccata. PREPARATA NEL RAMO, MAI APPLICATA IN PRODUZIONE.
-- Applicare solo dopo l'OK di Manuel, PRIMA del deploy del backend che la usa (vedi
-- docs/webapp/feature-vendita-2026-10-16/implementation-notes.md, sezione F2).
-- Rollback: scripts/serverless/menu-day-presets-rollback.sql
BEGIN;

-- Un preset = contenuto salvato di UN menu del documento (menu_workspaces.draft.menus[].id):
-- content = {"sections":[...]} con categorie e piatti copiati per intero dal documento
-- (tutti i campi del piatto: promo, etichette e campi futuri viaggiano da soli).
CREATE TABLE IF NOT EXISTS menu_day_presets(
 id uuid PRIMARY KEY,
 restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
 menu_id uuid NOT NULL,
 name text NOT NULL CHECK(char_length(name) BETWEEN 1 AND 100),
 weekday smallint CHECK(weekday BETWEEN 1 AND 7), -- ISO: 1 lunedì … 7 domenica; NULL = preset con nome libero
 position integer NOT NULL DEFAULT 0,
 content jsonb NOT NULL DEFAULT '{"sections":[]}'::jsonb,
 revision integer NOT NULL DEFAULT 1,
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS menu_day_presets_weekday ON menu_day_presets(restaurant_id,menu_id,weekday) WHERE weekday IS NOT NULL;
CREATE INDEX IF NOT EXISTS menu_day_presets_menu ON menu_day_presets(restaurant_id,menu_id,position);

-- Modalità per menu: enabled=false è il «menu unico» (i preset restano salvati).
CREATE TABLE IF NOT EXISTS menu_day_preset_settings(
 restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
 menu_id uuid NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 auto_publish boolean NOT NULL DEFAULT false,
 auto_from_day date, -- primo giorno di servizio gestito dal job (impostato quando si accende l'automatico)
 online_preset_id uuid REFERENCES menu_day_presets(id) ON DELETE SET NULL,
 online_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(restaurant_id,menu_id)
);

-- Registro idempotente del job delle 06:00: una riga per menu e giorno di servizio.
CREATE TABLE IF NOT EXISTS menu_day_preset_runs(
 restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
 menu_id uuid NOT NULL,
 service_day date NOT NULL,
 status text NOT NULL CHECK(status IN('running','published','skipped_missing','skipped_empty','error')),
 preset_id uuid,
 revision integer,
 discarded_draft_version_id uuid,
 attempts integer NOT NULL DEFAULT 1,
 detail text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(restaurant_id,menu_id,service_day)
);

-- Avvisi al titolare (dashboard; il bot può leggerli e inoltrarli).
CREATE TABLE IF NOT EXISTS menu_owner_notices(
 id uuid PRIMARY KEY,
 restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN('preset_missing','preset_empty','preset_failed','draft_discarded','supplied_pdf')),
 menu_id uuid,
 service_day date,
 message text NOT NULL CHECK(char_length(message) <= 500),
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS menu_owner_notices_once ON menu_owner_notices(restaurant_id,kind,coalesce(menu_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(service_day,'1970-01-01'::date));
CREATE INDEX IF NOT EXISTS menu_owner_notices_unread ON menu_owner_notices(restaurant_id,created_at DESC) WHERE read_at IS NULL;

-- Cache traduzioni per testo normalizzato e lingua: un testo già tradotto non si ritraduce MAI.
CREATE TABLE IF NOT EXISTS menu_text_translations(
 restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
 text_key text NOT NULL CHECK(text_key ~ '^[a-f0-9]{64}$'),
 lang text NOT NULL CHECK(lang ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$'),
 source text NOT NULL CHECK(char_length(source) <= 4000),
 translation text CHECK(char_length(translation) <= 4000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','done','failed')),
 attempts integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(restaurant_id,text_key,lang)
);
CREATE INDEX IF NOT EXISTS menu_text_translations_pending ON menu_text_translations(created_at) WHERE status='pending';

ALTER TABLE menu_day_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_day_preset_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_day_preset_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_owner_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_text_translations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON menu_day_presets,menu_day_preset_settings,menu_day_preset_runs,menu_owner_notices,menu_text_translations FROM PUBLIC;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON menu_day_presets,menu_day_preset_settings,menu_day_preset_runs,menu_owner_notices,menu_text_translations FROM anon'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE 'REVOKE ALL ON menu_day_presets,menu_day_preset_settings,menu_day_preset_runs,menu_owner_notices,menu_text_translations FROM authenticated'; END IF;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON menu_day_presets,menu_day_preset_settings,menu_owner_notices,menu_text_translations TO takomenu_runtime;
GRANT SELECT,INSERT,UPDATE ON menu_day_preset_runs TO takomenu_runtime;
DROP POLICY IF EXISTS runtime_menu_day_presets ON menu_day_presets;
DROP POLICY IF EXISTS runtime_menu_day_preset_settings ON menu_day_preset_settings;
DROP POLICY IF EXISTS runtime_menu_day_preset_runs ON menu_day_preset_runs;
DROP POLICY IF EXISTS runtime_menu_owner_notices ON menu_owner_notices;
DROP POLICY IF EXISTS runtime_menu_text_translations ON menu_text_translations;
CREATE POLICY runtime_menu_day_presets ON menu_day_presets TO takomenu_runtime USING(true) WITH CHECK(true);
CREATE POLICY runtime_menu_day_preset_settings ON menu_day_preset_settings TO takomenu_runtime USING(true) WITH CHECK(true);
CREATE POLICY runtime_menu_day_preset_runs ON menu_day_preset_runs TO takomenu_runtime USING(true) WITH CHECK(true);
CREATE POLICY runtime_menu_owner_notices ON menu_owner_notices TO takomenu_runtime USING(true) WITH CHECK(true);
CREATE POLICY runtime_menu_text_translations ON menu_text_translations TO takomenu_runtime USING(true) WITH CHECK(true);
COMMIT;
-- Nessun pg_cron: il job delle 06:00 deve passare da mutateWorkspace(publish) (TypeScript) per
-- materializzare menu_items e far scattare i trigger live. Lo chiama il cron del Worker
-- deploy/cloudflare/preset-cron.mjs (vedi note F2).
