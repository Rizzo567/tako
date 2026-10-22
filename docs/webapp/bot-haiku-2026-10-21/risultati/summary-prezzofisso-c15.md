# Motore Haiku · set prezzofisso · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T23:59:33.028Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **72/75 (96%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 3 — sicurezza 3, altri 0 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 1.5 (non attese 0.5) |
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
| prezzo-piatto-in-menu-fisso (sicurezza) | 3 | 0 | 0 |
| modifica-non-richiesta (sicurezza) | 2 | 0 | 0 |
| modifica-sbagliata (sicurezza) | 1 | 0 | 0 |
| non-applicato | 1 | 0 | 0 |
| risposta-senza-contenuto | 0 | 3 | 0 |

## Falliti (trascrizione)

### pf-piatto-nuovo-08 [GRAVE] — creata a 0; «a 8» su un piatto di menu fisso: domanda o spiegazione, mai il prezzo scritto
- titolare: aggiungi la lasagna ai primi del pranzo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiungo *Lasagna* ai Primi del Menu pranzo. Nuovo piatto *Lasagna* in *Primi*: senza prezzo (Menu a prezzo fisso)»
- titolare: la lasagna a 8
  - bot: «*Lasagna*: prezzo da 0,00 € a *8,00 €*»
- atteso: create|lasagna|0|primi · ottenuto: create|lasagna|8|primi
- **GRAVE** modifica-sbagliata: valore sbagliato: create|lasagna|8|primi
- **GRAVE** non-applicato: non applicato: create|lasagna|0|primi
- **MEDIO** risposta-senza-contenuto: turno 2: manca /prezzo fisso|menu fisso|formula|complet|opzion|non (?:ha|hanno) (?:un )?prezz|\?/i («*Lasagna*: prezzo da 0,00 € a *8,00 €*»)
- **GRAVE** prezzo-piatto-in-menu-fisso: turno 2: «Lasagna» (Menu pranzo) da 0 a 8 €

### pf-prezzo-piatto-02 [GRAVE]
- titolare: il risotto alla milanese a 9 euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Risotto alla milanese*: prezzo da 0,00 € a *9,00 €*»
- atteso: nessuna modifica · ottenuto: price|Risotto alla milanese|9
- **GRAVE** modifica-non-richiesta: non richiesto: price|Risotto alla milanese|9
- **MEDIO** risposta-senza-contenuto: turno 1: manca /prezzo fisso|menu fisso|formula|complet|opzion|non (?:ha|hanno) (?:un )?prezz|\?/i («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)
- **GRAVE** prezzo-piatto-in-menu-fisso: turno 1: «Risotto alla milanese» (Menu pranzo) da 0 a 9 €

### pf-prezzo-piatto-03 [GRAVE]
- titolare: metti le tagliatelle al ragù a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Tagliatelle al ragù*: prezzo da 0,00 € a *10,00 €*»
- atteso: nessuna modifica · ottenuto: price|Tagliatelle al ragù|10
- **GRAVE** modifica-non-richiesta: non richiesto: price|Tagliatelle al ragù|10
- **MEDIO** risposta-senza-contenuto: turno 1: manca /prezzo fisso|menu fisso|formula|complet|opzion|non (?:ha|hanno) (?:un )?prezz|\?/i («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)
- **GRAVE** prezzo-piatto-in-menu-fisso: turno 1: «Tagliatelle al ragù» (Menu cena) da 0 a 10 €

