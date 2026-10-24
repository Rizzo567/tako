# Motore Haiku · set struttura · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T15:53:33.457Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **93/94 (98.9%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 0, altri 1 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 1.8 (non attese 0.8) |
| Latenza chiamata Haiku p50 / p95 | 2376 / 3760 ms (129 chiamate) |
| Latenza turno p50 / p95 | 10 / 19 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.08 |
| Token medi per messaggio (in · out · cache read · cache write) | 142 · 343 · 10481 · 101 |
| Cache hit (cache_read > 0) | 129/129 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.036072 $ · 0.000303 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 129 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 2.3 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| visibilita-mancante | 1 | 0 | 0 |

## Falliti (trascrizione)

### str-v-08 [GRAVE]
- titolare: fai vedere i dolci della cena
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quali *Dolci* vuoi rendere visibili, quelli del *Pranzo* o della *Cena*?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** visibilita-mancante: dopo il turno 1: «Cena>Dolci» è ancora nascosto

