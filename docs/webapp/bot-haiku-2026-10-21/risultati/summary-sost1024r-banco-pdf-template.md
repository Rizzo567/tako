# Motore Haiku · set banco · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-24T17:39:26.137Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **74/92 (80.4%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 13 — sicurezza 13, altri 0 |
| MEDI | 5 |
| Domande ogni 10 messaggi | 3 (non attese 1.7) |
| Latenza chiamata Haiku p50 / p95 | 2299 / 5363 ms (158 chiamate) |
| Latenza turno p50 / p95 | 15 / 47 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.06 |
| Token medi per messaggio (in · out · cache read · cache write) | 209 · 360 · 10148 · 114 |
| Cache hit (cache_read > 0) | 157/158 (99.4%) |
| Costo speso in questo giro | 0.000811 $ (tetto 0.6 $) |
| Costo equivalente dal vivo · per messaggio | 0.047188 $ · 0.000317 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 154 · 4 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 16.5 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta (sicurezza) | 15 | 0 | 0 |
| non-applicato | 6 | 0 | 0 |
| richiesta-persa | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 8 | 0 |
| chiarimento-mancante | 0 | 2 | 0 |
| in-attesa-ok | 0 | 1 | 0 |

## Falliti (trascrizione)

### bv-semplici-003 [GRAVE]
- titolare: 🎤 Nascondi il polpo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Polpo rucola e patate*: *eliminato* dal menu Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: conferma
  - bot: «Cosa vuoi cambiare? Scrivimi il piatto e la modifica, per esempio «la carbonara a 12».»
- atteso: hidden|Polpo rucola e patate|true · ottenuto: delete|Polpo rucola e patate
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Polpo rucola e patate
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Polpo rucola e patate|true

### bv-semplici-010 [GRAVE]
- titolare: nascondi il piatto di verifica
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ho tolto *Piatto di verifica* dal menu. *Piatto di verifica*: *eliminato* dal menu Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: hidden|Piatto di verifica|true · ottenuto: delete|Piatto di verifica
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Piatto di verifica
- **GRAVE** non-applicato: non applicato: hidden|Piatto di verifica|true

### bv-semplici-017 [GRAVE]
- titolare: 🎤 Vai, nascondi la pasta del ragù.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, tolgo la *pasta al ragù* dal menu. *pasta al ragù*: *eliminato* dal menu Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: hidden|pasta al ragù|true · ottenuto: delete|pasta al ragù
- **GRAVE** modifica-non-richiesta: non richiesto: delete|pasta al ragù
- **GRAVE** non-applicato: non applicato: hidden|pasta al ragù|true

### bv-multiple-007 [GRAVE] — «la parmigiana» = l'unico piatto con parmigiana; kenesac = Che ne sacc
- titolare: 🎤 Allora, voglio che mi nascondi la parmigiana tra i piatti del menù e mi metti in sconto il kenesac a 12 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Inserisce il piatto la parmigiana*: *eliminato* dal menu *Che ne sacc*: in *promo* a *12,00 €* (prezzo pieno 20,00 €), finché non la togli Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: hidden|Inserisce il piatto la parmigiana|true, promo|Che ne sacc|12 · ottenuto: delete|Inserisce il piatto la parmigiana, promo|Che ne sacc|12
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Inserisce il piatto la parmigiana
- **GRAVE** non-applicato: non applicato: hidden|Inserisce il piatto la parmigiana|true

### bv-multiple-008 [GRAVE]
- titolare: 🎤 Allora, voglio che mi nascondi la parmigiana tra i piatti del menù e mi metti in sconto il kenesac a 12 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Inserisce il piatto la parmigiana*: *eliminato* dal menu *Che ne sacc*: in *promo* a *12,00 €* (prezzo pieno 20,00 €), finché non la togli Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: 🎤 Allora, voglio che mi nascondi dal menù il piatto la parmigiana e invece mi metti in promo il piatto di verifica a 11 euro.
  - bot: «Non trovo *la parmigiana* nel menu. Quale piatto vuoi nascondere, e confermo anche la promo di *Piatto di verifica* a 11 €? Non ancora pubblicato: 1. *Piatto di verifica*: in *promo* a *11,00 €* (prezzo pieno 13,50 €), finché non la togli»
