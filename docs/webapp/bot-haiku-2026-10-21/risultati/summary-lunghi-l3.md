# Motore Haiku · set lunghi · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T12:37:30.598Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **41/42 (97.6%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 0.8 (non attese 0.1) |
| Latenza chiamata Haiku p50 / p95 | 4514 / 6945 ms (81 chiamate) |
| Latenza turno p50 / p95 | 50 / 133 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.04 |
| Token medi per messaggio (in · out · cache read · cache write) | 325 · 826 · 9573 · 130 |
| Cache hit (cache_read > 0) | 80/81 (98.8%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.043478 $ · 0.000557 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 81 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 6.2 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiarimento-mancante | 0 | 1 | 0 |

## Falliti (trascrizione)

### lng-mig-1 [MEDIO] — «13.000»: una domanda, nessuna scrittura
- titolare: la carbonara a 12,50, poi la cotoletta a 16 e la panna cotta non c'è più, e poi aggiungi tra le pizze la bufalina a 10, la carbonara a 13.000
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. Non ancora pubblicato: 1. *Spaghetti alla carbonara*: prezzo da 12,00 € a *12,50 €* 2. *Cotoletta alla milanese*: prezzo da 15,00 € a *16,00 €* 3. *Panna cotta*: *finito* 4. Nuovo piatto *Bufalina* in *Pizze*: *10,00 €*»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

