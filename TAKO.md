# TAKO — File unico di progetto

> **Unica fonte di verità** per cos'è Tako, cosa è stato fatto e cosa resta da fare.
> Root del progetto: 3 soli documenti — `TAKO.md` (questo), `manu.md` (azioni di Manuel),
> `CLAUDE.md` (regole repo/agenti). I vecchi `PLAN-*.md` sono consolidati qui in §6.
> Ultimo aggiornamento: **2026-07-10** (lint completo verificato sul codice).

---

## 1. Cos'è

Tako = **sistema operativo del ristorante**. Gira **in locale** su un mini PC/Mac nel locale. Lo
staff usa la dashboard su tablet; i clienti scansionano il QR del tavolo e ordinano dal telefono
senza installare nulla. Il core POS funziona **senza internet**; solo AI e identità cloud
richiedono rete.

**Obiettivo:** sistema indispensabile — il ristoratore non torna a carta e penna. Ordini diretti
in cucina, cliente ordina da solo, zero errori, statistiche utili. Tako non sostituisce
l'ospitalità — la potenzia.

**Chi usa:** owner (gestione completa + copilot AI), cameriere (sala/ordini), cuoco (KDS),
cassiere (cassa/conti), cliente (PWA da QR).

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
- AI (cliente + copilot owner) su **Groq**; dettatura vocale whisper.cpp locale ⇄ Groq.

### Avvio locale
```bash
pnpm dev                                  # dalla root, avvia tutto
pnpm tako                                 # avvio unico (un processo, Postgres embedded)
cd apps/server && node_modules/.bin/tsx src/index.ts   # solo server
```
Porte: server 3001, dashboard 3000 (anche da server su `/staff`), PWA 3002.
Test integrazione: stack vivo (`EMBEDDED_DB=1 PGPORT=5432 PORT=3001`) + `npx vitest run` — a freddo falliscono tutti, non è una regressione.
App desktop: build+deploy in place con `sh scripts/deploy-desktop.sh` (mai eliminare/rimettere `/Applications/Tako.app`).

---

## 3. ✅ Fatto (verificato sul codice, lint 2026-07-10)

**Backend** — Fastify+Socket.io+Drizzle, 37/37 test integrazione verdi (al 2026-07-02). Route
complete: auth, restaurants, menus, tables, orders, bills, inventory, stats, customer, staff,
shifts, reservations, insights, print, ai, ai-owner, uploads. Error handler globale JSON
strutturato (`index.ts:74`). Simulazione "ristorante pieno" verde.

**Sicurezza (chiusa)** — PIN bcrypt, JWT startup assertion, cookie HttpOnly staff+tavolo,
`requireTableSession` su route customer, CSP reale, rate-limit AI per tavolo, IDOR/leak
cross-tenant chiusi, magic-bytes upload. Pentest 2026-05-07 findings chiusi. Revisione
pre-vendita 2026-07-02 (`fd7ba39`): race soldi, privilegi copilot, concorrenza.

**Dashboard staff** — prototipo "Tako Dashboard" verbatim come SPA (`public/staff/`), wirata al
backend reale su tutte le schermate. Edit staff esistente (PATCH `staff.ts:44` + modale). UI
varianti piatto nel DishEditor (`06-screens-gestione.js:325`). Upload immagine piatto da file
(`06-screens-gestione.js:246`). Responsive mobile (breakpoint 900, `07-app-root.js:121`).
Sala 2D: tavoli illustrati, forme, drag, vassoio "Da posizionare" (`8a35176`…`ff26249`).

**AI agentico** — copilot owner Cmd+K con 42 tool (`lib/ai-actions.ts`), anti-confabulazione,
card conferma per mutation; AI cliente con azioni (ordina/chiama/conto). Tutto su Groq.

**Cliente PWA** — QR → menu → ordine → tracking realtime; filtro allergeni (`MenuView.tsx:223`).

