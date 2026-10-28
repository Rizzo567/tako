# 16/10/2026 — Manuel (agente) — F3 prezzo promo + F4 scarsità

- **Obiettivo:** prezzo promo e etichette «Ultime porzioni» / «Solo oggi» (dashboard, bot WhatsApp, menu pubblico, PDF) + fix del «piatto del giorno» che non scadeva sulla pagina pubblica.
- **Ramo:** `codex/feat-promo-scarsita` (da `7cd55ab`). Nessun deploy, nessuna migrazione, nessuna scrittura su DB reale.
- **Dove leggere:** `docs/webapp/feature-vendita-2026-10-16/contracts.md` (sezione F3+F4), `implementation-notes.md` (sezione F3+4), `verifica-f3-f4/` (registrazioni e controlli).
- **Test:** nuovi `tests/menu-sales.test.ts`, `tests/twilio-menu-sales.test.ts`, `tests/parity/menu-sales.integration.test.ts` verdi; `pnpm test` senza rossi nuovi rispetto alla base; typecheck server/web verdi; registrazioni 83/83.
- **Per Ale, prima del deploy:** schema prima di bot e dashboard (bundle vecchi cancellano i campi nuovi); al merge con F1 risolvere l'add/add di `contracts.md` e `implementation-notes.md` tenendo tutte le sezioni; F2 deve chiamare `stampOnlyToday` quando un preset va online.
- **Prossimo passo:** OK di Manuel su «Solo oggi = scade l'etichetta, non il piatto», poi merge.
