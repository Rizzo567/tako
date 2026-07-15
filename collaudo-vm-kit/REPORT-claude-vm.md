# REPORT collaudo Tako su Windows — istanza VM

**Data inizio:** 2026-07-15
**Ambiente:** UTM Win11 ARM, x64 emulato. Utente `Manuel`.
**Branch:** `collaudo-vm-tako` (push per il Mac).
**Metodo:** loop engineering (act→observe→verify→decide, max 3 tentativi/voce → BLOCCATO).

Legenda: ✅ verificato con evidenza · ⚠️ con riserve · ❌ fallito · ⛔ BLOCCATO · ⏭️ SKIP · ⬜ non ancora

---

## Blocchi ambiente rilevati subito

- **Release `v0.1.0` NON pubblicata** su `Rizzo567/tako` (`gh release list` vuoto).
  L'installer NSIS non è scaricabile. Dipendenza dal Mac (pubblica lui le release).
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

| # | Voce | Stato | Evidenza |
|---|------|-------|----------|
| 8 | Setup locale/sala/tavoli | ⬜ | via server dev :3001 |
| 9 | Menu CRUD | ⬜ | |
| 10 | Ordine al tavolo + conto | ⬜ | |
| 11 | Inventario | ⬜ | |
| 12 | Persistenza dopo riavvio | ⬜ | |

## C. PWA cliente

| # | Voce | Stato | Evidenza |
|---|------|-------|----------|
| 13 | QR/URL tavolo, menu carica | ⬜ | |
| 14 | Ordine realtime da Edge | ⬜ | |
| 15 | Da telefono vero | ⬜ | dipende rete UTM |

## D. Updater e test suite

| # | Voce | Stato | Evidenza |
|---|------|-------|----------|
| 16 | updates.takoitalia.com/latest.json | ⚠️ | feed raggiungibile HTTP 200, JSON valido v0.1.0. **Ma `platforms` ha solo `darwin-aarch64`, nessun `windows-x86_64`** → updater Windows non troverebbe update (ok per "stessa versione = nessun prompt", ma auto-update Windows non ancora cablato nel feed). Query dal runtime app = BLOCCATO (bug P0) |
| 17 | Test suite integrazione 72/72 | ✅ | **72/72 passed**, 8 file, 19.84s (vedi log) |

## E. Frontend / UI

| # | Voce | Stato | Evidenza |
|---|------|-------|----------|
| 18 | App owner rendering WebView2/DPI | ⛔ | dipende app installata |
| 19 | PWA viewport mobile | ⬜ | via Edge |
| 20 | Divergenze UI Win vs atteso | ⬜ | |

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

## Proposta a Manuel (decisioni aperte)

1. **Sezione A**: due strade per sbloccarla —
   (a) il Mac pubblica `v0.1.0` con l'asset `*_x64-setup.exe` → scarico e installo;
   (b) installo Rust+MSVC in VM e faccio `pnpm tauri build` per generare l'installer
   localmente (lento, ma sblocca A senza dipendere dalla release).
   In attesa di decisione procedo con B/C/D (server dev :3001) che non dipendono dall'app impacchettata.
