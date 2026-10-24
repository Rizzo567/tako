# Motore Haiku · set prezzofisso · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T14:43:10.563Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **71/75 (94.7%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 4 — sicurezza 2, altri 2 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 1.7 (non attese 0.9) |
| Latenza chiamata Haiku p50 / p95 | 2819 / 5297 ms (90 chiamate) |
| Latenza turno p50 / p95 | 2717 / 5331 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.03 |
| Token medi per messaggio (in · out · cache read · cache write) | 96 · 458 · 10355 · 201 |
| Cache hit (cache_read > 0) | 89/90 (98.9%) |
| Costo speso in questo giro | 0.028312 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.031959 $ · 0.000367 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 9 · 81 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 247 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| formula-sbagliata (sicurezza) | 2 | 0 | 0 |
| formula-non-applicata | 2 | 0 | 0 |
| chiede-prezzo-in-menu-fisso | 1 | 0 | 0 |
| non-applicato | 1 | 0 | 0 |
| sostituzione-incompleta | 1 | 0 | 0 |
| chiarimento-mancante | 0 | 2 | 0 |

## Falliti (trascrizione)

### pf-ambigua-01 [GRAVE] — Completo a pranzo e a cena: una domanda, nessuna formula cambiata
- titolare: il completo a 17
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Completo* del *Menu pranzo*: da 12,00 € a *17,00 €*.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
- **GRAVE** formula-sbagliata: turno 1: «Menu pranzo» è fisso · complet=17, atteso fisso · complet=12

### pf-ambigua-04 [GRAVE] — la risposta completa la richiesta
- titolare: il completo a 17
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Completo* del *Menu pranzo*: da 12,00 € a *17,00 €*.»
- titolare: a cena
  - bot: «Intendi il *Completo* del *Menu cena*? Dimmi il prezzo che vuoi.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
- **GRAVE** formula-sbagliata: turno 1: «Menu pranzo» è fisso · complet=17, atteso fisso · complet=12
- **GRAVE** formula-non-applicata: turno 2: «Menu pranzo» resta fisso · complet=17, atteso fisso · complet=12
- **GRAVE** formula-non-applicata: turno 2: «Menu cena» resta fisso · complet=16.9 · sol prim=9 · sol second=10, atteso fisso · complet=17 · sol prim=9 · sol second=10

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
  - bot: «Ci sto lavorando… Oggi nei *Primi* del *Menu cena*: *Risotto ai funghi*, *Gnocchi al pomodoro*. Nascosti: *Tagliatelle al ragù*, *Spaghetti alle vongole* (tornano quando li rimetti). Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: create|carbonara|0|primi, create|gnocchi al ragu|0|primi, create|lasagna|0|primi, hidden|Gnocchi al pomodoro|true, hidden|Pasta al pomodoro|true, hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Polpette al sugo|true, hidden|Risotto ai funghi|false, hidden|Risotto alla milanese|true, hidden|Spaghetti alle vongole|true, hidden|Tagliatelle al ragù|true · ottenuto: create|carbonara|0|primi, create|lasagna|0|primi, hidden|Pasta al pomodoro|true, hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Polpette al sugo|true, hidden|Risotto ai funghi|false, hidden|Risotto alla milanese|true, hidden|Spaghetti alle vongole|true, hidden|Tagliatelle al ragù|true
- **GRAVE** non-applicato: non applicato: create|gnocchi al ragu|0|primi, hidden|Gnocchi al pomodoro|true
- **GRAVE** sostituzione-incompleta: turno 2: «Menu cena > Primi»: manca «Gnocchi al ragù»; «Gnocchi al pomodoro» visibile ma non detto

