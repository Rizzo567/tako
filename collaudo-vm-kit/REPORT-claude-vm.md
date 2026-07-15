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

| # | Voce | Stato | Evidenza |
|---|------|-------|----------|
| 1 | Installer NSIS + WebView2 | ⛔ | Nessuna release v0.1.0; no build locale (no Rust) |
| 2 | Primo avvio bootstrap | ⛔ | idem |
| 3 | TAKO_HOME struttura | ⛔ | idem |
| 4 | Chiusura → 0 processi orfani | ⛔ | idem |
| 5 | Riavvio dati intatti | ⛔ | idem |
| 6 | Crash test + healStaleLock | ⛔ | idem |
| 7 | Single-instance | ⛔ | idem |

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
| 16 | updates.takoitalia.com/latest.json | ⬜ | solo lettura |
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
