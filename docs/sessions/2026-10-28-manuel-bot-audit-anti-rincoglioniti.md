# 28/10/2026 notte — Manuel — audit «chat anti-rincoglioniti» del bot WhatsApp

Richiesta Manuel: trovare e prevenire ogni tipo di bug in chat (usabile da un bambino e da un anziano). Online **v196** (21:56),
ramo `codex/manuel-bot-luisa-1028`. Base online prima: v194. Rilasci da bundle online + delta (merge a tre vie, hash verificati prima e
dopo). Rollback: `~/.config/tako-webapp/bot-luisa-20261028/candidate-v195-deployed.ts` (v195), `candidate-v194-deployed.ts` (v194).

## Come
6 batterie indipendenti sul route vero (DB e modello finti): scrittura difficile, flusso/conferme, operazioni, domande/PDF, poi
«falsi positivi» e «nuovi buchi» dopo le correzioni (~2.000 conversazioni). Due prove dal vivo SOLO sul QA (numero finto, copia del
menu di Victoria, modello Haiku vero), QA ripristinato identico e numero scollegato. Test fissi: `tests/bot-audit-1028.test.ts` (168).
Suite: 4172 test, 279 rossi identici alla base v191, nessuno nuovo.

## Corretti (gravi = scrivevano sul menu pubblico)
- GRAVE: dopo «elimina X» qualunque risposta diventava un piatto («un attimo», «boh», «noo», «Marco», «non lo so», «torna indietro»…).
  Ora: cortesie/attese tengono il sottomenu; nomi senza parole da cibo (`food-words.ts`) non si scrivono in silenzio.
- GRAVE: domande o commenti che modificavano: «i secondi del menu sera sono spariti» (svuotava + piatto «Spariti»), «posso/come faccio/
  potrei aggiungere…», «il completo costa 20 vero» (cambiava il prezzo), «volevo… ma non so come».
- GRAVE: «In quale Menu?» / «Elimino il Menu intero?» consumati da un comando qualsiasi; un «sì» dopo «grazie»/«anzi no»/un PDF
  eliminava il Menu o i dolci. Ora la richiesta decade.
- GRAVE: pezzi di comando nei nomi («Salsiccia e mandami il pdf», «Suo posto la salsiccia», «Anzi», «Descrizione al nodino»), due
  comandi in un messaggio, «cambia la coppa con la coppa» che ricreava il piatto, «togli X e metti Y» alla carta che creava X.
- GRAVE: «togli tutto dal menu alla carta» eliminava 105 piatti senza «sì» (ora chiede); «inserisci X e svuota Y» (ora: una cosa alla volta).
- GRAVE: due Menu nello stesso «elimina» (toccava solo la Cena); dopo «svuota il menu» o «elimina primi e contorni» tutto finiva nei Primi.
- «del giorno»/«pranzo» dentro un nome mandavano il piatto nel Menu Giorno; «al secondo sugo», «con contorno» spezzavano il nome.
- Verbi storpiati (insersci, aggingi, in serisci), saluti intorno al comando, «virgola/punto» a voce, «/» tra spazi, «elimna», «annula».
- Proposte: correzioni dopo «no», «X no», «sì ma…», «sì mettili», stesso messaggio due volte, «nei secondi» = sposta, «due», «ok?».
- Prezzi delle opzioni a parole con decimali («diciassette e cinquanta», «12 e mezzo»), negativi rifiutati.
- PDF: risposta a «Quale menu?» (nome, numero, «tutti»), «tutti i menu», «anteprima», «foto del menu», «menu da 12», etichette senza
  «Menu Drinks», niente PDF finto per «senza i primi/di ieri/per email/è vecchio».
- «c'è la X (nel menu Y)?» risponde dal menu; «cosa c'è stasera» senza dieci righe «senza prezzo»; messaggi >2000 caratteri ora hanno
  una risposta; nomi in MAIUSCOLO normalizzati; «purè» non sparisce; «pollo fritto», «orata o branzino» non spezzati.
- Falsi positivi delle protezioni (seconda verifica): «spaghetti alla buona», «provola», «polpette della mamma», «pesto di mandorle»,
  «tagliatelle della domenica», «patate con aggiunta di rosmarino», «orata/branzino», «sì sì eliminali», «il completo a 18 come il pranzo».

## Restano (non scrivono dati sbagliati, o vanno al modello)
- «il nodino è tornato» chiede tra piatti di più Menu (percorso del modello; niente scritto).
- «annulla» torna indietro di un solo passo.
- Contorni: «funghi e piselli, patate e peperoni» = 4 piatti (regola del 23/10 per i Contorni).
- «sostituisci il pollo con il tacchino» sceglie da solo «pollo al forno» se è l'unico nel Menu a prezzo fisso.
- Dopo il primo inserimento il contesto resta, ma un piatto con portata chiaramente diversa chiede conferma.
- Comandi su piatti singoli (finito, prezzi alla carta, rinomina, nascondi) dipendono dal modello: provati dal vivo i principali, ok.
