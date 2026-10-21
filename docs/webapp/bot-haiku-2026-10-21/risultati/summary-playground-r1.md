# Motore Haiku · set playground · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T00:50:57.760Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **17/20 (85%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 3 — sicurezza 0, altri 3 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 3 (non attese 1) |
| Latenza chiamata Haiku p50 / p95 | 2679 / 4584 ms (24 chiamate) |
| Latenza turno p50 / p95 | 2699 / 9890 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.2 |
| Token medi per messaggio (in · out · cache read · cache write) | 146 · 482 · 8706 · 82 |
| Cache hit (cache_read > 0) | 24/24 (100%) |
| Costo speso in questo giro | 0.007055 $ (tetto 0.15 $) |
| Costo equivalente dal vivo · per messaggio | 0.007055 $ · 0.000353 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 0 · 24 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 67.2 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 3 | 0 | 0 |

## Falliti (trascrizione)

### pg-09 [GRAVE]
- titolare: 🎤 gnocchi quattro formag dodic
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. 1. *Gnocchi 4 formaggi* (10,00 €)»
- atteso: price|Gnocchi 4 formaggi|12 · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: price|Gnocchi 4 formaggi|12

### pg-11 [GRAVE]
- titolare: 🎤 la tagliat… diciott e cinquant
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. 1. *Tagliata di manzo* (18,00 €)»
- atteso: price|Tagliata di manzo|18.5 · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: price|Tagliata di manzo|18.5

### pg-14 [GRAVE]
- titolare: 🎤 bruschett cinque e mezz
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. 1. *Bruschetta al pomodoro* (5,00 €)»
- atteso: price|Bruschetta al pomodoro|5.5 · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: price|Bruschetta al pomodoro|5.5

