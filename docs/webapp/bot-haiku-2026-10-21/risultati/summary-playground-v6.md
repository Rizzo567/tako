# Motore Haiku · set playground · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T10:26:31.891Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **20/20 (100%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 2 (non attese 0) |
| Latenza chiamata Haiku p50 / p95 | 1843 / 3534 ms (23 chiamate) |
| Latenza turno p50 / p95 | 26 / 147 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.15 |
| Token medi per messaggio (in · out · cache read · cache write) | 134 · 343 · 10324 · 124 |
| Cache hit (cache_read > 0) | 23/23 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.006076 $ · 0.000304 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 23 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 1.8 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| risposta-senza-contenuto | 0 | 0 | 1 |

## Falliti (trascrizione)

### pg-20 [BASSO]
- titolare: ❓ cosa sai fare?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-senza-contenuto: turno 1: manca /prezz/i («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

