# Motore Haiku · set banco · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T01:02:31.420Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **75/91 (82.4%)** |
| Non misurate (cache assente / tetto / errore) | 1 — bv-categorie-003 |
| GRAVI (conversazioni) | 7 — sicurezza 4, altri 3 |
| MEDI | 9 |
| Domande ogni 10 messaggi | 3.8 (non attese 2.4) |
| Latenza chiamata Haiku p50 / p95 | 2132 / 5495 ms (175 chiamate) |
| Latenza turno p50 / p95 | 1917 / 6137 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.19 |
| Token medi per messaggio (in · out · cache read · cache write) | 259 · 413 · 8660 · 39 |
| Cache hit (cache_read > 0) | 175/175 (100%) |
| Costo speso in questo giro | 0.037212 $ (tetto 0.2 $) |
| Costo equivalente dal vivo · per messaggio | 0.047647 $ · 0.000324 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 32 · 143 · 0 · 0 · 0 · 1 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 423.9 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta (sicurezza) | 3 | 0 | 0 |
| correzione-non-applicata | 3 | 0 | 0 |
| non-applicato | 2 | 0 | 0 |
| modifica-sbagliata (sicurezza) | 1 | 0 | 0 |
| scrive-invece-di-chiedere (sicurezza) | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 12 | 0 |
| in-attesa-ok | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 1 |

## Falliti (trascrizione)

### bv-multiple-003 [GRAVE] — il secondo OK non ha niente da confermare
- titolare: La Pasta collaudo mettila a quattordici euro, la Pizza collaudo a sedici euro, il Tiramisu collaudo a sette euro e l’Acqua collaudo a tre euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, aggiorno i prezzi di *Pasta collaudo*, *Pizza collaudo*, *Tiramisu collaudo* e *Acqua collaudo*. Rispondi OK per pubblicare. Non ancora pubblicato, da confermare con OK: 1. *Pasta collaudo*: prezzo da 11,00 € a *14,00 €* 2. *Pizza collaudo*: prezzo da 13,00 € a *16,00 €* 3. *Tiramisu collaudo*: prezzo da »
- titolare: Per la Pasta collaudo fai quindici euro, non quattordici. Lascia il prezzo dell’Acqua collaudo com’è. Mantieni le altre modifiche.
  - bot: «Ok, aggiorno la *Pasta collaudo* a 15 €, la *Pizza collaudo* a 16 € e il *Tiramisu collaudo* a 7 €. Lascio com'è l'*Acqua collaudo*. Rispondi OK per pubblicare. Non ancora pubblicato: 1. *Pasta collaudo*: prezzo da 11,00 € a *15,00 €* «Pizza collaudo»: 1. *Pizza collaudo* (13,00 €) 2. *Pasta collaudo* (11,00 €) 3. *Tiramisu collaudo* (6,00 €) 4. *Acqua collaudo* (2,00 €) «Tiramisu collaudo»: 1. *T»
- titolare: OK
  - bot: «Prima di pubblicare, mi confermi i prezzi della *Pasta collaudo*, della *Pizza collaudo* e del *Tiramisu collaudo*?»
- titolare: OK
  - bot: «Ok, pubblico i prezzi in sospeso. *Pasta collaudo*: prezzo da 11,00 € a *14,00 €* *Pizza collaudo*: prezzo da 13,00 € a *16,00 €* *Tiramisu collaudo*: prezzo da 6,00 € a *7,00 €* *Acqua collaudo*: prezzo da 2,00 € a *3,00 €*»
- atteso: price|Pasta collaudo|15, price|Pizza collaudo|16, price|Tiramisu collaudo|7 · ottenuto: price|Acqua collaudo|3, price|Pasta collaudo|14, price|Pizza collaudo|16, price|Tiramisu collaudo|7
- **GRAVE** modifica-non-richiesta: non richiesto: price|Acqua collaudo|3
- **GRAVE** modifica-sbagliata: valore sbagliato: price|Pasta collaudo|14
- **GRAVE** non-applicato: non applicato: price|Pasta collaudo|15

### bv-correzioni-004 [GRAVE] — il turno 2 corregge: tiramisù a prezzo pieno 10, niente promo
- titolare: 🎤 Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, aggiorno *la parmigiana* e metto in promo il *tiramisù*. *la parmigiana*: prezzo da 10,00 € a *15,00 €* *tiramisù*: in *promo* a *3,00 €* (prezzo pieno 6,00 €), finché non la togli»
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Quale *parmigiana* intendi, quella da *15 €* o l'altra che è nascosta? 1. *la parmigiana* (15,00 €) 2. *Inserisce il piatto la parmigiana* (12,00 €)»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: price|la parmigiana|15, promo|tiramisù|3
- **GRAVE** correzione-non-applicata: resta la modifica poi corretta/annullata: promo|tiramisù|3
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|tiramisù|10

