# Bot titolare: loop di correzione sulla batteria avversaria (16/10/2026, edge v99)

Batteria: `tests/owner-bot-adversarial.test.ts`, 283 casi (ramo `codex/verify-owner-bot` 4fbfb89, unito). Ogni caso gira con l'IA «ideale» e, se passa dall'IA, anche con risposte sbagliate (vuota, piatto sbagliato, creazione inventata). Per farla girare nel worktree: `apps/server/node_modules/@tako/db` deve puntare al `packages/db` del worktree.

| Base | OK | GRAVE | MEDIO | BASSO |
|---|---|---|---|---|
| Base del verificatore (prima di v98) | 129 | 143 | 3 | 8 |
| v98 (ramo, prima del loop) | 167 | 101 | 7 | 8 |
| **v99 (dopo 3 giri)** | **263** | **0** | **2** | 18 |

Gli 8 BASSI in più sono casi che prima erano GRAVI e ora restano solo con una risposta poco precisa.

I 2 MEDI rimasti (turni-13 «conferma» scritto, turni-14 «ok va bene conferma» a voce, dopo un riepilogo di 4 prezzi) dipendono dalla regola esistente: più di 3 modifiche richiedono un «OK» **scritto**. Il test `twilio-owner-batches` («… still requires typed OK») la fissa esplicitamente. Non l'ho cambiata; serve una decisione di Manuel.

## Cause e fix
- **G1** — «metti in offerta X a N» e «metti nel menu …» finivano nella regex del prezzo di `parseMenuCommand` e di `parseIntent`, con la frase intera come nome del piatto. Ora quelle regex scartano un bersaglio con promo, offerta, aggiungi, nuovo o menu. In più non si risponde mai «Non trovo «…»» con un nome di più di 4 parole o con verbi: si passa all'IA, che poi passa dal validatore.
- **G2** — Le risposte alle domande del bot non erano collegate.
  - Aggiunta: bozza `create_draft`, già fatta in v98 ed estesa (fillers «si chiama», «mettilo», prezzo in lettere con centesimi).
  - Correzioni e «anche»: memoria dell'ultima modifica applicata. Sta in `tako_whatsapp_messages` con chiave `last:<telefono>`: niente migrazione, e la memoria non interferisce con OK e ANNULLA. Vale 10 minuti e solo se il menu non è cambiato nel frattempo.
  - Esempi: «no scusa 14» corregge il prezzo appena messo; «anche la lasagna» applica la stessa modifica a un altro piatto.
- **G3** — «scusa no era la lasagna» annulla la modifica precedente e applica quella giusta, in una sola pubblicazione.
- **G4** — Una domanda che finisce con «?» non è mai un'azione: `parseIntent` la trasforma in lettura. Le domande senza «?» («quanto costa…») erano già letture.
- **G5** — «non» rende la frase un non-comando. Fanno eccezione «non c'è più» e «non abbiamo più».
- **G6** — Un prezzo oltre 500 € o oltre 3 volte quello attuale va sempre in conferma scritta, mai online diretto.
- **G7** — `storedActions` su una proposta `choose` (o `create_draft`) chiamava `normalizeMenuText(undefined)` e finiva in errore generico. Ora restituisce null. Inoltre la scelta accetta una parola distintiva («quelli alla carbonara»).
- **G8** — Aggiunto «X finita» senza «è»; il refuso sul piatto lo copre già `findDishes`. Il verbo con refuso («aggingi») e i riempitivi («mi aggiungi», «vorrei aggiungere», «… per favore», «grazie») ora sono riconosciuti.
- **G9** — Il server non si fida più dell'IA. In `validateMenuPlan`:
  - ogni azione su un piatto esistente deve riguardare un piatto nominato nel testo. Il match è tollerante: una parola distintiva, anche con un refuso; una parola generica solo se nel menu un solo piatto la contiene. Fanno eccezione le correzioni a un riepilogo in attesa, dove i piatti sono già nel riepilogo;
  - ogni prezzo (cambio, promo, piatto nuovo) deve comparire nel messaggio: in cifre, in lettere, in centesimi, o come differenza esplicita con aumenta, abbassa, meno;
  - il nome di un piatto nuovo non contiene parole d'azione né la categoria.
  Altrimenti la risposta è un chiarimento. Lo stesso principio vale già per il validatore dell'onboarding.
