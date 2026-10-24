# Motore Haiku · set adv-sera · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T20:37:29.948Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **226/227 (99.6%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 1, altri 0 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 4.5 (non attese 4.5) |
| Latenza chiamata Haiku p50 / p95 | 2779 / 5316 ms (350 chiamate) |
| Latenza turno p50 / p95 | 17 / 2544 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 0.78 |
| Token medi per messaggio (in · out · cache read · cache write) | 156 · 364 · 7713 · 41 |
| Cache hit (cache_read > 0) | 349/350 (99.7%) |
| Costo speso in questo giro | 0.024792 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.125345 $ · 0.00028 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 260 · 90 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 189.1 s |

Strati del campione: elimina-senza-si 2 · conferme-senza-sospeso 2 · vocali-asr 0 · prezzi-lettere 0 · preamboli 0 · correzioni-anzi 0 · multi-turno 0 · dialetto 0 · nomi-insidiosi 0 · altro 223

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta (sicurezza) | 3 | 0 | 0 |
| sostituzione-incompleta | 2 | 0 | 0 |

## Falliti (trascrizione)

### as-sessione2-01 [GRAVE]
- titolare: modifichiamo menu pranzo: primi lasagne e pasta e fagioli, secondi cotolleta, contorni patate al forno
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Oggi nei *Primi* del *Menu pranzo*: *Lasagne*, *Pasta*, *Pasta e fagioli*. Nascosti: *Pasta al pomodoro*, *Penne all'arrabbiata*, *Risotto alla milanese* (tornano quando li rimetti). Oggi nei *Secondi* del *Menu pranzo*: *Cotolleta*. Nascosti: *Cotoletta alla milanese*, *Petto di pollo ai ferri*, *Polpette al»
- atteso: create|lasagne|0|primi, hidden|Insalata mista|true, hidden|Pasta al pomodoro|true, hidden|Pasta e fagioli|false, hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Polpette al sugo|true, hidden|Risotto alla milanese|true, hidden|Spinaci al burro|true · ottenuto: create|cotolleta|0|secondi, create|lasagne|0|primi, create|pasta|0|primi, hidden|Cotoletta alla milanese|true, hidden|Insalata mista|true, hidden|Pasta al pomodoro|true, hidden|Pasta e fagioli|false, hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Polpette al sugo|true, hidden|Risotto alla milanese|true, hidden|Spinaci al burro|true
- **GRAVE** modifica-non-richiesta: non richiesto: create|cotolleta|0|secondi
- **GRAVE** modifica-non-richiesta: non richiesto: create|pasta|0|primi
- **GRAVE** modifica-non-richiesta: non richiesto: hidden|Cotoletta alla milanese|true
- **GRAVE** sostituzione-incompleta: turno 1: «Menu pranzo > Primi»: «Pasta» visibile ma non detto
- **GRAVE** sostituzione-incompleta: turno 1: «Menu pranzo > Secondi»: manca «Cotoletta alla milanese»; «Cotolleta» visibile ma non detto

