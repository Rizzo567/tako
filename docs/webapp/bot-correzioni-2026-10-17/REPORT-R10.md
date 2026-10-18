# REPORT R10: nomi pubblici delle sezioni, domande che usano il testo, gemello spostato (agente R7, 18/10/2026)

**Esito: online v116** (ezbr `86a4eba35deacca459a88c7cd6108650d99b8fc407f706b67829a9c08e379322`), deployato da R7b il 18/10 sera dopo il rinnovo del token. Rollback v115 pronto. Dettagli nelle note 93–104.

## Diagnosi (QA, 16:02–16:10 UTC, v115)
- 16:05–16:06: «Altre proposte» è il nome che la pagina pubblica (`macroCategoryGroups`) dà a «Piatti di prova». La scheda del modello aveva solo i nomi del DB. Così sono uscite «Quale sezione…?», «Quali piatti…?», «Non esiste…», senza nessun controllo che la domanda ignorasse il testo.
- 16:03–16:05: rispondendo «confermo» il ragù è stato aggiornato ma non spostato: né le opzioni né un vincolo chiedevano di spostarlo nella sezione detta.

## Fix
1. Nella scheda il nome pubblico compare quando il titolare lo usa: `# c1 Piatti di prova (pubblico: Altre proposte)`. Viene da una copia generata del file web, con un test di parità.
2. «tutti i piatti di X» copre tutte le sezioni che cadono in X. Un sottoinsieme viene rifiutato con l'elenco di quelli mancanti. Oltre 3 modifiche serve sempre l'OK.
3. Una domanda che ignora la sezione detta o «tutti», o che dice «non esiste» su un nome pubblico, torna al modello col motivo «il titolare ha già detto: …» (massimo 3 chiamate). Se la sezione non esiste, la domanda deve dirlo ed elencare le sezioni. Altrimenti si aggiunge il fatto «Sezioni del menu: …».
4. «aggiornalo» su un piatto che c'è già: se è in un'altra sezione deve anche avere `move_item` verso la sezione detta.

## Numeri
| batteria | esito |
|---|---|
| R10 nuova (181) | oracolo 181/181 0 GRAVI 0 MEDI; off / avversario 0 GRAVI di sicurezza; senza guardie 127 GRAVI |
| fix-a, fix-b, X, Y, Z, R8, banco E, banco vero, V | tabelle identiche |
| R9 | attese con lo spostamento: 185/185; avversario 1 MEDIO in meno |
| suite | 14 rossi noti, nome per nome |

## Deploy (R7b)
check-active 115 passato → build `2bf4fc5c…` da 947f210 → diff per sezioni: owner-brain-r/context/plan, routes/twilio-menu, nuovi menu-public-groups e owner-brain-sections (owner-brain-memory solo rinomina esbuild `STOP2`) → `deploy-projection.mjs` PASS → check-active 116 passato. Cervello acceso solo sul QA, `tako_whatsapp_errors` 56→56.

## Prova live sul QA (v116, solo TwiML, mittente fittizio collegato al QA e poi rimosso)
| # | messaggio | latenza | risposta | scrittura |
|---|---|---|---|---|
| a1 | vocale 16:03 «Nei primi aggiungi pesto, ragù, carbonara, riso giallo…» | 7,4 s | «Spostato "pasta al ragù" nei Primi…» (nessuna domanda) | ragù spostato in Primi; gli altri 3 erano già in Primi allo stesso prezzo |
| a2 | «aggiornali» | 2,7 s | «momentaneamente non disponibile» (rate limit Groq al minuto) | nessuna |
| b1 | vocale 16:05 «Togli tutti i piatti dalla sezione altre proposte» | 5,5 s | riepilogo numerato dei 4 piatti visibili di Piatti di prova, «da confermare con OK»; nessun «quale sezione» | nessuna, proposta in attesa |
| b2 | «ok» | 4,8 s | elenco dei 4 nascosti (ma comincia con «Confermi le modifiche?») | 4 piatti nascosti |

- (a) Sullo stato attuale del QA la domanda «lo aggiorno…?» non serve: prezzo e visibilità del ragù erano già quelli detti, quindi il bot lo sposta e basta (nota 62). La domanda attesa non è stata verificata dal vivo.
- (b) Il fix R10 funziona dal vivo.
- Twilio: 0 risposte del bot verso Manuel e verso il numero fittizio. È partito però 1 messaggio a Manuel (21:09 UTC): l'avviso automatico giornaliero «82% del limite giornaliero», fatto scattare dal consumo della prova.
- QA ripristinato per hash in tutte e due le corse (bozza/pubblicato `ff26d477…`, pubblico `b065edd2…`). Link fittizio rimosso. Victoria: rev 29, hash `51639d37…` prima e dopo; il link di Manuel resta su Victoria.
- Token sulla chiave del bot: **25.657**, oltre il tetto di 15k (la guardia conta 6k a turno, l'OK ne è costato ~8,3k).

## Aperti
- Testo della risposta all'OK: comincia con «Confermi le modifiche?» anche dopo aver applicato.
- La domanda del caso (a) va riprovata su uno stato del QA in cui il ragù abbia un prezzo diverso.
- La guardia token dello script va portata a ~9k a turno.
