# Bot titolare: correzioni dal collaudo WhatsApp del 17/10. Esito

Branch `codex/qa-whatsapp-1017`, base `3c09c11`. Online ora c'è l'**edge operativa v108** (`f6f1e4bb959f877b3f977f004d088417dd9f45402c25c01b99998fb00642d8e5`); prima c'era v107 (`5f57d25d…`).
Non ho toccato takomenu-public, read-edge, takomenu-web né l'SQL.

## I 4 bug: causa e correzione
1. **«piatto di verifica 13 o 14?» rispondeva col prezzo attuale.**
   - Causa: `priceChoiceText` riconosceva l'alternativa solo senza «?», solo con un verbo (metti, costa…) e solo col nome completo del piatto. Tutto il resto diventava una lettura.
   - Correzione: nuovo `twilio-menu-clarify.ts`. Riconosce «13 o 14», «13 oppure 14», «13/14», «13-14», «tra 13 e 14», anche in lettere («tredici o tredici e cinquanta»), e ignora quantità e orari («per 2 o 3», «happy hour 18-20», «fino al 20/10»). Il bot fa sempre una domanda e non scrive. Con il «?» ricorda il prezzo attuale.
   - Se il piatto è uno solo, la proposta `choose_price` dura 10 minuti: la risposta «14», «quattordici» o «la seconda» la completa.
2. **«non cambiare boh; metti …» chiedeva quale piatto.**
   - Causa: la frase andava all'IA, che modificava giustamente solo Piatto di verifica. Poi il controllo di completezza del validatore vedeva «boh» nominato e non modificato, e chiedeva quale piatto.
   - Correzione: `negatedClauses` riconosce le clausole negate e toglie il piatto dalle modifiche: «non cambiare/toccare X», «lascia stare X», «X no», «tranne/eccetto X», «X resta com'è», «X non si tocca», «niente su X», «X lo lascio a 20», con dialetto e refusi. Il resto del messaggio si elabora da solo, quasi sempre senza IA.
   - L'esclusione arriva anche al validatore e a un filtro finale: un piatto negato non si cambia mai.
3. **Il chiarimento perdeva l'operazione.**
   - Causa: il chiarimento chiesto dopo l'IA non salvava niente, quindi «Piatto di verifica» veniva letto come una domanda.
   - Correzione: se l'IA aveva capito un'azione, il bot salva una proposta `choose` di 10 minuti e la risposta la applica. Valgono un nome, un numero, «tutti e due», o «la carbonara no» per esclusione.
   - Se la risposta non è tra le opzioni, il bot dice di riscrivere la richiesta. Se è un comando nuovo e completo, vale quello.
4. **«il piatto Piatto test QA» diventava «Test QA».**
   - Causa: `parseCreate` toglieva «piatto» all'inizio del nome in ciclo, quindi anche la parola del nome.
   - Correzione: «il piatto» introduttivo si toglie una volta sola. Resta «Piatto» maiuscolo senza articolo, e i nomi tra «» "" “” si prendono così come sono. Si conservano anche apostrofi e virgole decimali. «di nome X» e «un nuovo piatto: X» danno X; «una bibita» chiede il nome.

## I 19 rossi delle 08:35
Non dipendevano dall'ora: erano i BASSI già noti del 16/10, identici nei risultati committati. Ora sono corretti tutti e 19.
- La dipendenza dall'ora c'era davvero, ma nascosta. Alle 03:00 escono 15 GRAVI, perché prima delle 06:00 il bot considera ancora la giornata di ieri mentre il banco usa la data di calendario.
- Ora tutte le batterie hanno l'orologio fissato (`TAKO_TEST_NOW` per provare altri istanti) e passano a qualsiasi ora.
- Nessuna aspettativa indebolita. Ci sono due correzioni del banco, motivate in `implementation-notes.md`.

