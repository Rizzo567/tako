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
| 17 | Test suite integrazione 72/72 | ⬜ | in corso |

## E. Frontend / UI

| # | Voce | Stato | Evidenza |
|---|------|-------|----------|
| 18 | App owner rendering WebView2/DPI | ⛔ | dipende app installata |
| 19 | PWA viewport mobile | ⬜ | via Edge |
| 20 | Divergenze UI Win vs atteso | ⬜ | |

---

## Log tentativi

(aggiornato a ogni voce)

## Proposta a Manuel (decisioni aperte)

1. **Sezione A**: due strade per sbloccarla —
   (a) il Mac pubblica `v0.1.0` con l'asset `*_x64-setup.exe` → scarico e installo;
   (b) installo Rust+MSVC in VM e faccio `pnpm tauri build` per generare l'installer
   localmente (lento, ma sblocca A senza dipendere dalla release).
   In attesa di decisione procedo con B/C/D (server dev :3001) che non dipendono dall'app impacchettata.
