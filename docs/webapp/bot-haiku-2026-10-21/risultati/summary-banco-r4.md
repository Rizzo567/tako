# Motore Haiku · set banco · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T01:13:09.173Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **74/92 (80.4%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 10 — sicurezza 4, altri 6 |
| MEDI | 8 |
| Domande ogni 10 messaggi | 3.8 (non attese 2.3) |
| Latenza chiamata Haiku p50 / p95 | 2135 / 5193 ms (183 chiamate) |
| Latenza turno p50 / p95 | 2129 / 6453 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.23 |
| Token medi per messaggio (in · out · cache read · cache write) | 278 · 404 · 9044 · 88 |
| Cache hit (cache_read > 0) | 182/183 (99.5%) |
| Costo speso in questo giro | 0.038819 $ (tetto 0.2 $) |
| Costo equivalente dal vivo · per messaggio | 0.049391 $ · 0.000331 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 33 · 150 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 371.7 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 7 | 0 | 0 |
| modifica-non-richiesta (sicurezza) | 4 | 0 | 0 |
| correzione-non-applicata | 3 | 0 | 0 |
| chiede-invece-di-agire | 0 | 10 | 0 |
| in-attesa-ok | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 3 |

## Falliti (trascrizione)

### bv-multiple-002 [GRAVE] — risposta vera al turno 2 (prima prova): «Non ho capito bene»
- titolare: La Pasta collaudo mettila a quattordici euro, la Pizza collaudo a sedici euro, il Tiramisu collaudo a sette euro e l’Acqua collaudo a tre euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Vuoi che cambi il prezzo di tutti e quattro i piatti: *Pasta collaudo* a 14 €, *Pizza collaudo* a 16 €, *Tiramisu collaudo* a 7 € e *Acqua collaudo* a 3 €?»
- titolare: Per la Pasta collaudo fai quindici euro, non quattordici. Lascia il prezzo dell’Acqua collaudo com’è. Mantieni le altre modifiche.
  - bot: «Ok, correggo la *Pasta collaudo* a 15 €, la *Pizza collaudo* a 16 € e il *Tiramisu collaudo* a 7 €. L'*Acqua collaudo* resta com'è. Non ancora pubblicato: 1. *Pasta collaudo*: prezzo da 11,00 € a *15,00 €* «Pizza collaudo»: 1. *Pizza collaudo* (13,00 €) 2. *Pasta collaudo* (11,00 €) 3. *Tiramisu collaudo* (6,00 €) 4. *Acqua collaudo* (2,00 €) «Tiramisu collaudo»: 1. *Tiramisu collaudo* (6,00 €) 2.»
- titolare: OK
  - bot: «Pubblico la *Pasta collaudo* a 15 €. *Pasta collaudo*: prezzo da 11,00 € a *15,00 €*»
- atteso: price|Pasta collaudo|15, price|Pizza collaudo|16, price|Tiramisu collaudo|7 · ottenuto: price|Pasta collaudo|15
- **GRAVE** non-applicato: non applicato: price|Pizza collaudo|16, price|Tiramisu collaudo|7

### bv-multiple-004 [GRAVE]
- titolare: metti Piatto di verifica a 14 euro, Che ne sacc a 21 euro, boh a 21 euro e pasta al ragù a 13 euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Vuoi che aggiorni questi 4 prezzi insieme: *Piatto di verifica* a 14, *Che ne sacc* a 21, *boh* a 21 e *pasta al ragù* a 13? 1. *Piatto di verifica* (13,00 €) 2. *Che ne sacc* (20,00 €) 3. *boh* (20,00 €) 4. *pasta al ragù* (12,00 €)»
- titolare: ok va bene
  - bot: «Non ho cambiato nulla. 1. *Piatto di verifica* (13,00 €) 2. *Che ne sacc* (20,00 €) 3. *boh* (20,00 €) 4. *pasta al ragù* (12,00 €)»
- atteso: price|Che ne sacc|21, price|Piatto di verifica|14, price|boh|21, price|pasta al ragù|13 · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: price|Che ne sacc|21, price|Piatto di verifica|14, price|boh|21, price|pasta al ragù|13