**Prenotazioni** — `routes/reservations.ts` + test + tool AI (2026-07-02).

**Stampa termica** — ESC/POS `lib/escpos.ts` + `routes/print.ts` (codice fatto; test su
stampante fisica in campo mancante).

**App desktop** (modello AIKE) — un processo serve tutto, Postgres embedded, shell Tauri, mDNS
`tako.local` + QR onboarding, installer macOS. Finestra trascinabile (fix capability `11ded80`).

**Cloud + sito (LIVE dal 2026-06-26)** — vedi §7.

### ⚠️ Fatto ma NON ancora committato (working tree, ~2.100 righe — verificato 2026-07-10)
1. **Dettatura vocale → whisper.cpp**: `lib/asr-whisper.ts` (daemon HTTP :8766, modelli in
   `~/.tako/models`), sostituisce mlx-whisper; fallback Groq invariato; test aggiornati
   (`tests/dictation.test.ts`). Binario `asr/whisper/whisper-server` NON va in git (ignorato).
2. **WhatsApp ↔ copilot owner**: `lib/whatsapp.ts` + `routes/whatsapp.ts` (Baileys, whitelist
   numeri, mutation solo con "SÌ", OFF di default, auth in `~/.tako/whatsapp-auth`); pannello
   QR owner-only in `06-screens-gestione.js`.
3. **owner-prompt condiviso**: `lib/owner-prompt.ts` — stesso system prompt per dashboard e WhatsApp.
4. **Copilot streaming SSE**: `POST /api/ai/owner/chat/stream` + UI a rendering incrementale
   (`11-copilot.js`), fallback non-streaming. Nessun test sul percorso streaming.
5. **UI Cowork/setup**: Confetti, CoworkCard, SetupSlot (`04-screens-operative.js`).

→ Da committare in 5 commit atomici (feature per feature). I binari/artifact restano fuori
(gitignore sistemati il 2026-07-10).

---

## 4. ⛔ Aperto (lint 2026-07-10 — ogni voce verificata sul codice)

### Debito immediato
- [ ] `apps/web/.env.local`: contiene `NEXT_PUBLIC_SERVER_URL` inutilizzata (il config legge `NEXT_PUBLIC_API_URL`, `next.config.ts:13`).
- [ ] Committare il lavoro pendente (§3, 5 commit atomici).

### Sicurezza / robustezza
- [ ] **RLS runtime**: `withRestaurantContext()` (`packages/db/src/rls.ts:28`) ha ZERO chiamanti — isolamento tenant solo applicativo. Piano pronto: §6-A.
- [ ] Test sul percorso streaming SSE del copilot (`runAssistantStream`).
- [ ] Test coverage server >70%.

### Operatività (P1)
- [ ] Upload logo ristorante: card "Logo" è placeholder statico (`06-screens-gestione.js:948`); `logoUrl` in schema ma non cablato.
- [ ] Drag&drop riordino sezioni/piatti: `position` gestito dal server (`menu.ts:56`), dnd-kit installato ma MAI usato nella SPA (dep inutilizzata).
- [ ] Onboarding obbligatorio primo avvio: oggi checklist non bloccante (`04-screens-operative.js:134`), manca il gate.

### Analytics (P1 — nessuna delle 5 iniziata)
- [ ] Piatti top per fascia oraria (oggi solo `scansPerHour`, `stats.ts:112`).
- [ ] Confronto settimana-su-settimana (badge +/- sui KPI).
- [ ] Tempo medio permanenza tavolo (oggi solo tempo al primo ordine, `stats.ts:108`).
- [ ] Export CSV statistiche (`GET /api/stats/export?from=&to=`).
- [ ] Report settimanale email (nodemailer assente dal progetto).

