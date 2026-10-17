# Perimetro Q · correzioni rapide del bot titolare · esito (17/10/2026)

Branch `codex/bot-quick-1017`, base `origin/main` 3bd75b5. **Edge operativa online: v110** (`3890471cc0e36a98f6278268a1b73603628287f03156f37a2271665f8011b0b6`). Prima c'era v108 (`f6f1e4bb…`); v109 (`864b34e0…`) è rimasta online circa 10 minuti (vedi «Incidente»).
**Ho deployato io l'edge (v109 e v110).** Non ho toccato takomenu-public, read-edge, takomenu-web né l'SQL.

**Per l'agente N:** il commit finale è nella sezione «Commit finale» in fondo. `origin/main` e `origin/codex/release-1016` puntano allo stesso commit dopo il fast-forward.

## Cosa è cambiato
1. **«togli» coerente.** «togli / leva / levami / elimina / cancella / rimuovi X» = sempre *nascosto* dal menu, mai *esaurito*, in testo e vocale, dentro le richieste multiple e nelle correzioni («no, togli boh»). «finito / esaurito / non c'è più / nun ce sta» = esaurito. Quando decide l'IA, il prompt lo dice e il validatore corregge un «finito» sbagliato. Con «elimina» la risposta aggiunge «I piatti non li elimino: li nascondo». Regola scritta in `implementation-notes-Q.md`.
2. **Caso vocale di Manuel.** «aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e tojibo»: il bot non pubblica niente e non perde niente. Elenca le aggiunte chiare e chiede ««tojibo» non è nel menu. Intendi *togliere boh* dal menu?». «no, togli bo», «sì», «esatto», «toglibo» pubblicano tutto insieme; «no» pubblica solo le aggiunte; «annulla» niente.
   - Se la parte incerta è un piatto nuovo senza prezzo, chiede il prezzo e la risposta completa tutto.
   - Un piatto già presente nella categoria non si raddoppia: lo dice in una riga («*la parmigiana* è già in *Piatti di prova* a 10,00 €»).
   - Funziona anche con i comandi sui piatti esistenti («piatto di verifica a 14 e tojibo») e con «tojibo» da solo. Modulo nuovo `twilio-menu-hold.ts`, senza IA.
3. **Whisper.** Il `prompt` della trascrizione contiene parole di servizio, categorie e piatti del locale, al massimo 600 caratteri (circa 200 token). Hanno la priorità i piatti visibili e i più recenti di ogni categoria. Nessun token LLM in più. Il parametro è verificato con un test unitario sulla richiesta e su ogni vocale delle batterie.
4. **Riga AI Act.** «Sono l'*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona.» Compare una volta sola per numero: nel benvenuto del collegamento e al primo messaggio di un numero già collegato.
5. **Annulla vero.** «annulla», «torna indietro» o «rimetti com'era» entro 10 minuti dall'ultima pubblicazione fatta da WhatsApp rimettono le voci com'erano e pubblicano di nuovo. I piatti aggiunti si tolgono.
   - Se la dashboard nel frattempo ha cambiato le stesse voci, o se sono passati più di 10 minuti, il bot lo spiega e non tocca nulla.
   - Con un riepilogo in attesa, «annulla» lo cancella come prima.

## Batterie (casi · GRAVI/MEDI/BASSI, il peggiore per caso; orologio fisso)
| Batteria | Esito |
|---|---|
| Round 1 (283), 2 (160), 3 (141), 4 (100) | **0 / 0 / 0** |
| Round 5 (189), 5b (193), 5c (186), 5-qa (16) | **0 / 0 / 0** |
| **Round 6**, mia (177): famiglia «togli», parte incerta, correzioni con «no», annulla, riga AI, prompt Whisper | **0 / 0 / 0** |
| **Round 6b**, verificatore indipendente (200) | **0 / 0 / 0**. Al primo giro 8 rossi: 5 erano attese sbagliate, 3 difetti veri (vedi sotto) |
| **Round 6-qa** (17): le sequenze dal vivo sul menu vero del QA, con l'invariante «nessuna chiamata all'IA» | **0 / 0 / 0** |
| Unità `twilio-menu-hold` (8) | verdi |

- I 3 difetti veri trovati dal verificatore sono corretti. Primo: «sì e la tagliata costa 20» perdeva la richiesta in sospeso. Secondo: con la parte incerta in testa al messaggio l'aggiunta partiva subito. Terzo: «non lo aggiungere» non valeva come no.
- Ho corretto anche un'attesa del verificatore: con 4 modifiche serve l'OK, per la regola del 16/10.
- **Suite completa:** base 2678 test con 12 rossi, ora **3083 test con gli stessi 12 rossi** (twilio-owner-link 7, presentation 2, PDF 1, parity 2) più i file che richiedono il Postgres locale. **Nessun rosso nuovo.** tsc del server verde.
- **Aspettative cambiate per le regole nuove**, motivate in `implementation-notes-Q.md`:
  - round1 `elimina-01..03` e `twilio-menu-nlu`: «elimina X» ora vuol dire nascondere;
  - `twilio-menu-ai-flow`: «annulla» dopo una modifica pubblicata;
  - i test a testo esatto partono con la riga AI già mostrata.

