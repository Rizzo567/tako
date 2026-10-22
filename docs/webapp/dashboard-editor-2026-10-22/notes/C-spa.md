# Note perimetro C — SPA dashboard (T6, T7 lato client, T8, T9 lato client)

## File
- `apps/dashboard/public/staff/src/13-menu-editor-core.js` (nuovo, JS puro): `createQueue` (documento di lavoro + coda op), `createStatusPoller`, `createPdfFeed`, aiuti (`locate`, `changedFields`, `mutateToOps`, `changedIds`).
- `apps/dashboard/public/staff/src/13-menu-item-form.js` (nuovo): `MenuWorkspaceItemForm` (Piatto) e `MenuEditorLevelForm` (Menu/Sottomenu/Sezione), conferma per campo.
- `apps/dashboard/public/staff/src/13-menu-editor.js` (nuovo): adattatore (`applyOps`, `status`, `discard`, `publishStrict`, `renderPublishedPdf`), hook `useMenuEditor`, `MenuEditorStage` (iframe + messaggi §4), pannello matita (pop-over / foglio), riquadro Pubblica, `MenuEditorPdfColumn`.
- `src/menu-editor.css` (nuovo, solo classi `mw-ed-*`).
- `13-menu-workspace.js`: solo rami dietro flag (`editorActive`), più `MW_NORMALIZE` che legge `dashboardEditor` e `MenuWorkspaceCreateSheet` con prop facoltativa `editor` (4 scelte). Senza flag i rami nuovi non si attivano.
- `13-menu-live-sync.js`: opzione `status` + funzione pura `fromStatus` (la vecchia schermata continua a usare `/versions`).
- `scripts/build-staff-web.mjs`: `buildMenuOpsLib()` → `lib/menu-ops.js` (IIFE, globale `window.TakoMenuOps`); `index.html` carica `lib/menu-ops.js` e i tre file nuovi.