### Differenziatori (P2)
- [ ] Assegnazione cameriere a tavolo (`assignedWaiterId` solo in schema, zero usi).
- [ ] Scarico magazzino automatico (tabella `menu_item_ingredients` NON esiste in schema).
- [ ] Pagination ordini (`/active` e `/history` senza limit/offset, `orders.ts:30,58`).
- [ ] Icone 3D clay (33 asset, prompt pronti) — piano §6-D.

### Packaging / deploy
- [ ] **F-web**: PWA cliente ancora su processo Next `:3002` separato (Fastify serve solo `/staff`, `index.ts:157`).
- [ ] Firma + notarizzazione macOS + target Windows/Linux in CI (nessun workflow esiste).
- [ ] QR tavolo stabili via cloud: codati ma NON live — piano §6-B.
- [ ] Igiene repo: push, branch morti, dossier merge — piano §6-C.
- [ ] Merge `feat/cloud-auth-20260625` → main: **decisione di Manuel** (vedi manu.md).

### Fuori scope (decisione attiva — NON sono gap)
Pagamenti digitali/Stripe, RT/corrispettivi/SDI, WhatsApp/SMS marketing, login account cliente.

---

## 5. 🗺️ Prossimo giro consigliato (ordine)

1. Commit del pendente (5 atomici) → tree pulito.
2. `.env.local` cleanup (1 min, stesso giro).
3. **RLS runtime** (§6-A) — ultimo buco sicurezza pre-vendita.
4. Igiene repo (§6-C) — push (il canonico di produzione esiste solo su questo Mac!).
5. Poi a scelta: QR cloud live (§6-B), icone 3D (§6-D), analytics P1.

---

## 6. 📋 Piani pronti (ex PLAN-*.md, consolidati 2026-07-10)

### 6-A. RLS multi-tenant a runtime (leverage 2/5)
**Goal:** ogni query autenticata dentro `withRestaurantContext(restaurantId, fn)` → RLS Postgres
come seconda barriera. In prod ruolo NON-superuser `tako_app`; in dev/embedded resta superuser
`tako` (RLS bypassata, invariato).
- Già pronti: helper `packages/db/src/rls.ts` (transazione + `SET LOCAL`), policy+ruolo in
  `migrations/0002_add_rls.sql`, verifica `packages/db/rls-check.mjs`, env prod documentata.
- **Ordine route:** orders → bills → customer (restaurantId dalla SESSIONE tavolo, mai da
  params) → menu/menu-i18n → tables/staff/shifts/reservations/inventory/stats/insights/uploads
  → `lib/ai-actions.ts` (wrappare nel dispatcher, non nei 42 tool) → `lib/billing.ts` (firma con
  `tx` opzionale) → `socket/handlers.ts`. Un route-file per commit, tsc + test ad ogni giro.
- Handler multi-query → UNA `withRestaurantContext` intorno a tutto (atomicità).
- **Trappole:** `SET LOCAL` fuori transazione = no-op silenzioso; query col `db` globale dentro
  il callback girano su ALTRA connessione senza contesto (usare SOLO `tx`); test verdi ≠ RLS
  attiva (girano da superuser) — il check vero è `rls-check.mjs` con `tako_app`; l'embedded
  single-tenant resta superuser BY DESIGN (non "sistemarlo"); niente `withRestaurantContext`
  annidati (convenzione).
- **Done:** tutti i route-file tenant wrappati (grep) · tsc pulito · test verdi · `rls-check.mjs`
  PASS · `tako_app` senza SET LOCAL → 0 righe · nessun `db` globale nei callback.
- Prod (Manuel): password reale `ALTER ROLE tako_app` + `DATABASE_URL` col ruolo `tako_app`.
  Riguarda il Postgres dell'appliance, NON Supabase.

### 6-B. QR tavolo stabili via cloud → LIVE (leverage 1/5)
**Goal:** QR stampato = `https://api.takoitalia.com/t/<applianceId>/…` → resolver cloud
reindirizza all'IP LAN corrente (heartbeat). QR valido per sempre.
- Feature GIÀ CODATA (commit `018d94b` su `feat/cloud-auth-20260625`): resolver
  `routes/cloud/resolve.ts` (redirect solo verso RFC1918/`*.local`), heartbeat
  `lib/cloud-client.ts:318`, base URL `lib/network.ts:75`.
