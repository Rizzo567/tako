# Motore Haiku · set prezzofisso · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T15:51:58.278Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **73/75 (97.3%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 2 — sicurezza 1, altri 1 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 1.8 (non attese 0.8) |
| Latenza chiamata Haiku p50 / p95 | 2807 / 5297 ms (92 chiamate) |
| Latenza turno p50 / p95 | 16 / 61 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.06 |
| Token medi per messaggio (in · out · cache read · cache write) | 105 · 462 · 10365 · 424 |
| Cache hit (cache_read > 0) | 89/92 (96.7%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.034641 $ · 0.000398 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 92 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 3.3 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta (sicurezza) | 2 | 0 | 0 |
| chiede-prezzo-in-menu-fisso | 1 | 0 | 0 |
| sostituzione-incompleta | 1 | 0 | 0 |

## Falliti (trascrizione)

### pf-piatto-nuovo-08 [GRAVE] — creata a 0; «a 8» su un piatto di menu fisso: domanda o spiegazione, mai il prezzo scritto
- titolare: aggiungi la lasagna ai primi del pranzo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiungo *Lasagna* ai Primi del Menu pranzo. Nuovo piatto *Lasagna* in *Primi*: senza prezzo (Menu a prezzo fisso)»
- titolare: la lasagna a 8
  - bot: «La *Lasagna* è nel Menu pranzo, che ha prezzo fisso: i piatti non hanno prezzo, il prezzo è delle opzioni. Vuoi cambiare il prezzo di un'opzione, tipo il *Completo* a pranzo?»
- atteso: create|lasagna|0|primi · ottenuto: create|lasagna|0|primi
- **GRAVE** chiede-prezzo-in-menu-fisso: turno 2: «La *Lasagna* è nel Menu pranzo, che ha prezzo fisso: i piatti non hanno prezzo, il prezzo è delle op»

### pf-sostituzione-18 [GRAVE]
- titolare: 🎤 pranzo oggi primi pasta al pomodoro risotto alla milanese secondi polpette contorni insalata mista e spinaci
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Oggi nei *Primi* del *Menu pranzo*: *Pasta al pomodoro risotto alla milanese*, *Risotto alla milanese*. Nascosti: *Pasta al pomodoro*, *Penne all'arrabbiata* (tornano quando li rimetti). Oggi nei *Secondi* del *Menu pranzo*: *Polpette al sugo*. Nascosti: *Cotoletta alla milanese*, *Petto di pollo ai ferri* (t»
- atteso: hidden|Cotoletta alla milanese|true, hidden|Patate al forno|true, hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true · ottenuto: create|pasta al pomodoro risotto alla milanese|0|primi, hidden|Cotoletta alla milanese|true, hidden|Pasta al pomodoro|true, hidden|Patate al forno|true, hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true
- **GRAVE** modifica-non-richiesta: non richiesto: create|pasta al pomodoro risotto alla milanese|0|primi
- **GRAVE** modifica-non-richiesta: non richiesto: hidden|Pasta al pomodoro|true
- **GRAVE** sostituzione-incompleta: turno 1: «Menu pranzo > Primi»: manca «Pasta al pomodoro»; «Pasta al pomodoro risotto alla milanese» visibile ma non detto

