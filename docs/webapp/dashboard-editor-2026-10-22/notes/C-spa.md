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
