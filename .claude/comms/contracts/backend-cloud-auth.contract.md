# Contract: backend — cloud-auth (FASE 2a)

Branch: `feat/cloud-auth-20260625` (worktree `/Users/manuel/Projects/Tako-cloud-auth`)
Tipo: `REST` + `ENV`
Riferimento: MASTER_PLAN-cloud-auth §2 (due-modi), §4 (API), §5 (flussi), §7/§7bis (sicurezza)
Dipende da: `database-cloud-identity.contract.md` (schema `@tako/db/schema/cloud`)

## Modo di attivazione
Tutte le route qui esposte vivono SOLO in `TAKO_MODE=cloud`. In `TAKO_MODE=local` (default)
il server è invariato (nessuna route cloud montata, nessun cambiamento di comportamento).
Lo switch è in `apps/server/src/index.ts → startServer()` che delega a `startCloudServer()`.

## Base URL e prefissi
- `/api/auth/*` — autenticazione owner (email/password). Fase 2a.
- `/api/pair/*` — PLACEHOLDER pairing appliance↔cloud. Solo `GET /status` informativo; logica = Fase 2b.

## Endpoint `/api/auth`

| Metodo | Path | Auth | Rate-limit | Descrizione |
|--------|------|------|-----------|-------------|
| POST | `/api/auth/register` | no | 10/min/IP | Crea owner + invia email verifica. **200 generico** (anti-enumeration). |
| POST | `/api/auth/login` | no | 10/min/IP | Login. Set cookie sessione. `EMAIL_NOT_VERIFIED` solo dopo password corretta. |
| POST | `/api/auth/logout` | sì (cookie) + CSRF | — | Elimina la sessione corrente + clear cookie. |
| GET | `/api/auth/me` | sì (cookie) | — | Owner della sessione corrente. |
| GET | `/api/auth/verify-email?token=` | no | 10/min/IP | Landing: dice solo se il token è valido. **NON consuma** (anti pre-fetch). |
| POST | `/api/auth/verify-email` | no | 10/min/IP | Conferma email. Consumo **atomico** single-use. |
| POST | `/api/auth/resend-verification` | no | 10/min/IP | Reinvio verifica. **200 generico**. |
| POST | `/api/auth/forgot-password` | no | 10/min/IP | Invio link reset. **200 generico**. |
| POST | `/api/auth/reset-password` | no | 10/min/IP | Reset pw. Consumo atomico + **bump credentials_version** + **revoca tutte le sessioni**. |

### Schemi I/O (JSON)

**POST /register** → `{ email: string, password: string(10..72B), name?: string }`
→ `200 { data: { message } }` (sempre generico). Errori: `400 VALIDATION` | `400 WEAK_PASSWORD` | `500 SERVER_ERROR`.

**POST /login** → `{ email, password }`
→ `200 { data: { owner: { id, email, name } } }` + Set-Cookie `tako_cloud_session` (+`tako_cloud_csrf` in crosssite).
Errori: `400 VALIDATION` | `401 INVALID_CREDENTIALS` | `403 EMAIL_NOT_VERIFIED`.

**POST /logout** (cookie + header `X-Tako-CSRF` in crosssite) → `200 { data: { success: true } }`. Errori: `401 UNAUTHORIZED` | `403 CSRF`.

**GET /me** (cookie) → `200 { data: { owner: { id, email, name } } }`. Errori: `401 UNAUTHORIZED` | `401 SESSION_STALE`.

**GET /verify-email?token=** → `200 { data: { valid: boolean } }`. Errori: `400 INVALID_TOKEN`.

**POST /verify-email** → `{ token }` → `200 { data: { verified: true } }`. Errori: `400 INVALID_TOKEN`.

**POST /resend-verification** → `{ email }` → `200 { data: { message } }` (generico).

**POST /forgot-password** → `{ email }` → `200 { data: { message } }` (generico).

**POST /reset-password** → `{ token, password }` → `200 { data: { reset: true } }`. Errori: `400 INVALID_TOKEN` | `400 WEAK_PASSWORD`.

### Codici errore (envelope `{ error: { code, message } }`)
`VALIDATION` `WEAK_PASSWORD` `INVALID_CREDENTIALS` `EMAIL_NOT_VERIFIED` `INVALID_TOKEN`
`UNAUTHORIZED` `SESSION_STALE` `CSRF` `RATE_LIMIT` `SERVER_ERROR`.

## Cookie
- `tako_cloud_session` — HttpOnly, opaco (token solo lato client; a riposo `token_hash` HMAC).
  SameSite=Lax (samesite) o None+Secure (crosssite). TTL 30gg.
- `tako_cloud_csrf` — NON HttpOnly, double-submit. Presente SOLO in `COOKIE_MODE=crosssite`.

## Middleware applicati
- `requireCloudAuth` (`middleware/cloudAuth.ts`): risolve sessione da cookie, verifica scadenza
  e snapshot `credentials_version` (reset → `SESSION_STALE`). Popola `req.cloudOwner`.
