# MAPPA-TAKO — Mappa file dei 3 progetti Tako

> Documento di reference: spiega **ogni file e ogni cartella** delle tre cartelle Tako in
> `~/Projects/` con schema grafico (albero ASCII) + tabelle `file | ruolo`.
> Generato il **2026-06-30**. Branch/commit catturati a quella data.

---

## 0. Le 3 cartelle = 3 git worktree dello STESSO repo Tako

Non sono tre progetti diversi: sono **tre worktree git** dello stesso monorepo Tako, ciascuno su
un branch diverso (stesso `.git` condiviso, cartelle di lavoro separate).

```
                   repo Tako (un solo .git)
                            │
      ┌─────────────────────┼──────────────────────────┐
      ▼                     ▼                           ▼
  ~/Projects/Tako     ~/Projects/Tako-cloud-auth   ~/Projects/Tako-site-auth
  feat/fase1-          feat/cloud-auth-20260625     feat/site-auth-20260625
   consolidamento
  (commit 9489d08)    (commit 8425e18)             (commit 0354be7)

  PRINCIPALE          FEATURE: control-plane       FEATURE: sito/landing
  più avanti:          cloud (identità owner,        + client cloud-auth
  app desktop Tauri,   OAuth Google/GitHub,          (landing/ parla con
  deploy cloud Render, pairing appliance↔cloud,      api.tako.app /api/auth/*)
  doc in TAKO.md       TAKO_MODE=cloud)
```

**Conseguenza pratica:** il 90% dei file è identico tra le tre cartelle (è lo stesso codebase).
Le differenze stanno solo nella feature del branch:

| Cartella | Branch | Cosa aggiunge rispetto al core |
|---|---|---|
| `Tako` | `feat/fase1-consolidamento` | Stato più recente: packaging **app desktop Tauri** (server+web bundlati in `src-tauri/resources/`), deploy cloud su Render, `TAKO.md` come fonte di verità, `manu.md` handoff. |
| `Tako-cloud-auth` | `feat/cloud-auth-20260625` | **Control-plane cloud** isolato: `apps/server/src/cloud/*`, `schema/cloud/*`, `middleware/cloudAuth.ts`, `routes/cloud/*` (auth/oauth/pair/contact), `deploy/Dockerfile.cloud`, test cloud. Attivo solo con `TAKO_MODE=cloud`. |
| `Tako-site-auth` | `feat/site-auth-20260625` | **Sito vetrina** `landing/` (HTML+JSX via Babel in-browser) + `landing/tako-api.js` che fa da **client** del control-plane cloud (`api.tako.app /api/auth/*`, OAuth, verify-email, reset-password). |

**Il confine local vs cloud è netto e intenzionale.** Il core POS (appliance) gira 100% in LAN
offline; il cloud tiene solo identità/registry/pairing. Il ponte tra i due piani passa solo da
`apps/server/src/lib/cloud-client.ts` (appliance→cloud: `claim`/`heartbeat`, keypair ed25519) e
dalle route `routes/cloud/pair.ts` (device-code pairing).

---

# PARTE A — `~/Projects/Tako` (worktree principale)

> Sistema operativo per ristoranti: core POS 100% locale (gira su mini-PC nel locale), dashboard
> staff su tablet, menu PWA per il cliente da QR, + identità/sito cloud opzionale.
> Stack: **Fastify + Socket.io + Drizzle/Postgres** (server) · **Next.js 15** (dashboard + customer
> PWA) · **Expo + Tauri** (app nativa thin-client) · monorepo **pnpm + Turborepo**.
> Porte: server `3001` (o `4317` in modalità "tutto-in-uno"), dashboard `3000` (servita anche da
> `/staff`), customer PWA `3002`.

## A.1 — Albero ASCII commentato

> Esclusi: `node_modules`, `.git`, `.next`, `dist`, `target`, `.turbo`, `out`, `build`, `*.lock`,
> `*.tsbuildinfo`, cache, `.pgdata/` (dati interni Postgres), `.expo/`, `src-tauri/gen/`. Le cartelle
> di asset binari (mascotte `takos/<colore>/`, `fonts/`) sono collassate.

