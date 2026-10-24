# Motore Haiku · set banco · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T10:20:11.893Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **75/92 (81.5%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 6 — sicurezza 0, altri 6 |
| MEDI | 11 |
| Domande ogni 10 messaggi | 3.2 (non attese 1.9) |
| Latenza chiamata Haiku p50 / p95 | 2590 / 10505 ms (180 chiamate) |
| Latenza turno p50 / p95 | 13 / 27 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.21 |
| Token medi per messaggio (in · out · cache read · cache write) | 272 · 412 · 10279 · 53 |
| Cache hit (cache_read > 0) | 180/180 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.051062 $ · 0.000343 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 180 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 3.6 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 5 | 0 | 0 |
| correzione-non-applicata | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 9 | 0 |
| chiarimento-mancante | 0 | 3 | 0 |
| in-attesa-ok | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 1 |

## Falliti (trascrizione)

### bv-multiple-002 [GRAVE] — risposta vera al turno 2 (prima prova): «Non ho capito bene»
- titolare: La Pasta collaudo mettila a quattordici euro, la Pizza collaudo a sedici euro, il Tiramisu collaudo a sette euro e l’Acqua collaudo a tre euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Confermi *Pasta collaudo* a 14 €, *Pizza collaudo* a 16 €, *Tiramisu collaudo* a 7 € e *Acqua collaudo* a 3 €? 1. *Pasta collaudo* (11,00 €) 2. *Pizza collaudo* (13,00 €) 3. *Tiramisu collaudo* (6,00 €) 4. *Acqua collaudo* (2,00 €)»
- titolare: Per la Pasta collaudo fai quindici euro, non quattordici. Lascia il prezzo dell’Acqua collaudo com’è. Mantieni le altre modifiche.
  - bot: «Non ho cambiato nulla. Non ancora pubblicato: 1. *Pasta collaudo*: prezzo da 11,00 € a *15,00 €* «Pizza collaudo»: 1. *Pizza collaudo* (13,00 €) 2. *Pasta collaudo* (11,00 €) 3. *Tiramisu collaudo* (6,00 €) 4. *Acqua collaudo* (2,00 €) «Tiramisu collaudo»: 1. *Tiramisu collaudo* (6,00 €) 2. *Pasta collaudo* (11,00 €) 3. *Pizza collaudo* (13,00 €) 4. *Acqua collaudo* (2,00 €)»
- titolare: OK
  - bot: «Ok, pubblico la modifica di *Pasta collaudo* a 15 €. *Pasta collaudo*: prezzo da 11,00 € a *15,00 €*»
- atteso: price|Pasta collaudo|15, price|Pizza collaudo|16, price|Tiramisu collaudo|7 · ottenuto: price|Pasta collaudo|15
- **GRAVE** non-applicato: non applicato: price|Pizza collaudo|16, price|Tiramisu collaudo|7

### bv-correzioni-002 [GRAVE]
- titolare: 🎤 Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toiibo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla.»
- titolare: 🎤 No, ho detto togli boh.
  - bot: «Ok, tolgo *boh* dal menu. *boh*: *nascosto* dal menu»
- atteso: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true · ottenuto: hidden|boh|true
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
- **GRAVE** non-applicato: non applicato: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova

### bv-correzioni-004 [GRAVE] — il turno 2 corregge: tiramisù a prezzo pieno 10, niente promo
- titolare: 🎤 Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Il *Tiramisù* lo metto in promo. Quale *parmigiana* intendi, quella nascosta o l'altra? Non ancora pubblicato: 1. *tiramisù*: in *promo* a *3,00 €* (prezzo pieno 6,00 €), finché non la togli «la parmigiana»: 1. *Inserisce il piatto la parmigiana* (12,00 €) 2. *la parmigiana* (10,00 €)»
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Non ho cambiato nulla. Non ancora pubblicato: 1. *tiramisù*: prezzo da 6,00 € a *10,00 €*»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: price|la parmigiana|15, price|tiramisù|10

### bv-deixis-001 [GRAVE] — parmigiana e tiramisù ci sono già a 10 e 6: non duplicarli
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Tolgo *boh* dal menu e metto il *tiramisù* a 6 €. C'è già *la parmigiana* a 10 €: la lascio così o ne creo un altro?»
- titolare: 🎤 Ok, cambia i prezzi di quei due prodotti e mettili entrambi a 15 euro.
  - bot: «Ok, metto *la parmigiana* e il *tiramisù* a 15 €. *la parmigiana*: prezzo da 10,00 € a *15,00 €* *tiramisù*: prezzo da 6,00 € a *15,00 €*»
