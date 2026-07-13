# Tako — Riferimento tecnico interno

> Documento di riferimento per Manuel (creatore di Tako). Descrive com'è fatto e come
> funziona tutto il sistema, basato sul codice reale del monorepo `/Users/manuel/Projects/tako`.
> Ogni riferimento `file:riga` punta al sorgente. Aggiornato: 2026-07-12.

---

## Indice

1. [Architettura generale](#1-architettura-generale)
2. [Modello dati (packages/db)](#2-modello-dati-packagesdb)
3. [Backend e route (apps/server)](#3-backend-e-route-appsserver)
4. [Copilota AI (lib/ai-actions.ts)](#4-copilota-ai-libai-actionsts)
5. [Foto piatti AI (lib/dish-image-ai.ts)](#5-foto-piatti-ai-libdish-image-aits)
6. [WhatsApp (lib/whatsapp.ts)](#6-whatsapp-libwhatsappts)
7. [Resilienza rete](#7-resilienza-rete)
8. [Inventario](#8-inventario)
9. [Deploy e build](#9-deploy-e-build)
10. [Settings e feature-flag](#10-settings-e-feature-flag)

---

## 1. Architettura generale

Tako è un **appliance locale**: un Mac in sala fa girare tutto (server, DB, PWA cliente,
dashboard staff) e serve i dispositivi sulla LAN. Il cloud è opzionale (control-plane per
pairing/resolver QR/verifica email). Filosofia: **LAN-first / offline-first** — il core
(ordini, conti, menu, cucina, staff, realtime) non dipende mai da internet.

### Struttura del monorepo (pnpm + turbo)

```
tako/
├── apps/
│   ├── server/       Backend Fastify + Drizzle + Socket.io (porta 4317)
│   ├── web/          PWA cliente Next.js (menu al tavolo/asporto via QR, porta 3002)
│   ├── dashboard/    Dashboard staff — build statica SPA in public/staff (Babel-in-browser)
│   └── app/          Shell desktop Tauri 2 (Rust) che impacchetta e avvia tutto
├── packages/
│   ├── db/           Schema Drizzle, embedded Postgres, migrazioni, RLS
│   ├── types/        Tipi condivisi (@tako/types)
│   └── ui/           (placeholder)
├── scripts/          build-server-bundle.mjs, deploy-desktop.sh, make-latest-json.mjs, tako-pro-code.mjs …
└── docs/
```

Workspace: `pnpm-workspace.yaml` + `package.json` (`workspaces: apps/*, packages/*`),
build orchestrata da `turbo`.

### I quattro processi e come si avviano

L'app desktop Tauri è il "supervisore". `apps/app/src-tauri/src/lib.rs` all'apertura della
finestra avvia **due processi figli Node** e li termina alla chiusura (nessun daemon: vivono
quanto la finestra).

- **Server API** (`spawn_server`, `lib.rs:28-90`): porta **4317** (`TAKO_PORT`, `lib.rs:19`).
  In dev usa `TAKO_SERVER_CMD` (`tsx src/bootstrap.ts`); in bundle esegue il `node`
  impacchettato su `resources/server/server.mjs`. Env iniettati: `EMBEDDED_DB=1`, `PORT=4317`,
  `NODE_ENV=production`, `TAKO_HOME`/`PGDATA_DIR`/`UPLOADS_DIR` in app-data utente
  (`lib.rs:67-78`). Serve API `/api/*`, Socket.io e la dashboard staff su `/staff/`.
- **Web cliente** (`spawn_web`, `lib.rs:95-133`): Next standalone sulla porta **3002**
  (`WEB_PORT`, `lib.rs:23`), `HOSTNAME=0.0.0.0`, `NEXT_PUBLIC_API_URL=http://127.0.0.1:4317`.
  Solo in modalità bundle (in dev il web parte con `pnpm dev`). I telefoni aprono il menu via
  QR sulla LAN (`http://<IP-Mac>:3002/r/.../t/...`).

Dettagli robustezza processi in `lib.rs`:
- **Single-instance** (`lib.rs:185-191`): plugin `tauri_plugin_single_instance` come PRIMO
  plugin. Una seconda istanza esce subito (evita un 2º Postgres sullo stesso `pgdata` → corruzione)
  e riporta in primo piano la finestra esistente.
- **Process group** (`lib.rs:61-65`, `220-246`): i figli girano in un gruppo dedicato; alla
  chiusura invia `SIGTERM` all'INTERO gruppo (`kill(-pid, ...)`) così node **e il Postgres che
  ha generato** muoiono insieme (niente Postgres orfani che bloccano la data dir). Su Windows:
  `taskkill /F /T` sull'albero.
- **Auto-update** (`spawn_update_check`, `lib.rs:139-177`): all'avvio, in background.

L'entry del server è `apps/server/src/bootstrap.ts`:
1. `reclaimOrphanServer` (`bootstrap.ts:23-42`): killa un node orfano del run precedente
   (pidfile `TAKO_HOME/server.pid`) per liberare `:4317` dopo un crash della shell.
2. Auto-provisioning **`JWT_SECRET`** persistente in `TAKO_HOME/jwt-secret` (`bootstrap.ts:47-58`)
   e **`GROQ_API_KEY`** da `TAKO_HOME/groq-key` (`bootstrap.ts:63-71`).
3. `maybeStartEmbeddedDb()` (`bootstrap.ts:77`) → poi `startServer()` (`bootstrap.ts:78`).

### Embedded Postgres

`packages/db/src/embedded.ts` avvia un Postgres portatile in-process (`embedded-postgres`),
attivo solo con `EMBEDDED_DB=1` (`embedded.ts:103`):
- Porta **54317** (`PGPORT`), user/pass `tako`/`tako`, db `takodb`, data dir `~/.tako/pgdata`
  (`PGDATA_DIR`, fuori dal repo → sopravvive agli update). `embedded.ts:108-113`.
- `healStaleLock` (`embedded.ts:29-57`): rimuove un `postmaster.pid` orfano da crash (verifica
  PID vivo E che sia davvero postgres, difesa da PID-reuse; ramo Windows via `tasklist`).
- Backup a copia fredda di `pgdata` prima dell'avvio (`embedded.ts:69-95`, ruota gli ultimi 5,
  env `TAKO_DB_KEEP_BACKUPS`, disattivabile `TAKO_DB_BACKUP=0`).
- Imposta `DATABASE_URL=postgresql://tako:tako@127.0.0.1:54317/takodb` e applica le
  **migrazioni Drizzle** all'avvio (`migrate(...)`, `embedded.ts:162-174`, cartella
  `resources/server/migrations` nel bundle).

### Dashboard staff — SPA "Babel-in-browser"

`apps/dashboard` è un progetto Next, ma ciò che viene realmente servito è la **SPA statica** in
`apps/dashboard/public/staff/` (copiata nel bundle e servita dal server API su `/staff/`, vedi
`index.ts:170-183`). `staff/index.html` carica React, ReactDOM e **Babel standalone** via
`<script src="lib/*.js">` e compila in-browser i moduli `<script type="text/babel">`
(`01-data.js` … `12-pin-login.js`, `07-app-root.js`). Ha un boot-screen con watchdog che mostra
una diagnosi invece del muro bianco se il server non risponde. Nessun build step Next in
produzione per lo staff: è HTML+JS statico same-origin (niente reverse-proxy).

### PWA cliente — Next standalone

`apps/web` (`@tako/web`): Next 15, `output: 'standalone'` (`next.config.ts`), dev su
`-p 3002 -H 0.0.0.0`. Rewrites (`next.config.ts`): `/api/*`, `/uploads/*` e `/socket.io/*`
inoltrati al server API (`NEXT_PUBLIC_API_URL`), così il cliente è same-origin ed evita CORS.

---

## 2. Modello dati (packages/db)

Package `@tako/db` (Drizzle ORM su `postgres-js`). Due schemi separati:
- **Locale** `schema/*.ts` — dati operativi del ristorante (Postgres embedded), export in
  `schema/index.ts`.
- **Cloud** `schema/cloud/*.ts` — control-plane identità/pairing (tabelle `cloud_*`), NON
  esportato dallo schema locale, usato solo in `TAKO_MODE=cloud`.

Tipo custom **`money`** (`schema/money.ts:6`): in DB `numeric(10,2)` (centesimi esatti), in JS
`number`. Usato da tutti gli importi. Le quantità di magazzino usano invece `real` (float).

### Tabelle locali principali

| Tabella | File | FK / relazioni chiave |
|---|---|---|
| `restaurants` | `restaurants.ts:3` | radice = tenant; `slug` unique; `settings` jsonb (`RestaurantSettings`); `plan` free/pro/enterprise |
| `users` | `users.ts:4` | → `restaurants.id` CASCADE; `email` unique; `role` owner/dipendente/chef/cassiere; `cloudOwnerId`, `localOwnerSecretHash`, `credentialsVersion` |
| `sessions` | `users.ts:29` | → `users.id` CASCADE; `token` unique; `expiresAt` |
| `menus` | `menu.ts:5` | → `restaurants.id` CASCADE; `type` main/lunch/dinner/seasonal/event/drinks |
| `menuSections` | `menu.ts:17` | → `menus.id` CASCADE; `nameTranslations` jsonb |
| `menuItems` | `menu.ts:27` | → `menuSections.id` CASCADE, → `restaurants.id`; `price`/`costPrice` money; `available`, `featured`, `allergens[]`, `tags[]`, `kitchenStation`; idx (restaurantId, available) |
| `itemVariants` | `menu.ts:52` | → `menuItems.id` CASCADE; `priceModifier` money |
| `menuItemTranslations` | `menu-item-translations.ts:5` | → items+restaurants CASCADE; unique (itemId, lang) |
| `rooms` | `tables.ts:5` | → `restaurants.id` CASCADE |
| `tables` | `tables.ts:13` | → restaurants CASCADE, → rooms, → users(waiter); `qrToken` unique; `status` free/occupied/waiting/cleaning/reserved; `posX/posY` (mappa sala); unique (restaurantId, number) |
| `orders` | `orders.ts:9` | → restaurants, tables, bills, users; `type` table/takeaway; `takeawaySessionId`, `billId`; `status` pending→…→paid/cancelled; `idempotencyKey` unique; 3 indici (status/createdAt/table) |
| `orderItems` | `orders.ts:40` | → orders CASCADE; `menuItemId` **nullable** (righe custom); `variantId`; `status`; idx (orderId) |
| `orderStatusHistory` | `orders.ts:59` | → orders CASCADE, → users(changedBy) |
| `bills` | `bills.ts:7` | → restaurants, tables, users(closedBy); `subtotal/discount/tip/total` money; `covers`; `status` open/closed/refunded; 3 indici |
| `billPayments` | `bills.ts:28` | → bills; `method` cash/card/digital/split; `stripePaymentIntentId`; `status` |
| `inventoryItems` | `inventory.ts:6` | → restaurants CASCADE; `quantity/minQuantity/parLevel` real; `costPerUnit` money; `supplier`; `active` (soft delete) |
| `inventoryMovements` | `inventory.ts:21` | → inventoryItems, → users; `type` load/unload/adjustment/waste; `orderId` (riferimento debole, no FK) |
| `tableSessions` | `sessions.ts:5` | → restaurants CASCADE, → tables SET NULL; analytics scan→primo ordine (`timeToFirstOrderSec`) |
| `reservations` | `reservations.ts:5` | → restaurants CASCADE, → tables SET NULL; `status` requested/confirmed/seated/no_show/cancelled; `durationMin` default 90; indici (startsAt) |
| `staffShifts` | `staff-shifts.ts:5` | → restaurants+users CASCADE; `endsAt` null = turno aperto |
| `loyaltyAccounts` | `loyalty.ts:7` | → restaurants CASCADE; unique (restaurantId, phone); `points` |
| `recipes` | `recipes.ts:10` | → restaurants+menuItems+inventoryItems CASCADE; `quantity` real; unique (menuItemId, inventoryItemId) |

`RestaurantSettings` (tipo TS, `restaurants.ts:21-49`) è il contenitore di tutti i feature-flag
(vedi §10).

### Client, RLS, cloud

- **`client.ts`**: client Drizzle **lazy** (connessione alla prima query, non all'import — così
  le route si importano prima che il Postgres embedded sia pronto). `db` è un Proxy trasparente.
- **`rls.ts`**: `withRestaurantContext(restaurantId, fn)` (`rls.ts:28`) apre una transazione e fa
  `SET LOCAL app.current_restaurant_id = <id>`. Le policy vivono in `0002_add_rls.sql` (16 tabelle
  tenant-scoped + ruolo non-superuser `tako_app`). Attenzione: le tabelle aggiunte dopo la 0002
  (reservations, table_sessions, staff_shifts, menu_item_translations, loyalty_accounts, recipes)
  NON hanno ancora policy RLS.
- **Schema cloud** (`schema/cloud/`): `cloudOwners` (identità owner, sorgente di verità),
  `cloudOauthAccounts`, `cloudRestaurants`, `cloudAppliances` (pubkey ed25519 + campi LAN
  `lanIp`/`clientPort`/`lanHost` per il resolver), `cloudPairingCodes` (device-code TTL 10min),
  `cloudSessions`, `cloudEmailVerificationTokens`, `cloudPasswordResetTokens`, `cloudAuditLog`.

### Migrazioni

Applicate all'avvio dall'embedded Postgres. **14 locali** in `migrations/` (idx 0-13), journal
`migrations/meta/_journal.json`:

`0000_minor_victor_mancha` (schema iniziale) · `0001_add_cost_price` · `0002_add_rls` ·
`0003_add_performance_indexes` · `0004_add_staff_phone` · `0005_add_table_sessions` ·
`0006_money_numeric_and_constraints` (money real→numeric) · `0007_new_entities` ·
`0008_takeaway_bill_and_session` · `0009_add_cloud_identity_fields` · `0010_grandfather_email_verified` ·
`0011_loyalty_and_recipes` · `0012_orderitems_menuitem_nullable` · `0013_inventory_par_level`.

**3 cloud** in `migrations-cloud/` (journal separato): `0000_init_cloud_identity` ·
`0001_add_appliance_lan` · `0002_add_newsletter`. Lo schema cloud è migrato dal backend cloud,
non dall'embedded (`embedded.ts` migra solo `migrations/`).

---

## 3. Backend e route (apps/server)

### Avvio (`index.ts`)

`startServer()` (`index.ts:51`): se `isCloudMode()` monta il control-plane e ritorna
(`index.ts:55-58`); altrimenti modo **local**.

- **Porta**: `PORT ?? 3001` (`index.ts:60`) — ma in esercizio la shell Tauri esporta `PORT=4317`
  (default coerente in `system.ts:19`). Host `0.0.0.0` (`index.ts:263`).
- **HTTPS opt-in** (`TAKO_HTTPS=1`, `index.ts:73-87`): cert self-signed locale per dare un
  "secure context" al tablet (sblocca `getUserMedia` per la dettatura). Fallback silenzioso su
  http se il TLS fallisce.
- **JWT_SECRET** obbligatorio, ≥32 char in produzione (`index.ts:61-67`).

Plugin registrati:
- Error handler globale che sanifica i 5xx (`index.ts:94-102`).
- `@fastify/helmet` con CSP custom che permette `unsafe-inline`/`unsafe-eval` (SPA staff
  Babel-in-browser) e `ws:`/`wss:` (`index.ts:134-149`).
- `@fastify/cors` con **allowlist** LAN (`tako.local`, localhost, IP LAN correnti) sulle porte
  3001/3002; override `CORS_ORIGINS`; `credentials:true` (`index.ts:110-154`).
- `@fastify/jwt`, `@fastify/cookie` (stesso secret), `@fastify/multipart` (10 MB)
  (`index.ts:156-158`).
- `@fastify/static` su `/uploads/` (`index.ts:162`) e su `/staff/` con `GET /` → redirect a
  `/staff/index.html` (`index.ts:170-183`).
- `@fastify/rate-limit` globale **100 req/60s per IP** (loopback esente in dev, `index.ts:189-197`).
- `GET /health` (`index.ts:200`).

Dopo `ready()`: Socket.io sul server HTTP (`index.ts:228-236`), namespace dettatura +
`warmupAsr()` (`index.ts:239-240`), avvio opzionale WhatsApp (`index.ts:244-260`), `listen`,
poi `startMdns()`, `startHeartbeatLoop()`, `startConnectivityMonitor()`, diagnosi rete
(`index.ts:262-276`).

### Middleware auth (`middleware/auth.ts`) — sessioni in DB

Non JWT stateless: le sessioni staff sono righe in DB. `requireAuth` (`auth.ts:11-42`):
- Token da **cookie HttpOnly `tako_session`**, fallback `Authorization: Bearer` (`auth.ts:13`).
- Lookup sessione join `users` con `expiresAt > now()` E `users.active = true` → revoca immediata
  di un utente disattivato (`auth.ts:16-23`).
- **Refresh rolling** solo per token staff long-lived (≥64 char): sposta avanti `expiresAt` al
  più una volta/giorno (`auth.ts:30-39`). Le sessioni PIN (nanoid 32, tablet condiviso) non si
  rinnovano.
- Popola `req.user = { id, restaurantId, name, email, role }` — il `restaurantId` viene dal DB,
  mai dal client: perno del multi-tenant (`auth.ts:41`).
- `requireRole(...roles)` (`auth.ts:44-53`): 403 se il ruolo non è tra quelli ammessi.

Cookie (`lib/cookies.ts`): `tako_session` (staff, opaco), `tako_table` (JWT tavolo cliente).
`STAFF_SESSION_MAX_AGE` = **90 giorni** rolling; `TABLE_SESSION_MAX_AGE` = **4 ore**. `Secure`
solo con `COOKIE_SECURE=1` (in http LAN i browser rifiuterebbero i cookie Secure).

Modo cloud (`middleware/cloudAuth.ts`, non montato in local): `requireCloudAuth` solo cookie
`tako_cloud_session` + check `credentialsVersion`; `requireCsrf` double-submit in
`COOKIE_MODE=crosssite`.

### Socket.io realtime (`socket/handlers.ts`)

Un solo server Socket.io (`pingTimeout 60s`, stessa allowlist CORS). Modello a **room**, max 20
room per socket. Join in ingresso:
- **`join:restaurant`** (`handlers.ts:43`): room privata staff `restaurant:{id}`. Auth cookie
  `tako_session` in handshake + verifica DB; **rivalidazione ogni 60s** → disconnect al
  logout/scadenza.
- **`join:table`** (`handlers.ts:72`): room `table:{id}`, JWT tavolo `tako_table`; verifica
  `qrToken` corrente (copre la rotazione) + **revoca per-visita M6** (conto chiuso dopo
  `visitStart` → stop eventi).
- **`join:order`** (`handlers.ts:136`): room `order:{id}` per il tracking asporto (JWT
  `kind:takeaway`, stessa `takeawaySessionId`).
- **`join:menu`** (`handlers.ts:160`): room pubblica `menu:{id}`, non autenticata (solo eventi
  disponibilità/prezzi).

Eventi emessi dalle route: `order:new`, `order:updated`, `table:updated`, `waiter:called`,
`waiter:resolved`, `reservation:changed`, `shift:updated`, `inventory:alert`, `menu:updated`,
`menu:item_availability`, `connectivity` (globale).

Namespace **`/dictation`** (`socket/dictation.ts`): dettatura push-to-talk (auth cookie staff);
`finalize {pcm, sampleRate}` → `result {text, asrEngine, …}`; ASR dual-mode mlx locale → Groq.

### Gruppi di route (tutti sotto `/api`, registrati in `index.ts:203-223`)

Salvo diverso avviso, `preHandler: requireAuth` e query tenant-scoped su `req.user.restaurantId`.

- **`/api/auth`** (`auth.ts`) — auth staff. `POST /register` (ristorante+owner, 3/h),
  `POST /login`, `POST /pin-login`, `POST /resend-verification`, `GET /me`, `GET /pin-roster`,
  `POST /logout`.
- **`/api/setup`** (`setup.ts`) — pairing appliance↔cloud + password owner locale offline (solo
  local). `GET /status`, `POST /pair`, `POST /local-password`, `POST /heartbeat`, `POST /unpair`.
- **`/api/restaurants`** (`restaurants.ts`) — `GET /me`, `PATCH /me` (owner: settings/flag).
- **`/api/menus`** (`menu.ts`) — menu/sezioni/piatti/varianti/traduzioni + import AI. CRUD menu
  (`:35,41,51`), sezioni (`:80,92,109`), items (`:124,146,200`), availability (`:189`, emette
  `menu:updated`), varianti (`:209,220`), traduzioni (`:239,247,269`), `import-text` (10/min) +
  `import-confirm` (`:279,346`).
- **`/api/customer`** (`menu-i18n.ts`, stesso prefisso) — **pubblici**: `GET /menu-languages`,
  `GET /menu-translations`.
- **`/api/tables`** (`tables.ts`) — rooms (`:15,28`), tavoli CRUD (`:22,37,69,195`), stato
  (`:120`, `table:updated`), `waiter-resolve` (`:155`), QR (`:165,186`).
- **`/api/orders`** (`orders.ts`) — macchina a stati (`ALLOWED_TRANSITIONS`). `GET /active`,
  `GET /table/:id`, `GET /history`, `POST /` (crea), `PATCH /:id/status`,
  `PATCH /:id/items/:itemId/status` (bump cucina), `PATCH /:id/cancel`. Scarico magazzino su
  conferma.
- **`/api/bills`** (`bills.ts`) — cassa. `GET /open`, `POST /` (apre), `PATCH /:id`
  (owner/cassiere: sconti — vettore di frode ristretto), `POST /:id/payments`, `GET /:id`,
  `GET /summary/today`.
- **`/api/inventory`** (`inventory.ts`) — vedi §8.
- **`/api/customer`** (`customer.ts`) — **PWA cliente**, auth = JWT tavolo `requireTableSession`.
  `GET /table/:token` (apre sessione da QR, 30/min), `POST /takeaway/:rid/session`,
  `POST /restaurant/:rid/reservation` (pubblica, 6/min), `GET /restaurant/:rid/menu`,
  `POST /orders` (cliente ordina → `order:new`), `GET /orders/:id` (tracking),
  `POST /waiter-call` (6/min), `POST /ai-chat` (assistente cliente, 15/min).
- **`/api/uploads`** (`uploads.ts`) — `POST /image` (multipart → `/uploads`).
- **`/api/staff`** (`staff.ts`) — `GET /`, `POST /` (owner), `PATCH /:id` (owner),
  `DELETE /:id` (owner).
- **`/api/insights`** (`insights.ts`) — menu engineering/analytics AI. `GET /menu`,
  `POST /menu/ai` (owner), `PATCH /menu/:id/cost`.
- **`/api/stats`** (`stats.ts`) — `GET /dashboard` (KPI).
- **`/api/print`** (`print.ts`) — ESC/POS su stampante di rete (IP vincolato a LAN privata +
  porte 9100-9103, guardia SSRF). `POST /order`, `POST /bill`, `POST /test`.
- **`/api/system`** (`system.ts`) — **no auth**: `GET /connectivity`, `GET /net-health`,
  `GET /info` (URL/IP + QR).
- **`/api/reservations`** (`reservations.ts`) — con advisory-lock anti doppia prenotazione.
  `GET /`, `POST /`, `PATCH /:id`, `PATCH /:id/status`, `PATCH /:id/table`, `DELETE /:id`.
  Emette `reservation:changed`.
- **`/api/shifts`** (`shifts.ts`) — turni/timbrature (`MANAGER_ROLES = owner|cassiere` per gli
  altrui). `GET /`, `GET /active`, `POST /clock-in`, `POST /clock-out`, `POST /` (manager),
  `PATCH/DELETE /:id` (manager). Emette `shift:updated`.
- **`/api/whatsapp`** (`whatsapp.ts`) — **owner-only**: `GET /status`, `POST /bootstrap-code`,
  `POST /enable`, `POST /disable`, `POST /numbers`.
- **`/api/ai/owner`** (`ai-owner.ts`) — copilot owner (vedi §4): `POST /chat`, `POST /chat/stream`
  (SSE), `POST /execute` (esegue 1 azione confermata).

---

## 4. Copilota AI (lib/ai-actions.ts)

File-motore: `apps/server/src/lib/ai-actions.ts` (2832 righe). Un unico registro di "tool"
(`ACTIONS`, `ai-actions.ts:281`) condiviso da due personalità distinte dal campo
`scope: ('customer'|'owner')[]` di ogni azione. Ogni azione ha un `kind` (`ai-actions.ts:32`):
- `read` → lettura, eseguita subito;
- `action` → effetto reversibile sicuro (es. `call_waiter`), eseguito subito;
- `client` → il server valida ma l'effetto lo applica la PWA (es. `add_to_cart`, `show_buttons`);
- `mutation` → cambia dati persistenti: MAI eseguita in chat, richiede conferma umana.

### `runAssistant` (`ai-actions.ts:2092`)

Restituisce `AssistantTurn { message, actions, pending[] }` (`ai-actions.ts:2040`). Parametri:
`scope`, `ctx` (`{restaurantId, tableId?, tableNumber?, role?}`), `systemPrompt`, `history`,
`userMessage`, `allow?` (whitelist nomi azione, per il cliente), `model?`, `pendingImageUrl?`,
`composeReply?`. Variante streaming SSE: `runAssistantStream` (`ai-actions.ts:2589`).

- **Function-calling su Groq**: client OpenAI-SDK puntato a Groq (`groqClient`,
  `ai-actions.ts:2047`): `baseURL https://api.groq.com/openai/v1`, **`maxRetries: 0`** (fallisce
  subito per ripiegare sull'altro modello), `timeout 30000`. API key `GROQ_API_KEY`.
- **Selezione tool per keyword** (`pickToolNames`, `ai-actions.ts:1977`): NON invia tutti i ~55
  tool ad ogni turno (costerebbe ~5k token e satura il tier free) — sceglie le categorie
  pertinenti al messaggio (`TOOL_CATEGORIES`/`CATEGORY_KEYWORDS`).
- **Loop** (`ai-actions.ts:2181`): max **4 iterazioni** `act→observe→verify→decide`. 1ª iterazione
  con `tool_choice:'required'` se il messaggio matcha una categoria (i modelli piccoli altrimenti
  "rispondono a voce" inventando); poi `'auto'`. `temperature 0.4`, `max_tokens 700`.
- **Routing modello** (`pickModel`, `ai-actions.ts:2298`): verbi di mutazione →
  `openai/gpt-oss-120b`; letture/chit-chat → `llama-3.1-8b-instant`.
- **Catena failover** su 429 (`MODEL_CHAIN`, `ai-actions.ts:2308`): `llama-3.1-8b-instant` →
  `openai/gpt-oss-120b` → `meta-llama/llama-4-scout-17b-16e-instruct` → `openai/gpt-oss-20b` →
  `llama-3.3-70b-versatile`. Le quote Groq sono per-modello → al 429 passa subito al successivo.
  413 → alleggerisce i messaggi; 400 tool_use_failed → retry → modello di riserva → ultima
  risorsa senza tool.
- **Short-circuit** (dimezza latenza, disattivato con `composeReply:true`): (1) se l'iterazione ha
  solo mutation/guardia risponde con la domanda dati-mancanti o "Proposta pronta"
  (`ai-actions.ts:2276`); (2) lettura semplice con summary autosufficiente (10-400 char) →
  ritorna il summary del tool coi numeri veri dal DB, senza sintesi LLM (`ai-actions.ts:2283`).
- **`composeReply`**: false (owner) sfrutta gli short-circuit; true (cliente) fa comporre sempre
  la risposta al modello nella lingua giusta.
- `groqComplete` (`ai-actions.ts:2061`): completamento one-shot senza tool (descrizioni,
  traduzioni), `temperature 0.7`.

### Guardie anti-confabulazione

Principio: **prezzi/verità sempre dal DB, mai dal modello** (`ai-actions.ts:7-11`).
- Risoluzione per nome a tier (esatto→prefisso→contiene) con **match univoco o niente**:
  `resolveItem`/`resolveSection`/`resolveTable`/`resolveStaff`/`resolveInventory`/`resolveReservation`
  (`ai-actions.ts:75-228`). Se più candidati → ambiguo → chiede.
- Prezzi autoritativi: `add_to_cart` usa `match.price` dal menu reale; il checkout ricalcola.
- Guardia dati-tavolo (`extractTableInfo`, `ai-actions.ts:2339-2371`) + **pre-gate deterministico**
  `createTableGate` (`ai-actions.ts:2507`) che gestisce "crea tavolo" senza LLM (~50ms, zero valori
  inventati).
- Guardia generica creazioni: `confabulatedFields` (`ai-actions.ts:2476`) verifica che ogni campo
  proposto dall'LLM sia davvero nel testo utente (nome cliente, persone, data/ora, prezzo, nome
  piatto…); se inventato → chiede invece di proporre.
- Prompt owner (`owner-prompt.ts:8`) inietta le SALE REALI dal DB ("usa SOLO questi nomi").

### Mutation con conferma

`executeAction` (`ai-actions.ts:2018`) blocca le mutation senza `allowMutation`
(`ai-actions.ts:2031`), verifica scope e ruolo. Flusso a due fasi (`ai-owner.ts`):
1. `POST /ai/owner/chat`: quando l'LLM chiama una mutation, il server **non esegue** — la registra
   in `pending[]` `{name, args, label}` con dedup e risponde "in attesa di conferma". La UI mostra
   una **card di conferma**.
2. `POST /ai/owner/execute` (`ai-owner.ts:134`): solo dopo il tap, chiama
   `executeAction(..., {allowMutation:true})` — unico punto con mutation abilitate. Rate-limit
   40/min. Eccezione: `set_dish_image` (mutation ma eseguita diretta perché l'URL viene dal file
   caricato).

### Registro azioni (~55 totali)

**Customer (5)**: `search_menu` (read, condivisa) · `add_to_cart` (client) · `call_waiter`
(action) · `order_status` (read) · `show_buttons` (client).

**Owner (~50)** — letture: `get_today_revenue`, `get_stats`, `table_status`,
`generate_dish_description`, `translate_menu_item`, `menu_engineering`, `todays_reservations`,
`low_stock`, `reorder_list`, `open_bills`, `staff_on_shift`, `revenue_for_date`, `active_orders`,
`list_staff`, `menu_performance`, `loyalty_balance`, `get_recipe`.
Mutation (conferma): `set_item_availability`, `create_menu_item`, `create_menu_section`,
`set_dish_image` (hidden), `update_menu_item`, `delete_menu_item`, `delete_menu_section`,
`rename_menu_section`, `create_table`, `delete_table`, `update_table`, `create_reservation`,
`cancel_reservation`, `set_reservation_status`, `cancel_order`, `apply_bill_discount`
(owner/cassiere), `close_bill` (owner/cassiere), `create_inventory_item`, `adjust_stock`,
`clock_in_staff`/`clock_out_staff` (owner/cassiere), `create_staff` (owner), `set_staff_active`
(owner), `create_room`, `set_table_status`, `refresh_table_qr`, `set_food_cost`, `set_cover_charge`
(owner), `add_dish_variant`, `add_loyalty_points`/`redeem_loyalty_points` (gated `loyaltyEnabled`),
`set_recipe_ingredient`/`remove_recipe_ingredient`.

Il prompt owner è condiviso tra dashboard (Cmd+K) e WhatsApp (`owner-prompt.ts`).

### Assistente cliente (multilingua)

Endpoint `customer.ts:/ai-chat` (`:555`). Identità tavolo dal JWT `tako_table` (mai dal client).
Gate `settings.aiEnabled`; cap giornaliero per-ristorante `DAILY_AI_CAP` (default 2000); modello
forzato `openai/gpt-oss-120b`; `composeReply:true`.
- **14 lingue** (`LANG_NAMES`, `customer.ts:603`). Lingua di risposta = `lang` UI cliente →
  `defaultLanguage` → `it`.
- **Language-guard**: (1) prompt imperativo "LINGUA OBBLIGATORIA…" (`customer.ts:609`); (2) guardia
  deterministica post-hoc (`customer.ts:669`): se la lingua target usa uno script non-latino
  (zh/ja/ko/ru/ar) ma la risposta non lo contiene → ritraduce con `groqComplete`.
- **`show_buttons`** (`ai-actions.ts:368`): il modello sceglie solo QUALI pulsanti mostrare tra
  `send_order/view_cart/call_waiter/reserve/track_order`; le etichette sono localizzate dal client
  (funziona in ogni lingua). Safety-net (`customer.ts:657`): se ha aggiunto al carrello ma non ha
  proposto pulsanti, il server aggiunge `send_order`+`view_cart`.
- Sanitizzazione anti-leak (`customer.ts:624`): rimuove eventuali "recite" di tool-call dal testo.

---

## 5. Foto piatti AI (lib/dish-image-ai.ts)

Styling AI di una foto piatto (best-effort: se fallisce si tiene l'originale).

- **Modelli Gemini**: base = `gemini-2.5-flash-image` ("Nano Banana", `MODEL_BASE`,
  `dish-image-ai.ts:38`), **default**; Pro = `gemini-3-pro-image` ("Nano Banana Pro", `MODEL_PRO`,
  `:37`), qualità massima, solo con codice firmato valido. Scelta in `maybeStyleDishImage`
  (`:152-168`): `isPro = verifyProCode(...)`. Endpoint
  `generativelanguage.googleapis.com/v1beta/models/<model>:generateContent`,
  `responseModalities:['IMAGE']`, timeout 45s.
- **Sblocco Pro Ed25519**: chiave pubblica hardcoded (`PRO_PUBLIC_KEY_B64`, `:23`).
  `verifyProCode(restaurantId, code)` (`:30-35`) verifica che `code` sia la **firma Ed25519 del
  `restaurantId`**. L'appliance ha solo la pubblica → non può forgiare; il codice è legato al
  restaurantId (non copiabile) e verificato ad ogni generazione. Codice letto da
  `settings.aiPhotoProCode` (dashboard → Impostazioni → Funzionalità → "Codice Pro").
  Generazione (solo Manuel): `scripts/tako-pro-code.mjs <restaurantId>`, chiave privata da
  `TAKO_PRO_PRIVATE_KEY` o `~/Documents/brain/tako-pro-private-key.txt`.
- **Immagine di riferimento per-locale**: `<UPLOADS_DIR>/<restaurantId>/_style_ref.jpg`
  (`:80-82`). Impostata via WhatsApp (foto con caption `riferimento`/`stile`/`ref` →
  `setStyleRef`). Usata solo se Pro attivo (flash è un semplice editor, ignora/copia la
  reference); con reference si usa `STYLE_PROMPT_REF`.
- **Chiave Gemini** (`geminiKey()`, `:43-53`): env `GEMINI_API_KEY`, fallback file
  `TAKO_HOME/gemini-key.txt`. Nessuna cache → incollarla a server avviato la raccoglie senza
  riavvio. (Nota: in produzione la shell Tauri viene avviata con `env -u GEMINI_API_KEY` per far
  leggere il file — vedi §9.)
- **Pipeline salvataggio** (`image-store.ts`): validazione magic-bytes, re-encode `sharp` max
  2000px/lato, quota per-ristorante 2 GB (`UPLOADS_MAX_BYTES`), filename `nanoid(16)`, URL
  `/uploads/<restaurantId>/<file>`.

---

## 6. WhatsApp (lib/whatsapp.ts)

Canale WhatsApp dell'owner (copilot via chat). File `apps/server/src/lib/whatsapp.ts` (~30KB).

- **Baileys** (`@whiskeysockets/baileys`), importato dinamicamente (`whatsapp.ts:221`): il server
  parte anche senza la dipendenza. Auth su disco in `TAKO_HOME/whatsapp-auth`
  (`useMultiFileAuthState`, `:232`). QR non in terminale: arriva via `connection.update` (`:243`),
  esposto da `GET /status` come dataURL PNG. Config in `TAKO_HOME/whatsapp-config.json` (0600):
  `enabled`, `allowedNumbers[]`, `bootstrapCode?`. **OFF di default**: parte con `TAKO_WHATSAPP=1`
  o `enabled:true`.
- **Bootstrap code / collegamento**: codice 6 cifre crypto-random generato se la whitelist è vuota
  (`ensureBootstrapCode`, `:80-87`), mostrato SOLO in dashboard. Il numero si collega scrivendo
  `collega tako <codice>` (`:352`); il codice è usa-e-getta. Route owner-only (`routes/whatsapp.ts`).
- **Self-chat via @lid**: la chat con sé stessi arriva con `<lid>@lid`. Si salvano `me` e `myLid`
  (`:249-254`); un `fromMe` è accettato solo se è la self-chat (`isSelf`, `:331`). Anti-loop
  `sentIds` (Set FIFO 300, `:129-134`): ogni messaggio inviato registra il suo `key.id`; in arrivo,
  se è in `sentIds` → scartato (evita che Tako risponda ai propri echi).
- **Auto-heal su logout** (`:261-275`): su `loggedOut` chiama `clearAuthDir()` (rimuove+ricrea
  `whatsapp-auth`) e rischedula `startWhatsApp()` dopo 1.5s → QR fresco. Disconnessioni transitorie
  → riconnessione dopo 3s.
- **Interazioni**: `collega tako <codice>` · foto con caption `riferimento`/`stile`/`ref` →
  imposta la reference di stile · foto con caption = nome piatto → assegna la foto · foto senza
  caption → pending (il testo dopo è il nome piatto, TTL 10min) · conferma/annulla proposta
  (`CONFIRM_RE`/`CANCEL_RE`, `:165-166`) · qualsiasi altro testo → copilot owner (`runOwnerTurn`
  → stesso `runAssistant` scope owner, stesso `ownerSystemPrompt`). Le mutation richiedono un "SÌ"
  esplicito (`pendingByNumber`, TTL 10min); solo `set_dish_image` è diretta.
- **Foto → piatto** (`handleIncomingImage`, `:400-428`): scarica i byte
  (`downloadMediaMessage`), se aiPhoto attivo avvisa "🎨 Sto migliorando la foto…", passa a
  `maybeStyleDishImage`, salva con `saveImageBuffer`, poi `executeAction('set_dish_image', …)` e
  rimanda l'immagine finale con "✅ Assegnata a …".
- **Briefing giornaliero** (flag `dailyBriefingEnabled`): scheduler `setInterval` 60s
  (`ensureBriefingScheduler`, `:495`); all'ora `dailyBriefingHour` (default 9) nel timezone del
  ristorante manda ai numeri autorizzati incasso di ieri + prenotazioni di oggi + scorte basse
  (`buildDailyBriefing`, `:465`).

---

## 7. Resilienza rete

Sottosistema `network.ts` / `connectivity.ts` / `net-health.ts` / `mdns.ts` / `qr-octopus.ts` /
`cloud-client.ts` / `cloud-verify.ts` / `tls.ts`. Principio: **ogni** dipendenza da internet ha
timeout esplicito (AbortController) e degrada in uno stato dichiarato senza bloccare il core locale.

### QR LAN-first (`network.ts`)

Il QR stampato non deve mai contenere un IP (cambia al riavvio del router). Il tipo `QrMode`
(`network.ts:118`) è `'lan' | 'cloud'`, default **`'lan'`**. Dispatcher `tableQrUrl` (`:126-130`)
sceglie tra:
1. **`stableTableUrl`** (cloud, `:92-96`): se accoppiata, `${publicBaseUrl}/t/<applianceId>/r/<rid>/t/<qrToken>`
   → il resolver cloud reindirizza all'IP LAN corrente (pubblicato via heartbeat). `publicBaseUrl()`
   default `https://api.takoitalia.com`.
2. **`lanTableUrl`** (`:103-105`): `http://tako.local:<clientPort>/r/.../t/...` — default, funziona
   con cloud giù.
3. **`ipTableUrl`** (`:113-115`): `http://<IP-LAN>:3002/...` per i telefoni senza mDNS (richiede
   DHCP reservation).

Il percorso PWA tavolo è sempre `r/<restaurantId>/t/<qrToken>`. `isPrivateLanIPv4` (`:23-30`)
valida RFC1918 (usato anche lato cloud per chiudere l'open-redirect). Rendering QR con badge polpo
pixel-art (`qr-octopus.ts`): sprite disegnato in codice, `errorCorrectionLevel:'H'` per tollerare
il logo centrale.

### mDNS (`mdns.ts`)

`startMdns` (`:10-30`) via `multicast-dns`: risponde alle query per il proprio host con **tutti**
gli IPv4 LAN correnti (record A TTL 120s) → `tako.local` resta stabile ai cambi IP. Degrado
silenzioso se la porta è occupata (Bonjour macOS). Disattivabile `MDNS=0`.

### Monitor connettività (`connectivity.ts`)

Sonda internet (non LAN). Endpoint `https://www.gstatic.com/generate_204`, intervallo 30s, timeout
probe 4s. `isOnline()` (`:41-43`) è un getter **sincrono** (fast-fail: le feature online — foto AI,
copilot — controllano prima di partire). `onConnectivityChange` edge-triggered → emette evento
socket `connectivity`.

### Diagnosi rete LAN (`net-health.ts`)

Misura la qualità della rete **locale** (best-effort, no sudo). Su macOS: default route + SSID +
`ping -c 5` al gateway → loss%/rtt/jitter. Classifica `ok | debole | instabile | sconosciuto`
(soglie in `:66-77`) e suggerisce (AP più vicino / SSID dedicato / Mac hotspot).

### Cloud control-plane (`cloud-client.ts`)

L'appliance in modo local si registra al control-plane (opzionale, solo se `CLOUD_BASE_URL`).
- **Identità**: keypair **ed25519** persistita cifrata AES-256-GCM in `~/.tako/cloud-identity.enc`
  (chiave da scrypt su `device-secret` 0600). Threat-model "box rubato": il furto non espone la
  credenziale cloud dell'owner (mai sul box, SEC-001).
- **`claim(code)`** (`:245-292`): `POST /api/pair/claim` con `{code, devicePubKey}` → riceve
  `{restaurant, ownerSnapshot, applianceId, applianceToken, credentialsVersion}`. Mai il password
  hash cloud.
- **`heartbeat()`** (`:307-366`): firma `{applianceId, ts, credentialsVersion}` con la privkey e
  **pubblica la rete LAN** (`lanHost=tako.local`, `lanIp`, `clientPort`) → è così che il resolver
  cloud sa dove reindirizzare il QR stabile. Risposta: `none`/`refresh` (bump credentials → invalida
  login offline)/`revoke`/`offline`. Best-effort: offline non è errore.
- **`cloud-verify.ts`**: l'appliance non invia email — delega al control-plane (Resend) e scopre la
  verifica con un "login probe" (`cloudLoginProbe`). Disattivabile `TAKO_EMAIL_VERIFICATION=0`.

### TLS locale (`tls.ts`)

HTTPS opt-in (`TAKO_HTTPS=1`) per dare al tablet un secure context (sblocca `getUserMedia`). Cert
self-signed unico con SAN = `tako.local`+`localhost`+IP LAN, generato con `openssl`
(`rsa:2048`, 10 anni), persistito in `~/.tako/tls/` e riusato ai riavvii (rigenerazione idempotente
se compare un nuovo IP LAN). Dir 0700, key 0600.

### Endpoint di sistema (`system.ts`)

`GET /connectivity` (stato internet), `GET /net-health` (qualità LAN), `GET /info` (URL/IP di
aggancio + QR dashboard).

---

## 8. Inventario

Route `apps/server/src/routes/inventory.ts`. Modello a **ledger**: la giacenza si cambia solo via
movimenti, mai con una UPDATE diretta della quantità.

- **Articoli**: `GET /` (solo `active=true`), `POST /`, `PATCH /:id` (metadati, non la giacenza),
  `DELETE /:id` (soft-delete `active=false`, conserva lo storico). Campi: `unit`, `quantity`,
  `minQuantity` (soglia alert), `parLevel` (scorta obiettivo), `costPerUnit`, `supplier`.
- **Movimenti** (`POST /:id/movements`, `:137`): tipi `load`/`unload`/`adjustment`(con segno)/`waste`.
  Movimento + update stock in **una transazione**; lo stock non scende mai sotto zero
  (`GREATEST(0, …)` a livello DB, `:166`). Se scende ≤ minQuantity emette `inventory:alert`.
  `GET /:id/movements` (`:79`): storico (ultimi 100).
- **Alert** (`GET /alerts`, `:24`): articoli con `quantity ≤ minQuantity`.
- **Stats/valorizzazione** (`GET /stats`, `:88`): valore totale (`costPerUnit × quantity`),
  conteggi low/out, consumo 30gg (movimenti `unload`+`waste`), consumo/giorno e **giorni alla
  rottura** (`daysLeft`).
- **Reorder** (`GET /reorder`, `:117`): articoli sotto scorta → quantità suggerita per tornare al
  `parLevel` (o `minQuantity*2`), raggruppati per fornitore, con costo stimato.
- **Import AI** (`POST /import-text`, `:180`, 10/min): parsa un testo libero con Groq
  (`llama-3.3-70b-versatile`, JSON mode) → anteprima; `POST /import-confirm` (`:222`) crea in blocco.
- **Scarico automatico da ricetta** (`lib/stock-deduct.ts`): `deductStockForOrder` chiamato al
  passaggio ordine → `confirmed`, gated da `settings.autoStockDeductEnabled` (default OFF).
  Best-effort assoluto (try/catch, non lancia mai): somma il fabbisogno per ingrediente
  (`Σ qtà piatto × qtà ricetta`) e scala ogni `inventoryItem` con `GREATEST(0, …)`.

---

## 9. Deploy e build

### Bundle del server (`scripts/build-server-bundle.mjs`)

`pnpm --filter @tako/app bundle:server` (o `desktop:build`). Strategia: esbuild bundla **solo il
codice nostro** (server src + workspace `@tako/*`); i pacchetti npm restano **esterni** e vengono
spediti come `node_modules` reale (sharp/Postgres/socket.io hanno file su disco che il bundling
romperebbe). Output in `apps/app/src-tauri/resources/server/`:
- `server.mjs` (nostro codice, ESM, entry `bootstrap.ts`), `node_modules/` (npm install pulito,
  no symlink pnpm), `migrations/`, `staff/` (SPA dashboard), `asr/` (worker Python dettatura),
  `node` (runtime, `node.exe` su Windows).
- Builda anche la **PWA cliente** (`pnpm --filter @tako/web build`, Next standalone) → copiata in
  `resources/web` (sibling di `server`) con un "flatten" delle dipendenze di Next (fix
  pnpm+standalone, `:93-129`).

`desktop:build` = `build-server-bundle.mjs && tauri build --bundles app`. Deploy in place:
`scripts/deploy-desktop.sh` builda solo il `.app`, chiude Tako, fa `rsync -a --delete` in
`/Applications/Tako.app`, toglie la quarantena, e **deregistra il build-output** (evita un 2º Tako
fantasma in Launchpad). Install da chiavetta (senza account OS): `scripts/install-usb-mac.sh`
(copia in /Applications, rimuove quarantena, firma ad-hoc).

### Gotcha operativi (Mac di sviluppo)

- **Killare Tako ferma anche il Postgres embedded** (i figli node+Postgres muoiono col gruppo di
  processi). Per rilanciare l'appliance in locale: `env -u GEMINI_API_KEY open -a Tako` — così la
  chiave Gemini viene letta dal file `TAKO_HOME/gemini-key.txt` invece che dall'env di shell.
- Se resta un **web-child orfano su :3002** dopo un crash, va killato a mano (il server API su
  :4317 si auto-bonifica via `reclaimOrphanServer`, il web no).
- Il Mac deve restare acceso col processo vivo.

### Auto-update Tauri (R2 + minisign)

`apps/app/src-tauri/src/lib.rs:139-177`: all'avvio Tako controlla `latest.json`, verifica la firma
**minisign** col pubkey in `tauri.conf.json` (`plugins.updater.pubkey`), e su conferma dell'owner
scarica/installa/riavvia. Endpoint: `https://updates.takoitalia.com/latest.json`
(`tauri.conf.json:31`). `createUpdaterArtifacts:true`.

Pipeline release (`.github/workflows/release.yml`, vedi `RILASCIO.md`): su tag `vX.Y.Z` la CI
builda macOS arm64+Intel + Windows x64, firma gli artifact updater e pubblica su **Cloudflare R2**
(bucket `tako-updates`). `scripts/make-latest-json.mjs` genera `latest.json` mappando ogni
artifact → chiave piattaforma Tauri (`darwin-aarch64`/`darwin-x86_64`/`windows-x86_64`) con la sua
firma `.sig`. Chiave updater privata (gratis, minisign) in
`~/Documents/tako creds/Tako-Credenziali/tako-updater.key` — se persa nessun update futuro è
firmabile.

**Bloccanti vendita** (da `RILASCIO.md`): Apple Developer $99/anno (senza, il `.app` non si apre su
altri Mac — via chiavetta invece funziona); R2 per gli update; secret GitHub
(`TAURI_SIGNING_PRIVATE_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`); Windows code-signing
opzionale. Taglio release: bump `version` in `tauri.conf.json` → `git tag vX.Y.Z && git push`.

---

## 10. Settings e feature-flag (RestaurantSettings)

Tipo TS in `packages/db/src/schema/restaurants.ts:21-49`, salvato in `restaurants.settings`
(jsonb). Modificabile via `PATCH /api/restaurants/me` (owner) e dal copilot. Flag e cosa gateano:

| Flag | Default | Cosa gatea |
|---|---|---|
| `currency`, `timezone`, `vatRate` | — | Valuta, fuso (briefing/date), aliquota IVA |
| `languages`, `defaultLanguage` | — | Lingue menu + lingua di fallback assistente cliente |
| `tableServiceEnabled` | — | Servizio al tavolo |
| `takeawayEnabled` | — | Ordini asporto |
| `payAtTableEnabled` | — | Pagamento al tavolo |
| `reservationsEnabled` | — | Prenotazioni self-service dai clienti |
| `aiEnabled` | — | Assistente cliente AI (`customer.ts:/ai-chat`) |
| `printerIp`, `printerPort`, `autoPrint` | — | Stampa comande/ricevute ESC/POS |
| `loyaltyEnabled` | OFF | Fedeltà a punti (azioni `add/redeem/loyalty_balance`) |
| `reviewRequestEnabled`, `reviewUrl` | OFF | Richiesta recensione post-pagamento |
| `autoStockDeductEnabled` | OFF | Scarico automatico magazzino da ricetta (`stock-deduct.ts`) |
| `dailyBriefingEnabled`, `dailyBriefingHour` | OFF / 9 | Briefing WhatsApp programmato |
| `aiContentEnabled` | **ON** | Generazione AI descrizioni/traduzioni (`generate_dish_description`, `translate_menu_item`) |
| `aiPhotoEnabled` | OFF | Foto piatto stilizzata AI (richiede `GEMINI_API_KEY`) |
| `aiPhotoProCode` | — | Codice Pro firmato Ed25519 → sblocca Nano Banana Pro + reference |
| `menuEngineeringEnabled` | **ON** | Analisi menu engineering |
| `qrMode` | `lan` | QR tavolo: `lan` (tako.local, resiliente) vs `cloud` (resolver pubblico) |
| `customerOrderingEnabled` | **ON** | Self-service ordini cliente; OFF → menu in sola lettura (se la rete non regge) |

`plan` (`free`/`pro`/`enterprise`) e `planExpiresAt` sono colonne dedicate della tabella
`restaurants`, non dentro `settings`.

---

## Riferimenti file rapidi

- Shell desktop / avvio processi: `apps/app/src-tauri/src/lib.rs`, `tauri.conf.json`
- Entry server: `apps/server/src/bootstrap.ts`, `apps/server/src/index.ts`
- Embedded Postgres: `packages/db/src/embedded.ts`
- Schema DB: `packages/db/src/schema/*.ts` (+ `schema/cloud/`)
- Copilota AI: `apps/server/src/lib/ai-actions.ts`, `lib/owner-prompt.ts`, `routes/ai-owner.ts`, `routes/customer.ts`
- Foto AI: `apps/server/src/lib/dish-image-ai.ts`, `lib/image-store.ts`, `scripts/tako-pro-code.mjs`
- WhatsApp: `apps/server/src/lib/whatsapp.ts`, `routes/whatsapp.ts`
- Rete: `apps/server/src/lib/{network,connectivity,net-health,mdns,qr-octopus,cloud-client,cloud-verify,tls}.ts`
- Inventario: `apps/server/src/routes/inventory.ts`, `lib/stock-deduct.ts`
- Build/deploy: `scripts/build-server-bundle.mjs`, `scripts/deploy-desktop.sh`, `scripts/make-latest-json.mjs`, `RILASCIO.md`
- Auth/realtime: `apps/server/src/middleware/auth.ts`, `socket/handlers.ts`, `socket/dictation.ts`, `lib/cookies.ts`