```
Tako/
├── package.json                  # root workspace: script turbo (dev/build/test), comando `pnpm tako`
├── pnpm-workspace.yaml           # definisce i workspace: apps/* e packages/*
├── turbo.json                    # pipeline Turborepo (build/dev/lint/db:*)
├── tsconfig.base.json            # config TS condivisa (ES2022, NodeNext, strict)
├── vitest.config.ts              # config test integrazione (girano contro stack vivo :3001)
├── docker-compose.yml            # stack dev: postgres + redis + server + dashboard + web
├── docker-compose.prod.yml       # core di produzione: postgres + redis + server (API+dati)
├── .env / .env.example           # env locale + template (JWT_SECRET, DATABASE_URL, ...)
├── .env.production.example        # template env di produzione (ruolo tako_app per RLS)
├── .gitignore                    # ignora node_modules, .env, .pgdata, build app, segreti
├── CLAUDE.md                     # istruzioni progetto + protocollo routine autonoma + team agenti
├── TAKO.md                       # FONTE DI VERITÀ: cos'è, fatto, da fare, deploy, decisioni
├── manu.md                       # handoff sessione (deploy cloud/SEO, to-do di Manuel)
│
├── apps/
│   ├── server/                   # ── CUORE: Fastify + Socket.io + Drizzle (multi-tenant)
│   │   ├── package.json          # deps server (fastify, drizzle, socket.io, sharp, openai...)
│   │   ├── Dockerfile            # build immagine server di produzione
│   │   ├── tsconfig.json
│   │   ├── .env / .env.example
│   │   └── src/
│   │       ├── bootstrap.ts      # entrypoint: provvede JWT/Groq da file, avvia DB embedded poi server
│   │       ├── index.ts          # startServer(): plugin Fastify, CORS/helmet/jwt/cookie, route, Socket.io, static /staff
│   │       ├── lib/
│   │       │   ├── billing.ts    # ricalcolo conti dal DB (round2, BILLABLE_STATUSES, recomputeOpenBill)
│   │       │   ├── cookies.ts    # nomi/opzioni cookie HttpOnly (tako_session, tako_table)
│   │       │   ├── mdns.ts       # annuncio tako.local sulla LAN (best-effort)
│   │       │   ├── network.ts    # IPv4 LAN dell'host (schermata "collega dispositivi")
│   │       │   └── printer.ts    # ESC/POS: costruisce ricevuta e la invia alla stampante termica
│   │       ├── middleware/
│   │       │   └── auth.ts       # requireAuth: valida sessione staff (cookie o Bearer)
│   │       ├── routes/
│   │       │   ├── auth.ts       # login/logout staff, sessioni, set/clear cookie
│   │       │   ├── restaurants.ts# CRUD ristorante, settings, branding
│   │       │   ├── menu.ts       # menu/sezioni/piatti/varianti (lettura+scrittura)
│   │       │   ├── tables.ts     # tavoli, stanze, QR token, stato tavolo
│   │       │   ├── orders.ts     # ordini (comanda staff + cliente), stati, prezzi dal DB
│   │       │   ├── bills.ts      # conti: apertura/chiusura/pagamento, anti-leak cross-tenant
│   │       │   ├── inventory.ts  # magazzino: item, movimenti, alert scorte
│   │       │   ├── stats.ts      # statistiche/KPI ristorante
│   │       │   ├── insights.ts   # analytics AI: menu engineering (Boston Matrix via Groq)
│   │       │   ├── customer.ts   # endpoint cliente: resolve QR, menu pubblico, waiter-call, AI chat
│   │       │   ├── staff.ts      # gestione personale (add/delete, PIN bcrypt, phone)
│   │       │   ├── print.ts      # POST /order: stampa comanda termica (preHandler auth)
│   │       │   ├── system.ts     # /info: URL LAN + tako.local + QR per onboarding dispositivi
│   │       │   └── uploads.ts    # upload immagini (MIME whitelist + magic-bytes, sharp)
│   │       ├── socket/
│   │       │   └── handlers.ts   # Socket.io: auth handshake da cookie, room restaurant:{id}/table:{id}
│   │       └── types/
│   │           └── multicast-dns.d.ts  # type shim per la lib multicast-dns
│   │
│   ├── dashboard/                # ── Next.js 15: shell staff (la UI vera è la SPA in public/staff)
│   │   ├── next.config.ts        # redirect / → /staff/index.html, rewrite /api e /socket.io → server
│   │   ├── (tailwind/postcss/tsconfig/next-env/Dockerfile)
│   │   ├── public/
│   │   │   ├── manifest.webmanifest # manifest PWA dashboard
│   │   │   ├── sw.js             # service worker (cache shell, no API/socket)
│   │   │   ├── tako-cloche.png · icons/ · takos/<colore>/  # asset mascotte (5 colori × ~10 pose)
│   │   │   └── staff/            # ── SPA "Tako Dashboard" verbatim, wirata al backend
│   │   │       ├── index.html    # entry SPA: boot screen + React/Babel (CDN) + src/*
│   │   │       ├── styles.css    # stile completo dashboard
│   │   │       ├── lib/{react,react-dom,babel}.js  # React+Babel standalone (no build step)
│   │   │       ├── assets/ · fonts/                # mascotte + webfont della SPA
│   │   │       └── src/
│   │   │           ├── 01-data.js          # data layer REALE (fetch /api + socket)
│   │   │           ├── 02-kit.js           # primitivi UI + icone Lucide-style
│   │   │           ├── 03-shell-nav.js     # shell responsive + navigazione (gruppi NAV)
│   │   │           ├── 04-screens-operative.js   # Dashboard home · Ordini live · KDS cucina
│   │   │           ├── 05-screens-sala-cassa.js  # Sala · Cassa · Comanda · Tavoli · QR
│   │   │           ├── 06-screens-gestione.js    # Menu · Statistiche · Analisi · Inventario · Staff · Impostazioni
│   │   │           └── 07-app-root.js      # app root wirata (auth cookie, branding, routing)
│   │   └── src/                  # shell Next minima attorno alla SPA
│   │       ├── app/{page,layout,providers,not-found}.tsx · globals.css · icon.png
│   │       ├── components/
│   │       │   ├── layout/AppShell.tsx     # shell React (nav per ruolo)
│   │       │   ├── PWARegister.tsx         # registra il service worker (HTTPS/localhost)
│   │       │   └── ui/{index,icon,kit,Tako,Toaster}.tsx  # kit UI Tako (barrel, icone, primitivi, mascotte, toast)
│   │       ├── hooks/useSocket.ts          # hub realtime: socket → invalidazione React Query
│   │       └── lib/{api,socket,store,brand-store,comanda-store,ui-bus,utils}.ts
│   │
│   ├── web/                      # ── Next.js 15: customer PWA (menu da QR)
│   │   ├── next.config.ts (output standalone) · (tailwind/postcss/tsconfig/Dockerfile/.env.local)
│   │   ├── public/manifest.json · mascotte/*.png   # manifest PWA + mascotte cliente
│   │   └── src/
│   │       ├── app/
│   │       │   ├── page.tsx        # landing/splash con QR finto decorativo
│   │       │   ├── layout.tsx · globals.css · icon.png
│   │       │   └── r/[restaurantId]/t/[token]/page.tsx  # entry da QR → <CustomerApp>
│   │       ├── components/
│   │       │   ├── CustomerApp.tsx # orchestratore flusso cliente (resolve tavolo, tab)
│   │       │   ├── MenuView.tsx    # menu dal DB (sezioni, varianti, filtri)
│   │       │   ├── CartView.tsx    # carrello + invio ordine (idempotency key)
│   │       │   ├── OrderTracking.tsx # tracking realtime stati ordine
│   │       │   ├── AiChat.tsx      # assistente cliente AI (azioni: ordina, chiama cameriere)
│   │       │   └── ui/{Bubbles,Dish,Sheet}.tsx  # bolle ambient, tile piatto, bottom-sheet
│   │       └── lib/{api,socket,store,motion,utils}.ts
│   │
│   └── app/                      # ── App nativa: thin-client Expo (mobile) + Tauri (desktop)
│       ├── package.json · app.json · tsconfig.json · babel.config.js · metro.config.js
│       ├── CLAUDE.md (= @AGENTS.md) · AGENTS.md · LICENSE · .claude/settings.json
│       ├── app/{_layout,index}.tsx   # Expo Router: WebView → http://<server>/staff (thin-client)
│       ├── assets/*.png           # icone app (iOS/Android/web)
│       ├── standalone-dist/index.html  # frontend Tauri: splash che attende il server :4317
│       └── src-tauri/             # shell desktop Tauri 2 (modello AIKE)
│           ├── Cargo.toml · build.rs · tauri.conf.json  # config Rust/Tauri
│           ├── src/{main.rs,lib.rs}  # spawna il server Tako come figlio, carica dashboard
│           ├── capabilities/default.json  # permessi Tauri (http allow)
│           ├── icons/             # icone desktop (macOS/Windows/Linux/iOS/Android)
│           └── resources/         # ── BUNDLE impacchettato nell'installer (build artifact)
│               ├── server/        # server.mjs bundlato + node_modules + node runtime + migrations + staff/
│               └── web/           # build standalone della customer PWA (server.js Next)
│
├── packages/
│   ├── db/                       # ── schema Postgres (Drizzle) + DB embedded + migrazioni
│   │   ├── package.json · tsconfig.json · drizzle.config.ts
│   │   ├── pg-portable.mjs       # Postgres portatile per dev (no brew/docker)
│   │   ├── embedded → src/embedded.ts  # (export package) DB embedded avviato dal server
│   │   ├── seed-bootstrap.mjs    # crea 2 ristoranti demo + owner (UUID fissi, idempotente)
│   │   ├── seed-demo.mjs         # popola menu demo (Nino + Test Pizza)
│   │   ├── rls-check.mjs         # verifica isolamento RLS come ruolo tako_app
│   │   ├── migrate-0006.mjs      # money real→numeric(10,2) + indici + unique tavolo
│   │   ├── migrate-phone.mjs     # aggiunge users.phone (0004)
│   │   ├── migrate-sessions.mjs  # applica 0005 (table_sessions)
│   │   └── src/
│   │       ├── index.ts          # barrel: client + schema
│   │       ├── client.ts         # client Drizzle LAZY (legge DATABASE_URL alla 1ª query)
│   │       ├── embedded.ts       # maybeStartEmbeddedDb(): Postgres figlio + migrazioni idempotenti
│   │       ├── rls.ts            # withRestaurantContext(): SET LOCAL app.current_restaurant_id
│   │       └── schema/
│   │           ├── index.ts · money.ts · restaurants.ts · users.ts · menu.ts
│   │           ├── tables.ts · orders.ts · bills.ts · inventory.ts · sessions.ts
│   │           └── migrations/   # SQL Drizzle 0000→0006 + meta/_journal
│   │
│   └── types/
│       └── src/index.ts          # SocketEvents, OrderStatus, payload API/Socket, PublicMenu...
│
├── scripts/
│   ├── tako.mjs                  # `pnpm tako`: avvio tutto-in-uno (1 processo, DB embedded, :4317)
│   └── build-server-bundle.mjs  # esbuild: crea il bundle server autosufficiente per l'app desktop
│
├── tests/                       # ── test integrazione (girano contro stack vivo)
│   ├── helpers.ts · correctness.test.ts · realtime.test.ts · simulation.test.ts
│
├── .claude/                     # ── team multi-agente Claude + bus a file
│   ├── CLAUDE.md · MASTER_PLAN.md · MASTER_PLAN-cloud-auth.md · settings(.local).json
│   ├── agents/*.md              # system prompt dei 14 subagent
│   ├── commands/master-orchestratore.md
│   └── comms/{TASK_LEDGER.json,AGENT-LOG.md,handoffs/,contracts/}
│
├── strategia-vendita/           # ── doc business (gitignored, privati)
│   ├── 01-analisi · 02-strategia-vendita · 03-piano-marketing · 05-piano-finanziario · 06-roadmap
│   └── copy/{ad-copy,email-sequence,landing-page,pitch-deck-script,social-posts}.md
│
├── Tako Dashboard App/          # ── prototipo originale dashboard (sorgente del verbatim)
│   ├── Tako Dashboard.html · assets.zip · assets/
│
└── uploads/                     # cartella runtime upload immagini (vuota nel repo)
```