- atteso: hidden|boh|true, price|la parmigiana|15, price|tiramisù|15 · ottenuto: price|la parmigiana|15, price|tiramisù|15
- **GRAVE** non-applicato: non applicato: hidden|boh|true

### bv-asr-003 [GRAVE] — dopo «Bo» a 50, «Bu costa 40» corregge lo stesso piatto
- titolare: 🎤 Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Cambio il prezzo di *boh* da 20 a 50 €. *boh*: prezzo da 20,00 € a *50,00 €*»
- titolare: 🎤 Bu costa 40 euro
  - bot: «Intendi il piatto *boh* per portarlo a *40 €*?»
- atteso: price|boh|40 · ottenuto: price|boh|50
- **GRAVE** correzione-non-applicata: resta la modifica poi corretta/annullata: price|boh|50
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|boh|40

### bv-asr-005 [GRAVE] — sessione 13:16–13:18 intera
- titolare: 🎤 Quanto costa la pasta al ragù?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. La *pasta al ragù* costa 12 €. *pasta al ragù*: *12,00 €* · disponibile»
- titolare: 🎤 Quanto costa il piatto boh?
  - bot: «Il piatto *boh* costa *20 €*. *boh*: *20,00 €* · disponibile»
- titolare: 🎤 Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?
  - bot: «Cambio il prezzo di *boh* da 20 a 50 €. *boh*: prezzo da 20,00 € a *50,00 €*»
- titolare: 🎤 Bu costa 40 euro
  - bot: «Intendi il piatto *boh* per cambiare il prezzo a *40 €*?»
- titolare: 🎤 Passa il ragù, metti prezzo a 20 euro.
  - bot: «Cambio il prezzo della *pasta al ragù* a 20 €. *pasta al ragù*: prezzo da 12,00 € a *20,00 €*»
- atteso: price|boh|40, price|pasta al ragù|20 · ottenuto: price|boh|50, price|pasta al ragù|20
- **GRAVE** correzione-non-applicata: resta la modifica poi corretta/annullata: price|boh|50
- **GRAVE** non-applicato: non applicato: price|boh|40

### bv-multiple-003 [MEDIO] — il secondo OK non ha niente da confermare
- titolare: La Pasta collaudo mettila a quattordici euro, la Pizza collaudo a sedici euro, il Tiramisu collaudo a sette euro e l’Acqua collaudo a tre euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Confermi *Pasta collaudo* a 14 €, *Pizza collaudo* a 16 €, *Tiramisu collaudo* a 7 € e *Acqua collaudo* a 3 €? 1. *Pasta collaudo* (11,00 €) 2. *Pizza collaudo* (13,00 €) 3. *Tiramisu collaudo* (6,00 €) 4. *Acqua collaudo* (2,00 €)»
- titolare: Per la Pasta collaudo fai quindici euro, non quattordici. Lascia il prezzo dell’Acqua collaudo com’è. Mantieni le altre modifiche.
  - bot: «Non ho cambiato nulla. Non ancora pubblicato: 1. *Pasta collaudo*: prezzo da 11,00 € a *15,00 €* «Pizza collaudo»: 1. *Pizza collaudo* (13,00 €) 2. *Pasta collaudo* (11,00 €) 3. *Tiramisu collaudo* (6,00 €) 4. *Acqua collaudo* (2,00 €) «Tiramisu collaudo»: 1. *Tiramisu collaudo* (6,00 €) 2. *Pasta collaudo* (11,00 €) 3. *Pizza collaudo* (13,00 €) 4. *Acqua collaudo* (2,00 €)»
- titolare: OK
  - bot: «Ok, pubblico la modifica di *Pasta collaudo* a 15 €. *Pasta collaudo*: prezzo da 11,00 € a *15,00 €*»
- titolare: OK
  - bot: «Non c'è nessuna modifica da confermare: la *Pasta collaudo* è già a 15 €. Cosa vuoi che modifichi adesso?»
