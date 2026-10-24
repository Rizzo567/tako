# Motore Haiku · set banco · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T07:56:53.201Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **79/92 (85.9%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 6 — sicurezza 0, altri 6 |
| MEDI | 7 |
| Domande ogni 10 messaggi | 3.4 (non attese 1.9) |
| Latenza chiamata Haiku p50 / p95 | 2050 / 5518 ms (181 chiamate) |
| Latenza turno p50 / p95 | 1999 / 5842 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.21 |
| Token medi per messaggio (in · out · cache read · cache write) | 272 · 397 · 9766 · 94 |
| Cache hit (cache_read > 0) | 180/181 (99.4%) |
| Costo speso in questo giro | 0.039206 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.049921 $ · 0.000335 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 32 · 149 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 351.9 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 5 | 0 | 0 |
| correzione-non-applicata | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 8 | 0 |
| risposta-non-pertinente | 0 | 0 | 1 |

## Falliti (trascrizione)

### bv-multiple-004 [GRAVE]
- titolare: metti Piatto di verifica a 14 euro, Che ne sacc a 21 euro, boh a 21 euro e pasta al ragù a 13 euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiorno quattro prezzi insieme: *Piatto di verifica* a 14, *Che ne sacc* a 21, *boh* a 21 e *pasta al ragù* a 13. Confermi? 1. *Piatto di verifica* (13,00 €) 2. *Che ne sacc* (20,00 €) 3. *boh* (20,00 €) 4. *pasta al ragù* (12,00 €)»
- titolare: ok va bene
  - bot: «Non ho cambiato nulla. 1. *Piatto di verifica* (13,00 €) 2. *Che ne sacc* (20,00 €) 3. *boh* (20,00 €) 4. *pasta al ragù* (12,00 €)»
- atteso: price|Che ne sacc|21, price|Piatto di verifica|14, price|boh|21, price|pasta al ragù|13 · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: price|Che ne sacc|21, price|Piatto di verifica|14, price|boh|21, price|pasta al ragù|13

### bv-correzioni-002 [GRAVE]
- titolare: 🎤 Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toiibo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi *toiibo* come quale piatto? Nel frattempo non ho toccato nulla.»
- titolare: 🎤 No, ho detto togli boh.
  - bot: «Ok, tolgo *boh* dal menu. *boh*: *nascosto* dal menu»
- atteso: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true · ottenuto: hidden|boh|true
- **GRAVE** non-applicato: non applicato: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova

### bv-deixis-001 [GRAVE] — parmigiana e tiramisù ci sono già a 10 e 6: non duplicarli
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. Non salvato: *boh*: *nascosto* dal menu 1. *la parmigiana* (10,00 €)»
- titolare: 🎤 Ok, cambia i prezzi di quei due prodotti e mettili entrambi a 15 euro.
  - bot: «Ok, metto *la parmigiana* e *tiramisù* a 15 euro. *la parmigiana*: prezzo da 10,00 € a *15,00 €* *tiramisù*: prezzo da 6,00 € a *15,00 €*»
- atteso: hidden|boh|true, price|la parmigiana|15, price|tiramisù|15 · ottenuto: price|la parmigiana|15, price|tiramisù|15
- **GRAVE** non-applicato: non applicato: hidden|boh|true

### bv-deixis-003 [GRAVE]
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. Non salvato: *boh*: *nascosto* dal menu 1. *la parmigiana* (10,00 €)»
- atteso: hidden|boh|true · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: hidden|boh|true