- atteso: hidden|Inserisce il piatto la parmigiana|true, promo|Che ne sacc|12, promo|Piatto di verifica|11 · ottenuto: delete|Inserisce il piatto la parmigiana, promo|Che ne sacc|12
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Inserisce il piatto la parmigiana
- **GRAVE** richiesta-persa: richiesta persa: hidden|Inserisce il piatto la parmigiana|true, promo|Piatto di verifica|11

### bv-correzioni-001 [GRAVE] — «toiibo» incerto al turno 1 (domanda), le parti chiare si pubblicano; risposta vera al turno 2: boh «finito» invece di n
- titolare: 🎤 Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toiibo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, *10,00 €*. In quale sottomenu metto *Parmigiana*? Non ancora pubblicato: 1. Nuovo piatto *Parmigiana* in *Piatti di prova*: *10,00 €* 2. Nuovo piatto *Tiramisù* in *Piatti di prova*: *6,00 €*»
- titolare: 🎤 No, ho detto togli boh.
  - bot: «Ok, tolgo *boh* dal menu. Il *Parmigiana* e il *Tiramisù* restano in sospeso: dimmi se li pubblico. Nuovo piatto *Parmigiana* in *Piatti di prova*: *10,00 €* Nuovo piatto *Tiramisù* in *Piatti di prova*: *6,00 €* *boh*: *eliminato* dal menu Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: 🎤 Sì, ma ti avevo detto che dovevi aggiungere il piatto, la parmigiana a 10 euro e il tiramisù a 6 euro.
  - bot: «*Parmigiana* e *Tiramisù* sono già nel menu di *Piatti di prova*. Li lascio così o ne creo degli altri due? 1. *Parmigiana* (10,00 €) 2. *Tiramisù* (6,00 €)»
- atteso: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true · ottenuto: create|parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, delete|boh
- **GRAVE** modifica-non-richiesta: non richiesto: create|parmigiana|10|piatti di prova
- **GRAVE** modifica-non-richiesta: non richiesto: delete|boh
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|la parmigiana|10|piatti di prova, hidden|boh|true

### bv-correzioni-002 [GRAVE]
- titolare: 🎤 Aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e toiibo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, *10,00 €*. In quale sottomenu metto *Parmigiana*? Non ancora pubblicato: 1. Nuovo piatto *Parmigiana* in *Piatti di prova*: *10,00 €* 2. Nuovo piatto *Tiramisù* in *Piatti di prova*: *6,00 €*»
- titolare: 🎤 No, ho detto togli boh.
  - bot: «Ok, tolgo *boh* dal menu. Il *Parmigiana* e il *Tiramisù* restano in sospeso: dimmi se li pubblico. Nuovo piatto *Parmigiana* in *Piatti di prova*: *10,00 €* Nuovo piatto *Tiramisù* in *Piatti di prova*: *6,00 €* *boh*: *eliminato* dal menu Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: create|la parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, hidden|boh|true · ottenuto: create|parmigiana|10|piatti di prova, create|tiramisu|6|piatti di prova, delete|boh
- **GRAVE** modifica-non-richiesta: non richiesto: create|parmigiana|10|piatti di prova
- **GRAVE** modifica-non-richiesta: non richiesto: delete|boh
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|la parmigiana|10|piatti di prova, hidden|boh|true

### bv-deixis-001 [GRAVE] — parmigiana e tiramisù ci sono già a 10 e 6: non duplicarli
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ho tolto *boh* dal menu. *boh*: *eliminato* dal menu *tiramisù* è già a *6 €*. Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: 🎤 Ok, cambia i prezzi di quei due prodotti e mettili entrambi a 15 euro.
  - bot: «Metto *la parmigiana* e *il tiramisù* a *15 €*. *la parmigiana*: prezzo da 10,00 € a *15,00 €* *tiramisù*: prezzo da 6,00 € a *15,00 €*»
- atteso: hidden|boh|true, price|la parmigiana|15, price|tiramisù|15 · ottenuto: delete|boh, price|la parmigiana|15, price|tiramisù|15
- **GRAVE** modifica-non-richiesta: non richiesto: delete|boh
- **GRAVE** non-applicato: non applicato: hidden|boh|true

