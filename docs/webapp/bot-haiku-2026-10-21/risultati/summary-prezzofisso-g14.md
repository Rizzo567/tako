# Motore Haiku · set prezzofisso · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-22T03:41:31.777Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **75/75 (100%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 1.8 (non attese 0.8) |
| Latenza chiamata Haiku p50 / p95 | 2736 / 5297 ms (91 chiamate) |
| Latenza turno p50 / p95 | 21 / 50 ms (misurata dal vivo) |
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
| risposta-senza-contenuto | 0 | 0 | 1 |

## Falliti (trascrizione)

### pf-lettura-04 [BASSO] — i visibili, non la Pasta e fagioli nascosta
- titolare: ❓ cosa c'è oggi nei primi del pranzo?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nei *Primi* del *Menu pranzo* ci sono 4 piatti (1 nascosto): *Pasta al pomodoro*: *senza prezzo* · disponibile *Penne all'arrabbiata*: *senza prezzo* · disponibile *Risotto alla milanese*: *senza prezzo* · disponibile *Pasta e fagioli*: *senza prezzo* · disponibile · nascosto»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-senza-contenuto: turno 1: manca /^(?![\s\S]*fagioli)/i («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

