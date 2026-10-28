# Banco E · R-prima-off

Generato da tests/eval (groq=off, riferimento=attuale-oracle, tetto=20000, conversazioni=318).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anche | 34 | 15 (44.1%) | 15 | 19 | 0 | 0 | 0 | 2.9% | 2 | 33 | 33 |
| correzione | 29 | 8 (27.6%) | 8 | 20 | 1 | 0 | 0 | 16.9% | 10 | 29 | 29 |
| ripristino | 24 | 15 (62.5%) | 15 | 9 | 0 | 0 | 0 | 5.9% | 3 | 12 | 12 |
| chiarimento | 31 | 25 (80.6%) | 25 | 2 | 4 | 0 | 0 | 49.2% | 4 | 28 | 28 |
| multipla | 18 | 0 (0%) | 0 | 18 | 0 | 0 | 0 | 13.9% | 0 | 17 | 17 |
| scaduto | 18 | 6 (33.3%) | 6 | 7 | 5 | 0 | 0 | 16.7% | 4 | 15 | 15 |
| domanda | 25 | 22 (88%) | 17 | 3 | 0 | 5 | 0 | 18.5% | 5 | 9 | 9 |
| negazione | 21 | 15 (71.4%) | 15 | 6 | 0 | 0 | 0 | 30.4% | 7 | 9 | 9 |
| ambiguita | 20 | 17 (85%) | 17 | 0 | 3 | 0 | 0 | 75% | 0 | 13 | 13 |
| togli | 17 | 12 (70.6%) | 12 | 4 | 1 | 0 | 0 | 10% | 2 | 7 | 7 |
| vocale | 32 | 12 (37.5%) | 12 | 19 | 1 | 0 | 0 | 50% | 17 | 22 | 22 |
| qa1710 | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 25% | 0 | 1 | 1 |
| manuel | 5 | 3 (60%) | 3 | 1 | 1 | 0 | 0 | 50% | 4 | 1 | 1 |
| batterie | 36 | 30 (83.3%) | 30 | 4 | 2 | 0 | 0 | 23.3% | 13 | 20 | 20 |
| multi-turno | 207 | 113 (54.6%) | 113 | 82 | 12 | 0 | 0 | 20% | 43 | 162 | 162 |
| TOTALE | 318 | 188 (59.1%) | 183 | 112 | 18 | 5 | 0 | 24.1% | 71 | 216 | 216 |

Latenza harness (webhook→risposta, senza rete) p50 9 ms · p95 18 ms. Con la latenza Groq registrata: p50 9 ms · p95 18 ms.
IA: 0 risposte (cache o vere), 780 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 63 | 0 | 0 |
| errore-generico | 35 | 0 | 0 |
| correzione-non-applicata | 32 | 0 | 0 |
| chiede-invece-di-agire | 0 | 36 | 0 |
| chiarimento-mancante | 0 | 21 | 0 |
| risposta-non-pertinente | 0 | 0 | 8 |

