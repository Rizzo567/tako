# Banco E · R5-oracle

Generato da tests/eval (groq=oracle, riferimento=attuale-oracle, tetto=20000, conversazioni=318).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anche | 34 | 34 (100%) | 34 | 0 | 0 | 0 | 0 | 0% | 0 | 34 | 0 |
| correzione | 29 | 29 (100%) | 29 | 0 | 0 | 0 | 0 | 1.7% | 0 | 29 | 0 |
| ripristino | 24 | 24 (100%) | 24 | 0 | 0 | 0 | 0 | 0% | 0 | 24 | 0 |
| chiarimento | 31 | 29 (93.5%) | 29 | 0 | 2 | 0 | 0 | 53.8% | 5 | 31 | 0 |
| multipla | 18 | 17 (94.4%) | 17 | 0 | 1 | 0 | 0 | 50% | 5 | 18 | 0 |
| scaduto | 18 | 18 (100%) | 18 | 0 | 0 | 0 | 0 | 38.9% | 7 | 18 | 0 |
| domanda | 25 | 25 (100%) | 20 | 0 | 0 | 5 | 0 | 29.6% | 8 | 25 | 0 |
| negazione | 21 | 20 (95.2%) | 20 | 0 | 1 | 0 | 0 | 34.8% | 8 | 21 | 0 |
| ambiguita | 20 | 20 (100%) | 20 | 0 | 0 | 0 | 0 | 95% | 1 | 20 | 0 |
| togli | 17 | 17 (100%) | 17 | 0 | 0 | 0 | 0 | 0% | 0 | 17 | 0 |
| vocale | 32 | 32 (100%) | 32 | 0 | 0 | 0 | 0 | 0% | 0 | 32 | 0 |
| qa1710 | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 33.3% | 1 | 8 | 0 |
| manuel | 5 | 4 (80%) | 4 | 0 | 1 | 0 | 0 | 0% | 0 | 5 | 0 |
| batterie | 36 | 36 (100%) | 36 | 0 | 0 | 0 | 0 | 27.9% | 16 | 36 | 0 |
| multi-turno | 207 | 204 (98.6%) | 204 | 0 | 3 | 0 | 0 | 21.8% | 34 | 207 | 0 |
| TOTALE | 318 | 313 (98.4%) | 308 | 0 | 5 | 5 | 0 | 23.9% | 51 | 318 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 4.1 ms · p95 7.3 ms. Con la latenza Groq registrata: p50 4.1 ms · p95 7.3 ms.
IA: 559 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 3 | 0 |
| chiarimento-mancante | 0 | 2 | 0 |
| risposta-non-pertinente | 0 | 0 | 5 |

