# Contract: integrations — Appliance sync (FASE 4)

Branch: `feat/cloud-auth-20260625` (worktree `/Users/manuel/Projects/Tako-cloud-auth`)
Tipo: `REST` + `EVENT` + `ENV` + `MODULE`
Riferimento: MASTER_PLAN-cloud-auth §2.2 (sorgente identità), §5 (pairing/login offline), §7 SEC-001/003/007.
Dipende da: `integrations-oauth-pairing.contract.md` (endpoint cloud `/api/pair/claim|heartbeat`),
`backend-cloud-auth.contract.md`. Lato local: schema `users` (campi già presenti).

Tutto vive nel modo **`local`** (default appliance). Nessun impatto sul modo `cloud`.
Staff/PIN e cliente PWA restano INVARIATI.

---

## 1. Cloud client appliance — `apps/server/src/lib/cloud-client.ts` (MODULE)
Client locale verso il control-plane. No-op se `CLOUD_BASE_URL` assente (local puro).

Funzioni esposte:
- `cloudBaseUrl()` / `isPairingConfigured()` — config.
- `getDevicePublicKey()` — pubkey ed25519 (PEM SPKI) dell'appliance.
- `claim(code)` → `POST {CLOUD_BASE_URL}/api/pair/claim {code, devicePubKey}`. Persiste
  bundle `{applianceId, applianceToken, restaurant.id, ownerSnapshot{cloud_owner_id,email,name}, credentialsVersion}`.
  **NON riceve né salva il password_hash cloud (SEC-001).** Timeout 10s, errori soft (no stacktrace).
- `heartbeat()` → `POST /api/pair/heartbeat` con header `X-Tako-Appliance-Token`(=applianceId),
  `X-Tako-Signature` (firma ed25519 di `{applianceId,ts,credentialsVersion}` — proof-of-possession),
  `X-Tako-Timestamp`. Best-effort: offline → `action:'offline'` (non è errore). Ritorna
  `'none'|'refresh'|'revoke'|'offline'`.
- `ownerSnapshot()` — snapshot non-segreto per creare/aggiornare `users` owner.
- `pairingState()` — stato per la UI (nessun segreto).
- `resetPairing()` / `selfTestKeypair()`.

### Store locale cifrato a riposo (SEC-001, threat "box rubato")
- File `~/.tako/cloud-identity.enc` (rispetta `TAKO_HOME`), permessi `0600`.
- Cifratura **AES-256-GCM** (authenticated encryption). Layout `[salt16][iv12][tag16][ciphertext]`.
- Chiave derivata con **scrypt** (N=2^14) da un `device-secret` (64B CSPRNG) in
  `~/.tako/device-secret` (`0600`), generato una volta. Lega la confidenzialità ai permessi
  FS dell'utente del servizio (appliance headless senza TPM). Sostituibile in futuro con
  secret hardware cambiando solo `loadDeviceSecret()`.
- Contiene: keypair ed25519 (PEM), applianceId/applianceToken, snapshot owner non-segreto,
  credentialsVersion. **Mai** password_hash cloud. File corrotto / device-secret cambiato →
  store ricostruito vuoto (non accoppiato), nessun crash.

## 2. Endpoint setup locale — `apps/server/src/routes/setup.ts` (prefix `/api/setup`)
Montati SOLO in modo local (in `index.ts`).

| Metodo | Path | Body | Effetto |
|---|---|---|---|
| GET | `/api/setup/status` | — | `{configured, paired, ownerEmail, ownerName, restaurantId, credentialsVersion, pairedAt}` |
| POST | `/api/setup/pair` | `{code, localPassword(≥8)}` | `claim()` + crea/aggiorna `users(role=owner, cloud_owner_id, email, name)` + set `local_owner_secret_hash` (bcrypt r12) |
| POST | `/api/setup/local-password` | `{localPassword(≥8)}` | re-imposta la credenziale owner offline (dopo refresh) |
| POST | `/api/setup/heartbeat` | — | heartbeat manuale; `refresh`/`revoke` → azzera `local_owner_secret_hash` |
| POST | `/api/setup/unpair` | — | scollega: azzera credenziale offline + `resetPairing()` |

