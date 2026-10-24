# Motore Haiku · set multiturno · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-24T17:41:46.676Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **27/38 (71.1%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 11 — sicurezza 11, altri 0 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 5.1 (non attese 4.9) |
| Latenza chiamata Haiku p50 / p95 | 2962 / 6247 ms (52 chiamate) |
| Latenza turno p50 / p95 | 17 / 47 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 0.49 |
| Token medi per messaggio (in · out · cache read · cache write) | 154 · 258 · 4865 · 72 |
| Cache hit (cache_read > 0) | 52/52 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.6 $) |
| Costo equivalente dal vivo · per messaggio | 0.021435 $ · 0.000202 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 52 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 3.9 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta (sicurezza) | 48 | 0 | 0 |
| piatto-eliminato-in-sostituzione (sicurezza) | 41 | 0 | 0 |
| non-applicato | 11 | 0 | 0 |

## Falliti (trascrizione)

### mt-fa-niente [GRAVE]
- titolare: aggiungi nel menu pranzo le lasagne
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Lasagna*: creo il sottomenu *Primi* e la metto lì? Rispondi *sì* oppure dimmi il nome del sottomenu. Dimmi anche il prezzo.»
- titolare: 🎤 No vabbè fa niente, nascondi il riso giallo
  - bot: «*riso giallo*: *eliminato* dal menu Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: hidden|riso giallo|true · ottenuto: delete|riso giallo
- **GRAVE** modifica-non-richiesta: non richiesto: delete|riso giallo
- **GRAVE** non-applicato: non applicato: hidden|riso giallo|true

### mt-no-poi-comando-voce [GRAVE]
- titolare: aggiungi nel menu pranzo le lasagne a 12
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Lasagna*: creo il sottomenu *Primi* e la metto lì a *12,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: 🎤 no
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: 🎤 nascondi la pasta al sugo
  - bot: «*Pasta al sugo*: *eliminato* dal menu Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: hidden|Pasta al sugo|true · ottenuto: delete|Pasta al sugo
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Pasta al sugo
- **GRAVE** non-applicato: non applicato: hidden|Pasta al sugo|true

### mt-sessione-a-pezzi [GRAVE]
- titolare: modifichiamo menu pranzo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, modifichiamo i piatti di oggi del *Menu pranzo*: cosa metto in *Primi*, *Secondi*, *Contorni*? Puoi scrivere tutto insieme o un pezzo alla volta; se un sottomenu resta com’è, dimmelo.»
- titolare: primi lasagna e carbonara
  - bot: «Segnato: *Primi* (Lasagna, Carbonara). E per *Secondi* e *Contorni* cosa metto? Se qualcuno resta com’è dimmelo.»
- titolare: secondi cotoletta
  - bot: «Segnato: *Primi* (Lasagna, Carbonara) · *Secondi* (Cotoletta alla milanese). E nei *Contorni* cosa metto? Se restano come sono scrivi «restano uguali».»
- titolare: contorni patate al forno
  - bot: «*Menu pranzo aggiornato* *Primi* • Lasagna • Carbonara *Secondi* • Cotoletta alla milanese *Contorni* • Patate al forno Eliminati: Pasta al pomodoro, Penne all'arrabbiata, Risotto alla milanese, Pasta e fagioli, Petto di pollo ai ferri, Polpette al sugo, Arrosto di vitello, Insalata mista, Spinaci al burro Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: create|carbonara|0|primi, create|lasagna|0|primi, hidden|Insalata mista|true, hidden|Pasta al pomodoro|true, hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Polpette al sugo|true, hidden|Risotto alla milanese|true, hidden|Spinaci al burro|true · ottenuto: create|carbonara|0|primi, create|lasagna|0|primi, delete|Arrosto di vitello, delete|Insalata mista, delete|Pasta al pomodoro, delete|Pasta e fagioli, delete|Penne all'arrabbiata, delete|Petto di pollo ai ferri, delete|Polpette al sugo, delete|Risotto alla milanese, delete|Spinaci al burro
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Arrosto di vitello
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Insalata mista
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Pasta al pomodoro
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Pasta e fagioli
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Penne all'arrabbiata
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Petto di pollo ai ferri
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Polpette al sugo
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Risotto alla milanese
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Spinaci al burro
- **GRAVE** non-applicato: non applicato: hidden|Insalata mista|true, hidden|Pasta al pomodoro|true, hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Polpette al sugo|true, hidden|Risotto alla milanese|true, hidden|Spinaci al burro|true
- **GRAVE** piatto-eliminato-in-sostituzione: turno 4: eliminato «Pasta al pomodoro»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 4: eliminato «Penne all'arrabbiata»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 4: eliminato «Risotto alla milanese»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 4: eliminato «Pasta e fagioli»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 4: eliminato «Petto di pollo ai ferri»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 4: eliminato «Polpette al sugo»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 4: eliminato «Arrosto di vitello»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 4: eliminato «Insalata mista»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 4: eliminato «Spinaci al burro»

