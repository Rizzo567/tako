# Banco E · fixA-oracle

Generato da tests/eval (groq=oracle, riferimento=attuale-oracle, tetto=20000, conversazioni=318).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anche | 34 | 33 (97.1%) | 33 | 0 | 1 | 0 | 0 | 1.5% | 1 | 34 | 0 |
| correzione | 29 | 26 (89.7%) | 26 | 3 | 0 | 0 | 0 | 3.4% | 1 | 29 | 0 |
| ripristino | 24 | 20 (83.3%) | 20 | 4 | 0 | 0 | 0 | 7.8% | 4 | 12 | 0 |
| chiarimento | 31 | 31 (100%) | 31 | 0 | 0 | 0 | 0 | 47.7% | 1 | 28 | 0 |
| multipla | 18 | 14 (77.8%) | 14 | 2 | 2 | 0 | 0 | 44.4% | 4 | 17 | 0 |
| scaduto | 18 | 17 (94.4%) | 17 | 1 | 0 | 0 | 0 | 36.1% | 6 | 15 | 0 |
| domanda | 25 | 25 (100%) | 23 | 0 | 0 | 2 | 0 | 7.4% | 2 | 9 | 0 |
| negazione | 21 | 20 (95.2%) | 20 | 0 | 1 | 0 | 0 | 17.4% | 4 | 9 | 0 |
| ambiguita | 20 | 19 (95%) | 19 | 0 | 1 | 0 | 0 | 90% | 1 | 13 | 0 |
| togli | 17 | 16 (94.1%) | 16 | 0 | 1 | 0 | 0 | 5% | 1 | 7 | 0 |
| vocale | 32 | 32 (100%) | 32 | 0 | 0 | 0 | 0 | 0% | 0 | 22 | 0 |
| qa1710 | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 33.3% | 1 | 1 | 0 |
| manuel | 5 | 4 (80%) | 4 | 0 | 1 | 0 | 0 | 50% | 4 | 1 | 0 |
| batterie | 36 | 31 (86.1%) | 31 | 4 | 1 | 0 | 0 | 26.7% | 16 | 20 | 0 |
| multi-turno | 207 | 189 (91.3%) | 189 | 14 | 4 | 0 | 0 | 22.5% | 39 | 163 | 0 |
| TOTALE | 318 | 296 (93.1%) | 294 | 14 | 8 | 2 | 0 | 22.7% | 46 | 217 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 2 ms · p95 6.1 ms. Con la latenza Groq registrata: p50 2 ms · p95 6.1 ms.
IA: 246 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| correzione-non-applicata | 9 | 0 | 0 |
| non-applicato | 6 | 0 | 0 |
| chiede-invece-di-agire | 0 | 6 | 0 |
| chiarimento-mancante | 0 | 4 | 0 |
| risposta-non-pertinente | 0 | 0 | 2 |

