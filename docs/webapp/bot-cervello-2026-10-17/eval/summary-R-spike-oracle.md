# Banco E · R-spike-oracle

Generato da tests/eval (groq=oracle, riferimento=attuale-oracle, tetto=20000, conversazioni=318).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anche | 34 | 33 (97.1%) | 33 | 1 | 0 | 0 | 0 | 1.5% | 1 | 34 | 0 |
| correzione | 29 | 28 (96.6%) | 28 | 0 | 1 | 0 | 0 | 5.1% | 2 | 29 | 0 |
| ripristino | 24 | 19 (79.2%) | 19 | 5 | 0 | 0 | 0 | 7.8% | 4 | 24 | 0 |
| chiarimento | 31 | 25 (80.6%) | 25 | 1 | 5 | 0 | 1 | 56.9% | 7 | 31 | 0 |
| multipla | 18 | 15 (83.3%) | 15 | 1 | 2 | 0 | 0 | 50% | 5 | 18 | 0 |
| scaduto | 18 | 17 (94.4%) | 17 | 1 | 0 | 0 | 0 | 36.1% | 6 | 18 | 0 |
| domanda | 25 | 25 (100%) | 20 | 0 | 0 | 5 | 0 | 11.1% | 3 | 23 | 0 |
| negazione | 21 | 18 (85.7%) | 18 | 0 | 3 | 0 | 0 | 30.4% | 7 | 21 | 0 |
| ambiguita | 20 | 19 (95%) | 19 | 0 | 1 | 0 | 0 | 90% | 1 | 15 | 0 |
| togli | 17 | 15 (88.2%) | 15 | 0 | 2 | 0 | 0 | 10% | 2 | 15 | 0 |
| vocale | 32 | 32 (100%) | 32 | 0 | 0 | 0 | 0 | 0% | 0 | 32 | 0 |
| qa1710 | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 33.3% | 1 | 7 | 0 |
| manuel | 5 | 4 (80%) | 4 | 0 | 1 | 0 | 0 | 50% | 4 | 1 | 0 |
| batterie | 36 | 23 (63.9%) | 23 | 10 | 3 | 0 | 2 | 27.9% | 17 | 36 | 0 |
| multi-turno | 207 | 175 (84.5%) | 175 | 19 | 13 | 0 | 3 | 25.5% | 51 | 204 | 0 |
| TOTALE | 318 | 281 (88.4%) | 276 | 19 | 18 | 5 | 3 | 25.4% | 60 | 304 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 3.4 ms · p95 6.4 ms. Con la latenza Groq registrata: p50 3.4 ms · p95 6.4 ms.
IA: 478 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| correzione-non-applicata | 10 | 0 | 0 |
| non-applicato | 9 | 0 | 0 |
| modifica-non-richiesta | 2 | 0 | 0 |
| modifica-sbagliata | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 15 | 0 |
| chiarimento-mancante | 0 | 3 | 0 |
| risposta-non-pertinente | 0 | 0 | 5 |

