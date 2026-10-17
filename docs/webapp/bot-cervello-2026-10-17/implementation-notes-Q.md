# Perimetro Q · note di implementazione (17/10/2026)

Branch `codex/bot-quick-1017`, base `origin/main` 3bd75b5 (edge v108 online). Deviazioni dal piano e scelte conservative.

## Regola «togli» (documentata)
- **«togli / leva / levami / elimina / cancella / rimuovi X»** (anche «toglimi», «toglici», «togliamo», «leviamo», «eliminami», «cancellami», «rimuovimi», con «dal menu / dalla carta» prima o dopo, con «no,» / «scusa,» davanti) = **nascondere dal menu**, sempre. Mai «esaurito».
- **«finito / esaurito / non c'è più / nun ce sta / è fernuta»** = esaurito.
- Vale in testo e vocale, dentro le richieste multiple e nelle correzioni. Dove decide l'IA, il prompt lo dice e il validatore corregge: se il modello segna «finito» un piatto la cui frase ha un verbo di rimozione e nessuna parola di esaurito, l'azione diventa «nascosto». Una frase senza verbo eredita quello della precedente («togli boh e la lasagna»).
- **Eccezioni volute:** «togli la promo / le ultime porzioni / dall'evidenza» restano quelle azioni (le leggono prima le regole promo/etichette). «Elimina la categoria …» e le domande («puoi cancellare la carbonara?») restano la risposta di capacità («non posso eliminare, posso nascondere»).
- Con «elimina / cancella / rimuovi» la risposta aggiunge una riga: «I piatti non li elimino: li nascondo. Per rimetterli scrivi «rimetti X»».
- **Aspettative cambiate per la regola nuova (non indebolite):** round1 `elimina-01..03` ora si aspettano il piatto nascosto (prima: nessuna modifica + risposta di capacità); `twilio-menu-nlu` «elimina la caprese» non è più una capacità ma «nascondi». È la decisione di Manuel del 17/10.
- Forme storpiate del verbo («toji bo», «tojibo», «toglibo»): non le tratto come comandi certi, ma come **ipotesi** (vedi sotto). Ho tolto «toji/tuogli» dai verbi certi per prudenza.

