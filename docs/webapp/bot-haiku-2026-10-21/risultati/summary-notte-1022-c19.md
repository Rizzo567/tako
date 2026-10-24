# Motore Haiku · set notte-1022 · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-22T00:14:21.963Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **72/73 (98.6%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 1, altri 0 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 1.8 (non attese 0.9) |
| Latenza chiamata Haiku p50 / p95 | 2145 / 5192 ms (110 chiamate) |
| Latenza turno p50 / p95 | 19 / 38 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.02 |
| Token medi per messaggio (in · out · cache read · cache write) | 139 · 311 · 9801 · 201 |
| Cache hit (cache_read > 0) | 109/110 (99.1%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.031593 $ · 0.000293 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 110 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 3.8 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta (sicurezza) | 1 | 0 | 0 |
| non-applicato | 1 | 0 | 0 |

## Falliti (trascrizione)

### n-pronome-quello-prima [GRAVE] — «quello di prima» = il Supplì; una domanda tra i due è accettata
- titolare: nascondi il supplì
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nascondo il *Supplì* dal menu. *Supplì*: *nascosto* dal menu»
- titolare: e la crocchetta pure
  - bot: «Nascondo la *Crocchetta* dal menu. *Crocchetta*: *nascosto* dal menu»
- titolare: anzi quello di prima rimettilo
  - bot: «*Crocchetta*: di nuovo *visibile* nel menu»
- atteso: hidden|Crocchetta|true · ottenuto: hidden|Supplì|true
- **GRAVE** modifica-non-richiesta: non richiesto: hidden|Supplì|true
- **GRAVE** non-applicato: non applicato: hidden|Crocchetta|true

