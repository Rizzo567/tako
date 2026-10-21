# Motore Haiku · set multiturno · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T19:51:48.890Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **31/34 (91.2%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 2 — sicurezza 1, altri 1 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 5.1 (non attese 4.8) |
| Latenza chiamata Haiku p50 / p95 | 2452 / 5316 ms (69 chiamate) |
| Latenza turno p50 / p95 | 19 / 3267 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 0.78 |
| Token medi per messaggio (in · out · cache read · cache write) | 339 · 346 · 7235 · 510 |
| Cache hit (cache_read > 0) | 65/69 (94.2%) |
| Costo speso in questo giro | 0.008363 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.030543 $ · 0.000343 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 49 · 20 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 54.7 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| sostituzione-incompleta | 3 | 0 | 0 |
| modifica-non-richiesta (sicurezza) | 2 | 0 | 0 |
| nome-alterato | 0 | 1 | 0 |
| chiede-invece-di-agire | 0 | 1 | 0 |

## Falliti (trascrizione)

### mt-sessione-refusi [GRAVE]
- titolare: modifichiamo menu pranzo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, modifichiamo i piatti di oggi del *Menu pranzo*: cosa metto in *Primi*, *Secondi*, *Contorni*? Puoi scrivere tutto insieme o un pezzo alla volta; se un sottomenu resta com’è, dimmelo.»
- titolare: primi risoto alla milanese e pasta al pomodorro
  - bot: «Ok, *Primi* del pranzo: *Risotto alla milanese* e *Pasta al pomodoro*. Adesso mi dici i *Secondi*?»
- titolare: secondi cotolleta
  - bot: «Ok, *Secondi* del pranzo: *Cotoletta alla milanese*. Mi dici i *Contorni*?»
- titolare: contorni restano uguali
  - bot: «Oggi nei *Primi* del *Menu pranzo*: *Pasta al pomodorro*, *Risotto alla milanese*. Nascosti: *Pasta al pomodoro*, *Penne all'arrabbiata* (tornano quando li rimetti). Oggi nei *Secondi* del *Menu pranzo*: *Cotoletta alla milanese*. Nascosti: *Petto di pollo ai ferri*, *Polpette al sugo* (tornano quando li rimetti). Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Polpette al sugo|true · ottenuto: create|pasta al pomodorro|0|primi, hidden|Pasta al pomodoro|true, hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Polpette al sugo|true
- **GRAVE** modifica-non-richiesta: non richiesto: create|pasta al pomodorro|0|primi
- **GRAVE** modifica-non-richiesta: non richiesto: hidden|Pasta al pomodoro|true
- **GRAVE** sostituzione-incompleta: turno 4: «Menu pranzo > Primi»: manca «Pasta al pomodoro»; «Pasta al pomodorro» visibile ma non detto

### mt-sessione-lunga-correzioni [GRAVE]
- titolare: modifichiamo il menu pranzo di oggi
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, modifichiamo i piatti di oggi del *Menu pranzo*: cosa metto in *Primi*, *Secondi*, *Contorni*? Puoi scrivere tutto insieme o un pezzo alla volta; se un sottomenu resta com’è, dimmelo.»
- titolare: allora primi: lasagna
  - bot: «Segnato: *Primi* (Lasagna). E per *Secondi* e *Contorni* cosa metto? Se qualcuno resta com’è dimmelo.»
- titolare: e anche la carbonara nei primi
  - bot: «Ok, *Primi* del pranzo di oggi: *Lasagna* e *Carbonara*. Per *Secondi* e *Contorni* cosa metto?»
- titolare: secondi cotoletta e arrosto
  - bot: «Ok, *Secondi* del pranzo di oggi: *Cotoletta alla milanese* e *Arrosto di vitello*. Per *Contorni* cosa metto?»
- titolare: no aspetta, l'arrosto no, metti le polpette
  - bot: «Ok, *Secondi* ora sono *Cotoletta alla milanese* e *Polpette al sugo*. Per *Contorni* cosa metto?»
- titolare: i contorni come ieri
  - bot: «Ci sto lavorando… Di ieri non ho la lista dei *Contorni*: quali piatti metto oggi?»
- atteso: create|carbonara|0|primi, create|lasagna|0|primi, hidden|Pasta al pomodoro|true, hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Risotto alla milanese|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|carbonara|0|primi, create|lasagna|0|primi, hidden|Pasta al pomodoro|true, hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Risotto alla milanese|true
- **GRAVE** sostituzione-incompleta: turno 6: «Menu pranzo > Primi»: manca «Lasagna»; manca «Carbonara»; «Pasta al pomodoro» visibile ma non detto; «Penne all'arrabbiata» visibile ma non detto; «Risotto alla milanese» visibile ma non detto
- **GRAVE** sostituzione-incompleta: turno 6: «Menu pranzo > Secondi»: «Petto di pollo ai ferri» visibile ma non detto

### mt-menu-nominato [MEDIO]
- titolare: aggiungi gnocchi al ragu in menu pranzo a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Gnocchi al ragu*: creo il sottomenu *Primi* e lo metto lì a *10,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: si
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Gnocchi al ragu* in *Primi*: *10,00 €*»
- atteso: create|gnocchi al ragu|10|primi · ottenuto: create|gnocchi al ragu|10|primi
- **MEDIO** nome-alterato: «Gnocchi al ragu» invece di «Gnocchi al ragù»

