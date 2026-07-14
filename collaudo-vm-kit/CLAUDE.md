# Istruzioni operative — Claude Code nella VM Windows (Tako)

Copia questo file nella ROOT del clone (`tako/CLAUDE.md`) così viene caricato a ogni
sessione. Lingua di lavoro: italiano. Lavori in coppia con un'istanza Claude sul Mac
di Manuel: tu sei le mani sul runtime Windows, lei fa release/review/integrazione.

## Metodo di lavoro — SEMPRE loop engineering

Per OGNI task, non procedere a tentativi: progetta il loop e fallo girare da solo.

1. **Goal specifico** con condizione di stop TESTABILE (il goal principale è in
   `GOAL.md`: ogni voce ha il suo criterio).
2. **Tool nel ciclo**: pnpm/vitest, avvio app installata, lettura log, curl al server
   :4317, PowerShell (processi, screenshot), browser per la PWA.
3. **Verifier a ogni giro**: un test, una risposta HTTP, una riga di log, un record
   nel DB, uno screenshot. MAI "sembra ok" senza evidenza.
4. **Context management**: delega ai sottoagenti le esplorazioni lunghe; tieni nel
   contesto solo le conclusioni.
5. **Exit espliciti**: max 3 tentativi per voce → poi **BLOCCATO** con evidenza nel
   report e avanti. Niente loop infiniti.
6. **Error handling che adatta**: ogni retry cambia ipotesi in base all'evidenza.

Ciclo: `act → observe → verify → decide → repeat` fino a goal o stop.

## Sottoagenti — usali liberamente

Carta bianca (Task/Agent tool): fan-out di indagine per sottosistema (server
embedded, DB, PWA, updater, UI), **verifica avversariale di ogni fix non banale**
(agente col mandato di confutarlo), agenti di lettura per i docs lunghi.

## Fonti di verità nel repo

- `docs/tako-tecnico-interno.md` — architettura completa
- `docs/tako-funzionalita-ristoratori.md` — cosa fa il prodotto per l'utente
- `apps/app/src-tauri/src/lib.rs` — bootstrap embedded (node, Postgres, lock, heal)
- `apps/server/` — API Fastify + logica; `apps/web/` — PWA cliente; `packages/db/` —
  schema e migrazioni
- CI `windows-test.yml` (72/72 su windows-latest) = baseline: quei test DEVONO
  restare verdi con ogni tuo fix

## Regole ferree

- Lavora su branch **`collaudo-vm-tako`**; commit piccoli; push del branch OK,
  MAI push su `main`. MAI toccare tag, release, `infra/updates-worker`, secrets.
- MAI cancellare i dati dell'app (`%LOCALAPPDATA%` di Tako) se non per testare
  esplicitamente il primo avvio — e in quel caso UNA volta sola, documentandolo.
- Report vivo in `collaudo-vm-kit/REPORT-claude-vm.md` nel clone, aggiornato dopo
  OGNI voce; a ogni aggiornamento fai commit+push del branch (il Mac lo legge da lì).
- Test integrazione locali: vedi `docs/tako-tecnico-interno.md` — pattern:
  Postgres portable :5432 (tako/tako/takodb) + `pnpm db:migrate` + server :3001
  (`DATABASE_URL`/`PORT`) + `pnpm vitest` → attesi 72/72.
- Le funzioni che richiedono credenziali esterne (WhatsApp pairing, foto AI Gemini,
  dettatura Groq) o hardware (stampanti): marca **SKIP-CREDENZIALI** /
  **SKIP-HARDWARE** nel report, non bloccarti e non chiedere le chiavi.
- Divergenza dubbia (bug o scelta?): domanda nel report, non indovinare.