## Batterie (casi · GRAVI/MEDI/BASSI, il peggiore per caso)
| Batteria | Prima (base) | Dopo |
|---|---|---|
| Round 1 (283) | 0 / 0 / 8 | **0 / 0 / 0** |
| Round 2 (160) | 0 / 0 / 8 | **0 / 0 / 0** |
| Round 3 (141) | 0 / 0 / 2 | **0 / 0 / 0** |
| Round 4 (100) | 0 / 0 / 1 | **0 / 0 / 0** |
| Round 5, mia (189) | — | 0 / 0 / 0 (al primo giro: 4 / 1 / 5) |
| Round 5b, verificatore indipendente (193) | — | 0 / 0 / 0 (al primo giro: 13 / 14 / 5) |
| Round 5c, falsi positivi (186) | 66 casi rossi sulla base | 0 / 0 / 0 (al primo giro: 17 / 22 / 6) |
| Round 5, menu vero del QA (16) | — | 0 / 0 / 0, tutte deterministiche |

Suite completa: base 2090 test, 31 rossi; ora 2678 test, **12 rossi**, tutti già presenti sulla base (`twilio-owner-link` 7, presentation 2, PDF 1, parity 2). **Nessun rosso nuovo.** tsc server verde.

## Gate con Groq vero (in locale, sola lettura, chiave del bot)
4 frasi più 1 ripetuta, **5.942 token** su 15.000. Il gate ha trovato «non cambiare boh, mettilo a 25»: il modello cambiava boh. L'ho corretto e ripetuto, ora passa. Esiti in `live/groq-gate-result*.json`.

## Deploy
v107 → **v108**. Il bundle è quello online più queste sezioni:
- `twilio-menu-copy`, `twilio-menu-nlu`, `menu-sales` (date in lettere), `twilio-menu-ai`, `twilio-menu-create`, `routes/twilio-menu`;
- la sezione nuova `twilio-menu-clarify`.

Le altre 134 sezioni sono identiche byte per byte. Ho rinominato alcuni identificatori, così esbuild non rinomina variabili in altri moduli. check-active (107) fatto prima del deploy.
Rollback a v107:
`cp ~/.config/tako-webapp/rollback-edge-20261017/candidate-index-v107-latenza-a.ts release/serverless/candidate/index.ts && cp ~/.config/tako-webapp/rollback-edge-20261017/magick-wasm-0.0.44.js release/serverless/candidate/ && node scripts/translations/deploy-projection.mjs`
La copia di v108 è in `~/.config/tako-webapp/rollback-edge-20261017/candidate-index-v108-qa-whatsapp.ts`.

## Verifica dal vivo sul QA (`live/verify-live.mjs`, 16/16)
Webhook firmato, con il numero collegato al QA come mittente. Tutte le sequenze sono deterministiche, quindi le risposte sono tornate solo nel TwiML e non è partito nessun messaggio WhatsApp.
- Ho rifatto i 4 casi del report, il caso 2 anche nella sequenza esatta delle 11:09, più 10 varianti.
- Prima di ogni sequenza ho ripristinato il menu. Alla fine ho rimesso il menu, la proposta e la memoria «ultimo» com'erano, e il ripristino è verificato per hash. Groq: zero chiamate.

## Pulizia del QA
Ho eliminato «Test QA» (`c229935f…`) dalla bozza e dal pubblicato, con la mia sessione di login.
- Bozza e pubblicato coincidono con `stato-iniziale.json`: 4 piatti, prezzi, promo, ultime porzioni, descrizioni, categoria.
- In `menu_items` restano le righe spente (`available=false`) di «Test QA» e del «Piatto test QA» della verifica dal vivo, come quelle degli altri 10 piatti eliminati prima. È la regola dello store, e il menu pubblico non le mostra.

## Cosa resta (decisioni per Manuel)
1. «13,50» in risposta a «13 o 14?»: ora il bot ripete la domanda. I due verificatori la pensavano in modo opposto.
2. «ok grazie» e «annulla, no anzi conferma» confermano un riepilogo aperto. È un piccolo allargamento della regola del 16/10.
3. Alle 3 di notte «stasera» e «solo oggi» valgono per la giornata appena finita (regola delle 06:00).
4. Una dettatura tutta minuscola come «aggiungi piatto test qa nei piatti di prova» crea «Test qa»: «piatto» subito dopo il verbo si legge come un'introduzione.
