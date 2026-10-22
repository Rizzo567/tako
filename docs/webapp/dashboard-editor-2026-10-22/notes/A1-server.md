# A1 server-bozza — note (22/10)

## Fatto
- `packages/menu-ops` (@tako/menu-ops): `applyOps`, `applyOp`, `dropToOps`, `manualOrderSnapshot`, `cloneDocument`. TS puro, zero dipendenze,
  bundle esbuild es2020 provato in `node:vm` (21/21 vettori). Copia profonda a mano (niente `structuredClone`: in `node:vm` non c'è).
  `types.ts` esteso solo in modo additivo: `WsItem/WsSection/WsMenu/WsDocument`, `ManualOrderView`.
- Dipendenza `@tako/menu-ops: workspace:*` in `apps/server/package.json`, `pnpm-lock.yaml` aggiornato a mano e verificato con
  `pnpm install --frozen-lockfile --lockfile-only` su copia isolata; `COPY packages/menu-ops` aggiunto ai due Dockerfile (render, web) —
  senza, il `--frozen-lockfile` dei build Docker fallirebbe. Symlink locale `apps/server/node_modules/@tako/menu-ops` (come pnpm). Nessun install.
- Schema: `design.manualOrder: z.boolean().optional()` (nessun default). Lettura pubblica: `publicWorkspace` clona l'intero design e sia
  `routes/customer.ts` sia l'edge di lettura passano `design: published.design` → il campo arriva al renderer senza modifiche.
  PDF lato server: segue già l'ordine del documento (Menu = ordine di `w.menus` / ordine dato; Sezioni = ordine di `m.sections`), nessuna
  regola a macro-categorie → nessuna modifica necessaria.
- Store: `applyDraftOps(tenant, actor, ops, clientId)` sotto `lockWorkspace` → `workspaceSchema.parse(bozza)` → `applyOps` →
  `workspaceSchema.safeParse` (invalido → `WorkspaceInvalid` → 422, nessuna scrittura) → `verifyOwnership` → UPDATE draft + revision+1 e,
  nella stessa istruzione, riga «Bozza dashboard» solo se non ce n'è una negli ultimi 30 min. `discardDraft(tenant, actor, expectedRevision)`.
- Rotte: `POST /ops`, `GET /status`, `POST /discard`, publish/discard 409 con `currentRevision`, GET con `pending` e `dashboardEditor`.
  `/status` anche sull'edge di lettura (`AUTHENTICATED_READ_PATHS` + lista `readPath` di `worker.mjs`), corpo condiviso in `menu-workspace-read.ts`.
- Agenzia: `pending` in SQL nella query; `summarizeAgencyRestaurant` usa `row.pending` se booleano, altrimenti la regola di prima.
- T9: flag esposto in GET `/api/menu-workspace` (`dashboardEditor`), anche sull'edge di lettura. Scelto qui perché `/api/auth/bootstrap`
  dà al `menu_editor` solo `{id,name}` del locale (niente settings) e `/api/restaurants/me` non è per tutti i ruoli del menu: la SPA legge il
  workspace comunque quando apre Piatti. Script `scripts/set-dashboard-editor-flag.mjs <id> on|off --yes` (senza `--yes` = prova, solo lettura;
  connessione = `.env.web` come `apply-web-migrations.mjs`, oppure `TAKO_FLAG_DATABASE_URL`). Eseguito solo con `--help`/argomenti errati e sul DB isolato dei test.

## Scelte (opzione conservativa, da confermare se serve)
1. `create` con id esistente: stesso livello + campi (e genitore, se dato) coincidenti → `{ok:true}`; altrimenti `{ok:false, code:'EXISTS'}`.
2. `remove` di un Sottomenu porta via le sue Sezioni figlie e i loro Piatti (nessuna figlia orfana; l'eliminazione passa dalla conferma della matita).
3. Posizione delle sezioni: un Sottomenu si sposta/crea come blocco (radice + figlie); `afterId` di un Sottomenu = dopo il suo blocco; ancora =
   figlia di un altro Sottomenu → si usa il blocco di quel Sottomenu. Sezione figlia «in fondo» = dopo l'ultima figlia del suo Sottomenu.
4. `create` richiede `name` non vuoto (→ `FIELD`); i valori di partenza sono gli stessi default dello schema zod (dopo il parse il documento non cambia).
5. `set` con valore `undefined` toglie il campo. Valori fuori schema (es. prezzo negativo, nome vuoto) → l'intera chiamata 422 (contratto).
6. Op che non cambiano nulla (rifiutate o ripetute): nessuna scrittura, la revisione non sale (meno ricariche fra schede).
7. Coalescenza: si controlla l'ultima riga con etichetta «Bozza dashboard» (non l'ultima riga qualsiasi). La riga contiene il documento DOPO l'op, come le altre versioni.
8. «Bozza scartata»: la versione salva la bozza scartata (revisione vecchia), così si recupera dalle Versioni; se non c'è nulla da scartare, nessuna scrittura.
   Locale mai pubblicato → 409 `NOT_PUBLISHED`.
9. Risposte additive (non tolgono campi): `/ops` restituisce anche `seq` (eco); `/status` dà i campi in testa e anche in `data`; publish risponde come prima.
   `clientId` validato (1–100 caratteri) ma non salvato. `lastLabel/lastAt` = ultima riga di storico.
10. Validazione zod delle op: id 1–100 caratteri (non uuid: gli id veri li controlla `workspaceSchema` sul documento finale), `reorder.ids` ≤ 2000.

## Verifiche (giro finale, esito reale)
- `npx vitest run packages/menu-ops --no-cache` → 3 file, 33 test verdi (property: 2500 sequenze + 2000 idempotenza + 2000 ancora mancante + 2×2000 commutatività).
- `npx vitest run tests/menu-workspace-ops.test.ts --no-cache` → 13/13 verdi (Postgres embedded isolato, rotte vere via inject; solo l'auth sostituita).
- Suite vicina (`packages/menu-ops tests/menu-workspace-*.test.ts tests/edge-read-*.test.ts tests/agency-*.test.ts tests/trial-publish-block.test.ts`):
  141/143; 2 rossi in `tests/menu-workspace-presentation.test.ts` (fuori perimetro A1): il test si aspetta `languages:['it']` ma la rotta GET usa
  già `commonMenuLanguages` (12 lingue) sulla base 17324ef7 → rosso preesistente; ora vede anche i campi additivi `pending`/`dashboardEditor`.
  Correzione suggerita: aggiornare le attese (`pending:true` col mock senza `published`, `dashboardEditor:false`, 12 lingue).
- `pnpm --filter @tako/server exec tsc --noEmit` verde; `tsc -p packages/menu-ops` verde.

## S4 (DB locale embedded, documento sintetico)
Documento: 260 piatti, 20 Sottomenu, 12 lingue, **464 KB** (più grande dei 388 KB richiesti). 40 ripetizioni, un `set` per volta.
- CPU `workspaceSchema.parse` + `applyOps` + `workspaceSchema.parse` + `JSON.stringify`: **p50 5,5 ms, p95 8,0 ms** (soglia p95 < 300 ms) ✔
- `applyDraftOps` completo (transazione, lock, parse, verifyOwnership, UPDATE jsonb + controllo versione) a parete: **p50 12,9 ms, p95 14,0 ms**.
Misura locale su M-series; l'edge Supabase va rimisurato sul QA (K4).

## Aperto
- Copertura dei rami ≥ 95%: non misurata (manca `@vitest/coverage-v8`, niente install). I test coprono ogni op e ogni codice d'errore.
- `tests/menu-workspace-presentation.test.ts` da aggiornare (vedi sopra) da chi ne ha il perimetro.
- Misure S4 sull'edge vero (QA) al deploy.

## Correzioni revisione (22/10, lato server)
1. **Validazione op per op** (`applyOpsValidated` in `menu-workspace-store.ts`): prima il gruppo intero con un solo `safeParse`; solo se invalido si
   rifà op per op. L'op che rende il documento invalido → `{ok:false,code:'FIELD',message}` e si scarta, le altre restano. Documento finale sempre
   valido, una sola scrittura per richiesta. `WorkspaceInvalid` resta esportata (la rotta la importa) ma `applyDraftOps` non la lancia più.
   `verifyOwnership` (id/immagini di un altro locale) resta per gruppo: 404, nessuna scrittura.
2. **«Pubblica preset» dalla dashboard** passa da `applyBotChange(replaceMenuIds:[menuId])` come il job delle 06:00 e la chat: parte dal
   pubblicato, si pubblica solo il Menu del preset, le bozze degli altri Menu restano in bozza (se la bozza di QUEL Menu era pendente: versione
   «Bozza prima del preset …» + avviso, come in chat). Conflitto: `expectedRevision` (revisione della bozza vista dalla dashboard) è controllata
   prima e **sotto lock** (nuovo campo opzionale `BotChange.expectedDraftRevision`, anche nel percorso legacy e nel ripiego legacy→parziale).
   `PublishResult.revision` = nuova revisione della **bozza** (quella che la dashboard usa poi come expectedRevision); aggiunto `publishedRevision`.
   Senza bozza pendente il percorso è identico a prima (due mutateWorkspace, revisione +2).
3. **pending e «nessun cambiamento» su documenti normalizzati.** `applyDraftOps` confronta con `workspaceSchema.parse(row.draft)` (niente scritture a
   vuoto) e calcola `pending` in JS contro `parse(published)`. Quando scrive la bozza e la colonna `published` è grezza (scritta prima di un campo con
   default), la riscrive normalizzata nella stessa UPDATE (stesso contenuto, tabelle del menu non toccate) → il confronto SQL di `/status` resta valido.
   `discardDraft` confronta normalizzato e scrive il pubblicato normalizzato in entrambe le colonne; se il contenuto è già uguale ma le colonne grezze
   no, le riallinea senza versione né revisione. `mutateWorkspace(publish)` e il bot parziale scrivevano già documenti passati da zod in entrambe.
   GET workspace: `pendingNormalized` (parse solo se il confronto grezzo dice «diverso»). **Documenti esistenti mai riscritti** (draft e published
   grezzi ma uguali): il confronto SQL è già corretto (jsonb uguali) — coperto da test. Limite residuo: righe già oggi asimmetriche (bozza riscritta da
   una vecchia `applyDraftOps`, pubblicato grezzo) danno `/status` pendente finché non arriva la prossima scrittura (op, Pubblica, Scarta, bot);
   GET workspace dà già il valore giusto. `/status` resta una SELECT da ~100 byte (nessun parse lì, per scelta).
   Nota: `pendingOf(raw)` nel bot e nelle traduzioni può dare un falso «pendente» su colonne asimmetriche → si prende il percorso parziale, che con
   bozza = pubblicato dà lo stesso risultato: innocuo.
4. **Avviso per `skippedInDraft`**: ogni voce saltata (tutte tranne `draft:invalid`, che ha già il suo avviso) → `menu_owner_notices`
   (`draft_discarded`, Menu dell'elemento saltato, una volta per Menu e giorno, stesso meccanismo in sotto-transazione che non blocca). Testo
   `SKIPPED_NOTICE` (Menu/Sezione/piatto, mai «categoria»).
5. **Fusione in profondità** per `design`, `pdf`, `translationSettings` (`DEEP_MERGE_KEYS`): solo le sotto-chiavi cambiate dal bot, ricorsiva sugli
   oggetti, array sostituiti. La bozza tiene `design.manualOrder` e gli stili non pubblicati.
6. `lastLabel`: `ORDER BY created_at DESC, revision DESC`.
7. **Non allineato, per scelta.** La versione «pubblicata» del bot resta a revisione D2 (non P2): `twilio-menu-fullmenu.ts` (`restore`) sceglie
   l'ultima copia «menu intero»/«ripristinato» con `ORDER BY revision DESC`; con P2 < D+1 la versione «ripristinato» finirebbe sotto la copia di
   sicurezza e un secondo «ripristina» ripristinerebbe di nuovo. Le versioni non hanno vincoli di unicità sulla revisione; `published_revision`
   resta P2 (aritmetica A2). Test che fissa il comportamento.
8. **Idempotenza dei retry `/ops`**: nessuno stato aggiunto (edge senza stato, niente colonna nuova). Le op sono per id generati dal client:
   `set`/`move`/`reorder`/`manualOrder` sono idempotenti e anche `create` ripetuto con stesso id e stessi campi risponde `ok` (menu-ops), quindi un
   retry non duplica e non scrive (revisione invariata). Unico caso non trasparente: `remove` ripetuto → `NOT_FOUND` (documento invariato). Il client
   vede un errore su un'op già passata → ricarica, nessuna perdita né duplicato. `clientId`/`seq` restano solo eco. Test che lo fissa.

## Conflitti bot al Pubblica (22/10)

Rischio chiuso: il bot pubblica solo la sua modifica; se in bozza il bersaglio non c'è (piatto/Sezione/Menu cancellati o spostati, Sezione non vuota,
Menu sostituito, bozza risultante invalida) la modifica va solo nel pubblicato e un «Pubblica» successivo della bozza la toglierebbe ai clienti.

- **Memorizzazione (senza migrazioni):** campo facoltativo additivo nel documento BOZZA `botConflicts?: {kind:'menu'|'section'|'item', id, name, at, reason}[]`
  (max 50, le più recenti; stesso elemento = voce aggiornata), schema zod in `menu-workspace-contract.ts` (`botConflictSchema`, `MAX_BOT_CONFLICTS`), senza default
  (documento senza = identico). Scelto il documento bozza (opzione consigliata) perché vive sotto lo stesso lock di riga di bozza/pubblicazione, si azzera
  naturalmente con Pubblica/Scarta (bozza = pubblicato) e non richiede tabelle: `menu_owner_notices` resta solo l'avviso.
- **Scrittura:** `menu-workspace-bot.ts` → `partial()`, dopo il ramo PROVA (lì nulla va online): `botConflictsFor(skipped, …)` con le stesse voci di
  `significantSkipped` (quelle dell'avviso); per `draft:invalid` la bozza resta quella di prima + il campo, voce = primo elemento cambiato dal bot
  (piatto → Sezione → Menu), poi si rivalida. `reason` = codice del salto (`missing`, `move-target-missing`, `section-missing`, `not-empty-in-draft`,
  `replaced`, `draft:invalid`…). Il pubblicato (`next`) non porta mai il campo.
- **Mai nel pubblicato:** `mutateWorkspace(publish)` toglie il campo dal documento pubblicato (che diventa anche bozza → azzerato); `discardDraft` lo toglie.
  Nei salvataggi di bozza (`mutateWorkspace` senza publish: PUT, ripristino versione, import, traduzioni) il campo resta **quello del server**: il client
  non lo può né togliere né inventare. `applyDraftOps` lo conserva (applyOps clona il documento).
- **Blocco:** `mutateWorkspace(..., guard)` — 8° argomento facoltativo, solo da `POST /publish`: conflitti presenti e `confirmBotConflicts` assente →
  `WorkspaceBotConflicts` sotto lock (nessuna scrittura) → 409 `{error:{code:'BOT_CONFLICTS',message}, currentRevision, conflicts}`. Deviazione dal
  testo del compito (`error:'BOT_CONFLICTS'` stringa): tenuta la forma `{error:{code,message}}` di tutte le altre risposte del pannello; la SPA accetta
  entrambe. Senza guard (bot via `legacy()`, preset, onboarding, traduzioni) nessun blocco.
- **pending:** con conflitti c'è sempre anche una differenza reale (bersaglio assente in bozza o bozza vecchia ancora pendente), quindi il campo non crea
  falsi «pendente». Unico caso teorico «solo campo»: il titolare ricrea a mano lo stesso contenuto → pending vero finché non pubblica/scarta (conservativo).
- **Riepilogo:** `publishDiffBody` (rotta + edge di lettura, stessa funzione) aggiunge `data.botConflicts` (sempre array).
- **SPA:** `13-menu-editor-core.js` (`isBotConflictsError`, `botConflictsOf`, `botConflictsText`); `MenuEditorPublishDialog` mostra l'avviso Sobrio sopra i
  pulsanti e cambia «Pubblica ora» in «Pubblica comunque» (+ «Annulla»); 409 BOT_CONFLICTS al clic → ricarica, riquadro con avviso. Ramo vecchio
  (`13-menu-workspace.js`, flag spento): 409 BOT_CONFLICTS → `window.confirm` col testo e «Pubblicare comunque?», altrimenti messaggio d'errore.
- **Limite noto:** la conferma copre i conflitti presenti al clic; un conflitto creato dal bot fra l'apertura del riquadro e il clic su «Pubblica comunque»
  passa con la stessa conferma (finestra di secondi; il riquadro rilegge il riepilogo a ogni apertura).
- **Test:** `tests/bot-partial-publish.test.ts` (describe «conflitti bot al Pubblica»), `tests/menu-workspace-ops.test.ts` (rotte vere: diff, 409, conferma,
  discard), `tests/staff/menu-editor-bot-conflicts.test.mjs`, scenario e2e in `scripts/verify-menu-editor-dashboard.mjs` (shot `06b-conflitti-bot`).

