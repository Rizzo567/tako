# Motore Haiku · set lunghi · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T12:16:31.967Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **40/42 (95.2%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 0, altri 1 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 0.8 (non attese 0.1) |
| Latenza chiamata Haiku p50 / p95 | 4603 / 6945 ms (82 chiamate) |
| Latenza turno p50 / p95 | 4608 / 9518 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.05 |
| Token medi per messaggio (in · out · cache read · cache write) | 332 · 840 · 9695 · 130 |
| Cache hit (cache_read > 0) | 81/82 (98.8%) |
| Costo speso in questo giro | 0.044191 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.044191 $ · 0.000567 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 0 · 82 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 330.7 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 1 | 0 | 0 |
| chiarimento-mancante | 0 | 1 | 0 |

## Falliti (trascrizione)

### lng-sposta-crea [GRAVE] — la risposta che completa la domanda esegue anche lo spostamento
- titolare: sposta il nuovo burger nel menù bevande
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. In quale Sottomenu di *Bevande* metto *Nuovo burger*: *Bibite* o *Caffetteria*?»
- titolare: nei panini, crealo
  - bot: «Ci sto lavorando… Non ho cambiato nulla. 1. *Nuovo burger* (12,00 €)»
- atteso: move|Nuovo burger|Panini · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: move|Nuovo burger|Panini

### lng-mig-1 [MEDIO] — «13.000»: una domanda, nessuna scrittura
- titolare: la carbonara a 12,50, poi la cotoletta a 16 e la panna cotta non c'è più, e poi aggiungi tra le pizze la bufalina a 10, la carbonara a 13.000
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. Non ancora pubblicato: 1. *Spaghetti alla carbonara*: prezzo da 12,00 € a *12,50 €* 2. *Cotoletta alla milanese*: prezzo da 15,00 € a *16,00 €* 3. *Panna cotta*: *finito* 4. Nuovo piatto *Bufalina* in *Pizze*: *10,00 €*»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automa»)

