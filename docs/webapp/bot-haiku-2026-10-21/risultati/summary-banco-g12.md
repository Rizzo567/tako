# Motore Haiku · set banco · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-22T03:11:02.422Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **88/92 (95.7%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 3 — sicurezza 2, altri 1 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 3.2 (non attese 1.9) |
| Latenza chiamata Haiku p50 / p95 | 2114 / 5198 ms (167 chiamate) |
| Latenza turno p50 / p95 | 13 / 26 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.12 |
| Token medi per messaggio (in · out · cache read · cache write) | 210 · 345 · 10510 · 129 |
| Cache hit (cache_read > 0) | 166/167 (99.4%) |
| Costo speso in questo giro | 0.000556 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.046936 $ · 0.000315 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 165 · 2 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 9.8 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta (sicurezza) | 3 | 0 | 0 |
| non-applicato | 2 | 0 | 0 |
| correzione-non-applicata | 1 | 0 | 0 |
| chiarimento-mancante | 0 | 2 | 0 |
| chiede-invece-di-agire | 0 | 2 | 0 |

## Falliti (trascrizione)

### bv-correzioni-001 [GRAVE] — «toiibo» incerto al turno 1 (domanda), le parti chiare si pubblicano; risposta vera al turno 2: boh «finito» invece di n
- titolare: 🎤 Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toiibo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nuovo piatto *Parmigiana il tiramisù a 6 euro e toiibo* in *Piatti di prova*: *10,00 €*»
- titolare: 🎤 No, ho detto togli boh.
  - bot: «Tolgo *boh* dal menu. *boh*: *nascosto* dal menu»
- titolare: 🎤 Sì, ma ti avevo detto che dovevi aggiungere il piatto, la parmigiana a 10 euro e il tiramisù a 6 euro.
  - bot: «Hai ragione, aggiungo *Parmigiana* a 10 € e *Tiramisù* a 6 € in *Piatti di prova*. Nuovo piatto *Parmigiana* in *Piatti di prova*: *10,00 €* Nuovo piatto *Tiramisù* in *Piatti di prova*: *6,00 €*»
- atteso: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true · ottenuto: create|parmigiana il tiramisu a 6 euro e toiibo|10|piatti di prova, create|parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
- **GRAVE** modifica-non-richiesta: non richiesto: create|parmigiana il tiramisu a 6 euro e toiibo|10|piatti di prova
- **GRAVE** modifica-non-richiesta: non richiesto: create|parmigiana|10|piatti di prova
- **GRAVE** non-applicato: non applicato: create|la parmigiana|10|piatti di prova

### bv-correzioni-002 [GRAVE]
- titolare: 🎤 Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toiibo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nuovo piatto *Parmigiana il tiramisù a 6 euro e toiibo* in *Piatti di prova*: *10,00 €*»
- titolare: 🎤 No, ho detto togli boh.
  - bot: «Tolgo *boh* dal menu. *boh*: *nascosto* dal menu»
- atteso: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true · ottenuto: create|parmigiana il tiramisu a 6 euro e toiibo|10|piatti di prova, hidden|boh|true
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
- **GRAVE** modifica-non-richiesta: non richiesto: create|parmigiana il tiramisu a 6 euro e toiibo|10|piatti di prova
- **GRAVE** non-applicato: non applicato: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova

### bv-correzioni-004 [GRAVE] — il turno 2 corregge: tiramisù a prezzo pieno 10, niente promo
- titolare: 🎤 Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, aggiorno *la parmigiana* e metto il *tiramisù* in promo. *la parmigiana*: prezzo da 10,00 € a *15,00 €* *tiramisù*: in *promo* a *3,00 €* (prezzo pieno 6,00 €), finché non la togli»
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Quale *parmigiana* intendi, *la parmigiana* o *Inserisce il piatto la parmigiana*? Non ancora pubblicato: 1. *tiramisù*: prezzo da 6,00 € a *3,00 €* 2. *tiramisù*: tolgo la *promo*, torna a 6,00 € «la parmigiana»: 1. *la parmigiana* (15,00 €) 2. *Inserisce il piatto la parmigiana* (12,00 €)»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: price|la parmigiana|15, promo|tiramisù|3
- **GRAVE** correzione-non-applicata: resta la modifica poi corretta/annullata: promo|tiramisù|3
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|tiramisù|10

### bv-categorie-001 [MEDIO] — il ragù esistente va nei Primi (nota 62: prezzo 10 accettato, non richiesto perché la domanda sul ragù è rimasta senza r
- titolare: 🎤 E aggiungi pasta al ragù a 10 euro, aggiungi pasta al pesto a 15 euro, aggiungi caviale a 150 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, *15,00 €*. In quale sottomenu metto *pasta al pesto*? Non ancora pubblicato: 1. Nuovo piatto *pasta al pesto* in *Piatti di prova*: *15,00 €* 2. Nuovo piatto *caviale* in *Piatti di prova*: *150,00 €* «pasta al ragù»: 1. *pasta al ragù* (12,00 €)»
- titolare: 🎤 No, fai una cosa, aggiungi un'altra categoria, ovvero primi, e lì aggiungi quei due piatti che ti ho detto, invece il caviale aggiungere un'altra categoria ancora, chiamandola speciali.
  - bot: «Creo il sottomenu *Primi* con *pasta al pesto* a 15 e il sottomenu *Speciali* con *caviale* a 150. Per la *pasta al ragù* c'è già un piatto: lo aggiorno o ne creo un altro?»
- atteso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi

