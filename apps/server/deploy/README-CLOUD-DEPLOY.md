# Deploy del control-plane cloud Tako (Fly.io + Neon + Resend)

Guida operativa per mettere online il **control-plane identità** (`TAKO_MODE=cloud`):
il backend Fastify che gestisce gli account owner del sito (email/password, Google,
GitHub, verifica email, reset password, registry ristoranti, pairing appliance).

È un deploy **separato** dall'appliance locale: non condivide DB né segreti con
l'installazione nel ristorante. Riferimenti: `MASTER_PLAN-cloud-auth.md` §8 e §11.

## Artefatti in questa cartella
- `Dockerfile.cloud` — immagine di produzione del server in modo cloud (entrypoint
  `src/cloud/entry.ts`, niente Postgres embedded, gira con `tsx`).
- `fly.toml` — config Fly.io (region EU, porta interna 3001, healthcheck `/health`, HTTPS forzato).
- Questo README.

> **Build/run del server (assunzione confermata leggendo il codice):** i package
> workspace `@tako/db` e `@tako/types` esportano **TypeScript sorgente** (nessun build
> TS→JS), quindi il server gira con **`tsx` a runtime** anche in produzione — come già
> fa `apps/server/Dockerfile` (appliance). Lo script `start:cloud` = `tsx src/cloud/entry.ts`.

---