- **Trappola 1 (bloccante):** su Supabase prod mancano le colonne `lan_ip`/`client_port`/`lan_host`
  di `cloud_appliances` — serve migrazione `0001_add_appliance_lan.sql` (schema TS le ha, la
  0000 no). Generarla con drizzle-kit e applicarla (URL in `~/Desktop/Tako-Credenziali/`).
- **Trappola 2:** l'appliance shippata (branch fase1) NON ha il codice QR-cloud — il deploy cloud
  da solo non basta; serve port/merge appliance-side (decisione Manuel).
- **Trappola 3:** Render autoDeploy OFF e pesca da GitHub → prima PUSH del branch, poi Manual
  Deploy (senza push builda un commit vecchio).
- **Done:** `\d cloud_appliances` mostra le 3 colonne · heartbeat pubblica LAN · QR via resolver
  raggiunge il menu da telefono su WiFi del locale.

### 6-C. Igiene repo: push, branch, merge dossier (leverage 4/5)
**Rischio silenzioso:** i commit di produzione NON sono pushati — lo stato canonico del backend
live (Render) esiste solo su questo Mac.
1. **Push subito** (nessuna decisione): `fase1-consolidamento` da `~/Projects/Tako`,
   `cloud-auth-20260625` da `~/Projects/Tako-cloud-auth`. Push non triggera deploy (autoDeploy
   OFF; Pages segue solo main). `.env` gitignorati, mai `git add -f`.
2. **Branch morti** (0 commit unici): `git branch -d fix/stats-top-items-query
   perf/orders-parallel-queries feat/site-auth-20260625` — `-d` non `-D`; se rifiuta, fermarsi.
   NB: `site-auth` è checked-out nel worktree `Tako-site-auth` → prima `git worktree remove`
   (con ok di Manuel) o saltarlo.
3. **Branch con 1-2 commit unici** (`feat/customer-pwa-realtime`, `docs/readme-setup`, vari
   `fix/*`): tabella branch→contenuto→proposta, sottoporre a Manuel. Non cancellare senza risposta.
4. **Dossier merge cloud-auth→main** (`git merge-tree …`): documentare conflitti attesi; proposta
   consigliata = prima fase1→main (linea di prodotto reale), poi cloud-auth diventa merge piccolo.
   **Il merge NON si esegue: solo Manuel.**
5. `Tako-cloud-auth/apps/server/deploy/GUIDA-MANUALE-PASSO-PASSO.md` (Fly/Neon, superata):
   bannerizzare `⛔ SUPERATA — deploy reale Render+Supabase (§7)` o cancellare su ok.
6. (Bassa) audit 31 `catch {` compatti: correggere solo quelli che inghiottono errori veri.

### 6-D. Icone 3D clay — dashboard + PWA (leverage 3/5)
**Goal:** 33 PNG 3D clay (tavoli, nav, cassa/KPI, Boston Matrix, PWA) con fallback SVG, senza
rompere il multi-brand.
- Prompt GIÀ SCRITTI verbatim in `~/Documents/brain/wiki/tako-audit-prevendita-2026-07-02.md`
  (sezione "Icone 3D"), generazione con Nano Banana Pro.
- Cartelle: `apps/dashboard/public/staff/assets/icons3d/` + `apps/web/public/icons3d/`.
  Export 128px nav · 256px chip/BCG · 512px tavoli (i 1024 originali fuori da `public/`).
- Componente `Icon3D({name,size})` in `02-kit.js` con `onError` → fallback alle SVG esistenti
  (righe 5-44: NON cancellarle). Tavolo sala: `<img>` dentro il button esistente (mantenere
  drag), stato = ring `box-shadow` CSS (variabili `styles.css:421-451`).
