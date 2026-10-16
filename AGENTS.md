# Takomenu (originale Tako)

Sorgente canonica: questo repository; il vecchio progetto separato TakoMenu è ritirato.

Prima delle feature menu frontend leggere `/Users/manuel/Documents/brain/design/menusmart/DESIGN.md` e `motion.tokens.json`. Usare ricette M01–M15 pertinenti, superfici persistenti, retargeting, stato reale, reduced motion e focus/touch. Token runtime: `apps/web/src/lib/menu-motion.tokens.json`; primitive: `menu-motion.ts`, `MenuHeaderControls`, `AnimatedMenuLogo`. Verifier: `node scripts/verify-menu-header-motion.mjs`, typecheck web e build statico. Per nuove feature compilare il contratto FEATURE-MOTION e registrare movimento reale; screenshot soli non bastano. Nessuna scrittura per test nelle dashboard clienti Menumal/MenuSmart.

## Collaborazione e clone portabile
Il contratto di movimento condiviso è incluso in `docs/design/DESIGN.md` e `docs/design/motion.tokens.json`: usarlo quando i percorsi Brain locali sopra non esistono. Le registrazioni originali citate nel contratto non sono incluse.
Leggere `docs/HANDOFF-ALE.md` all'inizio del lavoro. In parallelo usare un branch `codex/` per attività; niente force-push e niente deploy o migrazioni di produzione impliciti. Non inserire credenziali, copie del DB o dati privati nei commit.

## Inizio e fine sessione obbligatori — Manuel e Ale

Prima di lavorare leggere `docs/TEAM_CONTEXT.md` e `docs/SESSION_PROTOCOL.md`. Sincronizzare all'inizio e alla fine di ogni sessione: controllare il working tree, fare fetch, leggere decisioni e aggiornamenti comuni, integrare senza sovrascrivere lavoro locale. Usare branch personali per attività; al termine aggiornare il contesto/registro, verificare, committare e pushare il proprio branch. Niente pull cieco su file modificati, niente reset/force-push o rebase di branch condivisi. Un push su un branch personale non aggiorna automaticamente il branch comune né la memoria delle chat. Segnalare esplicitamente conflitti o accessi mancanti.
