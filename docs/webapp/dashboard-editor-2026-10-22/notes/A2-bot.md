# A2 — bot: pubblica solo la sua modifica (T3)

## Cosa fa
- `apps/server/src/lib/menu-workspace-bot.ts`: `readBotWorkspace` (vista: catalogo = pubblicato, `revision` = `published_revision`), `applyBotChange`, `mergeBotChange` (fusione base→next sulla bozza), `seededIds`.
- `twilio-menu.ts`: le 10 letture usano `readBotWorkspace`; le 5 coppie «mutateWorkspace bozza + mutateWorkspace pubblica» sono una chiamata `applyBotChange` (stesse etichette). Nessun altro ramo toccato. I controlli `dashboardPending` restano nel codice ma con la vista nuova non scattano più (servono all'interruttore K2).
- `twilio-menu-fullmenu.ts`: menu intero e ripristino → `applyBotChange` con `replaceMenuIds` (solo quel Menu in pubblicato e bozza), copia di sicurezza come prima, versione «Bozza prima di WhatsApp (…)» + avviso `draft_discarded` se la bozza di quel Menu era diversa.
- `menu-day-presets.ts`: job 06:00 e chat («metti online…», riconosciuta da `expectedRevision` assente) → solo il Menu del preset in pubblicato e bozza; versione + avviso solo se la bozza di QUEL Menu aveva modifiche. «Pubblica questo preset» dalla dashboard (con `expectedRevision`) invariato.
- `menu-text-translations.ts`: «pulito» = `!pendingOf(row)`; con bozza pendente traduzioni nelle due copie (add-only, `applyCachedTranslations` su ciascuna), la bozza non si pubblica.
- `twilio-menu-ai.ts`: `applyActions(..., {newId})`, default `randomUUID` (invariato).
- `onboarding-store.ts`: verificato, nessuna modifica (crea il workspace e pubblica una volta con `mutateWorkspace`).

## Decisioni (default, annotate)
- **Fusione per entità invece di replay delle azioni sulla bozza.** La rotta calcola già `next` dal pubblicato (rigoroso, errori come prima); in bozza si riporta solo ciò che è cambiato fra pubblicato e `next` (campi, creati, spostati, eliminati). Stesso effetto del replay «azione per azione», ma copre anche «annulla» (che rimette il menu intero di prima), menu intero, ripristino, preset e traduzioni con una sola regola, e gli id dei creati sono per costruzione quelli di `next`. `actions + idSeed` è comunque supportato (`seededIds`).
- Regole: stesso campo → vince il bot; bersaglio assente in bozza → saltato (`skippedInDraft`); creato in un Sottomenu cancellato in bozza → solo pubblicato; Sottomenu/Menu eliminati dal bot → tolti dalla bozza solo se lì sono vuoti (mai perdere piatti del titolare); se la bozza risultante fosse invalida resta quella di prima (`draft:invalid`).
- **Aritmetica delle revisioni**: P' = P+steps, D' = D+steps (steps = 2, 3 col menu intero); se dopo la scrittura bozza = pubblicato → P' = D' = D+steps. `applyBotChange` restituisce `revision = P'-1`, quindi il vecchio `saved.revision+1` (proposte, «ultima modifica») resta la nuova revisione vista dal bot. Invariante `revision >= published_revision`. Versioni con numeri della bozza (monotoni: il ripristino del menu intero ordina per revisione).
- **Senza bozza pendente = percorso di prima** (due `mutateWorkspace`), così i test del bot che simulano lo store restano validi.
- Disponibilità dal vivo (cucina/cassa) replicata da `mutateWorkspace(publish)` sul pubblicato e sulla bozza (solo dove la bozza non l'ha cambiata).
- PROVA: con bozza pendente si salva la bozza (con la modifica del bot) e si lancia `WorkspaceTrialLocked`, come prima.
- **K2**: `TAKO_BOT_DRAFT_LEGACY=1` → vista = riga vera, il bot torna a rifiutare con `dashboardPending` (nessun deploy di codice per tornare indietro, basta il segreto).

## Deviazioni
- `tests/day-presets/day-presets.test.ts` «bozza non pubblicata alle 06:00»: il test vecchio verificava che la bozza su un ALTRO Menu andasse persa (comportamento cambiato per decisione D5). Spostato sul Menu del preset (stessa versione + avviso); il caso «altro Menu intatto» è lo scenario 9 del test nuovo.
- `qa-live-bozza.mjs` importa `../bot-haiku-2026-10-21/qa-read.mjs`, che in questo worktree non c'è (sta nel worktree del bot): va copiato prima di eseguirlo. Il ripristino usa PUT del documento iniziale + Pubblica (vie API, mai SQL).

## Rischi aperti
- Bozze con riordini profondi + spostamenti del bot fra Menu: la posizione nella bozza è «dopo il fratello precedente presente», non sempre quella del pubblicato.
- Il preset che riusa un id che la bozza aveva spostato in un altro Menu: il piatto viene tolto dall'altro Menu della bozza (registrato; la bozza di prima resta come versione solo se il Menu del preset era cambiato).
- Rotta: con bozza pendente un messaggio fa una lettura in più del workspace (`readWorkspace` dentro `applyBotChange`).
- Batteria dal vivo non eseguita (serve il deploy).
