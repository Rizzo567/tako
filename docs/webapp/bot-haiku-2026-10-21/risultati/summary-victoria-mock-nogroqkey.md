# Motore Haiku · set victoria · mock

Generato da tests/eval/eval-haiku.test.ts (2026-10-20T23:11:43.729Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **0/10 (0%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 2 — sicurezza 0, altri 2 |
| MEDI | 8 |
| Domande ogni 10 messaggi | 8.2 (non attese 6.4) |
| Latenza chiamata Haiku p50 / p95 | 0 / 0 ms (9 chiamate) |
| Latenza turno p50 / p95 | 23 / 126 ms (harness + latenza Haiku registrata) |
| Chiamate Haiku per messaggio | 0.82 |
| Token medi per messaggio (in · out · cache read · cache write) | 16 · 98 · 1920 · 0 |
| Cache hit (cache_read > 0) | 9/9 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.5 $) |
| Costo equivalente dal vivo · per messaggio | 0.000769 $ · 0.00007 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 0 · 0 · 9 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 1.5 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| nessuna-risposta | 2 | 0 | 0 |
| richiesta-persa | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 4 | 0 |
| risposta-senza-contenuto | 0 | 3 | 0 |
| riepilogo-mancante | 0 | 2 | 0 |

## Falliti (trascrizione)

### vic-09 [GRAVE] — OK a voce («va bene» in un vocale) dopo il riepilogo
- titolare: la margherita a 8, la diavola a 9, la capricciosa a 10 e la coca a 4
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 va bene
  - bot: «»
- atteso: price|Capricciosa|10, price|Coca Cola|4, price|Diavola|9, price|Margherita|8 · ottenuto: nessuna modifica
- **GRAVE** nessuna-risposta: turno 2: nessuna risposta
- **GRAVE** richiesta-persa: richiesta persa senza risposta: price|Capricciosa|10, price|Coca Cola|4, price|Diavola|9, price|Margherita|8
- **MEDIO** riepilogo-mancante: turno 1: manca il riepilogo con «Rispondi OK» («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### vic-10 [GRAVE] — alias attivo «la sorrentina» = Pizza Sorrentina → nessuna domanda
- titolare: 🎤 la sorrentina finita
  - bot: «»
- atteso: available|Pizza Sorrentina|false · ottenuto: nessuna modifica
- **GRAVE** nessuna-risposta: turno 1: nessuna risposta
- **GRAVE** richiesta-persa: richiesta persa senza risposta: available|Pizza Sorrentina|false

### vic-01 [MEDIO] — prezzo
- titolare: la carbonara mettila a 14
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Carbonara|14 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|14

### vic-02 [MEDIO] — esaurito
- titolare: è finito il branzino
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Branzino al forno|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Branzino al forno|false

### vic-03 [MEDIO] — «togli» = nascondi, mai elimina
- titolare: togli la caprese
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: hidden|Caprese|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Caprese|true

### vic-04 [MEDIO] — «elimina» = chiede «sì», nessuna scrittura senza conferma
- titolare: elimina la panna cotta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** risposta-senza-contenuto: turno 1: manca /\bs[iì](?![a-z])/i («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### vic-05 [MEDIO] — piatto nuovo: nome senza «che costa»
- titolare: aggiungi nei secondi del pranzo la frittura di calamari che costa 16
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: create|frittura di calamari|16|secondi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|frittura di calamari|16|secondi

### vic-06 [MEDIO] — «i primi» ambiguo: Primi del Menu pranzo e del Menu cena → domanda
- titolare: aumenta i primi di un euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** risposta-senza-contenuto: turno 1: manca /pranzo|cena/i («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### vic-07 [MEDIO] — nascondere un intero sottomenu = conferma
- titolare: nascondi tutti i dolci
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** risposta-senza-contenuto: turno 1: manca /dolci/i («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### vic-08 [MEDIO] — 4 modifiche → riepilogo + OK, nessuna scrittura al primo turno
- titolare: la margherita a 8, la diavola a 9, la capricciosa a 10 e la coca a 4
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** riepilogo-mancante: turno 1: manca il riepilogo con «Rispondi OK» («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

