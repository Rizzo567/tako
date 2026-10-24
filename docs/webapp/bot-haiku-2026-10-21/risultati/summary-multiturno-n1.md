# Motore Haiku · set multiturno · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T20:34:19.420Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **36/37 (97.3%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 1, altri 0 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 5.3 (non attese 5.1) |
| Latenza chiamata Haiku p50 / p95 | 2945 / 5628 ms (52 chiamate) |
| Latenza turno p50 / p95 | 16 / 2842 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 0.52 |
| Token medi per messaggio (in · out · cache read · cache write) | 179 · 251 · 4783 · 353 |
| Cache hit (cache_read > 0) | 49/52 (94.2%) |
| Costo speso in questo giro | 0.005894 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.023552 $ · 0.000236 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 38 · 14 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 33.9 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta (sicurezza) | 2 | 0 | 0 |
| sostituzione-incompleta | 1 | 0 | 0 |

## Falliti (trascrizione)

### mt-sessione-refusi [GRAVE]
- titolare: modifichiamo menu pranzo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, modifichiamo i piatti di oggi del *Menu pranzo*: cosa metto in *Primi*, *Secondi*, *Contorni*? Puoi scrivere tutto insieme o un pezzo alla volta; se un sottomenu resta com’è, dimmelo.»
- titolare: primi risoto alla milanese e pasta al pomodorro
  - bot: «Segnato: *Primi* (Risotto alla milanese, Pasta al pomodoro). E per *Secondi* e *Contorni* cosa metto? Se qualcuno resta com’è dimmelo.»
- titolare: secondi cotolleta
  - bot: «Segnato: *Primi* (Risotto alla milanese, Pasta al pomodoro) · *Secondi* (Cotolleta). E nei *Contorni* cosa metto? Se restano come sono scrivi «restano uguali».»
- titolare: contorni restano uguali
  - bot: «Oggi nei *Primi* del *Menu pranzo*: *Pasta al pomodoro*, *Risotto alla milanese*. Nascosti: *Penne all'arrabbiata* (tornano quando li rimetti). Oggi nei *Secondi* del *Menu pranzo*: *Cotolleta*. Nascosti: *Cotoletta alla milanese*, *Petto di pollo ai ferri*, *Polpette al sugo* (tornano quando li rimetti). Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Polpette al sugo|true · ottenuto: create|cotolleta|0|secondi, hidden|Cotoletta alla milanese|true, hidden|Penne all'arrabbiata|true, hidden|Petto di pollo ai ferri|true, hidden|Polpette al sugo|true
- **GRAVE** modifica-non-richiesta: non richiesto: create|cotolleta|0|secondi
- **GRAVE** modifica-non-richiesta: non richiesto: hidden|Cotoletta alla milanese|true
- **GRAVE** sostituzione-incompleta: turno 4: «Menu pranzo > Secondi»: manca «Cotoletta alla milanese»; «Cotolleta» visibile ma non detto