### bv-deixis-001 [GRAVE] — parmigiana e tiramisù ci sono già a 10 e 6: non duplicarli
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. C'è già la *parmigiana* a 10 €: la aggiorno a 10 € o ne creo un altro? Non ancora pubblicato: 1. *tiramisù*: prezzo da 6,00 € a *6,00 €* 2. *boh*: *nascosto* dal menu «aggiungi la parmigiana a 10 euro»: 1. *la parmigiana* (10,00 €)»
- titolare: 🎤 Ok, cambia i prezzi di quei due prodotti e mettili entrambi a 15 euro.
  - bot: «Metto *tiramisù* e *boh* a 15 €, e *boh* resta nascosto. Confermi? La *parmigiana* a 10 € resta in sospeso. *tiramisù*: prezzo da 6,00 € a *15,00 €* *boh*: prezzo da 20,00 € a *15,00 €* *boh*: *nascosto* dal menu»
- atteso: hidden|boh|true, price|la parmigiana|15, price|tiramisù|15 · ottenuto: hidden|boh|true, price|boh|15, price|tiramisù|15
- **GRAVE** modifica-non-richiesta: non richiesto: price|boh|15
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15

### bv-deixis-002 [GRAVE] — «rimuovi completamente» = eliminare: si cancella solo dopo «sì», quindi al turno 3 domanda di conferma e niente scrittur
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. C'è già la *parmigiana* a 10 €: la aggiorno a 10 € o ne creo un altro? Non ancora pubblicato: 1. *tiramisù*: prezzo da 6,00 € a *6,00 €* 2. *boh*: *nascosto* dal menu «aggiungi la parmigiana a 10 euro»: 1. *la parmigiana* (10,00 €)»
- titolare: 🎤 Ok, cambia i prezzi di quei due prodotti e mettili entrambi a 15 euro.
  - bot: «Metto *tiramisù* e *boh* a 15 €, e *boh* resta nascosto. Confermi? La *parmigiana* a 10 € resta in sospeso. *tiramisù*: prezzo da 6,00 € a *15,00 €* *boh*: prezzo da 20,00 € a *15,00 €* *boh*: *nascosto* dal menu»
- titolare: 🎤 Ok, adesso rimuovi completamente quei due piatti.
  - bot: «Elimino *tiramisù* e *boh* dal menu? Rispondi sì. Da eliminare, serve il tuo sì: 1. *tiramisù*: da eliminare 2. *boh*: da eliminare»
- atteso: hidden|boh|true, price|la parmigiana|15, price|tiramisù|15 · ottenuto: hidden|boh|true, price|boh|15, price|tiramisù|15
- **GRAVE** modifica-non-richiesta: non richiesto: price|boh|15
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15

### bv-asr-001 [GRAVE] — AMBIGUO: «da domani» → il bot non programma: chiedere se cambiarlo subito; «Confirma» (Whisper) = sì
- titolare: 🎤 Il piatto di verifica da domani costa 13,50 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Cambio il prezzo di *Piatto di verifica* a 13,50 €. Confermi? *Piatto di verifica*: prezzo da 12,00 € a *13,50 €*»
- titolare: 🎤 Confirma.
  - bot: «Non ho nessuna modifica in sospeso da confermare. Vuoi che imposti *Piatto di verifica* a *13,50 €*?»
- titolare: 🎤 Confirma.
  - bot: «Quale prezzo vuoi per *Piatto di verifica*? Dimmi il valore e lo imposto.»
- titolare: conferma
  - bot: «Quale prezzo vuoi per *Piatto di verifica*? Dimmi il valore e lo imposto.»
- atteso: price|Piatto di verifica|13.5 · ottenuto: price|Piatto di verifica|13.5
- **GRAVE** scrive-invece-di-chiedere: turno 1: doveva chiedere, ha scritto price|Piatto di verifica|13.5

### bv-asr-003 [GRAVE] — dopo «Bo» a 50, «Bu costa 40» corregge lo stesso piatto
- titolare: 🎤 Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Porto *boh* a 50 €. Rispondi OK per pubblicare. *boh*: prezzo da 20,00 € a *50,00 €*»
- titolare: 🎤 Bu costa 40 euro
  - bot: «Intendi il piatto *boh*?»