### mt-sessione-tutto-insieme [GRAVE]
- titolare: modifichiamo menu pranzo: primi pasta al pomodoro e risotto alla milanese, secondi polpette, contorni insalata mista
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Menu pranzo aggiornato* *Primi* • Pasta al pomodoro • Risotto alla milanese *Secondi* • Polpette al sugo *Contorni* • Insalata mista Eliminati: Penne all'arrabbiata, Pasta e fagioli, Cotoletta alla milanese, Petto di pollo ai ferri, Arrosto di vitello, Patate al forno, Spinaci al burro Per tornare come prima»
- atteso: hidden|Cotoletta alla milanese|true, hidden|Patate al forno|true, hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Spinaci al burro|true · ottenuto: delete|Arrosto di vitello, delete|Cotoletta alla milanese, delete|Pasta e fagioli, delete|Patate al forno, delete|Penne all'arrabbiata, delete|Petto di pollo ai ferri, delete|Spinaci al burro
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Arrosto di vitello
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Cotoletta alla milanese
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Pasta e fagioli
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Patate al forno
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Penne all'arrabbiata
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Petto di pollo ai ferri
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Spinaci al burro
- **GRAVE** non-applicato: non applicato: hidden|Cotoletta alla milanese|true, hidden|Patate al forno|true, hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Spinaci al burro|true
- **GRAVE** piatto-eliminato-in-sostituzione: turno 1: eliminato «Penne all'arrabbiata»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 1: eliminato «Pasta e fagioli»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 1: eliminato «Cotoletta alla milanese»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 1: eliminato «Petto di pollo ai ferri»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 1: eliminato «Arrosto di vitello»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 1: eliminato «Patate al forno»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 1: eliminato «Spinaci al burro»

### mt-sessione-ordine-sparso [GRAVE]
- titolare: aggiorniamo il menu del pranzo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, modifichiamo i piatti di oggi del *Menu pranzo*: cosa metto in *Primi*, *Secondi*, *Contorni*? Puoi scrivere tutto insieme o un pezzo alla volta; se un sottomenu resta com’è, dimmelo.»
- titolare: i contorni oggi sono spinaci al burro
  - bot: «Segnato: *Contorni* (Spinaci al burro). E per *Primi* e *Secondi* cosa metto? Se qualcuno resta com’è dimmelo.»
