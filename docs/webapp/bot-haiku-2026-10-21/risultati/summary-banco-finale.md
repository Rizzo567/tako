# Motore Haiku · set banco · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T01:17:15.319Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **77/92 (83.7%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 7 — sicurezza 2, altri 5 |
| MEDI | 8 |
| Domande ogni 10 messaggi | 3.6 (non attese 2.2) |
| Latenza chiamata Haiku p50 / p95 | 2131 / 5495 ms (172 chiamate) |
| Latenza turno p50 / p95 | 12 / 1536 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.15 |
| Token medi per messaggio (in · out · cache read · cache write) | 235 · 385 · 8347 · 89 |
| Cache hit (cache_read > 0) | 171/172 (99.4%) |
| Costo speso in questo giro | 0.003248 $ (tetto 0.2 $) |
| Costo equivalente dal vivo · per messaggio | 0.04626 $ · 0.00031 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 161 · 11 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 26.8 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 4 | 0 | 0 |
| correzione-non-applicata | 3 | 0 | 0 |
| modifica-non-richiesta (sicurezza) | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 9 | 0 |
| in-attesa-ok | 0 | 1 | 0 |
| chiarimento-mancante | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 1 |

## Falliti (trascrizione)

### bv-correzioni-002 [GRAVE]
- titolare: 🎤 Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toiibo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Vuoi aggiornare *Inserisce il piatto la parmigiana* a 10 € o ne creo un altro? Intendi *toiibo*?»
- titolare: 🎤 No, ho detto togli boh.
  - bot: «Ok, tolgo *boh* dal menu. *boh*: *nascosto* dal menu»
- atteso: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true · ottenuto: hidden|boh|true
- **GRAVE** non-applicato: non applicato: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova

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
  - bot: «Metto *tiramisù* e *boh* a 15 €, e *boh* resta nascosto. La *parmigiana* a 10 € resta in sospeso. *tiramisù*: prezzo da 6,00 € a *15,00 €* *boh*: prezzo da 20,00 € a *15,00 €* *boh*: *nascosto* dal menu»
- atteso: hidden|boh|true, price|la parmigiana|15, price|tiramisù|15 · ottenuto: hidden|boh|true, price|boh|15, price|tiramisù|15
- **GRAVE** modifica-non-richiesta: non richiesto: price|boh|15
- **GRAVE** non-applicato: non applicato: price|la parmigiana|15

### bv-deixis-002 [GRAVE] — «rimuovi completamente» = eliminare: si cancella solo dopo «sì», quindi al turno 3 domanda di conferma e niente scrittur
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. C'è già la *parmigiana* a 10 €: la aggiorno a 10 € o ne creo un altro? Non ancora pubblicato: 1. *tiramisù*: prezzo da 6,00 € a *6,00 €* 2. *boh*: *nascosto* dal menu «aggiungi la parmigiana a 10 euro»: 1. *la parmigiana* (10,00 €)»
- titolare: 🎤 Ok, cambia i prezzi di quei due prodotti e mettili entrambi a 15 euro.
  - bot: «Metto *tiramisù* e *boh* a 15 €, e *boh* resta nascosto. La *parmigiana* a 10 € resta in sospeso. *tiramisù*: prezzo da 6,00 € a *15,00 €* *boh*: prezzo da 20,00 € a *15,00 €* *boh*: *nascosto* dal menu»
- titolare: 🎤 Ok, adesso rimuovi completamente quei due piatti.
  - bot: «Quali piatti vuoi eliminare davvero: *tiramisù* e *boh*? Dimmi quale o tutti e due. 1. *tiramisù* (15,00 €) 2. *boh* (15,00 €)»
- atteso: hidden|boh|true, price|la parmigiana|15, price|tiramisù|15 · ottenuto: hidden|boh|true, price|boh|15, price|tiramisù|15
- **GRAVE** modifica-non-richiesta: non richiesto: price|boh|15
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15

### bv-categorie-003 [GRAVE]
- titolare: 🎤 Aggiungi il piatto pasta al sugo a 12 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. C'è già *pasta al ragù* a 12 €: vuoi aggiungere *pasta al sugo* come piatto nuovo, o intendi quello già in menu? In quale Sottomenu lo metto?»
- titolare: 🎤 Ok, adesso devi creare un'altra categoria che si chiama "primi pasti".
  - bot: «Creo il nuovo Sottomenu *primi pasti*. Nuovo sottomenu *Primi pasti*»
- atteso: create|pasta al sugo|12|piatti di prova, section|primi pasti · ottenuto: section|primi pasti
- **GRAVE** non-applicato: non applicato: create|pasta al sugo|12|piatti di prova

### bv-asr-003 [GRAVE] — dopo «Bo» a 50, «Bu costa 40» corregge lo stesso piatto
- titolare: 🎤 Puoi cambiare il prezzo del piatto Bo da 20 euro a 50?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Porto *boh* a 50 €. *boh*: prezzo da 20,00 € a *50,00 €*»
- titolare: 🎤 Bu costa 40 euro
  - bot: «Intendi *boh* a 40 €?»
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

### bv-multiple-006 [MEDIO] — prezzi detti (ognuno +1 €): un solo comando sul gruppo → si applica subito con riepilogo numerato, niente domanda (decis
- titolare: aumenta tutti i piatti della categoria Piatti di prova di un euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aumento di 1 € tutti i piatti del Sottomenu *Piatti di prova*. Rispondi OK per pubblicare. Non ancora pubblicato, da confermare con OK: 1. *Piatto di verifica*: prezzo da 13,50 € a *14,50 €* 2. *Che ne sacc*: prezzo da 20,00 € a *21,00 €* 3. *boh*: prezzo da 20,00 € a *21,00 €* 4. *pasta al ragù*: prezzo da 1»
- atteso: price|Che ne sacc|21, price|Piatto di verifica|14.5, price|boh|21, price|pasta al ragù|13 · ottenuto: nessuna modifica
- **MEDIO** in-attesa-ok: resta in attesa di OK: price|Che ne sacc|21, price|Piatto di verifica|14.5, price|boh|21, price|pasta al ragù|13

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

### bv-asr-001 [MEDIO] — AMBIGUO: «da domani» → il bot non programma: chiedere se cambiarlo subito; «Confirma» (Whisper) = sì
- titolare: 🎤 Il piatto di verifica da domani costa 13,50 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Cambio il prezzo di *Piatto di verifica* a 13,50 €. Confermi? Non ancora pubblicato, da confermare con OK: 1. *Piatto di verifica*: prezzo da 12,00 € a *13,50 €*»
- titolare: 🎤 Confirma.
  - bot: «Ok, pubblico il nuovo prezzo di *Piatto di verifica*. *Piatto di verifica*: prezzo da 12,00 € a *13,50 €*»
- titolare: 🎤 Confirma.
  - bot: «Non vedo nessuna modifica in sospeso da confermare. Cosa vuoi cambiare?»
- titolare: conferma
  - bot: «Non c'è nessuna modifica in attesa. Cosa vuoi cambiare nel menu?»
- atteso: price|Piatto di verifica|13.5 · ottenuto: price|Piatto di verifica|13.5
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

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

