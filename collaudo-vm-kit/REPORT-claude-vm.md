# REPORT collaudo Tako su Windows — istanza VM

**Data inizio:** 2026-07-15
**Ambiente:** UTM Win11 ARM, x64 emulato. Utente `Manuel`.
**Branch:** `collaudo-vm-tako` (push per il Mac).
**Metodo:** loop engineering (act→observe→verify→decide, max 3 tentativi/voce → BLOCCATO).

Legenda: ✅ verificato con evidenza · ⚠️ con riserve · ❌ fallito · ⛔ BLOCCATO · ⏭️ SKIP · ⬜ non ancora

---

## Blocchi ambiente rilevati subito

- **Release `v0.1.0`**: all'inizio del run NON era pubblicata (`gh release list` vuoto);
  il Mac l'ha pubblicata **durante** il collaudo → installer scaricato e installato
  (sezione A poi sbloccata).
- **Toolchain Rust/Tauri assente** (`rustc`/`cargo` non presenti, no MSVC).
  Build locale dell'installer non possibile senza installare Rust + VS Build Tools
  (pesante in VM emulata). → decisione per Manuel.
- **Conseguenza:** Sezione A (installazione + ciclo di vita) è la parte NON provabile
  finora. Vedi proposta in fondo.

Prerequisiti presenti: Node v24.18.0, git 2.55, gh 2.96 (auth `Rizzo567`),
corepack→pnpm 9.0.0. Repo clonato in `C:\Users\Manuel\tako`.

### ⚠️ Vincolo arch scoperto (rilevante per il prodotto)

La VM è **Win11-ARM** e il Node installato è **arm64 nativo**. `embedded-postgres`
(Postgres embedded usato da app e test) **non ha binari `windows-arm64`** (non esiste
il pacchetto `@embedded-postgres/windows-arm64`; esiste solo `windows-x64`).
Con Node arm64 → `Error: Unsupported arch "arm64" for platform "win32"`.

- **Impatto prodotto:** Tako NON gira su Windows-on-ARM con runtime arm64. I PC dei
  ristoratori sono x64 → nel target reale il problema non si presenta. Ma va scritto:
  **"Windows ARM non supportato"** (se mai un cliente avesse un Surface ARM).
- **Workaround collaudo:** installato Node **x64** portatile (v24.18.0) in scratchpad;
  tutto lo stack (pg, migrate, server, vitest) girerà sotto x64 in emulazione,
  identico al target x64 reale e alla CI `windows-latest`. `pnpm install` rieseguito
  sotto x64 per materializzare `@embedded-postgres/windows-x64`.

---

## A. Installazione e ciclo di vita

> **Aggiornamento:** durante il run il Mac ha pubblicato la release **v0.1.0** con
> l'asset `Tako_0.1.0_x64-setup.exe`. Sezione A sbloccata. Installato in silent (`/S`).

> **AGGIORNAMENTO 0.1.1** (rilasciata dal Mac con i miei 2 fix): re-collaudo sezione A
> sull'app vera. VOCE 16 updater ✅. **Trovato un 3° bug Windows (CORS)** che 0.1.1 non
> aveva ancora → fixato e validato end-to-end (swap `server.mjs` ricompilato in locale).