- titolare: primi penne all'arrabbiata, secondi petto di pollo ai ferri
  - bot: «*Menu pranzo aggiornato* *Contorni* • Spinaci al burro *Primi* • Penne all'arrabbiata *Secondi* • Petto di pollo ai ferri Eliminati: Patate al forno, Insalata mista, Pasta al pomodoro, Risotto alla milanese, Pasta e fagioli, Cotoletta alla milanese, Polpette al sugo, Arrosto di vitello Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: hidden|Cotoletta alla milanese|true, hidden|Insalata mista|true, hidden|Pasta al pomodoro|true, hidden|Patate al forno|true, hidden|Polpette al sugo|true, hidden|Risotto alla milanese|true · ottenuto: delete|Arrosto di vitello, delete|Cotoletta alla milanese, delete|Insalata mista, delete|Pasta al pomodoro, delete|Pasta e fagioli, delete|Patate al forno, delete|Polpette al sugo, delete|Risotto alla milanese
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Arrosto di vitello
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Cotoletta alla milanese
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Insalata mista
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Pasta al pomodoro
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Pasta e fagioli
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Patate al forno
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Polpette al sugo
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Risotto alla milanese
- **GRAVE** non-applicato: non applicato: hidden|Cotoletta alla milanese|true, hidden|Insalata mista|true, hidden|Pasta al pomodoro|true, hidden|Patate al forno|true, hidden|Polpette al sugo|true, hidden|Risotto alla milanese|true
- **GRAVE** piatto-eliminato-in-sostituzione: turno 3: eliminato «Pasta al pomodoro»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 3: eliminato «Risotto alla milanese»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 3: eliminato «Pasta e fagioli»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 3: eliminato «Cotoletta alla milanese»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 3: eliminato «Polpette al sugo»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 3: eliminato «Arrosto di vitello»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 3: eliminato «Patate al forno»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 3: eliminato «Insalata mista»

### mt-sessione-refusi [GRAVE]
- titolare: modifichiamo menu pranzo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, modifichiamo i piatti di oggi del *Menu pranzo*: cosa metto in *Primi*, *Secondi*, *Contorni*? Puoi scrivere tutto insieme o un pezzo alla volta; se un sottomenu resta com’è, dimmelo.»
- titolare: primi risoto alla milanese e pasta al pomodorro
  - bot: «Segnato: *Primi* (Risotto alla milanese, Pasta al pomodoro). E per *Secondi* e *Contorni* cosa metto? Se qualcuno resta com’è dimmelo.»
- titolare: secondi cotolleta
  - bot: «Segnato: *Primi* (Risotto alla milanese, Pasta al pomodoro) · *Secondi* (Cotoletta alla milanese). E nei *Contorni* cosa metto? Se restano come sono scrivi «restano uguali».»
- titolare: contorni restano uguali
  - bot: «*Menu pranzo aggiornato* *Primi* • Pasta al pomodoro • Risotto alla milanese *Secondi* • Cotoletta alla milanese Eliminati: Penne all'arrabbiata, Pasta e fagioli, Petto di pollo ai ferri, Polpette al sugo, Arrosto di vitello Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Polpette al sugo|true · ottenuto: delete|Arrosto di vitello, delete|Pasta e fagioli, delete|Penne all'arrabbiata, delete|Petto di pollo ai ferri, delete|Polpette al sugo
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Arrosto di vitello
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Pasta e fagioli
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Penne all'arrabbiata
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Petto di pollo ai ferri
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Polpette al sugo
- **GRAVE** non-applicato: non applicato: hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Polpette al sugo|true
- **GRAVE** piatto-eliminato-in-sostituzione: turno 4: eliminato «Penne all'arrabbiata»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 4: eliminato «Pasta e fagioli»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 4: eliminato «Petto di pollo ai ferri»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 4: eliminato «Polpette al sugo»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 4: eliminato «Arrosto di vitello»

### mt-sessione-cambia-idea [GRAVE]
- titolare: modifichiamo menu pranzo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, modifichiamo i piatti di oggi del *Menu pranzo*: cosa metto in *Primi*, *Secondi*, *Contorni*? Puoi scrivere tutto insieme o un pezzo alla volta; se un sottomenu resta com’è, dimmelo.»
- titolare: primi lasagna e carbonara
  - bot: «Segnato: *Primi* (Lasagna, Carbonara). E per *Secondi* e *Contorni* cosa metto? Se qualcuno resta com’è dimmelo.»
- titolare: no, la carbonara toglila, metti la pasta e fagioli
  - bot: «Segnato: *Primi* (Lasagna, Pasta e fagioli). E per *Secondi* e *Contorni* cosa metto? Se qualcuno resta com’è dimmelo.»