Envelope risposte: `{ data }` / errori `{ error: { code, message } }` (coerente col resto).
Loop heartbeat periodico (15 min, primo colpo +30s) avviato da `startHeartbeatLoop()` in `index.ts`.

## 3. Login owner OFFLINE — `apps/server/src/routes/auth.ts` (MODIFICATO)
`POST /api/auth/login` ora accetta, oltre a `password_hash` classico, anche
`local_owner_secret_hash` (credenziale owner locale del pairing). L'owner cloud-synced
può avere SOLO `local_owner_secret_hash` (nessun passwordHash). Confronto bcrypt su entrambe;
l'offline basta sempre (nessuna dipendenza dal cloud al login). Anti-enumeration e brute-force
(ip+email, max 5/15min) invariati. Email normalizzata lowercase. **Staff/PIN invariati.**

Invalidazione (SEC-007): se l'heartbeat riporta `refresh` (cloud ha bumpato `credentials_version`
per reset/cambio pw) o `revoke` → `local_owner_secret_hash` viene azzerato → l'owner deve
reimpostare la password offline via `/api/setup/local-password` (refresh) o ri-accoppiare (revoke).

## 4. Dashboard staff — `apps/dashboard/public/staff/src/06-screens-gestione.js` (MODIFICATO)
Nuovo componente `CloudPairing` dentro `ScreenCollega` (rotta `collega`). Visibile solo se
`/api/setup/status` riporta `configured:true`. Permette di inserire device code + password
owner locale e completare il pairing; mostra lo stato "collegato a <email>" + scollega.
Stile coerente (Card/Btn/input on-brand). SEC-001: la password cloud non transita mai dalla UI.

## 5. ENV (modo local)
| Env | Obbligatoria | Scopo |
|-----|--------------|-------|
| `CLOUD_BASE_URL` | no (vuoto = pairing disabilitato) | base del control-plane per claim/heartbeat (es. `https://api.tako.app`) |
| `TAKO_HOME` | no (`~/.tako`) | dir dello store cifrato appliance (impostata dalla shell desktop) |

Aggiunta a `.env.example` (root + server).

## 6. Eventi/azioni emessi verso altri sistemi
- Verso CLOUD: `POST /api/pair/claim` (one-shot al pairing), `POST /api/pair/heartbeat`
  (periodico, firmato ed25519). Consuma gli eventi audit cloud `pair_claimed`/`pair_heartbeat`.
- Verso DB LOCALE: upsert `users` owner (cloud_owner_id, local_owner_secret_hash, credentials_version,
  email_verified=true) e, se assente, creazione `restaurants` minima.

## 7. Gap schema rimasti (NON modificati in packages/db — segnalati)
- **Nessun gap bloccante**: lo schema local ha già `email_verified`, `cloud_owner_id`,
  `local_owner_secret_hash`, `credentials_version` su `users` (aggiunti in FASE 1 DB).
- Nice-to-have (non implementati, non bloccanti): colonna su `restaurants` per legare
  `cloud_restaurant_id` (oggi si riusa il primo `restaurants` del box o se ne crea uno);
  persistenza dell'`applianceToken` hashato lato local (oggi vive solo nello store cifrato).
  Se in futuro servono → richiesta a `database` agent, non modificati qui.

## 8. Resta per FASE 5 (QA/deploy)
- Verifica crittografica della FIRMA heartbeat LATO CLOUD (oggi il cloud identifica via
  applianceId; la firma è già inviata ma non verificata — vedi oauth-pairing contract §3).
- Test e2e: pair (mock cloud) → login owner offline → bump credentials_version → refresh →
  relogin; unpair; box senza CLOUD_BASE_URL (local puro, login owner classico invariato).
- TLS LAN per il login owner (SEC-017): `COOKIE_SECURE` dietro cert locale `tako.local`.
- security-review sullo store cifrato e sul fallback offline.
