# TAKO — File unico di progetto

> **Unica fonte di verità** per cos'è Tako, cosa è stato fatto e cosa resta da fare.
> Sostituisce i vecchi doc sparsi (STATO-TAKO, BACKLOG, PIANO-PERFEZIONE, UI-REVISION-PLAN,
> AGENT-LOG, SECURITY, `docs/**`): tutti consolidati qui.
> Le istruzioni operative del team di agenti restano in `CLAUDE.md` e `.claude/`.
> Ultimo aggiornamento: **2026-06-26**.

---

## 1. Cos'è

Tako = **sistema operativo del ristorante**. Gira **in locale** su un mini PC nel locale. Lo
staff usa la dashboard su tablet; i clienti scansionano il QR del tavolo e ordinano dal
telefono senza installare nulla. Il core POS funziona **senza internet**; solo le feature AI e
l'identità cloud (sito web/account) richiedono rete.

**Obiettivo finale:** sistema indispensabile. Il ristoratore non torna a carta e penna. Gli
ordini vanno diretti in cucina senza cameriere. Il cliente ordina da solo. Zero errori di
comunicazione. Le statistiche fanno capire cosa funziona. Tako non sostituisce l'ospitalità — la
potenzia.

**Chi usa:** ristoratore/owner (gestione completa), cameriere (sala/ordini/chiamate), cuoco
(KDS), cassiere (cassa/conti), cliente (menu PWA da QR).

---

## 2. Architettura

```
  apps/server     Fastify + Socket.io + Drizzle/Postgres   :3001   ← cuore, multi-tenant
  apps/web        Customer PWA (Next.js 15)                 :3002   ← cliente da QR
  apps/dashboard  Dashboard staff (SPA in /public/staff)    :3000   ← staff su tablet
  apps/app        App nativa Expo + Tauri (thin client)             ← carica /staff
  packages/db     Schema Postgres (Drizzle)
  packages/types  Tipi condivisi Socket.io + API
```

- Realtime via Socket.io rooms: `restaurant:{id}` (staff), `table:{id}` (cliente).
- **Prezzi ordini sempre ricalcolati dal DB, mai dal client.**
- Multi-tenant: ogni entità scoped per `restaurantId`.
- PostgreSQL ascolta solo localhost; la dashboard blocca la porta da rete WiFi via firewall.
- AI: cliente su **Groq**; owner-assistant ancora su Anthropic (da allineare a Groq).

### Avvio locale
```bash
pnpm dev                                  # dalla root, avvia tutto
cd apps/server && node_modules/.bin/tsx src/index.ts   # solo server
cd apps/dashboard && pnpm dev             # solo dashboard
cd apps/web && pnpm dev                   # solo customer PWA
pnpm tako                                 # avvio unico (un processo, Postgres embedded)
```
Porte: server 3001, dashboard 3000 (servita anche da server su `/staff`), PWA 3002.
Prerequisiti: Node 20+, pnpm, Postgres (o `EMBEDDED_DB=1` per quello portatile).

---

## 3. ✅ Fatto

**Backend (`apps/server`)**
- Fastify + Socket.io + Drizzle/Postgres, **37/37 test integrazione live verdi**.
- Multi-tenant con isolamento per `restaurantId` verificato.
- Route complete: auth, restaurants, menus, tables, orders, bills, inventory, stats, customer,
  staff, insights, print, ai, uploads. `POST /api/orders` (comanda staff) incluso.
- Realtime Socket.io rooms. Prezzi sempre dal DB.
- Simulazione "ristorante pieno" (12 ordini concorrenti) verde: conti coerenti, isolamento, pagamento.

**Sicurezza (chiusa)**
- PIN bcrypt; JWT obbligatorio con startup assertion; IDOR su ordini/menu chiusi; MIME
  whitelist + magic-bytes su upload; Socket.io autenticato; leak cross-tenant in `POST /bills`
  chiuso; fallback PIN plaintext rimosso. Pentest 2026-05-07 e threat-model eseguiti (findings chiusi).