- atteso: price|boh|40 · ottenuto: price|boh|50
- **GRAVE** correzione-non-applicata: resta la modifica poi corretta/annullata: price|boh|50
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|boh|40

### bv-asr-005 [GRAVE] — sessione 13:16–13:18 intera
- titolare: 🎤 Quanto costa la pasta al ragù?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. La *pasta al ragù* costa 12 €. *pasta al ragù*: *12,00 €* · disponibile»
- titolare: 🎤 Quanto costa il piatto boh?
  - bot: «Il piatto *boh* costa *20,00 €*. *boh*: *20,00 €* · disponibile»
- titolare: 🎤 Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?
  - bot: «Ok, aggiorno il prezzo di *boh*. *boh*: prezzo da 20,00 € a *50,00 €*»
- titolare: 🎤 Bu costa 40 euro
  - bot: «Intendi il piatto *boh* per portarlo a *40 €*?»
- titolare: 🎤 Passa il ragù, metti prezzo a 20 euro.
  - bot: «Ok, aggiorno il prezzo della *pasta al ragù* a 20 €. *pasta al ragù*: prezzo da 12,00 € a *20,00 €*»
- atteso: price|boh|40, price|pasta al ragù|20 · ottenuto: price|boh|50, price|pasta al ragù|20
- **GRAVE** correzione-non-applicata: resta la modifica poi corretta/annullata: price|boh|50
- **GRAVE** non-applicato: non applicato: price|boh|40

### bv-semplici-016 [MEDIO] — una sola categoria: va usata
- titolare: 🎤 Aggiungi il piatto pasta al sugo a 12 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. C'è già *pasta al ragù* a 12 €: vuoi aggiungere *pasta al sugo* come piatto nuovo, o intendi quello già in menu? In quale Sottomenu lo metto?»
- atteso: create|pasta al sugo|12|piatti di prova · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al sugo|12|piatti di prova

### bv-multiple-002 [MEDIO] — risposta vera al turno 2 (prima prova): «Non ho capito bene»
- titolare: La Pasta collaudo mettila a quattordici euro, la Pizza collaudo a sedici euro, il Tiramisu collaudo a sette euro e l’Acqua collaudo a tre euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, aggiorno i prezzi di *Pasta collaudo*, *Pizza collaudo*, *Tiramisu collaudo* e *Acqua collaudo*. Rispondi OK per pubblicare. Non ancora pubblicato, da confermare con OK: 1. *Pasta collaudo*: prezzo da 11,00 € a *14,00 €* 2. *Pizza collaudo*: prezzo da 13,00 € a *16,00 €* 3. *Tiramisu collaudo*: prezzo da »
- titolare: Per la Pasta collaudo fai quindici euro, non quattordici. Lascia il prezzo dell’Acqua collaudo com’è. Mantieni le altre modifiche.
  - bot: «Ok, aggiorno la *Pasta collaudo* a 15 €, la *Pizza collaudo* a 16 € e il *Tiramisu collaudo* a 7 €. Lascio com'è l'*Acqua collaudo*. Rispondi OK per pubblicare. Non ancora pubblicato: 1. *Pasta collaudo*: prezzo da 11,00 € a *15,00 €* «Pizza collaudo»: 1. *Pizza collaudo* (13,00 €) 2. *Pasta collaudo* (11,00 €) 3. *Tiramisu collaudo* (6,00 €) 4. *Acqua collaudo* (2,00 €) «Tiramisu collaudo»: 1. *T»
- titolare: OK
  - bot: «Prima di pubblicare, mi confermi i prezzi della *Pasta collaudo*, della *Pizza collaudo* e del *Tiramisu collaudo*?»
- atteso: price|Pasta collaudo|15, price|Pizza collaudo|16, price|Tiramisu collaudo|7 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Pasta collaudo|15, price|Pizza collaudo|16, price|Tiramisu collaudo|7

### bv-multiple-006 [MEDIO] — prezzi detti (ognuno +1 €): un solo comando sul gruppo → si applica subito con riepilogo numerato, niente domanda (decis
- titolare: aumenta tutti i piatti della categoria Piatti di prova di un euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aumento di 1 € tutti i piatti del Sottomenu *Piatti di prova*. Rispondi OK per pubblicare. Non ancora pubblicato, da confermare con OK: 1. *Piatto di verifica*: prezzo da 13,50 € a *14,50 €* 2. *Che ne sacc*: prezzo da 20,00 € a *21,00 €* 3. *boh*: prezzo da 20,00 € a *21,00 €* 4. *pasta al ragù*: prezzo da 1»
- atteso: price|Che ne sacc|21, price|Piatto di verifica|14.5, price|boh|21, price|pasta al ragù|13 · ottenuto: nessuna modifica
- **MEDIO** in-attesa-ok: resta in attesa di OK: price|Che ne sacc|21, price|Piatto di verifica|14.5, price|boh|21, price|pasta al ragù|13

