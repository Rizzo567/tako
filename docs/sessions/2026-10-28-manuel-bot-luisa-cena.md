# 28/10/2026 sera — Manuel — bot: chat di Luisa sul Menu Cena

## Cosa è successo (sola lettura su Twilio e DB, nessuna scrittura sul cliente)
Tra le 18:59 e le 19:22 Luisa (Victoria Bar) ha rifatto quattro volte i Primi/Secondi/Contorni del Menu Cena. Nessun guasto registrato:
il bot capiva male.

## Cause verificate (riprodotte sul route vero con la copia della struttura di Victoria)
1. **Sottomenu perso dopo «elimina secondi»**: `contextSection` prende l'ultimo sottomenu nominato negli ultimi turni. La risposta del bot
   finisce con «Per tornare *come prima* scrivi annulla»: `sameSection('Primi','prima')` è vero, quindi l'ultimo sottomenu letto era
   **Primi**. I nomi senza portata riconosciuta andavano nei Primi, gli altri per portata (Contorni/Secondi). I 10 minuti si contavano
   dall'ultimo turno salvato, non da adesso.
2. **«e» e nomi uniti**: «… cozze e pomodori» = dubbio → ipotesi «divido» (pomodori è un ortaggio) → «Pomodori» da solo; senza virgole
   le parole che aprono un piatto dividevano o univano a caso, e si scriveva subito.
