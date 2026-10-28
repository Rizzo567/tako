# Bot titolare: aggiunta di un piatto senza IA (16/10/2026, edge v98)

## Bug (dal vivo)
1. «aggiungiamo un piatto» → l'IA rispondeva «manca il nome e il prezzo… rimandami la richiesta completa», senza memoria.
2. Vocale «aggiungi tra piatti di prova il piatto pasta al ragù che costa 12 euro» → «Non trovo «aggiungi tra piatti di prova il piatto pasta al ragu che»».

Causa: `parseIntent` (`twilio-menu-nlu.ts`) prova per primo il cambio prezzo `^(.+?) (costa|…) N( euro)?$`. Con «… che costa 12 euro» il nome diventava tutta la frase prima di «costa», e il cambio prezzo scavalcava l'aggiunta. Il bot del titolare inoltre non aveva una «domanda in attesa» per l'aggiunta: la risposta dell'IA non lasciava traccia.

## Fix
- Nuovo `apps/server/src/lib/twilio-menu-create.ts` (deterministico, niente Groq). Un messaggio che inizia con aggiungi/aggiungiamo/aggiungere/inserisci, «metti un nuovo piatto» o «nuovo piatto» è **sempre** un'aggiunta.
  - Categoria da «tra (i) X», «nella categoria X», «in/nei/nella X», confrontata con le categorie esistenti, senza badare a maiuscole o accenti. Se il locale ha una sola categoria si usa quella.
  - Prezzo da «che costa N euro», «a N euro», «N euro», «N€», anche in lettere (fino a cento).
  - Nome senza «il piatto», «un», «la» e il «che» finale. «Piatto di …» resta nel nome.
- Se manca qualcosa, il bot fa **una** domanda alla volta: categoria (solo se ce n'è più di una), poi prezzo, poi nome. Tiene la bozza come proposta `create_draft` in `tako_whatsapp_proposals` (stessa scadenza di 10 minuti, «annulla» la cancella, «ok» ripete la domanda).
  - Il messaggio successivo, testo o vocale, completa la bozza anche se riscritto per intero o senza verbo. Basta anche il solo nome della categoria.
  - Fa eccezione un altro comando riconosciuto (finito, nascondi, …): quello segue il flusso di sempre.
- Un piatto già presente nella categoria non viene duplicato: il bot risponde «è già in …».
- Restano la regola delle 3 modifiche e la conferma: l'aggiunta è una sola modifica e si applica e pubblica come prima. Con un riepilogo in attesa di OK il flusso resta quello di prima (IA).
- Route `twilio-menu.ts`: la decisione arriva prima del controllo «frase composta» e di `parseIntent`.

## Deploy
v96 (`2dbbbc4f…`) → v97 (`280b292b…`, primo rilascio) → **v98** (`44b01728…`, fix «piatto di verifica» trovato nella verifica live: «piatto» veniva tolto anche quando fa parte del nome).
Bundle = base + nuova sezione `lib/twilio-menu-create.ts` + sezione `routes/twilio-menu.ts`. Nomi a livello di modulo con prefisso `waNew…`, così esbuild non rinomina simboli di altri moduli; il diff per sezione non tocca nient'altro. check-active esplicito prima di ogni deploy. Un deploy di v97 ha avuto un errore 500 interno di Supabase e il secondo tentativo è riuscito.
Rollback a v96: `cp ~/.config/tako-webapp/rollback-edge-20261016/candidate-index-v96-lead-status.ts release/serverless/candidate/index.ts && node scripts/translations/deploy-projection.mjs`

## Verifica
- `tests/twilio-menu-create.test.ts` (9 test, senza DB né Groq): le frasi esatte della conversazione, le varianti richieste, l'ordine delle domande, i doppioni, «piatto di …», e la regressione «carbonara 12», «la carbonara è finita», «prezzo Pasta e fagioli a 9» (restano fuori dall'aggiunta e `parseIntent` invariato).
- Live (`verify-wa-create.mjs`, 11/11). Messaggi firmati da +390000000099 collegato temporaneamente al QA «Tako · Verifica web». Il QA ammette un telefono solo e aveva già un collegamento attivo: quel collegamento è stato messo da parte e rimesso identico (stessa riga), senza usare quel numero. QA ripristinato per hash, numero finto scollegato.
  - Il QA ha una sola categoria, «Piatti di prova»: «aggiungiamo un piatto» chiede il prezzo; la risposta «aggiungi tra piatti di prova il piatto pasta al pesto che costa 12 euro» aggiunge e pubblica. Seguono doppione, «nuovo piatto: tiramisù 6 euro», «a cinque euro» e le regressioni prezzo ed esaurito.
- Nota: in una prima esecuzione del verifier il messaggio «Piatti di prova», mandato senza domanda in attesa, è finito nel percorso IA (una chiamata Groq possibile). Lo script corretto non lo manda più.
