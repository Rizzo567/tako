# Motore Haiku · set banco · replay

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T08:48:01.218Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **81/92 (88%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 6 — sicurezza 0, altri 6 |
| MEDI | 5 |
| Domande ogni 10 messaggi | 3.5 (non attese 2) |
| Latenza chiamata Haiku p50 / p95 | 1904 / 5600 ms (182 chiamate) |
| Latenza turno p50 / p95 | 2144 / 8942 ms (harness + latenza Haiku registrata) |
| Chiamate Haiku per messaggio | 1.22 |
| Token medi per messaggio (in · out · cache read · cache write) | 274 · 424 · 10131 · 42 |
| Cache hit (cache_read > 0) | 182/182 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.5 $) |
| Costo equivalente dal vivo · per messaggio | 0.051521 $ · 0.000346 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 182 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 3.6 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 5 | 0 | 0 |
| correzione-non-applicata | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 6 | 0 |
| risposta-non-pertinente | 0 | 0 | 1 |

## Falliti (trascrizione)

### bv-multiple-002 [GRAVE] — risposta vera al turno 2 (prima prova): «Non ho capito bene»
- titolare: La Pasta collaudo mettila a quattordici euro, la Pizza collaudo a sedici euro, il Tiramisu collaudo a sette euro e l’Acqua collaudo a tre euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Vuoi che aggiorni questi quattro prezzi così: *Pasta collaudo* a 14 €, *Pizza collaudo* a 16 €, *Tiramisu collaudo* a 7 € e *Acqua collaudo* a 3 €?»
- titolare: Per la Pasta collaudo fai quindici euro, non quattordici. Lascia il prezzo dell’Acqua collaudo com’è. Mantieni le altre modifiche.
  - bot: «Ok, correggo la *Pasta collaudo* a 15 €. *Pizza collaudo* a 16 € e *Tiramisu collaudo* a 7 € restano come proposto. *Acqua collaudo* resta com'è. Confermi? Non ancora pubblicato: 1. *Pasta collaudo*: prezzo da 11,00 € a *15,00 €* «Pizza collaudo»: 1. *Pizza collaudo* (13,00 €) 2. *Pasta collaudo* (11,00 €) 3. *Tiramisu collaudo* (6,00 €) 4. *Acqua collaudo* (2,00 €) «Tiramisu collaudo»: 1. *Tirami»
- titolare: OK
  - bot: «Ok, pubblico la modifica alla *Pasta collaudo* a 15 €. *Pasta collaudo*: prezzo da 11,00 € a *15,00 €*»
- atteso: price|Pasta collaudo|15, price|Pizza collaudo|16, price|Tiramisu collaudo|7 · ottenuto: price|Pasta collaudo|15
- **GRAVE** non-applicato: non applicato: price|Pizza collaudo|16, price|Tiramisu collaudo|7

### bv-multiple-003 [GRAVE] — il secondo OK non ha niente da confermare
- titolare: La Pasta collaudo mettila a quattordici euro, la Pizza collaudo a sedici euro, il Tiramisu collaudo a sette euro e l’Acqua collaudo a tre euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Vuoi che aggiorni questi quattro prezzi così: *Pasta collaudo* a 14 €, *Pizza collaudo* a 16 €, *Tiramisu collaudo* a 7 € e *Acqua collaudo* a 3 €?»
- titolare: Per la Pasta collaudo fai quindici euro, non quattordici. Lascia il prezzo dell’Acqua collaudo com’è. Mantieni le altre modifiche.
  - bot: «Ok, correggo la *Pasta collaudo* a 15 €. *Pizza collaudo* a 16 € e *Tiramisu collaudo* a 7 € restano come proposto. *Acqua collaudo* resta com'è. Confermi? Non ancora pubblicato: 1. *Pasta collaudo*: prezzo da 11,00 € a *15,00 €* «Pizza collaudo»: 1. *Pizza collaudo* (13,00 €) 2. *Pasta collaudo* (11,00 €) 3. *Tiramisu collaudo* (6,00 €) 4. *Acqua collaudo* (2,00 €) «Tiramisu collaudo»: 1. *Tirami»
- titolare: OK
  - bot: «Ok, pubblico la modifica alla *Pasta collaudo* a 15 €. *Pasta collaudo*: prezzo da 11,00 € a *15,00 €*»
- titolare: OK
  - bot: «Ok, la *Pasta collaudo* la metto a 15 €.»
- atteso: price|Pasta collaudo|15, price|Pizza collaudo|16, price|Tiramisu collaudo|7 · ottenuto: price|Pasta collaudo|15
- **GRAVE** non-applicato: non applicato: price|Pizza collaudo|16, price|Tiramisu collaudo|7

### bv-correzioni-002 [GRAVE]
- titolare: 🎤 Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toiibo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi *toiibo* come quale piatto del menu?»
- titolare: 🎤 No, ho detto togli boh.
  - bot: «Ok, tolgo *boh* dal menu. *boh*: *nascosto* dal menu»
- atteso: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true · ottenuto: hidden|boh|true
- **GRAVE** non-applicato: non applicato: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova

### bv-categorie-001 [GRAVE] — il ragù esistente va nei Primi (nota 62: prezzo 10 accettato, non richiesto perché la domanda sul ragù è rimasta senza r
- titolare: 🎤 E aggiungi pasta al ragù a 10 euro, aggiungi pasta al pesto a 15 euro, aggiungi caviale a 150 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiungo *pasta al pesto* a 15 € e *caviale* a 150 €. C'è già *pasta al ragù*: lo aggiorno o ne creo un altro? Non ancora pubblicato: 1. Nuovo piatto *pasta al pesto* in *Piatti di prova*: *15,00 €* 2. Nuovo piatto *caviale* in *Piatti di prova*: *150,00 €* «pasta al ragù»: 1. *pasta al ragù* (12,00 €)»
- titolare: 🎤 No, fai una cosa, aggiungi un'altra categoria, ovvero primi, e lì aggiungi quei due piatti che ti ho detto, invece il caviale aggiungere un'altra categoria ancora, chiamandola speciali.
  - bot: «Non ho cambiato nulla.»
- atteso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi

### bv-asr-003 [GRAVE] — dopo «Bo» a 50, «Bu costa 40» corregge lo stesso piatto
- titolare: 🎤 Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Cambio il prezzo di *boh* da 20 a 50 €. *boh*: prezzo da 20,00 € a *50,00 €*»
- titolare: 🎤 Bu costa 40 euro
  - bot: «Intendi il piatto *boh*? Se sì, lo metto a *40 €*.»
- atteso: price|boh|40 · ottenuto: price|boh|50
- **GRAVE** correzione-non-applicata: resta la modifica poi corretta/annullata: price|boh|50
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|boh|40

### bv-asr-005 [GRAVE] — sessione 13:16–13:18 intera
- titolare: 🎤 Quanto costa la pasta al ragù?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. La *pasta al ragù* costa 12 €. *pasta al ragù*: *12,00 €* · disponibile»
- titolare: 🎤 Quanto costa il piatto boh?
  - bot: «Il piatto *boh* costa *20,00 €*. *boh*: *20,00 €* · disponibile»
- titolare: 🎤 Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?
  - bot: «Ok, cambio il prezzo di *boh* a *50 €*. *boh*: prezzo da 20,00 € a *50,00 €*»
- titolare: 🎤 Bu costa 40 euro
  - bot: «Intendi il piatto *boh* per portarlo a *40 €*?»
- titolare: 🎤 Passa il ragù, metti prezzo a 20 euro.
  - bot: «Ok, cambio il prezzo della *pasta al ragù* a *20 €*. *pasta al ragù*: prezzo da 12,00 € a *20,00 €*»
- atteso: price|boh|40, price|pasta al ragù|20 · ottenuto: price|boh|50, price|pasta al ragù|20
- **GRAVE** correzione-non-applicata: resta la modifica poi corretta/annullata: price|boh|50
- **GRAVE** non-applicato: non applicato: price|boh|40

### bv-correzioni-003 [MEDIO] — «la parmigiana» è il nome esatto (l'altro è nascosto); risposta vera: «Quale piatto intendi… Riscrivimi»
- titolare: 🎤 Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Per la *parmigiana* a 15 €, intendi quella nel menu o quella nascosta? Non ancora pubblicato: 1. *tiramisù*: in *promo* a *3,00 €* (prezzo pieno 6,00 €), finché non la togli «la parmigiana»: 1. *la parmigiana* (10,00 €) 2. *Inserisce il piatto la parmigiana* (12,00 €)»
- atteso: price|la parmigiana|15, promo|tiramisù|3 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, promo|tiramisù|3

### bv-correzioni-004 [MEDIO] — il turno 2 corregge: tiramisù a prezzo pieno 10, niente promo
- titolare: 🎤 Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Per la *parmigiana* a 15 €, intendi quella nel menu o quella nascosta? Non ancora pubblicato: 1. *tiramisù*: in *promo* a *3,00 €* (prezzo pieno 6,00 €), finché non la togli «la parmigiana»: 1. *la parmigiana* (10,00 €) 2. *Inserisce il piatto la parmigiana* (12,00 €)»
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Intendi *la parmigiana* nel menu o *Inserisce il piatto la parmigiana* (nascosta)? Il *tiramisù* a 3 € lo imposto appena mi confermi. 1. *la parmigiana* (10,00 €) 2. *Inserisce il piatto la parmigiana* (12,00 €)»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, price|tiramisù|10

### bv-correzioni-005 [MEDIO]
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi *la parmigiana* o *Inserisce il piatto la parmigiana*? 1. *la parmigiana* (10,00 €) 2. *Inserisce il piatto la parmigiana* (12,00 €)»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, price|tiramisù|10

### bv-deixis-003 [MEDIO]
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nascondo *boh* dal menu e il *tiramisù* va a 6 €. C'è già la *parmigiana* a 10 €: la aggiorno o ne creo un altro? Non ancora pubblicato: 1. *boh*: *nascosto* dal menu»
- atteso: hidden|boh|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|boh|true

### bv-asr-004 [MEDIO] — R5.1 (nota 63): l'attesa chiedeva insieme una domanda senza scritture e la rinomina nello stesso turno (impossibile): re
- titolare: 🎤 Cambia il nome del piatto, inserisci la parmigiana.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto vuoi rinominare in *La parmigiana*?»
- atteso: rename|Inserisce il piatto la parmigiana|la parmigiana · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|Inserisce il piatto la parmigiana|la parmigiana

### bv-domande-006 [BASSO] — risposta vera fuori tema («Posso dirti prezzi…»)
- titolare: ❓ ciao
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ciao! Dimmi pure cosa vuoi aggiornare nel menu.»
- titolare: ❓ che locale ho?
  - bot: «Il tuo locale è *Tako*. Il menu digitale che gestisci è il *Menu*, con il Sottomenu *Piatti di prova*.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /verifica web/i

