# MASTER_PLAN — Tako: identità unificata sito↔app (cloud control-plane)

> Documento operativo per un agente Opus 4.8 che deve portare a termine, in autonomia, l'aggiunta
> dell'autenticazione completa (email/password + Google + GitHub + registrazione + verifica email +
> password dimenticata) al sito Tako e al backend, con gli account del sito **sincronizzati** con
> quelli dell'app. Architettura scelta: **cloud control-plane proprietario** (Opzione 1, vedi
> `~/Documents/brain/decisioni/2026-06-25-tako-cloud-identity.md`).
>
> Questo file è la fonte di verità del piano. Va riletto e ri-verificato contro il codice reale a
> ogni fase. Niente va dato per scontato: ogni claim su un file/route/campo va confermato leggendo.

---

## 0. Obiettivo (definition of done)

1. Un ristoratore può **registrarsi dal sito** (`tako.app`) con email+password, **Google** o **GitHub**.
2. La registrazione email/password invia una **email di verifica**; l'account è limitato finché non verificato.
3. Esiste **password dimenticata** funzionante (email con link a tempo, reset sicuro).
4. Lo **stesso account** usato sul sito permette di accedere all'**app/dashboard** del ristorante
   (identità owner sincronizzata sull'appliance locale; login owner funziona anche offline dopo il pairing).
5. Lo **staff** (cameriere/chef/cassiere) + **PIN** resta **locale** (creato dall'owner in dashboard).
6. Il **cliente** PWA resta senza account (QR tavolo) — invariato.
7. Tutto il codice è scritto, testato localmente con env placeholder, e committato su feature branch.
   I passaggi non automatizzabili (OAuth app, dominio, host, email provider, secrets) sono elencati per Manuel.

### Non-goal (fuori scope, esplicitati per non derivare)
- 2FA/TOTP, magic link, login SMS.
- Account per i clienti finali (consumatori PWA).
- Migrazione del modello multi-tenant esistente oltre a quanto serve per l'identità.
- Pagamenti/billing dei piani (plan resta com'è).

---

## 1. Stato attuale verificato (review 2026-06-25)

**Sito (`landing/` su `origin/main`, statico Cloudflare Pages, React+Babel in-browser):**
- `tako-sections.jsx` → `LoginModal` con 3 viste (login / register / forgot). **UI-only**: `onSubmit`
  fa `preventDefault()`, nessun `fetch`, nessun endpoint.
- `tako-trial.jsx` → `SignupForm` (nome ristorante + email). **UI-only**, submit locale.
- `tako-extra-shell.jsx` → `ContactForm`. **UI-only**.
- Zero `fetch`/`axios`/URL API in tutto `landing/`. Stato in `localStorage` (mock).

**Server (`apps/server`, Fastify 5, appliance LOCALE):**
- `src/routes/auth.ts`: `POST /api/auth/register` (crea ristorante+owner in transazione, bcryptjs r12,
  sessione nanoid(64) TTL 30g, cookie HttpOnly `tako_session`), `POST /api/auth/login` (brute-force
  in-memory max 5/(ip,email) in 15min, bcrypt.compare), `POST /api/auth/pin-login` (PIN 4 cifre bcrypt,
  TTL 12h), `GET /api/auth/me` (requireAuth), `POST /api/auth/logout`.
- `src/middleware/auth.ts`: `requireAuth` (token da cookie HttpOnly o Bearer; join sessions+users),
  `requireRole(...)`.
- `src/lib/cookies.ts`: `SESSION_COOKIE=tako_session`, `TABLE_COOKIE=tako_table`, opzioni HttpOnly/SameSite=Lax.
- `@fastify/jwt` v9 installato (usato per JWT tavolo cliente `tako_table` 4h). **Nessun** `@fastify/oauth2`.
- Nessun servizio email. Nessun OAuth. Bound `0.0.0.0:3001`, mDNS `tako.local`, HTTP su LAN, `COOKIE_SECURE`
  attivabile dietro TLS. Multi-tenant: filtering app-level via `req.user.restaurantId`.
- ⚠️ DA VERIFICARE in fase 0: discrepanza RLS — migrazione `0002` abilita RLS + `src/rls.ts`
  `withRestaurantContext`, ma le route sembrano filtrare app-level. Capire quale è attivo davvero.
- `.env.example`: `DATABASE_URL`, `JWT_SECRET` (auto-generato in `~/.tako/jwt-secret`), `PORT=3001`,
  `CLIENT_BASE_URL`, `UPLOADS_DIR`, `OPENAI_API_KEY`, `REDIS_URL`.

**DB (`packages/db`, Drizzle/Postgres):**
- `restaurants` (id, name, slug unique, …, plan enum free/pro/enterprise, settings jsonb, active).
- `users` (id, restaurantId FK, name, email **unique**, passwordHash, role enum owner/dipendente/chef/cassiere,
  pin, phone, avatarUrl, active, lastLoginAt). **Manca** `emailVerified`.
- `sessions` (id, userId FK, token unique, expiresAt).
- `table_sessions` (QR → tavolo).
- Migrazioni 0000–0005, gestite con drizzle-kit (`db:generate`, `db:migrate`, `db:studio`).
- **Mancano**: `oauth_accounts`, `email_verification_tokens`, `password_reset_tokens`, e il modello
  cloud (owner cloud, registry ristoranti, appliance/pairing).

**App Next.js:**
- `apps/dashboard` (staff, :3000): login/register UI in `public/staff/src/07-app-root.js`, store Zustand
  `src/lib/store.ts`, axios `/api` `withCredentials`, 401→`/login`. **Funzionante** vs `/api/auth`.
- `apps/web` (customer PWA, :3002): solo QR (`GET /api/customer/table/{token}` → JWT `tako_table`), nessun account.

---

## 2. Architettura target

```
                         INTERNET (pubblico, HTTPS)
   ┌───────────────────────────┐        ┌───────────────────────────────────┐
   │  Sito statico (Cloudflare) │  fetch │  TAKO CLOUD (control-plane)          │
   │  tako.app / *.pages.dev    │ ─────▶ │  api.tako.app  (Fastify, modo cloud) │
   │  LoginModal/Signup/Forgot  │  creds │  - owner accounts (email/pw)         │
   │  bottoni Google/GitHub      │◀────── │  - Google/GitHub OAuth               │
   └───────────────────────────┘  JSON  │  - email verify + password reset     │
                                          │  - registry ristoranti + pairing     │
                                          │  - Postgres cloud (Neon)             │
                                          └───────────────┬─────────────────────┘
                                                          │ pairing/claim (HTTPS)
                                                          │ sync identità owner
                                          ┌───────────────▼─────────────────────┐
                LAN ristorante            │  APPLIANCE LOCALE (Fastify, modo local)│
   ┌───────────────────────────┐  /api   │  tako.local:3001                      │
   │ Dashboard staff (tablet)   │ ──────▶ │  - operazioni (ordini/menu/KDS/cassa) │
   │ Customer PWA (QR)          │         │  - owner login offline (hash mirror)  │
   └───────────────────────────┘         │  - staff + PIN (solo locale)          │
                                          │  - Postgres locale (embedded)         │
                                          └───────────────────────────────────────┘
```

### 2.1 Principio di modo (un solo codebase, due modi)
Il backend Fastify gira in due **modi** selezionati via env `TAKO_MODE`:
- `cloud` → monta le route identità (auth web + oauth + email + registry + pairing), usa Postgres cloud,
  cookie cross-site (SameSite, Secure), CORS verso gli origin del sito.
- `local` (default, retrocompatibile) → comportamento attuale (operazioni + auth locale + staff/PIN),
  più un client verso il cloud per pairing e mirror identità owner.

Razionale: massimo riuso del codice esistente (`auth.ts`, `middleware/auth.ts`, `cookies.ts`), nessuna
duplicazione del modello sessioni. Le route cloud-only vivono in `src/routes/cloud/*` e si montano solo se `TAKO_MODE=cloud`.

### 2.2 Sorgente di verità dell'identità
- **Cloud** è la sorgente di verità per l'**owner** (email, password_hash, email_verified, oauth links, nome).
- L'appliance riceve al pairing uno **snapshot** dell'owner (id cloud, email, password_hash, name) e crea/aggiorna
  il proprio record `users` owner → consente login owner **offline** con la stessa password. Le modifiche di
  password fatte sul cloud si ripropagano all'appliance al successivo contatto (heartbeat/sync).
- **Staff** e **PIN** non esistono nel cloud: restano locali, creati dall'owner in dashboard.

---

## 3. Modello dati

### 3.1 Cloud Postgres (nuovo — `packages/db/src/schema/cloud/*` montato solo in modo cloud)
- `cloud_owners`: `id uuid pk`, `email text unique not null` (lowercase normalizzata), `password_hash text`
  (null se solo-OAuth), `name text`, `email_verified boolean default false`, **`credentials_version int default 0`**
  (bump su reset/cambio-pw/unlink → invalida sessioni e login offline appliance), `created_at`, `updated_at`, `last_login_at`.
- `cloud_oauth_accounts`: `id`, `owner_id fk`, `provider enum('google','github')`, `provider_user_id text`,
  `email_at_provider text`, `email_verified_at_provider boolean`, `created_at`. Unique `(provider, provider_user_id)` e `(owner_id, provider)`.
- `cloud_email_verification_tokens`: `id`, `owner_id fk`, `token_hash text unique` (**HMAC+pepper**), `expires_at`, `consumed_at`, `created_at`.
- `cloud_password_reset_tokens`: `id`, `owner_id fk`, `token_hash text unique` (**HMAC+pepper**), `expires_at`, `consumed_at`, `created_at`.
- `cloud_sessions`: `id`, `owner_id fk`, **`token_hash text unique` (HMAC a riposo, non in chiaro — SEC-016)**,
  `expires_at`, `created_at`, `user_agent`, `ip` (retention/anonimizzazione GDPR), `credentials_version` (snapshot).
- `cloud_restaurants`: `id uuid pk`, `owner_id fk`, `name`, `slug unique`, `plan`, `created_at`. (registry; dato operativo locale).
- `cloud_appliances`: `id`, `restaurant_id fk`, `pubkey text` (proof-of-possession), `paired_at`, `last_seen_at`,
  `revoked_at`, `public_label`, `seen_credentials_version`.
- `cloud_pairing_codes`: `id`, `owner_id fk`, `restaurant_id fk`, `code_hash` (HMAC), `device_pubkey`, `approved_at`,
  `expires_at`, `consumed_at`. (device-code flow con conferma owner — SEC-003).
- `cloud_audit_log`: `id`, `owner_id fk?`, `event` (login/reset/link/claim/…), `ip`, `user_agent`, `meta jsonb`, `created_at` (SEC §7bis).

### 3.2 Local Postgres (estensioni minime — `packages/db/src/schema/users.ts` ecc.)
- `users`: aggiungere `email_verified boolean default false`, `cloud_owner_id uuid null` (link identità cloud per owner),
  **`local_owner_secret_hash text null`** (credenziale owner LOCALE dedicata per login offline — NON il hash cloud, SEC-001),
  **`credentials_version int default 0`** (confrontato col cloud all'heartbeat). Staff resta con `cloud_owner_id` null.
- (Le tabelle token OAuth/reset **non** servono in locale: OAuth e reset avvengono nel cloud.)

### 3.3 Token & hashing
- Token via URL (verify/reset): `nanoid(64)` CSPRNG (≥32 byte entropia), salvati **HMAC-SHA256(token, PEPPER)** a riposo,
  single-use **atomico** (`UPDATE…WHERE consumed_at IS NULL RETURNING`), TTL breve (verify 24h, reset 1h).
- Pairing: device code ad alta entropia, `code_hash` HMAC, TTL 10min, conferma owner.
- Sessioni: token opaco lato client, **`token_hash` HMAC a riposo** nel DB.
- Password: bcryptjs r12; policy min 10–12 / max 72 byte; email normalizzata lowercase/trim.

---

## 4. Contratti API (cloud, prefix `/api/auth`)

| Metodo | Path | Auth | Body / Query | Effetto |
|---|---|---|---|---|
| POST | `/register` | — | `{name,email,password}` | crea `cloud_owners` (unverified), invia email verifica, NON crea sessione |
| POST | `/login` | — (brute-force) | `{email,password}` | verifica hash + email_verified → `cloud_session` cookie |
| POST | `/logout` | sess | — | invalida sessione |
| GET | `/me` | sess | — | `{owner, restaurants[]}` |
| GET | `/verify-email?token=` | — | token | consuma token → `email_verified=true`, redirect al sito |
| POST | `/resend-verification` | —/limited | `{email}` | rigenera token (rate-limited), reinvia email |
| POST | `/forgot-password` | — | `{email}` | crea reset token, invia email (risposta sempre 200 generica) |
| POST | `/reset-password` | — | `{token,password}` | valida token (HMAC, monouso atomico) → set hash, **bump credentials_version**, revoca TUTTE le sessioni |
| GET | `/google` | — | — | genera `state`+PKCE (cookie su api), redirect a Google OAuth (`@fastify/oauth2`) |
| GET | `/google/callback` | — | code+state | verifica state, upsert/link owner **solo se email provider verificata** → sessione → redirect allowlist |
| GET | `/github` | — | — | genera `state` (cookie su api), redirect a GitHub OAuth |
| GET | `/github/callback` | — | code+state | verifica state, `/user/emails` → usa solo `verified&&primary`, link condizionato → sessione → redirect allowlist |

Pairing (appliance ↔ cloud, prefix `/api/pair`) — **device-code flow, appliance autenticata** (SEC-003):
| POST | `/code` | sess owner | `{restaurantId}` (verifica ownership!) | genera device code ad alta entropia, TTL 10min, monouso |
| POST | `/claim` | appliance keypair | `{code, devicePubKey}` | richiede **conferma push dell'owner**; emette appliance token legato alla pubkey; **NON invia password_hash** |
| POST | `/heartbeat` | appliance token (firmato) | `{credentials_version}` | last_seen; se `credentials_version` cloud > locale → segnala revoca/aggiorna snapshot non-segreto |

Regole trasversali: validazione `zod` + normalizzazione email (lowercase/trim); risposte errore uniformi
`{error, code}`; **rate-limit condiviso Redis** (`@fastify/rate-limit` + `REDIS_URL`) per-IP **e** per-account su
`/login`, `/register`, `/forgot-password`, `/resend-verification`, `/verify-email`, `/reset-password`, `/pair/claim`;
anti-enumeration su register/forgot/login/resend (risposte generiche, timing costante); body-size limit 16KB su auth;
client IP affidabile solo dal proxy fidato (no XFF arbitrario); **audit log** di ogni evento auth (login/reset/link/claim).

---

## 5. Flussi (sequence)

**Registrazione email/pw:** sito `POST /register` → cloud crea owner unverified + token → email Resend con
`https://api.tako.app/api/auth/verify-email?token=…` → owner clicca → `email_verified=true` → redirect
`https://tako.app/?verified=1` → ora può fare login.

**Login:** sito `POST /login` → rivela `EMAIL_NOT_VERIFIED` **solo dopo** che la password combacia (altrimenti
errore generico, anti-enumeration SEC-008) → `cloud_session` cookie + `/me`.

**OAuth (Google/GitHub):** sito apre `GET /api/auth/google` → state+PKCE su `api.tako.app` → provider → callback
verifica state → ottiene email **e flag verificato** dal provider (Google: claim `email_verified`; GitHub: chiama
`/user/emails`, usa solo `verified===true && primary`). Linking a owner esistente **solo se** email provider verificata
**E** owner locale già `email_verified=true`; se owner esiste ma unverified → niente merge silenzioso (richiede
verifica/login esplicito). `email_verified` Tako impostato **solo** se il provider lo conferma. → sessione → redirect
allowlist (SEC-002).

**Password dimenticata:** sito `POST /forgot-password` (200 generico sempre) → email link da `SITE_BASE_URL` fisso
(no Host-header) `https://tako.app/reset?token=…` → form reset → `POST /reset-password` → set hash + **bump
credentials_version** + revoca TUTTE le sessioni owner + invalida token pendenti. Owner solo-OAuth (`password_hash`
null) → flusso "imposta password" invece di reset (SEC-014).

**Pairing appliance (hardened, SEC-001/003):** owner loggato sul sito → dashboard cloud → “Collega questo locale”
→ `POST /api/pair/code` (cloud verifica che `restaurantId` appartenga all'owner della sessione) → mostra device code.
Appliance genera **keypair locale**, invia pubkey + code a `POST /api/pair/claim` → cloud richiede **conferma push
all'owner loggato** → emette appliance token legato alla pubkey + bundle `{restaurant, ownerSnapshot NON-segreto:
cloud_owner_id, email, name}` (**MAI il password_hash**). L'appliance crea `restaurants`+`users(owner, cloud_owner_id)`.
**Login owner offline:** al pairing l'owner imposta una **credenziale owner LOCALE dedicata** (password/PIN locale,
hash sul box) usata solo per l'accesso offline; quando online, l'appliance valida contro il cloud. Heartbeat firmato
confronta `credentials_version`: se il cloud ha bumpato (reset/cambio) → revoca/aggiorna. Store identità appliance
**cifrato a riposo**. Modello di minaccia "appliance rubato": il furto del box NON espone la credenziale cloud.

---

## 6. Wiring del sito (landing su `main`)

- Introdurre `landing/tako-api.js` (config + fetch wrapper): `API_BASE` = `https://api.tako.app` in prod,
  override per staging; `credentials:'include'`.
- `tako-sections.jsx` `LoginModal`:
  - login → `POST {API}/api/auth/login`; gestire `EMAIL_NOT_VERIFIED`.
  - register → `POST {API}/api/auth/register` → schermata “controlla la mail”.
  - forgot → `POST {API}/api/auth/forgot-password` → conferma generica.
  - bottoni “Continua con Google/GitHub” → `location.href = {API}/api/auth/google|github`.
- Nuova pagina `reset` (file dedicato o `Tako Pagine.html?p=reset`) per `POST /reset-password`.
- `SignupForm` (`tako-trial.jsx`): collegare a `/register` (oppure tenerlo come lead — DA DECIDERE in build).
- CORS lato cloud: **allowlist ESATTA** da `ALLOWED_ORIGINS` (mai `origin:true`, mai suffix-match `*.pages.dev`,
  mai `*` con credenziali) + `Allow-Credentials: true`. **Scelta cookie (SEC-004): same-site preferito** —
  `api.tako.app` + `tako.app` sibling, cookie `Domain=.tako.app; SameSite=Lax`. Se cross-site (sito su `*.pages.dev`):
  `SameSite=None; Secure` **+ protezione CSRF obbligatoria** (header custom `X-Tako-CSRF` → forza preflight, +
  double-submit token) su tutti i POST/PUT/DELETE a sessione. Pagine reset/verify con `Referrer-Policy: no-referrer`.

---

## 7. Sicurezza (checklist blindata — incorpora audit 2026-06-25, finding SEC-001…018)

**P0 (bloccanti, risolti nel design):**
- [SEC-001] Pairing **non trasferisce mai** il `password_hash` cloud all'appliance. Login owner offline via
  credenziale **locale dedicata**. Store identità appliance cifrato a riposo. Threat model "box rubato" (vedi §7bis).
- [SEC-002] OAuth: link a owner esistente **solo** se email provider `verified===true` E owner già verificato.
  GitHub via `/user/emails` (`verified&&primary`). `email_verified` Tako mai impostato dalla sola presenza email.
  Nessun merge silenzioso su owner unverified (anti pre-account-hijacking).
- [SEC-003] `/pair/claim`: appliance autenticata (keypair + proof-of-possession), **conferma push owner**, device code
  ad alta entropia monouso TTL 10min, rate-limit/lockout sui tentativi.
- [SEC-004] Cookie: **same-site `.tako.app` preferito** (SameSite=Lax). Se cross-site → SameSite=None;Secure **+ CSRF**
  (header `X-Tako-CSRF` + double-submit). CORS allowlist **esatta**, mai riflettere Origin, mai suffix `*.pages.dev`.

**P1:**
- [SEC-005] Redirect post-callback/verify **solo** verso `SITE_BASE_URL` allowlist o path relativo validato (no `//`,
  no schema). Mai token di sessione in URL.
- [SEC-006] `state` OAuth generato/validato su `api.tako.app` (cookie temp HttpOnly/Lax, single-use, TTL corto) + PKCE.
  Verificare che `@fastify/oauth2` abbia lo state-check attivo; `redirect_uri` esatto.
- [SEC-007] reset/cambio-password/unlink/cambio-email → revoca **tutte** le `cloud_sessions` + bump `credentials_version`
  propagato agli appliance via heartbeat (login offline confronta epoch). "Logout da tutti i dispositivi". Degrado
  offline dopo N giorni senza heartbeat.
- [SEC-008] Anti-enumeration: `/register` su email esistente → successo generico + email "qualcuno ha provato";
  `/login` rivela `EMAIL_NOT_VERIFIED` **solo dopo** password corretta; `/resend`+`/forgot` 200 generico, timing costante.
- [SEC-009] Rate-limit **condiviso Redis** (`@fastify/rate-limit`+`REDIS_URL`), per-IP **e** per-account, lockout
  progressivo + captcha oltre soglia, esteso a forgot/resend/verify/reset/claim. Client IP solo dal proxy fidato.
- [SEC-010] In cloud i secret vengono **solo** da env/secret-manager (Fly secrets), mai auto-generati su FS effimero.
  `SESSION_SECRET`≠`JWT_SECRET`, ≥32 byte, distinti staging/prod, procedura di rotazione + key-id.
- [SEC-011] Isolamento cloud: ogni query filtra per `owner_id` **dalla sessione** (mai da input). `/pair/code` verifica
  ownership di `restaurantId`. RLS difesa-in-profondità anche su Neon. Test cross-tenant espliciti (§10).

**P2/Low:**
- [SEC-012] Token URL via **HMAC-SHA256(token, PEPPER)** (pepper in secret-manager), single-use **atomico**
  (`UPDATE…WHERE consumed_at IS NULL RETURNING`). nanoid CSPRNG, ≥32 byte entropia.
- [SEC-013] verify-email: landing GET che **non consuma** (conferma via POST/bottone) → evita prefetch/scanner.
  Link costruiti **solo** da env fissi, no Host-header injection. Dominio link uniforme. `Referrer-Policy: no-referrer`.
- [SEC-014] Owner solo-OAuth: `/forgot` → "imposta password"; offline-login via credenziale locale (vedi SEC-001).
- [SEC-015] Password policy (min 10–12, max 72, blocklist/HIBP opz.), email normalizzata (lowercase/trim), body-size 16KB.
- [SEC-016] `cloud_sessions.token` **hashato a riposo** (HMAC). Retention/anonimizzazione `ip`/`user_agent` (GDPR).
- [SEC-017] TLS anche in LAN per l'appliance (cert locale `tako.local`, es. mkcert), owner-login solo su connessione cifrata.
- [SEC-018] CORS prod: solo origin esatti `https://tako.app`, `https://www.tako.app`. Staging separato.
- Niente segreti nel repo: tutti via env/secret manager.

## 7bis. Threat model, lifecycle & compliance (raccomandazioni mancanti dall'audit)
- **Appliance ostile/rubato**: assumere il box accessibile. Blast radius isolato (no hash cloud sul box, store cifrato,
  credenziale offline non riusabile sul cloud, revoca via `credentials_version`).
- **Audit log & detection**: tracciare login/reset/link-OAuth/claim/cambio-password (chi/quando/IP/UA) con alert su
  pattern anomali (claim ripetuti, reset di massa, login da nuovo paese). Tabella `cloud_audit_log`.
- **Lifecycle di revoca completo**: revoca appliance (box venduto/dismesso), unlink OAuth, **cancellazione account owner
  (GDPR erasure)**, gestione `cloud_restaurants`/`cloud_appliances` orfani, `credentials_version` per invalidazione offline.
- **Privacy/GDPR & data residency**: owner UE → **Neon region EU**; Resend/OAuth provider USA → privacy policy, base
  giuridica, DPA, retention `ip`/`user_agent`. (Decisione/azione di Manuel — vedi §11.)
- **Email come superficie d'abuso**: SPF/DKIM/DMARC sul dominio mittente; quota/rate-limit sull'**invio** email
  (`/register`, `/resend`) per impedire mail-bombing di vittime terze usando Tako come amplificatore.

---

## 8. Deploy & infra (codice che scrivo io, esecuzione manuale di Manuel)
- **Host cloud**: Fly.io (preferito) o Railway. Scrivo `Dockerfile` (server in modo cloud) + `fly.toml`.
- **DB cloud**: Neon Postgres. `DATABASE_URL` in secret. Migrazioni drizzle applicate al cloud DB.
- **Email**: Resend (API semplice, free tier). Modulo `src/lib/email.ts` con template verify/reset.
- **Dominio**: `tako.app` (o esistente). `api.<dominio>` → host cloud; `<dominio>`/`www` → Cloudflare Pages.
- **Secrets cloud**: `TAKO_MODE=cloud`, `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID/SECRET`,
  `GITHUB_CLIENT_ID/SECRET`, `OAUTH_BASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_BASE_URL`, `ALLOWED_ORIGINS`.

---

## 9. Piano di build a fasi (con ownership file e verifica)

> Branch di lavoro: `feat/cloud-auth-20260625` (off `feat/fase1-consolidamento` per il codice app/server/db).
> Le modifiche al **sito** si fanno in worktree off `main` (il sito vive lì). Merge su main/feat: **solo Manuel**.

**FASE 0 — Verifica & fondamenta (no feature)**
- Confermare la discrepanza RLS (migrazione 0002 vs filtering app-level) leggendo `src/rls.ts`, `index.ts`,
  e 2-3 route. Documentare l'effettivo.
- Confermare nomi/firme reali di `auth.ts`, `cookies.ts`, `middleware/auth.ts`, schema drizzle.
- `pnpm tsc --noEmit` baseline verde.

**FASE 1 — DB (database)**
- Schema cloud (`packages/db/src/schema/cloud/*`) + estensioni local (`email_verified`, `cloud_owner_id`).
- `db:generate` → nuova migrazione. NON applicare a prod; applicare a un Postgres locale di test.
- Verifier: tipi compilano, migrazione coerente.

**FASE 2 — Backend cloud (backend + integrations)**
- `TAKO_MODE` switch in `index.ts` (monta route cloud solo in cloud).
- `src/lib/email.ts` (Resend) + template. `src/routes/cloud/auth.ts` (register/login/verify/forgot/reset/me/logout).
- `@fastify/oauth2` Google+GitHub in `src/routes/cloud/oauth.ts`. `state` anti-CSRF.
- `src/routes/cloud/pair.ts` (code/claim/heartbeat). Client locale di pairing in `src/lib/cloud-client.ts`.
- `.env.example` aggiornato. CORS configurabile.
- Verifier + testing: unit/integration sui flussi (mock email/oauth).

**FASE 3 — Sito (frontend, worktree off main)**
- `landing/tako-api.js` + wiring `LoginModal`/`SignupForm`/forgot + pagina reset + bottoni OAuth.
- Stati UI: “controlla la mail”, “email non verificata → reinvia”, errori.
- Verifica manuale locale puntando a un cloud di staging/locale.

**FASE 4 — Appliance sync (integrations)**
- Schermata pairing nella dashboard/desktop; `cloud-client` claim+heartbeat; login owner offline col mirror.

**FASE 5 — QA & deploy artefacts (testing + devops + security-review)**
- Test e2e dei 6 flussi (register, verify, login, oauth google, oauth github, forgot/reset).
- `Dockerfile`+`fly.toml`+README deploy. security-review sui flussi auth/oauth/token.

Ogni fase: leggi codice → implementa → `pnpm tsc --noEmit` → commit atomico → verifier pass/fail → fase successiva.

---

## 10. Test plan (cosa deve passare)
- register → token verifica (mock/log) → verify → login OK.
- login pre-verifica → `EMAIL_NOT_VERIFIED` **solo dopo** password corretta; password errata → errore generico.
- forgot → reset con token valido → login con nuova password OK; **token riusato → 400** (single-use atomico);
  reset → **tutte le sessioni revocate** + `credentials_version` bumpata.
- oauth: provider con email **non verificata** → NON linka a owner esistente (crea nuovo / rifiuta) — anti-takeover SEC-002;
  provider verificato → link/creazione + sessione. `state` mancante/errato → rifiuto (SEC-006).
- pairing: claim senza conferma owner → negato; con device code valido + conferma → appliance token (no password_hash nel bundle);
  code riusato/scaduto → 400; **login owner offline** via credenziale locale OK; dopo bump `credentials_version` cloud → revoca.
- **cross-tenant** (SEC-011): owner A non legge/collega `cloud_restaurants`/appliance di owner B; `/pair/code` su restaurantId altrui → 403; `/me` ritorna solo i propri.
- anti-enumeration: forgot/register/resend su email inesistente → 200 generico, timing costante.
- **CSRF**: POST a sessione senza header `X-Tako-CSRF` (se cross-site) → rifiutato.
- CORS: solo origin allowlist esatti passano con credenziali; `*.pages.dev` arbitrario bloccato.
- rate-limit: oltre soglia su login/forgot/claim → lockout (verifica store Redis condiviso).
- open-redirect: callback con `next` esterno → ignorato/sanificato (SEC-005).

---

## 11. Passaggi MANUALI per Manuel (cose che l'agente NON può fare)
1. **Dominio**: registrare/confermare `tako.app` (o scelto) e gestire DNS.
2. **Cloudflare Pages**: custom domain `tako.app`/`www` sul progetto del sito.
3. **Google OAuth**: Google Cloud Console → OAuth consent + Client ID/Secret, redirect `https://api.tako.app/api/auth/google/callback`.
4. **GitHub OAuth**: GitHub → Developer settings → OAuth App, callback `https://api.tako.app/api/auth/github/callback`.
5. **Neon**: creare progetto Postgres **in region EU** (GDPR data residency, §7bis), copiare `DATABASE_URL`.
6. **Host cloud (Fly/Railway)**: creare account, region EU, `fly launch`/deploy con i file forniti, settare i secrets.
7. **Resend**: account, verificare dominio mittente con record DNS **SPF + DKIM + DMARC** (anti-spoofing/deliverability, §7bis), API key, `EMAIL_FROM`.
8. **Secrets**: inserire tutte le env del §8 nell'host (incluso `TOKEN_PEPPER`, `SESSION_SECRET`≠`JWT_SECRET`).
9. **Applicare migrazioni** al DB cloud (`pnpm db:migrate` con `DATABASE_URL` cloud) — guidato.
10. **Privacy policy + base giuridica GDPR** per i dati owner nel cloud (decisione di Manuel; DPA coi provider USA).
11. **Merge su main** dei branch (policy: solo Manuel).

---

## 12. Rischi & questioni aperte

### RISOLTE dalla review (2026-06-25)
- **RLS** (review accuratezza): VERIFICATO — RLS abilitato (migrazione 0002 + `src/rls.ts`) ma **nessuna route lo usa**;
  isolamento attivo = app-level `WHERE restaurantId` (es. `orders.ts:32`, `menu.ts:36`). Decisione: non toccare il
  locale; nel cloud filtrare per `owner_id` dalla sessione (+ RLS Neon come difesa in profondità — SEC-011).
- **Posizione sito**: VERIFICATO — `landing/` è su `origin/main` di QUESTO monorepo (159 file). Sito edit via worktree off `main`.
- **CORS**: `index.ts:72` = `origin:true,credentials:true` ok per appliance, **vietato** in cloud → `ALLOWED_ORIGINS` esatti.
- **Pairing/SEC-001/003**: niente `password_hash` all'appliance; credenziale owner locale + device-code autenticato.
- **OAuth/SEC-002**: link solo con email provider verificata + owner verificato.
- **Cookie/SEC-004**: same-site `.tako.app` preferito; cross-site → CSRF token.

### APERTE (da risolvere durante il build)
- Cookie cross-site vs same-site: spinge a richiedere subito il custom domain `api.tako.app`+`tako.app` (semplifica, SEC-004).
- `SignupForm` del trial: lead-gen vs registrazione reale (allineare con Manuel se ambiguo).
- Comportamento login owner offline dopo bump `credentials_version` mentre l'appliance è offline a lungo (degrado dopo N giorni).
- Free tier limits (Neon EU/Fly/Resend) sufficienti per i primi clienti.
- Audit log retention + alerting (dove inviare gli alert di sicurezza).
