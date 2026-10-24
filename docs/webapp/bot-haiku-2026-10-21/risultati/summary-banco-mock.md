# Motore Haiku · set banco · mock

Generato da tests/eval/eval-haiku.test.ts (2026-10-20T23:12:14.639Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **37/92 (40.2%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 55 |
| Domande ogni 10 messaggi | 10 (non attese 8.5) |
| Latenza chiamata Haiku p50 / p95 | 0 / 0 ms (149 chiamate) |
| Latenza turno p50 / p95 | 8 / 14 ms (harness + latenza Haiku registrata) |
| Chiamate Haiku per messaggio | 1 |
| Token medi per messaggio (in · out · cache read · cache write) | 62 · 120 · 2111 · 0 |
| Cache hit (cache_read > 0) | 149/149 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.5 $) |
| Costo equivalente dal vivo · per messaggio | 0.013004 $ · 0.000087 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 0 · 0 · 149 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 2.7 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 55 | 0 |
| risposta-non-pertinente | 0 | 0 | 11 |

## Falliti (trascrizione)

### bv-semplici-001 [MEDIO] — protocollo vecchio con CONFERMA: oggi il bot scrive subito, «conferma» non deve cambiare nulla
- titolare: prezzo Piatto di verifica a 9
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: conferma
  - bot: «Quale piatto intendi?»
- atteso: price|Piatto di verifica|9 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Piatto di verifica|9

### bv-semplici-002 [MEDIO]
- titolare: prezzo Piatto di verifica a 12
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: conferma
  - bot: «Quale piatto intendi?»
- atteso: price|Piatto di verifica|12 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Piatto di verifica|12

### bv-semplici-003 [MEDIO]
- titolare: 🎤 Nascondi il polpo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: conferma
  - bot: «Quale piatto intendi?»
- atteso: hidden|Polpo rucola e patate|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Polpo rucola e patate|true

### bv-semplici-004 [MEDIO]
- titolare: 🎤 Mostra il polpo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 Confirma.
  - bot: «Quale piatto intendi?»
- atteso: hidden|Polpo rucola e patate|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Polpo rucola e patate|false

### bv-semplici-005 [MEDIO]
- titolare: A Bruschetta Victoria un c'è cchiù
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Bruschetta Victoria|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Bruschetta Victoria|false

### bv-semplici-006 [MEDIO]
- titolare: 🎤 Aggiungi tra piatti di prova, pasta al ragù, 12 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: create|pasta al ragu|12|piatti di prova · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al ragu|12|piatti di prova

### bv-semplici-007 [MEDIO]
- titolare: il piatto di verifica costa 13 euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Piatto di verifica|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Piatto di verifica|13

### bv-semplici-008 [MEDIO]
- titolare: il piatto di verifica è finito
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Piatto di verifica|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Piatto di verifica|false

### bv-semplici-009 [MEDIO]
- titolare: il piatto di verifica è tornato disponibile
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Piatto di verifica|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Piatto di verifica|true

### bv-semplici-010 [MEDIO]
- titolare: nascondi il piatto di verifica
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: hidden|Piatto di verifica|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Piatto di verifica|true

### bv-semplici-011 [MEDIO]
- titolare: mostra il piatto di verifica
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: hidden|Piatto di verifica|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Piatto di verifica|false

### bv-semplici-012 [MEDIO] — nome detto «Piatto test QA»: il nome nuovo è quello detto letteralmente (decisione 18/10, nota 62); il bot vero aveva cr
- titolare: aggiungi nella categoria Piatti di prova il piatto Piatto test QA a 9 euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: create|piatto test qa|9|piatti di prova · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|piatto test qa|9|piatti di prova

### bv-semplici-013 [MEDIO]
- titolare: metti il piatto di verifica a tredici euro e cinquanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Piatto di verifica|13.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Piatto di verifica|13.5

### bv-semplici-014 [MEDIO] — «Passa il ragù» = «pasta al ragù» storpiato da Whisper
- titolare: 🎤 Passa il ragù, metti prezzo a 20 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|pasta al ragù|20 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|pasta al ragù|20

### bv-semplici-015 [MEDIO] — risposta vera: «Non ho capito cosa cambiare per boh»
- titolare: 🎤 Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|boh|50 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|boh|50

### bv-semplici-016 [MEDIO] — una sola categoria: va usata
- titolare: 🎤 Aggiungi il piatto pasta al sugo a 12 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: create|pasta al sugo|12|piatti di prova · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al sugo|12|piatti di prova

### bv-semplici-017 [MEDIO]
- titolare: 🎤 Vai, nascondi la pasta del ragù.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: hidden|pasta al ragù|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|pasta al ragù|true

### bv-semplici-018 [MEDIO]
- titolare: La Bruschetta Victoria la xe finia
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Bruschetta Victoria|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Bruschetta Victoria|false

### bv-semplici-019 [MEDIO]
- titolare: La Bruschetta Victoria l'è finida
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Bruschetta Victoria|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Bruschetta Victoria|false

### bv-semplici-020 [MEDIO]
- titolare: Boia, mettimi la Bruschetta Victoria a dodici euri
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Bruschetta Victoria|12 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Bruschetta Victoria|12

### bv-domande-010 [MEDIO] — «non cambiare boh» è una negazione, non un piatto da scegliere; il turno 2 risponde alla domanda vera del bot
- titolare: non cambiare boh; metti il piatto di verifica a tredici euro e cinquanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: Piatto di verifica
  - bot: «Quale piatto intendi?»
- atteso: price|Piatto di verifica|13.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Piatto di verifica|13.5

### bv-multiple-001 [MEDIO]
- titolare: La Pasta collaudo mettila a undici euro, la Pizza collaudo a tredici euro e il Tiramisu collaudo a sei euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Pasta collaudo|11, price|Pizza collaudo|13, price|Tiramisu collaudo|6 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Pasta collaudo|11, price|Pizza collaudo|13, price|Tiramisu collaudo|6

### bv-multiple-002 [MEDIO] — risposta vera al turno 2 (prima prova): «Non ho capito bene»
- titolare: La Pasta collaudo mettila a quattordici euro, la Pizza collaudo a sedici euro, il Tiramisu collaudo a sette euro e l’Acqua collaudo a tre euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: Per la Pasta collaudo fai quindici euro, non quattordici. Lascia il prezzo dell’Acqua collaudo com’è. Mantieni le altre modifiche.
  - bot: «Quale piatto intendi?»
- titolare: OK
  - bot: «Quale piatto intendi?»
- atteso: price|Pasta collaudo|15, price|Pizza collaudo|16, price|Tiramisu collaudo|7 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Pasta collaudo|15, price|Pizza collaudo|16, price|Tiramisu collaudo|7

### bv-multiple-003 [MEDIO] — il secondo OK non ha niente da confermare
- titolare: La Pasta collaudo mettila a quattordici euro, la Pizza collaudo a sedici euro, il Tiramisu collaudo a sette euro e l’Acqua collaudo a tre euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: Per la Pasta collaudo fai quindici euro, non quattordici. Lascia il prezzo dell’Acqua collaudo com’è. Mantieni le altre modifiche.
  - bot: «Quale piatto intendi?»
- titolare: OK
  - bot: «Quale piatto intendi?»
- titolare: OK
  - bot: «Quale piatto intendi?»
- atteso: price|Pasta collaudo|15, price|Pizza collaudo|16, price|Tiramisu collaudo|7 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Pasta collaudo|15, price|Pizza collaudo|16, price|Tiramisu collaudo|7

### bv-multiple-004 [MEDIO]
- titolare: metti Piatto di verifica a 14 euro, Che ne sacc a 21 euro, boh a 21 euro e pasta al ragù a 13 euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: ok va bene
  - bot: «Quale piatto intendi?»
- atteso: price|Che ne sacc|21, price|Piatto di verifica|14, price|boh|21, price|pasta al ragù|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Che ne sacc|21, price|Piatto di verifica|14, price|boh|21, price|pasta al ragù|13

### bv-multiple-005 [MEDIO]
- titolare: metti Che ne sacc a 20 euro, boh a 20 euro e pasta al ragù a 12 euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Che ne sacc|20, price|boh|20, price|pasta al ragù|12 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Che ne sacc|20, price|boh|20, price|pasta al ragù|12

### bv-multiple-006 [MEDIO] — prezzi detti (ognuno +1 €): un solo comando sul gruppo → si applica subito con riepilogo numerato, niente domanda (decis
- titolare: aumenta tutti i piatti della categoria Piatti di prova di un euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Che ne sacc|21, price|Piatto di verifica|14.5, price|boh|21, price|pasta al ragù|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Che ne sacc|21, price|Piatto di verifica|14.5, price|boh|21, price|pasta al ragù|13

### bv-multiple-007 [MEDIO] — «la parmigiana» = l'unico piatto con parmigiana; kenesac = Che ne sacc
- titolare: 🎤 Allora, voglio che mi nascondi la parmigiana tra i piatti del menù e mi metti in sconto il kenesac a 12 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: hidden|Inserisce il piatto la parmigiana|true, promo|Che ne sacc|12 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Inserisce il piatto la parmigiana|true, promo|Che ne sacc|12

### bv-multiple-008 [MEDIO]
- titolare: 🎤 Allora, voglio che mi nascondi la parmigiana tra i piatti del menù e mi metti in sconto il kenesac a 12 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 Allora, voglio che mi nascondi dal menù il piatto la parmigiana e invece mi metti in promo il piatto di verifica a 11 euro.
  - bot: «Quale piatto intendi?»
- atteso: hidden|Inserisce il piatto la parmigiana|true, promo|Che ne sacc|12, promo|Piatto di verifica|11 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Inserisce il piatto la parmigiana|true, promo|Che ne sacc|12, promo|Piatto di verifica|11

### bv-multiple-009 [MEDIO] — risposta vera: «Non ho capito la richiesta»
- titolare: 🎤 Allora nel piatto Bo cambia la descrizione e metti Joe fa schifo, invece nel piatto Kenesac metti la promo a 12 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: description|boh|joe fa schifo, promo|Che ne sacc|12 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: description|boh|joe fa schifo, promo|Che ne sacc|12

### bv-correzioni-001 [MEDIO] — «toiibo» incerto al turno 1 (domanda), le parti chiare si pubblicano; risposta vera al turno 2: boh «finito» invece di n
- titolare: 🎤 Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toiibo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 No, ho detto togli boh.
  - bot: «Quale piatto intendi?»
- titolare: 🎤 Sì, ma ti avevo detto che dovevi aggiungere il piatto, la parmigiana a 10 euro e il tiramisù a 6 euro.
  - bot: «Quale piatto intendi?»
- atteso: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true

### bv-correzioni-002 [MEDIO]
- titolare: 🎤 Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toiibo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 No, ho detto togli boh.
  - bot: «Quale piatto intendi?»
- atteso: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true

### bv-correzioni-003 [MEDIO] — «la parmigiana» è il nome esatto (l'altro è nascosto); risposta vera: «Quale piatto intendi… Riscrivimi»
- titolare: 🎤 Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|la parmigiana|15, promo|tiramisù|3 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, promo|tiramisù|3

### bv-correzioni-004 [MEDIO] — il turno 2 corregge: tiramisù a prezzo pieno 10, niente promo
- titolare: 🎤 Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Quale piatto intendi?»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, price|tiramisù|10

### bv-correzioni-005 [MEDIO]
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, price|tiramisù|10

### bv-correzioni-006 [MEDIO] — AMBIGUO: turno 1 «pasta al pesto e lasagna» uno o due piatti, senza prezzo; turno 2 due piatti senza prezzo. Risposta ve
- titolare: 🎤 Allora aggiungi il piatto pasta al pesto e lasagna.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 No, pasta al pesto e lasagna sono due piatti separati.
  - bot: «Quale piatto intendi?»
- titolare: 🎤 Uno deve essere a 10 euro e uno deve essere a 20 euro.
  - bot: «Quale piatto intendi?»
- atteso: create|lasagna|20|piatti di prova, create|pasta al pesto|10|piatti di prova · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|lasagna|20|piatti di prova, create|pasta al pesto|10|piatti di prova

### bv-deixis-001 [MEDIO] — parmigiana e tiramisù ci sono già a 10 e 6: non duplicarli
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 Ok, cambia i prezzi di quei due prodotti e mettili entrambi a 15 euro.
  - bot: «Quale piatto intendi?»
- atteso: hidden|boh|true, price|la parmigiana|15, price|tiramisù|15 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|boh|true, price|la parmigiana|15, price|tiramisù|15

### bv-deixis-002 [MEDIO] — «rimuovi completamente» = eliminare: si cancella solo dopo «sì», quindi al turno 3 domanda di conferma e niente scrittur
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 Ok, cambia i prezzi di quei due prodotti e mettili entrambi a 15 euro.
  - bot: «Quale piatto intendi?»
- titolare: 🎤 Ok, adesso rimuovi completamente quei due piatti.
  - bot: «Quale piatto intendi?»
- atteso: hidden|boh|true, price|la parmigiana|15, price|tiramisù|15 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|boh|true, price|la parmigiana|15, price|tiramisù|15

### bv-deixis-003 [MEDIO]
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: hidden|boh|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|boh|true

### bv-aggiunte-001 [MEDIO] — risposta vera al turno 2: «Non trovo «aggiungi tra piatti di prova il piatto pasta al ragu che»»
- titolare: aggiungiamo un piatto
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 Aggiungi tra piatti di prova il piatto pasta al ragù che costa 15 euro.
  - bot: «Quale piatto intendi?»
- atteso: create|pasta al ragu|15|piatti di prova · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al ragu|15|piatti di prova

### bv-aggiunte-002 [MEDIO]
- titolare: 🎤 Aggiungi tra piatti di prova il piatto pasta al ragù che costa 15 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: create|pasta al ragu|15|piatti di prova · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al ragu|15|piatti di prova

### bv-aggiunte-003 [MEDIO] — prezzo assente fino al turno 3: domande; risposta vera: piatto «Inserisce il piatto la parmigiana»
- titolare: 🎤 Inserisce il piatto la parmigiana.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 Inserisci un nuovo piatto, si chiama parmigiana.
  - bot: «Quale piatto intendi?»
- titolare: 🎤 12 euro
  - bot: «Quale piatto intendi?»
- atteso: create|parmigiana|12|piatti di prova · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|parmigiana|12|piatti di prova

### bv-elimina-001 [MEDIO] — «cancellare» → chiedere conferma dell'eliminazione; Manuel poi sceglie di nascondere
- titolare: 🎤 Puoi cancellare il polpo?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 Nascondi il polpo.
  - bot: «Quale piatto intendi?»
- titolare: conferma
  - bot: «Quale piatto intendi?»
- atteso: hidden|Polpo rucola e patate|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Polpo rucola e patate|true

### bv-elimina-003 [MEDIO] — elimina → conferma; poi «nascondi» vince
- titolare: 🎤 Elimina il piatto pasta al ragù.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 Vai, nascondi la pasta del ragù.
  - bot: «Quale piatto intendi?»
- atteso: hidden|pasta al ragù|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|pasta al ragù|true

### bv-elimina-005 [MEDIO] — nome letterale «Piatto test QA» (nota 62); togli = nascondi; annulla = torna visibile (il giudice vede solo la creazione
- titolare: aggiungi nella categoria Piatti di prova il piatto Piatto test QA a 9 euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: togli il piatto Test QA
  - bot: «Quale piatto intendi?»
- titolare: annulla
  - bot: «Quale piatto intendi?»
- atteso: create|piatto test qa|9|piatti di prova · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|piatto test qa|9|piatti di prova

### bv-categorie-001 [MEDIO] — il ragù esistente va nei Primi (nota 62: prezzo 10 accettato, non richiesto perché la domanda sul ragù è rimasta senza r
- titolare: 🎤 E aggiungi pasta al ragù a 10 euro, aggiungi pasta al pesto a 15 euro, aggiungi caviale a 150 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 No, fai una cosa, aggiungi un'altra categoria, ovvero primi, e lì aggiungi quei due piatti che ti ho detto, invece il caviale aggiungere un'altra categoria ancora, chiamandola speciali.
  - bot: «Quale piatto intendi?»
- atteso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi

### bv-categorie-002 [MEDIO] — risposta vera: «Le categorie si creano dalla dashboard»
- titolare: 🎤 Ok, adesso devi creare un'altra categoria che si chiama "primi pasti".
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: section|primi pasti · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: section|primi pasti

### bv-categorie-003 [MEDIO]
- titolare: 🎤 Aggiungi il piatto pasta al sugo a 12 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 Ok, adesso devi creare un'altra categoria che si chiama "primi pasti".
  - bot: «Quale piatto intendi?»
- atteso: create|pasta al sugo|12|piatti di prova, section|primi pasti · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al sugo|12|piatti di prova, section|primi pasti

### bv-annulla-008 [MEDIO] — sessione intera 10:32–10:45
- titolare: ❓ quanto costa il piatto di verifica?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: il piatto di verifica costa 13 euro
  - bot: «Quale piatto intendi?»
- titolare: il piatto di verifica è finito
  - bot: «Quale piatto intendi?»
- titolare: il piatto di verifica è tornato disponibile
  - bot: «Quale piatto intendi?»
- titolare: ❓ piatto di verifica 13 o 14?
  - bot: «Quale piatto intendi?»
- titolare: ❓ cosa è finito?
  - bot: «Quale piatto intendi?»
- atteso: price|Piatto di verifica|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Piatto di verifica|13
- **BASSO** risposta-non-pertinente: risposta finale senza /disponibil|nessun|tutti/i

### bv-dialetto-001 [MEDIO]
- titolare: Uè, a Bruschetta Victoria nun ce sta cchiù
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Bruschetta Victoria|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Bruschetta Victoria|false

### bv-dialetto-003 [MEDIO]
- titolare: A Bruschetta Victoria nun è fernuta, ce sta ancora
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Bruschetta Victoria|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Bruschetta Victoria|true

### bv-asr-001 [MEDIO] — AMBIGUO: «da domani» → il bot non programma: chiedere se cambiarlo subito; «Confirma» (Whisper) = sì
- titolare: 🎤 Il piatto di verifica da domani costa 13,50 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 Confirma.
  - bot: «Quale piatto intendi?»
- titolare: 🎤 Confirma.
  - bot: «Quale piatto intendi?»
- titolare: conferma
  - bot: «Quale piatto intendi?»
- atteso: price|Piatto di verifica|13.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Piatto di verifica|13.5

### bv-asr-003 [MEDIO] — dopo «Bo» a 50, «Bu costa 40» corregge lo stesso piatto
- titolare: 🎤 Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 Bu costa 40 euro
  - bot: «Quale piatto intendi?»
- atteso: price|boh|40 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|boh|40

### bv-asr-004 [MEDIO] — R5.1 (nota 63): l'attesa chiedeva insieme una domanda senza scritture e la rinomina nello stesso turno (impossibile): re
- titolare: 🎤 Cambia il nome del piatto, inserisci la parmigiana.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: rename|Inserisce il piatto la parmigiana|la parmigiana · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|Inserisce il piatto la parmigiana|la parmigiana

### bv-asr-005 [MEDIO] — sessione 13:16–13:18 intera
- titolare: 🎤 Quanto costa la pasta al ragù?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 Quanto costa il piatto boh?
  - bot: «Quale piatto intendi?»
- titolare: 🎤 Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?
  - bot: «Quale piatto intendi?»
- titolare: 🎤 Bu costa 40 euro
  - bot: «Quale piatto intendi?»
- titolare: 🎤 Passa il ragù, metti prezzo a 20 euro.
  - bot: «Quale piatto intendi?»
- atteso: price|boh|40, price|pasta al ragù|20 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|boh|40, price|pasta al ragù|20

### bv-semplici-021 [BASSO]
- titolare: ❓ quanto costa il piatto di verifica?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /13,50/

### bv-semplici-023 [BASSO]
- titolare: 🎤 Quanto costa la pasta al ragù?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /12/

### bv-semplici-024 [BASSO]
- titolare: 🎤 Quanto costa il piatto boh?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /20/

### bv-semplici-025 [BASSO]
- titolare: ❓ Aò, quanto viene la Bruschetta Victoria?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /8/

### bv-semplici-026 [BASSO]
- titolare: 🎤 Tagliata rucola e grana, quanto costa?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /20/

### bv-domande-001 [BASSO] — tre tagliate: elencarle con i prezzi va bene quanto chiedere
- titolare: 🎤 Quanto costa la tagliata?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 Tagliata rucola e grana, quanto costa?
  - bot: «Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /20/

### bv-domande-003 [BASSO]
- titolare: 🎤 Quanto costa la tagliata
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /20/

### bv-domande-005 [BASSO] — collegato a Victoria Bar dal 14/10 19:26
- titolare: ❓ Ciao! A quale locale sono collegato e cosa puoi fare?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /victoria/i

### bv-domande-006 [BASSO] — risposta vera fuori tema («Posso dirti prezzi…»)
- titolare: ❓ ciao
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: ❓ che locale ho?
  - bot: «Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /verifica web/i

### bv-domande-008 [BASSO]
- titolare: 🎤 Ok, adesso dimmi cosa è finito.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 Ok, allora mi devi dire quali piatti ho nascosto, per favore.
  - bot: «Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /ragù/i