| # | Voce | Stato | Evidenza |
|---|------|-------|----------|
| 1 | Installer NSIS + WebView2 | ✅ | install silent OK → `%LOCALAPPDATA%\Tako\`; WebView2 runtime presente (pv 150.0.4078.65) |
| 2 | Primo avvio bootstrap | ✅ | con 0.1.1 (fix P0/P1) + fix P2 CORS: `app.exe` + 2×`node.exe` (resources\server) + 9×`postgres.exe`, `:4317/health` 200, `setup/status` 200, **dashboard owner carica in-app** (screenshot `app-dashboard-0.1.1.png`) |
| 3 | TAKO_HOME struttura | ✅ | `%LOCALAPPDATA%\com.tako.dashboard\`: `pgdata`, `jwt-secret`, `device-secret`, `cloud-identity.enc`, `server.pid`, `uploads`, `.cookies` — struttura sensata |
| 4 | Chiusura → 0 processi orfani | ✅ | `WM_CLOSE` → 0 `app.exe` / 0 `node.exe` / 0 `postgres.exe`, 0 listener su :4317/:3002. **Nota:** valeva solo dopo una chiusura pulita; dopo un CRASH restava un orfano web permanente → vedi BUG #4 (ora fixato: ri-verificato 0 processi anche nel ciclo crash→riavvio→chiusura) |
| 5 | Riavvio dati intatti | ✅ | riavvio dopo chiusura pulita: `:4317/health` 200 in **4-8s** (vs ~18-24s del primo avvio con initdb); dati intatti (Trattoria Collaudo, Bruschetta, tavoli, setup 4/5 — screenshot `a7-single-instance.png`) |
| 6 | Crash test + healStaleLock | ✅ | `taskkill /F /IM app.exe` (uccide solo l'immagine = crash reale) → riavvio: **healStaleLock OK** (`[db] trovato Postgres orfano (pid 9560), lo termino` + backup a copia fredda + cluster ripulito, health 200 in **36s** da stato sporco, **10s** con fix). **Trovato BUG #4 (orfano web su :3002)** → fixato e verificato end-to-end. Niente doppio Postgres: 1 solo postmaster |
| 7 | Single-instance | ✅ | 1ª istanza su → lancio 2ª: **esce subito, exit code 0**; resta **1 solo `app.exe`** (pid 10808), 2 node invariati (nessun 2º server/web), 1 solo postmaster (pid 9812) su :54317, listener :4317/:3002 invariati. Screenshot `a7-single-instance.png` (finestra unica) |

### 🟠 BUG #4 (P2) — dopo un crash il web node ORFANO tiene :3002 per sempre

**Sintomo:** dopo un crash dell'app (non una chiusura pulita), il figlio node del **web
cliente** sopravvive reparentato e continua a tenere `:3002`. Al rilancio, il nuovo
figlio web muore in `EADDRINUSE`, il watchdog lo respawna e dopo 5 tentativi in 60s
**si arrende** (`il servizio resta giù`). L'app **sembra funzionare** — la PWA risponde
200 — ma è servita dall'**orfano**, che nessuno supervisiona più e che **sopravvive
anche alla chiusura pulita** dell'app successiva: leak permanente fino a reboot/kill
manuale (viola la voce 4).

**Come l'ho isolato** (il finding della sessione precedente era diagnosticato male:
"lib.rs non ha reclaim della porta"):
- Il figlio **SERVER** una bonifica ce l'ha già ed è **corretta**: `reclaimOrphanServer()`
  in `apps/server/src/bootstrap.ts:46` (pidfile `TAKO_HOME/server.pid` + verifica
  d'identità anti PID-reuse). Rilanciando a mano il `server.mjs` del bundle con l'env
  dell'app, il log lo dimostra:
  `[srv] server orfano precedente (pid 7932), lo termino` →
  `[db] trovato Postgres orfano (pid 9560), lo termino` → cluster ripulito → server su.
  Non si vedeva perché lo stdout dei figli node non è catturato (app GUI senza console).
- Il figlio **WEB** (`resources/web/apps/web/server.js`, Next standalone) **non ha
  nessuna bonifica**: nessun pidfile, e `lib.rs` non gli passa nemmeno `TAKO_HOME`.

**Evidenza runtime (0.1.1 installata):** baseline app 10048 → figli node 1916 (server,
`:4317`) + 6508 (web, `:3002`). Dopo `taskkill /F /IM app.exe`: entrambi vivi, parent
10048 morto. Rilancio app (6784) → server: nuovo 3868 reclama `:4317` (orfano 1916
ucciso, health 200) ✅; web: orfano **6508 ancora vivo** tiene `:3002`, il nuovo figlio
web (1772) **sparisce** → l'app finisce con **0 figli web**. `GET :3002` → **200 servito
dall'orfano** (40386 byte). Chiusura PULITA della nuova app → **node 6508 sopravvive**
ancora, con `:3002` in LISTENING.

**Perché un `taskkill /F /IM` è un test onesto:** un crash vero (access violation) uccide
il solo processo `app.exe` e lascia i figli, esattamente come qui. (`End task` del Task
Manager uccide l'albero: caso diverso e più benigno.) Quindi il bug è **reale**, non un
artefatto del test.

**Fix applicato** (nessuna modifica a `lib.rs`, solo bundle):
- nuovo `scripts/web-server-wrapper.cjs`: prima di cedere il controllo a Next chiede
  *chi tiene la mia porta* (`Get-NetTCPConnection` su win32, `lsof` altrove), verifica
  l'**identità** del proprietario (dev'essere un `node.exe` la cui command line contiene
  il `server.js` del bundle web) e solo allora lo termina, attendendo il rilascio del
  listener. Un processo **estraneo** su `:3002` non viene mai toccato.
- `scripts/build-server-bundle.mjs`: il `server.js` di Next diventa `server.next.js` e
  il wrapper prende il suo posto (stessa dir → `__dirname` invariato per Next).
- Scelta *port-owner* invece che *pidfile*: è la domanda giusta ("chi tiene :3002?") e
  non ha il rischio del pidfile stantio con PID riusato. Non serve `TAKO_HOME` → zero
  modifiche Rust.

**Verifica end-to-end in VM** (wrapper installato nel bundle 0.1.1, come per il CORS):
- avvio normale non regredito: health 200 in 5.7s, PWA `:3002` 200;
- ciclo crash→rilancio: `orfano web 9076 MORTO`, nuovo web 4012 possiede `:3002`
  (PWA 200), orfano server 1732 morto, entrambi i figli riparentati alla nuova app
  (8532) → **0 orfani**; health 200 in 9.7s;
- chiusura pulita successiva → **0 processi app/node/postgres, 0 listener**.
- Regressione: `npx vitest run` → **72/72 verdi**.

**Verifica avversariale del fix** (agente col mandato di confutarlo). Ha **fallito** nel
dimostrare gli scenari catastrofici — e il perché è utile: niente mutual-kill loop tra
due web (il plugin single-instance è il **primo** plugin in `lib.rs:435` → la 2ª istanza
esce prima di `setup()`, non spawna mai un 2º web; e il watchdog respawna solo dopo che
`child.wait()` è ritornato); impossibile colpire il figlio SERVER; bundler idempotente
(`rmSync(webOut)` precede il rename → agisce sempre su una copia fresca); `require()`
dentro l'async IIFE non cambia Next (`__dirname` invariato, non usa `process.argv`).
Ha però trovato **4 difetti reali**, tutti corretti e ri-verificati:

1. **(P2) L'identity check a substring poteva uccidere un processo ESTRANEO.**
   `/server\.js/i` + `/[\\/]web[\\/]/i` matchano anche `C:\dev\altroprogetto\web\server.js`
   (e `…/next/dist/server/lib/start-server.js` contiene la substring `server.js`).
   → Ora il confronto è **esatto**: la command line del proprietario deve contenere il
   path di **questo stesso file** (`__filename`) — wrapper e orfano SONO lo stesso file,
   quindi è identità vera, non euristica.
   **Test di regressione**: un `node …\altroprogetto\web\server.js` estraneo su `:3002`
   → log `[web] :3002 è tenuta dal pid 9028, che non è il web Tako: non lo tocco`,
   **estraneo vivo, porta sua, risponde**, e Next fallisce in EADDRINUSE come prima ✅.
2. **(P2) PID reuse tra SIGTERM e SIGKILL** (finestra fino a 2.4s: l'orfano muore,
   Windows ricicla il PID, il SIGKILL colpiva l'innocente) → ora l'identità è
   **ri-verificata prima di escalare**.
3. **(P2) Su macOS il fix sarebbe stato inerte in silenzio**: BSD `ps` **tronca** gli
   args e il path (lungo, dentro `Tako.app`) sparirebbe → nessuna bonifica + log
   fuorviante. → ora `ps -ww` (niente troncamento).
4. **(P2) Stallo d'avvio**: ogni probe PowerShell costa ~1.8s e il loop d'attesa lo
   richiamava fino a 11 volte (~20s, fino a 88s su VM lenta) con l'**event loop
   bloccato** (`execFileSync`) → Next non bindava. → ora il port-owner si legge con
   **`netstat`** (exe nativo); PowerShell resta solo per la command line, **una volta
   sola** e solo se la porta è occupata. **Misurato dopo il fix: orfano bonificato in
   2s** (era ~20s).
   Aggiunta anche una guardia in `build-server-bundle.mjs`: se `apps/web` diventasse
   `"type":"module"` Next emetterebbe un `server.js` ESM e il wrapper CJS esploderebbe
   **solo nel bundle** (invisibile in dev) → ora la build si ferma con un errore chiaro.

**Limite noto (accettato):** si bonifica solo l'orfano che **tiene la porta**. Un orfano
vivo ma non in LISTEN non verrebbe raccolto — copertura più stretta del pidfile del
server. Per BUG #4 come osservato è sufficiente.

### 🔴 BUG #3 (P2, blocca l'UI) — CORS: origin WebView2 Windows non in allowlist

**Sintomo:** con 0.1.1 (fix P0/P1) l'app parte, backend up (:4317 health 200, node+pg
vivi), **ma la finestra resta bloccata sullo splash** "Avvio Tako… Preparazione del
database" e la dashboard non carica mai → app ancora inutilizzabile su Windows.

**Root cause:** lo splash (`apps/app/standalone-dist/index.html`) fa
`fetch("http://localhost:4317/health")` e al primo `ok` redirige a `/staff`. Su Windows
la WebView2 serve l'app da origin **`http://tauri.localhost`**; su mac/linux è
`tauri://localhost`. L'allowlist CORS del server embedded (`apps/server/src/index.ts:111`)
contiene `localhost` (che copre `tauri://localhost`, hostname=`localhost`) ma **non**
`tauri.localhost` → la fetch cross-origin dalla WebView è bloccata da CORS → splash in
loop infinito. Verificato: `/health` con `Origin: http://tauri.localhost` NON ritorna
`access-control-allow-origin`; con `tauri://localhost` sì.