## Richiesta multipla con una parte incerta (vocale di Manuel)
- Modulo nuovo `apps/server/src/lib/twilio-menu-hold.ts`, senza IA.
- Una parte che non è un piatto e **suona come «togli <piatto esistente>»** (chiave fonetica: gli→l, j→i, h muta, doppie scempie; «tojibo» → «toibo» = «toi»+«bo» = boh) diventa una domanda: «Intendi *togliere boh* dal menu?». Le parti chiare restano in una proposta `hold` di 10 minuti e sono elencate nella domanda.
- Risposte: «sì / esatto / ok / sì toglilo / no, togli bo / togli il boh / toglibo / no ho detto togli boh» → pubblica tutto insieme; «no» → pubblica solo le parti chiare e dice «Non ho toccato *boh*»; «annulla / lascia perdere» → niente; una domanda non scarta la richiesta in sospeso; un comando nuovo la scarta e lo dice («La richiesta di prima non l'ho pubblicata…»); qualsiasi altra cosa ripete la domanda. Menu cambiato nel frattempo → «Il menu è cambiato nel frattempo», niente pubblicato.
- Se la parte incerta è un vero piatto nuovo senza prezzo («… e la frittata») il bot chiede il prezzo e la risposta («8 euro», «otto», «a 8,50») completa tutto. «no, togli bo» in risposta al prezzo vale come rimozione (la parola era un «togli»).
- **Scelta conservativa:** il blocco in sospeso scatta solo con **una** parte incerta. Con due o più parti incerte il messaggio segue il flusso di prima (IA con validatore). Con zero parti incerte, l'aggiunta multipla resta all'IA come prima; cambia solo il caso «aggiunta + comando chiaro» («aggiungi … la parmigiana a 10 e togli boh»), che ora si applica qui (prima il nome diventava «Parmigiana e togli boh»), e i comandi multipli su piatti esistenti con un «togli» dentro («togli boh e il piatto di verifica costa 14»), applicati senza IA.
- Più di 3 modifiche dopo la risposta → il solito riepilogo con OK (regola del 16/10 invariata).
- Nomi dei piatti nuovi: come `parseCreate` (articolo tolto, prima maiuscola): «la parmigiana» → «Parmigiana».

## Annulla vero
- Ogni pubblicazione fatta da WhatsApp (automatica o confermata) salva le voci **prima/dopo** in `tako_whatsapp_messages` con chiave `undo:<telefono>` (come `last:`, nessuna migrazione SQL). Solo voci di piatti: se cambia altro (sezioni, piatto del giorno con sezione nuova, design) non si salva e «annulla» risponde come prima.
- «annulla / torna indietro / rimetti com'era / annulla l'ultima modifica / torna come prima / ops annulla» **senza riepilogo in attesa**:
  - entro 10 minuti: rimette le voci com'erano (i piatti aggiunti si tolgono), pubblica, e risponde «*Annullato.* Il menu è tornato com'era…» con l'elenco;
  - se nel frattempo la dashboard ha cambiato **le stesse voci**: «*Non annullo*: nel frattempo X è stato cambiato dalla dashboard. Non ho toccato nulla.» Le modifiche della dashboard su altre voci restano e l'annulla procede;
  - dopo 10 minuti: «Posso annullare solo le modifiche fatte qui negli ultimi 10 minuti. Non ho toccato nulla.»;
  - senza nulla da annullare: il testo di prima («Non ci sono modifiche in attesa…»).
- Con un riepilogo in attesa «annulla» lo cancella come prima. «no» da solo non annulla una modifica pubblicata.
- Annulla solo l'**ultima** pubblicazione; dopo un annulla non c'è un «rifai». La memoria `last:` (correzioni «no scusa 14», «anche la lasagna») si azzera dopo un annulla.
- **Aspettative cambiate:** in `twilio-menu-ai-flow` tre «annulla» dopo una modifica pubblicata si aspettavano «Non ci sono modifiche in attesa». Lo store finto di quel test non salva le scritture, quindi ora il bot vede la voce diversa e risponde «Non annullo»: l'asserzione controlla questo e che non scriva nulla.

## Riga «assistente automatico» (AI Act art. 50)
- Testo: «Sono l'*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona.»
- Nel benvenuto quando il collegamento si attiva (codice «collega tako» o primo messaggio di un numero pre-collegato), e al **primo messaggio** di un numero già collegato. Una volta sola per numero: chiave `ai:<telefono>` in `tako_whatsapp_messages`. Nelle risposte che arrivano dopo l'IA (via REST) la riga va in testa allo stesso messaggio.
- I test che confrontano il testo esatto (`twilio-menu-ai-flow`, `menu-full-message-1016`) partono con la riga già mostrata; le batterie nuove controllano che compaia una volta nella prima risposta e mai dopo.

## Whisper
- `prompt` della trascrizione = parole di servizio + categorie (max 12) + piatti del locale, tetto 600 caratteri (≈200 token). Priorità: visibili prima dei nascosti; i più recenti (in fondo alla loro categoria) prima, a turno per categoria; i più importanti in fondo, perché Whisper usa la coda. Letto dal pubblicato in parallelo al download dell'audio; errore → solo parole di servizio. Nessun token LLM in più.

## Batterie e verificatori
- `round6` (mia, 177 casi): famiglia completa con invarianti nuove (riga AI una volta, mai «finito» per un verbo di rimozione, prompt Whisper con i nomi del locale nei vocali).
- `round6b`: verificatore indipendente (vedi REPORT-Q).
- Ho dovuto correggere alcune mie attese al primo giro (non il bot): «boh è finito» toglie anche «Ultime porzioni» (regola dell'esaurito operativo già esistente); la carbonara del banco costa già 12; i casi «annulla» che passano dall'IA hanno bisogno della risposta del modello finto.
