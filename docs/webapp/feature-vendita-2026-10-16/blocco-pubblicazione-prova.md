# Blocco pubblicazione dei menu PROVA (16/10/2026, edge v93)

Un locale PROVA della campagna lead (`restaurants.settings.takomenuTrial = true`, creato da `scripts/provision-lead-trials.mts`) ha un menu di prova privato, visibile solo da `/trial-menu/<token>`. Non deve mai andare sul menu pubblico.

## Dove sta il blocco
`mutateWorkspace(..., publish=true)` in `apps/server/src/lib/menu-workspace-store.ts`: dentro la transazione, subito dopo il lock della riga, `isTrialRestaurant` legge il flag e lancia `WorkspaceTrialLocked`. Ogni pubblicazione passa da lì:
- dashboard `POST /api/menu-workspace/publish` → **403** `{error:{code:'TRIAL_MENU_PRIVATE', message}}`;
- preset (pubblicazione a mano `routes/menu-day-presets.ts` → 403 uguale; automatica del tick → la corsa resta `error` con il messaggio, nessuna pubblicazione);
- WhatsApp (comandi diretti, conferme, job AI, menu intero) → il bot risponde col messaggio del blocco; per un PROVA senza menu pubblicato il bot già rispondeva «menu non pubblicato» prima di arrivare qui;
- onboarding, traduzioni automatiche (pubblicano solo se il menu era già pubblicato e allineato), script che chiamano `mutateWorkspace`.

Messaggio: «Questo è un menu di prova privato: non si può pubblicare sul menu pubblico finché il locale non diventa cliente. Le modifiche restano salvate in bozza.»
Il blocco viene prima del controllo di revisione. Salvataggio bozza, versioni e ripristini (`publish=false`) restano consentiti.

## Sblocco quando il lead diventa cliente
La campagna oggi **non** segna la conversione sul locale: lo stato `customer` del contatto (`tako_agency_leads.status`, CRM) non tocca `restaurants.settings`. Il blocco quindi segue solo il flag. Per sbloccare (dopo l'accettazione):
```sql
UPDATE restaurants SET settings = settings || '{"takomenuTrial": false}'::jsonb WHERE id = '<restaurant_id>';
```
(oppure togliere la chiave). Da quel momento «Pubblica modifiche» funziona; la dashboard smette di mostrare «Menu di prova privato» perché legge lo stesso flag (`isTrial`). Da valutare: farlo in automatico quando il contatto passa a `customer`.

## Deploy
- Base verificata: v92 `07d5a4f9…` (check-active due volte, l'ultima subito prima del deploy).
- Bundle = v92 + 4 sezioni: `lib/menu-workspace-store.ts`, `routes/menu-workspace.ts`, `routes/menu-day-presets.ts`, `routes/twilio-menu.ts` (diff per sezione: 137 sezioni, stesso ordine, nessun'altra differenza; 18 righe di diff). Read-edge non toccata.
- Online: **v93** `9b653409…` (primo tentativo: 500 interno di Supabase, nessuna versione creata; secondo PASS).
- Copia: `~/.config/tako-webapp/rollback-edge-20261016/candidate-index-v93-trial-block.ts`.
- Rollback a v92: `cp ~/.config/tako-webapp/rollback-edge-20261016/candidate-index-v92-tick-fix.ts release/serverless/candidate/index.ts && node scripts/translations/deploy-projection.mjs`

## Verifica
- Test: `tests/trial-publish-block.test.ts` (Postgres locale: blocco senza cambiare righe, bozza salvata, sequenza bozza→pubblica di WhatsApp/preset fermata, locale normale pubblica, sblocco col flag a false; mappatura 403/messaggio nelle tre strade). `tests/menu-workspace-batch-publication.test.ts` aggiornato con la tabella `restaurants`.
- Live (`blocco-prova/verify-trial-block.mjs`, sessione agenzia propria con logout): sul primo PROVA della lista agenzia publish con revisione sbagliata → 403 `TRIAL_MENU_PRIVATE` (sicuro anche senza blocco), poi con revisione corrente → 403; revisione 1 / pubblicata `null` identiche prima e dopo.
- Non regressione su v93: `verify-live.mjs --rounds=1 --types=price` sul QA → pubblicazione e live ok, QA ripristinato per hash (`verifica-live/post-v93-*`).
