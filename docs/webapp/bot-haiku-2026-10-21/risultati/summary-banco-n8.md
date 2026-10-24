# Motore Haiku · set banco · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T21:57:23.378Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **85/92 (92.4%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 4 — sicurezza 0, altri 4 |
| MEDI | 3 |
| Domande ogni 10 messaggi | 3.6 (non attese 2.1) |
| Latenza chiamata Haiku p50 / p95 | 2073 / 5185 ms (174 chiamate) |
| Latenza turno p50 / p95 | 12 / 23 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.17 |
| Token medi per messaggio (in · out · cache read · cache write) | 238 · 350 · 10966 · 118 |
| Cache hit (cache_read > 0) | 173/174 (99.4%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.048189 $ · 0.000323 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 174 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 3.5 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 3 | 0 | 0 |
| correzione-non-applicata | 2 | 0 | 0 |
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
  - bot: «Intendi *la parmigiana* (il piatto visibile) o *Inserisce il piatto la parmigiana* (nascosto)? Dimmi quale e lo metto a 10 €. Non ancora pubblicato: 1. *tiramisù*: prezzo da 6,00 € a *10,00 €* «la parmigiana»: 1. *la parmigiana* (10,00 €) 2. *Inserisce il piatto la parmigiana* (12,00 €)»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, price|tiramisù|10

### bv-deixis-003 [MEDIO]
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Metto *tiramisù* a 6 € e nascondo *boh*. C'è già *la parmigiana* a 10 €: la aggiorno o ne creo un altro? Non ancora pubblicato: 1. *boh*: *nascosto* dal menu «la parmigiana a 10 euro»: 1. *la parmigiana* (10,00 €)»
- atteso: hidden|boh|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|boh|true

### bv-categorie-001 [MEDIO] — il ragù esistente va nei Primi (nota 62: prezzo 10 accettato, non richiesto perché la domanda sul ragù è rimasta senza r
- titolare: 🎤 E aggiungi pasta al ragù a 10 euro, aggiungi pasta al pesto a 15 euro, aggiungi caviale a 150 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiungo *pasta al pesto* a 15 € e *caviale* a 150 €. C'è già *pasta al ragù* a 12 €: lo aggiorno a 10 € o ne creo un altro? Non ancora pubblicato: 1. Nuovo piatto *pasta al pesto* in *Piatti di prova*: *15,00 €* 2. Nuovo piatto *caviale* in *Piatti di prova*: *150,00 €* «pasta al ragù»: 1. *pasta al ragù* (1»
- titolare: 🎤 No, fai una cosa, aggiungi un'altra categoria, ovvero primi, e lì aggiungi quei due piatti che ti ho detto, invece il caviale aggiungere un'altra categoria ancora, chiamandola speciali.
  - bot: «Per «No, fai una cosa, aggiungi un'altra categoria, ovvero primi, e lì aggiungi quei due piatti» mi manca un dettaglio: qual è il nome esatto del piatto (o del sottomenu) e cosa devo cambiare? Per esempio «la carbonara a 12».»
- atteso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi

### bv-domande-006 [BASSO] — risposta vera fuori tema («Posso dirti prezzi…»)
- titolare: ❓ ciao
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ciao! Come posso aiutarti con il menu?»
- titolare: ❓ che locale ho?
  - bot: «Il tuo locale è *Tako*. Nel menu hai il Menu *Piatti di prova*? No: hai il Sottomenu *Piatti di prova* con tre piatti.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /verifica web/i

