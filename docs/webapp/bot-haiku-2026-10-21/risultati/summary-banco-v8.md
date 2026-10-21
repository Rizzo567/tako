# Motore Haiku · set banco · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T10:49:51.948Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **83/92 (90.2%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 4 — sicurezza 1, altri 3 |
| MEDI | 5 |
| Domande ogni 10 messaggi | 3.4 (non attese 1.9) |
| Latenza chiamata Haiku p50 / p95 | 1762 / 5378 ms (169 chiamate) |
| Latenza turno p50 / p95 | 13 / 69 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.13 |
| Token medi per messaggio (in · out · cache read · cache write) | 217 · 346 · 9727 · 108 |
| Cache hit (cache_read > 0) | 168/169 (99.4%) |
| Costo speso in questo giro | 0.001512 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.045527 $ · 0.000306 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 163 · 6 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 13.4 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 3 | 0 | 0 |
| modifica-sbagliata (sicurezza) | 2 | 0 | 0 |
| correzione-non-applicata | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 6 | 0 |
| risposta-non-pertinente | 0 | 0 | 1 |

## Falliti (trascrizione)

### bv-correzioni-002 [GRAVE]
- titolare: 🎤 Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toiibo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiungo *Tiramisù* a 6 €. C'è già *Inserisce il piatto la parmigiana* nel menu: lo aggiorno al nuovo prezzo o ne creo un altro? Intendi qualcosa con *toiibo*? Non ancora pubblicato: 1. Nuovo piatto *Tiramisù* in *Piatti di prova*: *6,00 €* «parmigiana»: 1. *Inserisce il piatto la parmigiana* (12,00 €)»
- titolare: 🎤 No, ho detto togli boh.
  - bot: «Ok, nascondo *boh* dal menu. Nuovo piatto *Tiramisù* in *Piatti di prova*: *6,00 €* *boh*: *nascosto* dal menu»
- atteso: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true · ottenuto: create|tiramisu|6|piatti di prova, hidden|boh|true
- **GRAVE** non-applicato: non applicato: create|la parmigiana|10|piatti di prova

### bv-categorie-001 [GRAVE] — il ragù esistente va nei Primi (nota 62: prezzo 10 accettato, non richiesto perché la domanda sul ragù è rimasta senza r
- titolare: 🎤 E aggiungi pasta al ragù a 10 euro, aggiungi pasta al pesto a 15 euro, aggiungi caviale a 150 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. C'è già *pasta al ragù* a 12 €: la aggiorno a 10 € o ne creo un altro? Intanto preparo *pasta al pesto* a 15 € e *caviale* a 150 €. Non ancora pubblicato: 1. Nuovo piatto *pasta al pesto* in *Piatti di prova*: *15,00 €* 2. Nuovo piatto *caviale* in *Piatti di prova*: *150,00 €* «pasta al ragù a 10 euro»: 1. *»
- titolare: 🎤 No, fai una cosa, aggiungi un'altra categoria, ovvero primi, e lì aggiungi quei due piatti che ti ho detto, invece il caviale aggiungere un'altra categoria ancora, chiamandola speciali.
  - bot: «Ok, creo il Sottomenu *Primi* e il Sottomenu *Speciali* nel Menu. Poi sistemo i piatti. Nuovo piatto *pasta al pesto* in *Piatti di prova*: *15,00 €* Nuovo piatto *caviale* in *Piatti di prova*: *150,00 €* Nuovo Sottomenu *Primi* nel Menu *Menu* Nuovo Sottomenu *Speciali* nel Menu *Menu*»
- atteso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi · ottenuto: create|caviale|150|piatti di prova, create|pasta al pesto|15|piatti di prova
- **GRAVE** modifica-sbagliata: valore sbagliato: create|caviale|150|piatti di prova
- **GRAVE** modifica-sbagliata: valore sbagliato: create|pasta al pesto|15|piatti di prova
- **GRAVE** non-applicato: non applicato: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi

### bv-asr-003 [GRAVE] — dopo «Bo» a 50, «Bu costa 40» corregge lo stesso piatto
- titolare: 🎤 Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Cambio il prezzo di *boh* da 20 a 50 €. *boh*: prezzo da 20,00 € a *50,00 €*»
- titolare: 🎤 Bu costa 40 euro
  - bot: «Intendi *boh*? Lo metto a 40 €.»