- **MEDI**:
  - 4 prezzi con nomi brevi: `fullMenuSignal` conta un piatto come già noto anche se citato con una sola parola distintiva, quindi niente domanda «MENU o MODIFICHE».
  - «anche la lasagna»: vedi G2.
  - L'aggiunta con descrizione, foto, «del giorno», promo o etichetta non passa dal percorso deterministico.
- **Non fatto (BASSI)**: copy per rinomina, sposta, foto e «aumenta tutti»; «che pizze ci sono» con la lista; i preset in chat. Il cablaggio `setPresetChatCommand` è chiamato dal bot, ma nessuno registra un'implementazione: i comandi chat dei preset non esistono ancora (va scritto il gestore F2).

## Regressioni (stessi file eseguiti su v98 e su v99)
Invariati e verdi:
- menu-full-message 20/20, menu-sales 15/15;
- onboarding-invariant 445/445, onboarding-whatsapp-fix-1016 55/55, -1015 20/20, onboarding-chat 40/40;
- twilio-menu-command, nlu, router, sales, owner-timeout;
- day-presets 13/13, crea-piatto 9/9.

Test aggiornati perché cambiava il contratto voluto:
- `twilio-menu-ai.test.ts`: le chiamate senza messaggio ora hanno il messaggio (G9); aggiunto un test G9.
- `menu-full-message-1016`: «carbonara finita» ora è deterministico (G8).
- `twilio-menu-ai-flow`: l'aggiunta incompleta fa una domanda senza IA (G2); la frase del 429 nomina il piatto davvero cambiato (G9). Ora 20/20; su v98 era 19/20.
- `twilio-owner-batches`: il mock accetta le query su `tako_whatsapp_messages`.

`twilio-owner-link` resta 8/15 come su v98: 7 test falliscono, gli stessi su v98 e v99, problema già presente.

## Deploy
v98 (`44b01728…`) → **v99** (`0dc80692…`). Il bundle è v98 più 6 sezioni: `twilio-menu-command`, `twilio-menu-nlu`, `twilio-menu-ai`, `twilio-menu-create`, `menu-full-flow`, `routes/twilio-menu`. Il diff per sezione non tocca nient'altro. check-active esplicito prima di ogni tentativo. Due tentativi hanno avuto un errore 500 interno di Supabase, il terzo è riuscito.
Rollback: `cp ~/.config/tako-webapp/rollback-edge-20261016/candidate-index-v98-wa-create.ts release/serverless/candidate/index.ts && node scripts/translations/deploy-projection.mjs`

## Verifica live (`live/verify-owner-bot-live.mjs`, 16/16)
Il QA ha collegato il numero di Manuel e non è stato toccato. Ho creato un locale temporaneo «ZZ Test bot titolare» (Primi e Dolci, 5 piatti). Il numero finto +390000000099 è stato collegato lì con l'utente agenzia come attore. Alla fine sono stati cancellati locale, menu, versioni, collegamento e memoria. Il collegamento del QA risulta intatto.
14 frasi:
- vocale reale «aggiungi … che costa 12 euro»;
- «aggiungiamo un piatto» → risposta collegata;
- «metti in offerta la lasagna a 9 euro» → promo;
- «il tiramisù è finito?» e «la carbonara costa 13?» → nessuna scrittura;
- «costa 1300» → conferma;
- «cabonara finita» → «scusa no era la lasagna»;
- «metti la panna cotta a 6» → «no scusa 7» → «anche il tiramisù»;
- «aggingi tra i dolci cannolo siciliano 4 euro»;
- «la carbonara non è finita» → nessuna scrittura.

Groq: una sola frase (la negazione) è passata dall'IA, qualche migliaio di token al massimo, sotto il budget di 15k.

# Secondo giro (round 2, 160 casi nuovi del verificatore su v99), edge v100

| Batteria | Prima (v99) | Dopo (v100) |
|---|---|---|
| Round 1, 283 casi | 263 OK · 0 GRAVI · 2 MEDI · 18 BASSI | invariata: 263 · 0 · 2 · 18 |
| Round 2, 160 casi | 127 OK · 12 GRAVI · 7 MEDI · 14 BASSI | **151 OK · 0 GRAVI · 0 MEDI · 9 BASSI** |

I 2 MEDI del round 1 sono la regola dell'OK scritto, la decisione aperta descritta sopra.

Nel verificatore del round 2 ho aggiunto soltanto `novantacinque:95` al suo lettore di numeri: era la ragione del falso «prezzo 95 mai detto», visto che ora il server legge i numeri in lettere fino a 999.