### bv-deixis-002 [GRAVE] — «rimuovi completamente» = eliminare: si cancella solo dopo «sì», quindi al turno 3 domanda di conferma e niente scrittur
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ho tolto *boh* dal menu. *boh*: *eliminato* dal menu *tiramisù* è già a *6 €*. Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: 🎤 Ok, cambia i prezzi di quei due prodotti e mettili entrambi a 15 euro.
  - bot: «Metto *la parmigiana* e *il tiramisù* a *15 €*. *la parmigiana*: prezzo da 10,00 € a *15,00 €* *tiramisù*: prezzo da 6,00 € a *15,00 €*»
- titolare: 🎤 Ok, adesso rimuovi completamente quei due piatti.
  - bot: «Elimino *la parmigiana* e *tiramisù* dal menu? Rispondi sì. Da eliminare, serve il tuo sì: 1. *la parmigiana*: da eliminare 2. *tiramisù*: da eliminare»
- atteso: hidden|boh|true, price|la parmigiana|15, price|tiramisù|15 · ottenuto: delete|boh, price|la parmigiana|15, price|tiramisù|15
- **GRAVE** modifica-non-richiesta: non richiesto: delete|boh
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|boh|true

### bv-deixis-003 [GRAVE]
- titolare: 🎤 Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ho tolto *boh* dal menu. *boh*: *eliminato* dal menu *tiramisù* è già a *6 €*. Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: hidden|boh|true · ottenuto: delete|boh
- **GRAVE** modifica-non-richiesta: non richiesto: delete|boh
- **GRAVE** non-applicato: non applicato: hidden|boh|true

### bv-elimina-001 [GRAVE] — «cancellare» → chiedere conferma dell'eliminazione; Manuel poi sceglie di nascondere
- titolare: 🎤 Puoi cancellare il polpo?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Elimino *Polpo rucola e patate* dal menu? Rispondi sì. Da eliminare, serve il tuo sì: 1. *Polpo rucola e patate*: da eliminare»
- titolare: 🎤 Nascondi il polpo.
  - bot: «*Polpo rucola e patate*: *eliminato* dal menu Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: conferma
  - bot: «Non c'è nulla in sospeso da confermare. Dimmi quale modifica vuoi fare al menu?»
- atteso: hidden|Polpo rucola e patate|true · ottenuto: delete|Polpo rucola e patate
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Polpo rucola e patate
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Polpo rucola e patate|true

### bv-elimina-003 [GRAVE] — elimina → conferma; poi «nascondi» vince
- titolare: 🎤 Elimina il piatto pasta al ragù.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Elimino la *pasta al ragù* dal menu? Rispondi sì. Da eliminare, serve il tuo sì: 1. *pasta al ragù*: da eliminare»
- titolare: 🎤 Vai, nascondi la pasta del ragù.
  - bot: «*pasta al ragù*: *eliminato* dal menu Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: hidden|pasta al ragù|true · ottenuto: delete|pasta al ragù
- **GRAVE** modifica-non-richiesta: non richiesto: delete|pasta al ragù
- **GRAVE** non-applicato: non applicato: hidden|pasta al ragù|true

### bv-annulla-006 [GRAVE]
- titolare: nascondi il piatto di verifica
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ho tolto *Piatto di verifica* dal menu. *Piatto di verifica*: *eliminato* dal menu Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: mostra il piatto di verifica
  - bot: «Quale piatto devo rimettere nel menu? *Piatto di verifica* non lo trovo: intendi *Che ne sacc*?»
- atteso: nessuna modifica · ottenuto: delete|Piatto di verifica
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Piatto di verifica

