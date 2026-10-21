# Motore Haiku · set lunghi · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T15:53:30.169Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **40/42 (95.2%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 2 |
| Domande ogni 10 messaggi | 0.6 (non attese 0.1) |
| Latenza chiamata Haiku p50 / p95 | 4086 / 6999 ms (81 chiamate) |
| Latenza turno p50 / p95 | 51 / 115 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.04 |
| Token medi per messaggio (in · out · cache read · cache write) | 330 · 803 · 10435 · 21 |
| Cache hit (cache_read > 0) | 81/81 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.042226 $ · 0.000541 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 81 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 4.9 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiarimento-mancante | 0 | 2 | 0 |

## Falliti (trascrizione)

### lng-mig-3 [MEDIO] — «13.000»: una domanda, nessuna scrittura
- titolare: la margherita a 8 euro anziché 7, e poi la tagliata diciannove euro, ah e aggiungi nei dolci il cannolo a 4 euro, sposta il burger classico nei secondi, la carbonara a 13.000
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Per la *Carbonara* intendi *13 €*? Rispondi OK per pubblicare. Non ancora pubblicato: 1. *Margherita*: prezzo da 7,00 € a *8,00 €* 2. *Tagliata di manzo*: prezzo da 18,00 € a *19,00 €* 3. Nuovo piatto *Cannolo* in *Dolci*: *4,00 €* 4. *Burger classico*: spostato in *Secondi* «13.000»: 1. *Spaghetti alla carbo»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

### lng-mig-4 [MEDIO] — «13.000»: una domanda, nessuna scrittura
- titolare: 🎤 eh la diavola a 9 anzi 9,50, ah e la birra media a 5,50, aggiungi tra le pizze la bufalina a 10, poi il cappuccino a 2 euro, la carbonara a 13.000
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiorno la *Diavola* a 9,50, la *Birra media* a 5,50, il *Cappuccino* a 2 e aggiungo la *Bufalina* a 10 tra le Pizze. Per la *Carbonara* intendi 13 euro? Rispondi OK per pubblicare. Non ancora pubblicato: 1. *Diavola*: prezzo da 8,50 € a *9,50 €* 2. *Birra media*: prezzo da 5,00 € a *5,50 €* 3. Nuovo piatto »
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

