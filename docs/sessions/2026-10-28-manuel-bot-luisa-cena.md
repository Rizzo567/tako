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

## Deploy
Non eseguito: AGENTS.md vieta deploy di produzione impliciti e questo incarico autorizza il fix, non il rilascio. Unico passaggio:
riscaricare la funzione online e verificare che sia ancora v192 (`ezbr 995a40da…`, sorgente `d4c9de9d…`), poi deploy del candidato con
`magick-wasm-0.0.44.js` invariato e controllo della nuova versione ACTIVE. Se l'online non è più v192: rifare il merge sulla nuova base.
