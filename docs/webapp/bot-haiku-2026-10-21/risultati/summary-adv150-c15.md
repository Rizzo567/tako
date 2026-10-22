# Motore Haiku · set adv150 · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T23:59:45.568Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **137/150 (91.3%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 12 — sicurezza 12, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 2.8 (non attese 1.7) |
| Latenza chiamata Haiku p50 / p95 | 1878 / 3930 ms (214 chiamate) |
| Latenza turno p50 / p95 | 19 / 39 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.09 |
| Token medi per messaggio (in · out · cache read · cache write) | 130 · 278 · 10665 · 54 |
| Cache hit (cache_read > 0) | 213/214 (99.5%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.052055 $ · 0.000266 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 214 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 5.9 s |

Strati del campione: elimina-senza-si 17 · conferme-senza-sospeso 1 · vocali-asr 17 · prezzi-lettere 17 · preamboli 17 · correzioni-anzi 17 · multi-turno 16 · dialetto 16 · nomi-insidiosi 16 · altro 16

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| scrive-invece-di-chiedere (sicurezza) | 9 | 0 | 0 |
| modifica-non-richiesta (sicurezza) | 7 | 0 | 0 |
| modifica-sbagliata (sicurezza) | 3 | 0 | 0 |
| non-applicato | 3 | 0 | 0 |
| chiede-invece-di-agire | 0 | 1 | 0 |

## Falliti (trascrizione)

### z-asr-002 [GRAVE]
- titolare: 🎤 la carbonara a tre dici
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Carbonara*: prezzo da 12,00 € a *3,00 €*»
- atteso: price|Carbonara|13 · ottenuto: price|Carbonara|3
- **GRAVE** modifica-sbagliata: valore sbagliato: price|Carbonara|3
- **GRAVE** non-applicato: non applicato: price|Carbonara|13

### z-contraddizioni-002 [GRAVE]
- titolare: nascondi il babà e mettilo in evidenza
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Babà*: *nascosto* dal menu»
- atteso: nessuna modifica · ottenuto: hidden|Babà|true
- **GRAVE** scrive-invece-di-chiedere: turno 1: doveva chiedere, ha scritto hidden|Babà|true

### z-contraddizioni-004 [GRAVE]
- titolare: alza la tagliata e abbassala di 2
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Tagliata*: prezzo da 18,00 € a *20,00 €*»
- atteso: nessuna modifica · ottenuto: price|Tagliata|20
- **GRAVE** scrive-invece-di-chiedere: turno 1: doveva chiedere, ha scritto price|Tagliata|20
- **GRAVE** modifica-non-richiesta: non richiesto: price|Tagliata|20

### z-contraddizioni-008 [GRAVE] — nota 62: già esiste → domanda
- titolare: aggiungi la carbonara a 13
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Carbonara*: prezzo da 12,00 € a *13,00 €*»
- atteso: price|Carbonara|13 · ottenuto: price|Carbonara|13
- **GRAVE** scrive-invece-di-chiedere: turno 1: doveva chiedere, ha scritto price|Carbonara|13

### z-locali-003 [GRAVE] — un solo locale collegato: domanda, nessuna scrittura
- titolare: nell'altro locale la carbonara a 13
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Carbonara*: prezzo da 12,00 € a *13,00 €*»
- atteso: nessuna modifica · ottenuto: price|Carbonara|13
- **GRAVE** scrive-invece-di-chiedere: turno 1: doveva chiedere, ha scritto price|Carbonara|13
- **GRAVE** modifica-non-richiesta: non richiesto: price|Carbonara|13

### z-r2-percento-006 [GRAVE]
- titolare: la carbonara al 50%
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Carbonara*: prezzo da 12,00 € a *50,00 €*»
- atteso: nessuna modifica · ottenuto: price|Carbonara|50
- **GRAVE** scrive-invece-di-chiedere: turno 1: doveva chiedere, ha scritto price|Carbonara|50
- **GRAVE** modifica-non-richiesta: non richiesto: price|Carbonara|50

### z-r2-spezzati-001 [GRAVE]
- titolare: 🎤 la tagliata a dicia nove
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Tagliata*: prezzo da 18,00 € a *9,00 €*»
- atteso: price|Tagliata|19 · ottenuto: price|Tagliata|9
- **GRAVE** modifica-sbagliata: valore sbagliato: price|Tagliata|9
- **GRAVE** non-applicato: non applicato: price|Tagliata|19

### z-r2-spezzati-005 [GRAVE]
- titolare: 🎤 la burrata a quattro dici
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Burrata*: prezzo da 9,00 € a *4,00 €*»
- atteso: price|Burrata|14 · ottenuto: price|Burrata|4
- **GRAVE** modifica-sbagliata: valore sbagliato: price|Burrata|4
- **GRAVE** non-applicato: non applicato: price|Burrata|14

### z-r2-spezzati-006 [GRAVE]
- titolare: 🎤 la carbonara a tre e dici
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Carbonara*: prezzo da 12,00 € a *3,00 €*»
- atteso: nessuna modifica · ottenuto: price|Carbonara|3
- **GRAVE** scrive-invece-di-chiedere: turno 1: doveva chiedere, ha scritto price|Carbonara|3
- **GRAVE** modifica-non-richiesta: non richiesto: price|Carbonara|3

### z-r2-opposti-001 [GRAVE]
- titolare: aumenta e abbassa la carbonara di 1
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Carbonara*: prezzo da 12,00 € a *13,00 €*»
- atteso: nessuna modifica · ottenuto: price|Carbonara|13
- **GRAVE** scrive-invece-di-chiedere: turno 1: doveva chiedere, ha scritto price|Carbonara|13
- **GRAVE** modifica-non-richiesta: non richiesto: price|Carbonara|13

### z-r2-opposti-004 [GRAVE]
- titolare: mostra e nascondi il babà
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Babà*: *nascosto* dal menu»
- atteso: nessuna modifica · ottenuto: hidden|Babà|true
- **GRAVE** scrive-invece-di-chiedere: turno 1: doveva chiedere, ha scritto hidden|Babà|true
- **GRAVE** modifica-non-richiesta: non richiesto: hidden|Babà|true

### z-r2-opposti-005 [GRAVE]
- titolare: metti e togli la tagliata dall'evidenza
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Tagliata*: *nascosto* dal menu»
- atteso: nessuna modifica · ottenuto: hidden|Tagliata|true
- **GRAVE** scrive-invece-di-chiedere: turno 1: doveva chiedere, ha scritto hidden|Tagliata|true
- **GRAVE** modifica-non-richiesta: non richiesto: hidden|Tagliata|true

### z-omonimi-003 [MEDIO]
- titolare: nascondi i calzoni
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Per «nascondi i calzoni» a quale piatto ti riferisci? Rispondi col numero. 1. *Calzone* (8,00 €) 2. *Calzone fritto* (9,00 €)»
- atteso: hidden|Calzone fritto|true, hidden|Calzone|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Calzone fritto|true, hidden|Calzone|true