**Cliente PWA (`apps/web`)**
- Flusso completo: QR → tavolo → menu (dal DB) → ordine → tracking realtime, prezzi dal server.

**Dashboard staff (`apps/dashboard`)**
- UI definitiva = prototipo "Tako Dashboard" ricostruito **verbatim** come SPA in `public/staff/`,
  collegata al backend reale: login cookie, dati reali, realtime socket, azioni wirate su tutte
  le schermate (ordini, KDS, cassa, sala, comanda, menu, inventario, staff, tavoli, QR,
  impostazioni). Rimossi dati finti/toolbar prototipo.

**App nativa (`apps/app`)**
- Thin-client Expo (mobile) + Tauri (desktop) che carica `http://<server>:3000/staff`. Icona = logo Tako.

**Analytics**
- Peak hours (scansioni QR per ora), tasso conversione, tempo al primo ordine, menu engineering
  (Boston Matrix via Groq).

**Deploy desktop "scarica, apri, opera" (modello AIKE)**
- F0 un solo processo serve tutto (API+Socket+dashboard statica, CSP reale). F1 Postgres
  embedded automatico + migrazioni idempotenti. F2 shell Tauri spawna il server. F3a zero-config
  rete (mDNS `tako.local` + `/api/system/info` con QR). F3b.1 schermata "Collega dispositivi".
  F4 installer macOS (`Tako.app` + `Tako_0.1.0_aarch64.dmg`) verificato.

**Identità cloud + Sito web (LIVE — 2026-06-26)** — vedi §6 per dettaglio infra.
- Sito Tako con **login / registrazione / password dimenticata** collegato al control-plane cloud.
- Backend cloud live su `https://api.takoitalia.com`, sito su `https://takoitalia.com` + `www`.
- Email di verifica/reset via Resend (consegna confermata). Avatar a cerchio nel sito quando loggato.

---

## 4. 🟡 A metà / parziale

- **Owner-assistant AI** su Anthropic SDK (key assente → 503 graceful); l'AI cliente è su Groq e
  funziona. → **Allineare l'owner-assistant a Groq.**
- **Auth cookie HttpOnly (staff/appliance locale)**: progettata, `@fastify/cookie` installato.
  Da completare: set/clear cookie staff + logout, JWT tavolo al resolve QR + `requireTableSession`
  su waiter-call/ai-chat/orders, client `withCredentials`, stop localStorage dashboard.
- **Multi-tenant RLS in prod**: `withRestaurantContext()` definita; resta 1 task per attivarla in produzione.
- **Varianti piatto** (S/M/L): `itemVariants` in schema e mostrate in PWA, ma **manca endpoint/UI di scrittura** dalla dashboard.
- **Coordinate mappa sala** (`tables.posX/posY`): in schema, **senza endpoint di scrittura**.
- **`cloud-auth` su main**: il backend cloud gira dal branch `feat/cloud-auth-20260625` (Render);
  **non ancora mergiato su main** (è basato su `feat/fase1-consolidamento` → trascinerebbe fase1; decisione di Manuel).

---

## 5. ⛔ Da fare (roadmap / backlog)

> Coda operativa della routine autonoma: prendere il **primo task non completato** in ordine
> (P0 prima). Segnare `[x]` con data quando fatto.

### P0 — Sicurezza
- [ ] Completare auth cookie HttpOnly (set/clear staff + logout, JWT tavolo, `requireTableSession`).
- [ ] Customer session via QR token: `POST /api/customer/waiter-call` oggi unauthenticated → richiedere JWT tavolo (senza token → 401).
- [ ] Abilitare ContentSecurityPolicy nell'appliance locale (oggi `contentSecurityPolicy: false` in `apps/server/src/index.ts`).
- [ ] Rate limit AI chat per `tableId` (max 1 req/5s → 429 oltre).

