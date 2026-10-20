# implementation-notes — deviazioni dal piano (una riga ciascuna, opzione conservativa)

1. Partenza 21/10 01:00 invece di 20/10 21:00 (run del 20 non partita): stop duro 06:00, tabella tempi +4h, cartella `bot-haiku-2026-10-21`.
2. origin aveva 2f67fa1/30a4bf6 (run cloud abbandonata): fast-forward, tenuti solo i documenti come storia; tolta `@anthropic-ai/sdk` (nessun codice la usava; il piano vuole fetch).
3. INCIDENTE 00:57: un `pnpm install` lanciato nella worktree (node_modules era symlink a `../Tako/node_modules`) ha auto-confermato la purga e svuotato il node_modules condiviso del repo principale `Tako` (usato anche da `Tako-qa-1017`). Ripristinato alle 00:58 con `pnpm install --frozen-lockfile` nel repo `Tako` (lockfile suo, nessun file tracciato cambiato). Questa worktree ora ha un node_modules proprio (non più symlink).
4. Stack dev: Docker spento → Postgres Homebrew 17 avviato da me, db `takodb` (ruolo tako) creato e migrazioni drizzle applicate via psql (drizzle-kit non installato). Server :3001 NON avviato (nessuno script dev nel server): i test che lo richiedono sono rossi anche nella baseline.
5. `brainPlan` vive in `owner-brain-route.ts` (non nella lista file di T del piano): aggiunto al perimetro T.
6. A0: schema accettato così com'è → nessuna conversione delle union.
7. Root node_modules senza hoisting di bcryptjs/fastify/drizzle-orm (4 file di test non si caricavano): symlink locali non tracciati `node_modules/{bcryptjs,fastify,drizzle-orm}` → `apps/server/node_modules/…`. Con questo la baseline coincide coi 14 rossi noti.
8. V5: `copy.welcome` (benvenuto 19/10 approvato, v119) escluso SOLO dal controllo emoji; «categori» vietato ovunque.
9. E: verificatore lazy boot aggiornato (cercava `before_app_import`, ora accetta `app_module_ready`; rapporto in release/serverless/). check-active.mjs ritrovato in ~/.config/tako-webapp/rollback-edge-20261016/.
10. BLOCCO deploy scoperto da E: online c'è **v127** (email v121/v125 da codex/manuel-email-activation 5c136e1; sale/tavoli v126/v127 da 24ad33f), non v119. Deploy del ramo così com'è toglierebbe email e sale a tutti i clienti → sottoagente dedicato ricostruisce base v127 in worktree separata (Tako-base-v127); deploy solo se bundle-sections-diff = solo moduli bot (gate 0).
