# Banco E · nuovo-oracle

Generato da tests/eval (groq=oracle, riferimento=attuale-oracle, tetto=20000, conversazioni=318).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anche | 34 | 33 (97.1%) | 33 | 1 | 0 | 0 | 0 | 0% | 0 | 34 | 0 |
| correzione | 29 | 26 (89.7%) | 26 | 3 | 0 | 0 | 0 | 3.4% | 1 | 29 | 0 |
| ripristino | 24 | 20 (83.3%) | 20 | 4 | 0 | 0 | 0 | 2% | 1 | 12 | 0 |
| chiarimento | 31 | 31 (100%) | 31 | 0 | 0 | 0 | 0 | 46.2% | 0 | 28 | 0 |
| multipla | 18 | 14 (77.8%) | 14 | 3 | 1 | 0 | 0 | 41.7% | 3 | 17 | 0 |
| scaduto | 18 | 17 (94.4%) | 17 | 1 | 0 | 0 | 0 | 36.1% | 6 | 15 | 0 |
| domanda | 25 | 25 (100%) | 23 | 0 | 0 | 2 | 0 | 7.4% | 2 | 9 | 0 |
| negazione | 21 | 20 (95.2%) | 20 | 0 | 1 | 0 | 0 | 17.4% | 4 | 9 | 0 |
| ambiguita | 20 | 19 (95%) | 19 | 0 | 1 | 0 | 0 | 90% | 1 | 13 | 0 |
| togli | 17 | 16 (94.1%) | 16 | 0 | 1 | 0 | 0 | 5% | 1 | 7 | 0 |
| vocale | 32 | 30 (93.8%) | 30 | 2 | 0 | 0 | 0 | 0% | 0 | 24 | 0 |
| qa1710 | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 25% | 0 | 1 | 0 |
| manuel | 5 | 4 (80%) | 4 | 0 | 1 | 0 | 0 | 50% | 4 | 1 | 0 |
| batterie | 36 | 31 (86.1%) | 31 | 4 | 1 | 0 | 0 | 24.4% | 14 | 20 | 0 |
| multi-turno | 207 | 189 (91.3%) | 189 | 16 | 2 | 0 | 0 | 20.4% | 30 | 163 | 0 |
| TOTALE | 318 | 294 (92.5%) | 292 | 18 | 6 | 2 | 0 | 21% | 37 | 219 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 1.8 ms · p95 4.6 ms. Con la latenza Groq registrata: p50 1.8 ms · p95 4.6 ms.
IA: 249 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| correzione-non-applicata | 9 | 0 | 0 |
| non-applicato | 6 | 0 | 0 |
| richiesta-persa | 4 | 0 | 0 |
| chiede-invece-di-agire | 0 | 4 | 0 |
| chiarimento-mancante | 0 | 4 | 0 |
| risposta-non-pertinente | 0 | 0 | 2 |