## A.2 — Tabelle `file | ruolo`

### Root
| file | ruolo |
|---|---|
| `package.json` | Workspace root: script `dev/build/lint/test` via Turbo, `db:*` su `@tako/db`, `pnpm tako`. pnpm@9, Node ≥20. |
| `pnpm-workspace.yaml` | Dichiara i workspace `apps/*` e `packages/*`. |
| `turbo.json` | Pipeline Turborepo: `build` (output `.next`/`dist`), `dev` persistente, `lint`, `db:generate/migrate/studio`. |
| `tsconfig.base.json` | TS condiviso: ES2022, NodeNext, `strict`, `noUncheckedIndexedAccess`. |
| `vitest.config.ts` | Test in `tests/**`, seriali, contro lo stack dev vivo. |
| `docker-compose.yml` | Stack dev completo: postgres(16) + redis(7) + server + dashboard + web; DB/redis solo localhost. |
| `docker-compose.prod.yml` | Core produzione: postgres + redis + server; DB su ruolo `tako_app` (RLS). |
| `.env` / `.env.example` | Env locale e template: `JWT_SECRET`, `DATABASE_URL`, URL frontend, Redis, OpenAI, porta. |
| `.env.production.example` | Template prod: credenziali Postgres, `tako_app` per RLS, chiavi AI. |
| `.gitignore` | Esclude node_modules, build, `.env`, `.pgdata`, artefatti Expo/Tauri, segreti, `strategia-vendita/`. |
| `CLAUDE.md` | Istruzioni progetto: stack, comandi, protocollo routine autonoma + team agenti + ownership file. |
| `TAKO.md` | **Fonte di verità unica**: architettura, ✅ fatto, 🟡 parziale, ⛔ backlog, deploy cloud, decisioni. |
| `manu.md` | Handoff operativo: stato deploy cloud/Render, Safe Browsing Google, SEO, to-do di Manuel, posizione worktree. |
| `uploads/` | Directory runtime per immagini caricate. |

### apps/server (cuore — Fastify + Socket.io + Drizzle)
| file | ruolo |
|---|---|
| `src/bootstrap.ts` | Entrypoint: auto-provvede `JWT_SECRET`/`GROQ_API_KEY` da file in `TAKO_HOME`/`~/.tako`, avvia DB embedded, poi `startServer()`. |
| `src/index.ts` | `startServer()`: registra CORS/helmet/jwt/cookie/multipart/rate-limit/static, monta tutte le route, crea Socket.io, serve `/staff`. |
| `src/lib/billing.ts` | Logica conti: `round2`, `BILLABLE_STATUSES`, `recomputeOpenBill` (prezzi sempre dal DB). |
| `src/lib/cookies.ts` | Cookie HttpOnly: `tako_session` (staff), `tako_table` (cliente); Secure dietro TLS. |
| `src/lib/mdns.ts` | Annuncio mDNS `tako.local` sulla LAN (degrada a IP). |
| `src/lib/network.ts` | IPv4 LAN non-loopback per la schermata "collega dispositivi". |
| `src/lib/printer.ts` | Costruisce ricevuta ESC/POS e la invia alla stampante termica via TCP. |
| `src/middleware/auth.ts` | `requireAuth`: valida sessione staff (cookie `tako_session`, fallback Bearer). |
| `src/routes/auth.ts` | Login/logout staff, sessioni, set/clear cookie. |
| `src/routes/restaurants.ts` | CRUD ristorante, settings, branding. |
| `src/routes/menu.ts` | Menu/sezioni/piatti/varianti (lettura + scrittura). |
| `src/routes/tables.ts` | Tavoli, stanze, QR token, stato tavolo. |
| `src/routes/orders.ts` | Ordini (comanda staff + cliente), transizioni di stato, totali dal DB, idempotency. |
| `src/routes/bills.ts` | Conti: apertura/chiusura/pagamento; fix leak cross-tenant. |
| `src/routes/inventory.ts` | Magazzino: item, movimenti, alert scorte. |
| `src/routes/stats.ts` | Statistiche/KPI ristorante. |
| `src/routes/insights.ts` | Analytics AI: menu engineering (Boston Matrix) via Groq. |
| `src/routes/customer.ts` | Lato cliente: resolve QR→tavolo, menu pubblico, waiter-call, AI chat. |
| `src/routes/staff.ts` | Gestione personale: add/delete, PIN bcrypt, phone. |
| `src/routes/print.ts` | `POST /order`: stampa comanda termica (auth richiesta). |
| `src/routes/system.ts` | `/info`: URL LAN + `tako.local` + QR per onboarding dispositivi. |
| `src/routes/uploads.ts` | Upload immagini: MIME whitelist + magic-bytes, processing sharp. |
| `src/socket/handlers.ts` | Socket.io: autentica handshake dal cookie staff, join room `restaurant:{id}` / `table:{id}`. |
| `src/types/multicast-dns.d.ts` | Type shim per `multicast-dns`. |

### apps/web (customer PWA)
| file | ruolo |
|---|---|
| `next.config.ts` | `output:'standalone'`, rewrite `/api` e `/socket.io` → server. |
| `public/manifest.json` · `mascotte/*.png` | Manifest PWA + mascotte cliente. |
| `src/app/page.tsx` | Splash/landing con QR finto decorativo. |
| `src/app/r/[restaurantId]/t/[token]/page.tsx` | Entry dal QR del tavolo → monta `CustomerApp`. |
| `src/components/CustomerApp.tsx` | Orchestratore del flusso cliente. |
| `src/components/MenuView.tsx` | Menu dal DB: sezioni, piatti, varianti, filtri. |
| `src/components/CartView.tsx` | Carrello + invio ordine con idempotency key. |
| `src/components/OrderTracking.tsx` | Tracking realtime degli stati ordine. |
| `src/components/AiChat.tsx` | Assistente cliente AI con azioni (ordina, chiama cameriere). |
| `src/components/ui/{Bubbles,Dish,Sheet}.tsx` | Bolle ambient, tile piatto gradiente, bottom-sheet. |
| `src/lib/{api,socket,store,motion,utils}.ts` | Axios, socket singleton, zustand carrello, animazioni, util. |

### apps/dashboard (staff — Next shell + SPA verbatim)
| file | ruolo |
|---|---|
| `next.config.ts` | Redirect `/`→`/staff/index.html`, rewrite `/api` e `/socket.io` → server. |
| `public/manifest.webmanifest` · `icons/*` | Manifest + icone PWA dashboard. |
| `public/sw.js` | Service worker: cache shell statica, mai API/socket. |
| `public/takos/<colore>/*` | Mascotte Tako in 5 colori × ~10 pose. |
| `public/staff/index.html` | Entry della **SPA staff verbatim**: boot screen + React/Babel da CDN + `src/*`. |
| `public/staff/styles.css` | Stile completo della dashboard. |
| `public/staff/lib/{react,react-dom,babel}.js` | React + Babel standalone (SPA senza build step). |
| `public/staff/src/01-data.js` | Data layer reale: fetch `/api` + socket. |
| `public/staff/src/02-kit.js` | Primitivi UI + icone Lucide-style. |
| `public/staff/src/03-shell-nav.js` | Shell responsive + navigazione. |
| `public/staff/src/04-screens-operative.js` | Dashboard home, Ordini live, KDS cucina. |
| `public/staff/src/05-screens-sala-cassa.js` | Sala, Cassa, Comanda, Tavoli, QR. |
| `public/staff/src/06-screens-gestione.js` | Menu, Statistiche, Analisi menu, Inventario, Staff, Impostazioni. |
| `public/staff/src/07-app-root.js` | App root wirata: auth cookie, branding, routing. |
| `src/app/page.tsx` | Fallback: meta-refresh verso `/staff/index.html`. |
| `src/app/layout.tsx` · `providers.tsx` · `not-found.tsx` | Font, React Query + brand store + Toaster, 404 brandizzata. |
| `src/components/layout/AppShell.tsx` | Shell React con nav per ruolo (parte Next). |
| `src/components/PWARegister.tsx` | Registra il service worker in contesto sicuro. |
| `src/components/ui/{index,icon,kit,Tako,Toaster}.tsx` | Barrel kit, icone, primitivi, mascotte, toast. |
| `src/hooks/useSocket.ts` | Hub realtime: eventi socket → invalidazioni React Query. |
| `src/lib/api.ts` · `socket.ts` | Axios (`/api`, withCredentials); socket same-origin via cookie. |
| `src/lib/store.ts` · `brand-store.ts` | Auth+theme (persist); palette brand ↔ `primaryColor`. |
| `src/lib/comanda-store.ts` · `ui-bus.ts` · `utils.ts` | Carrello cameriere; bus notifiche live; `cn/formatEuro/formatDate`. |

### apps/app (nativa — Expo + Tauri thin-client)
| file | ruolo |
|---|---|
| `package.json` · `app.json` · `babel.config.js` · `metro.config.js` | Config Expo; Metro impacchetta l'HTML standalone come asset. |
| `CLAUDE.md` (`@AGENTS.md`) · `AGENTS.md` | Istruzioni app nativa: usare i doc Expo v56 esatti. |
| `app/_layout.tsx` · `app/index.tsx` | Root Expo Router; WebView thin-client → `http://<server>/staff` (default `tako.local:4317`). |
| `standalone-dist/index.html` | Frontend Tauri: splash che fa polling su `:4317/health` poi carica `/staff`. |
| `src-tauri/Cargo.toml` · `build.rs` · `tauri.conf.json` | Manifest Rust/Tauri 2, config finestra/bundle. |
| `src-tauri/src/main.rs` · `lib.rs` | Entry binario; shell desktop AIKE: spawna il server Tako come figlio (`:4317`), lo termina alla chiusura. |
| `src-tauri/capabilities/default.json` | Permessi Tauri (allow http/https). |
| `src-tauri/resources/server/` | **Build artifact**: `server.mjs` bundlato + `node_modules` + runtime `node` + `migrations/` + `staff/`. |
| `src-tauri/resources/web/` | **Build artifact**: build standalone della customer PWA impacchettata. |

### packages/db
| file | ruolo |
|---|---|
| `drizzle.config.ts` | Config drizzle-kit (schema→migrations). |
| `pg-portable.mjs` | Postgres portatile per dev (no brew/docker), persistente su `.pgdata`. |
| `seed-bootstrap.mjs` | Crea 2 ristoranti demo (UUID fissi) + owner. Idempotente. |
| `seed-demo.mjs` | Popola menu demo (Trattoria da Nino + Test Pizza). |
| `rls-check.mjs` | Verifica isolamento RLS come ruolo non-superuser `tako_app`. |
| `migrate-0006.mjs` | Converte money `real`→`numeric(10,2)`, indici, unique numero tavolo. |
| `migrate-phone.mjs` · `migrate-sessions.mjs` | Migrazioni 0004 (phone) e 0005 (table_sessions). |
| `src/client.ts` | Client Drizzle **lazy** (connessione alla 1ª query). |
| `src/embedded.ts` | `maybeStartEmbeddedDb()`: Postgres embedded (`EMBEDDED_DB=1`), migra idempotente, heal stale-lock. |
| `src/rls.ts` | `withRestaurantContext()`: `SET LOCAL app.current_restaurant_id` in transazione. |
| `src/schema/money.ts` | Tipo custom `money` = `numeric(10,2)` ↔ `number` JS. |
| `src/schema/restaurants.ts` | `restaurants` + `RestaurantSettings` (currency/timezone/vatRate/lingue). |
| `src/schema/users.ts` | `users` (ruoli, PIN, phone, avatar) + `sessions`. |
| `src/schema/menu.ts` | `menus`, `menu_sections`, `menu_items`, `item_variants`, traduzioni. |
| `src/schema/tables.ts` | `rooms`, `tables` (QR token, posX/posY, shape, waiter). |
| `src/schema/orders.ts` | `orders` (stati, idempotencyKey, waiter) + `order_items`. |
| `src/schema/bills.ts` | `bills` (subtotale/sconto/tip/total/covers) + `bill_payments`. |
| `src/schema/inventory.ts` | `inventory_items` + `inventory_movements`. |
| `src/schema/sessions.ts` | `table_sessions`: scansioni QR, first-order, time-to-first-order. |
| `src/migrations/0000…0006` | SQL Drizzle: init, cost_price, RLS, indici, staff phone, table_sessions, money numeric. |

### packages/types
| file | ruolo |
|---|---|
| `src/index.ts` | `SocketEvents`, `OrderStatus`/`TableStatus`/`UserRole`, payload ordini/API, `PublicMenu`/`PublicItem`/`PublicVariant`. |

### scripts
| file | ruolo |
|---|---|
| `tako.mjs` | `pnpm tako`: avvio "tutto-in-uno" (1 processo: API+Socket+`/staff`+Postgres embedded su `:4317`). |
| `build-server-bundle.mjs` | esbuild: bundla il codice nostro (server + `@tako/*`), npm esterni esterni, output in `apps/app/src-tauri/resources/server/`. |

### tests
| file | ruolo |
|---|---|
| `helpers.ts` | `seedTestEnv`, `getTableCookie`, URL `SERVER`/`DB`. |
| `correctness.test.ts` | Correttezza dati/prezzi e isolamento multi-tenant. |
| `realtime.test.ts` | Eventi Socket.io end-to-end. |
| `simulation.test.ts` | "Ristorante pieno" (12 ordini concorrenti). |

### .claude (team multi-agente)
| file | ruolo |
|---|---|
| `CLAUDE.md` | Contratto madre: orchestratore + 13 subagent (modelli per ruolo, Normal/Master, ownership). |
| `MASTER_PLAN.md` | Piano [MASTER]: migrazione auth a cookie HttpOnly + JWT tavolo. |
| `MASTER_PLAN-cloud-auth.md` | Piano [MASTER]: identità unificata sito↔app (cloud control-plane). |
| `commands/master-orchestratore.md` | Slash-command: attiva l'orchestratore (caveman, 3 subagent paralleli). |
| `agents/architect.md` | [MASTER]: produce `MASTER_PLAN.md`. Opus. |
| `agents/backend.md` | API/route/middleware/auth/business logic. Ownership `src/routes`,`middleware`. Opus. |
| `agents/database.md` | Schema/migrazioni/query/indici/seed. Ownership `packages/db`. Opus. |
| `agents/frontend.md` | UI/componenti/stato client. Opus. |
| `agents/integrations.md` | API esterne/webhook/provider/job. Opus. |
| `agents/testing.md` | Unit/integration/e2e. Opus. |
| `agents/devops.md` | CI/CD, Docker, env, deploy, scripts. Opus. |
| `agents/refactor.md` | Refactor a comportamento invariato. Opus. |
| `agents/security-review.md` | Audit read-only OWASP/secret/auth; output JSON. Opus. |
| `agents/docs.md` | Documentazione tecnica. Sonnet. |
| `agents/planner.md` | Decompone richieste in microtask JSON. Sonnet. |
| `agents/verifier.md` | Verifica output batch vs expected. Sonnet. |
| `agents/ledger-writer.md` | Aggiorna `TASK_LEDGER.json` e `AGENT-LOG.md`. Haiku. |
| `agents/prompt-architect.md` | Genera prompt per immagini/video AI. Opus. |
| `comms/TASK_LEDGER.json` · `AGENT-LOG.md` · `handoffs/` | Stato microtask, log sessione, passaggi tra agenti. |
| `comms/contracts/*.contract.md` | Template + report audit sicurezza + sweep multi-tenant. |

### strategia-vendita / prototipo (business + sorgente UI)
| file | ruolo |
|---|---|
| `strategia-vendita/01..06-*.md` | Analisi progetto, strategia vendita, piano marketing, piano finanziario, roadmap. |
| `strategia-vendita/copy/*.md` | Ad copy, email sequence, landing copy, pitch deck, social posts. |
| `Tako Dashboard App/Tako Dashboard.html` | Prototipo monolitico originale (sorgente del "verbatim" in `public/staff`). |
| `Tako Dashboard App/assets.zip` · `assets/` | Asset/mascotte del prototipo. |

> **Nota:** tre stadi della stessa dashboard: prototipo `Tako Dashboard.html` → modulare in
> `apps/dashboard/public/staff/` → build artifact in `apps/app/src-tauri/resources/server/staff/`.
> Money è `numeric(10,2)` end-to-end; i prezzi ordini sono sempre ricalcolati dal DB (`lib/billing.ts`).

---

# PARTE B — `~/Projects/Tako-cloud-auth` (worktree control-plane cloud)

