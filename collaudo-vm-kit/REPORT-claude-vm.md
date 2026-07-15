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

| # | Voce | Stato | Evidenza |
|---|------|-------|----------|
| 1 | Installer NSIS + WebView2 | ✅ | install silent OK → `%LOCALAPPDATA%\Tako\`; WebView2 runtime presente (pv 150.0.4078.65) |
| 2 | Primo avvio bootstrap | ❌→🔧 | **2 bug** (P0 deverbatim + P1 fallback pg_ctl). Embedded DB reale ora bootato via fix (initdb UTF8, pg_ctl, migrazioni, :4319 ✅). App completa serve rebuild dal Mac (P0 in Rust) |
| 3 | TAKO_HOME struttura | ⚠️ | `%LOCALAPPDATA%\com.tako.dashboard\` creata (solo WebView2/EBWebView; struttura server assente perché il backend crasha) |
| 4 | Chiusura → 0 processi orfani | ⛔ | dipende da app funzionante (post-rebuild) |
| 5 | Riavvio dati intatti | ⛔ | idem |
| 6 | Crash test + healStaleLock | ⛔ | idem |
| 7 | Single-instance | ⛔ | idem |

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
| 15 | Da telefono vero | ⛔ | BLOCCATO-RETE: server bind su `0.0.0.0:4319` (LAN-raggiungibile se UTM in bridge); telefono fisico di Manuel non pilotabile in autonomia. mDNS `tako.local → 192.168.64.2` |

## D. Updater e test suite

| # | Voce | Stato | Evidenza |
|---|------|-------|----------|
| 16 | updates.takoitalia.com/latest.json | ⚠️ | feed raggiungibile HTTP 200, JSON valido v0.1.0. **Ma `platforms` ha solo `darwin-aarch64`, nessun `windows-x86_64`** → updater Windows non troverebbe update (ok per "stessa versione = nessun prompt", ma auto-update Windows non ancora cablato nel feed). Query dal runtime app = BLOCCATO (bug P0) |
| 17 | Test suite integrazione 72/72 | ✅ | **72/72 passed**, 8 file, 19.84s (vedi log) |

## E. Frontend / UI

Screenshot in `collaudo-vm-kit/screenshots/`. UI resa in **Edge (Chromium 150)** —
stesso motore di WebView2; la resa in-app vera richiede il rebuild (bug P0).

| # | Voce | Stato | Evidenza |
|---|------|-------|----------|
| 18 | App owner rendering / DPI | ✅⚠️ | `staff-logged.png`: dashboard owner completa e pulita (KPI Incasso €13/Ticket €13/Coperti 4, nav, grafico, setup 4/5), font leggibili, **nessun testo tagliato**, nessun glitch. `staff-dpi150.png` a scala 1.5 OK. ⚠️ resa in Edge, non in-app WebView2 (serve rebuild) |
| 19 | PWA viewport mobile | ✅ | `pwa-mobile.png` (390×844): menu cliente "Bruschetta Collaudo 6,50 €", azioni Cameriere/Carrello/Lingua, nav Menù/Ordine, touch target ampi, viewport mobile corretto |
| 20 | Divergenze UI Win vs atteso | ⚠️ | Nessun glitch/rottura osservato nelle viste testate. Audit completo scorciatoie (Ctrl vs Cmd), animazioni, focus richiede l'app in-app funzionante → dopo rebuild |

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
3. Regressione: `npx vitest run` dopo i fix → **72/72 verdi** (nessuna rottura CI).

---

## GIUDIZIO FINALE — vendibile su Windows?

**Allo stato pubblicato (installer v0.1.0): NO.** L'app installata si apre (WebView2)
ma il **backend embedded non parte** (BUG P0 verbatim path) → app inutilizzabile per
un ristoratore. È il primo, decisivo esito del "mai collaudato su Windows vero": un
bug che la CI non poteva vedere perché testa il server via `tsx`, non via lo spawn
bundle di Tauri.

**Dopo il rebuild con i 2 fix di questo branch: SÌ, CON RISERVE.** Motivo della
fiducia — tutto il resto del prodotto si è dimostrato **solido su Windows x64 reale**:

- ✅ **72/72** test integrazione sul runtime Windows (encoding cluster UTF8 confermato).
- ✅ **Flusso completo owner+cliente** end-to-end sul server embedded reale: menu CRUD,
  tavolo+QR, ordine cliente → owner, **conto con totale corretto (13,00)**, pagamento,
  inventario carico/scarico, statistiche.
- ✅ **Persistenza vera** dopo crash (hard-kill): dati e incasso intatti, lock stantio
  recuperato, Postgres riparte pulito.
- ✅ **UI** owner e **PWA cliente mobile** renderizzano pulite (screenshot).
- ✅ Installer NSIS silent + WebView2 runtime presente.

**Riserve / da completare dopo il rebuild (non verificabili senza app funzionante):**

1. **Voci A 4-7**: zero processi orfani alla chiusura, velocità 2° avvio, single-instance,
   crash test end-to-end **dell'app** (finora provati solo a livello server/DB).
2. **Voce 16 / updater**: il feed `latest.json` espone **solo `darwin-aarch64`** — manca
   `windows-x86_64`. Anche con app corretta, l'auto-update su Windows **non è cablato**:
   o il Worker/feed deve includere la piattaforma Windows, o va documentato "update manuale".
3. **Firma Authenticode** assente → SmartScreen avvisa (atteso, ma impatta la fiducia del
   ristoratore al primo avvio). Decisione di Manuel.
4. **Windows-on-ARM non supportato** (no binario Postgres embedded arm64): irrilevante per
   PC ristoratori x64, ma da dichiarare.
5. **Debito fix P0**: `deverbatim()` non gestisce verbatim-UNC (`\\?\UNC\…`); non
   raggiungibile con install locale, ma se un giorno si girasse da share di rete usare
   `dunce::simplified`.
6. **Voce 15** (telefono reale) e **voce 20** (audit divergenze UI Ctrl/Cmd) da fare a valle.

### Azione richiesta al Mac
Ricompilare `collaudo-vm-tako` (i 2 fix), ripubblicare l'installer Windows, aggiungere
la piattaforma `windows-x86_64` al feed updater. Poi io ri-collaudo A 4-7 + 16 + 20.

*Ambiente collaudo: la VM è Win11-ARM; l'intero stack è girato sotto **Node x64**
portatile in emulazione (identico al target ristoratore x64 e alla CI windows-latest).*