## Scelte (opzione conservativa) e deviazioni
1. **Flag**: dal GET `/api/menu-workspace` (`dashboardEditor`, come scritto da A1). Lo leggo in `MW_NORMALIZE` in una variabile globale (`window.__takoMenuEditorFlag`) e non nel documento, così il PUT a documento intero e il confronto «modificato» della vecchia schermata non cambiano. Senza `lib/menu-ops.js` (sorgente servito senza build) l'editor resta spento e si vede la schermata di oggi.
2. **«Estratto da H»**: `MenuWorkspaceItemForm` riusa gli stessi componenti della vecchia scheda ma **non sostituisce** il JSX in linea di H: riscriverlo avrebbe toccato la schermata con flag spento. Due copie della composizione finché il flag non diventa definitivo.
3. **«Avanzate»** = la vecchia schermata intera (lista, selezione multipla, Sostituisci piatti, preset, prezzo fisso, ricerca, foto trascinata, Altre azioni, PDF con impaginazione nella colonna destra). Entrando la coda viene svuotata e la lista rilegge il server; tornando, se nella lista ci sono modifiche non salvate si chiede di scartarle. Il layout resta quello di oggi (colonna destra compresa), non «a tutta larghezza»: è il pannello esistente senza modifiche.
4. **Testata in modo editor**: solo stato + «Pubblica»; «Altre azioni» resta raggiungibile da «Avanzate». PROVA: niente Pubblica, testo «Menu di prova privato» (le op salvano la bozza come prima).
5. **Revisione dopo /ops**: il server non alza la revisione se le op non cambiano nulla; il client considera nostre le risposte +0/+1 e ricarica su ogni altro salto. Caso limite noto: op nostre senza effetto + scrittura altrui nello stesso istante → la scrittura altrui si vede al primo cambio successivo.
6. **Notifica WhatsApp**: quando cambia `publishedRevision` per mano altrui (non durante la propria Pubblica/Scarta) si ricarica, lampeggiano gli elementi cambiati e la pillola usa `TakoMenuLive.message(lastLabel, …)` («Aggiornato da WhatsApp: X» se l'etichetta inizia con WhatsApp, altrimenti «Menu aggiornato»).
7. **Ruoli**: modifica per owner, manager, menu_editor e agenzia (`MW_ED_CAN_EDIT`); il cameriere non arriva alla voce Menu (navigazione invariata).
8. **PDF a destra**: Menu selezionato, `preview:false`, rigenerato su `publishedRevision` (800 ms, annullo della richiesta precedente, cache 6 revisioni). Menu mai pubblicato → testo «comparirà dopo Pubblica»; PDF fisso di Victoria: lo restituisce già il server sulla stessa rotta.
9. **Iframe**: `src` fisso (`/menu-preview/<menuId>?edit=1`), il Menu passa nei messaggi. Finché l'iframe non manda `tako-menu-edit-ready` la SPA parla il protocollo di oggi (`tako-menu-preview`), così funziona anche col renderer senza layer.
10. **Campi opzionali tolti** (promo, scarsità): inviati come `null` (il server li normalizza togliendoli).
11. `tests/web/staff-build.test.mjs`: aggiornati il numero di sorgenti (era fermo a 26 con 31 script già prima di questo lavoro; ora 34) e l'elenco di `lib/` (`menu-ops.js`).

## Aperto
- Layer di selezione/gesto nell'iframe (perimetro B): negli e2e i suoi messaggi sono simulati dal frame.
- Pop-over ancorato all'elemento: usa `[data-edit-id]` dentro l'iframe (same-origin); senza attributi si ancora all'angolo dell'iframe.

## Giro finale di verifica (22/10, ~11:25)
- `node scripts/build-staff-web.mjs`: verde (34 sorgenti, `lib/menu-ops.js`).
- `node --test tests/staff/*.test.mjs tests/web/staff-build.test.mjs tests/web/menu-workspace-frontend.test.mjs`: 37/37.
- Altri `tests/web/*.test.mjs` che leggono la SPA: 13 rossi **identici sul commit di partenza 17324ef7** (test fermi a versioni precedenti della UI, non toccati); nessun rosso nuovo.
- `scripts/verify-menu-editor-dashboard.mjs`: 24/24 scenari (desktop 1280 + mobile 390 emulato, flag spento compreso, 0 errori nel browser). Iframe = renderer vero con il layer `?edit=1` già sul ramo (07adb376); selezione/matita/rilascio inviati come messaggi del frame. Screenshot `shots/{desktop,mobile}-*.png`, video `video/flusso-dashboard-desktop.webm`, esito `shots/verifica-dashboard.json`.
- `scripts/verify-menu-editor-concurrency.mjs`: 8/8 scenari, 0 divergenze client/server (`shots/verifica-concorrenza.json`).
- Corretto durante il giro: (1) conferma immediata di caselle/pulsanti decisa dall'elemento dell'evento, non dal fuoco (Safari e clic programmatici non danno il fuoco); (2) pubblicazione del bot scoperta dall'ack di una op: la notifica «Aggiornato da WhatsApp» andava persa → ora la ricarica la segnala e l'etichetta si rilegge da `/status`; (3) stato «Modifiche non pubblicate/Pubblicato» visibile anche su telefono (la testata mobile mostra solo le azioni); (4) «Avanzate»/«Fine» come pillole con testo, campi del pop-over in stile Sobrio.
- Nota per T7 reale: due schede headless vanno marcate «con fuoco» (`Emulation.setFocusEmulationEnabled`), altrimenti la scheda in secondo piano non interroga `/status` (come una scheda nascosta vera).

## Correzioni revisione (22/10, pomeriggio)
1. **Campi strutturati locali finché validi** (`13-menu-item-form.js`, `MW_ED_VALID`): varianti (nome non vuoto, variazione numerica), link (solo `https://`, vuoto → `null`), programmazione (≥ 1 giorno per intervallo, orari validi, «dal» ≤ «al»), promo (> 0), numeri (preparazione, calorie, costo, prezzo). Un campo non valido resta nel pannello e non parte; parte appena diventa valido. Alla chiusura del pannello ciò che è ancora incompleto si lascia con l'avviso «Campi incompleti non salvati». `MenuWorkspaceVariants` NON toccato (lo usa anche la schermata con flag spento): la regola sta nel buffer del pannello.
   Coda (`13-menu-editor-core.js`): risposta 200 con `results[i].ok=false` → le altre op restano applicate, ricarica + una pillola solo se qualcosa è rifiutato («Modifica non valida: non salvata» per `FIELD`, altrimenti «l'elemento è cambiato»). 422 dell'intero gruppo (server vecchio) → le op si marcano `solo` e si rimandano una alla volta: si perde solo quella invalida.
2. **Ordine manuale** (decisione orchestratore, default): fotografia solo al primo rilascio `menu`/`submenu` (lato iframe, vedi B-web) e alla creazione di un **Sottomenu** dal «+»; creare un Menu non fotografa più. Le op `provisional` restano accettate dalla SPA ma non arrivano più dall'iframe. `verify-menu-editor-dashboard.mjs`: aggiunti i controlli «Piatto creato → nessuna fotografia», «Sottomenu creato → manualOrder», e il controllo sulle provvisorie confronta il documento prima/dopo (il documento è già manuale dopo il Sottomenu).
3. **`remote()` solo in avanti**: ricarica solo se `revision` o `publishedRevision` del server sono più avanti; uno stato più vecchio (cache dell'edge di lettura) non fa nulla; `pending` dal poller si prende solo a revisione uguale.
4. **Pubblica/Scarta senza rete**: `whenIdle(8000)` → dopo 8 s il riquadro mostra «Non salvato, riprovo: controlla la connessione», si libera, `busyRef` torna libero (il poller riparte), le op restano in coda.
5. **Avanzate con flag acceso**: «Modifiche non pubblicate» e il bottone Pubblica usano `pending` del server (`MW_NORMALIZE` lo mette nel documento solo con flag acceso, `MW_DOCUMENT` lo toglie dal PUT). Dopo un PUT (risposta senza `pending`) si torna al confronto delle revisioni fino alla rilettura. Corretto anche: la risposta del PUT non ha `dashboardEditor` e spegneva il flag → ora il flag si aggiorna solo dalle risposte che lo portano.
6. **Iframe nato senza Menu**: quando compare il primo Menu l'`src` si aggiorna (una volta) a `/menu-preview/<menuId>?edit=1`.
7. **Foglio «+»**: blocco del doppio tocco con un ref (`lock`, si sblocca a ogni nuova modifica del foglio); `create()` conferma subito in locale (l'elemento è già nella vista) e il foglio si chiude senza aspettare l'ack; offline non resta su «Salvataggio…». Un rifiuto successivo toglie l'elemento con la ricarica e la pillola.
9. **Rotazione/resize col pannello aperto**: il form vive in un nodo stabile (portale) che `MW_ED_SLOT` sposta fra pop-over e foglio: non si smonta, il fuoco torna al campo e il `blur` del passaggio non conferma il testo a metà (`window.__mwEdMoving`).
10. Conferma eliminazione Sottomenu: «il sottomenu con le sue sezioni e i suoi piatti».
Test nuovi: `tests/staff/menu-editor-queue.test.mjs` (422 di gruppo, results ok:false parziale, stato remoto vecchio, whenIdle con tempo massimo), `tests/staff/menu-editor-form.test.mjs` (regole di validità).
