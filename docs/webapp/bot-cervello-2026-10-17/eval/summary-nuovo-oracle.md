# Banco E · nuovo-oracle

Generato da tests/eval (groq=oracle, riferimento=attuale-oracle, tetto=20000, conversazioni=318).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anche | 34 | 34 (100%) | 34 | 0 | 0 | 0 | 0 | 0% | 0 | 33 | 0 |
| correzione | 29 | 28 (96.6%) | 28 | 1 | 0 | 0 | 0 | 3.4% | 1 | 29 | 0 |
| ripristino | 24 | 20 (83.3%) | 20 | 4 | 0 | 0 | 0 | 7.8% | 4 | 12 | 0 |
| chiarimento | 31 | 30 (96.8%) | 30 | 0 | 1 | 0 | 0 | 49.2% | 2 | 28 | 0 |
| multipla | 18 | 14 (77.8%) | 14 | 2 | 2 | 0 | 0 | 50% | 5 | 17 | 0 |
| scaduto | 18 | 17 (94.4%) | 17 | 1 | 0 | 0 | 0 | 36.1% | 6 | 15 | 0 |
| domanda | 25 | 25 (100%) | 23 | 0 | 0 | 2 | 0 | 7.4% | 2 | 9 | 0 |
| negazione | 21 | 20 (95.2%) | 20 | 0 | 1 | 0 | 0 | 17.4% | 4 | 9 | 0 |
| ambiguita | 20 | 19 (95%) | 19 | 0 | 1 | 0 | 0 | 90% | 1 | 13 | 0 |
| togli | 17 | 16 (94.1%) | 16 | 0 | 1 | 0 | 0 | 5% | 1 | 7 | 0 |
| vocale | 32 | 32 (100%) | 32 | 0 | 0 | 0 | 0 | 0% | 0 | 22 | 0 |
| qa1710 | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 33.3% | 1 | 1 | 0 |
| manuel | 5 | 4 (80%) | 4 | 0 | 1 | 0 | 0 | 50% | 4 | 1 | 0 |
| batterie | 36 | 31 (86.1%) | 31 | 4 | 1 | 0 | 0 | 26.7% | 16 | 20 | 0 |
| multi-turno | 207 | 191 (92.3%) | 191 | 12 | 4 | 0 | 0 | 22.9% | 40 | 162 | 0 |
| TOTALE | 318 | 298 (93.7%) | 296 | 12 | 8 | 2 | 0 | 23% | 47 | 216 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 2.1 ms · p95 6.6 ms. Con la latenza Groq registrata: p50 2.1 ms · p95 6.6 ms.
IA: 244 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| correzione-non-applicata | 7 | 0 | 0 |
| non-applicato | 6 | 0 | 0 |
| chiede-invece-di-agire | 0 | 6 | 0 |
| chiarimento-mancante | 0 | 3 | 0 |
| risposta-non-pertinente | 0 | 0 | 2 |