### bv-asr-003 [GRAVE] — dopo «Bo» a 50, «Bu costa 40» corregge lo stesso piatto
- titolare: 🎤 Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, aggiorno il prezzo di *boh* a 50 €. *boh*: prezzo da 20,00 € a *50,00 €*»
- titolare: 🎤 Bu costa 40 euro
  - bot: «Intendi il piatto *boh*? Ti chiedo solo per conferma prima di cambiare il prezzo a 40 €.»
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
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Metto il *tiramisù* in promo a 3 €. Quale *parmigiana* intendi: *la parmigiana* o *Inserisce il piatto la parmigiana*? Non ancora pubblicato: 1. *tiramisù*: in *promo* a *3,00 €* (prezzo pieno 6,00 €), finché non la togli «la parmigiana»: 1. *la parmigiana* (10,00 €) 2. *Inserisce il piatto la parmigiana* (12»
- atteso: price|la parmigiana|15, promo|tiramisù|3 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, promo|tiramisù|3

### bv-correzioni-004 [MEDIO] — il turno 2 corregge: tiramisù a prezzo pieno 10, niente promo
- titolare: 🎤 Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Metto il *tiramisù* in promo a 3 €. Quale *parmigiana* intendi: *la parmigiana* o *Inserisce il piatto la parmigiana*? Non ancora pubblicato: 1. *tiramisù*: in *promo* a *3,00 €* (prezzo pieno 6,00 €), finché non la togli «la parmigiana»: 1. *la parmigiana* (10,00 €) 2. *Inserisce il piatto la parmigiana* (12»
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Il *tiramisù* lo metto a 10 €. Per la parmigiana rispondi con il numero: 1. *la parmigiana* 2. *Inserisce il piatto la parmigiana*. Dimmi anche il prezzo che vuoi, 15 € o 7 €? Non ancora pubblicato: 1. *tiramisù*: prezzo da 6,00 € a *10,00 €*»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, price|tiramisù|10

### bv-correzioni-005 [MEDIO]
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Prima di toccare i prezzi: il *10 €* lo metto al *tiramisù* o alla *parmigiana*? E quale *parmigiana* intendi, quella a 10 € o quella nascosta?»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, price|tiramisù|10

### bv-correzioni-006 [MEDIO] — AMBIGUO: turno 1 «pasta al pesto e lasagna» uno o due piatti, senza prezzo; turno 2 due piatti senza prezzo. Risposta ve
- titolare: 🎤 Allora aggiungi il piatto pasta al pesto e lasagna.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. A che prezzo li aggiungo: *pasta al pesto* e *lasagna*?»
- titolare: 🎤 No, pasta al pesto e lasagna sono due piatti separati.
  - bot: «Ok, sono due piatti separati. Quanto costano *pasta al pesto* e *lasagna*?»
- titolare: 🎤 Uno deve essere a 10 euro e uno deve essere a 20 euro.
  - bot: «Quale dei due è a *10 €* e quale a *20 €*: *pasta al pesto* o *lasagna*?»
- atteso: create|lasagna|20|piatti di prova, create|pasta al pesto|10|piatti di prova · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|lasagna|20|piatti di prova, create|pasta al pesto|10|piatti di prova

### bv-deixis-002 [MEDIO] — «rimuovi completamente» = eliminare: si cancella solo dopo «sì», quindi al turno 3 domanda di conferma e niente scrittur
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. Non salvato: *boh*: *nascosto* dal menu 1. *la parmigiana* (10,00 €)»
- titolare: 🎤 Ok, cambia i prezzi di quei due prodotti e mettili entrambi a 15 euro.
  - bot: «Ok, metto *la parmigiana* e *tiramisù* a 15 euro. *la parmigiana*: prezzo da 10,00 € a *15,00 €* *tiramisù*: prezzo da 6,00 € a *15,00 €*»
- titolare: 🎤 Ok, adesso rimuovi completamente quei due piatti.
  - bot: «Elimino *la parmigiana* e *tiramisù* dal menu? Rispondi sì. Da eliminare, serve il tuo sì: 1. *la parmigiana*: da eliminare 2. *tiramisù*: da eliminare»
- atteso: hidden|boh|true, price|la parmigiana|15, price|tiramisù|15 · ottenuto: price|la parmigiana|15, price|tiramisù|15
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|boh|true

### bv-categorie-001 [MEDIO] — il ragù esistente va nei Primi (nota 62: prezzo 10 accettato, non richiesto perché la domanda sul ragù è rimasta senza r
- titolare: 🎤 E aggiungi pasta al ragù a 10 euro, aggiungi pasta al pesto a 15 euro, aggiungi caviale a 150 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Preparo *pasta al pesto* a 15 € e *caviale* a 150 €. Per la *pasta al ragù*, che c'è già a 12 €: la aggiorno a 10 € o ne creo un altro? Non ancora pubblicato: 1. Nuovo piatto *pasta al pesto* in *Piatti di prova*: *15,00 €* 2. Nuovo piatto *caviale* in *Piatti di prova*: *150,00 €* «pasta al ragù a 10 euro»: »
- titolare: 🎤 No, fai una cosa, aggiungi un'altra categoria, ovvero primi, e lì aggiungi quei due piatti che ti ho detto, invece il caviale aggiungere un'altra categoria ancora, chiamandola speciali.
  - bot: «Creo il sottomenu *Primi* con *pasta al pesto* a 15 € e il sottomenu *Speciali* con *caviale* a 150 €. Per la *pasta al ragù*, la aggiorno a 10 € o ne creo un altro?»
- atteso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi

### bv-asr-004 [MEDIO] — R5.1 (nota 63): l'attesa chiedeva insieme una domanda senza scritture e la rinomina nello stesso turno (impossibile): re
- titolare: 🎤 Cambia il nome del piatto, inserisci la parmigiana.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale Piatto vuoi rinominare in *La parmigiana*?»
- atteso: rename|Inserisce il piatto la parmigiana|la parmigiana · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|Inserisce il piatto la parmigiana|la parmigiana

### bv-domande-006 [BASSO] — risposta vera fuori tema («Posso dirti prezzi…»)
- titolare: ❓ ciao
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ciao! Dimmi pure cosa vuoi aggiornare nel menu.»
- titolare: ❓ che locale ho?
  - bot: «Il tuo locale è *Tako*. Nel menu digitale hai il Menu *Menu*, con il Sottomenu *Piatti di prova*.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-non-pertinente: risposta finale senza /verifica web/i

