# Motore Haiku · set victoria · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T10:44:24.335Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **8/10 (80%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 0, altri 1 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 4.5 (non attese 2.7) |
| Latenza chiamata Haiku p50 / p95 | 2748 / 4595 ms (14 chiamate) |
| Latenza turno p50 / p95 | 2940 / 7336 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.27 |
| Token medi per messaggio (in · out · cache read · cache write) | 281 · 522 · 11582 · 157 |
| Cache hit (cache_read > 0) | 14/14 (100%) |
| Costo speso in questo giro | 0.003831 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.004669 $ · 0.000424 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 2 · 12 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 31.6 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 1 | 0 | 0 |
| riepilogo-mancante | 0 | 2 | 0 |

## Falliti (trascrizione)

### vic-09 [GRAVE] — OK a voce («va bene» in un vocale) dopo il riepilogo
- titolare: la margherita a 8, la diavola a 9, la capricciosa a 10 e la coca a 4
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Confermo: *Margherita* a 8 €, *Diavola* a 9 €, *Capricciosa* a 10 € e *Coca Cola* a 4 €? 1. *Margherita* (7,00 €) 2. *Diavola* (8,50 €) 3. *Capricciosa* (9,50 €) 4. *Coca Cola* (3,50 €)»
- titolare: 🎤 va bene
  - bot: «Non ho cambiato nulla. 1. *Margherita* (7,00 €) 2. *Diavola* (8,50 €) 3. *Capricciosa* (9,50 €) 4. *Coca Cola* (3,50 €)»
- atteso: price|Capricciosa|10, price|Coca Cola|4, price|Diavola|9, price|Margherita|8 · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: price|Capricciosa|10, price|Coca Cola|4, price|Diavola|9, price|Margherita|8
- **MEDIO** riepilogo-mancante: turno 1: manca il riepilogo con «Rispondi OK» («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### vic-08 [MEDIO] — 4 modifiche → riepilogo + OK, nessuna scrittura al primo turno
- titolare: la margherita a 8, la diavola a 9, la capricciosa a 10 e la coca a 4
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Confermo: *Margherita* a 8 €, *Diavola* a 9 €, *Capricciosa* a 10 € e *Coca Cola* a 4 €? 1. *Margherita* (7,00 €) 2. *Diavola* (8,50 €) 3. *Capricciosa* (9,50 €) 4. *Coca Cola* (3,50 €)»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** riepilogo-mancante: turno 1: manca il riepilogo con «Rispondi OK» («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