3. **«tagliolini» → «Fagiolini»** (in prova anche «pancetta» → «Paoletta»): `fixSpelling` correggeva i nomi NUOVI sul vocabolario del locale.
4. **«Mandami menù sera»**: `pdfIntent` cercava solo le parole del nome del Menu («cena»), non «sera».
5. **Vocali**: la trascrizione non passava mai da `pdfTurn` (limite noto della v189).
6. **Ordine**: il PDF rispondeva subito nel TwiML anche con un inserimento ancora in lavorazione (19:03:22: PDF prima della conferma
   dell'inserimento delle 19:02:57).

## Correzioni (ramo `codex/manuel-bot-luisa-1028`, base `bc722b4b` = sorgente v191)
- `owner-brain-svuota.ts`: «prima/seconda» mai sottomenu; contesto entro 10 minuti da adesso (`contextSection`, `contextMenu` recente);
  «elimina X» da solo salva il sottomenu svuotato come attesa silenziosa (`names`, `ctx:true`, legata a Menu e numero, scade come ogni
  attesa) → il prossimo «inserisci …» va lì. Sottomenu detto prevale; altro Menu detto o altro comando = messaggio nuovo. Proposta in
  attesa + nuovo comando (svuota/inserisci) = messaggio nuovo (prima andava al modello). Confini indovinati senza virgola (anche
  maiuscola a metà frase), pezzi dubbi o piatti nuovi messi per portata → **proposta «Ho capito così…», nessuna scrittura** fino al «sì».
  Nomi nuovi senza `fixSpelling`.
- `dish-split.ts`: ortaggio da solo in coda a un nome di 2+ parole (fuori dai Contorni) resta nel nome.
- `owner-brain-sera.ts`: `sessionName` senza `fixSpelling` per i nomi nuovi.
- `twilio-menu-nlu.ts` `pdfIntent`: alias con la stessa `menusIn` delle modifiche, «anteprima» (Menu della conversazione se uno solo,
  altrimenti domanda), «manda mi».
- `routes/twilio-menu.ts`: `pdfTurn` con alias/contesto; trascrizioni e job testo passano da `pdfTurn` prima del percorso modifiche;
  PDF in fila se il numero ha messaggi in lavorazione (`turnsBusy`); invii REST divisi su `nextMessage` (testo, poi allegato); memoria
  del turno senza URL.

## Verifiche
- Nuovo `tests/bot-luisa-1028.test.ts` (20 casi, route vero, dati sintetici): i 6 casi richiesti + scaduto, altro Menu, sottomenu
  esplicito, «no» alla proposta, anteprima con/senza conversazione, 4 giri come la chat.
- `tsc` server pulito. Suite completa: vedi «Esito suite» sotto.
- Build candidate dal ramo: PASS. Base `bc722b4b` ricompilata = v191 online byte per byte (salvo nome cartella temporanea).
- Candidato di rilascio = **v192 online + solo questo delta** (merge a tre vie v191→ramo su v192, 0 conflitti; 212 righe del delta +
  136 della migrazione accessi = 348 righe da v191). File privato: `~/.config/tako-webapp/bot-luisa-20261028/candidate-v193.ts` (sha256 `59c27716…`), istruzioni in `RILASCIO.md` accanto.

## Esito suite
- Vitest completo: 3993 test (base 3973 + 20 nuovi), **279 rossi identici alla base v191** (`bc722b4b`), nessun nuovo rosso.
- Cambi di comportamento voluti, con test aggiornati: `bot-luisa-1023` (5, «scrive malissimo»: elenco senza virgole → proposta + «sì»),
  `owner-brain-svuota-1022` i06/i12/i29 (vocale senza virgole e sottomenu per portata → proposta; «risoto» resta «Risoto»),
  `owner-brain-live-sera-1021` («Risoto ai funghi» non più corretto). I dubbi «funghi misti e peperoni» e «arrosto di vitello e patate»
  restano domande come prima.
- Avvio Deno locale del candidato v192+delta (`verify-candidate-lazy-boot`): PASS.
- Nota ambiente: un worktree nuovo con `pnpm install --offline` non ha i symlink manuali in `node_modules` (drizzle-orm, fastify, zod,
  bcryptjs → apps/server/node_modules) presenti negli altri worktree; senza, 6 file di test non si caricano.

## Rilascio e dati (autorizzati da Manuel la sera del 28/10)
- **v193** (20:10): v192 + correzioni sopra. **v194** (20:20): v193 + correzioni dalla batteria (sotto). Ogni volta: online
  riscaricato e confrontato (hash) prima del deploy, sorgente online riscaricato dopo = candidato. Ricevute e sorgenti di rollback in
  `~/.config/tako-webapp/bot-luisa-20261028/` (v192: `migration-access-20261028/candidate-index.ts`; v193: `candidate-v193-deployed.ts`).
- **Menu Cena di Victoria** riscritto come chiesto da Luisa in chat (API dashboard, controllo revisione, rev 203): Primi Tagliolini cozze e
  pomodori, Gnocchi sorrentina, Orecchiette broccoli e pancetta; Secondi Impepata di cozze, Fritto di anelli con verdure, Scaloppine al
  vino bianco, Nodino alla griglia; Contorni Zucchine trifolate, Insalata mista, Patate al forno. Altri Menu e design identici. Backup
  prima/dopo nella stessa cartella. Menu Giorno non toccato (Luisa ci stava lavorando).
- **Prove dal vivo solo QA** (numero finto, copia del menu di Victoria, firma Twilio, modello vero): due copioni, tutto come atteso, PDF
  scaricato (200, application/pdf). QA ripristinato identico al salvataggio, numero finto scollegato.

## Batteria «prossimi problemi» (56 conversazioni nel route vero) → corretti in v194
Sottomenu già vuoto senza contesto; «grazie» che faceva perdere il contesto; refuso «elimna»; «no sono 3: a, b, c» letto come «no»;
proposta che univa «tagliata orata al forno»; PDF di due Menu nello stesso messaggio. Tutti in `tests/bot-luisa-1028.test.ts` (31 casi).
Scelta: dopo un inserimento il contesto NON si riattiva (il prossimo «inserisci» senza sottomenu chiede conferma): meglio una domanda che
un piatto nel sottomenu sbagliato. Suite: 4004 test, 279 rossi identici alla base.

## Limiti noti
- Comandi su singoli piatti («togli le scaloppine», «il pollo è finito») passano dal modello: non coperti da questa batteria.
- Contorni: «patate e zucchine al forno» = due piatti (regola del 23/10 per i Contorni).
- Elenco senza virgole = una conferma in più per Luisa.
