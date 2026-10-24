# Motore Haiku · set banco · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T15:50:31.024Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **84/92 (91.3%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 5 — sicurezza 0, altri 5 |
| MEDI | 3 |
| Domande ogni 10 messaggi | 3.4 (non attese 1.9) |
| Latenza chiamata Haiku p50 / p95 | 2072 / 5185 ms (172 chiamate) |
| Latenza turno p50 / p95 | 18 / 58 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.15 |
| Token medi per messaggio (in · out · cache read · cache write) | 231 · 351 · 10911 · 46 |
| Cache hit (cache_read > 0) | 172/172 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.046716 $ · 0.000314 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 172 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 5 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 3 | 0 | 0 |
| correzione-non-applicata | 2 | 0 | 0 |
| richiesta-persa | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 4 | 0 |
| risposta-non-pertinente | 0 | 0 | 1 |

## Falliti (trascrizione)

### bv-correzioni-002 [GRAVE]
- titolare: 🎤 Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toiibo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiungo il *Tiramisù* a 6 €. C'è già *Inserisce il piatto la parmigiana* a 12 €: lo aggiorno o ne creo un altro? Intendi quale piatto con *toiibo*? Non ancora pubblicato: 1. Nuovo piatto *Tiramisù* in *Piatti di prova*: *6,00 €* «la parmigiana»: 1. *Inserisce il piatto la parmigiana* (12,00 €)»
- titolare: 🎤 No, ho detto togli boh.
  - bot: «Nascondo *boh* dal menu. *boh*: *nascosto* dal menu»
- atteso: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true · ottenuto: hidden|boh|true
- **GRAVE** non-applicato: non applicato: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova

### bv-correzioni-003 [GRAVE] — «la parmigiana» è il nome esatto (l'altro è nascosto); risposta vera: «Quale piatto intendi… Riscrivimi»
- titolare: 🎤 Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non ho cambiato nulla.* Il prezzo promo di *la parmigiana* (15,00 €) deve essere *più basso del prezzo pieno* (10,00 €) e maggiore di zero.»
- atteso: price|la parmigiana|15, promo|tiramisù|3 · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: price|la parmigiana|15, promo|tiramisù|3

### bv-categorie-001 [GRAVE] — il ragù esistente va nei Primi (nota 62: prezzo 10 accettato, non richiesto perché la domanda sul ragù è rimasta senza r
- titolare: 🎤 E aggiungi pasta al ragù a 10 euro, aggiungi pasta al pesto a 15 euro, aggiungi caviale a 150 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiungo *pasta al pesto* a 15 € e *caviale* a 150 €. C'è già *pasta al ragù* a 12 €: lo aggiorno a 10 € o ne creo un altro? Non ancora pubblicato: 1. Nuovo piatto *pasta al pesto* in *Piatti di prova*: *15,00 €* 2. Nuovo piatto *caviale* in *Piatti di prova*: *150,00 €* «pasta al ragù»: 1. *pasta al ragù* (1»
- titolare: 🎤 No, fai una cosa, aggiungi un'altra categoria, ovvero primi, e lì aggiungi quei due piatti che ti ho detto, invece il caviale aggiungere un'altra categoria ancora, chiamandola speciali.
  - bot: «Non trovo il sottomenu *Primi* in *Piatti di prova*: vuoi che lo crei, o metto *pasta al pesto* in un sottomenu che esiste già?»
- atteso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi · ottenuto: nessuna modifica
- **GRAVE** richiesta-persa: richiesta persa: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi

### bv-asr-003 [GRAVE] — dopo «Bo» a 50, «Bu costa 40» corregge lo stesso piatto
- titolare: 🎤 Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Passo *boh* a 50 €. *boh*: prezzo da 20,00 € a *50,00 €*»
- titolare: 🎤 Bu costa 40 euro
  - bot: «Intendi il piatto *boh*? Lo metto a 40 €.»
- atteso: price|boh|40 · ottenuto: price|boh|50
- **GRAVE** correzione-non-applicata: resta la modifica poi corretta/annullata: price|boh|50
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|boh|40

### bv-asr-005 [GRAVE] — sessione 13:16–13:18 intera
- titolare: 🎤 Quanto costa la pasta al ragù?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. La *pasta al ragù* costa 12 €. *pasta al ragù*: *12,00 €* · disponibile»
- titolare: 🎤 Quanto costa il piatto boh?
  - bot: «Il piatto *boh* costa *20,00 €*. *boh*: *20,00 €* · disponibile»
- titolare: 🎤 Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?
  - bot: «Cambio il prezzo di *boh* da 20 a 50 euro. *boh*: prezzo da 20,00 € a *50,00 €*»
- titolare: 🎤 Bu costa 40 euro
  - bot: «Intendi il piatto *boh* per portarlo a 40 euro?»
- titolare: 🎤 Passa il ragù, metti prezzo a 20 euro.
  - bot: «Cambio il prezzo della *pasta al ragù* a 20 euro. *pasta al ragù*: prezzo da 12,00 € a *20,00 €*»
- atteso: price|boh|40, price|pasta al ragù|20 · ottenuto: price|boh|50, price|pasta al ragù|20
- **GRAVE** correzione-non-applicata: resta la modifica poi corretta/annullata: price|boh|50
- **GRAVE** non-applicato: non applicato: price|boh|40

### bv-correzioni-004 [MEDIO] — il turno 2 corregge: tiramisù a prezzo pieno 10, niente promo
- titolare: 🎤 Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non ho cambiato nulla.* Il prezzo promo di *la parmigiana* (15,00 €) deve essere *più basso del prezzo pieno* (10,00 €) e maggiore di zero.»
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Intendi *la parmigiana* (il piatto visibile) o *Inserisce il piatto la parmigiana* (nascosto)? Dimmi quale e lo metto a 10 €. 1. *la parmigiana* (10,00 €) 2. *Inserisce il piatto la parmigiana* (12,00 €)»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, price|tiramisù|10

### bv-correzioni-005 [MEDIO]
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi *la parmigiana* o *il tiramisù* a *10 €*?»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, price|tiramisù|10

### bv-deixis-003 [MEDIO]
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Metto *tiramisù* a 6 € e nascondo *boh*. C'è già *la parmigiana* a 10 €: la aggiorno o ne creo un altro? Non ancora pubblicato: 1. *boh*: *nascosto* dal menu «la parmigiana a 10 euro»: 1. *la parmigiana* (10,00 €)»
- atteso: hidden|boh|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|boh|true

### bv-domande-006 [BASSO] — risposta vera fuori tema («Posso dirti prezzi…»)
- titolare: ❓ ciao
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ciao! Come posso aiutarti con il menu?»
- titolare: ❓ che locale ho?
  - bot: «Il tuo locale è *Tako*. Nel menu hai il Menu *Piatti di prova*? No: hai il Sottomenu *Piatti di prova* con tre piatti.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /verifica web/i