- `requireCsrf`: double-submit (`X-Tako-CSRF` == cookie) sui metodi mutanti, SOLO in crosssite.
- CORS allowlist ESATTA da `ALLOWED_ORIGINS` (no wildcard, no suffix-match), `credentials:true`.
- Rate-limit `@fastify/rate-limit` con store **Redis** (`REDIS_URL`); chiave = `req.ip` derivato dal
  proxy fidato (`TRUST_PROXY`). 10/min sugli endpoint auth sensibili.
- Helmet (CSP) + error handler che NON espone stack/dettagli (generico 500).

## Sicurezza implementata (§7)
- Token URL: `nanoid(48)` (≥32B entropia), a riposo **HMAC-SHA256(token, TOKEN_PEPPER)**.
- Sessione: token opaco `randomBytes(48).base64url`, a riposo HMAC.
- Single-use **atomico**: `UPDATE … SET consumed_at WHERE consumed_at IS NULL AND not expired RETURNING`.
- Password policy: min 10 char, max 72 **byte** (limite bcrypt), bcrypt cost 12.
- Email normalizzata lowercase/trim.
- Anti-enumeration: register/forgot/resend → 200 generico; `EMAIL_NOT_VERIFIED` solo post-password.
- Reset: bump `credentials_version` + **delete di tutte le sessioni** dell'owner + email verificata.
- Link email costruiti SOLO da `SITE_BASE_URL` (mai da Host header). Redirect validati vs allowlist origin.
- Audit log (`cloud_audit_log`): `register, login_success, login_failed, login_email_not_verified,
  logout, forgot_password_requested, password_reset, email_verified, verification_resent`.

## ENV richieste (modo cloud)
| Env | Obbligatoria | Scopo |
|-----|-------------|-------|
| `TAKO_MODE=cloud` | sì | attiva il control-plane |
| `CLOUD_DATABASE_URL` | sì | DB cloud (Neon), DISTINTO da `DATABASE_URL` |
| `SESSION_SECRET` | sì (≥32 in prod) | firma cookie cloud (≠ JWT_SECRET) |
| `TOKEN_PEPPER` | sì (≥16) | HMAC dei token/sessioni a riposo |
| `ALLOWED_ORIGINS` | sì | allowlist CORS (CSV) |
| `SITE_BASE_URL` | sì | base link email + allowlist redirect |
| `COOKIE_MODE` | no (`samesite`) | `samesite` \| `crosssite` |
| `EMAIL_FROM` | no | mittente email |
| `EMAIL_TRANSPORT` | no (`mock`) | `mock` (2a) \| `resend` (2b) |
| `REDIS_URL` | consigliata | store rate-limit condiviso (fallback in-memory se assente) |
| `TRUST_PROXY` | no (`1`) | hop/CIDR proxy fidati per `req.ip` |

## File esposti / creati
- `apps/server/src/cloud/db.ts` — client Drizzle cloud (lazy, `CLOUD_DATABASE_URL`, schema cloud).
- `apps/server/src/cloud/config.ts` — env cloud + costruzione link + safeRedirect.
- `apps/server/src/cloud/security.ts` — HMAC, token, password policy, normalize email, CSRF, TTL.
- `apps/server/src/cloud/email.ts` — `sendEmail` (transport mock) + template verify/reset.
- `apps/server/src/cloud/audit.ts` — writer audit log.
- `apps/server/src/cloud/cookies.ts` — cookie sessione/CSRF cloud (COOKIE_MODE).
- `apps/server/src/cloud/server.ts` — `startCloudServer()` (CORS allowlist, rate-limit Redis, routes).
- `apps/server/src/middleware/cloudAuth.ts` — `requireCloudAuth`, `requireCsrf`.
- `apps/server/src/routes/cloud/auth.ts` — endpoint auth.
- `apps/server/src/routes/cloud/pair.ts` — placeholder pairing.
- Modificati: `apps/server/src/index.ts` (switch), `apps/server/src/bootstrap.ts` (skip embedded DB in cloud), `.env.example` (root + server).

## Resta per la FASE 2b
- **OAuth Google/GitHub**: route `/api/auth/oauth/:provider` + callback, link `cloud_oauth_accounts`,
  trust di `email_verified_at_provider`. ENV: `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`, `OAUTH_BASE_URL`.
- **Email reale (Resend)**: implementare `resendTransport` in `email.ts` (TODO già segnato), `RESEND_API_KEY`, `EMAIL_TRANSPORT=resend`.
- **Pairing reale** `/api/pair`: device-code flow + proof-of-possession (`cloud_pairing_codes`,
  `cloud_appliances`), heartbeat `credentials_version`, gestione `cloud_restaurants`.
- Eventuale `change-password` autenticato e gestione `cloud_restaurants`/plan.

## Note per altri agenti
- Le route cloud importano le tabelle SOLO da `apps/server/src/cloud/db.ts` (re-export di `@tako/db/schema/cloud`).
- Migrazioni cloud NON applicate da questo task: eseguire `db:migrate:cloud` con `DATABASE_URL`=cloud prima di avviare in `TAKO_MODE=cloud`.
- Frontend cloud: usare `withCredentials`; in `COOKIE_MODE=crosssite` leggere `tako_cloud_csrf` e inviare `X-Tako-CSRF` sui POST/PUT/DELETE.
- Dipendenze: nessuna nuova installata (`@fastify/rate-limit`, `ioredis`, `nanoid`, `bcryptjs`, `zod` già presenti).
