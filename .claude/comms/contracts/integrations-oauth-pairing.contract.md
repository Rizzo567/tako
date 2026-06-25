# Contract: integrations — OAuth + email reale + pairing (FASE 2b)

Branch: `feat/cloud-auth-20260625` (worktree `/Users/manuel/Projects/Tako-cloud-auth`)
Tipo: `REST` + `EVENT` + `ENV`
Riferimento: MASTER_PLAN-cloud-auth §4 (API), §5 (flussi), §7 (SEC-002/003/005/006), §7bis (email abuse)
Dipende da: `backend-cloud-auth.contract.md` (helper sessione/cookie/security/audit, modo cloud) e
`database-cloud-identity.contract.md` (tabelle `cloud_oauth_accounts`, `cloud_appliances`, `cloud_pairing_codes`).

Tutto vive SOLO in `TAKO_MODE=cloud`. Il modo `local` resta invariato.

---

## 1. Email reale (Resend) — `apps/server/src/cloud/email.ts`
- `EMAIL_TRANSPORT=resend` → invio via API Resend (`https://api.resend.com/emails`) usando
  `RESEND_API_KEY` (Bearer) + `EMAIL_FROM`. Default `mock` (console) per dev/test.
- Timeout esplicito 10s (AbortController). Su errore: si logga SOLO lo stato HTTP, MAI la key
  né il body (PII destinatario).
- `validateEmailConfig()` (chiamata in `startCloudServer`): fail-fast se `EMAIL_TRANSPORT=resend`
  e `RESEND_API_KEY` assente.
