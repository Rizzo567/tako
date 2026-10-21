# Motore Haiku · set prezzofisso · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T15:40:13.599Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **73/75 (97.3%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 2 — sicurezza 0, altri 2 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 1.8 (non attese 0.8) |
| Latenza chiamata Haiku p50 / p95 | 2807 / 5297 ms (92 chiamate) |
| Latenza turno p50 / p95 | 25 / 71 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.06 |
| Token medi per messaggio (in · out · cache read · cache write) | 105 · 462 · 10365 · 424 |
| Cache hit (cache_read > 0) | 89/92 (96.7%) |
| Costo speso in questo giro | 0.001592 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.034641 $ · 0.000398 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 90 · 2 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 8.4 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-prezzo-in-menu-fisso | 1 | 0 | 0 |
| non-applicato | 1 | 0 | 0 |
| sostituzione-incompleta | 1 | 0 | 0 |

## Falliti (trascrizione)

### pf-piatto-nuovo-08 [GRAVE] — creata a 0; «a 8» su un piatto di menu fisso: domanda o spiegazione, mai il prezzo scritto
- titolare: aggiungi la lasagna ai primi del pranzo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiungo *Lasagna* ai Primi del Menu pranzo. Nuovo piatto *Lasagna* in *Primi*: senza prezzo (Menu a prezzo fisso)»
- titolare: la lasagna a 8
  - bot: «La *Lasagna* è nel Menu pranzo, che ha prezzo fisso: i piatti non hanno prezzo, il prezzo è delle opzioni. Vuoi cambiare il prezzo di un'opzione, tipo il *Completo* a pranzo?»
- atteso: create|lasagna|0|primi · ottenuto: create|lasagna|0|primi
- **GRAVE** chiede-prezzo-in-menu-fisso: turno 2: «La *Lasagna* è nel Menu pranzo, che ha prezzo fisso: i piatti non hanno prezzo, il prezzo è delle op»

### pf-sostituzione-16 [GRAVE] — pranzo e poi cena nello stesso giro
- titolare: oggi a pranzo primi lasagna e carbonara, secondi cotoletta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Oggi nei *Primi* del *Menu pranzo*: *Lasagna*, *Carbonara*. Nascosti: *Pasta al pomodoro*, *Penne all'arrabbiata*, *Risotto alla milanese* (tornano quando li rimetti). Oggi nei *Secondi* del *Menu pranzo*: *Cotoletta alla milanese*. Nascosti: *Petto di pollo ai ferri*, *Polpette al sugo* (tornano quando li ri»
- titolare: stasera i primi sono gnocchi al ragù e risotto ai funghi
  - bot: «Oggi nei *Primi* del *Menu cena*: *Risotto ai funghi*, *Gnocchi al pomodoro*. Nascosti: *Tagliatelle al ragù*, *Spaghetti alle vongole* (tornano quando li rimetti). Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: create|carbonara|0|primi, create|gnocchi al ragu|0|primi, create|lasagna|0|primi, hidden|Gnocchi al pomodoro|true, hidden|Pasta al pomodoro|true, hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Polpette al sugo|true, hidden|Risotto ai funghi|false, hidden|Risotto alla milanese|true, hidden|Spaghetti alle vongole|true, hidden|Tagliatelle al ragù|true · ottenuto: create|carbonara|0|primi, create|lasagna|0|primi, hidden|Pasta al pomodoro|true, hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Polpette al sugo|true, hidden|Risotto ai funghi|false, hidden|Risotto alla milanese|true, hidden|Spaghetti alle vongole|true, hidden|Tagliatelle al ragù|true
- **GRAVE** non-applicato: non applicato: create|gnocchi al ragu|0|primi, hidden|Gnocchi al pomodoro|true
- **GRAVE** sostituzione-incompleta: turno 2: «Menu cena > Primi»: manca «Gnocchi al ragù»; «Gnocchi al pomodoro» visibile ma non detto