- titolare: secondi e contorni restano uguali
  - bot: «*Menu pranzo aggiornato* *Primi* • Lasagna • Pasta e fagioli Eliminati: Pasta al pomodoro, Penne all'arrabbiata, Risotto alla milanese Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: create|lasagna|0|primi, hidden|Pasta al pomodoro|true, hidden|Pasta e fagioli|false, hidden|Penne all'arrabbiata|true, hidden|Risotto alla milanese|true · ottenuto: create|lasagna|0|primi, delete|Pasta al pomodoro, delete|Penne all'arrabbiata, delete|Risotto alla milanese, hidden|Pasta e fagioli|false
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Pasta al pomodoro
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Penne all'arrabbiata
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Risotto alla milanese
- **GRAVE** non-applicato: non applicato: hidden|Pasta al pomodoro|true, hidden|Penne all'arrabbiata|true, hidden|Risotto alla milanese|true
- **GRAVE** piatto-eliminato-in-sostituzione: turno 4: eliminato «Pasta al pomodoro»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 4: eliminato «Penne all'arrabbiata»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 4: eliminato «Risotto alla milanese»

### mt-sessione-tutto-uguale-tranne [GRAVE]
- titolare: modifichiamo il menu della cena
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, modifichiamo i piatti di oggi del *Menu cena*: cosa metto in *Primi*, *Secondi*, *Contorni*? Puoi scrivere tutto insieme o un pezzo alla volta; se un sottomenu resta com’è, dimmelo.»
- titolare: tutto uguale tranne i primi: tagliatelle al ragù e risotto ai funghi
  - bot: «*Menu cena aggiornato* *Primi* • Risotto ai funghi • Tagliatelle al ragù Eliminati: Spaghetti alle vongole, Gnocchi al pomodoro Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: hidden|Gnocchi al pomodoro|true, hidden|Risotto ai funghi|false, hidden|Spaghetti alle vongole|true · ottenuto: delete|Gnocchi al pomodoro, delete|Spaghetti alle vongole, hidden|Risotto ai funghi|false
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Gnocchi al pomodoro
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Spaghetti alle vongole
- **GRAVE** non-applicato: non applicato: hidden|Gnocchi al pomodoro|true, hidden|Spaghetti alle vongole|true
- **GRAVE** piatto-eliminato-in-sostituzione: turno 2: eliminato «Spaghetti alle vongole»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 2: eliminato «Gnocchi al pomodoro»

### mt-sessione-si-al-resto [GRAVE]
- titolare: modifichiamo menu cena
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, modifichiamo i piatti di oggi del *Menu cena*: cosa metto in *Primi*, *Secondi*, *Contorni*? Puoi scrivere tutto insieme o un pezzo alla volta; se un sottomenu resta com’è, dimmelo.»
- titolare: secondi tagliata di manzo e salmone alla griglia
  - bot: «Segnato: *Secondi* (Tagliata di manzo, Salmone alla griglia). E per *Primi* e *Contorni* cosa metto? Se qualcuno resta com’è dimmelo.»
- titolare: sì
  - bot: «*Menu cena aggiornato* *Secondi* • Tagliata di manzo • Salmone alla griglia Eliminati: Scaloppine al limone Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: hidden|Scaloppine al limone|true · ottenuto: delete|Scaloppine al limone
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Scaloppine al limone
- **GRAVE** non-applicato: non applicato: hidden|Scaloppine al limone|true
- **GRAVE** piatto-eliminato-in-sostituzione: turno 3: eliminato «Scaloppine al limone»

### mt-sessione-lunga-correzioni [GRAVE]
- titolare: modifichiamo il menu pranzo di oggi
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, modifichiamo i piatti di oggi del *Menu pranzo*: cosa metto in *Primi*, *Secondi*, *Contorni*? Puoi scrivere tutto insieme o un pezzo alla volta; se un sottomenu resta com’è, dimmelo.»
- titolare: allora primi: lasagna
  - bot: «Segnato: *Primi* (Lasagna). E per *Secondi* e *Contorni* cosa metto? Se qualcuno resta com’è dimmelo.»
- titolare: e anche la carbonara nei primi
  - bot: «Segnato: *Primi* (Lasagna, Carbonara). E per *Secondi* e *Contorni* cosa metto? Se qualcuno resta com’è dimmelo.»