- atteso: price|boh|40 · ottenuto: price|boh|50
- **GRAVE** correzione-non-applicata: resta la modifica poi corretta/annullata: price|boh|50
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|boh|40

### bv-asr-005 [GRAVE] — sessione 13:16–13:18 intera
- titolare: 🎤 Quanto costa la pasta al ragù?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. La *pasta al ragù* costa 12 €. *pasta al ragù*: *12,00 €* · disponibile»
- titolare: 🎤 Quanto costa il piatto boh?
  - bot: «*boh* costa *20,00 €*. *boh*: *20,00 €* · disponibile»
- titolare: 🎤 Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?
  - bot: «Cambio il prezzo di *boh* da 20 a 50 €. *boh*: prezzo da 20,00 € a *50,00 €*»
- titolare: 🎤 Bu costa 40 euro
  - bot: «Intendi il piatto *boh*? Dimmi sì o indica il nome giusto.»
- titolare: 🎤 Passa il ragù, metti prezzo a 20 euro.
  - bot: «Cambio il prezzo di *pasta al ragù* da 12 a 20 €. *pasta al ragù*: prezzo da 12,00 € a *20,00 €*»
- atteso: price|boh|40, price|pasta al ragù|20 · ottenuto: price|boh|50, price|pasta al ragù|20
- **GRAVE** correzione-non-applicata: resta la modifica poi corretta/annullata: price|boh|50
- **GRAVE** non-applicato: non applicato: price|boh|40

### bv-correzioni-003 [MEDIO] — «la parmigiana» è il nome esatto (l'altro è nascosto); risposta vera: «Quale piatto intendi… Riscrivimi»
- titolare: 🎤 Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Metto il *Tiramisù* in promo a 3 €. Quale *parmigiana* intendi a 15 €? Non ancora pubblicato: 1. *tiramisù*: in *promo* a *3,00 €* (prezzo pieno 6,00 €), finché non la togli «la parmigiana»: 1. *la parmigiana* (10,00 €) 2. *Inserisce il piatto la parmigiana* (12,00 €)»
- atteso: price|la parmigiana|15, promo|tiramisù|3 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, promo|tiramisù|3

### bv-correzioni-004 [MEDIO] — il turno 2 corregge: tiramisù a prezzo pieno 10, niente promo
- titolare: 🎤 Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Metto il *Tiramisù* in promo a 3 €. Quale *parmigiana* intendi a 15 €? Non ancora pubblicato: 1. *tiramisù*: in *promo* a *3,00 €* (prezzo pieno 6,00 €), finché non la togli «la parmigiana»: 1. *la parmigiana* (10,00 €) 2. *Inserisce il piatto la parmigiana* (12,00 €)»
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Quale *parmigiana* intendi a *10 €*? Il *Tiramisù* a *3 €* lo metto in promo appena mi confermi. 1. *la parmigiana* (10,00 €) 2. *Inserisce il piatto la parmigiana* (12,00 €)»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, price|tiramisù|10

### bv-correzioni-005 [MEDIO]
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale *parmigiana* intendi, e a quale prezzo: *10 €* o *15 €*?»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, price|tiramisù|10

### bv-deixis-003 [MEDIO]
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Tolgo *boh* dal menu. C'è già *la parmigiana* a 10 €: la aggiorno o ne creo un altro? Non ancora pubblicato: 1. *boh*: *nascosto* dal menu «la parmigiana»: 1. *la parmigiana* (10,00 €)»
- atteso: hidden|boh|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|boh|true

### bv-asr-004 [MEDIO] — R5.1 (nota 63): l'attesa chiedeva insieme una domanda senza scritture e la rinomina nello stesso turno (impossibile): re
- titolare: 🎤 Cambia il nome del piatto, inserisci la parmigiana.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto vuoi rinominare? Intendi *Inserisce il piatto la parmigiana*?»
- atteso: rename|Inserisce il piatto la parmigiana|la parmigiana · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|Inserisce il piatto la parmigiana|la parmigiana

### bv-domande-006 [BASSO] — risposta vera fuori tema («Posso dirti prezzi…»)
- titolare: ❓ ciao
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ciao! Dimmi pure cosa vuoi aggiornare nel menu.»
- titolare: ❓ che locale ho?
  - bot: «Il tuo locale si chiama *Tako*. Nel menu c'è il Sottomenu *Piatti di prova* con tre Piatti.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /verifica web/i

