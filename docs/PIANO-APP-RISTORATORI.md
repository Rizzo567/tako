# Piano — App mobile del ristoratore (Tako Owner)

> **Cos'è questo file.** Il piano eseguibile per costruire l'app con cui il ristoratore tiene
> Tako sotto controllo dal telefono. È scritto come **loop engineering**: ogni task ha Goal
> osservabile, Tool reali del repo, Verifier automatico, condizione di Stop testabile, Exit di
> fallimento e Rischio. Un agente lo esegue senza essere ri-promptato passo-passo.
>
> Repo: `/Users/manuel/Projects/Tako` · Versione corrente `0.1.6` (`apps/app/src-tauri/tauri.conf.json`)
> · Redatto il 2026-08-07 sulla base del codice letto, non di documenti.
>
> **Convenzione:** dove non ho trovato riscontro nel codice scrivo esplicitamente `[da verificare]`.

---

## Indice

1. [Ricognizione — cosa esiste davvero](#1-ricognizione--cosa-esiste-davvero)
2. [Il problema n.1: server locale ↔ telefono fuori dal ristorante](#2-il-problema-n1-server-locale--telefono-fuori-dal-ristorante)
3. [Decisioni architetturali (con alternative scartate)](#3-decisioni-architetturali-con-alternative-scartate)
4. [Funzionalità in ondate di rilascio](#4-funzionalità-in-ondate-di-rilascio)
5. [Il loop: fasi e task](#5-il-loop-fasi-e-task)
   - [F0 — Fondamenta](#f0--fondamenta-abilitano-tutto-il-resto)
   - [F1 — Accesso remoto](#f1--accesso-remoto-il-blocco-architetturale)
   - [F2 — Wave 1: MVP vendibile](#f2--wave-1-mvp-vendibile)
   - [F3 — Notifiche push](#f3--notifiche-push)
   - [F4 — Wave 2: magazzino, menu, statistiche](#f4--wave-2-magazzino-menu-statistiche)
   - [F5 — Wave 3: assistente AI, prenotazioni, staff](#f5--wave-3-assistente-ai-prenotazioni-staff)
   - [F6 — Distribuzione e collaudo sul campo](#f6--distribuzione-e-collaudo-sul-campo)
6. [Stima di effort per wave](#6-stima-di-effort-per-wave)
7. [Cosa richiede Manuel](#7-cosa-richiede-manuel-account-domini-spesa-decisioni)
8. [Rischi trasversali e cosa NON facciamo](#8-rischi-trasversali-e-cosa-non-facciamo)

---

## 1. Ricognizione — cosa esiste davvero

### 1.1 Stack

| Pezzo | Dove | Note |
|---|---|---|
| Server | `apps/server` — Fastify + Socket.io + Drizzle | `src/index.ts` monta 20 gruppi di route sotto `/api/*`. `PORT` default 3001 in dev; la shell Tauri esporta **4317** (`scripts/tako.mjs`) |
| DB | Postgres + Drizzle, `packages/db` | 17 migrazioni `0000`→`0016`; l'ultima è `0016_timestamptz_alignment.sql` → **la prossima è `0017`** |
| Dashboard staff | `apps/dashboard/public/staff/` | **SPA statica servita da Fastify** su `/staff/`, non più Next |
| PWA cliente | `apps/web` (Next 15, `output: 'standalone'`) | porta 3002 |
| App desktop | `apps/app` — shell **Tauri 2** che supervisiona server + web | `src-tauri/tauri.conf.json` |
| Scaffold mobile | `apps/app` è **anche** un progetto **Expo 56 / RN 0.85** | `app/index.tsx` è una WebView che punta a `http://tako.local:4317/staff/index.html` |
| Control-plane cloud | `apps/server/src/cloud/*` + `routes/cloud/*` (`TAKO_MODE=cloud`) | `api.takoitalia.com` |

### 1.2 Autenticazione owner — il pezzo più importante per l'app

`apps/server/src/middleware/auth.ts:13`:

```ts
const token = req.cookies?.[SESSION_COOKIE] ?? req.headers.authorization?.replace('Bearer ', '')
```

**Il server accetta già il token di sessione come `Authorization: Bearer`.** Lo stesso vale per il
logout (`routes/auth.ts:341`) e per il socket: `socket.on('join:restaurant', async (restaurantId, token?))`
in `apps/server/src/socket/handlers.ts:41-47` usa il cookie dell'handshake **oppure** il token
passato come secondo argomento.

Conseguenza operativa enorme: **un'app mobile può autenticarsi senza cookie**, evitando tutti i
problemi `SameSite`/`Secure` che nascono quando lo stesso backend è raggiunto sia in `http://` sulla
LAN sia in `https://` da fuori. Niente da riscrivere lato server.

Altri fatti verificati:
- Sessione staff: token `nanoid(64)`, **90 giorni** con refresh rolling giornaliero
  (`apps/server/src/lib/cookies.ts` → `STAFF_SESSION_MAX_AGE`, `middleware/auth.ts:30-38`).
- Revoca: `sessions` è una tabella (`packages/db/src/schema/sessions.ts`); `requireAuth` verifica
  anche `users.active = true` → disattivare l'utente uccide tutte le sue sessioni.
- Sessione PIN tablet: `nanoid(32)`, 12h (`routes/auth.ts:263`).
- Owner "cloud-synced": password locale dedicata `local_owner_secret_hash` per il login **offline**
  (`routes/setup.ts`, `routes/auth.ts:187-215`).

### 1.3 API già pronte per l'app (lette una per una)

`apps/server/src/routes/` — tutte sotto `requireAuth`, tutte scoped per `restaurantId` preso dalla
sessione (mai dal client):

- **Tavoli** `tables.ts`: `GET /api/tables`, `GET /api/tables/rooms`, `PATCH /api/tables/:tableId/status`
  (con guardia M7: non liberi un tavolo con conto aperto, riga 128-140), `POST /api/tables/:tableId/waiter-resolve`,
  `GET /api/tables/:tableId/qr`.
- **Ordini** `orders.ts`: `GET /api/orders/active` (riga 31), `GET /api/orders/table/:tableId`,
  `GET /api/orders/history`, `POST /api/orders`, `PATCH /api/orders/:orderId/status` (macchina a stati
  `ALLOWED_TRANSITIONS`, riga 16-27, + guardia di concorrenza riga 25-32 del blocco PATCH),
  `PATCH /api/orders/:orderId/items/:itemId/status`, `PATCH /api/orders/:orderId/cancel`.
- **Conti** `bills.ts`: `GET /api/bills/open` (riga 14), `POST /api/bills`, `PATCH /api/bills/:billId`
  (owner/cassiere), `POST /api/bills/:billId/payments` (riga 165 — **transazione + advisory lock**,
  chiude il conto, marca gli ordini `paid`, porta il tavolo a `cleaning`), `GET /api/bills/:billId`,
  `GET /api/bills/summary/today` (riga 283 — incasso, mance, n. conti, ticket medio, mancia esclusa
  dal ricavo).
- **Statistiche** `stats.ts`: `GET /api/stats/dashboard?from=&to=` — incasso, ticket medio, coperti,
  top 10 piatti, incasso giornaliero 7gg, conversione QR, ore di punta. Tutto nel fuso del ristorante.
- **Insight menu** `insights.ts`: `GET /api/insights/menu?days=30` (menu engineering a quadranti),
  `POST /api/insights/menu/ai` (owner), `PATCH /api/insights/menu/:itemId/cost`.
- **Magazzino** `inventory.ts`: `GET /`, `/alerts`, `/stats`, `/reorder`, `POST /:itemId/movements`,
  `POST /import-text`, `POST /import-confirm`.
- **Menu** `menu.ts`: CRUD completo + `PATCH /api/menus/items/:itemId/availability` (riga 189).
- **Prenotazioni** `reservations.ts`, **turni** `shifts.ts`, **staff** `staff.ts`,
  **stampa** `print.ts`, **sistema** `system.ts` (`/connectivity`, `/net-health`, `/info`).
- **Copilot owner** `ai-owner.ts`: `POST /api/ai/owner/chat`, `POST /api/ai/owner/chat/stream` (SSE),
  `POST /api/ai/owner/execute`.

**Registro azioni AI** `apps/server/src/lib/ai-actions.ts`: `const ACTIONS: ActionDef[]` (riga 281),
**55 azioni** — 5 cliente + 50 owner, di cui **33 `mutation`** e 17 `read`. Le `mutation` non si
eseguono mai in chat: si propongono (`pending[]`) e si eseguono solo via `POST /api/ai/owner/execute`,
unico punto con `allowMutation: true` (`ai-owner.ts:147`). Sette azioni hanno `roles` ristretti
(owner o owner+cassiere). Il motore richiede **Groq** (`GROQ_API_KEY`) → **serve internet**.

### 1.4 Realtime

Rooms in `apps/server/src/socket/handlers.ts`: `restaurant:{id}` (staff, autenticata),
`table:{id}`, `order:{id}`, `menu:{id}` (pubblica). Eventi server→client realmente emessi:
`order:new`, `order:updated`, `table:updated`, `waiter:called`, `waiter:resolved`, `menu:updated`,
`menu:item_availability`, `inventory:alert`, `reservation:changed`, `shift:updated`, `connectivity`.
La sessione del socket viene **rivalidata ogni 60s** e chiusa se scade o l'utente è disattivato.

### 1.5 Rete: LAN-first, e i suoi limiti

- `apps/server/src/lib/mdns.ts` annuncia `tako.local` (record A con tutti gli IPv4 LAN, TTL 120s).
- `apps/server/src/lib/network.ts` costruisce tre URL per il QR tavolo: `lanTableUrl` (`tako.local`,
  **default**, `qrMode: 'lan'`), `stableTableUrl` (resolver cloud), `ipTableUrl`.
- `apps/server/src/lib/connectivity.ts` sonda internet ogni 30s (`generate_204`) → evento
  `connectivity` + `isOnline()` per il fast-fail delle funzioni che richiedono rete.
- `apps/server/src/lib/tls.ts`: HTTPS locale **opt-in** con `TAKO_HTTPS=1`, cert self-signed
  persistito in `~/.tako/tls` (serve al secure context per `getUserMedia` della dettatura).

### 1.6 Cosa il cloud fa **oggi** — e cosa non fa

Esiste un control-plane completo con pairing e proof-of-possession:

- `routes/cloud/pair.ts`: device-code (HMAC a riposo, TTL 10 min, single-use atomico) →
  `POST /api/pair/claim` con `devicePubKey` ed25519 → l'appliance riceve `applianceToken` +
  snapshot **non segreto** dell'owner. `POST /api/pair/heartbeat` è **firmata ed25519**
  (payload canonico `{applianceId, ts, credentialsVersion}`), anti-replay ±90s + nonce monotono
  su Redis.
- L'heartbeat **pubblica già la rete LAN corrente**: `lanIp`, `lanHost`, `clientPort` finiscono in
  `cloud_appliances` (`packages/db/src/schema/cloud/restaurants.ts:30-32`).
- `routes/cloud/resolve.ts`: `GET /t/:applianceId/*` redirige il QR stabile alla LAN corrente.

**Ma il resolver redirige SOLO verso RFC1918 o `*.local`** (guardia `isPrivateLanIPv4`, commento in
testa a `resolve.ts`) → presuppone che il telefono sia **sulla stessa LAN**. Quindi:

> **Non esiste oggi nessun modo di raggiungere l'appliance da fuori dal ristorante.**
> Confermato anche da `docs/tako-gap-100-2026-07-13.md:130-135` (gap 🟠 16), che propone come
> rimedio *«un tunnel Cloudflare verso la porta staff»*. Nessun dato operativo viene sincronizzato
> sul cloud: `cloud_*` contiene solo identità e pairing.

L'**unica** superficie remota esistente è il **copilot WhatsApp** (`apps/server/src/lib/whatsapp.ts`,
620 righe): Baileys apre una connessione **in uscita**, l'owner scrive da qualunque rete, le mutation
richiedono un "SÌ" esplicito, c'è un briefing giornaliero programmato. È OFF di default e non
collaudato e2e — ma **dimostra che il pattern outbound-only funziona** su questa appliance.

### 1.7 La dashboard staff non è riusabile così com'è sul telefono

`apps/dashboard/public/staff/index.html` carica **React UMD (1.19 MB) + Babel standalone (3.14 MB)**
e poi compila **nel browser** 12 file JSX per ~460 KB di sorgente, a ogni caricamento. È accettabile
su un Mac in LAN; è inaccettabile su un telefono 4G attraverso un tunnel.

Inoltre:
- La SPA **non registra nessun service worker e non linka nessun manifest** (verificato: `grep
  manifest apps/dashboard/public/staff/index.html` → nessun match).
- `apps/dashboard/public/manifest.webmanifest` e `apps/dashboard/public/sw.js` **esistono** ma sono
  orfani: li registra solo `apps/dashboard/src/components/PWARegister.tsx`, cioè il **guscio Next
  ormai morto**. E il manifest ha `start_url: "/dashboard"`, route che non esiste più.
- Fastify serve **solo** la sottocartella `staff/` (`STAFF_DIR` in `apps/server/src/index.ts`):
  manifest, `sw.js` e `icons/` **non sono nemmeno raggiungibili** dall'appliance.
- Il responsive è JS-driven (`window.innerWidth < 900` in `07-app-root.js:174`) con due alberi di
  render distinti, ed esiste già una `BottomBar` con `MOBILE_PRIMARY` per ruolo
  (`03-shell-nav.js`). Il **design** mobile esiste; la **consegna** no.

### 1.8 Buchi noti che toccano direttamente l'app

| Buco | Evidenza | Impatto mobile |
|---|---|---|
| Chiamate cameriere **non persistite** | `routes/tables.ts:152-154`: *«Le chiamate non sono persistite: è una pura sincronizzazione real-time»* | Se l'app non era connessa quando è arrivato l'evento, la chiamata è persa per sempre |
| Nessuna paginazione | `orders.ts:31` (`/active`) e `orders.ts:59` (`/history`) restituiscono tutto | Payload che cresce senza limite su rete mobile |
| Nessun export dati | `GET /api/stats/export` è in `TAKO.md` §4 come P1 mai iniziato | — |
| Nessun push, nessun SW | `grep web-push pnpm-lock.yaml` → 0 | Il ristoratore non sa che è arrivato un ordine se non guarda |
| `apps/web` senza service worker | verificato: nessun `sw.js` in `apps/web/public` | Nessun precedente da copiare |

---

## 2. Il problema n.1: server locale ↔ telefono fuori dal ristorante

Tako è un'appliance: il Mac **è** il server, l'IP è privato, non c'è porta aperta verso internet e
il router è quello del cliente (spesso dietro CGNAT). Il telefono del ristoratore, quando è a casa,
non ha alcun percorso di rete verso quel Mac. Va risolto **prima** di scrivere una riga di UI,
perché determina protocollo, auth, sicurezza e persino la scelta della tecnologia.

### Opzioni valutate

**A) Cloudflare Tunnel (`cloudflared`) — connessione in uscita dall'appliance** ✅ **RACCOMANDATA**

L'appliance avvia `cloudflared` con un token di tunnel; Cloudflare pubblica
`https://<id>.box.takoitalia.com` e instrada il traffico dentro la connessione già aperta. Nessuna
porta in ingresso, nessun port-forwarding, nessuna configurazione sul router del cliente, HTTPS con
certificato valido incluso.

- Pro: gratuito nel piano free; **zero configurazione dal cliente**; il TLS valido sblocca service
  worker, Web Push e `getUserMedia` senza toccare `lib/tls.ts`; `cloudflared` è **già installato sul
  Mac di Manuel** (`~/.local/bin/cloudflared`) e già usato dal comando `deploy mobile`; il pattern
  outbound-only è già dimostrato in casa da Baileys (`lib/whatsapp.ts`).
- Contro: dipendenza da un fornitore esterno; il binario (~35 MB per arch) va imbarcato nel bundle
  Tauri; **espone l'appliance su internet** → richiede un gate applicativo (vedi D3); se l'uplink
  del ristorante è giù il remoto non funziona (accettabile: se il ristorante è offline non c'è nulla
  da raggiungere).

**B) Relay WebSocket proprietario sul control-plane** ❌ scartata

L'appliance apre un WS persistente verso `api.takoitalia.com`; il control-plane inoltra le richieste
dell'app dentro quel canale.

- Perché scartata: è un reverse-proxy da scrivere e mantenere (HTTP + WS + backpressure + auth +
  multiplexing), il control-plane sta su Render e diventa **single point of failure** su ogni
  richiesta operativa, aggiunge latenza a ogni tap, e Manuel non ha un team per presidiarlo. Il
  guadagno rispetto ad A è solo "niente vendor" — non giustifica il costo.

**C) Sync cloud dei dati operativi (replica in sola lettura)** ❌ scartata come soluzione primaria

L'appliance spinge periodicamente KPI e stato sul cloud; l'app fuori legge dal cloud.

- Perché scartata: dimezza il valore (vedi Wave 1 — *chiudere un tavolo* e *incassare* sono
  scritture); introduce un secondo database dei dati del ristorante con obblighi GDPR/DPA che oggi
  Tako **non ha** (`TAKO.md`: *«Supabase è SOLO il DB» dell'identità*); e obbligherebbe a risolvere i
  conflitti di scrittura. **Recuperata in forma minima** come fallback: vedi Task F1.4.

**D) VPN (Tailscale / WireGuard)** ❌ scartata

Funziona tecnicamente, ma richiede l'installazione di una VPN sul telefono del cliente, un account
di terze parti e un onboarding che un ristoratore non completerà. Non vendibile.

**E) Port forwarding + DDNS** ❌ scartata

Richiede accesso al router del cliente, si rompe con CGNAT (comune sulle linee mobili/FWA dei
locali), espone una porta in ingresso ed è ingestibile su decine di installazioni.

### La soluzione: **dual-endpoint LAN-first**

Il client **non** sceglie una rete: le prova entrambe, in quest'ordine.

```
                      ┌─ in ristorante ─────────────────────────────┐
  App owner ──(1)──►  │  http://tako.local:4317   (mDNS, ~5 ms)     │  ◄── veloce, funziona
   (telefono)         │                                             │      anche senza internet
                      └─────────────────────────────────────────────┘
       │ timeout 1200 ms / errore rete
       ▼
                      ┌─ fuori ─────────────────────────────────────┐
            (2) ───►  │  https://<slug>.box.takoitalia.com          │  ◄── Cloudflare Tunnel,
                      │     └─► cloudflared ──uscita──► appliance   │      HTTPS valido
                      └─────────────────────────────────────────────┘
       │ entrambi falliti
       ▼
            (3) ───►  modalità OFFLINE: ultima snapshot in cache, sola lettura
```

- La **scoperta** dei due endpoint riusa l'infrastruttura esistente: l'heartbeat firmato
  (`routes/cloud/pair.ts`) già pubblica `lanIp` / `lanHost` / `clientPort` in `cloud_appliances`;
  si aggiunge **una colonna** `remote_host` e **un campo** nello schema Zod dell'heartbeat. Stesso
  pattern, stessa guardia di validazione, stesso codice.
- Il **token** è lo stesso su entrambi gli endpoint, perché `middleware/auth.ts:13` accetta già
  `Authorization: Bearer` → nessun problema di cookie fra `http` LAN e `https` tunnel.
- Se Manuel non vuole il tunnel per un cliente, si spegne per-ristorante e l'app resta LAN-only:
  **degrado pulito, non rottura**.

---

## 3. Decisioni architetturali (con alternative scartate)

### D1 — Tecnologia: **PWA mobile-first servita dall'appliance**, non React Native

Una nuova SPA in `apps/dashboard/public/owner/`, bundlata con **esbuild** (già in
`package.json` devDependencies, già usato da `scripts/build-server-bundle.mjs:15`), servita da
Fastify su `/owner/` accanto a `/staff/`, con manifest + service worker propri.

- **Alternativa 1 — WebView sulla SPA `/staff` esistente** (è quello che fa oggi
  `apps/app/app/index.tsx`): scartata. 4.3 MB di React+Babel compilati in-browser a ogni avvio sono
  inaccettabili su 4G attraverso un tunnel, e la SPA è disegnata per tablet/desktop.
- **Alternativa 2 — React Native / Expo puro** (`apps/app` ha già Expo 56, expo-router,
  expo-secure-store, socket.io-client): scartata **per la Wave 1**. Impone Apple Developer $99/anno
  + Google Play $25, review dello store su ogni fix, EAS build, e Manuel lavora da solo. Un bug
  sabato sera si risolve con un `rsync` sull'appliance, non con una review Apple.
- **Alternativa 3 — nativo Swift/Kotlin**: scartata, due codebase per un solo sviluppatore.
- **Perché la PWA vince qui**: stesso stack del resto del repo, aggiornamento istantaneo (l'app si
  aggiorna quando si aggiorna l'appliance, che ha già l'auto-update Tauri), zero store, funziona su
  iOS e Android, e il backend non cambia di una riga.
- **Porta d'uscita già pronta**: se le push iOS deludono, `apps/app/app/index.tsx` è **già** una
  WebView Expo — basta puntarla a `/owner/` e si ottiene un wrapper nativo con push APNs
  riusando tutta la UI. Deciso in F5.4, non prima.

### D2 — Accesso remoto: **Cloudflare Tunnel + dual-endpoint LAN-first**

Vedi §2. Alternative scartate: relay proprietario, sync cloud, VPN, port forwarding.

### D3 — Autenticazione e sicurezza

| Aspetto | Decisione | Perché |
|---|---|---|
| Trasporto del token | `Authorization: Bearer` in **tutte** le richieste, mai cookie | `middleware/auth.ts:13` lo accetta già; immune a `SameSite`/`Secure` fra LAN http e tunnel https |
| Arruolamento | **QR mostrato nella dashboard `/staff`, scansionato in LAN** → `POST /api/auth/device/enroll` | Il possesso della dashboard autenticata **in LAN** è la prova; stesso ragionamento del device-code di `routes/cloud/pair.ts` (auto-approve perché l'owner ha già agito autenticato) |
| Durata | Sessione mobile **30 giorni** con refresh rolling, **non** 90 | Un telefono si perde più facilmente di un Mac in cucina. Il refresh rolling esiste già (`middleware/auth.ts:30-38`), si parametrizza la maxAge |
| Revoca | Schermata *Impostazioni → Dispositivi* → `DELETE /api/auth/devices/:id` → `DELETE FROM sessions` | La revoca è già efficace ovunque: `requireAuth` interroga `sessions` a ogni richiesta e il socket si rivalida entro 60 s (`handlers.ts:56-66`) |
| Telefono perso | Tre livelli: revoca dalla dashboard; `PATCH /api/staff/:userId {active:false}` che uccide **tutte** le sessioni dell'utente; spegnere il tunnel per il ristorante | Nessun dato di pagamento è sul telefono: il token dà accesso all'API, non a un wallet |
| Sblocco locale | **PIN 6 cifre + biometria** (`WebAuthn` / `navigator.credentials`) all'apertura dell'app | È un lucchetto **locale**, non sostituisce l'auth server. Se fallisce, il token resta ma la UI non si apre |
| Gate sul tunnel | Sull'hostname pubblico il server risponde **404** a tutto ciò che non porta un Bearer valido — incluso `/staff` | Non esporre su internet una SPA con form di login attaccabile. Vedi Task F1.3 |
| Cosa NON esporre | `/api/setup/*`, `/internal/shutdown`, `/api/auth/pin-roster`, `/api/whatsapp/bootstrap-code` restano **LAN-only** | `pin-roster` è anonimo per progetto (`routes/auth.ts:317`), su internet sarebbe un'enumerazione dello staff |

**Rate limit**: il globale è 100 req/min per IP (`index.ts`), ma **dietro il tunnel tutte le
richieste arrivano dallo stesso IP**. Va aggiunta la fiducia in `CF-Connecting-IP` **solo** per le
richieste che entrano dal tunnel, altrimenti un solo telefono può esaurire il budget di tutti.
Task F1.3.

### D4 — Offline e riconnessione

Tre stati, mai ambigui, sempre visibili in cima allo schermo:

| Stato | Cosa mostra | Cosa consente |
|---|---|---|
| 🟢 **In sala** (LAN) | Tutto live via Socket.io | Tutto |
| 🟡 **Da remoto** (tunnel) | Tutto live, badge "Da remoto" | Tutto, **tranne** stampa comande/scontrini (`routes/print.ts`) e apertura cassetto: sono azioni fisiche in sala, non si fanno alla cieca |
| 🔴 **Non raggiungibile** | Ultima snapshot con timestamp esplicito: *«Dati di 14 minuti fa»* | **Sola lettura.** Ogni pulsante di scrittura è disabilitato con motivo esplicito |

**Nessuna coda di scritture offline.** È una decisione, non una pigrizia: `POST /api/bills/:billId/payments`
è la route più delicata del sistema (transazione + advisory lock + cascade su ordini e tavolo,
`bills.ts:165-270`) e la review del 2026-07-15 ha già prodotto tre P1 su doppio addebito. Riprodurre
quella logica in una coda client è il modo più veloce per regalare o addebitare due volte una cena.
L'unica eccezione consentita è la **lettura** dalla cache.

Riconnessione: la SPA staff ha già il pattern giusto — alla **ri**connessione (non alla prima)
richiama un reload completo (`01-data.js:273-289`). L'app owner fa lo stesso e in più **ri-prova
l'endpoint LAN** a ogni ritorno in foreground: il ristoratore che rientra nel locale deve tornare
sulla via veloce da solo.

### D5 — Notifiche push: **Web Push VAPID, inviate direttamente dall'appliance**

L'appliance ha internet **in uscita** (lo sonda già ogni 30 s, `lib/connectivity.ts`). Un push
service (Apple/Google/Mozilla) si contatta in uscita. **Quindi non serve alcun relay**: l'appliance
è essa stessa l'application server VAPID.

```
order:new (già emesso da orders.ts:160 / customer.ts:487)
     │
     ├──► io.to('restaurant:{id}')  ← realtime esistente, invariato
     └──► pushDispatch()  ──HTTPS in uscita──►  Apple/Google Push  ──►  telefono
```

- Tre trigger, **tutti già esistenti come emit socket**: `order:new`, `waiter:called`,
  `inventory:alert`. Si agganciano nello stesso punto, senza toccare la logica di business.
- Subscription in una tabella nuova (migrazione `0017`), legate alla sessione mobile → revocare il
  dispositivo revoca anche il push.
- Chiavi VAPID generate una volta e persistite in `~/.tako/vapid.json` (stesso schema di
  `~/.tako/jwt-secret` in `scripts/tako.mjs` e di `~/.tako/device-secret` in `lib/cloud-client.ts`).
- **Vincolo iOS**: Web Push richiede iOS 16.4+ **e la PWA installata sulla schermata Home**.
  L'onboarding deve guidare l'installazione, non darla per scontata.
- **Degrado**: appliance senza internet → niente push. Documentato, coerente con il resto
  (`docs/setup-rete-ristorante.md` §5 elenca già cosa muore senza internet).
- **Alternativa scartata — Expo Push**: identica come architettura (POST in uscita a `exp.host`) ma
  obbliga al wrapper nativo, cioè agli store. Rimandata a F5.4 se e solo se le push iOS deludono.

### D6 — Nessun nuovo modello dati per il business

L'app **non** introduce entità di dominio. Le sole due migrazioni previste (`0017`) sono
infrastrutturali: `push_subscriptions` e la persistenza delle chiamate cameriere. Tutto il resto
riusa le API esistenti.

---

## 4. Funzionalità in ondate di rilascio

### Wave 1 — MVP vendibile

*Il criterio: cosa fa dire al ristoratore «questa me la tengo». Sala, ordini, soldi.*

| Funzione | API / file esistente da riusare | Da creare |
|---|---|---|
| **Login + arruolamento telefono** | `POST /api/auth/login` (`routes/auth.ts:187`); Bearer già accettato (`middleware/auth.ts:13`) | `POST /api/auth/device/enroll` (body `{enrollCode}`) → `{token, expiresAt, restaurant}`; `GET /api/auth/devices`; `DELETE /api/auth/devices/:id` |
| **Sala/tavoli live** | `GET /api/tables`, `GET /api/tables/rooms` (`tables.ts:15,22`); socket `table:updated` | — (le coordinate `posX`/`posY` esistono già in `schema/tables.ts`: la piantina 2D si ridisegna in mobile) |
| **Ordini in arrivo** | `GET /api/orders/active` (`orders.ts:31`); socket `order:new`, `order:updated` | `?limit=&before=` su `/active` e `/history`: oggi **nessuna paginazione** |
| **Dettaglio ordine di un tavolo** | `GET /api/orders/table/:tableId` (`orders.ts:46`) | — |
| **Avanzare / annullare un ordine** | `PATCH /api/orders/:orderId/status` (`orders.ts:172`), `PATCH /api/orders/:orderId/cancel` (`orders.ts:285`) | — |
| **Conti aperti** | `GET /api/bills/open` (`bills.ts:14`), `GET /api/bills/:billId` (`bills.ts:274`) | — |
| **Incassare (contanti/carta/digitale)** | `POST /api/bills/:billId/payments` (`bills.ts:165`) — chiude il conto, marca gli ordini `paid`, porta il tavolo a `cleaning` | — |
| **Sconto e mancia** | `PATCH /api/bills/:billId` (`bills.ts:110`, owner+cassiere) | — |
| **Chiudere / liberare un tavolo** | `PATCH /api/tables/:tableId/status` (`tables.ts:120`, con guardia M7 sul conto aperto) | — |
| **Incassi del giorno** | `GET /api/bills/summary/today` (`bills.ts:283`) + `GET /api/stats/dashboard` (`stats.ts:16`) | — |
| **Cliente che chiama il cameriere** | socket `waiter:called`; `POST /api/tables/:tableId/waiter-resolve` (`tables.ts:155`) | `GET /api/tables/waiter-calls` + persistenza: oggi le chiamate **non sono salvate** (`tables.ts:152-154`) → un'app aperta dopo la chiamata non la vede mai |
| **Stato dell'appliance e della rete** | `GET /api/system/info`, `/api/system/connectivity`, `/api/system/net-health` (`routes/system.ts`) | aggiungere `remoteUrl` al payload di `/info` |

### Wave 2 — magazzino, menu, statistiche

| Funzione | API / file esistente | Da creare |
|---|---|---|
| Giacenze, alert, valorizzazione | `GET /api/inventory`, `/alerts`, `/stats` (`inventory.ts:15,24,88`) | — |
| Lista di riordino per fornitore | `GET /api/inventory/reorder` (`inventory.ts:117`) | — |
| Carico/scarico/sprechi dal telefono | `POST /api/inventory/:itemId/movements` (`inventory.ts:137`) | — |
| Prezzi e disponibilità piatti | `PATCH /api/menus/items/:itemId` (`menu.ts:146`), `/availability` (`menu.ts:189`) | — |
| **Foto piatto scattata col telefono** | `POST /api/uploads/image` (`uploads.ts:9`) + `lib/dish-image-ai.ts` (`maybeStyleDishImage`) | `POST /api/menus/items/:itemId/photo` — oggi la foto AI si assegna **solo** da WhatsApp, via l'azione `hidden` `set_dish_image` (`ai-actions.ts:566`) |
| Statistiche e menu engineering | `GET /api/stats/dashboard` (`stats.ts:16`), `GET /api/insights/menu` (`insights.ts:73`) | `GET /api/stats/export?from=&to=` (CSV) — P1 mai iniziato in `TAKO.md` §4 |
| Import menu/magazzino da **foto** | `POST /api/menus/:menuId/import-text` (`menu.ts:279`), `POST /api/inventory/import-text` (`inventory.ts:180`) | `POST /api/menus/:menuId/import-photo` — gap 🟡 16 in `docs/tako-gap-100-2026-07-13.md`; la fotocamera è **la** ragione per cui questa funzione vive sul telefono |

### Wave 3 — assistente AI, prenotazioni, staff

| Funzione | API / file esistente | Da creare |
|---|---|---|
| **Copilot owner** (le 50 azioni esistenti) | `POST /api/ai/owner/chat/stream` SSE (`ai-owner.ts:74`), `POST /api/ai/owner/execute` (`ai-owner.ts:134`); registro `ACTIONS` (`ai-actions.ts:281`) | — (le card di conferma delle 33 `mutation` vanno **ridisegnate** per il touch; la logica server non cambia) |
| **Dettatura vocale** | namespace socket `/dictation` (`socket/dictation.ts`), `lib/asr.ts` | Richiede **secure context** per `getUserMedia`: in LAN http non funziona; **funziona dal tunnel** perché è HTTPS valido. Nessun codice nuovo, solo il gate |
| Prenotazioni | `GET/POST/PATCH/DELETE /api/reservations` (`reservations.ts`); socket `reservation:changed` | — |
| Staff e turni | `GET /api/staff`, `POST /api/staff` (`staff.ts:9,17`); `POST /api/shifts/clock-in`/`clock-out`, `GET /api/shifts/active` (`shifts.ts:76,120,64`) | — |
| Briefing giornaliero nell'app | `lib/whatsapp.ts:466-493` compone già il briefing con `executeAction('revenue_for_date'/'todays_reservations'/'low_stock')` | `GET /api/insights/briefing` — estrarre quella composizione dal modulo WhatsApp e riusarla |

---

## 5. Il loop: fasi e task

**Ciclo di ogni task:** `act → observe → verify → decide → repeat` finché **Stop** è vero o scatta
l'**Exit di fallimento**.

**Verifier di base, validi ovunque** (da eseguire dalla root `/Users/manuel/Projects/Tako`):

```bash
pnpm tsc --noEmit          # zero errori TypeScript — gate del protocollo agenti (CLAUDE.md)
pnpm lint                  # eslint flat config
pnpm test                  # vitest, tests/*.test.ts — richiede stack VIVO (server :3001 + Postgres)
pnpm tako                  # appliance in un solo processo su :4317, Postgres embedded
```

I test di integrazione **falliscono tutti a freddo**: prima serve lo stack vivo
(`EMBEDDED_DB=1 PGPORT=5432 PORT=3001`), poi `pnpm test`. `tests/helpers.ts` espone `seedTestEnv()`
che semina ristorante + owner + sessione staff + tavolo + menu ed è la base di ogni nuovo test.

**Trappola nota per gli screenshot**: Chrome headless ha un viewport minimo di ~500 px — uno
screenshot "a 390 px" è finto (l'immagine è ritagliata, `innerWidth` resta 500). Il layout mobile si
verifica con una **probe JS** (`window.innerWidth`, `getBoundingClientRect()`, `document.body.scrollWidth`),
non a occhio. `puppeteer-core` è già in `package.json` devDependencies.

---

### F0 — Fondamenta (abilitano tutto il resto)

#### F0.1 — Servire una seconda SPA su `/owner/`

- **Goal** — `curl -s http://localhost:4317/owner/index.html` restituisce 200 con l'HTML della nuova app, e `/staff/` continua a rispondere 200 identico a prima.
- **Tool** — `apps/server/src/index.ts` (registrare un secondo `fastifyStatic` con `prefix: '/owner/'` e una `OWNER_DIR` risolta con la stessa cascata di candidati di `STAFF_DIR`: env → `<server>/owner` nel bundle → `../../dashboard/public/owner` in dev); `scripts/build-server-bundle.mjs:59` (copiare anche `owner/` accanto a `staff/`); `apps/app/src-tauri/tauri.conf.json` (risorse impacchettate).
- **Verifier** — `pnpm tako` in background, poi `curl -sSf http://localhost:4317/owner/index.html | head -1` e `curl -sSf http://localhost:4317/staff/index.html | head -1`; `pnpm tsc --noEmit`.
- **Stop** — entrambe le URL rispondono 200 e `pnpm test` resta al conteggio di verde pre-esistente.
- **Exit di fallimento** — max 3 iterazioni. Se `fastifyStatic` non accetta due registrazioni con `decorateReply: false`, ripiegare su un unico root `public/` con due prefissi figli e annotare la deviazione qui.
- **Rischio** — P2.

#### F0.2 — Pipeline di build esbuild per l'app owner

- **Goal** — `pnpm --filter @tako/dashboard build:owner` produce `apps/dashboard/public/owner/{index.html,app.js,app.css}` con `app.js` **< 250 KB** minificato, **senza Babel a runtime**.
- **Tool** — `esbuild` (già in `package.json:17`, già usato in `scripts/build-server-bundle.mjs:15`); nuovo `scripts/build-owner-app.mjs` sul modello di `build-server-bundle.mjs`; sorgenti in `apps/dashboard/owner-src/`; React preso dalle stesse UMD già vendorizzate in `public/staff/lib/` oppure bundlato — decidere in base al peso misurato.
- **Verifier** — `node scripts/build-owner-app.mjs && ls -l apps/dashboard/public/owner/app.js` e assert sulla dimensione; `grep -c "text/babel" apps/dashboard/public/owner/index.html` deve dare `0`.
- **Stop** — build riproducibile da pulito (`rm -rf apps/dashboard/public/owner && node scripts/build-owner-app.mjs`) e bundle sotto soglia.
- **Exit di fallimento** — max 3 iterazioni. Se React bundlato sfora i 250 KB, passare a Preact + `preact/compat` via alias esbuild; se sfora ancora, alzare la soglia a 400 KB **documentando la misura reale**, mai in silenzio.
- **Rischio** — P1 (è la differenza fra un'app usabile in 4G e una no).

#### F0.3 — Manifest, service worker e installabilità

- **Goal** — su un telefono connesso all'appliance, `/owner/` è **installabile** sulla schermata Home, e i tre file PWA sono serviti dall'appliance con i content-type corretti.
- **Tool** — nuovo `apps/dashboard/public/owner/manifest.webmanifest` (`start_url: "/owner/"`, `scope: "/owner/"`, `display: "standalone"`); nuovo `apps/dashboard/public/owner/sw.js` modellato su `apps/dashboard/public/sw.js` (che ha già la regola giusta: **bypass totale** di `/api`, `/socket.io` e non-GET); riusare le icone di `apps/dashboard/public/icons/`; registrazione del SW nell'`index.html` della nuova app. **Non riparare** il manifest orfano di `/dashboard`: è del guscio Next morto.
- **Verifier** — probe Puppeteer (`puppeteer-core`, già in devDependencies) che apre `/owner/`, aspetta `navigator.serviceWorker.ready`, e asserisce che `fetch('/api/auth/me')` **non** venga servita dalla cache; `curl -sI http://localhost:4317/owner/manifest.webmanifest | grep -i content-type`.
- **Stop** — SW registrato, manifest valido, e una navigazione a server spento mostra la schermata offline invece di una pagina bianca.
- **Exit di fallimento** — max 3 iterazioni. In LAN `http://` puro il browser non espone `serviceWorker`: **è atteso** (lo dice già il commento in `apps/dashboard/src/components/PWARegister.tsx:5`). Se la registrazione fallisce solo lì, non è un bug — la verifica definitiva si fa su HTTPS in F1.2 e va rimandata a quel punto.
- **Rischio** — P1.

---

### F1 — Accesso remoto (il blocco architetturale)

#### F1.1 — Supervisione di `cloudflared` dall'appliance

- **Goal** — con `TAKO_TUNNEL_TOKEN` valorizzato, all'avvio l'appliance lancia `cloudflared`, e `GET /api/system/info` riporta `tunnel: { state: 'up'|'down'|'disabled', hostname }`.
- **Tool** — nuovo `apps/server/src/lib/tunnel.ts` sul modello di `lib/whatsapp.ts` (avvio **best-effort in try/catch**: se esplode non deve mai tirare giù il server — vedi `index.ts` per il pattern WhatsApp); `apps/server/src/index.ts` (avvio accanto a `startMdns()` / `startHeartbeatLoop()`); `apps/server/src/routes/system.ts` (esporre lo stato); binario in `apps/app/src-tauri/resources/`. `cloudflared` è già presente sul Mac di Manuel in `~/.local/bin/cloudflared`.
- **Verifier** — `pnpm tako` con `TAKO_TUNNEL_TOKEN` di prova → `curl -s localhost:4317/api/system/info | jq .data.tunnel`; poi **kill del processo `cloudflared`** e verifica che il server resti vivo e riporti `state: 'down'` entro 60 s.
- **Stop** — il tunnel sale, cade e risale senza che l'appliance smetta di servire la LAN.
- **Exit di fallimento** — max 4 iterazioni. Se la supervisione del processo figlio si rivela fragile su Windows (`taskkill /F /T`, cfr. le note su process-group kill di `src-tauri`), rilasciare **solo su macOS** in Wave 1 e aprire un task Windows separato. Non bloccare il resto del piano.
- **Rischio** — **P0**.

#### F1.2 — Hostname stabile per-ristorante e pubblicazione via heartbeat

- **Goal** — un'appliance accoppiata pubblica il proprio `remoteHost` al control-plane, e `GET /api/system/info` restituisce sia `lanUrl` sia `remoteUrl`.
- **Tool** — migrazione cloud `packages/db/src/migrations-cloud/0003_add_appliance_remote_host.sql`; `packages/db/src/schema/cloud/restaurants.ts:30-32` (aggiungere `remoteHost` accanto a `lanIp`/`lanHost`/`clientPort`); `apps/server/src/routes/cloud/pair.ts` (campo nello `heartbeatSchema`, riga ~64, **con la stessa validazione difensiva** degli altri: regex sull'hostname, e mai sovrascrivere l'ultimo valore noto con un valore invalido); `apps/server/src/lib/cloud-client.ts` (invio nel body dell'heartbeat — **fuori** dal payload firmato, come già fanno i campi di rete); `apps/server/src/lib/network.ts` (nuova `remoteBaseUrl()` accanto a `clientBaseUrl()`/`publicBaseUrl()`).
- **Verifier** — nuovo `tests/tunnel-endpoints.test.ts` costruito con `seedTestEnv()` di `tests/helpers.ts`: heartbeat con `remoteHost` valido → persistito; con hostname malformato → **ignorato**, valore precedente intatto. `pnpm test`.
- **Stop** — il test passa e `GET /api/system/info` espone i due endpoint.
- **Exit di fallimento** — max 3 iterazioni. Se il control-plane su Render non è raggiungibile durante lo sviluppo, testare contro un'istanza locale in `TAKO_MODE=cloud` e marcare il collaudo end-to-end come task separato per Manuel.
- **Rischio** — P1.

#### F1.3 — Gate di sicurezza sul traffico che entra dal tunnel

- **Goal** — sull'hostname pubblico: nessun Bearer valido → **404** su tutto; `/staff/`, `/api/setup/*`, `/api/auth/pin-roster`, `/internal/shutdown`, `/api/whatsapp/bootstrap-code` → **404 sempre**; il rate limit conta l'IP reale del client.
- **Tool** — nuovo `apps/server/src/middleware/remoteGate.ts` registrato come hook `onRequest` **prima** delle route in `apps/server/src/index.ts`; riconoscimento del traffico tunnel via header aggiunto da Cloudflare (`CF-Connecting-IP` / `CF-Ray`) **e** confronto con l'`Host` atteso; `keyGenerator` del rate-limit (`@fastify/rate-limit`, già registrato in `index.ts`) che usa `CF-Connecting-IP` **solo** per le richieste marcate tunnel.
- **Verifier** — nuovo `tests/remote-gate.test.ts`: (a) richiesta con `Host` pubblico senza Bearer → 404; (b) con Bearer valido su `/api/tables` → 200; (c) `Host` pubblico su `/api/auth/pin-roster` → 404; (d) stesse richieste su `Host: localhost` → comportamento **invariato** rispetto a oggi. Più `pnpm test` completo per verificare zero regressioni sulle 10 suite esistenti.
- **Stop** — i 4 casi passano **e** la suite pre-esistente resta verde con lo stesso conteggio.
- **Exit di fallimento** — max 4 iterazioni. Se distinguere il traffico tunnel da quello LAN si rivela ambiguo (header falsificabili sulla LAN), invertire la logica in **allowlist**: solo `Host` esattamente uguale a `remoteHost` passa il gate remoto, tutto il resto è trattato come LAN. Se anche questo fallisce, **non rilasciare il tunnel** e fermare F1: meglio niente remoto che un remoto insicuro.
- **Rischio** — **P0** (è l'unico task che, sbagliato, mette il ristorante su internet).

#### F1.4 — Selezione dell'endpoint lato client (LAN-first)

- **Goal** — l'app prova la LAN entro 1200 ms, ripiega sul tunnel, e ri-prova la LAN a ogni ritorno in foreground. Lo stato corrente è sempre visibile.
- **Tool** — nuovo `apps/dashboard/owner-src/lib/endpoint.ts` (probe su `GET /health`, che esiste già in `index.ts` e non richiede auth); `visibilitychange` per il retry; persistenza dell'ultimo endpoint funzionante in `localStorage`.
- **Verifier** — probe Puppeteer con `page.setOfflineMode` e route interception: LAN raggiungibile → nessuna chiamata all'hostname remoto; LAN spenta → tutte le chiamate vanno al remoto entro 2 s; LAN che ritorna → il probe successivo torna in LAN.
- **Stop** — i tre scenari passano e nessuna richiesta parte verso il remoto quando la LAN risponde (verifica del risparmio di latenza, non solo della funzionalità).
- **Exit di fallimento** — max 3 iterazioni. Se il probe LAN da un browser mobile su rete cellulare produce attese lunghe (mDNS non risolve e il DNS ci mette secondi), ridurre il timeout a 600 ms e saltare del tutto il probe LAN quando `navigator.connection.type === 'cellular'`.
- **Rischio** — P1.

---

### F2 — Wave 1: MVP vendibile

#### F2.1 — Arruolamento del telefono e sessione mobile

- **Goal** — dalla dashboard `/staff` l'owner apre *Dispositivi → Collega telefono*, vede un QR, lo scansiona col telefono in LAN, e l'app owner risulta autenticata con un Bearer da 30 giorni. La sessione compare nell'elenco dispositivi ed è revocabile.
- **Tool** — `apps/server/src/routes/auth.ts` (nuovi `POST /api/auth/device/enroll-code` con `requireRole('owner')`, `POST /api/auth/device/enroll` anonimo che consuma il codice, `GET /api/auth/devices`, `DELETE /api/auth/devices/:id`); riusare i pattern già scritti in `routes/cloud/pair.ts` (codice ad alta entropia, **HMAC a riposo**, TTL breve, **single-use atomico**, lockout per-codice); `packages/db/src/migrations/0017_*.sql` per i metadati del dispositivo su `sessions`; `apps/dashboard/public/staff/src/06-screens-gestione.js` (`ScreenDispositivi` esiste già).
- **Verifier** — nuovo `tests/device-enroll.test.ts` con `seedTestEnv()`: codice usato due volte → il secondo tentativo fallisce; codice scaduto → fallisce; token emesso → `GET /api/auth/me` con `Authorization: Bearer <token>` risponde 200; dopo `DELETE /api/auth/devices/:id` → 401.
- **Stop** — i 4 casi verdi e `pnpm test` senza regressioni.
- **Exit di fallimento** — max 4 iterazioni. Se il flusso QR risulta fragile in fiera/sul campo, aggiungere in **alternativa** (non in sostituzione) l'inserimento manuale di un codice a 8 caratteri, come fa già il pairing cloud (`routes/setup.ts` — l'owner trascrive il device code).
- **Rischio** — **P0**.

#### F2.2 — Guscio dell'app: shell, navigazione, stati di rete

- **Goal** — l'app apre in **meno di 2 s** su 4G simulato, mostra 5 sezioni (Sala · Ordini · Cassa · Oggi · Altro), e il badge di stato riflette correttamente 🟢 LAN / 🟡 remoto / 🔴 offline.
- **Tool** — `apps/dashboard/owner-src/` (shell nuova, mobile-only: **nessun ramo desktop**, al contrario di `07-app-root.js:174`); riusare i design token di `apps/dashboard/public/staff/styles.css` (variabili `--brand`, `--st-*`) e la logica della `BottomBar` di `03-shell-nav.js`; `GET /api/system/connectivity` + evento socket `connectivity` per il badge.
- **Verifier** — probe Puppeteer con throttling `Fast 3G`: misura `DOMContentLoaded` e time-to-interactive; probe JS che asserisce `document.body.scrollWidth <= window.innerWidth` (**nessuno scroll orizzontale**) a 390/430 px logici — misurato via JS, mai a occhio dallo screenshot.
- **Stop** — TTI < 2 s su Fast 3G e zero overflow orizzontale su entrambe le larghezze.
- **Exit di fallimento** — max 4 iterazioni. Se il TTI non scende, tagliare: caricare **solo** la sezione attiva e importare le altre in `import()` dinamico. Se ancora non scende, alzare la soglia a 3 s documentando la misura e aprire un task di ottimizzazione separato.
- **Rischio** — P1.

#### F2.3 — Sala live e ordini in arrivo

- **Goal** — la piantina dei tavoli riflette lo stato reale entro 2 s da un cambio, e un ordine nuovo appare in cima alla lista senza refresh manuale.
- **Tool** — `GET /api/tables/rooms` + `GET /api/tables` (`routes/tables.ts:15,22`); `GET /api/orders/active` (`orders.ts:31`); `PATCH /api/orders/:orderId/status` (`orders.ts:172`); socket `join:restaurant` **con il token come secondo argomento** (`socket/handlers.ts:41-47` — la via che funziona senza cookie); coordinate `posX`/`posY` da `packages/db/src/schema/tables.ts`.
- **Verifier** — nuovo `tests/mobile-realtime.test.ts` sul modello di `tests/realtime.test.ts` (già esistente): client socket.io autenticato **via argomento token**, creazione di un ordine da un altro client, assert sulla ricezione di `order:new` entro 2 s; e assert che un token **revocato** non riceva più eventi dopo la rivalidazione dei 60 s.
- **Stop** — entrambi gli assert verdi.
- **Exit di fallimento** — max 3 iterazioni. Se l'auth del socket via argomento si rivela inaffidabile su rete mobile (riconnessioni frequenti), passare all'header `auth` dell'handshake socket.io e aggiungere il ramo corrispondente in `handlers.ts` — **modifica additiva**, mai sostitutiva del cookie.
- **Rischio** — P1.

#### F2.4 — Cassa: conti, incasso, chiusura tavolo

- **Goal** — dal telefono si apre un conto, si applica uno sconto, si incassa e il tavolo passa a `cleaning` — con lo **stesso** esito di un incasso fatto dalla dashboard.
- **Tool** — `GET /api/bills/open` (`bills.ts:14`), `GET /api/bills/:billId` (`bills.ts:274`), `PATCH /api/bills/:billId` (`bills.ts:110`), `POST /api/bills/:billId/payments` (`bills.ts:165`), `PATCH /api/tables/:tableId/status` (`tables.ts:120`). **Zero logica di calcolo nel client**: il totale si legge sempre dalla risposta del server, che lo ricalcola sotto advisory lock.
- **Verifier** — estendere `tests/load-review-fixes.test.ts` (che già copre i P1 della review carico) con un caso mobile: **due** `POST /payments` concorrenti sullo stesso conto → esattamente uno chiude, l'altro riceve 409 `BILL_NOT_OPEN`; e `PATCH /tables/:id/status → free` con conto aperto → 409 `TABLE_HAS_OPEN_BILL`.
- **Stop** — nessun doppio incasso in 20 esecuzioni consecutive del test di concorrenza.
- **Exit di fallimento** — max 3 iterazioni. Se emerge una qualsiasi finestra di doppio addebito, **fermare la Wave 1** e aprire un task P0 sul server: è la stessa classe di bug dei tre P1 chiusi in `e34fbcf`, e non si spedisce.
- **Rischio** — **P0** (tocca i soldi).

#### F2.5 — Chiamate cameriere persistite

- **Goal** — una chiamata cameriere fatta mentre l'app è chiusa è **ancora visibile** quando l'app si apre, e sparisce su tutti i dispositivi quando uno la risolve.
- **Tool** — migrazione `packages/db/src/migrations/0017_*.sql` (tabella `waiter_calls`: `restaurantId`, `tableId`, `type`, `createdAt`, `resolvedAt`, `resolvedBy`); `apps/server/src/routes/customer.ts:568` (dove oggi si emette e basta) e `apps/server/src/routes/tables.ts:155` (`waiter-resolve`); nuova `GET /api/tables/waiter-calls?open=1`; l'evento `waiter:resolved` esiste già.
- **Verifier** — nuovo `tests/waiter-calls.test.ts`: chiamata creata → compare in `GET`; risolta → sparisce e l'evento `waiter:resolved` viene emesso; chiamata di un altro ristorante → **mai visibile** (anti cross-tenant, come tutte le altre route).
- **Stop** — i 3 casi verdi.
- **Exit di fallimento** — max 3 iterazioni. Se la persistenza fa crescere la tabella senza controllo, aggiungere la pulizia in `apps/server/src/lib/cleanup.ts` (che già esiste per altri dati) con retention 7 giorni.
- **Rischio** — P1.

#### F2.6 — Incassi del giorno

- **Goal** — la schermata *Oggi* mostra incasso, mance, numero conti, ticket medio e ordini in attesa, coerenti al centesimo con la dashboard.
- **Tool** — `GET /api/bills/summary/today` (`bills.ts:283` — nota: la **mancia è esclusa dal ricavo**, è pass-through allo staff) e `GET /api/stats/dashboard` (`stats.ts:16`). Il fuso è quello del ristorante via `restaurantTimezone()` di `lib/billing.ts`: **mai** `new Date()` lato client per definire "oggi".
- **Verifier** — test che semina due conti chiusi con mancia e confronta i numeri dell'app con `GET /api/bills/summary/today`; più un caso a cavallo della mezzanotte con `timezone: 'Europe/Rome'` per verificare che il confine di giornata sia quello del ristorante.
- **Stop** — differenza zero fra i due, incluso il caso mezzanotte.
- **Exit di fallimento** — max 2 iterazioni. Se i numeri divergono, la causa è quasi certamente il fuso: non correggere nel client, correggere leggendo `restaurantTimezone()`.
- **Rischio** — P2.

---

### F3 — Notifiche push

#### F3.1 — Infrastruttura Web Push sull'appliance

- **Goal** — `POST /api/push/subscribe` registra una subscription legata alla sessione mobile, e un `POST /api/push/test` recapita una notifica reale al telefono.
- **Tool** — nuova dipendenza `web-push` (**assente oggi**: `grep -c web-push pnpm-lock.yaml` → 0); nuovo `apps/server/src/lib/push.ts`; chiavi VAPID generate una volta in `~/.tako/vapid.json` (stesso schema di `~/.tako/jwt-secret` in `scripts/tako.mjs` e `~/.tako/device-secret` in `lib/cloud-client.ts`); migrazione `0017` per `push_subscriptions`; nuove route in `apps/server/src/routes/system.ts` o in un `routes/push.ts` dedicato.
- **Verifier** — test che registra una subscription finta e verifica che `pushDispatch()` **fallisca in modo pulito** (nessuna eccezione propagata, endpoint marcato morto e rimosso dopo un 410) — l'invio reale si collauda a mano su un telefono.
- **Stop** — subscription persistita, invio a endpoint morto gestito senza rompere nulla, notifica reale ricevuta su un telefono di prova.
- **Exit di fallimento** — max 3 iterazioni. Se `web-push` porta dipendenze native che rompono il bundle esbuild di `scripts/build-server-bundle.mjs`, implementare VAPID a mano con `node:crypto` (è JWT ES256 + un POST) — l'appliance ha già tutta la crittografia ed25519/AES in `lib/cloud-client.ts`.
- **Rischio** — P1.

#### F3.2 — Agganciare i tre trigger

- **Goal** — un ordine nuovo, una chiamata cameriere e un alert scorte generano una push entro 10 s, con corpo leggibile e deep-link alla sezione giusta.
- **Tool** — gli **stessi punti** dove oggi si emette il socket: `routes/orders.ts:160` e `routes/customer.ts:487` (`order:new`), `routes/customer.ts:580` (`waiter:called`), `routes/inventory.ts:173` (`inventory:alert`). Fast-fail su `isOnline()` di `lib/connectivity.ts` per non restare appesi quando internet è giù.
- **Verifier** — test che spia `pushDispatch` (mock) e verifica: una push per evento, **nessuna** push quando `isOnline()` è falso, **nessuna** push verso sessioni revocate.
- **Stop** — i 3 assert verdi e nessun rallentamento misurabile sul percorso critico dell'ordine (`POST /api/customer/orders` deve restare entro il tempo attuale: la push va **dopo** la risposta, mai prima).
- **Exit di fallimento** — max 3 iterazioni. Se l'invio push rallenta la creazione ordine, spostarlo in una coda in-memory drenata da un `setInterval`, come già fa il briefing WhatsApp (`lib/whatsapp.ts:495-498`).
- **Rischio** — P1.

#### F3.3 — Ricezione e onboarding lato app

- **Goal** — al primo avvio l'app spiega perché servono le notifiche, chiede il permesso al momento giusto (non all'apertura), e su iOS guida esplicitamente all'installazione sulla schermata Home.
- **Tool** — `apps/dashboard/public/owner/sw.js` (handler `push` e `notificationclick` con deep-link); rilevamento `window.navigator.standalone` per capire se la PWA è installata su iOS.
- **Verifier** — checklist manuale su un iPhone e un Android reali: installazione → permesso → ordine di prova → notifica ricevuta con app **chiusa** → tap che apre la sezione Ordini.
- **Stop** — checklist completata su entrambe le piattaforme.
- **Exit di fallimento** — max 3 iterazioni. Se le push iOS si rivelano inaffidabili (storicamente lo sono), **non insistere**: aprire F5.4 (wrapper Expo con APNs) e nel frattempo tenere in piedi il fallback che già esiste ed è affidabile — il **briefing/alert via WhatsApp** (`lib/whatsapp.ts`).
- **Rischio** — **P0 per il valore percepito** (senza notifiche l'app è un sito da consultare), P1 tecnico.

---

### F4 — Wave 2: magazzino, menu, statistiche

#### F4.1 — Magazzino dal telefono

- **Goal** — giacenze, alert e lista di riordino consultabili, e carico/scarico/spreco registrabili in meno di 4 tap.
- **Tool** — `GET /api/inventory`, `/alerts`, `/stats`, `/reorder` e `POST /api/inventory/:itemId/movements` (`routes/inventory.ts:15,24,88,117,137`).
- **Verifier** — test che registra un movimento dall'app e verifica che `GET /api/inventory/:itemId/movements` (`inventory.ts:79`) lo contenga con il segno corretto; probe UI che conta i tap necessari.
- **Stop** — movimento corretto a DB e ≤ 4 tap misurati.
- **Exit di fallimento** — max 2 iterazioni. Se il flusso resta lungo, tagliare a **due** movimenti rapidi (carico, spreco) e mandare il resto in una schermata avanzata.
- **Rischio** — P2.

#### F4.2 — Menu: prezzo e disponibilità

- **Goal** — «finito il branzino» si risolve dal telefono in 3 tap e il menu del cliente si aggiorna **live**.
- **Tool** — `PATCH /api/menus/items/:itemId/availability` (`menu.ts:189`) e `PATCH /api/menus/items/:itemId` (`menu.ts:146`); l'evento `menu:item_availability` è già emesso **sia** su `restaurant:{id}` **sia** su `menu:{id}` (la room pubblica dei clienti) — quindi la PWA cliente si aggiorna da sola, senza lavoro extra.
- **Verifier** — test end-to-end: client socket iscritto a `menu:{restaurantId}`, `PATCH /api/menus/items/:itemId/availability` dall'app, assert sulla ricezione dell'evento; più un controllo che `GET /api/customer/restaurant/:restaurantId/menu` rifletta il cambio.
- **Stop** — evento ricevuto e menu cliente aggiornato.
- **Exit di fallimento** — max 2 iterazioni.
- **Rischio** — P2.

#### F4.3 — Foto piatto scattata col telefono

- **Goal** — l'owner fotografa un piatto, sceglie a quale voce di menu assegnarlo, e la foto (stilizzata dall'AI se il flag è attivo) compare nel menu del cliente.
- **Tool** — `POST /api/uploads/image` (`routes/uploads.ts:9`, limite 10 MB da `@fastify/multipart` in `index.ts`); `apps/server/src/lib/dish-image-ai.ts` (`maybeStyleDishImage`, `aiPhotoEnabledFor`); nuova `POST /api/menus/items/:itemId/photo` che riusa la **stessa** pipeline oggi raggiungibile solo da WhatsApp (`lib/whatsapp.ts:448` → azione `hidden` `set_dish_image`, `ai-actions.ts:566`). Fast-fail su `isOnline()`: senza internet la foto si carica **grezza**, senza stilizzazione.
- **Verifier** — test che carica un'immagine di prova, assegna, e verifica `menuItems.imageUrl` a DB; più un caso con `aiPhotoEnabled: false` che deve salvare l'originale senza chiamare Gemini.
- **Stop** — entrambi i casi verdi.
- **Exit di fallimento** — max 3 iterazioni. Se le foto da fotocamera moderna (12+ MP) sfondano il limite di 10 MB, ridimensionare **lato client** prima dell'upload (canvas, lato lungo 1600 px) invece di alzare il limite del server.
- **Rischio** — P2.

#### F4.4 — Statistiche ed export

- **Goal** — la schermata *Andamento* mostra incasso 7/30 giorni, ticket medio, top piatti e i quadranti del menu engineering; ed esiste un export CSV condivisibile dal telefono.
- **Tool** — `GET /api/stats/dashboard` (`stats.ts:16`), `GET /api/insights/menu` (`insights.ts:73`, rate-limit 10/min per ristorante); nuova `GET /api/stats/export?from=&to=` (P1 aperto in `TAKO.md` §4) che riusa le stesse query di `stats.ts` e restituisce `text/csv`.
- **Verifier** — test che confronta i totali del CSV con quelli di `GET /api/stats/dashboard` sullo stesso intervallo: devono coincidere al centesimo.
- **Stop** — coincidenza esatta.
- **Exit di fallimento** — max 2 iterazioni. Se l'export su intervalli lunghi è pesante, imporre un tetto di 365 giorni come già fa `insights.ts` (riga 78).
- **Rischio** — P2.

---

### F5 — Wave 3: assistente AI, prenotazioni, staff

#### F5.1 — Copilot owner in mobile

- **Goal** — la chat streaming funziona sul telefono, e le card di conferma delle mutation sono comode col pollice, senza che nessuna mutation venga mai eseguita senza tap esplicito.
- **Tool** — `POST /api/ai/owner/chat/stream` SSE (`ai-owner.ts:74`, eventi `token` / `reset` / `done` / `error`, heartbeat `: ping` ogni 15 s) e `POST /api/ai/owner/execute` (`ai-owner.ts:134`); la UI di riferimento è `apps/dashboard/public/staff/src/11-copilot.js` (card a riga 173, bottone *«Conferma ed esegui»* a riga 213). **Nessuna modifica al server.**
- **Verifier** — test che invia un messaggio che innesca una mutation (es. *«segna esaurito il branzino»*) e verifica che la risposta contenga `pending[]` e che **nulla sia cambiato a DB**; poi chiama `/execute` e verifica il cambiamento.
- **Stop** — entrambi gli assert verdi; e le 7 azioni con `roles` ristretti restano rifiutate per un utente non-owner (il gate è in `ai-actions.ts:2027-2029`).
- **Exit di fallimento** — max 3 iterazioni. Se l'SSE si interrompe su rete mobile o attraverso il tunnel, ripiegare sul `POST /api/ai/owner/chat` non-streaming (già esistente, `ai-owner.ts:21`) mostrando uno spinner: perdita di eleganza, zero perdita di funzione.
- **Rischio** — P1.

#### F5.2 — Prenotazioni

- **Goal** — vedere le prenotazioni di oggi/domani, crearne una, assegnare un tavolo, marcare `seated`/`no_show`.
- **Tool** — `GET /api/reservations`, `POST`, `PATCH /:id`, `PATCH /:id/status`, `PATCH /:id/table`, `DELETE /:id` (`routes/reservations.ts:73,97,150,214,247,280`); evento `reservation:changed` già emesso.
- **Verifier** — riusare ed estendere `tests/reservations.test.ts` (già esistente) con i percorsi usati dall'app.
- **Stop** — suite verde.
- **Exit di fallimento** — max 2 iterazioni.
- **Rischio** — P2.

#### F5.3 — Staff e turni

- **Goal** — vedere chi è in turno adesso, timbrare entrata/uscita per un membro, attivare/disattivare un account.
- **Tool** — `GET /api/shifts/active` (`shifts.ts:64`), `POST /api/shifts/clock-in` / `clock-out` (`shifts.ts:76,120`), `GET /api/staff` (`staff.ts:9`), `PATCH /api/staff/:userId` (`staff.ts:44`, `requireRole('owner')`).
- **Verifier** — riusare ed estendere `tests/shifts.test.ts` (già esistente).
- **Stop** — suite verde.
- **Exit di fallimento** — max 2 iterazioni.
- **Rischio** — P2.

#### F5.4 — Decisione: wrapper nativo, sì o no

- **Goal** — una decisione scritta e motivata su dati reali, non un'opinione: si spedisce un wrapper Expo o si resta PWA?
- **Tool** — i dati raccolti in F3.3 (affidabilità push su iPhone e Android reali per 2 settimane di uso); `apps/app/app/index.tsx` (la WebView **esiste già** e punta a `/staff/index.html`: per il wrapper basta puntarla a `/owner/` e aggiungere `expo-notifications`); `apps/app/package.json` ha già `expo-secure-store` e `socket.io-client`.
- **Verifier** — conteggio misurato: quante push inviate vs quante ricevute, per piattaforma, sul periodo di prova.
- **Stop** — decisione scritta in questo file con il numero che l'ha motivata.
- **Exit di fallimento** — se il tasso di recapito iOS è **sotto il 90%**, si procede col wrapper e si accettano i costi store; sopra il 95% si resta PWA; in mezzo si rimanda di un mese e si continua a misurare. Nessuna terza via.
- **Rischio** — P1 (decisione che costa 99 $/anno + review, o costa credibilità).

---

### F6 — Distribuzione e collaudo sul campo

#### F6.1 — L'app owner viaggia dentro il bundle dell'appliance

- **Goal** — un `pnpm --filter @tako/app desktop:build` produce un `Tako.app` che serve anche `/owner/`, e l'auto-update esistente aggiorna **anche** l'app del telefono.
- **Tool** — `scripts/build-server-bundle.mjs` (copiare `owner/` accanto a `staff/`, riga 59); `apps/app/src-tauri/tauri.conf.json` (risorse); `scripts/deploy-desktop.sh` (**aggiornamento in place** di `/Applications/Tako.app` — mai eliminare e ricreare, mai lasciare `.app` di scarto in giro); `.github/workflows/release.yml`.
- **Verifier** — build pulita, `open /Applications/Tako.app`, `curl -sSf http://localhost:4317/owner/index.html`; e `mdfind "kMDItemFSName == 'Tako.app'"` deve restituire **una sola** riga.
- **Stop** — l'app owner risponde dal bundle installato e non esiste alcun bundle duplicato.
- **Exit di fallimento** — max 3 iterazioni. Se il bundle sfonda una dimensione accettabile per l'inclusione di `cloudflared`, scaricare il binario al primo avvio in `~/.tako/bin/` invece di imbarcarlo — è quello che fa già lo script `deploy-mobile` di Manuel.
- **Rischio** — P1.

#### F6.2 — Collaudo end-to-end in un locale vero

- **Goal** — un servizio serale intero gestito dal telefono, con l'owner che esce dal locale e continua a vedere e agire.
- **Tool** — la checklist di `docs/setup-rete-ristorante.md` §7 (già scritta: IP stabile, `ping tako.local`, 3 telefoni, prova con internet staccato, isolation OFF, firewall su 3002/4317) **estesa** con: installazione PWA su iPhone e Android; uscita dal locale e verifica del passaggio al tunnel; push ricevuta fuori dal locale; incasso eseguito da remoto; **spegnimento dell'uplink internet** → verifica che il servizio in sala continui e che l'app in LAN continui a funzionare.
- **Verifier** — checklist firmata + log dell'appliance della serata.
- **Stop** — zero interventi manuali di Manuel durante il servizio.
- **Exit di fallimento** — max 2 serate. Se serve intervenire, il piano si ferma e si apre un post-mortem: si spedisce solo ciò che ha retto un servizio vero, come già è stato fatto per la review carico del 2026-07-15.
- **Rischio** — **P0** (è il gate di vendibilità).

---

## 6. Stima di effort per wave

Unità: **sessione agente** = una sessione di lavoro focalizzata con verifier verde alla fine.
Le stime **non** includono i tempi di attesa su Manuel (elencati in §7).

| Fase | Task | Sessioni | Note |
|---|---|---|---|
| F0 — Fondamenta | 3 | **2–3** | Il grosso è la pipeline esbuild (F0.2) |
| F1 — Accesso remoto | 4 | **4–6** | F1.3 (gate sicurezza) è il task singolo più costoso di tutto il piano |
| F2 — Wave 1 | 6 | **6–8** | F2.4 (cassa) richiede test di concorrenza, non solo UI |
| F3 — Push | 3 | **3–4** | + 2 settimane di misura reale prima di F5.4 |
| **Totale MVP vendibile (F0→F3)** | **16** | **15–21** | |
| F4 — Wave 2 | 4 | **4–5** | Tutte API esistenti tranne export e import-photo |
| F5 — Wave 3 | 4 | **3–5** | Il copilot è quasi tutto riuso: il server non cambia |
| F6 — Distribuzione | 2 | **2–3** | + 1–2 serate reali |
| **Totale** | **26** | **24–34** | |

Il rapporto è volutamente sbilanciato: **oltre un terzo dell'effort sta in F1**, cioè nel problema
architetturale, non nell'interfaccia. È corretto — se il telefono non raggiunge l'appliance in modo
sicuro, la UI non serve a nulla.

---

## 7. Cosa richiede Manuel (account, domini, spesa, decisioni)

### Serve prima di F1 — blocca l'accesso remoto

| Cosa | Dove | Costo | Note |
|---|---|---|---|
| Sottodominio wildcard `*.box.takoitalia.com` | zona Cloudflare di `takoitalia.com` (già sua) | **0 €** | Serve solo il record; il tunnel crea i CNAME |
| Cloudflare Zero Trust / Tunnel abilitato sull'account | dashboard Cloudflare | **0 €** (piano free) | `cloudflared` è già installato sul suo Mac |
| Procedura di provisioning del tunnel per-cliente | decisione operativa | — | Manuale all'installazione, oppure automatica via API Cloudflare dal control-plane. **Da decidere**: la manuale basta per i primi 5 clienti |

### Serve prima di F3 — push

| Cosa | Costo | Note |
|---|---|---|
| Un iPhone (iOS 16.4+) e un Android per il collaudo | 0 € se li ha | Il simulatore non basta: le push si collaudano su device fisico |
| Nulla di economico per Web Push | **0 €** | Le chiavi VAPID si generano in locale |

### Serve solo se si decide il wrapper nativo in F5.4

| Cosa | Costo |
|---|---|
| Apple Developer Program | **99 $/anno** |
| Google Play Console | **25 $** una tantum |

### Decisioni che spettano solo a lui

1. **Il remoto è di serie o è un'opzione a pagamento?** Espone l'appliance su internet: potrebbe
   essere un livello superiore del listino, o disattivabile per i clienti che non lo vogliono.
2. **Chi può usare l'app dal telefono: solo l'owner o anche i ruoli?** Il piano assume
   **solo owner** in Wave 1. Estenderlo a cameriere/cassiere è un cambio di superficie di
   sicurezza, non una feature.
3. **Il tunnel resta acceso sempre o solo a richiesta?** Sempre acceso è più comodo e più esposto.
   Una via di mezzo: acceso solo negli orari di apertura del locale.
4. **Cosa scrivere nel contratto e nell'informativa privacy** ora che i dati del ristorante
   transitano — cifrati, non memorizzati — per l'infrastruttura Cloudflare. Va detto, non nascosto.
   Si aggancia al DPA art. 28 già segnalato come aperto in `docs/tako-gap-100-2026-07-13.md`.
5. **Il nome dell'app** sulla schermata Home: *Tako*, *Tako Owner*, altro. Determina il manifest.
6. **Rinnovo del token GitHub del Worker update** — segnalato in `RILASCIO.md`: il secret è il token
   della `gh` CLI di Manuel, e un `gh auth logout` spegne gli update di tutti i clienti, app del
   telefono inclusa (viaggia nello stesso bundle). Sostituirlo con un PAT fine-grained.

---

## 8. Rischi trasversali e cosa NON facciamo

### Rischi

| # | Rischio | Grado | Mitigazione nel piano |
|---|---|---|---|
| R1 | Esporre l'appliance su internet apre una superficie d'attacco che oggi non esiste | **P0** | F1.3: gate 404-by-default, allowlist di path, rate-limit sull'IP reale, e l'exit di fallimento esplicita *«meglio niente remoto che un remoto insicuro»* |
| R2 | Doppio incasso da un client mobile con rete instabile | **P0** | F2.4: nessuna coda offline sulle scritture, test di concorrenza su 20 run, e stop del rilascio se emerge una finestra |
| R3 | Push iOS inaffidabili → l'app sembra rotta | **P0 percepito** | F3.3 + F5.4: si misura per 2 settimane e si decide su un numero, con WhatsApp come fallback già funzionante |
| R4 | Il tunnel dipende da un fornitore esterno | P1 | Degrado pulito: senza tunnel l'app resta LAN-only, non si rompe. La modalità offline (D4) copre il caso |
| R5 | Il bundle dell'appliance cresce troppo con `cloudflared` | P2 | F6.1: download al primo avvio invece dell'imbarco |
| R6 | Uplink internet del ristorante instabile → remoto a singhiozzo | P1 | `lib/net-health.ts` e `lib/connectivity.ts` esistono già e diagnosticano: l'app mostra il perché invece di uno spinner |
| R7 | Divergenza fra la SPA `/staff` e l'app `/owner` (due UI da mantenere) | P1 | L'app owner **non** duplica la logica: chiama le stesse API. Il rischio è di design, non di stato: si accetta e si tiene l'app volutamente **più piccola** della dashboard |
| R8 | Il copilot AI richiede internet (Groq) e fallisce in locale | P2 | Già gestito dal server: 503 `AI_UNAVAILABLE` (`ai-owner.ts:38`). L'app lo mostra come stato, non come errore |

### Cosa NON facciamo (decisioni negative, esplicite)

- **Niente coda di scritture offline.** Motivato in D4. È la decisione più importante del piano.
- **Niente sync dei dati operativi sul cloud.** Cambierebbe il modello privacy di Tako e
  introdurrebbe conflitti di scrittura. Il cloud resta identità + pairing, come oggi.
- **Niente KDS, niente comanda, niente presa ordini dal telefono dell'owner** in Wave 1: sono
  superfici da tablet in sala, e la dashboard `/staff` le fa già bene.
- **Niente app per cameriere/cuoco/cassiere.** L'app è del **ristoratore**. Estenderla ai ruoli è
  un progetto diverso.
- **Niente store in Wave 1.** Si valuta in F5.4 su dati misurati.
- **Non si tocca la SPA `/staff`** se non per aggiungere la schermata di arruolamento del telefono
  (F2.1). Funziona, è collaudata, non è il posto dove sperimentare.
- **Non si ripara il manifest orfano `/dashboard`** né il SW del guscio Next: è codice morto
  (`apps/dashboard/src/`), e va rimosso in un task di pulizia separato, non dentro questo piano.

---

## 9. ADDENDUM 2026-08-09 — Direttiva Manuel: app native iOS + Android SUBITO

Manuel (2026-08-09) ordina: i ristoratori devono avere la dashboard come **app iOS e Android**,
grafica identica alla dashboard desktop. Questo **supera F5.4** (che rimandava il wrapper alla
misura push): il wrapper nativo si fa **ora**, in parallelo al piano base. Il piano F0→F6 resta
la fondazione (la UI vive in `/owner/`, il wrapper la incapsula — un solo codebase UI).

Vincolo grafico: la UI `/owner/` riusa i design token della dashboard desktop
(`apps/dashboard/public/staff/styles.css` + riferimento `Tako Dashboard App/Tako Dashboard.html`).
L'app iOS deve sembrare la app del computer.

### F7 — Guscio nativo (nuova fase)

#### F7.1 — Toolchain Android sul Mac
- **Goal** — `sdkmanager` installato con platform-tools + platforms;android-35 + build-tools + emulator + una system-image arm64; JDK 17+; un AVD che boota headless.
- **Tool** — `brew install --cask temurin@17` (o zulu17), `brew install --cask android-commandlinetools`; `sdkmanager --licenses`; `avdmanager create avd`. Tutto in `~/Library/Android/sdk` standard, `ANDROID_HOME` esportato in `~/.zshrc` (append, mai riscrivere).
- **Verifier** — `sdkmanager --list_installed`; `emulator -avd tako -no-window -no-audio &` poi `adb wait-for-device shell getprop sys.boot_completed` → `1`.
- **Exit** — max 4 iterazioni; se brew cask fallisce, download diretto commandlinetools zip da Google. Rischio P2 (solo tooling).

#### F7.2 — App Expo → guscio owner
- **Goal** — `apps/app` (Expo 56 già scaffoldato) diventa il guscio owner: WebView che punta a `/owner/` (non più `/staff/index.html`), schermata nativa di connessione (probe LAN `tako.local:4317` → remoto → offline, riuso logica F1.4), deep-link `tako://`, splash+icona Tako, nome app **Tako** (bundle id `com.takoitalia.tako` — [da confermare con Manuel]).
- **Tool** — `apps/app/app/index.tsx` (WebView esistente), `app.json` (name/slug/ios.bundleIdentifier/android.package), `expo-secure-store` per il token enroll, `react-native-webview` già presente.
- **Verifier** — `pnpm --filter @tako/app exec tsc --noEmit`; Metro bundla senza errori; WebView carica `/owner/` dall'appliance locale (`pnpm tako` vivo).
- **Exit** — max 4 iterazioni. Rischio P1.

#### F7.3 — Build iOS (Xcode locale)
- **Goal** — `npx expo prebuild -p ios` + `xcodebuild -sim` producono una .app che boota nel Simulatore iPhone, carica `/owner/` dall'appliance sul Mac e si naviga.
- **Tool** — Xcode 26.6 presente; `xcrun simctl` per boot/install/launch; screenshot via `simctl io screenshot` + probe.
- **Verifier** — `xcodebuild ... -destination 'generic/platform=iOS Simulator' build` exit 0; `simctl launch` → processo vivo; screenshot mostra la dashboard (verifica contenuto via accessibility dump, non a occhio).
- **Exit** — max 5 iterazioni. Firma device fisico/TestFlight = azione Manuel (team Apple Developer già attivo per HearFlow). Rischio P1.

#### F7.4 — Build Android (APK)
- **Goal** — `npx expo prebuild -p android` + `./gradlew assembleRelease` producono un APK firmato (keystore locale generato e persistito in `~/.tako/android-keystore`) che boota nell'emulatore e carica `/owner/`.
- **Tool** — toolchain F7.1; `adb install` + `adb shell am start`; `adb exec-out screencap`.
- **Verifier** — APK < 80 MB, installa e boota su AVD, WebView carica (emulatore raggiunge il Mac via `10.0.2.2` → la schermata di connessione deve accettare host manuale).
- **Exit** — max 5 iterazioni. Play Store = azione Manuel ($25); l'APK è comunque distribuibile direttamente ai ristoratori Android. Rischio P1.

#### F7.5 — Push native (dopo F3)
- **Goal** — notifiche native nel guscio: iOS via APNs, Android via FCM, riusando i trigger F3.2.
- **Nota** — richiede credenziali Apple Developer + progetto Firebase → **azione Manuel**. Nel frattempo la PWA installata riceve Web Push (F3). Non blocca F7.2-F7.4.

### Ordine di esecuzione autonoma (2026-08-09)

```
F7.1 (Android toolchain)  ────────────┐   (parallelo, disgiunto dal repo)
F0.1 → F0.2 → F0.3                    │
F1.1 → F1.2 → F1.3 → F1.4             ├─→ F7.2 → F7.3 + F7.4 → F6.1
F2.1 → F2.2 → F2.3 → F2.4 → F2.5 → F2.6
F3.1 → F3.2 → F3.3(parte auto)
F4.1..F4.4 → F5.1..F5.3
```

Branch di lavoro: `feat/owner-app`. Gate a ogni task: `pnpm tsc --noEmit` + `pnpm lint` + suite
vitest senza regressioni (stack vivo via pg-portable, cfr. memoria run-integration-tests).
Restano per Manuel (invariati dal §7): tunnel token/wildcard DNS, collaudo su device fisici,
serata sul campo (F6.2), store, APNs/FCM.

---

### Diario esecuzione 2026-08-09

**F0.1, F0.2, F0.3 — tutti DONE al primo giro** (nessuna Exit di fallimento è scattata, nessuna
delle 3 iterazioni massime consumata per nessuno dei tre task).

#### Misure

| Grandezza | Prima | Dopo |
|---|---|---|
| `vitest` (stack vivo) | 9 file, **76 test verdi** | 9 file, **76 test verdi** |
| `pnpm lint` | 0 errori, 169 warning | 0 errori, 169 warning |
| `tsc --noEmit` (per-package) | pulito | pulito |
| `GET /owner/index.html` | 404 | 200 |
| `GET /staff/index.html` | 200 | 200 (invariato) |
| `owner/app.js` minificato | — | **189,4 KB** (budget 250 KB) |
| `owner/app.css` | — | 3,2 KB |
| `grep -c text/babel owner/index.html` | — | **0** |

Rebuild da pulito (`rm -rf apps/dashboard/public/owner && node scripts/build-owner-app.mjs`):
riproducibile e **byte-identico** (stesso sha1 su `app.js` fra due build consecutive).

Commit sul branch `feat/owner-app`: `0fe246d` (F0.1), `b3f5a2e` (F0.2), `ff0dff4` (F0.3).

#### Deviazioni e correzioni al piano

1. **Il verifier `pnpm tsc --noEmit` dalla root è degenere.** Non esiste `tsconfig.json` nella root
   (solo `tsconfig.base.json`), quindi `tsc` senza `-p` stampa l'help ed esce senza controllare
   nulla: come gate **non verifica niente**. Sostituito con il typecheck per-pacchetto
   (`tsc -p tsconfig.json --noEmit` in `apps/server`, `apps/dashboard`, `apps/web`, `packages/db`),
   che è il controllo che il piano intendeva. `packages/types` non ha un `tsconfig.json` — è
   pre-esistente, non introdotto qui. **Da correggere nei task successivi**: il §5 va aggiornato,
   oppure va aggiunto un `tsconfig.json` di root con i project reference.
2. **`scripts/pg-portable.mjs` non esiste**: lo script sta in **`packages/db/pg-portable.mjs`**.
3. **L'entry del server è `apps/server/src/bootstrap.ts`, non `src/index.ts`**: `index.ts` esporta
   `startServer()` e non la invoca, quindi `tsx src/index.ts` esce subito senza aprire la porta.
4. **Stack di verifica su `:3001`** (pg-portable + `db:migrate` + `tsx src/bootstrap.ts` con
   `DATABASE_URL`/`PORT`) invece di `pnpm tako` su `:4317`: stesso codice, avvio più rapido e
   uguale a quello che si aspetta `tests/helpers.ts`.
5. **F0.1 — nessun ripiego necessario.** Due registrazioni di `fastifyStatic` con
   `decorateReply: false` convivono senza conflitti: la seconda (`prefix: '/owner/'`) si registra
   accanto a quella staff. Il fallback "unico root `public/` con due prefissi figli" previsto
   dall'Exit **non è servito**. Le due registrazioni sono deliberatamente **indipendenti**: se
   `/owner` non è stato buildato, il server logga un warning e `/staff` resta identica a prima.
6. **`tauri.conf.json` non è stato toccato**: `"resources": ["resources/server/**/*", ...]` è un
   glob ricorsivo che copre già `resources/server/owner/`. Il piano lo elencava fra i tool di F0.1;
   nessuna modifica era necessaria.
7. **F0.2 — React bundlato sta nel budget: 189,4 KB < 250 KB.** Né il ripiego su
   `preact/compat` né l'innalzamento della soglia a 400 KB sono stati necessari. Non sono state
   riusate le UMD di `public/staff/lib/` perché sono **build di sviluppo** (`react.js` 110 KB,
   `react-dom.js` 1,08 MB): bundlare React 19.2.5 in produzione con
   `define: {'process.env.NODE_ENV':'"production"'}` costa un quinto. **Il budget è ora un gate
   della build**: `scripts/build-owner-app.mjs` fallisce se `app.js` sfora, invece di degradare in
   silenzio.
8. **CSS non importato dal TypeScript** (`app.css` è una entry esbuild separata): importare
   `./app.css` da `main.tsx` avrebbe richiesto una dichiarazione ambient `declare module '*.css'`
   nel tsconfig della dashboard. Entry separata = zero attrito col typecheck.
9. **I token sono duplicati, non importati** (`owner-src/tokens.css` copia il blocco `:root` di
   `public/staff/styles.css`): la staff porta con sé 553 righe di `@font-face` e regole desktop che
   sul telefono sono peso morto. **Debito esplicito**: se la palette staff cambia, va allineata qui —
   è annotato in testa al file.
10. **F0.3 — l'Exit sul service worker non è scattata.** Su `http://localhost` il contesto è sicuro,
    quindi `navigator.serviceWorker` **è** esposto e la registrazione riesce. Il caveat del piano
    resta valido e invariato per l'`http://` LAN puro (es. `http://tako.local:4317`), dove il
    browser non espone l'API: **la verifica definitiva dell'installabilità su device resta a F1.2**,
    su HTTPS via tunnel.
11. **Icone duplicate dentro lo scope** (`public/owner/icons/`, copiate da `public/icons/` dalla
    build): un manifest con `scope: "/owner/"` non deve dipendere da risorse fuori scope, e Fastify
    serve solo le sottocartelle registrate — `/icons/` alla root **non è raggiungibile**
    dall'appliance (è lo stesso motivo per cui il manifest di `/dashboard` è orfano).
12. **Il manifest orfano di `/dashboard` non è stato toccato**, come da istruzione.
13. **`build-server-bundle.mjs` è stato modificato in due passi** per tenere ogni commit
    auto-consistente: in F0.1 una copia *guardata* di `public/owner` (lo script di build non
    esisteva ancora), in F0.3 la versione finale che **rigenera** l'app owner prima di copiarla —
    così il bundle desktop non può spedire un artefatto stale rispetto a `owner-src/`.

#### Verifica puppeteer (F0.3, `puppeteer-core` + Chrome di sistema)

Su `http://localhost:3001/owner/`: shell React montata (`.ow-app`, titolo "Tako Owner"), SW attivo
con scope `http://localhost:3001/owner/`. Prova del bypass della cache: `/health` → 200 e
`/api/auth/me` → 401 **dalla rete**; **a rete spenta entrambe falliscono** (se fossero cacheate
risponderebbero comunque), mentre `/owner/app.css` risponde 200 dalla cache. Reload offline: la
shell si ridisegna dalla cache col badge "Appliance non raggiungibile" — nessuna pagina bianca.

#### Note per i task successivi

- `apps/dashboard/public/owner/` è **output di build committato** (come lo è `public/staff/`), così
  `pnpm tako` serve `/owner/` senza passi extra. Chi tocca `owner-src/` deve ricordarsi di
  rieseguire `pnpm --filter @tako/dashboard build:owner` e committare l'output.
- `owner-src/**` **è** dentro il perimetro di ESLint e del tsconfig della dashboard (a differenza di
  `public/**`, che è ignorato): il codice dell'app owner è soggetto ai gate, quello della staff no.

---

### Diario esecuzione 2026-08-09 — F1 (accesso remoto)

**F1.1, F1.2, F1.3, F1.4 — tutti DONE.** Nessuna Exit di fallimento è scattata; nessuno dei
quattro task ha consumato più di una iterazione sul proprio goal. Commit sul branch
`feat/owner-app`: `088d759` (F1.1), `9479b36` (F1.2), `e33565d` (F1.3), `4d2b5da` (F1.4).

#### Misure

| Grandezza | Prima di F1 | Dopo F1 |
|---|---|---|
| `vitest` root (stack vivo) | 9 file, **76 verdi** | 11 file, **113 verdi** |
| `vitest` cloud (`test:cloud`) | 7 file, **71 verdi** | 7 file, **76 verdi** |
| `pnpm lint` | 0 errori, 169 warning | 0 errori, 169 warning |
| `tsc -p … --noEmit` (server, dashboard, web, db) | pulito | pulito |
| `owner/app.js` minificato | 189,4 KB | **191,7 KB** (budget 250 KB) |
| Probe LAN → ripiego sul tunnel | — | **1254 ms** su LAN appesa (budget 1200) |
| Kill di `cloudflared` → `state: 'down'` | — | **2 s** (budget 60 s) |

Verifier di F1.4: `node scripts/test-owner-endpoint.mjs` — 17 controlli su 6 scenari, tutti
verdi. Verifica e2e del gate sull'**hostname pubblico reale** (quick tunnel): senza token
404 su `/api/tables`, `/health`, `/owner/`, `/staff/`; con token valido 200 sull'API e 404
su `/staff`, `/api/setup/*`, `/api/auth/pin-roster`.

#### Cosa è stato trovato strada facendo (e che il piano non prevedeva)

1. **Socket.io sta SOTTO Fastify: l'hook `onRequest` non lo vede.** Engine.io sostituisce i
   listener `request` del server HTTP e gestisce anche `upgrade`, quindi `/socket.io/*` non
   passa da nessun hook Fastify: il gate di F1.3, da solo, avrebbe lasciato **un WebSocket
   anonimo esposto su internet** (handshake senza auth, room pubbliche `join:menu`,
   connessioni tenute aperte a piacere). Chiuso con l'opzione `allowRequest` di Socket.io,
   che copre sia il polling sia l'upgrade, riusando la stessa verifica di sessione.
   **Deviazione dichiarata**: lì il rifiuto è un **403 di engine.io**, non il 404 opaco —
   è sotto il router e non c'è modo di rispondere 404 senza mettersi a sostituire i listener
   del server HTTP. Non espone nulla (nessun dato, nessun form, nessuna enumerazione), ma è
   l'unico punto della superficie remota che non risponde 404.
2. **Il preflight CORS non porta mai l'`Authorization`** (lo dice la specifica): il gate lo
   bloccava e il browser scartava **ogni** chiamata al remoto → il dual-endpoint non
   funzionava affatto. Gli `OPTIONS` ora passano prima della deny-list: `@fastify/cors`
   risponde 204 a qualunque OPTIONS, che la rotta esista o no (nessun oracolo), senza corpo
   e senza effetti; la richiesta vera che segue resta gated.
3. **L'hostname del tunnel mancava nella allowlist CORS.** L'app owner vive su due origini e
   deve parlare con entrambe. Aggiunto in `allowedHosts()`, solo l'hostname del nostro tunnel.
4. **Bug pre-esistente riemerso: rate-limit → 500 invece di 429.** `errorResponseBuilder`
   restituiva un oggetto senza `statusCode`; `@fastify/rate-limit` fa `throw` di quel valore
   e il nostro error handler globale, non trovando `statusCode`, lo classificava 5xx.
   Invisibile in dev (loopback esente) e **reale in produzione**. Ora restituisce un `Error`
   con `statusCode`/`code`; misurato: 100×200 poi 10×429.
5. **L'esenzione loopback del rate-limit copriva anche il tunnel.** Dietro `cloudflared`
   ogni richiesta arriva da `127.0.0.1`: in dev il tunnel sarebbe stato l'unico canale
   *senza* rate limit. Ora l'`allowList` non esenta mai le richieste sull'Host pubblico.
6. **`/health` non è più pubblico sul remoto** (nessuna eccezione al "404 su tutto"), quindi
   la sonda dell'endpoint remoto viaggia con il Bearer. Conseguenza voluta: senza sessione
   l'endpoint remoto risulta non disponibile — correttamente, perché senza sessione non ci
   si potrebbe fare nulla comunque.

#### Deviazioni rispetto alla lettera del piano

- **F1.1** — verificato con un **quick tunnel** (`TAKO_TUNNEL_QUICK=1`) invece che con un
  `TAKO_TUNNEL_TOKEN` di prova: un token finto non sale mai, quindi non avrebbe potuto
  mostrare la transizione `up → down → up` che è il vero Stop del task. Il quick tunnel dà
  anche l'hostname pubblico reale usato per il collaudo e2e del gate. Il ramo con token
  nominato è nel codice ma **non collaudato** (richiede il token di Manuel).
- **F1.1** — lo stato `up` si legge dai **log del processo figlio** (`Registered tunnel
  connection`). Il match è volutamente largo (più alternative) perché il formato dei log di
  `cloudflared` è cambiato fra le versioni: legarsi a una stringa esatta significherebbe
  restare bloccati su `down` dopo un aggiornamento del binario.
- **F1.2** — il test di **persistenza** dell'heartbeat non sta in `tests/tunnel-endpoints.test.ts`
  come indicato, ma in `apps/server/tests/cloud/pairing.test.ts` (+5 casi): il server locale
  su `:3001` gira in `TAKO_MODE=local` e **non monta `/api/pair/*`**, mentre la suite cloud
  ha già Postgres effimero e migrazioni cloud. `tests/tunnel-endpoints.test.ts` esiste e
  copre il resto (validatore condiviso, due endpoint, payload di `/info`, nessun leak del
  token) — 12 casi.
- **F1.3** — riconoscimento **asimmetrico** invece che con una sola regola: *severità* =
  Host pubblico **oppure** header CF (fail-closed: chi falsifica `CF-Ray` dalla LAN si
  auto-impone il regime più severo, non guadagna nulla); *fiducia* = **solo** Host ==
  `remoteHost` (l'allowlist esatta prevista dall'Exit), unica condizione che autorizza il
  rate-limit a usare `CF-Connecting-IP`. Il piano prevedeva l'allowlist come ripiego: è
  stata adottata subito, ma limitata al punto in cui la fiducia conta davvero.
- **F1.4** — aggiunto uno scenario non previsto (**LAN appesa**): una connessione rifiutata
  fallisce in 14 ms e non esercita mai il timeout, quindi senza questo caso il budget di
  1200 ms non sarebbe stato verificato da nulla.

#### Conseguenze da tenere presenti in F2

- **`/owner/` non è raggiungibile dal remoto via navigazione**: una navigazione del browser
  non può portare un header `Authorization`, quindi il gate risponde 404. L'app si installa
  **in LAN** e da fuori il guscio arriva dal service worker; solo le chiamate API vanno in
  rete, col Bearer. Coerente con D3, ma va detto nell'onboarding.
- **Stessa cosa per `/uploads/*`**: un `<img src="/uploads/…">` non porta il Bearer → le foto
  dei piatti non si vedono dal remoto. Da risolvere in F2 (URL firmati, oppure un cookie di
  sessione `Secure`+`SameSite` sull'origine del tunnel — il gate legge già il cookie
  `tako_session`, quindi la strada è aperta senza toccare questo file).
- **Realtime dal remoto**: il socket deve passare il token in **query** (`?token=`), unico
  canale disponibile all'upgrade WebSocket di un browser; `join:restaurant` continua a
  volere il suo token come sempre.
- Il gate esegue **una query sessione per richiesta remota**. È lo stesso costo di
  `requireAuth` e riguarda solo il traffico dal tunnel (un telefono), ma resta un vettore di
  carico da internet: mitigato dal filtro di forma sul token (niente query per la spazzatura)
  e dal rate-limit per-IP reale, non risolto del tutto.

#### Cosa resta a Manuel

- **Tunnel nominato**: token Cloudflare + DNS wildcard `*.box.takoitalia.com`, poi
  `TAKO_TUNNEL_TOKEN` e `TAKO_TUNNEL_HOSTNAME` sull'appliance (oggi collaudato solo il quick
  tunnel). Il binario `cloudflared` va imbarcato in `apps/app/src-tauri/resources/` per la
  build desktop: la cascata di risoluzione lo cerca già lì.
- Collaudo su **device fisico** dal 4G, fuori dal locale.

---

### Diario esecuzione 2026-08-09 — F2 (Wave 1: MVP vendibile)

**F2.1 … F2.6 — tutti DONE.** Nessuna Exit di fallimento è scattata sui task F2; è
scattata invece — dichiarata e documentata — l'**Exit F0.2 sul budget del bundle** (vedi
sotto). Commit sul branch `feat/owner-app`: `fb6db93` (F2.1), `7a5c9d5` (F2.2),
`0c035cb` (F2.3), `521fe8e` (F2.4), `531123f` (F2.5), `6bbbac8` (F2.6).

#### Misure

| Grandezza | Prima di F2 | Dopo F2 |
|---|---|---|
| `vitest` root (stack vivo) | 11 file, **113 verdi** | 15 file, **132 verdi** |
| `vitest` cloud (`test:cloud`) | 7 file, **76 verdi** | 7 file, **76 verdi** (invariato) |
| `pnpm lint` | 0 errori, 169 warning | 0 errori, **169 warning** (invariato) |
| `tsc -p … --noEmit` (server, dashboard, web, db) | pulito | pulito |
| `owner/app.js` grezzo | 191,7 KB | **264,3 KB** (budget ora 400) |
| `owner/app.js` in **brotli** (ciò che viaggia) | — | **71,8 KB** (budget 100) |
| TTI su Fast 3G | — | **1573 ms** (budget 2000), 77 KB sul filo |
| Scroll orizzontale a 390/430 px | — | **zero**, su tutte e 5 le sezioni |

Verifier di F2.2/F2.3: `node scripts/test-owner-shell.mjs` — 13 controlli, tutti verdi.
Test nuovi: `tests/device-enroll.test.ts` (5), `tests/mobile-realtime.test.ts` (3),
`tests/waiter-calls.test.ts` (4), `tests/oggi-summary.test.ts` (3), più 4 casi di cassa
aggiunti a `tests/load-review-fixes.test.ts`.

#### La sola Exit scattata: budget del bundle (F0.2)

Con la UI vera + `socket.io-client` il bundle grezzo passa da 191,7 a 264,3 KB e sfora i
250 KB. Il salto viene tutto dal client socket, che è *il* realtime dell'app: senza, la
sala non è live e l'app perde la sua ragione d'essere. Rimedi valutati nell'ordine
previsto dal piano:

1. **Code-splitting delle sezioni** — scartato: le cinque sezioni pesano insieme ~25 KB;
   il grosso è React + socket.io, che servono comunque al primo paint.
2. **preact/compat** — scartato per ora: risparmierebbe ~35 KB grezzi (~10 KB in brotli)
   in cambio di un rischio di incompatibilità su un'app che tocca i soldi. Resta la
   prima carta da giocare se il budget tornasse stretto.
3. **Soglia alzata, ma con un gate nuovo e più severo** — scelta adottata. Grezzo ≤ 400 KB
   (è il tempo di *parse* sul telefono), **brotli ≤ 100 KB** (è il tempo di *rete*, cioè
   ciò che decide il TTI su 4G). Il gate sul brotli è più stretto del vecchio 250 KB
   grezzo: 71,8 KB misurati oggi.

Il pezzo che rende sensato il secondo gate è la **pre-compressione**: la build scrive
`app.js.br`/`.gz` accanto agli artefatti e il server registra `/owner/` con
`preCompressed: true`. Zero dipendenze nuove (brotli sta in `node:zlib`). Prima di
questo, /owner/ viaggiava **non compresso**: ~200 KB su 4G.

#### Cosa è stato trovato strada facendo (e che il piano non prevedeva)

1. **Una sola migrazione, come chiesto — ma `device_enroll_codes` non era prevista.** Il
   piano parlava solo di "metadati device su `sessions`". Il codice di arruolamento però
   deve stare da qualche parte con HMAC a riposo, TTL e consumo single-use *atomico*: in
   memoria sarebbe stato più semplice ma il consumo atomico e la revoca non sarebbero
   sopravvissuti a un riavvio dell'appliance a metà servizio. La 0017 contiene quindi
   tre cose: colonne su `sessions`, `device_enroll_codes`, `waiter_calls`.
2. **`hashToken` del cloud non è riusabile sull'appliance**: dipende da `TOKEN_PEPPER`,
   che esiste solo in `TAKO_MODE=cloud` (lancia se manca). Sull'appliance l'HMAC usa
   `JWT_SECRET` — già obbligatorio all'avvio e persistito in `~/.tako/jwt-secret` — con
   un prefisso di dominio (`device-enroll:`), perché lo stesso segreto firma anche i JWT
   del tavolo e due usi diversi non devono produrre lo stesso digest.
3. **Il refresh rolling avrebbe allungato a 90 giorni anche le sessioni mobile.**
   `middleware/auth.ts` decideva la finestra dalla LUNGHEZZA del token, e il token
   mobile è un `nanoid(64)` come quello staff: senza il campo `kind` la sessione del
   telefono si sarebbe auto-estesa a 90 giorni, contraddicendo D3. Ora la finestra la
   decide `sessions.kind`, e per il mobile non si emette nessun `Set-Cookie`.
4. **`posX`/`posY` hanno DEFAULT 0, non NULL.** Il piano (e la staff) assumono `null` per
   "non piazzato", ma un tavolo creato da `POST /api/tables` nasce a (0,0). Nell'app un
   tavolo a (0,0) è trattato come **non piazzato** e finisce nella griglia sotto la
   piantina: incollarlo all'angolo in alto a sinistra sarebbe un'informazione inventata.
5. **Trappola dei test, incontrata tre volte**: una richiesta senza corpo ma con
   `Content-Type: application/json` riceve **400** da Fastify prima ancora di entrare
   nella route. Vale per `POST /device/enroll-code`, `DELETE /devices/:id`,
   `POST /waiter-resolve`. Nei test si passa il solo header di autenticazione.
6. **Il piano indicava `lib/cleanup.ts` per la retention delle chiamate cameriere, ma
   quel file è la pulizia del TESTO dettato (ASR), non dei dati.** La retention di 7
   giorni sulle chiamate risolte vive in `routes/tables.ts`, opportunistica sul
   `waiter-resolve`. Le chiamate *aperte* sono comunque limitate a una per tavolo
   dall'indice unico parziale.
7. **Il verifier del guscio, se non stubba l'API, misura il database della macchina.**
   Peggio: con un token finto la prima 401 riporta l'app alla schermata di collegamento e
   il probe non trova più le cinque sezioni. Ora `test-owner-shell.mjs` intercetta
   `/api/*` e risponde con dati finti *deliberatamente lunghi* (nomi di piatti
   chilometrici, numeri di tavolo come `Dehors-12`).
8. **Il controllo "niente scroll orizzontale" da solo non basta.** Con
   `overflow-x: hidden` sul contenitore scorrevole, un testo troppo lungo viene
   **tagliato** e `scrollWidth` resta perfetto: il test diceva verde mentre sullo schermo
   mancava mezza parola. Il probe ora verifica anche che nessun elemento sfondi il
   viewport — e così ha trovato il difetto vero nelle righe chiave/valore (ora con i
   puntini di sospensione).

#### Il rischio residuo di F1 sulle foto dei piatti: chiuso

Da remoto un `<img src="/uploads/…">` non porta l'header `Authorization` (è una
navigazione del browser) e il gate risponde 404. Fra le due strade previste — URL firmate
o cookie di sessione sull'origine del tunnel — si è scelta **la terza, più semplice e
senza superficie nuova**: `api.blobUrl()` scarica la risorsa con `fetch` + Bearer e
restituisce un `blob:` URL da dare all'`<img>`. Nessuna URL da far scadere, nessun cookie
da inventare (che avrebbe riaperto il tema `SameSite`/`Secure` fra le due origini), e in
LAN il costo è identico a prima. Il metodo è pronto in `lib/api.ts`; la prima schermata
che mostra foto di piatti è la Wave 2 (F4.2/F4.3), che lo userà.

#### Deviazioni rispetto alla lettera del piano

- **F2.1** — la revoca elencata in D3 come `DELETE /api/auth/devices/:id` è owner-only e
  scoped al ristorante (join su `users.restaurantId`), non "sessione dell'utente
  corrente": è l'owner che deve poter scollegare *un* telefono, anche non suo.
- **F2.2** — i due woff2 (Nunito + DM Sans, subset latin, 101 KB) vengono spediti. Il
  piano non lo prevedeva e F0 aveva deciso i font di sistema, ma il vincolo esplicito di
  Manuel è che l'app **sembri la dashboard**: il doppio font è metà dell'identità visiva.
  Con `font-display: swap` non entrano nel percorso critico e il service worker li
  scarica una volta sola. JetBrains Mono NON viene spedito (−31 KB): gli id tecnici usano
  il monospace di sistema.
- **F2.3** — la lista ordini usa `?limit=25`; il cursore `meta.nextBefore` lo produce il
  server, il client non lo ricostruisce.
- **F2.4** — il test di concorrenza lancia **tre** pagamenti in parallelo per giro invece
  di due (venti giri): con due il vincitore è quasi deterministico, con tre si esercita
  davvero la coda dell'advisory lock. Zero doppi addebiti in 20 giri.
- **F2.5** — aggiunto un caso non previsto: cinque tocchi consecutivi sul pulsante
  producono UNA sola chiamata aperta (indice unico parziale), non cinque badge.

#### Note per i task successivi

- La sezione **Altro** è oggi il posto naturale dove atterreranno onboarding push (F3.3) e
  le voci di Wave 2: è già strutturata a card indipendenti.
- `useLiveEvent` / `useLiveReload` (in `lib/live.tsx`) sono il punto unico in cui
  agganciare i nuovi eventi socket: l'elenco `EVENTS` è esplicito di proposito.
- Chi tocca `owner-src/` deve rieseguire `node scripts/build-owner-app.mjs` e committare
  l'output: `apps/dashboard/public/owner/` è artefatto di build versionato (ora include
  anche `.br`/`.gz` e i due font).