- **Trappole:** icone NEUTRE crema/marrone (il brand cambia su 5 palette — non colorarle);
  UN asset per forma + ring CSS, NON 18 varianti stato×forma; mascotte `assets/takos/` non si
  rigenerano; `resources/server/staff/` è output di build (sempre via
  `build-server-bundle.mjs`); niente ombra a terra (sfasa le nav); `width/height` espliciti
  (no CLS); precache in `sw.js`.
- **Done:** 33 PNG alpha nelle 2 cartelle · dashboard+PWA integrate · rinomini un PNG → appare
  l'SVG · leggibili su tutte e 5 le palette · bundle Tauri rigenerato.

---

## 7. ☁️ Cloud — sito + identità (LIVE dal 2026-06-26)

| Pezzo | Dove | Stato |
|---|---|---|
| Backend control-plane | Render `tako-cloud` (`tako-cloud-09gq.onrender.com`), branch `feat/cloud-auth-20260625`, autoDeploy OFF | `api.takoitalia.com/health` → 200 |
| Sito (landing + auth) | Cloudflare Pages `tako`, production branch `main`, root `landing/` | `takoitalia.com` + www |
| DB cloud | Supabase `tako-cloud` (EU), session pooler :5432 | ok |
| Rate-limit/lockout | Upstash Redis (EU) | ok |
| Email verifica/reset | Resend (dominio verificato) | consegnate |
| OAuth | Google + GitHub, callback su `api.takoitalia.com` | configurato |

- Login/registrazione/reset sul sito; email via Resend; pairing appliance↔cloud device-code +
  PoP ed25519 (codato, su branch cloud-auth). Test cloud 67/67 verdi.
- Auth proprietaria (no vendor lock): Supabase è SOLO il DB. Cookie `samesite` (api è
  sottodominio), CORS allowlist apex+www.
- La dashboard staff resta a login LOCALE (email+password nel Postgres del locale, PIN staff):
  login cloud + email per utenti dashboard = task futuro, dipende dal pairing/merge cloud-auth.
- Worktree: sito → `~/Projects/Tako-site-auth/landing/` · cloud → `~/Projects/Tako-cloud-auth/`
  · appliance → `~/Projects/Tako/` (qui NON c'è `landing/`).
- Segreti: MAI nel repo. File utente in `~/Desktop/Tako-Credenziali/`.

---

## 8. 📌 Decisioni vincolanti

- **Niente pagamenti digitali** (né RT/corrispettivi/SDI) — fuori scope.
- **Prezzi sempre dal DB**, mai dal client.
- **Core POS 100% locale**; solo AI + identità cloud richiedono rete.
- **AI su Groq** (cliente + copilot owner).
- **Dashboard = prototipo verbatim** wirato al backend, servito da `/staff`.
- **App nativa = thin client** che carica `/staff`.
- **Multi-tenant**: ogni entità scoped per `restaurantId`.
- **Identità cloud proprietaria**: Render + Supabase + Cloudflare + Resend + Upstash.
- **Merge su main: solo Manuel.**
- Commit atomici in italiano.

---

## 9. Riferimenti operativi (NON documentazione — non eliminare)

- `CLAUDE.md` — istruzioni progetto + routine autonoma.
- `.claude/CLAUDE.md` + `.claude/agents/*` + `.claude/comms/` — team di agenti (funzionali).
- `apps/app/CLAUDE.md`, `apps/app/AGENTS.md` — istruzioni app nativa.
- `scripts/deploy-desktop.sh` — build+deploy app desktop in place.
- `scripts/build-server-bundle.mjs` — bundle server autosufficiente per Tauri.
- Dati demo: Test Pizza (`#ED7159`) · Trattoria da Nino (`#5963ee`) · URL cliente
  `http://localhost:3002/r/{restaurantId}/t/{qr_token}`.
