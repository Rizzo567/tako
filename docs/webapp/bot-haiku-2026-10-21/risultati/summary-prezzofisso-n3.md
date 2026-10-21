# Motore Haiku · set prezzofisso · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T21:43:44.898Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **74/75 (98.7%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 0, altri 1 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 1.8 (non attese 0.8) |
| Latenza chiamata Haiku p50 / p95 | 2736 / 5297 ms (91 chiamate) |
| Latenza turno p50 / p95 | 21 / 43 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.05 |
| Token medi per messaggio (in · out · cache read · cache write) | 101 · 455 · 10249 · 424 |
| Cache hit (cache_read > 0) | 88/91 (96.7%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.034206 $ · 0.000393 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 91 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 3.7 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-prezzo-in-menu-fisso | 1 | 0 | 0 |

## Falliti (trascrizione)

### pf-piatto-nuovo-08 [GRAVE] — creata a 0; «a 8» su un piatto di menu fisso: domanda o spiegazione, mai il prezzo scritto
- titolare: aggiungi la lasagna ai primi del pranzo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiungo *Lasagna* ai Primi del Menu pranzo. Nuovo piatto *Lasagna* in *Primi*: senza prezzo (Menu a prezzo fisso)»
- titolare: la lasagna a 8
  - bot: «La *Lasagna* è nel Menu pranzo, che ha prezzo fisso: i piatti non hanno prezzo, il prezzo è delle opzioni. Vuoi cambiare il prezzo di un'opzione, tipo il *Completo* a pranzo?»
- atteso: create|lasagna|0|primi · ottenuto: create|lasagna|0|primi
- **GRAVE** chiede-prezzo-in-menu-fisso: turno 2: «La *Lasagna* è nel Menu pranzo, che ha prezzo fisso: i piatti non hanno prezzo, il prezzo è delle op»