- atteso: price|Pasta collaudo|15, price|Pizza collaudo|16, price|Tiramisu collaudo|7 · ottenuto: price|Pasta collaudo|15
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Pizza collaudo|16, price|Tiramisu collaudo|7

### bv-multiple-004 [MEDIO]
- titolare: metti Piatto di verifica a 14 euro, Che ne sacc a 21 euro, boh a 21 euro e pasta al ragù a 13 euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale prezzo vuoi per *Piatto di verifica*, *Che ne sacc*, *boh* e *pasta al ragù*?»
- titolare: ok va bene
  - bot: «Ok, ti preparo i nuovi prezzi. Rispondi OK per pubblicare. Non ancora pubblicato, da confermare con OK: 1. *Piatto di verifica*: prezzo da 13,00 € a *14,00 €* 2. *Che ne sacc*: prezzo da 20,00 € a *21,00 €* 3. *boh*: prezzo da 20,00 € a *21,00 €* 4. *pasta al ragù*: prezzo da 12,00 € a *13,00 €*»
- atteso: price|Che ne sacc|21, price|Piatto di verifica|14, price|boh|21, price|pasta al ragù|13 · ottenuto: nessuna modifica
- **MEDIO** in-attesa-ok: resta in attesa di OK: price|Che ne sacc|21, price|Piatto di verifica|14, price|boh|21, price|pasta al ragù|13

### bv-correzioni-001 [MEDIO] — «toiibo» incerto al turno 1 (domanda), le parti chiare si pubblicano; risposta vera al turno 2: boh «finito» invece di n
- titolare: 🎤 Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toiibo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla.»
- titolare: 🎤 No, ho detto togli boh.
  - bot: «Ok, tolgo *boh* dal menu. *boh*: *nascosto* dal menu»
- titolare: 🎤 Sì, ma ti avevo detto che dovevi aggiungere il piatto, la parmigiana a 10 euro e il tiramisù a 6 euro.
  - bot: «Hai ragione, ora aggiungo *Parmigiana* a 10 € e *Tiramisù* a 6 € nei Piatti di prova. Nuovo piatto *Parmigiana* in *Piatti di prova*: *10,00 €* Nuovo piatto *Tiramisù* in *Piatti di prova*: *6,00 €*»
- atteso: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true · ottenuto: create|parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

### bv-correzioni-003 [MEDIO] — «la parmigiana» è il nome esatto (l'altro è nascosto); risposta vera: «Quale piatto intendi… Riscrivimi»
- titolare: 🎤 Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Il *Tiramisù* lo metto in promo. Quale *parmigiana* intendi, quella nascosta o l'altra? Non ancora pubblicato: 1. *tiramisù*: in *promo* a *3,00 €* (prezzo pieno 6,00 €), finché non la togli «la parmigiana»: 1. *Inserisce il piatto la parmigiana* (12,00 €) 2. *la parmigiana* (10,00 €)»
- atteso: price|la parmigiana|15, promo|tiramisù|3 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, promo|tiramisù|3

### bv-correzioni-005 [MEDIO]
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi *la parmigiana* o *Inserisce il piatto la parmigiana*? 1. *la parmigiana* (10,00 €) 2. *Inserisce il piatto la parmigiana* (12,00 €)»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, price|tiramisù|10

### bv-correzioni-006 [MEDIO] — AMBIGUO: turno 1 «pasta al pesto e lasagna» uno o due piatti, senza prezzo; turno 2 due piatti senza prezzo. Risposta ve
- titolare: 🎤 Allora aggiungi il piatto pasta al pesto e lasagna.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ti chiedo: a che prezzo metto *Pasta al pesto* e *Lasagna*, e sono due piatti separati?»
- titolare: 🎤 No, pasta al pesto e lasagna sono due piatti separati.
  - bot: «A che prezzo li metto, *Pasta al pesto* e *Lasagna*?»
- titolare: 🎤 Uno deve essere a 10 euro e uno deve essere a 20 euro.
  - bot: «Quale va a *10 €* e quale a *20 €*: *Pasta al pesto* o *Lasagna*?»
- atteso: create|lasagna|20|piatti di prova, create|pasta al pesto|10|piatti di prova · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|lasagna|20|piatti di prova, create|pasta al pesto|10|piatti di prova