## 0. Prerequisiti
- CLI: `flyctl` (https://fly.io/docs/flyctl/install/), `pnpm` (già nel monorepo), `psql` (per i test, opzionale).
- Un dominio (es. `tako.app`) con DNS gestibile (Cloudflare consigliato).
- Account: Fly.io, Neon, Resend, Google Cloud, GitHub.

I comandi `fly` vanno lanciati **dal root del monorepo** (`/Users/manuel/Projects/Tako-cloud-auth`):
il `Dockerfile.cloud` fa `COPY packages/* apps/server`, quindi il build context **deve** essere il root.

---

## 1. Database — Neon Postgres (region EU)
1. Crea un progetto Neon **in region EU** (es. `eu-central-1` Francoforte) per la data
   residency GDPR (MASTER_PLAN §7bis). Allinea la region a quella di Fly (`fra`/`cdg`).
2. Copia la connection string (pooled o diretta, con `?sslmode=require`). Sarà `CLOUD_DATABASE_URL`.
   - Esempio: `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/takocloud?sslmode=require`

### 1.1 Applicare le migrazioni cloud
Le migrazioni cloud vivono in `packages/db/src/migrations-cloud` e usano la config
**dedicata** `packages/db/drizzle.cloud.config.ts`. Quella config legge la URL dalla env
**`DATABASE_URL`** (non `CLOUD_DATABASE_URL`): impostala al volo, puntandola al DB Neon.

```bash
# dal root del monorepo — applica SOLO lo schema cloud (tabelle cloud_*) al DB Neon
DATABASE_URL='postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/takocloud?sslmode=require' \
  pnpm --filter @tako/db db:migrate:cloud
```

> ⚠️ Verifica di puntare al **DB cloud** e mai al Postgres locale: lo schema cloud
> (`cloud_owners`, `cloud_sessions`, …) non deve finire nel DB dell'appliance e viceversa.

---

## 2. Email — Resend
1. Crea l'account Resend e **verifica il dominio mittente** (es. `tako.app`) aggiungendo
   al DNS i record che Resend fornisce:
   - **SPF**: TXT su `tako.app` → tipicamente `v=spf1 include:amazonses.com ~all` (usa il valore esatto di Resend).
   - **DKIM**: i record `CNAME`/`TXT` (es. `resend._domainkey.tako.app`) indicati nella dashboard Resend.
   - **DMARC**: TXT su `_dmarc.tako.app` → es. `v=DMARC1; p=quarantine; rua=mailto:dmarc@tako.app`.
   SPF+DKIM+DMARC sono richiesti contro spoofing e per la deliverability (MASTER_PLAN §7bis).
2. Genera una **API key** → sarà `RESEND_API_KEY`.
3. `EMAIL_FROM` deve essere un mittente sul dominio verificato, formato `Tako <no-reply@tako.app>`.
4. Per attivare l'invio reale imposta `EMAIL_TRANSPORT=resend` (con `mock` le email vengono
   solo loggate — utile in staging). Con `resend` la `RESEND_API_KEY` è obbligatoria (fail-fast all'avvio).

---

## 3. OAuth — Google e GitHub
I redirect/callback si costruiscono **solo** da `OAUTH_BASE_URL` (es. `https://api.tako.app`).
Registra ESATTAMENTE questi URI (sostituendo il dominio reale):

- **Google** (Google Cloud Console → API & Services → Credentials → OAuth Client ID, tipo *Web application*):
  - Authorized redirect URI: `https://api.tako.app/api/auth/google/callback`
  - Ottieni `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`. Configura anche l'OAuth consent screen.
- **GitHub** (Settings → Developer settings → OAuth Apps → New OAuth App):
  - Authorization callback URL: `https://api.tako.app/api/auth/github/callback`
  - Ottieni `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET`.

> Ogni provider si attiva **solo** se id+secret sono presenti tra i secret: altrimenti la
> rispettiva route non viene montata (nessun errore, semplicemente disabilitata).

---

## 4. Redis — rate-limit condiviso
Il control-plane usa Redis come store **condiviso** del rate-limit (coerente tra più
macchine Fly). Senza `REDIS_URL` il rate-limit cade su un fallback in-memory **non condiviso**.

Scegli una delle due:
- **Upstash Redis** (serverless, region EU): crea un DB, copia la `rediss://…` URL → `REDIS_URL`.
- **Fly Redis** (Upstash gestito da Fly): `fly redis create` (scegli region EU) → copia la URL.

---

## 5. App Fly.io
Dal root del monorepo:

```bash
# 1) crea l'app (NON deployare ancora: prima i secret). Scegli un nome reale.
fly launch --no-deploy --copy-config --name tako-cloud --region cdg \
  --dockerfile apps/server/deploy/Dockerfile.cloud

# (se fly.toml già presente, basta:  fly apps create tako-cloud --org <org> )
```

Aggiorna in `apps/server/deploy/fly.toml` il campo `app` col nome reale e `primary_region`
con la region EU scelta (deve combaciare con Neon e Redis).

### 5.1 Impostare TUTTI i secret
I segreti vanno **solo** come Fly secrets (mai nel repo, mai in `fly.toml`, mai in
`--env-file`). Genera i casuali con `openssl`:

```bash
fly secrets set -a tako-cloud \
  TAKO_MODE=cloud \
  CLOUD_DATABASE_URL='postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/takocloud?sslmode=require' \
  SESSION_SECRET="$(openssl rand -hex 64)" \
  TOKEN_PEPPER="$(openssl rand -hex 32)" \
  SITE_BASE_URL='https://tako.app' \
  OAUTH_BASE_URL='https://api.tako.app' \
  ALLOWED_ORIGINS='https://tako.app,https://www.tako.app' \
  COOKIE_MODE='samesite' \
  EMAIL_TRANSPORT='resend' \
  EMAIL_FROM='Tako <no-reply@tako.app>' \
  RESEND_API_KEY='re_xxx' \
  GOOGLE_CLIENT_ID='xxx.apps.googleusercontent.com' \
  GOOGLE_CLIENT_SECRET='xxx' \
  GITHUB_CLIENT_ID='Iv1.xxx' \
  GITHUB_CLIENT_SECRET='xxx' \
  REDIS_URL='rediss://default:pass@eu1-xxx.upstash.io:6379' \
  TRUST_PROXY='1'
```

#### Spiegazione di ogni env
| Env | Obbligatoria | Cosa fa |
|---|---|---|
| `TAKO_MODE` | sì | `cloud` attiva il control-plane (anche forzata dall'entrypoint + `fly.toml`). |
| `CLOUD_DATABASE_URL` | sì | Connessione al Postgres **Neon EU**. Deve essere ≠ dal DB locale appliance. |
| `SESSION_SECRET` | sì (≥32 char) | Firma i cookie di sessione cloud (anti-tamper). **Distinto** da `JWT_SECRET` locale. |
| `TOKEN_PEPPER` | sì (≥16 char) | Pepper HMAC dei token a riposo (verifica email, reset, sessioni). |
| `SITE_BASE_URL` | sì | Base URL del **sito** (front-end). Costruisce i link email e l'allowlist redirect. Mai da Host header. |
| `OAUTH_BASE_URL` | per OAuth | Base URL pubblica del **control-plane** su cui rientrano i callback OAuth (es. `https://api.tako.app`). |
| `ALLOWED_ORIGINS` | sì | Allowlist CORS **esatta** del front-end (separata da virgola). Mai wildcard, mai `*.pages.dev`. |
| `COOKIE_MODE` | no (def. `samesite`) | `samesite` se sito+API sono sotto `.tako.app`; `crosssite` (SameSite=None;Secure + CSRF `X-Tako-CSRF`) se cross-site. |
| `EMAIL_TRANSPORT` | no (def. `mock`) | `resend` per invio reale; `mock` logga solo (staging). |
| `EMAIL_FROM` | con resend | Mittente verificato sul dominio Resend. |
| `RESEND_API_KEY` | con resend | API key Resend. Solo da env, mai nel codice. |
| `GOOGLE_CLIENT_ID` / `_SECRET` | opz. | Abilita login Google (se assenti, route non montata). |
| `GITHUB_CLIENT_ID` / `_SECRET` | opz. | Abilita login GitHub (se assenti, route non montata). |
| `REDIS_URL` | consigliata | Store rate-limit condiviso tra le macchine Fly. Senza → fallback in-memory non condiviso. |
| `TRUST_PROXY` | no (def. `1`) | Hop di proxy fidati (Fly = 1). Da `1` deriva `req.ip` dall'X-Forwarded-For. |

> `JWT_SECRET`, `DATABASE_URL`, `PORT` locali, `UPLOADS_DIR`, `OPENAI_API_KEY`, `CLOUD_BASE_URL`
> **non** servono in cloud (sono dell'appliance). In cloud non vanno impostati.

### 5.2 Deploy
```bash
fly deploy -c apps/server/deploy/fly.toml
fly logs -a tako-cloud           # verifica avvio: "Tako CLOUD control-plane in ascolto..."
curl -s https://api.tako.app/health   # → {"status":"ok","mode":"cloud",...}
```

---

## 6. DNS e domini
- **`api.<dominio>` → Fly**: aggiungi il custom domain su Fly e crea i record DNS:
  ```bash
  fly certs add api.tako.app -a tako-cloud
  fly ips list -a tako-cloud     # mostra gli IP v4/v6 dedicati da puntare
  ```
  Crea su Cloudflare:
  - `A  api  → <IPv4 Fly>`  e  `AAAA api → <IPv6 Fly>` (proxy Cloudflare **DNS only / grey cloud**:
    Fly termina già il TLS; il proxy arancione confligge col cert Fly).
  Attendi che `fly certs show api.tako.app` risulti emesso.
- **`<dominio>` e `www` → Cloudflare Pages**: il **sito** statico (cartella `landing/`) è
  ospitato su Cloudflare Pages. Imposta lì il custom domain `tako.app` / `www.tako.app`
  (Pages → progetto → Custom domains). Questo è separato dal control-plane Fly.
- **Resend**: i record SPF/DKIM/DMARC del §2 sul dominio mittente.

Coerenza richiesta: `OAUTH_BASE_URL` = `https://api.tako.app` (host Fly), `SITE_BASE_URL`
e `ALLOWED_ORIGINS` = origin del sito Pages (`https://tako.app`, `https://www.tako.app`).
I redirect URI registrati su Google/GitHub (§3) devono usare lo stesso `OAUTH_BASE_URL`.

---

## 7. Checklist finale
- [ ] Neon EU creato, `db:migrate:cloud` applicato, tabelle `cloud_*` presenti.
- [ ] Resend: dominio verificato (SPF+DKIM+DMARC verdi), API key, `EMAIL_FROM` sul dominio.
- [ ] Google + GitHub OAuth app con i callback ESATTI `{OAUTH_BASE_URL}/api/auth/{google,github}/callback`.
- [ ] Redis (Upstash/Fly) creato in region EU, `REDIS_URL` impostata.
- [ ] Tutti i secret del §5.1 impostati su Fly (`fly secrets list -a tako-cloud`).
- [ ] `fly deploy` ok, `GET /health` → `{"status":"ok","mode":"cloud"}`.
- [ ] `api.tako.app` punta a Fly (cert emesso), sito `tako.app`/`www` su Cloudflare Pages.
- [ ] CORS: solo gli origin esatti del sito; nessuna wildcard.

## 8. Rollback
- Fly mantiene le release: `fly releases -a tako-cloud` poi `fly deploy --image <release precedente>`
  oppure `fly apps restart tako-cloud`. Le migrazioni cloud sono additive (schema separato):
  un rollback dell'immagine non tocca i dati. Per il DB usa gli snapshot Neon (branch/restore).