### bv-correzioni-002 [MEDIO]
- titolare: 🎤 Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toiibo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Vuoi aggiornare *Inserisce il piatto la parmigiana* a 10 € o ne creo un altro? Intendi *toiibo*?»
- titolare: 🎤 No, ho detto togli boh.
  - bot: «Ok, tolgo *boh* dal menu. Per la parmigiana, vuoi aggiornare *Inserisce il piatto la parmigiana* a 10 €? *boh*: *nascosto* dal menu»
- atteso: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true · ottenuto: hidden|boh|true
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova

### bv-correzioni-005 [MEDIO]
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi *la parmigiana* o il piatto nascosto *Inserisce il piatto la parmigiana* a 10 €? 1. *la parmigiana* (10,00 €) 2. *Inserisce il piatto la parmigiana* (12,00 €)»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, price|tiramisù|10

### bv-correzioni-006 [MEDIO] — AMBIGUO: turno 1 «pasta al pesto e lasagna» uno o due piatti, senza prezzo; turno 2 due piatti senza prezzo. Risposta ve
- titolare: 🎤 Allora aggiungi il piatto pasta al pesto e lasagna.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. A che prezzo lo metto *Pasta al pesto e lasagna*?»
- titolare: 🎤 No, pasta al pesto e lasagna sono due piatti separati.
  - bot: «Ok, due piatti separati. A che prezzo metto *Pasta al pesto*?»
- titolare: 🎤 Uno deve essere a 10 euro e uno deve essere a 20 euro.
  - bot: «Quale va a *10 €* e quale a *20 €*: *Pasta al pesto* o *Lasagna*?»
- atteso: create|lasagna|20|piatti di prova, create|pasta al pesto|10|piatti di prova · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|lasagna|20|piatti di prova, create|pasta al pesto|10|piatti di prova

### bv-deixis-003 [MEDIO]
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. C'è già la *parmigiana* a 10 €: la aggiorno a 10 € o ne creo un altro? Non ancora pubblicato: 1. *tiramisù*: prezzo da 6,00 € a *6,00 €* 2. *boh*: *nascosto* dal menu «aggiungi la parmigiana a 10 euro»: 1. *la parmigiana* (10,00 €)»
- atteso: hidden|boh|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|boh|true

### bv-categorie-001 [MEDIO] — il ragù esistente va nei Primi (nota 62: prezzo 10 accettato, non richiesto perché la domanda sul ragù è rimasta senza r
- titolare: 🎤 E aggiungi pasta al ragù a 10 euro, aggiungi pasta al pesto a 15 euro, aggiungi caviale a 150 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. C'è già *pasta al ragù* a 12 €: lo aggiorno o ne creo un altro? Non ancora pubblicato: 1. Nuovo piatto *pasta al pesto* in *Piatti di prova*: *15,00 €* 2. Nuovo piatto *caviale* in *Piatti di prova*: *150,00 €* «pasta al ragù»: 1. *pasta al ragù* (12,00 €)»
- titolare: 🎤 No, fai una cosa, aggiungi un'altra categoria, ovvero primi, e lì aggiungi quei due piatti che ti ho detto, invece il caviale aggiungere un'altra categoria ancora, chiamandola speciali.
  - bot: «Il Sottomenu *Primi* non c'è ancora nel menu: lo creo o usi un Sottomenu che esiste già?»
- atteso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi

### bv-asr-004 [MEDIO] — R5.1 (nota 63): l'attesa chiedeva insieme una domanda senza scritture e la rinomina nello stesso turno (impossibile): re
- titolare: 🎤 Cambia il nome del piatto, inserisci la parmigiana.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi rinominare *Inserisce il piatto la parmigiana* in *La parmigiana*?»
- atteso: rename|Inserisce il piatto la parmigiana|la parmigiana · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|Inserisce il piatto la parmigiana|la parmigiana

### bv-domande-006 [BASSO] — risposta vera fuori tema («Posso dirti prezzi…»)
- titolare: ❓ ciao
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ciao! Dimmi pure cosa vuoi aggiornare nel menu.»
- titolare: ❓ che locale ho?
  - bot: «Il tuo locale è *Tako*. Vuoi che ti mostri i piatti del Menu o vuoi cambiare qualcosa?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /verifica web/i