### bv-correzioni-003 [MEDIO] — «la parmigiana» è il nome esatto (l'altro è nascosto); risposta vera: «Quale piatto intendi… Riscrivimi»
- titolare: 🎤 Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Metto il *tiramisù* in promo a 3 €. Per la parmigiana intendi *la parmigiana* o *Inserisce il piatto la parmigiana*? Non ancora pubblicato: 1. *tiramisù*: in *promo* a *3,00 €* (prezzo pieno 6,00 €), finché non la togli «la parmigiana»: 1. *la parmigiana* (10,00 €) 2. *Inserisce il piatto la parmigiana* (12,0»
- atteso: price|la parmigiana|15, promo|tiramisù|3 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, promo|tiramisù|3

### bv-correzioni-004 [MEDIO] — il turno 2 corregge: tiramisù a prezzo pieno 10, niente promo
- titolare: 🎤 Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Metto il *tiramisù* in promo a 3 €. Per la parmigiana intendi *la parmigiana* o *Inserisce il piatto la parmigiana*? Non ancora pubblicato: 1. *tiramisù*: in *promo* a *3,00 €* (prezzo pieno 6,00 €), finché non la togli «la parmigiana»: 1. *la parmigiana* (10,00 €) 2. *Inserisce il piatto la parmigiana* (12,0»
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Metto il *tiramisù* a 10 €. Per la *parmigiana* intendi *la parmigiana* o *Inserisce il piatto la parmigiana*? Ho scritto 15 €: lo confermi? Non ancora pubblicato: 1. *tiramisù*: prezzo da 6,00 € a *10,00 €*»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|15, price|tiramisù|10

### bv-correzioni-006 [MEDIO] — AMBIGUO: turno 1 «pasta al pesto e lasagna» uno o due piatti, senza prezzo; turno 2 due piatti senza prezzo. Risposta ve
- titolare: 🎤 Allora aggiungi il piatto pasta al pesto e lasagna.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. In quale sottomenu metto *Pasta al pesto* e a che prezzo?»
- titolare: 🎤 No, pasta al pesto e lasagna sono due piatti separati.
  - bot: «Ok, me lo ricordo: «pasta al pesto e lasagna» sono 2 piatti separati. Nel menu non ho trovato niente da dividere: la prossima volta li divido da solo.»
- titolare: 🎤 Uno deve essere a 10 euro e uno deve essere a 20 euro.
  - bot: «Quale dei due piatti va a *10 €* e quale a *20 €*?»
- atteso: create|lasagna|20|piatti di prova, create|pasta al pesto|10|piatti di prova · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 2: doveva chiedere un chiarimento («Ok, me lo ricordo: «pasta al pesto e lasagna» sono 2 piatti separati. Nel menu n»)
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|lasagna|20|piatti di prova, create|pasta al pesto|10|piatti di prova

### bv-correzioni-007 [MEDIO] — AMBIGUO: mancano i prezzi di entrambi: una domanda (mai prezzi inventati)
- titolare: 🎤 Allora aggiungi il piatto pasta al pesto e lasagna.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. In quale sottomenu metto *Pasta al pesto* e a che prezzo?»
- titolare: 🎤 No, pasta al pesto e lasagna sono due piatti separati.
  - bot: «Ok, me lo ricordo: «pasta al pesto e lasagna» sono 2 piatti separati. Nel menu non ho trovato niente da dividere: la prossima volta li divido da solo.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 2: doveva chiedere un chiarimento («Ok, me lo ricordo: «pasta al pesto e lasagna» sono 2 piatti separati. Nel menu n»)

### bv-categorie-001 [MEDIO] — il ragù esistente va nei Primi (nota 62: prezzo 10 accettato, non richiesto perché la domanda sul ragù è rimasta senza r
- titolare: 🎤 E aggiungi pasta al ragù a 10 euro, aggiungi pasta al pesto a 15 euro, aggiungi caviale a 150 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, *15,00 €*. In quale sottomenu metto *pasta al pesto*? Non ancora pubblicato: 1. Nuovo piatto *pasta al pesto* in *Piatti di prova*: *15,00 €* 2. Nuovo piatto *caviale* in *Piatti di prova*: *150,00 €* «pasta al ragù»: 1. *pasta al ragù* (12,00 €)»
- titolare: 🎤 No, fai una cosa, aggiungi un'altra categoria, ovvero primi, e lì aggiungi quei due piatti che ti ho detto, invece il caviale aggiungere un'altra categoria ancora, chiamandola speciali.
  - bot: «Non ancora pubblicato, da confermare con OK: 1. Nuovo Sottomenu *Primi* nel Menu *Menu* 2. Nuovo Sottomenu *Speciali* nel Menu *Menu* 3. Nuovo piatto *pasta al pesto* in *Primi*: *15,00 €* 4. *pasta al ragù*: spostato in *Primi* 5. *pasta al ragù*: prezzo da 12,00 € a *10,00 €* 6. Nuovo piatto *caviale* in *Speciali*: *150,00 €*»
- atteso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi · ottenuto: nessuna modifica
- **MEDIO** in-attesa-ok: resta in attesa di OK: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi

