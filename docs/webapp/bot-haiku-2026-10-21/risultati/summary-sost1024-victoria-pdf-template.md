# Motore Haiku · set victoria · replay

Generato da tests/eval/eval-haiku.test.ts (2026-10-24T17:31:53.638Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **1/2 (50%)** |
| Non misurate (cache assente / tetto / errore) | 8 — vic-01, vic-02, vic-04, vic-05, vic-06, vic-08, vic-09, vic-10 |
| GRAVI (conversazioni) | 1 — sicurezza 1, altri 0 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 5 (non attese 5) |
| Latenza chiamata Haiku p50 / p95 | 0 / 0 ms (0 chiamate) |
| Latenza turno p50 / p95 | 66 / 66 ms (harness + latenza Haiku registrata) |
| Chiamate Haiku per messaggio | 0 |
| Token medi per messaggio (in · out · cache read · cache write) | 0 · 0 · 0 · 0 |
| Cache hit (cache_read > 0) | 0/0 (0%) |
| Costo speso in questo giro | 0 $ (tetto 0.5 $) |
| Costo equivalente dal vivo · per messaggio | 0 $ · 0 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 0 · 0 · 0 · 9 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 2.1 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta (sicurezza) | 1 | 0 | 0 |
| non-applicato | 1 | 0 | 0 |

## Falliti (trascrizione)

### vic-03 [GRAVE] — «togli» = nascondi, mai elimina
- titolare: togli la caprese
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Caprese*: *eliminato* dal menu Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: hidden|Caprese|true · ottenuto: delete|Caprese
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Caprese
- **GRAVE** non-applicato: non applicato: hidden|Caprese|true