- **Quota anti mail-bombing (§7bis)**: `sendEmail` applica un limite logico per-destinatario
  (max 5 email / 60 min, in-memory) PRIMA del transport. Oltre soglia ritorna
  `{ ok:false, transport:'throttled' }` senza inviare e senza lanciare. Difende vittime terze
  (register/resend con email altrui non bombardano l'indirizzo).

## 2. OAuth Google + GitHub — `apps/server/src/routes/cloud/oauth.ts` (montato sotto `/api/auth`)
Dipendenza installata: **`@fastify/oauth2` 8.2.0**.

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/api/auth/google` | — | redirect a Google (scope `openid email profile`, PKCE S256, state cookie) |
| GET | `/api/auth/google/callback` | state cookie | scambia code→token, legge userinfo, risolve owner, sessione, redirect allowlist |
| GET | `/api/auth/github` | — | redirect a GitHub (scope `read:user user:email`, state cookie) |
| GET | `/api/auth/github/callback` | state cookie | scambia code→token, `/user`+`/user/emails`, risolve owner, sessione, redirect |

- Ogni provider si MONTA solo se `*_CLIENT_ID` e `*_CLIENT_SECRET` sono presenti (altrimenti route assente + warn log).
- **SEC-006**: `state` e PKCE gestiti dal plugin via cookie temporaneo HttpOnly single-use TTL corto,
  generato/validato su `OAUTH_BASE_URL`. In `COOKIE_MODE=crosssite` il cookie di state è `SameSite=None;Secure`.
  `redirect_uri` costruito da `OAUTH_BASE_URL` (env fissa, mai Host header).
- **Email verificata**: Google → claim `email_verified` da `openidconnect.googleapis.com/v1/userinfo`.
  GitHub → `api.github.com/user/emails`, usata SOLO l'email con `verified===true && primary===true`.
- **Linking (SEC-002)** in `resolveOwner`:
  - email provider NON verificata → **rifiuto** (`oauth_email_unverified`), redirect `?oauth_error=email_unverified`.
  - `(provider, providerUserId)` già collegato → login diretto.
  - email == owner esistente **verificato** → link `cloud_oauth_accounts` (idempotente) → login.
  - email == owner esistente **NON verificato** → **RIFIUTO** (no merge silenzioso), redirect `?oauth_error=verify_existing_account`.
  - nessun owner → crea owner nuovo (`password_hash=null`, `email_verified=true` perché provider conferma) + link.
- **SEC-005**: redirect post-callback SOLO via `safeRedirect(next)` (stessa origin di `SITE_BASE_URL`), mai token in URL.
- Errori (state invalido, token, rete provider) → redirect `SITE_BASE_URL/?oauth_error=1` + audit, mai stacktrace al client.

## 3. Pairing appliance↔cloud — `apps/server/src/routes/cloud/pair.ts` (prefix `/api/pair`)

| Metodo | Path | Auth | Descrizione |
|---|---|---|---|
| GET | `/api/pair/status` | — | `{ enabled:true, phase:'2b' }` |
| POST | `/api/pair/code` | sessione owner + CSRF | `{restaurantId}` (verifica ownership) → `{code, expiresInSeconds, restaurantId}` |
| POST | `/api/pair/approve` | sessione owner + CSRF | `{code}` → ri-conferma idempotente (opzionale, non richiesta dal claim) |
| POST | `/api/pair/claim` | device code (+ per-code lockout) | `{code, devicePubKey}` → bundle + applianceToken |
| POST | `/api/pair/heartbeat` | `X-Tako-Appliance-Token`(=applianceId) + firma ed25519 verificata | `{credentialsVersion?}` → `{credentialsVersion, action}` |

### Flusso di approvazione scelto: AUTO-APPROVE alla generazione
`POST /api/pair/code` richiede già la **sessione owner autenticata** e verifica che il
`restaurantId` appartenga all'owner (SEC-011). Il device code è alta-entropia, mostrato SOLO
nella dashboard dell'owner, HMAC a riposo (`code_hash`), TTL 10 min, single-use atomico. Il
**possesso di un code valido e non consumato È la prova dell'intenzione dell'owner** (lo trascrive
manualmente sull'appliance). Quindi `approved_at = now()` viene impostato alla generazione. Un
secondo step "approve push" non aumenterebbe la sicurezza (l'owner ha già agito autenticato), perciò
`POST /api/pair/approve` resta esposto come no-op idempotente per UX/estensione futura ma il claim
NON lo richiede. Il claim verifica comunque `approved_at` (difesa in profondità).

### `/claim` (SEC-001/003)
- Consumo **atomico** del code (`UPDATE…WHERE consumed_at IS NULL AND not expired RETURNING`).
- Registra `cloud_appliances` con la `devicePubKey` (proof-of-possession), unique su pubkey,
  `onConflictDoUpdate` per re-pairing (resetta `revoked_at`).
- Emette `applianceToken` opaco legato all'appliance; a riposo si conserva la **pubkey**, non il token.
  Il binding token↔pubkey chiude il loop PoP: ogni heartbeat successiva DEVE firmare con la
  privkey corrispondente a quella pubkey (vedi sotto), quindi il token da solo non basta.
- **Per-code lockout (SEC-003, Fase 5a)**: oltre al rate-limit per-IP (Redis, davanti alla route)
  un limite per **singolo code** (`max 5 tentativi falliti / 10 min`, chiave = HMAC del code,
  in-memory per-istanza). Tentativo fallito = code invalido/scaduto/già usato. Oltre soglia →
  `429 TOO_MANY_ATTEMPTS`. Un claim riuscito azzera il contatore del code.
- Bundle ritornato: `{ applianceToken, applianceId, restaurant{id,name,slug,plan},
  ownerSnapshot{cloud_owner_id, email, name}, credentialsVersion }`. **MAI `password_hash`** (SEC-001).

### `/heartbeat` (SEC-003/007) — firma ed25519 VERIFICATA (Fase 5a)
- Identifica l'appliance via header `X-Tako-Appliance-Token` = `applianceId`.
- **Proof-of-possession ATTIVO**: il cloud verifica la firma ed25519 in `X-Tako-Signature`
  (base64url, 64 byte) contro la `cloud_appliances.pubkey` (PEM SPKI salvata al claim).
  - **Payload canonico firmato/verificato**: `JSON.stringify({ applianceId, ts, credentialsVersion })`
    con ordine chiavi `applianceId, ts, credentialsVersion`. `ts` = number (ms) preso da
    `X-Tako-Timestamp`; `credentialsVersion` = quella inviata nel body (= quella firmata dal client).
    Allineato byte-per-byte con `signPayload`/`heartbeat` di `apps/server/src/lib/cloud-client.ts`.
  - **Anti-replay**: `ts` deve cadere in una finestra `±5 min` da `Date.now()` (clock skew di
    un'appliance headless). Fuori finestra → `401`. Una heartbeat catturata non è riusabile a lungo.
  - Firma/timestamp mancanti, ts non numerico/fuori finestra, o firma non valida → `401 UNAUTHORIZED`.
- `last_seen_at` + `seen_credentials_version` aggiornati **SOLO** se la firma è valida.
- Se `cloud.credentials_version > signedVersion` → `action:'refresh'`. Appliance revocata →
  `403 REVOKED` + `action:'revoke'`.

---

## 4. Eventi interni emessi (audit log `cloud_audit_log`)
Nuovi `AuditEvent` (in `apps/server/src/cloud/audit.ts`):
`oauth_login_success, oauth_account_created, oauth_account_linked, oauth_link_refused,
oauth_state_invalid, oauth_email_unverified, pair_code_generated, pair_claimed,
pair_claim_refused, pair_heartbeat`.

## 5. ENV (modo cloud)
| Env | Obbligatoria | Scopo |
|-----|--------------|-------|
| `EMAIL_TRANSPORT` | no (`mock`) | `mock` \| `resend` |
| `RESEND_API_KEY` | sì se `resend` | API key Resend (Bearer) |
| `EMAIL_FROM` | no | mittente (verificato su Resend in prod) |
| `OAUTH_BASE_URL` | sì per OAuth | base dei callback (es. `https://api.tako.app`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | per Google | abilita route Google |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | per GitHub | abilita route GitHub |

## 6. File creati / modificati
- Creati: `apps/server/src/routes/cloud/oauth.ts`, `apps/server/src/cloud/session.ts`.
- Riscritto: `apps/server/src/routes/cloud/pair.ts` (da placeholder a device-code flow reale).
- Modificati: `apps/server/src/cloud/email.ts` (transport resend + quota), `apps/server/src/cloud/config.ts`
  (helper OAuth), `apps/server/src/cloud/audit.ts` (eventi), `apps/server/src/cloud/server.ts` (monta oauth +
  validateEmailConfig), `apps/server/src/routes/cloud/auth.ts` (riusa `issueCloudSession`), `.env.example` (root + server).
- Dipendenza installata: `@fastify/oauth2@8.2.0` (in `apps/server`).

## 7. Note per altri agenti
- **Frontend (Fase 3)**: i bottoni social fanno `location.href = {OAUTH_BASE_URL}/api/auth/google|github`.
  Gestire i query param d'errore sul redirect: `?oauth_error=1|email_unverified|verify_existing_account`.
  Dashboard cloud: `POST /api/pair/code` (con cookie + `X-Tako-CSRF` in crosssite) per mostrare il device code.
- **Appliance client (Fase 4)**: genera keypair locale, `POST /api/pair/claim {code, devicePubKey}`,
  salva il bundle (store CIFRATO a riposo, MAI il password_hash perché non arriva), poi `POST /api/pair/heartbeat`
  con `X-Tako-Appliance-Token: <applianceId>` e `{credentialsVersion}`. Implementare la FIRMA crittografica
  della heartbeat con la privkey (proof-of-possession) — qui c'è solo l'identificazione via applianceId.
- Migrazioni cloud NON applicate (vincolo del task): eseguire `db:migrate:cloud` prima dell'avvio reale.
