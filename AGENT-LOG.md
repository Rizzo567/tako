# Tako — Agent Log

> Diario append-only. Ogni run agente aggiunge una entry.
> Non modificare entry passate.

---

## Formato entry

```
## [YYYY-MM-DD HH:MM] — [task eseguito]
- Task: [nome task dal BACKLOG]
- Azione: [cosa è stato fatto in 2-3 frasi]
- File modificati: [lista]
- Stato: completato | parziale | bloccato
- Note: [se bloccato, perché]
```

---

<!-- Le entry degli agenti vengono aggiunte qui sotto -->

## [2026-06-23] — Consolidamento deploy "scarica, apri, opera" (F0–F3)
- Task: rendere Tako avviabile come app singola subito operativa (modello AIKE), cross-platform, con setup connessione automatico.
- Azione:
  - **F0** — il server Fastify ora serve anche la dashboard staff statica su `/staff` (+ redirect `/`), same-origin: niente più processo Next `:3000` né rewrite. CSP rilassata per far girare la SPA (sostituisce di fatto il task SEC "Abilita CSP": header CSP presente, zero violazioni sul flusso normale).
  - **F1** — `packages/db/src/embedded.ts`: avvio automatico di Postgres embedded + migrazioni idempotenti con `EMBEDDED_DB=1`. Nuovo entry `apps/server/src/bootstrap.ts` che imposta `DATABASE_URL` PRIMA di importare il server (bug d'ordine risolto, verificato con DATABASE_URL fasullo). Porta embedded default `54317`.
  - **F2** — `apps/app/src-tauri`: la shell Tauri spawna il server come processo figlio all'avvio e lo termina alla chiusura (cargo check: 0 errori).
  - **F3** — mDNS `tako.local` (best-effort) + `GET /api/system/info` (IP LAN, URL, QR) per collegare i dispositivi senza digitare IP. `ping tako.local` risolve.
  - Avvio unico `pnpm tako` (`scripts/tako.mjs`): tutto in un processo, segreto JWT persistente in `~/.tako`.
  - Fix appliance LAN: cookie Secure solo dietro TLS (`COOKIE_SECURE=1`), CORS riflette l'origine, script seed/migrate onorano `DATABASE_URL`. Service worker non serve più pagina bianca.
- File modificati: `apps/server/src/{bootstrap,index}.ts`, `apps/server/src/lib/{cookies,network,mdns}.ts`, `apps/server/src/routes/system.ts`, `apps/server/src/types/multicast-dns.d.ts`, `packages/db/src/embedded.ts`, `packages/db/*.mjs`, `apps/app/src-tauri/src/lib.rs`, `apps/app/src-tauri/tauri.conf.json`, `apps/app/package.json`, `apps/dashboard/public/sw.js`, `scripts/tako.mjs`, `package.json`, `docs/MASTER-PLAN.md`.
- Stato: completato (F0–F3 verificati end-to-end: login 200 + render dashboard autenticata completa da `pnpm tako`).
- Note: restano F4 (packaging installer Tauri con node+server+Postgres come risorse) e la UI onboarding/collega-dispositivi nella SPA — backend pronto. Vedi `docs/MASTER-PLAN.md`.