### bv-multiple-007 [GRAVE] — «la parmigiana» = l'unico piatto con parmigiana; kenesac = Che ne sacc
- titolare: 🎤 Allora, voglio che mi nascondi la parmigiana tra i piatti del menù e mi metti in sconto il kenesac a 12 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nascondo *Inserisce il piatto la parmigiana* e cambio il prezzo di *Che ne sacc*. *Inserisce il piatto la parmigiana*: *nascosto* dal menu *Che ne sacc*: prezzo da 20,00 € a *12,00 €*»
- atteso: hidden|Inserisce il piatto la parmigiana|true, promo|Che ne sacc|12 · ottenuto: hidden|Inserisce il piatto la parmigiana|true, price|Che ne sacc|12
- **GRAVE** modifica-non-richiesta: non richiesto: price|Che ne sacc|12
- **GRAVE** non-applicato: non applicato: promo|Che ne sacc|12

### bv-multiple-008 [GRAVE]
- titolare: 🎤 Allora, voglio che mi nascondi la parmigiana tra i piatti del menù e mi metti in sconto il kenesac a 12 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nascondo *Inserisce il piatto la parmigiana* e cambio il prezzo di *Che ne sacc*. *Inserisce il piatto la parmigiana*: *nascosto* dal menu *Che ne sacc*: prezzo da 20,00 € a *12,00 €*»
- titolare: 🎤 Allora, voglio che mi nascondi dal menù il piatto la parmigiana e invece mi metti in promo il piatto di verifica a 11 euro.
  - bot: «Nascondo *Inserisce il piatto la parmigiana* e metto in promo *Piatto di verifica* a 11 €. *Piatto di verifica*: in *promo* a *11,00 €* (prezzo pieno 13,50 €), finché non la togli *Inserisce il piatto la parmigiana* è già nascosto dal menu.»
- atteso: hidden|Inserisce il piatto la parmigiana|true, promo|Che ne sacc|12, promo|Piatto di verifica|11 · ottenuto: hidden|Inserisce il piatto la parmigiana|true, price|Che ne sacc|12, promo|Piatto di verifica|11
- **GRAVE** modifica-non-richiesta: non richiesto: price|Che ne sacc|12
- **GRAVE** non-applicato: non applicato: promo|Che ne sacc|12

### bv-correzioni-002 [GRAVE]
- titolare: 🎤 Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toiibo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Per la *Parmigiana* lo aggiorno a 10 € o ne creo un altro? *Toiibo* non mi è chiaro: intendi un piatto del menu?»
- titolare: 🎤 No, ho detto togli boh.
  - bot: «Ok, tolgo *boh* dal menu. *boh*: *nascosto* dal menu»
- atteso: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true · ottenuto: hidden|boh|true
- **GRAVE** non-applicato: non applicato: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova

### bv-correzioni-004 [GRAVE] — il turno 2 corregge: tiramisù a prezzo pieno 10, niente promo
- titolare: 🎤 Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, aggiorno la *la parmigiana* e la promo del *tiramisù*. *la parmigiana*: prezzo da 10,00 € a *15,00 €* *tiramisù*: in *promo* a *3,00 €* (prezzo pieno 6,00 €), finché non la togli»
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Quale parmigiana intendi? Scegli tra *la parmigiana* e *Inserisce il piatto la parmigiana*. 1. *la parmigiana* (15,00 €) 2. *Inserisce il piatto la parmigiana* (12,00 €)»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: price|la parmigiana|15, promo|tiramisù|3
- **GRAVE** correzione-non-applicata: resta la modifica poi corretta/annullata: promo|tiramisù|3
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|tiramisù|10

### bv-deixis-001 [GRAVE] — parmigiana e tiramisù ci sono già a 10 e 6: non duplicarli
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. C'è già *la parmigiana*: la aggiorno a 10 euro o ne creo un altro? Non ancora pubblicato: 1. *tiramisù*: prezzo da 6,00 € a *6,00 €* 2. *boh*: *nascosto* dal menu «Aggiungi la parmigiana a 10 euro»: 1. *la parmigiana* (10,00 €)»
- titolare: 🎤 Ok, cambia i prezzi di quei due prodotti e mettili entrambi a 15 euro.
  - bot: «Ok, metto *tiramisù* e *boh* a 15 €. Ti chiedo l'OK per pubblicare. *tiramisù*: prezzo da 6,00 € a *15,00 €* *boh*: prezzo da 20,00 € a *15,00 €*»
