# Motore Haiku · set qa-continua · live

Generato da tests/eval/eval-haiku.test.ts (2026-10-22T03:10:24.802Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **1/1 (100%)** |
| Non misurate (cache assente / tetto / errore) | 1 — qa-continua |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 1.7 (non attese 1.7) |
| Latenza chiamata Haiku p50 / p95 | 2740 / 9583 ms (189 chiamate) |
| Latenza turno p50 / p95 | 2271 / 8187 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.75 |
| Token medi per messaggio (in · out · cache read · cache write) | 1382 · 352 · 17043 · 182 |
| Cache hit (cache_read > 0) | 189/189 (100%) |
| Costo speso in questo giro | 0.054797 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.054797 $ · 0.000507 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 0 · 189 · 0 · 0 · 0 · 3 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 805.4 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|

## Falliti (trascrizione)

