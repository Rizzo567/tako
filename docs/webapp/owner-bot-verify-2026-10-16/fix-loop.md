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
