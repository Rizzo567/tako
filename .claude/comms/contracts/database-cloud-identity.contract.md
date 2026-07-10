# Contract: database — cloud-identity (FASE 1)

Branch: `feat/cloud-auth-20260625` (worktree `/Users/manuel/Projects/Tako-cloud-auth`)
Tipo: `DB_SCHEMA`
Riferimento: `MASTER_PLAN-cloud-auth.md` §3

## Principio di isolamento
DUE DB separati, DUE schemi Drizzle, DUE config, DUE cartelle migrazioni.
- LOCALE (appliance): `src/schema/*.ts` (top-level glob) + `drizzle.config.ts` → `src/migrations`.
- CLOUD (control-plane): `src/schema/cloud/*.ts` + `drizzle.cloud.config.ts` → `src/migrations-cloud`.
- `src/schema/index.ts` (export locale) NON esporta le tabelle cloud. Le cloud si importano
  via `@tako/db/schema/cloud` (subpath export) SOLO dal backend in `TAKO_MODE=cloud`.

## Estensioni schema LOCALE — tabella `users` (`src/schema/users.ts`)
Colonne aggiunte (migrazione `0006_add_cloud_identity_fields.sql`):
- `email_verified boolean NOT NULL DEFAULT false`
- `cloud_owner_id uuid` (nullable; link a `cloud_owners.id`; null per staff locale)
- `local_owner_secret_hash text` (nullable; credenziale owner LOCALE per login offline — SEC-001, NON è l'hash cloud)
- `credentials_version integer NOT NULL DEFAULT 0` (confrontato col cloud all'heartbeat)

## Schema CLOUD — tabelle `cloud_*` (tutte PK `id uuid DEFAULT gen_random_uuid()`)

### cloud_owners (`cloud/owners.ts`)
`email text UNIQUE NOT NULL`, `password_hash text` (null se solo-OAuth), `name text`,
`email_verified boolean NOT NULL DEFAULT false`, `credentials_version integer NOT NULL DEFAULT 0`,
`last_login_at timestamptz`, `created_at`, `updated_at`.
Index: UNIQUE `cloud_owners_email_idx(email)`.

### cloud_oauth_accounts (`cloud/owners.ts`)
`owner_id uuid FK→cloud_owners ON DELETE CASCADE`, `provider text enum('google','github') NOT NULL`,
`provider_user_id text NOT NULL`, `email_at_provider text`, `email_verified_at_provider boolean NOT NULL DEFAULT false`, `created_at`.
Index: UNIQUE `(provider, provider_user_id)`, UNIQUE `(owner_id, provider)`.

### cloud_email_verification_tokens (`cloud/tokens.ts`)
`owner_id FK→cloud_owners CASCADE`, `token_hash text UNIQUE NOT NULL` (HMAC a riposo, SEC-012),
`expires_at timestamptz NOT NULL`, `consumed_at timestamptz`, `created_at`.
Index: UNIQUE token_hash, index owner_id.

### cloud_password_reset_tokens (`cloud/tokens.ts`)
Stessa forma di sopra (HMAC, single-use atomico, TTL 1h).

### cloud_sessions (`cloud/sessions.ts`)
`owner_id FK→cloud_owners CASCADE`, `token_hash text UNIQUE NOT NULL` (HMAC a riposo, SEC-016),
`expires_at timestamptz NOT NULL`, `user_agent text`, `ip text`, `credentials_version integer NOT NULL DEFAULT 0` (snapshot), `created_at`.
Index: UNIQUE token_hash, index owner_id.

### cloud_restaurants (`cloud/restaurants.ts`)
`owner_id FK→cloud_owners CASCADE`, `name text NOT NULL`, `slug text UNIQUE NOT NULL`,
`plan text enum('free','pro','enterprise') NOT NULL DEFAULT 'free'`, `created_at`.
Index: UNIQUE slug, index owner_id.

### cloud_appliances (`cloud/restaurants.ts`)
`restaurant_id FK→cloud_restaurants CASCADE`, `pubkey text UNIQUE NOT NULL` (proof-of-possession, SEC-003),
`public_label text`, `seen_credentials_version integer NOT NULL DEFAULT 0`,
`paired_at timestamptz NOT NULL DEFAULT now()`, `last_seen_at timestamptz`, `revoked_at timestamptz`.
Index: UNIQUE pubkey, index restaurant_id.

### cloud_pairing_codes (`cloud/restaurants.ts`)
`owner_id FK→cloud_owners CASCADE`, `restaurant_id FK→cloud_restaurants CASCADE`,
`code_hash text UNIQUE NOT NULL` (HMAC), `device_pubkey text`, `approved_at timestamptz`,
`expires_at timestamptz NOT NULL`, `consumed_at timestamptz`, `created_at`.
Index: UNIQUE code_hash, index owner_id, index restaurant_id.

### cloud_audit_log (`cloud/audit.ts`)
`owner_id uuid FK→cloud_owners ON DELETE SET NULL` (nullable; traccia preservata dopo erasure),
`event text NOT NULL`, `ip text`, `user_agent text`, `meta jsonb DEFAULT '{}'`, `created_at`.
Index: index owner_id, index `(event, created_at)`.

## ENV richieste
- `DATABASE_URL` — LOCALE punta al Postgres embedded/appliance; CLOUD punta a Neon EU.
  Le due config usano la STESSA env var ma sono lanciate in contesti separati: applicare
  `db:migrate` con `DATABASE_URL` locale e `db:migrate:cloud` con `DATABASE_URL` cloud.
- (FASE 2) `TOKEN_PEPPER` per HMAC dei token (backend), non lato DB.

## Migrazioni generate (NON applicate)
- Locale: `packages/db/src/migrations/0006_add_cloud_identity_fields.sql` (+ journal idx 6)
- Cloud:  `packages/db/src/migrations-cloud/0000_init_cloud_identity.sql` (+ journal dedicato)

## Script package.json
- `db:generate` / `db:migrate` — locale (invariati)
- `db:generate:cloud` / `db:migrate:cloud` — usano `--config drizzle.cloud.config.ts`

## Note per altri agenti
- Backend (FASE 2): importare le tabelle cloud da `@tako/db/schema/cloud`, MAI da `@tako/db/schema`.
  Costruire un client Drizzle cloud separato (schema cloud) distinto dal `db` locale in `client.ts`.
- Token salvati come `token_hash`/`code_hash`: il backend hasha (HMAC-SHA256 + pepper) prima di scrivere/leggere; single-use atomico `UPDATE…WHERE consumed_at IS NULL RETURNING`.
- `cloud_sessions.token_hash` = sessione a riposo; al client va il token opaco in chiaro.
- Isolamento tenant: ogni query cloud filtra per `owner_id` DALLA SESSIONE (SEC-011).
- Eseguire le migrazioni PRIMA di avviare il backend nei rispettivi modi.