### P0 — Pulizia / debito immediato
- [ ] Ripulire `apps/web/.env.local`: usa `NEXT_PUBLIC_SERVER_URL` (inutilizzata); il config legge `NEXT_PUBLIC_API_URL`.
- [ ] Endpoint di scrittura varianti piatto (sblocca UI varianti dashboard).
- [ ] Endpoint di scrittura `posX/posY` (sblocca mappa sala).

### P1 — Operatività solida
- [ ] Edit staff esistente (oggi solo add/delete).
- [ ] UI varianti piatto nel form "Nuovo piatto" (lista varianti + modificatore prezzo).
- [ ] Allergen filter lato cliente (chip multi-select nel menu PWA).
- [ ] Drag&drop riordino sezioni/piatti (dnd-kit installato; campo `position`).
- [ ] Upload immagine piatto diretto da file (riusa `/api/uploads`).
- [ ] Upload logo ristorante.
- [ ] Stampa comanda termica (escpos; settings IP/porta; stampa su conferma ordine).
- [ ] Allineare owner-assistant a Groq.
- [ ] Onboarding obbligatorio primo avvio (wizard SETUP come gate, tutorial per pagina).

### P1 — Analytics che fanno tornare il ristoratore
- [ ] Piatti top per fascia oraria (pranzo/aperitivo/cena).
- [ ] Stats settimana-su-settimana (badge +/- su ogni KPI).
- [ ] Tempo medio permanenza tavolo (da `openedAt` a chiusura conto).
- [ ] Export CSV statistiche (`GET /api/stats/export?from=&to=`).
- [ ] Report settimanale via email (nodemailer, configurabile).

### P2 — Differenziatori operativi
- [ ] Assegnazione cameriere a tavolo (`tables.assignedWaiterId` già in schema).
- [ ] Scarico magazzino automatico da ordini (tabella `menu_item_ingredients`).
- [ ] Prenotazioni semplici (form pubblico `/prenota/:slug`, sezione dashboard).
- [ ] Pianta sala visuale drag&drop (usa `posX/posY`).
- [ ] **AI agentico completo** (il "cuore", vedi visione sotto).

### P2 — Backlog tecnico
- [ ] Pagination ordini (chunk 50, scroll infinito).
- [ ] Error handling globale server (JSON strutturato su tutte le route).
- [ ] Test coverage server > 70% (Vitest).
- [ ] Multi-tenant RLS completo su ogni route autenticata.
- [ ] Mobile responsive dashboard (iPad Mini < 768px).

### Deploy / packaging residui
- [ ] **F4.2** Firma + notarizzazione Apple + target Windows (`.exe`) / Linux (`.AppImage`) in CI (oggi macOS non firmata).
- [ ] **F-web** Servire la PWA cliente dal Fastify (togliere il processo Next `:3002`).
- [ ] Merge su main di `feat/cloud-auth-20260625` (+ sorte di `feat/fase1-consolidamento`) — solo Manuel.
- [ ] Test browser end-to-end del sito: click link verifica email → login → OAuth Google/GitHub.

### Visione AI agentico (design di riferimento, ex PIANO-PERFEZIONE)
Un solo "cervello" AI, due personalità con permessi diversi: **assistente cliente** (consiglia,
prende l'ordine, chiama il cameriere — tool sul proprio tavolo) e **copilot owner** (Cmd+K,
operazioni complete su menu/statistiche/staff). Principio: i **tool riusano la logica delle route
esistenti** (niente logica duplicata). Modello di permessi per rendere sicuro "fare qualsiasi
cosa": scope per ruolo + guardrail su azioni mutanti. Provider: Claude primario, Groq fallback.

### Esplicitamente FUORI SCOPE (decisione attiva)
Pagamenti digitali/Stripe, registratore telematico (RT), corrispettivi Agenzia Entrate, fattura
elettronica SDI, WhatsApp/SMS, login/account **cliente**. (Il PIANO-PERFEZIONE proponeva di
rimettere in scope fisco e pagamenti come "must": restano **fuori scope** finché Manuel non decide.)

---

## 6. Deploy cloud — Sito web + identità (LIVE)

**Obiettivo raggiunto:** sito Tako con login/registrazione/password-dimenticata, credenziali
collegate all'app (account cloud → pairing appliance).