- atteso: hidden|boh|true, price|la parmigiana|15, price|tiramisù|15 · ottenuto: price|boh|15, price|tiramisù|15
- **GRAVE** modifica-non-richiesta: non richiesto: price|boh|15
- **GRAVE** non-applicato: non applicato: hidden|boh|true, price|la parmigiana|15

### bv-deixis-002 [GRAVE] — «rimuovi completamente» = eliminare: si cancella solo dopo «sì», quindi al turno 3 domanda di conferma e niente scrittur
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. C'è già *la parmigiana*: la aggiorno a 10 euro o ne creo un altro? Non ancora pubblicato: 1. *tiramisù*: prezzo da 6,00 € a *6,00 €* 2. *boh*: *nascosto* dal menu «Aggiungi la parmigiana a 10 euro»: 1. *la parmigiana* (10,00 €)»
- titolare: 🎤 Ok, cambia i prezzi di quei due prodotti e mettili entrambi a 15 euro.
  - bot: «Ok, metto *tiramisù* e *boh* a 15 €. Ti chiedo l'OK per pubblicare. *tiramisù*: prezzo da 6,00 € a *15,00 €* *boh*: prezzo da 20,00 € a *15,00 €*»
- titolare: 🎤 Ok, adesso rimuovi completamente quei due piatti.
  - bot: «Quali due piatti vuoi eliminare? Intendi *tiramisù* e *boh*? 1. *tiramisù* (15,00 €) 2. *boh* (15,00 €)»
- atteso: hidden|boh|true, price|la parmigiana|15, price|tiramisù|15 · ottenuto: price|boh|15, price|tiramisù|15
- **GRAVE** modifica-non-richiesta: non richiesto: price|boh|15
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|boh|true, price|la parmigiana|15

### bv-asr-003 [GRAVE] — dopo «Bo» a 50, «Bu costa 40» corregge lo stesso piatto
- titolare: 🎤 Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Cambio *boh* a 50 €. *boh*: prezzo da 20,00 € a *50,00 €*»
- titolare: 🎤 Bu costa 40 euro
  - bot: «Intendi il piatto *boh*? Lo metto a 40 €?»
- atteso: price|boh|40 · ottenuto: price|boh|50
- **GRAVE** correzione-non-applicata: resta la modifica poi corretta/annullata: price|boh|50
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|boh|40

### bv-asr-005 [GRAVE] — sessione 13:16–13:18 intera
- titolare: 🎤 Quanto costa la pasta al ragù?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. La *pasta al ragù* costa 12 €. *pasta al ragù*: *12,00 €* · disponibile»
- titolare: 🎤 Quanto costa il piatto boh?
  - bot: «*boh* costa 20 €. *boh*: *20,00 €* · disponibile»
- titolare: 🎤 Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?
  - bot: «Cambio il prezzo di *boh* a *50 €*. *boh*: prezzo da 20,00 € a *50,00 €*»
- titolare: 🎤 Bu costa 40 euro
  - bot: «Intendi il piatto *boh*?»
- titolare: 🎤 Passa il ragù, metti prezzo a 20 euro.
  - bot: «Cambio il prezzo di *pasta al ragù* a *20 €*. *pasta al ragù*: prezzo da 12,00 € a *20,00 €*»
- atteso: price|boh|40, price|pasta al ragù|20 · ottenuto: price|boh|50, price|pasta al ragù|20
- **GRAVE** correzione-non-applicata: resta la modifica poi corretta/annullata: price|boh|50
- **GRAVE** non-applicato: non applicato: price|boh|40