### bv-deixis-002 [MEDIO] — «rimuovi completamente» = eliminare: si cancella solo dopo «sì», quindi al turno 3 domanda di conferma e niente scrittur
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Tolgo *boh* dal menu e metto il *tiramisù* a 6 €. C'è già *la parmigiana* a 10 €: la lascio così o ne creo un altro?»
- titolare: 🎤 Ok, cambia i prezzi di quei due prodotti e mettili entrambi a 15 euro.
  - bot: «Ok, metto *la parmigiana* e il *tiramisù* a 15 €. *la parmigiana*: prezzo da 10,00 € a *15,00 €* *tiramisù*: prezzo da 6,00 € a *15,00 €*»
- titolare: 🎤 Ok, adesso rimuovi completamente quei due piatti.
  - bot: «Elimino *la parmigiana* e *tiramisù* dal menu? Rispondi sì. Da eliminare, serve il tuo sì: 1. *la parmigiana*: da eliminare 2. *tiramisù*: da eliminare»
- atteso: hidden|boh|true, price|la parmigiana|15, price|tiramisù|15 · ottenuto: price|la parmigiana|15, price|tiramisù|15
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|boh|true

### bv-deixis-003 [MEDIO]
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Tolgo *boh* dal menu e metto il *tiramisù* a 6 €. C'è già *la parmigiana* a 10 €: la lascio così o ne creo un altro?»
- atteso: hidden|boh|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|boh|true

### bv-aggiunte-005 [MEDIO] — AMBIGUO: pasta al ragù c'è già a 12: domanda breve («c'è già pasta al ragù a 12 €: lo aggiorno o ne creo un altro?»), ne
- titolare: 🎤 E aggiungi pasta al ragù a 10 euro, aggiungi pasta al pesto a 15 euro, aggiungi caviale a 150 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. C'è già *pasta al ragù* a 12 €: lo aggiorno a 10 € o ne creo un altro? Intanto preparo *pasta al pesto* a 15 € e *caviale* a 150 €. Il caviale a 150 € è un prezzo insolito: rispondi OK per pubblicare. Non ancora pubblicato: 1. Nuovo piatto *pasta al pesto* in *Piatti di prova*: *15,00 €* 2. Nuovo piatto *cavi»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

### bv-categorie-001 [MEDIO] — il ragù esistente va nei Primi (nota 62: prezzo 10 accettato, non richiesto perché la domanda sul ragù è rimasta senza r
- titolare: 🎤 E aggiungi pasta al ragù a 10 euro, aggiungi pasta al pesto a 15 euro, aggiungi caviale a 150 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. C'è già *pasta al ragù* a 12 €: lo aggiorno a 10 € o ne creo un altro? Intanto preparo *pasta al pesto* a 15 € e *caviale* a 150 €. Il caviale a 150 € è un prezzo insolito: rispondi OK per pubblicare. Non ancora pubblicato: 1. Nuovo piatto *pasta al pesto* in *Piatti di prova*: *15,00 €* 2. Nuovo piatto *cavi»
- titolare: 🎤 No, fai una cosa, aggiungi un'altra categoria, ovvero primi, e lì aggiungi quei due piatti che ti ho detto, invece il caviale aggiungere un'altra categoria ancora, chiamandola speciali.
  - bot: «Ok, creo il Sottomenu *Primi* con *pasta al pesto* a 15 €, e il Sottomenu *Speciali* con *caviale* a 150 €. Per la *pasta al ragù* a 10 €: la aggiorno o ne creo un'altra in *Primi*?»
- atteso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi

### bv-asr-004 [MEDIO] — R5.1 (nota 63): l'attesa chiedeva insieme una domanda senza scritture e la rinomina nello stesso turno (impossibile): re
- titolare: 🎤 Cambia il nome del piatto, inserisci la parmigiana.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto vuoi rinominare in *La parmigiana*?»
- atteso: rename|Inserisce il piatto la parmigiana|la parmigiana · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|Inserisce il piatto la parmigiana|la parmigiana

### bv-domande-006 [BASSO] — risposta vera fuori tema («Posso dirti prezzi…»)
- titolare: ❓ ciao
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ciao! Dimmi pure cosa vuoi aggiornare nel menu.»
- titolare: ❓ che locale ho?
  - bot: «Il tuo locale è *Tako*. Nel menu c'è il Menu *Menu* con il Sottomenu *Piatti di prova*.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /verifica web/i