| Pezzo | Dove | Stato |
|---|---|---|
| Backend control-plane | Render, servizio `tako-cloud` (`tako-cloud-09gq.onrender.com`), branch `feat/cloud-auth-20260625`, autoDeploy OFF | `https://api.takoitalia.com/health` → 200 |
| Sito (landing + auth) | Cloudflare Pages project `tako` (`tako-cya.pages.dev`), production branch `main`, root_dir `landing`, auto-deploy ON | `https://takoitalia.com` + `https://www.takoitalia.com` |
| DB | Supabase `tako-cloud` (EU), Session pooler **porta 5432** | login→401 / register→200 |
| Rate-limit/lockout | Upstash Redis (EU) | ok |
| Email | Resend (dominio `takoitalia.com` verificato) | verifica/reset **consegnate** |
| OAuth | Google + GitHub, callback `https://api.takoitalia.com/api/auth/{google,github}/callback` | configurato |

- **Cookie mode** `samesite` (api è sottodominio del sito) → CSRF no-op. CORS allowlist = apex+www.
- **DNS** (Cloudflare, zona pulita): `api`→onrender (dns-only), apex+`www`→pages (proxy), `send`
  MX+SPF + `resend._domainkey` DKIM (Resend).
- **Codice cloud**: branch `feat/cloud-auth-20260625` (DB schema cloud + `apps/server/src/cloud/*`
  + `routes/cloud/*`, appliance sync via `lib/cloud-client.ts`/`routes/setup.ts`, test
  `pnpm --filter @tako/server test:cloud` 67/67). Sito: branch `feat/site-auth-20260625`
  (`landing/tako-api.js`, LoginModal/SignupForm, `reset-password.html`/`verify-email.html`) →
  **mergiato su `main`** (FF).
- **4 fix Dockerfile.cloud** per il boot su Render: `pnpm install --prod=false` (tsx), copia
  `packages/db/node_modules` (drizzle-orm), `mkdir+chown uploads/` per utente node, PORT da env.
- **Credenziali/segreti**: NON in repo. File utente in `~/Desktop/Tako-Credenziali/`
  (`tako-credenziali.txt`, `tako-render-incolla.txt`). Su Render: `SESSION_SECRET`/`TOKEN_PEPPER`
  generati, 7 segreti `sync:false` (incl. `CLOUD_DATABASE_URL` Supabase 5432).
- **Modo `local`** (appliance esistente) invariato.

---

## 7. 📌 Decisioni vincolanti

- **Niente pagamenti digitali** nel sistema (e niente RT/corrispettivi/SDI) — fuori scope.
- **Prezzi sempre dal DB**, mai dal client.
- **Core POS 100% locale**, funziona senza internet; solo AI + identità cloud richiedono rete.
- **AI cliente su Groq**; owner-assistant da allineare a Groq.
- **Dashboard = prototipo "Tako Dashboard" verbatim**, wirato al backend reale, servito da `/staff`.
- **App nativa = thin client** che carica `/staff` (nessuna logica duplicata).
- **Multi-tenant**: ogni entità scoped per `restaurantId`.
- **Identità cloud**: control-plane proprietario (no vendor) — Render + Supabase + Cloudflare + Resend + Upstash.
- **Merge su main: solo Manuel.**

---

## 8. Riferimenti operativi (NON documentazione — non eliminare)

- `CLAUDE.md` — istruzioni progetto + routine autonoma.
- `.claude/CLAUDE.md` — contratto madre del team di agenti.
- `.claude/agents/*.md` — definizioni dei sottoagenti (system prompt). **Funzionali.**
- `.claude/comms/` — bus a file: `TASK_LEDGER.json`, `contracts/*.contract.md`, `AGENT-LOG.md` (log sessione).
- `.claude/MASTER_PLAN.md` — usato dall'architect in [MASTER] mode.
- `apps/app/CLAUDE.md`, `apps/app/AGENTS.md` — istruzioni dell'app nativa.
