-- Cervello bot titolare (perimetro N, 17/10/2026). Migrazione ADDITIVA: tre tabelle nuove, nessuna modifica a quelle esistenti.
-- NON applicata in produzione in fase 1. Interruttore: restaurants.settings.botBrain (JSON, nessuna colonna nuova).
BEGIN;
-- Memoria appresa per ristorante: solo significati (frase → piatto), mai messaggi interi.
CREATE TABLE IF NOT EXISTS tako_owner_brain_memory(
 id uuid PRIMARY KEY,
 restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
 phrase text NOT NULL CHECK (length(phrase) BETWEEN 2 AND 60),
 kind text NOT NULL CHECK (kind IN ('alias','asr','habit')),
 item_id uuid,                                   -- id del piatto nel workspace (non FK: i piatti vivono nel JSON del workspace)
 meaning text NOT NULL DEFAULT '' CHECK (length(meaning)<=200),
 state text NOT NULL CHECK (state IN ('candidate','active','review')),
 confirmations integer NOT NULL DEFAULT 0 CHECK (confirmations>=0),
 uses integer NOT NULL DEFAULT 0 CHECK (uses>=0),
 last_used_at timestamptz,
 origin text NOT NULL CHECK (origin IN ('clarify','correction','summary','use','owner')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (kind='habit' OR item_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS tako_owner_brain_memory_restaurant ON tako_owner_brain_memory(restaurant_id,updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS tako_owner_brain_memory_phrase ON tako_owner_brain_memory(restaurant_id,phrase,kind,item_id);
-- Log append-only di ogni modifica della memoria (audit, «cosa hai imparato?»). Nessun testo del messaggio.
CREATE TABLE IF NOT EXISTS tako_owner_brain_memory_log(
 id bigserial PRIMARY KEY,
 restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
 memory_id uuid,
 phrase text NOT NULL CHECK (length(phrase)<=60),
 op text NOT NULL CHECK (op IN ('create','confirm','use','promote','review','forget','orphan','rename','reject')),
 item_id uuid,
 detail jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tako_owner_brain_memory_log_restaurant ON tako_owner_brain_memory_log(restaurant_id,created_at DESC);
-- Cronologia breve: ≤10 scambi / ≤30 minuti per telefono, testo minimo (≤500 caratteri). Il server cancella il resto a ogni scrittura.
CREATE TABLE IF NOT EXISTS tako_owner_brain_turns(
 id bigserial PRIMARY KEY,
 restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
 phone text NOT NULL,
 role text NOT NULL CHECK (role IN ('owner','bot')),
 body text NOT NULL CHECK (length(body)<=500),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tako_owner_brain_turns_phone ON tako_owner_brain_turns(phone,created_at DESC);
-- Log append-only: il runtime può solo inserire e leggere.
ALTER TABLE tako_owner_brain_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE tako_owner_brain_memory_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tako_owner_brain_turns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tako_owner_brain_memory,tako_owner_brain_memory_log,tako_owner_brain_turns FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON tako_owner_brain_memory,tako_owner_brain_turns TO takomenu_runtime;
GRANT SELECT,INSERT ON tako_owner_brain_memory_log TO takomenu_runtime;
GRANT USAGE,SELECT ON SEQUENCE tako_owner_brain_memory_log_id_seq,tako_owner_brain_turns_id_seq TO takomenu_runtime;
CREATE POLICY runtime_owner_brain_memory ON tako_owner_brain_memory TO takomenu_runtime USING(true) WITH CHECK(true);
CREATE POLICY runtime_owner_brain_memory_log ON tako_owner_brain_memory_log TO takomenu_runtime USING(true) WITH CHECK(true);
CREATE POLICY runtime_owner_brain_turns ON tako_owner_brain_turns TO takomenu_runtime USING(true) WITH CHECK(true);
COMMIT;