## Gate con Groq vero
In locale e in sola lettura, chiave del bot (`groq-key-test.txt` non esiste): 5 frasi con «togli» che passano dall'IA, **5/5 PASS, 6.369 token** su 10.000.
- «boh toglilo dal menu» e «no aspetta, la pasta al ragù levala» danno *nascosto*.
- «nun ce sta cchiù boh, e levame pure che ne sacc» dà boh *esaurito* e che ne sacc *nascosto*.
- «… è finita, non toglierla» resta *esaurito*.

Esiti in `live-Q/groq-gate-q-result.json`, consumo in `token-log.md`.

## Verifica dal vivo sul QA (`live-Q/verify-live-q.mjs`, v110): **17/17 PASS**
Webhook firmato, con il numero collegato al QA come mittente. Risposte solo nel TwiML: **31 turni, 0 messaggi WhatsApp inviati** (verificato su `tako_whatsapp_messages`).
- **Caso di Manuel** con «no, togli bo», più 11 varianti: sì, «toibo», piatti nuovi, no, annulla, «togli» chiaro, comandi su piatti esistenti, «tojibo» da solo, «togli», «elimina», prezzo mancante.
- **4 annulla**: semplice, dopo la richiesta multipla, dopo «togli», e con un cambio dalla dashboard nel mezzo (risposta «Non annullo», resta il prezzo della dashboard). Più un annulla senza nulla da annullare.
- **Riga AI** controllata in ogni sequenza: c'è una volta nella prima risposta e mai dopo.
- **Ripristino**: menu QA verificato per hash; proposta e memorie `last:`, `undo:`, `ai:` del numero rimesse com'erano. Restano spente le righe `menu_items` dei piatti creati durante la prova (10), come nelle verifiche precedenti.

## Incidente (da sapere)
Al primo giro dal vivo su **v109** la prima frase di Manuel è finita all'IA. Sul QA di oggi «la parmigiana» e «tiramisù» c'erano già, aggiunti dal suo vocale delle 13:26, e v109 in quel caso ripiegava sul flusso di prima.
- Lo script si è fermato al primo turno vuoto, ma il job IA ha **inviato un messaggio WhatsApp al numero di Manuel** alle 14:33:56: «Sono l'assistente automatico di Takomenu… *Non ho capito la richiesta.* …». Menu non toccato.
- Ho corretto il bot (doppione saltato e domanda mantenuta) e aggiunto il banco `round6-qa` sull'istantanea del menu QA.
- Lo script dal vivo ora si ferma se il menu del QA non è più quello dell'istantanea provata. Poi ho deployato v110.

## Stato del QA trovato (non mio)
Il menu QA non è più quello di `qa-whatsapp-2026-10-17/stato-iniziale.json`: ci sono le prove vocali di Manuel delle 13:23–13:27. Situazione:
- boh *finito*;
- pasta al ragù *nascosta* e a 20 €;
- «la parmigiana» 10 €, «tiramisù» 6 € e «Inserisce il piatto la parmigiana» (nascosto).

L'ho lasciato così.

## Deploy e rollback
Bundle = quello online (v108) più solo il mio delta. Diff sezione per sezione:
- cambiano `twilio-menu-copy`, `twilio-menu-prompt`, `twilio-menu-nlu`, `twilio-menu-ai`, `routes/twilio-menu`, più la sezione nuova `twilio-menu-hold`;
- le altre 135 sezioni sono identiche (cambia solo il nome della cartella temporanea di `image-entry`);
- ho rinominato gli identificatori del modulo nuovo, così esbuild non rinomina variabili in `menu-full-flow` e `stats`.

Prima di ogni deploy ho fatto check-active (108 `f6f1e4bb…`, poi 109 `864b34e0…`). Le copie sono in `~/.config/tako-webapp/rollback-edge-20261017/`: `candidate-index-v109-bot-quick.ts` e `candidate-index-v110-bot-quick.ts`.

Rollback a v108:
`cp ~/.config/tako-webapp/rollback-edge-20261017/candidate-index-v108-qa-whatsapp.ts release/serverless/candidate/index.ts && cp ~/.config/tako-webapp/rollback-edge-20261017/magick-wasm-0.0.44.js release/serverless/candidate/ && node scripts/translations/deploy-projection.mjs`
(da un worktree con `.env.web`; poi `check-active` sulla nuova versione).

## Per Manuel
1. **Con due o più parti incerte** nello stesso messaggio il bot non fa la domanda: segue il flusso di prima (IA con validatore). È una scelta prudente.
2. **«no» alla domanda «Intendi togliere boh?»** pubblica comunque le parti chiare. «annulla» invece non pubblica niente.
3. **«annulla» vale solo per l'ultima pubblicazione** e solo per 10 minuti. Non c'è un «rifai».
4. **Il piatto del giorno** (crea la sezione del giorno) non si annulla con «annulla»: il bot risponde come prima.

## Commit finale
Il codice del bot è `b28b147` (= v110). Il commit che contiene questo report è quello su cui ho fatto il fast-forward di `origin/main`, `origin/codex/release-1016` e `origin/codex/bot-quick-1017`: `git log -1 origin/main`.
