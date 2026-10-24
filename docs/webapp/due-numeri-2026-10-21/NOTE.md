# Due numeri WhatsApp del titolare + pannello rifatto — note (21/10/2026)

Ramo `feat/due-numeri-whatsapp` (worktree `Tako-due-numeri`), base `37e57a8` = sorgente della v129 online sul QA.
Richieste di Manuel: (A) massimo due numeri per locale nel pannello «WhatsApp del titolare»; (B) pannello da rifare (troppo testo, disallineato).

## Cosa cambia per il titolare / per chi gestisce il locale
- Nel pannello si possono avere **fino a due numeri**, ognuno con la **sua email** e il suo account della dashboard (stessi poteri sul menu).
- Per ciascun numero il flusso è quello di prima: salva numero+email → al primo messaggio benvenuto, credenziali e link del menu.
- «ok», «annulla», proposte in sospeso e cronologia valgono per il numero che scrive: l'«ok» del secondo non conferma la proposta del primo.
- Scollega e Modifica agiscono su **un solo numero**; l'altro resta collegato.
- Un numero non può stare su due locali (resta lo «sposta» con conferma). Il terzo numero è rifiutato dal server.

## Deviazioni e scelte (opzione conservativa)
1. **Sospesi/annulla/cronologia erano già per telefono** (`tako_whatsapp_proposals.phone` PK, `undo:`/`last:`/`ai:`<telefono>, cronologia del cervello per locale+telefono): nessuna modifica al bot, solo test che lo dimostrano.
2. **Migrazione indispensabile**: sul DB c'è `tako_whatsapp_links_one_per_restaurant` (indice UNICO su `restaurant_id`). File `scripts/serverless/whatsapp-owner-two-numbers.sql`: `DROP INDEX IF EXISTS` + indice semplice su `restaurant_id`. Additiva nel senso che non tocca dati né colonne; retro-compatibile con l'edge v129 (che cancella sempre gli altri numeri del locale prima di inserire). Applicata **solo** su Postgres usa e getta nel test; **NON** sul DB remoto.
3. Se il server nuovo gira senza migrazione: il secondo numero risponde 409 `SECOND_NUMBER_UNAVAILABLE` («non ancora attivo su questo server»), il primo resta. Testato su Postgres vero.
4. Il limite di due è verificato dal server sotto lock per locale (`tako-owner-link:<locale>`), non con un vincolo DB (trigger evitato: più rischio a parità di effetto). Ordine dei lock invariato (telefono → locale), uguale al «collega tako».
5. POST ora **aggiunge** invece di sostituire. «Modifica» con numero diverso manda `replace:<numero vecchio>` e sostituisce solo quella riga (`replacedPhones` resta nella risposta).
6. Email: una per numero. Rifiutata (409 `EMAIL_OTHER_NUMBER`) se è l'email dell'altro numero o dell'account già agganciato all'altro numero (collegamenti senza email di prima del 19/10). Le regole di prima restano (email di altro account/locale/agenzia → `EMAIL_IN_USE`; email bloccata a collegamento attivo → `EMAIL_LOCKED`).
7. DELETE `?phone=` scollega un numero (proposte di quel numero cancellate). Senza parametro funziona solo se il locale ha un numero (pannelli vecchi aperti); con due → 400. I codici «collega tako» del locale si cancellano solo quando si scollega l'ultimo numero.
8. GET restituisce `numbers[]` (in ordine di aggiunta) e `max:2`; tenuti anche i campi singoli di prima (numero più recente) per eventuali pannelli vecchi ancora aperti.
9. «collega tako <codice>» (flusso vecchio, ancora mostrato in Gestione): prima sostituiva tutti i numeri del locale, ora aggiunge fino a due; al terzo risponde `copy.pairLimit` (il codice è consumato).
10. Restano a un numero per locale (non toccati, fuori perimetro): invito agenzia «attiva takomenu …» (`onboarding-owner-invite.ts`) e claim dell'onboarding (`routes/onboarding.ts`): rifiutano se il locale ha già un collegamento. Riguardano solo locali nuovi.
11. Scollegare un numero non disattiva il suo account della dashboard (come prima del 21/10).
12. Errori del server con `field` (`phone`/`email`) → il pannello li mette sotto il campo giusto; `TakoAPI` espone `e.field` (aggiunta di una proprietà, nessun altro effetto).
13. Pannello: niente `window.confirm` (la dashboard non ha un dialogo di conferma condiviso; `MenuDayPresetConfirm` è dei preset): conferma «Scollegare? Scollega / Annulla» dentro la riga, focus su Annulla.
14. **Screenshot**: la dashboard completa in locale richiede Supabase (`pnpm webapp` usa il DB operativo remoto) o il bootstrap completo dello schema: non avviata. Usato lo stesso metodo di `scripts/verify-agency-dashboard.mjs`: componenti **veri** della dashboard (kit, PageHead, ScreenScroll, pannello, CSS reali) compilati con esbuild, API finta in memoria che imita il server, Chrome headless (nessuna finestra). Script: `scripts/verify-owner-whatsapp-panel.mjs`. Il server vero è provato a parte (test unitari + Postgres vero).
15. Mobile a 375 px con `page.setViewport` (emulazione dispositivo, non `--window-size`: il limite dei 500 px di Chrome headless riguarda la finestra, non l'emulazione); controllato che non ci sia scroll orizzontale in ogni stato.
16. node_modules della worktree: cartelle di symlink verso `../Tako` (mai `pnpm install`), con `@tako/db`/`@tako/types` puntati alla worktree (con il symlink intero di `apps/server/node_modules` i test caricavano `packages/db` del repo principale) e `bcryptjs/fastify/drizzle-orm/zod` in radice come nella nota 7 di bot-haiku.
17. La dashboard online (`app.3129c062f504.js`) coincide col build di `37e57a8`: il deploy della dashboard da questo ramo cambia solo il pannello (verificato ricompilando i sorgenti di più commit).

18. La suite ha riscritto i rapporti delle batterie in `docs/webapp/bot-correzioni-2026-10-17/batterie/` (file tracciati, l'ultima rigenerazione era R10): lasciati **non committati**. Totali identici a quelli della base `37e57a8` rigirata in una worktree temporanea (A 95,6%, B 83,1%): nessun effetto del ramo sul bot.

## Verifiche (21/10)
| Verifica | Esito |
|---|---|
| `pnpm exec tsc --noEmit -p apps/server` | pulito |
| `tests/twilio-owner-link.test.ts` | 27 verdi + i 7 rossi della baseline (numeri anonimizzati); 6 casi nuovi: limite 2, email per numero, benvenuto/credenziali al secondo numero, sospesi e annulla per numero, scollega uno lascia l'altro, Modifica, DB senza migrazione |
| `tests/parity/whatsapp-owner-two-numbers.integration.test.ts` (Postgres vero usa e getta, SQL serverless reali + migrazione) | 3/3 |
| Suite completa (3448 test) | nessun rosso nuovo rispetto a `BASELINE-SUITE-ROSSI.txt` (1 rosso nuovo trovato e corretto: il DB finto di `twilio-menu-ai-flow` non conosceva la query del «collega tako»); 8 rossi della baseline oggi verdi |
| Build dashboard (`scripts/build-staff-web.mjs`) | PASS |
| Edge: `build-operational-candidate.mjs` / `verify-candidate-lazy-boot.mjs` | PASS / passed:true |
| `bundle-sections-diff.mjs` contro la v129 online (`~/.config/tako-webapp/rollback-edge-20261021/candidate-index-haiku.ts`) | onlyOnline=[], onlyLocal=[], cambiano solo `routes/twilio-menu.ts` e `twilio-menu-copy.ts` (+ `edge-image-initializer.ts` solo per il percorso temporaneo nel commento) |
| QA visivo `scripts/verify-owner-whatsapp-panel.mjs` | 16 screenshot (1280 e 375), nessuno scroll orizzontale, nessun errore browser, tastiera (Esc, focus restituito), conferma scollega |

## Deploy (lo autorizza Manuel dopo gli screenshot) — ORDINE OBBLIGATORIO
Il pannello nuovo con il server vecchio è pericoloso (il server vecchio non conosce `numbers[]`, `replace`, `?phone`: aggiungere un numero **sostituirebbe** il primo, Scollega li toglierebbe tutti). Quindi: migrazione → edge → dashboard.

1. **Migrazione** (DB `tcfccmvpycivxuxkoqpw`): eseguire `scripts/serverless/whatsapp-owner-two-numbers.sql` (SQL editor Supabase o Management API come in `bot-haiku-2026-10-21/DEPLOY-QA.md`). Verifica: `select indexname from pg_indexes where tablename='tako_whatsapp_links'` → niente `tako_whatsapp_links_one_per_restaurant`, c'è `tako_whatsapp_links_restaurant`. Rischio per i clienti online: nessuno (la v129 continua a tenere un numero per locale).
2. **Edge** (procedura `DEPLOY-QA.md` §b–c, da questa worktree con `.env.web` symlink):
   `node scripts/serverless/check-active.mjs 129 <ezbr v129>` (ok:true) → `taskpolicy -b node scripts/serverless/build-operational-candidate.mjs` → `verify-candidate-lazy-boot.mjs` → `bundle-sections-diff.mjs ~/.config/tako-webapp/rollback-edge-20261021/candidate-index-haiku.ts` (atteso come sopra) → copia di rollback di `release/serverless/candidate/index.ts` → `node scripts/translations/deploy-projection.mjs` → `check-active.mjs --local` (versione 130).
   Rischio: tocca il webhook WhatsApp di tutti i locali (route `twilio-menu.ts`); il bot non cambia, cambia solo «collega tako» (aggiunge invece di sostituire). Rollback: ridistribuire `candidate-index-haiku.ts` (v129).
3. **Dashboard** (worker `takomenu-web`): `node scripts/build-cloudflare-web.mjs` → `npx wrangler deploy --config deploy/cloudflare/wrangler.jsonc`. La dashboard online (`app.3129c062f504.js`) è il build di `37e57a8`: cambia solo il pannello WhatsApp. Rollback: ridistribuire il build di `37e57a8`.
4. Prova sul QA (`26050ecd…`, mai Victoria): aggiungere un secondo numero di prova, primo messaggio → benvenuto + credenziali; «ok» dal secondo con proposta del primo aperta → non conferma; Scollega del secondo → il primo resta.