- titolare: secondi cotoletta e arrosto
  - bot: «Segnato: *Primi* (Lasagna, Carbonara) · *Secondi* (Cotoletta alla milanese, Arrosto di vitello). E nei *Contorni* cosa metto? Se restano come sono scrivi «restano uguali».»
- titolare: no aspetta, l'arrosto no, metti le polpette
  - bot: «Segnato: *Primi* (Lasagna, Carbonara) · *Secondi* (Cotoletta alla milanese, Polpette al sugo). E nei *Contorni* cosa metto? Se restano come sono scrivi «restano uguali».»
- titolare: i contorni come ieri
  - bot: «*Menu pranzo aggiornato* *Primi* • Lasagna • Carbonara *Secondi* • Cotoletta alla milanese • Polpette al sugo Eliminati: Pasta al pomodoro, Penne all'arrabbiata, Risotto alla milanese, Pasta e fagioli, Petto di pollo ai ferri, Arrosto di vitello Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: create|carbonara|0|primi, create|lasagna|0|primi, hidden|Pasta al pomodoro|true, hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Risotto alla milanese|true · ottenuto: create|carbonara|0|primi, create|lasagna|0|primi, delete|Arrosto di vitello, delete|Pasta al pomodoro, delete|Pasta e fagioli, delete|Penne all'arrabbiata, delete|Petto di pollo ai ferri, delete|Risotto alla milanese
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Arrosto di vitello
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Pasta al pomodoro
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Pasta e fagioli
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Penne all'arrabbiata
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Petto di pollo ai ferri
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Risotto alla milanese
- **GRAVE** non-applicato: non applicato: hidden|Pasta al pomodoro|true, hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Risotto alla milanese|true
- **GRAVE** piatto-eliminato-in-sostituzione: turno 6: eliminato «Pasta al pomodoro»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 6: eliminato «Penne all'arrabbiata»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 6: eliminato «Risotto alla milanese»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 6: eliminato «Pasta e fagioli»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 6: eliminato «Petto di pollo ai ferri»
- **GRAVE** piatto-eliminato-in-sostituzione: turno 6: eliminato «Arrosto di vitello»

### mt-v138-sessione [GRAVE] — Primi = Lasagna + Risotto ai funghi (nuovo, 0 €), Secondi = Tagliata (nuova) + Polpette; il Menu non ha Contorni
- titolare: modifichiamo il menu del giorno
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, modifichiamo i piatti di oggi del *Menu del giorno*: cosa metto in *Primi*, *Secondi*? Puoi scrivere tutto insieme o un pezzo alla volta; se un sottomenu resta com’è, dimmelo.»
- titolare: primi: lasagne, carbonara e risoto ai funghi
  - bot: «Segnato: *Primi* (Lasagna, Carbonara, Risotto ai funghi). E nei *Secondi* cosa metto? Se restano come sono scrivi «restano uguali».»
- titolare: secondi tagliata e polpete al sugo
  - bot: «*Menu del giorno aggiornato* *Primi* • Carbonara • Risotto ai funghi • Lasagna *Secondi* • Tagliata • Polpette Eliminati: Gnocchi al ragù, Cotoletta, Frittata di zucchine, Frittata di patate Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: no la carbonara toglila
  - bot: «*Menu del giorno aggiornato* *Primi* • Lasagna • Risotto ai funghi Eliminati: Carbonara Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: i contorni restano uguali
  - bot: «Nel *Menu del giorno* non c’è *Contorni*: ci sono *Primi*, *Secondi*.»
- atteso: create|risotto ai funghi|0|primi, create|tagliata|0|secondi, hidden|Cotoletta|true, hidden|Gnocchi al ragù|true, hidden|Polpette|false · ottenuto: create|risotto ai funghi|0|primi, create|tagliata|0|secondi, delete|Carbonara, delete|Cotoletta, delete|Frittata di patate, delete|Frittata di zucchine, delete|Gnocchi al ragù, hidden|Polpette|false
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Carbonara
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Cotoletta
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Frittata di patate
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Frittata di zucchine
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Gnocchi al ragù
- **GRAVE** non-applicato: non applicato: hidden|Cotoletta|true, hidden|Gnocchi al ragù|true

