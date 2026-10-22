# Motore Haiku · set notte-caccia · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-22T02:35:35.457Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **113/116 (97.4%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 3 |
| Domande ogni 10 messaggi | 2.7 (non attese 2.2) |
| Latenza chiamata Haiku p50 / p95 | 2011 / 4514 ms (249 chiamate) |
| Latenza turno p50 / p95 | 17 / 51 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 0.93 |
| Token medi per messaggio (in · out · cache read · cache write) | 223 · 259 · 8809 · 346 |
| Cache hit (cache_read > 0) | 245/249 (98.4%) |
| Costo speso in questo giro | 0.002771 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.076091 $ · 0.000283 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 243 · 6 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 21.8 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiarimento-mancante | 0 | 3 | 0 |

## Falliti (trascrizione)

### cc-giornata-05 [MEDIO] — piatto eliminato e poi citato: al turno 4 non deve dire che costa 14 (non c'è più); «rimetti» = ricrearlo (prezzo chiest
- titolare: elimina i rigatoni con la pajata
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Da eliminare, serve il tuo sì: 1. *Rigatoni con la pajata*: da eliminare»
- titolare: sì
  - bot: «Ok, elimino *Rigatoni con la pajata* dal menu. *Rigatoni con la pajata*: *eliminato* dal menu»
- titolare: il saltimbocca a 16
  - bot: «Ok, il *Saltimbocca alla romana* passa a 16 €. *Saltimbocca alla romana*: prezzo da 15,00 € a *16,00 €*»
- titolare: ❓ quanto costa la pajata?
  - bot: «*Rigatoni con la pajata* l’hai eliminato poco fa: non è più nel menu. Per rimetterlo scrivimi «rimetti rigatoni con la pajata».»
- titolare: rimetti i rigatoni con la pajata
  - bot: «*Rigatoni con la pajata* l’hai eliminato poco fa. Lo rimetto nei *Primi* a *14,00 €* come prima? Rispondi *sì*, oppure scrivimi prezzo e sottomenu (per esempio «14 euro nei primi»).»
- titolare: 14 euro nei primi
  - bot: «Nuovo piatto *Rigatoni con la pajata* in *Primi*: *14,00 €*»
- titolare: la cicoria è finita
  - bot: «Ok, segno la *Cicoria ripassata* come esaurita. *Cicoria ripassata*: *finito*»
- titolare: ❓ grazie
  - bot: «Di niente! Se vuoi annullare l'ultima modifica, scrivi «annulla».»
- atteso: available|Cicoria ripassata|false, create|rigatoni con la pajata|14|primi, delete|Rigatoni con la pajata, price|Saltimbocca alla romana|16 · ottenuto: available|Cicoria ripassata|false, create|rigatoni con la pajata|14|primi, delete|Rigatoni con la pajata, price|Saltimbocca alla romana|16
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

### cc-scaduta-01 [MEDIO] — «sì» 40 minuti dopo: proposta scaduta, mai eliminare; dirlo e chiedere di nuovo
- titolare: elimina la panna cotta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Da eliminare, serve il tuo sì: 1. *Panna cotta*: da eliminare»
- titolare: [+40 min]
  - bot: «Non c'è niente in sospeso da confermare. Dimmi cosa vuoi modificare nel menu.»
- titolare: sì
  - bot: «»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

### cc-conferme-01 [MEDIO] — DUBBIO: 👍 come «sì» a un'eliminazione: elimina oppure chiede un sì scritto; mai ignorarlo in silenzio
- titolare: elimina la crostata di visciole
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Da eliminare, serve il tuo sì: 1. *Crostata di visciole*: da eliminare»
- titolare: 👍
  - bot: «Per eliminare mi serve un *sì* scritto: rispondi *sì* per confermare oppure *annulla*.»
- atteso: delete|Crostata di visciole · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

