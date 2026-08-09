-- App owner (PWA del ristoratore) — UNICA migrazione infrastrutturale della Wave 1.
-- Raccoglie i due soli pezzi di schema che l'app richiede (piano §3 D6):
--   1. metadati del DISPOSITIVO sulle sessioni (arruolamento telefono, F2.1)
--   2. persistenza delle CHIAMATE CAMERIERE (F2.5)
-- Nessuna nuova entità di dominio: tutto il resto riusa le API esistenti.
-- Idempotente (IF NOT EXISTS ovunque): può essere riapplicata senza danni.

-- ─── 1. Metadati device sulle sessioni ──────────────────────────────────────
-- `kind` distingue le sessioni: 'staff' (dashboard, 90 giorni) da 'mobile'
-- (telefono arruolato, 30 giorni — un telefono si perde più facilmente di un Mac
-- in cucina, piano §3 D3). Il DEFAULT 'staff' rende la colonna retro-compatibile:
-- tutte le sessioni esistenti restano esattamente quello che erano.
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'staff' NOT NULL;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "device_name" text;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "device_platform" text;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamptz;
-- L'elenco dispositivi filtra per (utente, kind): senza indice è un seq scan su
-- una tabella che accumula una riga per ogni login di ogni tablet.
CREATE INDEX IF NOT EXISTS "sessions_user_kind_idx" ON "sessions" ("user_id", "kind");

-- ─── 2. Codici di arruolamento del telefono ─────────────────────────────────
-- Stessa disciplina del device-code cloud (routes/cloud/pair.ts): alta entropia,
-- HMAC A RIPOSO (mai il codice in chiaro nel DB), TTL breve, SINGLE-USE ATOMICO.
-- Il codice è generato SOLO da un owner autenticato in LAN e vive pochi minuti:
-- il possesso della dashboard autenticata È la prova dell'intenzione.
CREATE TABLE IF NOT EXISTS "device_enroll_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurant_id" uuid NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
  -- Utente a cui verrà intestata la sessione mobile (l'owner che ha generato il QR).
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "code_hash" text NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  -- Sessione emessa al consumo: traccia il legame codice → dispositivo arruolato.
  "session_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "device_enroll_codes_expires_idx" ON "device_enroll_codes" ("expires_at");

-- ─── 3. Chiamate cameriere persistite (F2.5) ────────────────────────────────
-- Oggi la chiamata è solo un emit socket (routes/customer.ts): chi apre l'app DOPO
-- la chiamata non la vede mai. Persisterla la rende visibile a un dispositivo che si
-- collega in ritardo, e la risoluzione resta sincronizzata via l'evento esistente.
CREATE TABLE IF NOT EXISTS "waiter_calls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurant_id" uuid NOT NULL REFERENCES "restaurants"("id") ON DELETE CASCADE,
  "table_id" uuid NOT NULL REFERENCES "tables"("id") ON DELETE CASCADE,
  "table_number" text,
  "type" text DEFAULT 'help' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "resolved_at" timestamptz,
  "resolved_by" uuid REFERENCES "users"("id")
);
-- Query dominante: le chiamate APERTE di un ristorante, più recenti prima.
CREATE INDEX IF NOT EXISTS "waiter_calls_open_idx" ON "waiter_calls" ("restaurant_id", "resolved_at", "created_at");
-- Una sola chiamata APERTA per tavolo: un cliente che tocca il pulsante cinque volte
-- non deve produrre cinque righe (e cinque badge) — la seconda aggiorna la prima.
CREATE UNIQUE INDEX IF NOT EXISTS "waiter_calls_open_table_uq" ON "waiter_calls" ("table_id") WHERE "resolved_at" IS NULL;
