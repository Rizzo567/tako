# REPORT R10: nomi pubblici delle sezioni, domande che usano il testo, gemello spostato (agente R7, 18/10/2026)

**Esito: corretto nel codice e pushato (7243f5e+). NON deployato: online resta v115** (ezbr `b1830830…`). Il token della Management API di Supabase è stato rifiutato (401). Dettagli nelle note 93–99.

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

## Aperti
- Deploy v116 e prova live: serve un token nuovo in `~/.config/tako-webapp/supabase-management.env`. La procedura è nella nota 99.
- Token spesi: 0. Twilio: nessun invio. QA non toccato.
