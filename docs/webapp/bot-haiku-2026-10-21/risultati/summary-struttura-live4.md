# Motore Haiku · set struttura · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T16:02:37.393Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **93/94 (98.9%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 0, altri 1 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 1.8 (non attese 0.8) |
| Latenza chiamata Haiku p50 / p95 | 2397 / 3869 ms (130 chiamate) |
| Latenza turno p50 / p95 | 16 / 150 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.09 |
| Token medi per messaggio (in · out · cache read · cache write) | 149 · 346 · 10560 · 101 |
| Cache hit (cache_read > 0) | 130/130 (100%) |
| Costo speso in questo giro | 0.002042 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.036429 $ · 0.000306 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 124 · 6 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 22.8 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| visibilita-mancante | 1 | 0 | 0 |

## Falliti (trascrizione)

### str-v-08 [GRAVE]
- titolare: fai vedere i dolci della cena
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quali *Dolci* vuoi rendere visibili, quelli del *Pranzo* o della *Cena*?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** visibilita-mancante: dopo il turno 1: «Cena>Dolci» è ancora nascosto

