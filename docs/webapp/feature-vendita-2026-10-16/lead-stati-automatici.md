# Stati del lead con effetto sul locale PROVA (16/10/2026, edge v96 + takomenu-web 6a70b5ef)

Tutto lato server, nella stessa transazione del cambio di stato (`PATCH /api/agency/leads/:id`, `apps/server/src/lib/agency-leads.ts`).

## «Prova attiva» (`trial`)
- Se il lead ha un locale collegato con `takomenuTrial=true`, diventa pubblicabile: `settings.takomenuTrial=false`, `trialActivatedAt`, `trialActivatedBy`.
- Il link `/trial-menu/<token>` continua a funzionare: l'anteprima accetta `takomenuTrial=true` **oppure** `trialLeadId` uguale al lead (sempre e solo con locale attivo).
- **Se lo stato torna indietro non si riblocca.** Il locale resta pubblicabile e nel CRM viene aggiunta una nota automatica: «Il lead non è più in «Prova attiva», ma il locale resta pubblicabile: il blocco della prova non si riattiva da solo.» Per ribloccare a mano: `UPDATE restaurants SET settings=settings||'{"takomenuTrial":true}'::jsonb WHERE id='<id>'` (blocca le pubblicazioni future; ciò che è già online resta online).

## «Rifiutato» (`not_interested`, prima etichettato «Non interessato»)
Si usa lo stato esistente, che nella dashboard ora si chiama «Rifiutato». Se il lead ha un locale collegato, prima di salvare la scheda mostra nella pagina il riquadro «Rimuovere <locale> da Takomenu?» con «Rimuovi» (rosso) e «Annulla» (con il focus). Senza conferma non parte nessuna richiesta. «Rimuovi» invia `status:'not_interested'` più `removeTrial:true`. Il server, nella stessa transazione:
- rimuove solo un **PROVA**: locale con `trialLeadId` uguale a questo lead, lead non in stato «Cliente», e `takomenuTrial=true` oppure sbloccato soltanto dall'automatismo «Prova attiva» (`trialActivatedAt`). Altrimenti risponde 409 `NOT_TRIAL` («Questo locale non è un menu di prova: non si può rimuovere da qui.») e non scrive nulla;
- `restaurants.active=false` più `takomenuRemoved`, `takomenuRemovedAt`, `takomenuRemovedBy`, `takomenuRemovedLeadId` e `takomenuRemovedPreviousActive` in `settings`;
- cancella le righe `web_session_locations` che puntano a quel locale (altrimenti la sessione dell'agenzia posizionata lì riceverebbe «Accesso al locale revocato»).

Effetti: sparisce da `/api/agency/restaurants` (lista Locali e filtri Prova/30gg), da `/web-locations/switch` (404) e dal link di prova (404). Nessuna pubblicazione è possibile: il locale è inattivo e, se ancora PROVA, bloccato dalla v93. Menu, bozza, versioni e piatti restano nel DB. Il lead resta nel CRM con stato «Rifiutato».
«Rifiutato» senza conferma (vecchi client o API senza `removeTrial`) cambia solo lo stato.

Deviazione dalla richiesta letterale («solo takomenuTrial true»): con quella regola un lead passato da «Prova attiva» e poi rifiutato non si sarebbe potuto rimuovere, e il flusso richiesto (Prova attiva → Rifiutato → Rimuovi) sarebbe fallito. Restano esclusi i clienti veri: lead «Cliente» e locali senza `trialLeadId` di questo lead.

## Ripristinare un locale rimosso per errore
```sql
UPDATE restaurants
SET active = true,
    settings = settings - 'takomenuRemoved' - 'takomenuRemovedAt' - 'takomenuRemovedBy' - 'takomenuRemovedLeadId' - 'takomenuRemovedPreviousActive'
WHERE id = '<restaurant_id>';   -- l'id è in tako_agency_leads.restaurant_id del lead
```
Poi, se serve, si cambia lo stato del lead dalla scheda. Il link di prova torna 200 con lo stesso token. Se il locale era ancora PROVA (`takomenuTrial=true`) resta privato e non pubblicabile.

## Limiti noti
- Dopo la rimozione il selettore del locale nella barra laterale può mostrare il locale rimosso fino al ricaricamento della pagina; le richieste successive usano già il locale proprio della sessione.
- Nella scheda di un lead rifiutato restano i link «Apri Takomenu» e «Modifica menu», che ora rispondono «Locale non trovato».
- Il tag «PROVA» nella riga del lead dipende dal collegamento al locale, non dallo stato di prova.

## Deploy
| Componente | Prima | Dopo |
|---|---|---|
| Edge operativa | v93 (`9b653409…`) | v94 → v95 → **v96** (`2dbbbc4f…`): v93 + sezioni `lib/agency-leads.ts`, `routes/agency-leads.ts` |
| takomenu-web | b4c81225 | 8585d634 → **6a70b5ef** (solo `staff/`: `app.js`, `app.<hash>.js`, `index.html`, `src/agency-leads.css`) |

- Edge: check-active esplicito prima di ogni passo (93 → 94 → 95). v94 = prima versione; v95 = regola PROVA rimovibile anche dopo «Prova attiva»; v96 = pulizia di `web_session_locations`. Ogni bundle è il precedente più solo le due sezioni lead; il diff per sezione è verificato.
- Web: base = build di `599c889`; tutti i 290 file `staff/` erano identici al live b4c81225. I file non-staff sono stati presi dal live (crawl da `index.html`), per non cambiare `/takomenu-app/`. Dopo il deploy, `staff/` live coincide con la build, salvo il delta. Wrangler ha caricato solo i file del delta (3 + 1).
- Rollback edge (a v93): `cp ~/.config/tako-webapp/rollback-edge-20261016/candidate-index-v93-trial-block.ts release/serverless/candidate/index.ts && node scripts/translations/deploy-projection.mjs`
- Rollback web: `npx wrangler rollback b4c81225-16be-46be-a056-aa4b532b93bd --config deploy/cloudflare/wrangler.jsonc`
- Read-edge non toccata: la lista agenzia filtra già `r.active=true`.

## Verifica
- Test: `tests/agency-lead-status-automation.test.ts` (Postgres locale: Prova attiva sblocca e lascia il link, ritorno indietro con nota, Rifiutato più rimozione su PROVA, sessioni ripulite, link 404, ripristino, rifiuto per lead Cliente, locale di un altro lead, cliente senza flag, lead senza locale; schema), `tests/agency-leads.test.ts` invariato e verde.
- Live (`lead-stati/verify-lead-status.mjs`, 16/16): lead e locale di test «ZZ Test rimozione» (ZZTEST1) creati con la stessa forma dello script di campagna. Lo script `provision-lead-trials.mts` è fisso su TK001–TK010 con fonti su file, quindi il fixture è inserito via SQL owner. Flusso: PROVA con publish 403 → Prova attiva (`takomenuTrial=false`, publish 200, link 200) → dashboard headless: Rifiutato → riquadro (titolo, Rimuovi `rgb(180,35,24)`, Annulla, nessun `confirm()`, nulla salvato prima) → Rimuovi → lead Rifiutato, locale inattivo con menu conservato, link 404, sparito dalla lista, switch 404, console pulita. Poi lead e locale cancellati del tutto. Controllo finale DB: 50 PROVA attivi e bloccati, 0 toccati, 50 lead.