> Branch `feat/cloud-auth-20260625`. Stesso monorepo + il **control-plane cloud** (`TAKO_MODE=cloud`):
> servizio Fastify separato per identità owner (register/login email+password, OAuth Google/GitHub),
> verifica email / reset password, sessioni cloud, pairing appliance↔cloud (device-code + PoP ed25519).
> Deploy su Render/Fly, dominio `api.takoitalia.com`. Il cloud NON contiene dati operativi: solo
> identità, registry ristoranti e appliance collegate. Local e cloud condividono il codebase ma usano
> DB, segreti, schema Drizzle e middleware **separati** (`src/cloud/*`, `schema/cloud/*`).

## B.1 — Delta rispetto al core (file/cartelle SOLO di questo branch)

> Tutto il resto è identico alla Parte A. Qui sotto solo ciò che la feature cloud aggiunge.

```
Tako-cloud-auth/
├── render.yaml                   # blueprint deploy CLOUD su Render (Dockerfile.cloud, env, segreti)
├── docker-compose.prod.yml       # stack prod "core" appliance: postgres + redis + server
├── docs/                         # doc di progetto (presente, più ricca del core)
│   ├── MASTER-PLAN.md · ARCHITETTURA.md · API-CONTRATTI.md · AVVIO-LOCALE.md
│   ├── deploy/RUNBOOK.md
│   ├── design/{customer-pwa-redesign-brief,dashboard-redesign-brief}.md
│   └── security/{hardening-guide,threat-model,pentest-report-2026-05-07}.md
├── tests/                        # test integrazione root (correctness/realtime/simulation + helpers)
│
└── apps/server/
    ├── vitest.cloud.config.ts    # config Vitest dedicata ai test cloud
    ├── deploy/                   # ── deploy del control-plane CLOUD
    │   ├── Dockerfile.cloud      # immagine CLOUD (no postgres embedded, tsx, entry=cloud/entry.ts)
    │   ├── fly.toml              # config deploy Fly.io
    │   ├── deploy-cloud.sh       # script deploy cloud
    │   ├── README-CLOUD-DEPLOY.md · GUIDA-MANUALE-PASSO-PASSO.md
    └── src/
        ├── cloud/                # ── CONTROL-PLANE (isolato dal local)
        │   ├── entry.ts          # entrypoint cloud: forza TAKO_MODE=cloud, niente DB embedded
        │   ├── server.ts         # buildCloudApp(): CORS allowlist, helmet, rate-limit Redis, route cloud
        │   ├── config.ts         # env cloud (SITE_BASE_URL, ALLOWED_ORIGINS, cookieMode, OAuth, safeRedirect)
        │   ├── db.ts             # client Drizzle CLOUD (CLOUD_DATABASE_URL + schema/cloud, lazy, isolato)
        │   ├── security.ts       # token/HMAC pepper, password policy bcrypt, normalizeEmail, TTL
        │   ├── session.ts        # issueCloudSession(): crea sessione owner + set cookie (+CSRF)
        │   ├── cookies.ts        # nomi/opzioni cookie sessione+CSRF, SameSite secondo COOKIE_MODE
        │   ├── redis.ts          # Redis condiviso + anti-abuso (lockout/quota/nonce) con fallback in-memory
        │   ├── email.ts          # email (mock|resend) + quota anti mail-bombing + template
        │   └── audit.ts          # audit log sicurezza → cloud_audit_log (best-effort)
        ├── middleware/cloudAuth.ts  # auth cloud: sessione owner da cookie + double-submit CSRF
        ├── routes/cloud/
        │   ├── auth.ts           # register/login/logout/me + verify-email/forgot/reset (anti-enum, token HMAC single-use)
        │   ├── oauth.ts          # OAuth Google/GitHub (state+PKCE, no merge silenzioso, redirect allowlist)
        │   ├── pair.ts           # device-code pairing: code/approve/claim/heartbeat (PoP ed25519, single-use)
        │   └── contact.ts        # form pubblico "scrivici/demo" → email al titolare (no account)
        ├── routes/setup.ts       # pairing appliance↔cloud lato local + heartbeat loop
        ├── routes/print.ts · system.ts   # (presenti anche nel core)
        ├── lib/cloud-client.ts   # client appliance→cloud: keypair ed25519 cifrata, claim()+heartbeat()
        └── tests/cloud/          # test control-plane (Vitest, app montata senza listen)
            ├── helpers.ts · auth-flows.test.ts · oauth.test.ts · pairing.test.ts
            └── cross-tenant.test.ts · csrf-cors.test.ts · security-unit.test.ts

    packages/db/                  # ── aggiunte CLOUD allo schema
    ├── drizzle.cloud.config.ts   # config drizzle-kit schema CLOUD
    ├── scripts/apply-cloud-sql.mjs  # applica SQL schema cloud
    └── src/schema/cloud/
        ├── index.ts
        ├── owners.ts             # cloud_owners + cloud_oauth_accounts (identità + OAuth link)
        ├── tokens.ts             # token verifica email + reset password (HMAC, single-use)
        ├── sessions.ts           # cloud_sessions (token_hash HMAC, credentials_version)
        ├── restaurants.ts        # cloud_restaurants + cloud_appliances + cloud_pairing_codes
        └── audit.ts              # cloud_audit_log (eventi sicurezza)
    └── src/migrations-cloud/0000_init_cloud_identity.sql + meta/_journal.json
```

## B.2 — Tabelle `file | ruolo` (solo i file cloud)

### apps/server/src/cloud/ — control-plane
| file | ruolo |
|---|---|
| `entry.ts` | Entrypoint cloud: forza/valida `TAKO_MODE=cloud`, evita import del DB embedded nativo. |
| `server.ts` | `buildCloudApp()`/`startCloudServer()`: helmet+CSP, CORS allowlist esatta, cookie firmati, rate-limit Redis, error-handler che non espone stack, `/health`, registrazione route auth/oauth/pair/contact. |
| `config.ts` | Env cloud centralizzato + `siteBaseUrl/allowedOrigins/cookieMode/oauth*` + `buildVerifyUrl/buildResetUrl` + `safeRedirect` (anti open-redirect). |
| `db.ts` | Client Drizzle **cloud** lazy su `CLOUD_DATABASE_URL` con `schema/cloud` (fail-fast, mai il DB locale). |
| `security.ts` | `TOKEN_PEPPER` HMAC a riposo, generazione token URL/sessione/CSRF, bcrypt + password policy, `normalizeEmail`, TTL, confronto timing-safe. |
| `session.ts` | `issueCloudSession()`: crea `cloud_sessions`, set cookie sessione (+CSRF crosssite), salva solo `token_hash`. |
| `cookies.ts` | Nomi/opzioni cookie sessione/CSRF; SameSite/Secure secondo `COOKIE_MODE`. |
| `redis.ts` | Redis condiviso + anti-abuso (lockout per-code, quota anti mail-bombing, nonce/anti-replay) con fallback in-memory. |
| `email.ts` | Servizio email (`mock`/`resend`) + quota + template verifica/reset; `validateEmailConfig()`. |
| `audit.ts` | Scrittura `cloud_audit_log` per eventi sensibili (login/register/reset/verify/oauth), best-effort. |