## Fix
- **A** — `followUp`: dopo «scusa/no/anzi» o «anche» il resto deve essere solo un nome di piatto, eventualmente con un prezzo. Una parola d'azione (finita, evidenza, nascondi, costa, promo…) indica un comando nuovo, che segue il flusso normale. «scusa, anche la lasagna» applica la stessa modifica senza annullare la prima.
- **B** — Una parola che è il nome di una categoria con più piatti («la pizza», «il dolce») porta a una domanda con i piatti della categoria (`categoryWordItems`). Lo stesso vale nel validatore G9: quella parola da sola non vale come piatto nominato.
- **C** — `parseSalesText` / `salesTurn`:
  - «offerta» dentro il nome di un piatto esistente non è una promo;
  - «… in promo a 10 solo oggi» diventa una promo fino a oggi;
  - «togli tutte le promo» toglie tutte quelle attive; oltre 3 modifiche scatta il riepilogo con OK.
- **D** — «no scusa 9» dopo una promo corregge la promo.
- **E** — «anche la cotoletta a 12» dopo una promo produce una domanda («Vuoi mettere … in promo a 12 €?») e non cambia mai il prezzo pieno.
- **F** — «no aspetta, lascia stare», «annulla l'ultima», «torna come prima» annullano l'ultima modifica usando la memoria `last:`. L'undo ora copre anche promo ed etichette, e lo conferma una riga. «annulla» da solo resta com'era: «già pubblicate restano».
- **MEDI**:
  - G6: conferma oltre 500 € o da 8 volte il prezzo attuale in su (lo zero in più); 3× bloccava prezzi veri.
  - Numeri in lettere fino a 999, nel validatore, nell'aggiunta e davanti a «euro» nel percorso deterministico.
  - La domanda «Quale piatto intendi» con una sola opzione è sostituita da una richiesta chiara («Non ho capito cosa cambiare per X…»). Ho aggiornato il test di `clarifyText`.
  - «metti nel menu il nuovo burger», con il piatto che esiste ed è nascosto, lo rende visibile invece di aggiungerne un altro.
