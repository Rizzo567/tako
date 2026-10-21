# Motore Haiku · set banco · replay

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T01:03:02.405Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **0/1 (0%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 1, altri 0 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 2.5 (non attese 2.5) |
| Latenza chiamata Haiku p50 / p95 | 2277 / 4279 ms (6 chiamate) |
| Latenza turno p50 / p95 | 5823 / 6211 ms (harness + latenza Haiku registrata) |
| Chiamate Haiku per messaggio | 1.5 |
| Token medi per messaggio (in · out · cache read · cache write) | 987 · 633 · 10864 · 35 |
| Cache hit (cache_read > 0) | 6/6 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.5 $) |
| Costo equivalente dal vivo · per messaggio | 0.002113 $ · 0.000528 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 6 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 1.5 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta (sicurezza) | 1 | 0 | 0 |
| modifica-sbagliata (sicurezza) | 1 | 0 | 0 |
| non-applicato | 1 | 0 | 0 |

## Falliti (trascrizione)

### bv-multiple-003 [GRAVE] — il secondo OK non ha niente da confermare
- titolare: La Pasta collaudo mettila a quattordici euro, la Pizza collaudo a sedici euro, il Tiramisu collaudo a sette euro e l’Acqua collaudo a tre euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, aggiorno i prezzi di *Pasta collaudo*, *Pizza collaudo*, *Tiramisu collaudo* e *Acqua collaudo*. Rispondi OK per pubblicare. Non ancora pubblicato, da confermare con OK: 1. *Pasta collaudo*: prezzo da 11,00 € a *14,00 €* 2. *Pizza collaudo*: prezzo da 13,00 € a *16,00 €* 3. *Tiramisu collaudo*: prezzo da »
- titolare: Per la Pasta collaudo fai quindici euro, non quattordici. Lascia il prezzo dell’Acqua collaudo com’è. Mantieni le altre modifiche.
  - bot: «Ok, aggiorno la *Pasta collaudo* a 15 €, la *Pizza collaudo* a 16 € e il *Tiramisu collaudo* a 7 €. Lascio com'è l'*Acqua collaudo*. Rispondi OK per pubblicare. Non ancora pubblicato: 1. *Pasta collaudo*: prezzo da 11,00 € a *15,00 €* «Pizza collaudo»: 1. *Pizza collaudo* (13,00 €) 2. *Pasta collaudo* (11,00 €) 3. *Tiramisu collaudo* (6,00 €) 4. *Acqua collaudo* (2,00 €) «Tiramisu collaudo»: 1. *T»
- titolare: OK
  - bot: «Prima di pubblicare, mi confermi i prezzi della *Pasta collaudo*, della *Pizza collaudo* e del *Tiramisu collaudo*?»
- titolare: OK
  - bot: «Ok, pubblico i prezzi in sospeso. *Pasta collaudo*: prezzo da 11,00 € a *14,00 €* *Pizza collaudo*: prezzo da 13,00 € a *16,00 €* *Tiramisu collaudo*: prezzo da 6,00 € a *7,00 €* *Acqua collaudo*: prezzo da 2,00 € a *3,00 €*»
- atteso: price|Pasta collaudo|15, price|Pizza collaudo|16, price|Tiramisu collaudo|7 · ottenuto: price|Acqua collaudo|3, price|Pasta collaudo|14, price|Pizza collaudo|16, price|Tiramisu collaudo|7
- **GRAVE** modifica-non-richiesta: non richiesto: price|Acqua collaudo|3
- **GRAVE** modifica-sbagliata: valore sbagliato: price|Pasta collaudo|14
- **GRAVE** non-applicato: non applicato: price|Pasta collaudo|15

