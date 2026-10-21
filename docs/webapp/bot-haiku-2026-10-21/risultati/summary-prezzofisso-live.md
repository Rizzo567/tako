# Motore Haiku · set prezzofisso · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T15:50:24.201Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **72/75 (96%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 3 — sicurezza 0, altri 3 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 2.1 (non attese 1) |
| Latenza chiamata Haiku p50 / p95 | 2671 / 5297 ms (95 chiamate) |
| Latenza turno p50 / p95 | 22 / 73 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.09 |
| Token medi per messaggio (in · out · cache read · cache write) | 136 · 470 · 10492 · 647 |
| Cache hit (cache_read > 0) | 90/95 (94.7%) |
| Costo speso in questo giro | 0.00204 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.037782 $ · 0.000434 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 92 · 3 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 11 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| sostituzione-incompleta | 2 | 0 | 0 |
| chiede-prezzo-in-menu-fisso | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 1 | 0 |

## Falliti (trascrizione)

### pf-piatto-nuovo-08 [GRAVE] — creata a 0; «a 8» su un piatto di menu fisso: domanda o spiegazione, mai il prezzo scritto
- titolare: aggiungi la lasagna ai primi del pranzo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiungo *Lasagna* ai Primi del Menu pranzo. Nuovo piatto *Lasagna* in *Primi*: senza prezzo (Menu a prezzo fisso)»
- titolare: la lasagna a 8
  - bot: «La *Lasagna* è nel Menu pranzo, che ha prezzo fisso: i piatti non hanno prezzo, il prezzo è delle opzioni. Vuoi cambiare il prezzo di un'opzione, tipo il *Completo* a pranzo?»
- atteso: create|lasagna|0|primi · ottenuto: create|lasagna|0|primi
- **GRAVE** chiede-prezzo-in-menu-fisso: turno 2: «La *Lasagna* è nel Menu pranzo, che ha prezzo fisso: i piatti non hanno prezzo, il prezzo è delle op»

### pf-sostituzione-03 [GRAVE]
- titolare: oggi a pranzo i primi sono pasta al pomodoro e pasta e fagioli
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. C'è già *Pasta al pomodoro* nel Menu pranzo: lo aggiorno o ne creo un altro? Non ancora pubblicato: 1. *Penne all'arrabbiata*: *nascosto* dal menu 2. *Risotto alla milanese*: *nascosto* dal menu Già nel menu: 1. *Pasta al pomodoro* (0,00 €)»
- atteso: hidden|Pasta e fagioli|false, hidden|Penne all'arrabbiata|true, hidden|Risotto alla milanese|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Pasta e fagioli|false, hidden|Penne all'arrabbiata|true, hidden|Risotto alla milanese|true
- **GRAVE** sostituzione-incompleta: turno 1: «Menu pranzo > Primi»: manca «Pasta e fagioli»; «Penne all'arrabbiata» visibile ma non detto; «Risotto alla milanese» visibile ma non detto

### pf-annulla-04 [GRAVE]
- titolare: oggi a pranzo i primi sono pasta al pomodoro e pasta e fagioli
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. C'è già *Pasta al pomodoro* nel Menu pranzo: lo aggiorno o ne creo un altro? Non ancora pubblicato: 1. *Penne all'arrabbiata*: *nascosto* dal menu 2. *Risotto alla milanese*: *nascosto* dal menu Già nel menu: 1. *Pasta al pomodoro* (0,00 €)»
- titolare: annulla l'ultima modifica
  - bot: «Non trovo nessuna modifica recente da annullare. Vuoi aggiornare *Pasta al pomodoro* o crearne un altro? Non ancora pubblicato: 1. *Penne all'arrabbiata*: *nascosto* dal menu 2. *Risotto alla milanese*: *nascosto* dal menu Già nel menu: 1. *Pasta al pomodoro* (0,00 €)»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** sostituzione-incompleta: turno 1: «Menu pranzo > Primi»: manca «Pasta e fagioli»; «Penne all'arrabbiata» visibile ma non detto; «Risotto alla milanese» visibile ma non detto