- **BASSI** (fatto in parte) — Le domande senza «?» («c'è ancora…», «sai se…», «… vero») diventano letture. Restano 9 BASSI di formulazione (domande a voce più libere, «il menù costa 16»).

## Deploy
v99 (`0dc80692…`) → **v100** (`2a913bea…`). Il bundle è v99 più 5 sezioni: `twilio-menu-nlu`, `twilio-menu-sales`, `twilio-menu-ai`, `twilio-menu-create`, `routes/twilio-menu`. Il diff per sezione non tocca nient'altro; check-active fatto prima.
Rollback: `cp ~/.config/tako-webapp/rollback-edge-20261016/candidate-index-v99-owner-bot.ts release/serverless/candidate/index.ts && node scripts/translations/deploy-projection.mjs`

## Regressioni
Stessa suite del giro 1: invariata. Fanno eccezione `twilio-menu-ai`, dove ho aggiornato la frase del chiarimento con una sola opzione, e `twilio-menu-ai-flow`, che resta 20/20. `twilio-owner-link` resta 8/15 come su v98.

## Live (`live/verify-owner-bot-live.mjs`, 14/14)
Ho usato un locale temporaneo «ZZ Test bot titolare» con Primi, Dolci, Pizze e Secondi (dentro anche un «Nuovo burger» nascosto e il caffè), poi l'ho cancellato. Il QA e il numero di Manuel non sono stati toccati.
12 frasi: A, «anche», B, C (solo oggi), D, E, C (tutte), F, piatto nascosto, G6 (10×).
Groq: una sola frase, «scusa, la lasagna è finita», è passata dall'IA; risultato corretto, sotto il budget di 10k.

# Terzo giro (round 3, 141 casi nuovi su v100), edge v102

| Batteria | Prima (v100) | Dopo (v102) |
|---|---|---|
| Round 1, 283 casi | 263 · 0 GRAVI · 2 MEDI · 18 BASSI | invariata |
| Round 2, 160 casi | 151 · 0 · 0 · 9 | invariata |
| Round 3, 141 casi | 98 OK · 32 GRAVI · 3 MEDI · 8 BASSI | **131 OK · 4 GRAVI (errori del verificatore, sotto) · 0 MEDI · 6 BASSI** |

I conteggi sono per caso, col risultato peggiore tra le modalità dell'IA; il coordinatore ne riportava 26 GRAVI e 6 MEDI.

## I 4 GRAVI rimasti sono errori del verificatore (motivati)
- **annulla3-04 / annulla3-05** (menu intero → OK → «ripristina il menu di prima» / «torna come prima»): il mock del round 3 risponde `[]` a `SELECT … FROM menu_workspace_versions`. Senza storico delle versioni il ripristino non può funzionare nella batteria; nel DB reale lo storico c'è ed è il percorso `restore` di sempre. Dopo un menu intero, «torna come prima» risponde in modo chiaro che non c'è un'ultima modifica singola da annullare: la nota del caso accetta «o domanda chiara».
- **annulla3-10** (4 prezzi → ok → «no scusa la carbonara 14»): il modello «ideale» del verificatore usa le modifiche attese a fine caso. Già al primo messaggio restituisce carbonara 13 **e** 14, e il validatore rifiuta il doppione. Con un modello che vede solo il messaggio corrente, il primo turno è il riepilogo di 4 prezzi.
- **promodata-15** («carbonara in promo a 10 fino a stasera e la tagliata solo oggi», frase composta, quindi passa dall'IA): l'azione promo «ideale» del verificatore non ha il campo `until`, e il server non può inventarlo. Un modello vero lo passa: `salesFromLlm` lo accetta e lo verifica sul testo.

## Fix
- **A (date delle promo)**:
  - la scadenza si estrae in qualunque punto della frase: «solo (per) oggi/stasera», «fino a stasera/domani/fine mese/<giorno> sera», «per (tutto) il weekend», «per questa/tutta la settimana»;
  - `resolveUntil` ora legge «fine mese», «tutto il weekend», «domenica sera»;
  - «no scusa fino a sabato» dopo una promo cambia solo la scadenza. Una data incomprensibile produce una domanda, mai una promo senza scadenza.
- **B (tutte)** — operazioni delimitate, sempre con la regola delle 3 modifiche e l'OK: «togli tutte le etichette (dalla X)», «togli tutte le ultime porzioni», «togli ultime porzioni da tutto», «togli il solo oggi da tutti i piatti», «togli piccante da tutti i piatti», «togli la promo a tutte le pizze» (solo la categoria), più richieste unite con «e». Se non c'è niente da togliere, il bot lo dice.
- **C** — `politeCommand`: «mi metti…?», «possiamo mettere…?», «puoi/potresti/riesci a…?», «ce la fai a…?», «me la segni finita…?», «… ? mettila a 13» sono comandi. G4 (domanda = lettura) resta solo senza verbo d'azione.
- **D** — «lascia stare X, <comando>»: X si annulla solo se era il piatto dell'ultima modifica, e il comando si applica nella stessa pubblicazione. «lascia stare, <comando>» applica il comando. «lascia stare il resto, va bene così» non cambia nulla. «torna come prima la lasagna» annulla l'ultima modifica su quel piatto, entro 60 minuti; se la lasagna non era stata toccata lo dice.
- **E** — Decimali a voce («virgola», «e mezzo/mezza») normalizzati prima del controllo «frase composta».
- **F** — Un annullamento non si salva come modifica: il secondo «torna come prima» risponde «non c'è un'ultima modifica da annullare». «torna come prima» senza piatto vale 10 minuti. La memoria `last:` ora vale fino a 60 minuti, ma solo un annullamento che nomina il piatto può usarla dopo i primi 10.
- **MEDI** — Tra più candidati vince l'unico il cui nome è tutto nel testo (`exactPick`: «margherita», «la pizza margherita» → Margherita). La regola «wider» di `matchDishes` resta per i test NLU esistenti. Le operazioni «da tutti i piatti» sono consentite (vedi B). «lascia stare la bruschetta» annulla quell'azione (vedi D).
- **Non fatto (BASSO)** — «il primo è finito», «il secondo costa 16» con l'elenco della categoria.

## Deploy
v100 (`2a913bea…`) → v101 (`3fce1db5…`) → **v102** (`fa0c8414…`): decimali a voce prima della frase composta e memoria dopo «lascia stare X, …», trovati nella verifica live.
Il bundle è v100 più 6 sezioni: `twilio-menu-nlu`, `menu-sales`, `twilio-menu-sales`, `twilio-menu-ai`, `twilio-menu-create`, `routes/twilio-menu`. check-active prima di ogni deploy; un tentativo ha avuto un errore 500 di Supabase, ripetuto con successo.
Rollback: `cp ~/.config/tako-webapp/rollback-edge-20261016/candidate-index-v100-owner-bot-r2.ts release/serverless/candidate/index.ts && node scripts/translations/deploy-projection.mjs`

## Regressioni
Stessa suite: invariata. `menu-sales` 15/15, dopo aver corretto la mia prima versione che rompeva «per tutta la settimana»; nlu 20/20; crea-piatto 9/9; `twilio-owner-link` 8/15 come su v98.

## Live (`live/verify-owner-bot-live.mjs`, 13/13 su v102)
Locale temporaneo creato e poi cancellato; il QA e il numero di Manuel non sono stati toccati.
11 frasi: data in testa, «per tutto il weekend», «no scusa fino a sabato», tutte le promo, «togli piccante da tutti i piatti», «mi metti la carbonara a 13?», «tredici e mezzo», nome esatto, «lascia stare la margherita, nascondi il tiramisù», doppio «torna come prima».
Groq: zero chiamate su v102. Su v101 «tredici e mezzo» era passata una volta dall'IA ed è stata corretta in v102.

# Quarto giro (round 4, 100 casi nuovi su v102), edge v103

Il verificatore ha accettato i 4 casi contestati e ha corretto il banco del round 3.

| Batteria | Prima (v102) | Dopo (v103) |
|---|---|---|
| Round 1, 283 | 263 · 0 GRAVI · 2 MEDI (OK scritto) · 18 BASSI | invariata |
| Round 2, 160 | 151 · 0 · 0 · 9 | 152 · 0 · 0 · 8 |
| Round 3, 141 (banco corretto) | 0 GRAVI | 135 · 0 · 0 · 6 |
| Round 4, 100 | 79 OK · 19 GRAVI · 0 MEDI · 2 BASSI | **99 OK · 0 GRAVI · 0 MEDI · 1 BASSO** |

## Fix
1. **Filtro di categoria sempre applicato**: «togli piccante / tutte le etichette / tutte le promo / ultime porzioni da|dalle|dai <gruppo>». Il gruppo si risolve con `categoryItems`: categoria, oppure menu («bevande»), al singolare o al plurale. Senza «tutte/tutti» passano da qui solo i gruppi che sono una categoria con più piatti («togli ultime porzioni dai dolci»). Un singolo piatto, o una frase con «e …», resta al percorso di sempre.
2. **Ogni clausola promo ha la sua data**: «X in promo a 10 fino a domenica e Y in promo a 9 fino a sabato» diventa una richiesta multipla deterministica, con la stessa validazione. Funziona anche con «stasera …», «tutta la settimana …», «questo weekend …» in testa.
3. **Gruppi** (`groupCommand`):
   - «tutte le pizze sono finite», «finiti tutti i …», «nascondi tutti i dolci», «mostra/rimetti tutti i …», «rimetti disponibili tutte le pizze», «tutti i contorni sono finiti»;
   - «… tranne X», anche su promo ed etichette («togli la promo a tutti tranne la carbonara»).
   Sempre con la regola delle 3 modifiche e l'OK.
4. **Domande cortesi**: «puoi dirmi se / potresti dirmi se / mi dici se / mi sapresti dire se / mi confermi che / dimmi se» seguite da uno stato o un prezzo sono letture. «ho messo X in evidenza» punta al piatto X. «potresti dirmi cosa è finito?» elenca i piatti finiti.
5. «lascia stare la lasagna, è tornata» dopo un esaurito annulla l'esaurito.
- **BASSO** — Il messaggio «niente da annullare» ora suggerisce «ripristina il menu di prima» per i menu interi.

## Test aggiornati
`twilio-menu-sales`: «tiramisù in promo a 7 e carbonara in promo a 8» ora è deterministico, quindi risposta immediata senza IA. La validazione è la stessa (prezzo promo non valido → «Non ho cambiato nulla»).

## Deploy
v102 (`fa0c8414…`) → **v103** (`268f2a90…`). Il bundle è v102 più 5 sezioni: `twilio-menu-nlu`, `menu-sales`, `twilio-menu-sales`, `twilio-menu-create`, `routes/twilio-menu`. Il diff per sezione non tocca nient'altro; check-active fatto prima.
Rollback: `cp ~/.config/tako-webapp/rollback-edge-20261016/candidate-index-v102-owner-bot-r3.ts release/serverless/candidate/index.ts && node scripts/translations/deploy-projection.mjs`

## Live (12/12, v103)
Locale temporaneo creato e poi cancellato; il QA e il numero di Manuel non sono stati toccati.
10 frasi: piccante tolto solo alle pizze; due promo con due date; «stasera …» in testa; bibite finite tranne l'acqua; bibite rimesse disponibili; promo tolte solo ai primi; «puoi dirmi se la lasagna è finita?»; «potresti dirmi cosa è finito?»; esaurito poi «lascia stare la lasagna, è tornata».
Groq: zero chiamate.

# Giro finale (edge v104 → v105)

| Batteria | Prima (v103) | Dopo (v105) |
|---|---|---|
| Round 1, 283 | 263 · 0 GRAVI · 2 MEDI · 18 BASSI | **275 OK · 0 · 0 · 8 BASSI** |
| Round 2, 160 | 152 · 0 · 0 · 8 | 152 · 0 · 0 · 8 |
| Round 3, 141 | 135 · 0 · 0 · 6 | **139 · 0 · 0 · 2** |
| Round 4, 100 | 99 · 0 · 0 · 1 | 99 · 0 · 0 · 1 |

## 1. Conferma del riepilogo (decisione di Manuel)
Oltre 3 modifiche, il riepilogo si conferma con «OK», «conferma», «confermo», «va bene», «sì conferma», «ok va bene conferma», anche a voce. Conferma solo un messaggio fatto **solo** di parole di conferma: «va bene così» o «ok la prima a 30» non confermano. Il menu intero resta con la sua regola, cioè «OK» scritto.
Contratto aggiornato in `tests/twilio-owner-batches.test.ts`, con un nuovo test per ciascuna parola, anche a voce. I 2 MEDI del round 1 sono chiusi.

## 2. Comandi dei preset in chat (gestore reale in `menu-preset-target.ts`, funzioni F2)
- «metti online il menu di martedì (a pranzo)»: riepilogo, poi OK/conferma (anche a voce), poi `publishDayPreset`. Rispetta la regola dell'OK e il blocco PROVA.
- «attiva / disattiva la pubblicazione automatica del pranzo»: `setDayPresetAutoPublish`.
- «cosa c'è lunedì / oggi / domani a pranzo?»: elenco del preset.

Il menu si sceglie dal nome; se non è indicato, si usa l'unico menu con i preset attivi, altrimenti il bot chiede quale. Senza preset o con un preset vuoto il bot lo dice.
Test: `tests/day-presets/day-presets.test.ts`, nuovo caso su Postgres locale. «menu di lunedì: …» resta verde in `menu-full-message-1016`.

## 3. BASSI
- Rinomina e sposta: una riga chiara su cosa si fa dalla dashboard.
- «il dolce/primo/secondo è finito / costa N»: elenco dei piatti della categoria e domanda.
- «che pizze ci sono»: lista della categoria.

## Pannello WhatsApp del titolare
`GET /api/menu-workspace/whatsapp/owner` restituisce anche `activatedAt` (ISO), cioè l'ora del collegamento da `tako_whatsapp_links`. Il frontend lo leggerà dopo.

## Deploy
v103 (`268f2a90…`) → v104 (`a7ed936c…`: conferma, preset in chat, bassi; v103 + sezioni `menu-preset-target` e `routes/twilio-menu`) → **v105** (`eb25599b…`: v104 + solo `activatedAt`, 2 righe).
check-active prima di ogni deploy. v104 ha avuto 4 errori 500 di Supabase prima di riuscire.
Rollback a v103: `cp ~/.config/tako-webapp/rollback-edge-20261016/candidate-index-v103-owner-bot-r4.ts release/serverless/candidate/index.ts && node scripts/translations/deploy-projection.mjs`. Per v104: `candidate-index-v104-owner-bot-final.ts`.

## Live (15/15, v105)
Locale temporaneo con un preset di martedì, poi cancellato; il QA e il numero di Manuel non sono stati toccati.
- `activatedAt` presente.
- «il dolce è finito» → domanda.
- «che pizze ci sono» → lista.
- «sposta …» e «cambia il nome …» → una riga di limite.
- 4 modifiche → riepilogo; «va bene così» non conferma; «ok va bene conferma» conferma.
- «cosa c'è martedì a pranzo?» → elenco.
- «metti online il menu di martedì» → «conferma» → online.
- Pubblicazione automatica attivata e poi spenta.

Groq: poche chiamate. Il riepilogo di 4 modifiche e «va bene così» col riepilogo in attesa passano dall'IA, come previsto; in tutto molto sotto i 10k token.