**Fix applicato** (`apps/server/src/index.ts`): aggiunto `'tauri.localhost'` all'allowlist
`allowedHosts`. Copre `http://` e `https://tauri.localhost` (porta vuota già ammessa).

**Verifica end-to-end:** ricompilato `server.mjs` in locale (solo esbuild, no Rust),
sostituito nel bundle installato, riavviata l'app → `/health` con Origin
`http://tauri.localhost` ora ritorna l'ACAO corretto → **lo splash supera e la dashboard
owner carica in-app** (login → `app-dashboard-0.1.1.png`: "Buongiorno Manuel!", KPI,
setup 4/5). Serve rebuild ufficiale dal Mac (0.1.2) con questo fix.

### 🔴 BUG P0 — server embedded non parte su Windows (app inutilizzabile)

**Sintomo:** aprendo `app.exe` la finestra WebView2 si apre ma il backend embedded
(:4317) non parte mai; nessun `node.exe`/`postgres.exe`, UI owner senza API.

**Errore** (stdout dei figli node, node bundled v22.23.1):
```
Error: EISDIR: illegal operation on a directory, lstat 'C:'
    at resolveMainPath (node:internal/modules/run_main)
```
Il bootstrap Rust rilancia node in loop; ogni tentativo fallisce identico.

**Root cause (confermata catturando l'argv reale via preload `--require`):** l'app
passa a `node.exe` un path **verbatim/extended-length**:
```
argv[1] = \\?\C:\Users\Manuel\AppData\Local\Tako\resources\server\server.mjs
```
`resource_dir()` di Tauri su Windows restituisce path col prefisso `\\?\`. Il resolver
del main-module di Node v22 non lo gestisce e riduce il path alla radice `C:` →
`lstat('C:')` → EISDIR. Colpisce **entrambi** i figli: `server/server.mjs` (:4317) e
`web/apps/web/server.js` (PWA :3002).

**Perché la CI non l'ha preso:** `windows-test.yml` avvia il server via
`tsx src/bootstrap.ts` (ramo dev `TAKO_SERVER_CMD`), non via lo spawn bundle con
`resource_dir()`. Quel percorso non era mai stato esercitato — "mai collaudato su
Windows vero".

**Fix applicato** (`apps/app/src-tauri/src/lib.rs`): helper `deverbatim()` che toglie
il prefisso `\\?\` prima di spawnare i figli node, in `spawn_server` e `spawn_web`.
No-op su mac/linux e su path normali → non tocca i 72/72 della CI.

**Verifica del fix (meccanismo, senza rebuild):** lanciando il node bundled sul
medesimo `server.mjs` con path NON-verbatim (`C:\...\server.mjs`) il server **parte**
(`Tako server running`). Quindi togliere il prefisso risolve. **Manca la toolchain
Rust in VM** → non posso produrre l'installer corretto: il **Mac deve ricompilare**
`collaudo-vm-tako` e ripubblicare per validare A end-to-end (voci 4-7).

**Nota per il Mac (debito, non bloccante):** `deverbatim()` fa uno strip letterale di
`\\?\`; NON gestisce il verbatim-UNC `\\?\UNC\...` (lascerebbe `UNC\...`). Non
raggiungibile con install NSIS in `%LOCALAPPDATA%`/`Program Files` (drive locale),
ma se un giorno si supportasse l'esecuzione da share di rete servirebbe `dunce::simplified`.

### 🟠 BUG #2 (P1) — fallback pg_ctl dell'embedded DB morto sotto avvio elevato

**Scoperto** lanciando il server embedded reale con la shell **elevata (admin)**:
Postgres su Windows **rifiuta** l'avvio diretto sotto un token amministrativo
(`Execution of PostgreSQL by a user with administrative permissions is not permitted`).
Il codice ha un fallback via `pg_ctl` (che crea un token ristretto e avvia comunque) —
`packages/db/src/embedded.ts:163-172` — ma il catch faceva:
```
console.log('... riprovo via pg_ctl:', (e as Error).message)
```
e `embedded-postgres` su Windows rigetta con **`e` = undefined** → `TypeError: Cannot
read properties of undefined (reading 'message')` → il processo **crasha PRIMA** di
raggiungere `pg_ctl`. Quindi il fallback pensato proprio per l'avvio elevato era morto.
(Il bundle `server.mjs` v0.1.0 mostra lo stesso crash a riga 139.)

**Impatto:** se il ristoratore avvia Tako come amministratore (comune sui mini-PC),
l'embedded DB non parte affatto. Da utente NON elevato l'avvio diretto riesce e il bug
non si manifesta → invisibile finché non si prova elevato (mai fatto prima).

**Fix applicato** (`packages/db/src/embedded.ts`): accesso null-safe
`(e as Error)?.message ?? String(e)` (idem sul catch di `createDatabase`), così il
fallback `pg_ctl` viene eseguito.

**Verifica end-to-end (VM, shell elevata, sorgente via `tsx`):** log →
`avvio diretto fallito, riprovo via pg_ctl: undefined` → `Postgres embedded in ascolto
su 127.0.0.1:54317` → `database "takodb" creato` → `migrazioni applicate` →
`Tako server running` + `/health` 200. ✅ **Fallback funziona, embedded DB su.**
Cluster con `--encoding=UTF8` forzato (embedded.ts:155) → encoding OK, nessuna
regressione del fix UTF8.

## B. Funzionalità core owner

Testato contro il **server embedded reale su :4319** (config bundle: `EMBEDDED_DB=1`,
Postgres embedded UTF8 su :54317, migrazioni applicate) — lo stesso codice `server.mjs`
del bundle, pilotato via HTTP con due cookie jar (owner `tako_session`, cliente `tako_table`).

| # | Voce | Stato | Evidenza |
|---|------|-------|----------|
| 8 | Setup locale/sala/tavoli | ✅ | login owner, ristorante, `POST /api/tables/rooms` + `/api/tables/` → tavolo con `qrToken` (2 tavoli) |
| 9 | Menu CRUD | ✅ | menu day-1 presente; `POST` sezione "Antipasti" + piatto "Bruschetta" prezzo 6.5 (201) |
| 10 | Ordine al tavolo + conto | ✅ | ordine 2× → owner lo vede (`/orders/active` n=1) → stato `confirmed` → conto **TOTALE=13.00** (2×6.5 esatto) → pagamento chiude (billsCount 1, revenue 13) |
| 11 | Inventario | ✅ | crea Farina 10kg → carico +5 → scarico −3 → **qty=12**; `/inventory/stats` OK (totalValue, itemCount, lowCount, outCount, perItem) |
| 12 | Persistenza dopo riavvio | ✅ | dopo **hard-kill** (crash) + restart: menu, inventario (12), tavoli, storico ordini, incasso conto (`revenue:13`) tutti persistiti (7/7) |

## C. PWA cliente

| # | Voce | Stato | Evidenza |
|---|------|-------|----------|
| 13 | QR/URL tavolo, menu carica | ✅ | cliente `GET /api/customer/table/<qrToken>` → 200 + cookie `tako_table`; `GET /api/customer/restaurant/<id>/menu` → menu pubblico contiene "Bruschetta" |
| 14 | Ordine realtime → owner | ✅ | `POST /api/customer/orders` (2×, idempotencyKey) → 201; owner lo vede subito in `/orders/active`. Layer Socket.IO realtime coperto dai 22 test "realtime" (voce 17, verdi su Windows) |
| 15 | Da telefono vero | ⚠️/⛔ | **Catena LAN verificata sull'app installata**: server bind `0.0.0.0:4317` e web `0.0.0.0:3002`; da IP LAN `http://192.168.64.2:4317/health` → **200**, `http://192.168.64.2:3002/` → **200** (40386 byte), **mDNS `http://tako.local:3002/` → 200**; firewall Windows con regole `node.exe` **Allow** inbound. Manca solo il telefono fisico (Manuel assente) → **BLOCCATO-HARDWARE**, ma tutto ciò che sta sotto il telefono è verde |

## D. Updater e test suite

| # | Voce | Stato | Evidenza |
|---|------|-------|----------|
| 16 | updates.takoitalia.com/latest.json | ✅ | feed ora `version 0.1.1` + `platforms: darwin-aarch64, windows-x86_64`. **Update flow testato dal runtime app**: 0.1.0 installata → updater propone 0.1.1 (dialog "Aggiornamento Tako") → accettato → scaricato+installato → **app.exe ora 0.1.1** (~18s). ✅ |
| 17 | Test suite integrazione 72/72 | ✅ | **72/72 passed**, 8 file, 19.84s (vedi log) |

## E. Frontend / UI

Screenshot in `collaudo-vm-kit/screenshots/`. UI resa in **Edge (Chromium 150)** —
stesso motore di WebView2; la resa in-app vera richiede il rebuild (bug P0).

| # | Voce | Stato | Evidenza |
|---|------|-------|----------|
| 18 | App owner rendering / DPI | ✅ | **In-app WebView2 reale** (`app-dashboard-0.1.1.png`): dashboard owner pulita, nav completa, KPI, grafico, setup 4/5, font leggibili, nessun testo tagliato/glitch. Anche `staff-logged.png` (Edge, con dati €13). Screenshot dashboard a login riuscito |
| 19 | PWA viewport mobile | ✅ | `pwa-mobile.png` (390×844): menu cliente "Bruschetta Collaudo 6,50 €", azioni Cameriere/Carrello/Lingua, nav Menù/Ordine, touch target ampi, viewport mobile corretto |
| 20 | Divergenze UI Win vs atteso | ⚠️ | **Audit completo fatto** (codice + in-app): **8 divergenze reali**, 2 P1. La peggiore — **Alt+Space apre il menu di sistema Windows** — verificata dal vivo nell'app (screenshot `e20-altspace-menu-sistema.png`). **Nessun handler `metaKey`-only**: l'unico hotkey globale è già cross-platform. Dettaglio sotto |

### Voce 20 — audit divergenze UI Windows (dettaglio)

Metodo: audit del codice **spedito** (nota: la UI owner vera non è `apps/dashboard/src`
— guscio Next quasi inutilizzato — ma `apps/dashboard/public/staff/src/*.js`, caricata
via `standalone-dist/index.html` → `:4317/staff/index.html`) + verifica dal vivo
nell'app in-app dei punti verificabili.

**La buona notizia (ipotesi peggiore smentita):** **non esiste un solo handler
`metaKey`-only** nel codice spedito. L'unico hotkey globale è già scritto
cross-platform: `11-copilot.js:1073` → `(e.metaKey || e.ctrlKey) && e.key === "k"` →
**Ctrl+K funziona su Windows**. Anche `prefers-reduced-motion`, i font (woff2
self-hosted + fallback `system-ui` → Segoe UI) e i fallback sono gestiti bene.

| # | Divergenza | file:riga | Gravità | Proposta |
|---|-----------|-----------|---------|----------|
| 1 | **Alt+Space collide col menu di sistema Windows** (Ripristina/Sposta/Chiudi): la scorciatoia della **dettatura** è inutilizzabile e apre un menu OS spurio. `preventDefault()` nel webview NON lo sopprime. Su mac ⌥Space è libero. **Verificato dal vivo** (screenshot) | `11-copilot.js:1074` | **P1** | **fixare**: su Windows disabilitare/rimappare (es. Ctrl+Shift+Space) |
| 2 | **Tutte le label dicono `⌘K`/`Cmd+K`**: il tasto funziona (Ctrl+K) ma su Windows **nessuno lo scopre**. Badge "⌘K" su "Apri Cowork", placeholder e intro chat, tooltip mic | `04-screens-operative.js:78`, `11-copilot.js:73,889`, `08-dictation.js:491` | **P1** | **fixare** insieme al #3 |
| 3 | **Nessun rilevamento piattaforma nel frontend** (zero `navigator.platform`/`userAgentData`/`isMac`) → causa radice del #2: non c'è modo di scegliere ⌘ vs Ctrl. `07-app-root.js:18` rileva `isTauri`, non l'OS | — | P2 | fixare: helper `isMac` + `MOD_LABEL` condiviso |
| 4 | `titleBarStyle:"Overlay"` + `trafficLightPosition` sono **macOS-only** in Tauri v2 → su Windows ignorati, titlebar nativa standard | `tauri.conf.json:17-18` | P2 | fixare (config per-OS) |
| 5 | `WindowDragStrip`: striscia drag 30px montata su **qualsiasi** OS se `isTauri`; su Windows è **ridondante** (titlebar nativa già presente) e intercetta i mousedown dei primi 30px. Mitigazione: coincide con padding vuoto → ruba click su area vuota | `07-app-root.js:17-25`, `03-shell-nav.js:102` | P2 | fixare: montare solo su mac |
| 6 | `.scrollbar-hide` sui caroselli orizzontali della PWA: su desktop Windows **niente scrollbar e niente swipe** → l'affordance di scroll sparisce | `apps/web/src/app/globals.css:191-192` | P2 | fixare se la PWA gira su desktop; accettare se solo mobile |
| 7 | `backdrop-filter: blur(30px) saturate(200%)` su nav **fissa e sempre visibile**: il blur più pesante del codebase, candidato n.1 a jank su WebView2 con GPU integrata di un mini-PC | `03-shell-nav.js:397` | P2 | **misurare sull'HW target**, poi decidere |
| 8 | `type="datetime-local"` dentro input con stile custom: su WebView2 rendering molto diverso (campo segmentato + icona) → possibile disallineamento nelle modali | `09-reservations.js:137`, `10-shifts.js:97-98` | P2 | verifica visiva |

**Accettati (non fixabili / cosmetici):** `-webkit-font-smoothing:antialiased` è no-op su
Windows (testo più marcato che su mac — inevitabile); `<select>`/`type="number"` nativi
resi in stile Windows; scrollbar custom visibili (i contenitori sono flex → si adattano);
`100vw` è sicuro perché `.screen{overflow:hidden}` toglie la scrollbar dal body.

**Fuori voce 20 (a11y, cross-platform, non divergenza):** le modali (`02-kit.js:186-192`)
non hanno focus trap, chiusura con Escape né `role="dialog"`. Pesa di più su Windows
(uso mouse+tastiera) ma vale anche su mac.

---

## Log tentativi

### Voce 17 — Test suite integrazione ✅ (1° tentativo utile, dopo fix arch ambiente)
Sequenza (identica a `windows-test.yml`), tutto sotto **Node x64**:
1. `node packages/db/pg-portable.mjs` → Postgres :5432, initdb **UTF8**, db `takodb`.
   - Ostacolo: con Node arm64 `embedded-postgres` fallisce (no binario windows-arm64);
     con Node x64 mancava `@embedded-postgres/windows-x64` → risolto con
     `pnpm install --force` sotto x64 (materializza initdb.exe/postgres.exe).
2. Verifica encoding: `server_encoding=UTF8 takodb=UTF8` ✅ (fix Windows regge).
3. `pnpm db:migrate` → 14 migrazioni applicate, exit 0.
4. `PORT=3001 pnpm --filter server exec tsx src/bootstrap.ts` → `/health` = 200
   `{"status":"ok"}`, server su 0.0.0.0:3001, mDNS `tako.local → 192.168.64.2`.
5. `npx vitest run` → **Test Files 8 passed (8), Tests 72 passed (72)**, 19.84s, exit 0.

Evidenza log: `vitest.log`, `pg.log`, `server.log` nella VM (scratchpad/clone).
Conclusione: il runtime Windows x64 regge la suite completa → **la CI non mente**.
Stack pg+server lasciati vivi per proseguire B/C.

### Log fix applicati (branch `collaudo-vm-tako`)

1. `fix(app,win): deverbatim path spawn node embedded` — **BUG P0**, lib.rs. Verificato
   a livello meccanismo (path non-verbatim fa bootare server.mjs). Serve rebuild Mac.
2. `fix(db,win): fallback pg_ctl null-safe su avvio elevato` — **BUG #2 (P1)**,
   embedded.ts. Verificato end-to-end in VM elevata (embedded DB su via pg_ctl).
3. `fix(server,win): tauri.localhost in allowlist CORS` — **BUG #3 (P2)**, index.ts.
   Verificato end-to-end (splash superato, dashboard in-app).
4. `fix(web,win): bonifica del web node orfano dopo un crash` — **BUG #4 (P2)**,
   nuovo `scripts/web-server-wrapper.cjs` + `scripts/build-server-bundle.mjs`.
   Verificato end-to-end sul bundle installato (crash → riavvio → 0 orfani) + verifica
   avversariale (4 difetti trovati e corretti) + test anti-falso-positivo su un
   processo estraneo. **`lib.rs` non toccato.**
5. Regressione: `npx vitest run` dopo i fix → **72/72 verdi** (nessuna rottura CI).
   *Nota di metodo:* una run intermedia ha dato 7 suite fallite — era la suite lanciata
   contro il server `:3001` appena riavviato (2s di vita, non ancora caldo), non una
   regressione: riavviato lo stack e rilanciata → 72/72, exit 0.

---

## GIUDIZIO FINALE — vendibile su Windows?

> **Aggiornato a fine collaudo: sezione A ora è COMPLETA (voci 1-7 tutte ✅).** Non è
> più la parte non provata: è la parte con più evidenza. 4 bug Windows trovati, tutti
> fixati e verificati sul runtime vero.

**Allo stato pubblicato (installer v0.1.1): NO.** Restano fuori dalla release 2 fix
necessari (**#3 CORS**, senza cui l'app resta bloccata sullo splash → inutilizzabile;
**#4 orfano web**). Entrambi validati in VM sostituendo gli artefatti nel bundle
installato, ma **serve il rebuild 0.1.2 dal Mac**.

**Con la 0.1.2 che includa i 4 fix di questo branch: SÌ, CON RISERVE.** La fiducia ora
poggia anche sul **ciclo di vita completo**, non solo su server/DB:

- ✅ **Ciclo di vita A 1-7 completo sull'app installata**: bootstrap, TAKO_HOME,
  chiusura pulita a **0 orfani**, riavvio **4-8s** con dati intatti, **crash test**
  (healStaleLock recupera il cluster sporco + backup a copia fredda, 1 solo postmaster),
  **single-instance** (2ª istanza esce con exit code 0, nessun 2º server/Postgres).
- ✅ **Updater end-to-end su Windows vero**: 0.1.0 → dialog → 0.1.1 installata (~18s).
- ✅ **Catena LAN** per il QR dei clienti: bind `0.0.0.0`, IP LAN e **mDNS `tako.local`**
  rispondono 200, regole firewall `node.exe` Allow presenti.
- ✅ **Nessun handler `metaKey`-only**: le scorciatoie **non** sono rotte su Windows
  (era il rischio UI più grande ipotizzato: smentito).

- ✅ **72/72** test integrazione sul runtime Windows (encoding cluster UTF8 confermato).
- ✅ **Flusso completo owner+cliente** end-to-end sul server embedded reale: menu CRUD,
  tavolo+QR, ordine cliente → owner, **conto con totale corretto (13,00)**, pagamento,
  inventario carico/scarico, statistiche.
- ✅ **Persistenza vera** dopo crash (hard-kill): dati e incasso intatti, lock stantio
  recuperato, Postgres riparte pulito.
- ✅ **UI** owner e **PWA cliente mobile** renderizzano pulite (screenshot).
- ✅ Installer NSIS silent + WebView2 runtime presente.

**Riserve residue:**

1. **Il rebuild 0.1.2 è obbligatorio**: la 0.1.1 pubblicata è **inutilizzabile** senza il
   fix CORS (splash infinito). I 4 fix sono sul branch; 2 dei 4 (P0, P1) sono già in
   0.1.1, gli altri 2 (#3 CORS, #4 orfano web) no.
2. **UI voce 20 — 2 P1 aperti** (non bloccanti la vendita, ma si vedono):
   **Alt+Space** apre il menu di sistema Windows (dettatura inutilizzabile) e **tutte le
   label dicono ⌘K** → su Windows la scorciatoia esiste ma è invisibile. Vanno fixati
   insieme (serve un helper `isMac` nel frontend, oggi assente).
3. **Firma Authenticode** assente → SmartScreen avvisa. Decisione di Manuel.
4. **Windows-on-ARM non supportato** (no binario Postgres embedded arm64): irrilevante per
   PC ristoratori x64, ma da dichiarare.
5. **Debito fix P0**: `deverbatim()` non gestisce verbatim-UNC (`\\?\UNC\…`); non
   raggiungibile con install locale, ma se un giorno si girasse da share di rete usare
   `dunce::simplified`.
6. **Voce 15**: manca solo il telefono fisico (BLOCCATO-HARDWARE); tutta la catena LAN
   sotto di esso è verde.
7. **Da misurare sull'HW target** (non sensato in VM emulata): il `backdrop-filter:
   blur(30px)` sulla nav fissa è il candidato n.1 a jank su un mini-PC con GPU integrata.
8. **Non verificabile in VM**: la toolchain Rust non c'è → i fix in `lib.rs` (P0) restano
   verificati **a livello di meccanismo**, non compilati da me. Il fix #4 è stato scritto
   apposta **senza toccare `lib.rs`** anche per questo.

### Azione richiesta al Mac
Ricompilare `collaudo-vm-tako` con i **4 fix** (P0 deverbatim, P1 pg_ctl, #3 CORS,
#4 wrapper bonifica-orfano web) e ripubblicare l'installer Windows come **0.1.2**.
Il feed updater espone già `windows-x86_64` (voce 16 ✅, update 0.1.0→0.1.1 provato dal
runtime). Poi ri-collaudo A6/A7 sull'installer ufficiale (finora provati sul bundle
con gli artefatti sostituiti a mano) + le voci UI se decidete di fixare i 2 P1.

*Ambiente collaudo: la VM è Win11-ARM; l'intero stack è girato sotto **Node x64**
portatile in emulazione (identico al target ristoratore x64 e alla CI windows-latest).*