### bv-multiple-003 [MEDIO] — il secondo OK non ha niente da confermare
- titolare: La Pasta collaudo mettila a quattordici euro, la Pizza collaudo a sedici euro, il Tiramisu collaudo a sette euro e l’Acqua collaudo a tre euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Vuoi che cambi il prezzo di tutti e quattro i piatti: *Pasta collaudo* a 14 €, *Pizza collaudo* a 16 €, *Tiramisu collaudo* a 7 € e *Acqua collaudo* a 3 €?»
- titolare: Per la Pasta collaudo fai quindici euro, non quattordici. Lascia il prezzo dell’Acqua collaudo com’è. Mantieni le altre modifiche.
  - bot: «Ok, correggo la *Pasta collaudo* a 15 €, la *Pizza collaudo* a 16 € e il *Tiramisu collaudo* a 7 €. L'*Acqua collaudo* resta com'è. Non ancora pubblicato: 1. *Pasta collaudo*: prezzo da 11,00 € a *15,00 €* «Pizza collaudo»: 1. *Pizza collaudo* (13,00 €) 2. *Pasta collaudo* (11,00 €) 3. *Tiramisu collaudo* (6,00 €) 4. *Acqua collaudo* (2,00 €) «Tiramisu collaudo»: 1. *Tiramisu collaudo* (6,00 €) 2.»
- titolare: OK
  - bot: «Pubblico la *Pasta collaudo* a 15 €. *Pasta collaudo*: prezzo da 11,00 € a *15,00 €*»
- titolare: OK
  - bot: «Non ho modifiche in sospeso da confermare. Cosa vuoi cambiare nel *Menu*? Dimmi quale *Piatto* e a quanto.»
- atteso: price|Pasta collaudo|15, price|Pizza collaudo|16, price|Tiramisu collaudo|7 · ottenuto: price|Pasta collaudo|15
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Pizza collaudo|16, price|Tiramisu collaudo|7

### bv-multiple-006 [MEDIO] — prezzi detti (ognuno +1 €): un solo comando sul gruppo → si applica subito con riepilogo numerato, niente domanda (decis
- titolare: aumenta tutti i piatti della categoria Piatti di prova di un euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aumento di un euro tutti i piatti del Sottomenu *Piatti di prova*. Rispondi OK per pubblicare. Non ancora pubblicato, da confermare con OK: 1. *Piatto di verifica*: prezzo da 13,50 € a *14,50 €* 2. *Che ne sacc*: prezzo da 20,00 € a *21,00 €* 3. *boh*: prezzo da 20,00 € a *21,00 €* 4. *pasta al ragù*: prezzo »
- atteso: price|Che ne sacc|21, price|Piatto di verifica|14.5, price|boh|21, price|pasta al ragù|13 · ottenuto: nessuna modifica
- **MEDIO** in-attesa-ok: resta in attesa di OK: price|Che ne sacc|21, price|Piatto di verifica|14.5, price|boh|21, price|pasta al ragù|13

### bv-correzioni-005 [MEDIO]
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, il *Tiramisù* lo metto a 10 €. Per la parmigiana: intendi *la parmigiana* o *Inserisce il piatto la parmigiana*? Non ancora pubblicato: 1. *tiramisù*: prezzo da 6,00 € a *10,00 €* «parmigiana»: 1. *la parmigiana* (10,00 €) 2. *Inserisce il piatto la parmigiana* (12,00 €)»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, price|tiramisù|10

### bv-correzioni-006 [MEDIO] — AMBIGUO: turno 1 «pasta al pesto e lasagna» uno o due piatti, senza prezzo; turno 2 due piatti senza prezzo. Risposta ve
- titolare: 🎤 Allora aggiungi il piatto pasta al pesto e lasagna.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono due piatti, *Pasta al pesto* e *Lasagna*? A che prezzo li metto?»
- titolare: 🎤 No, pasta al pesto e lasagna sono due piatti separati.
  - bot: «Ok, sono due piatti separati. A che prezzo metto *Pasta al pesto* e *Lasagna*?»
- titolare: 🎤 Uno deve essere a 10 euro e uno deve essere a 20 euro.
  - bot: «Quale dei due va a *10 €* e quale a *20 €*: *Pasta al pesto* o *Lasagna*?»
