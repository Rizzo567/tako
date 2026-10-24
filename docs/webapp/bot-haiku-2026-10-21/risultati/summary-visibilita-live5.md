# Motore Haiku · set visibilita · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T16:05:35.074Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **19/20 (95%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 0, altri 1 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 1.7 (non attese 0.9) |
| Latenza chiamata Haiku p50 / p95 | 2159 / 4170 ms (26 chiamate) |
| Latenza turno p50 / p95 | 18 / 93 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.13 |
| Token medi per messaggio (in · out · cache read · cache write) | 136 · 344 · 11098 · 127 |
| Cache hit (cache_read > 0) | 26/26 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.007184 $ · 0.000312 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 26 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 1.9 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| visibilita-mancante | 1 | 0 | 0 |

## Falliti (trascrizione)

### str-v-08 [GRAVE]
- titolare: fai vedere i dolci della cena
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quali *Dolci* vuoi rendere visibili, quelli del *Pranzo* o della *Cena*?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** visibilita-mancante: dopo il turno 1: «Cena>Dolci» è ancora nascosto

