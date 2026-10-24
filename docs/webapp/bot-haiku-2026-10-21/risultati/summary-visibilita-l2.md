# Motore Haiku · set visibilita · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T12:26:24.635Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **19/20 (95%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 0.4 (non attese 0) |
| Latenza chiamata Haiku p50 / p95 | 2071 / 3857 ms (25 chiamate) |
| Latenza turno p50 / p95 | 14 / 101 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.09 |
| Token medi per messaggio (in · out · cache read · cache write) | 121 · 354 · 9871 · 127 |
| Cache hit (cache_read > 0) | 25/25 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.006987 $ · 0.000304 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 25 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 1.8 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiarimento-mancante | 0 | 1 | 0 |

## Falliti (trascrizione)

### str-v-16 [MEDIO] — non esiste: una domanda
- titolare: mostra il menu della colazione
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non trovo un Menu Colazione. Intendi il *Brunch*, che è nascosto ai clienti?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