- atteso: create|lasagna|20|piatti di prova, create|pasta al pesto|10|piatti di prova · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|lasagna|20|piatti di prova, create|pasta al pesto|10|piatti di prova

### bv-deixis-003 [MEDIO]
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. C'è già *la parmigiana*: la aggiorno a 10 euro o ne creo un altro? Non ancora pubblicato: 1. *tiramisù*: prezzo da 6,00 € a *6,00 €* 2. *boh*: *nascosto* dal menu «Aggiungi la parmigiana a 10 euro»: 1. *la parmigiana* (10,00 €)»
- atteso: hidden|boh|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|boh|true

### bv-categorie-001 [MEDIO] — il ragù esistente va nei Primi (nota 62: prezzo 10 accettato, non richiesto perché la domanda sul ragù è rimasta senza r
- titolare: 🎤 E aggiungi pasta al ragù a 10 euro, aggiungi pasta al pesto a 15 euro, aggiungi caviale a 150 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Per la *pasta al ragù* c'è già a 12 €: la aggiorno a 10 € o ne creo un altro?»
- titolare: 🎤 No, fai una cosa, aggiungi un'altra categoria, ovvero primi, e lì aggiungi quei due piatti che ti ho detto, invece il caviale aggiungere un'altra categoria ancora, chiamandola speciali.
  - bot: «Non c'è un sottomenu *Primi* nel menu: lo creo nuovo e ci metto *pasta al ragù* e *pasta al pesto*, poi creo *Speciali* per *caviale*? Rispondi sì o dimmi in quale sottomenu metterli.»
- atteso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi

### bv-asr-001 [MEDIO] — AMBIGUO: «da domani» → il bot non programma: chiedere se cambiarlo subito; «Confirma» (Whisper) = sì
- titolare: 🎤 Il piatto di verifica da domani costa 13,50 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Il programma non lo faccio: lo cambio subito a *Piatto di verifica* 13,50 €? Lo cambio subito?»
- titolare: 🎤 Confirma.
  - bot: «Non ho capito se confermi: lo cambio subito *Piatto di verifica* a 13,50 €? Rispondi 1 per sì o 2 per no.»
- titolare: 🎤 Confirma.
  - bot: «Non ho cambiato nulla. 1. *Piatto di verifica* (12,00 €)»
- titolare: conferma
  - bot: «Il programma non lo faccio: lo cambio subito. Confermi *Piatto di verifica* a 13,50 €? Rispondi 1 per sì o 2 per no.»
- atteso: price|Piatto di verifica|13.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Piatto di verifica|13.5

### bv-asr-004 [MEDIO] — R5.1 (nota 63): l'attesa chiedeva insieme una domanda senza scritture e la rinomina nello stesso turno (impossibile): re
- titolare: 🎤 Cambia il nome del piatto, inserisci la parmigiana.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto vuoi rinominare in *La parmigiana*? 1. *Piatto di verifica* (13,50 €) 2. *Che ne sacc* (20,00 €) 3. *boh* (20,00 €) 4. *pasta al ragù* (20,00 €) 5. *Inserisce il piatto la parmigiana* (12,00 €)»
- atteso: rename|Inserisce il piatto la parmigiana|la parmigiana · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|Inserisce il piatto la parmigiana|la parmigiana

### bv-domande-003 [BASSO]
- titolare: 🎤 Quanto costa la tagliata
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale tagliata intendi? Dimmi il nome completo, così ti rispondo con il prezzo.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /20/

### bv-domande-005 [BASSO] — collegato a Victoria Bar dal 14/10 19:26
- titolare: ❓ Ciao! A quale locale sono collegato e cosa puoi fare?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Vuoi sapere cosa posso fare per il tuo menu o a quale locale sei collegato?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /victoria/i

### bv-domande-006 [BASSO] — risposta vera fuori tema («Posso dirti prezzi…»)
- titolare: ❓ ciao
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ciao! Dimmi pure cosa vuoi aggiornare nel menu.»
- titolare: ❓ che locale ho?
  - bot: «Il tuo locale nel menu digitale si chiama *Tako*. Vuoi sapere altro sul menu?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /verifica web/i

