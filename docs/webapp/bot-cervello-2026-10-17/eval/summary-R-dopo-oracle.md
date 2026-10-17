# Banco E · R-dopo-oracle

Generato da tests/eval (groq=oracle, riferimento=attuale-oracle, tetto=20000, conversazioni=318).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anche | 34 | 33 (97.1%) | 33 | 1 | 0 | 0 | 0 | 1.5% | 1 | 34 | 0 |
| correzione | 29 | 28 (96.6%) | 28 | 1 | 0 | 0 | 0 | 3.4% | 1 | 29 | 0 |
| ripristino | 24 | 23 (95.8%) | 23 | 1 | 0 | 0 | 0 | 2% | 1 | 24 | 0 |
| chiarimento | 31 | 29 (93.5%) | 29 | 0 | 2 | 0 | 0 | 53.8% | 5 | 31 | 0 |
| multipla | 18 | 17 (94.4%) | 17 | 0 | 1 | 0 | 0 | 50% | 5 | 18 | 0 |
| scaduto | 18 | 17 (94.4%) | 17 | 1 | 0 | 0 | 0 | 36.1% | 6 | 18 | 0 |
| domanda | 25 | 25 (100%) | 20 | 0 | 0 | 5 | 0 | 29.6% | 8 | 25 | 0 |
| negazione | 21 | 20 (95.2%) | 20 | 0 | 1 | 0 | 0 | 34.8% | 8 | 21 | 0 |
| ambiguita | 20 | 20 (100%) | 20 | 0 | 0 | 0 | 0 | 95% | 1 | 20 | 0 |
| togli | 17 | 17 (100%) | 17 | 0 | 0 | 0 | 0 | 0% | 0 | 17 | 0 |
| vocale | 32 | 32 (100%) | 32 | 0 | 0 | 0 | 0 | 0% | 0 | 32 | 0 |
| qa1710 | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 33.3% | 1 | 8 | 0 |
| manuel | 5 | 3 (60%) | 3 | 1 | 1 | 0 | 0 | 0% | 0 | 5 | 0 |
| batterie | 36 | 34 (94.4%) | 34 | 2 | 0 | 0 | 0 | 27.9% | 16 | 36 | 0 |
| multi-turno | 207 | 197 (95.2%) | 197 | 7 | 3 | 0 | 0 | 22.2% | 36 | 207 | 0 |
| TOTALE | 318 | 306 (96.2%) | 301 | 7 | 5 | 5 | 0 | 24.3% | 53 | 318 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 4.3 ms · p95 7.4 ms. Con la latenza Groq registrata: p50 4.3 ms · p95 7.4 ms.
IA: 559 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 5 | 0 | 0 |
| correzione-non-applicata | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 4 | 0 |
| chiarimento-mancante | 0 | 2 | 0 |
| risposta-non-pertinente | 0 | 0 | 5 |

