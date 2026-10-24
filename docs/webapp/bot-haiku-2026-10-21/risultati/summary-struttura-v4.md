# Motore Haiku · set struttura · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T10:20:06.799Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **93/94 (98.9%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 1.5 (non attese 0.6) |
| Latenza chiamata Haiku p50 / p95 | 2333 / 3874 ms (126 chiamate) |
| Latenza turno p50 / p95 | 15 / 28 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.06 |
| Token medi per messaggio (in · out · cache read · cache write) | 131 · 346 · 9162 · 176 |
| Cache hit (cache_read > 0) | 125/126 (99.2%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.035667 $ · 0.0003 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 126 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 3.4 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiarimento-mancante | 0 | 1 | 0 |

## Falliti (trascrizione)

### str-v-16 [MEDIO] — non esiste: una domanda
- titolare: mostra il menu della colazione
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non trovo un Menu *Colazione*. Intendi il Menu *Brunch*, che è nascosto e ancora vuoto?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