### apps/server/src/routes/cloud/ — API cloud
| file | ruolo |
|---|---|
| `auth.ts` | `register/login/logout/me`, `verify-email` (GET non-consuma / POST consuma atomico), `resend-verification`, `forgot-password`, `reset-password` (bump `credentials_version` + revoca sessioni). Anti-enumeration, token HMAC single-use. |
| `oauth.ts` | OAuth Google/GitHub: `state`+PKCE, `redirect_uri` da `OAUTH_BASE_URL`, niente merge silenzioso su owner non verificato, redirect post-callback solo su allowlist; montate solo se il provider è configurato. |
| `pair.ts` | Device-code pairing: `POST /code` (owner autenticato, auto-approve), `/approve` (no-op idempotente), `/claim` (snapshot owner non-segreto + applianceToken, PoP ed25519, single-use atomico), `/heartbeat` (firma + monotonic ts). |
| `contact.ts` | Form pubblico "scrivici/demo": valida (zod), escape HTML, invia email al titolare (`ADMIN_NOTIFY_EMAIL`); nessun account creato. |

### Altri file cloud
| file | ruolo |
|---|---|
| `middleware/cloudAuth.ts` | `requireCloudAuth` (sessione owner da cookie opaco) + `requireCsrf` (double-submit `X-Tako-CSRF`). |
| `routes/setup.ts` | Setup/pairing lato appliance + `startHeartbeatLoop` verso il cloud. |
| `lib/cloud-client.ts` | Client appliance→cloud: keypair ed25519 cifrata AES-256-GCM in `~/.tako/cloud-identity.enc`, `claim()`/`heartbeat()`. |
| `deploy/Dockerfile.cloud` | Immagine cloud: niente DB embedded, niente auto-JWT, entry `src/cloud/entry.ts`. |
| `deploy/fly.toml` · `deploy-cloud.sh` · `README-CLOUD-DEPLOY.md` · `GUIDA-MANUALE-PASSO-PASSO.md` | Config + script + guide deploy cloud. |
| `render.yaml` | Blueprint Render: usa `Dockerfile.cloud`, segreti `sync:false`, `SESSION_SECRET`/`TOKEN_PEPPER` auto-generati. |
| `vitest.cloud.config.ts` · `tests/cloud/*.test.ts` | Config + test del control-plane (auth-flows, oauth, pairing, cross-tenant, csrf-cors, security-unit). |

### packages/db/src/schema/cloud/ — schema cloud
| file | ruolo |
|---|---|
| `owners.ts` | `cloud_owners` (email, passwordHash nullable, emailVerified, `credentialsVersion`) + `cloud_oauth_accounts`. |
| `tokens.ts` | Token verifica email + reset password (HMAC, single-use, TTL). |
| `sessions.ts` | `cloud_sessions` (`token_hash`, expires, `credentialsVersion`, ip/UA). |
| `restaurants.ts` | `cloud_restaurants` + `cloud_appliances` (pubkey PoP) + `cloud_pairing_codes` (HMAC, TTL 10min). |
| `audit.ts` | `cloud_audit_log`. |
| `migrations-cloud/0000_init_cloud_identity.sql` | Migrazione iniziale schema cloud. |
| `drizzle.cloud.config.ts` · `scripts/apply-cloud-sql.mjs` | Config drizzle-kit cloud + applica SQL cloud. |

### docs/ (presente in questo branch)
| file | ruolo |
|---|---|
| `MASTER-PLAN.md` · `ARCHITETTURA.md` · `API-CONTRATTI.md` · `AVVIO-LOCALE.md` | Piano prodotto, architettura, contratti API, guida avvio locale. |
| `deploy/RUNBOOK.md` | Runbook deploy/operazioni. |
| `design/*` · `security/*` | Brief redesign dashboard/PWA; hardening, threat model, pentest. |

---

# PARTE C — `~/Projects/Tako-site-auth` (worktree sito + client cloud-auth)

> Branch `feat/site-auth-20260625`. Stesso monorepo + la **landing/sito vetrina** (`landing/`):
> HTML statici che montano componenti React via Babel in-browser. `landing/tako-api.js` fa da
> **client** del control-plane cloud (`api.tako.app /api/auth/*`, OAuth, verify-email, reset-password):
> il sito è il front-end pubblico, il cloud-auth (Parte B) è il servizio di identità.
> Questo branch è su uno **stato più vecchio del core** (schema DB con solo migrazioni 0000–0002,
> niente DB embedded/Tauri): qui conta soprattutto la cartella `landing/`.

## C.1 — Delta rispetto al core: la cartella `landing/`

```
Tako-site-auth/
└── landing/                     # ── SITO VETRINA + PROTOTIPI (statico, React via Babel)
    ├── index.html               # redirect a "Tako Landing.html"
    ├── Tako Landing.html         # homepage marketing (monta tako-landing.jsx)
    ├── Tako App.html             # demo PWA cliente "ordina al tavolo"
    ├── Tako Dashboard.html       # demo dashboard ristoratore
    ├── Tako Demo.html            # pagina demo/trial interattiva
    ├── Tako Showcase.html        # showcase "un sistema, due lati" (PWA↔dashboard in sync)
    ├── Tako Pagine.html          # host pagine secondarie (router ?p=slug)
    ├── privacy.html · termini.html  # pagine legali
    ├── reset-password.html       # reset password (→ cloud auth)
    ├── verify-email.html         # verifica email via token (→ cloud auth)
    ├── robots.txt · sitemap.xml  # SEO
    ├── styles.css · tako-header.css  # CSS globale + header animato condiviso
    ├── favicon*.png/.ico · apple-touch-icon.png · og-image.png  # icone & Open Graph
    ├── tako-api.js               # CLIENT CLOUD AUTH: chiama api.tako.app (/api/auth/*, OAuth)
    ├── tako-i18n.jsx             # traduzioni UI per-iframe (it/en/es/de)
    ├── tako-kit.jsx              # icone, hook motion, bottom-sheet, toaster, primitivi
    ├── tako-data.jsx             # dati mock + store (cart/session/order) + simulazione
    ├── tako-menu.jsx             # vista menu cliente (sheet item, filtri, carrello)
    ├── tako-screens.jsx          # tracking ordine, chiamata cameriere, chat AI
    ├── tako-app.jsx              # PWA cliente: splash, shell, theme, mount (frame iPhone)
    ├── tako-landing.jsx          # root landing: routing pagine + assemblaggio home
    ├── tako-sections.jsx · tako-sections-2.jsx  # sezioni home (reveal/IntersectionObserver)
    ├── tako-pages.jsx            # primitivi/shell condivisi delle pagine (PageHeader...)
    ├── tako-pages-prodotto.jsx   # pagine Prodotto: Funzioni/AI/Integrazioni/Roadmap
    ├── tako-pages-risorse.jsx    # pagine Risorse: Aiuto/Blog/API/Community/Stato
    ├── tako-pages-azienda.jsx    # pagine Azienda: Chi siamo/Careers/Contatti/Privacy/Termini
    ├── tako-pages-blog.jsx       # articoli blog (case study)
    ├── tako-pages-reset.jsx      # form reset password (POST /api/auth/reset-password)
    ├── tako-extra-shell.jsx      # shell/router pagine footer (?p=slug)
    ├── tako-trial.jsx            # pagina "Prova Gratis" (hero simulazione + form)
    ├── tweaks-panel.jsx          # pannello "tweaks" riusabile per i prototipi
    ├── dashboard/                # prototipo dashboard standalone (demo)
    │   ├── app.jsx · data.jsx · kit.jsx · shell.jsx
    │   ├── screens-ops.jsx       # schermate operative (home, ordini, KDS)
    │   ├── screens-floor.jsx     # sala, cassa, comanda, tavoli, QR
    │   └── screens-manage.jsx    # gestione (menu, statistiche, inventario, staff, impostazioni)
    └── assets/                   # mascotte "Tako" + icone (nav/ + takos/<colore>/)
```

## C.2 — Tabelle `file | ruolo` (landing)

### landing/ — pagine HTML
| file | ruolo |
|---|---|
| `index.html` | Redirect alla home `Tako Landing.html`. |
| `Tako Landing.html` | Homepage marketing. |
| `Tako App.html` · `Tako Dashboard.html` | Demo PWA cliente; demo dashboard ristoratore. |
| `Tako Demo.html` · `Tako Showcase.html` | Demo/trial interattiva; showcase "due lati" in sync. |
| `Tako Pagine.html` | Host pagine secondarie (router `?p=slug`). |
| `privacy.html` · `termini.html` | Pagine legali. |
| `reset-password.html` · `verify-email.html` | Reset password e verifica email (→ **cloud auth** `api.tako.app`). |
| `robots.txt` · `sitemap.xml` | SEO. |
| `styles.css` · `tako-header.css` | CSS globale e header condiviso. |
| `favicon*.png/.ico` · `apple-touch-icon.png` · `og-image.png` | Icone e Open Graph. |

### landing/ — moduli JS/JSX
| file | ruolo |
|---|---|
| `tako-api.js` | **Client del control-plane cloud**: `apiGet/apiPost`, `oauthUrl(provider)` verso `/api/auth/*`. |
| `tako-i18n.jsx` | Traduzioni UI per-iframe (it/en/es/de). |
| `tako-kit.jsx` | Primitivi UI: icone, hook motion, bottom-sheet, toaster. |
| `tako-data.jsx` | Dati mock + store (cart/session/order) + simulazione ordini. |
| `tako-menu.jsx` | Vista menu cliente con sheet/filtri/carrello. |
| `tako-screens.jsx` | Tracking ordine, chiamata cameriere, chat AI. |
| `tako-app.jsx` | Root PWA cliente (splash, shell, theme, mount). |
| `tako-landing.jsx` | Root landing: routing + assemblaggio home. |
| `tako-sections.jsx` · `tako-sections-2.jsx` | Sezioni animate della home. |
| `tako-pages.jsx` | Primitivi/shell condivisi delle pagine. |
| `tako-pages-prodotto.jsx` | Pagine Prodotto (Funzioni/AI/Integrazioni/Roadmap). |
| `tako-pages-risorse.jsx` | Pagine Risorse (Aiuto/Blog/API/Community/Stato). |
| `tako-pages-azienda.jsx` | Pagine Azienda (Chi siamo/Careers/Contatti/Privacy/Termini). |
| `tako-pages-blog.jsx` | Articoli blog (case study). |
| `tako-pages-reset.jsx` | Form reset password (POST `/api/auth/reset-password`). |
| `tako-extra-shell.jsx` | Shell/router pagine del footer. |
| `tako-trial.jsx` | Pagina "Prova Gratis" (hero simulazione + form registrazione). |
| `tweaks-panel.jsx` | Pannello "tweaks" riusabile per i prototipi. |

### landing/dashboard/ — prototipo dashboard standalone
| file | ruolo |
|---|---|
| `app.jsx` | Root demo dashboard (ordini real-time mock o modalità `?sync`). |
| `data.jsx` | Dati demo ("Trattoria da Mario"). |
| `kit.jsx` · `shell.jsx` | Primitivi/icone demo; shell responsive + navigazione. |
| `screens-ops.jsx` | Schermate operative (home, ordini, KDS). |
| `screens-floor.jsx` | Sala, cassa, comanda, tavoli, QR. |
| `screens-manage.jsx` | Gestione (menu, statistiche, inventario, staff, impostazioni). |

### landing/assets/ — immagini
| gruppo | ruolo |
|---|---|
| `tako-*.png/.jpg` | Mascotte "Tako" in varie pose (chef, cloche, bell, pasta, tablet, phone, thumbsup, hello, hugplate, bowtie, assistant, logo). |
| `nav/m-*.png` | Icone bottom-navigation PWA (bag, bell, menu, order). |
| `nav/nav-*.png/.jpeg` | Thumbnail di navigazione (customer, home, how, restaurant). |
| `takos/{arancione,blu,giallo,rosa,verde}/` | Stesso set di pose mascotte per colore brand. |

---

## Appendice — asset mascotte (vale per tutte e 3 le cartelle)

Le cartelle `takos/<colore>/` (`arancione`, `blu`, `giallo`, `rosa`, `verde`) — presenti in
`apps/dashboard/public/takos`, `apps/dashboard/public/staff/assets/takos`, `apps/web/public/mascotte`,
`landing/assets/takos` e nel prototipo `Tako Dashboard App/assets/takos` — contengono lo **stesso
identico set** di PNG della mascotte Tako per ogni colore: `cassa`, `elegante`, `logo`, `mangia`,
`neutro`, `pasta`, `piatto`, `pollice_in_su`, `telefono`, `tako-bowtie`, `tako-chef`, `tako-cloche`,
`tako-eat`, `tako-neutral`, `tako-pasta`, `tako-pay`, `tako-phone`, `tako-thumbsup` (solo `arancione`
ha anche `logo-chef` e `tako-logo`). La posa è codificata nel nome file. `src-tauri/icons/` contiene
le icone dell'app per ogni piattaforma/risoluzione: file binari di branding, uno per dimensione.
