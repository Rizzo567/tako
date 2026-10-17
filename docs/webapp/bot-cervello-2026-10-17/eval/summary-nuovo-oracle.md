# Banco E · nuovo-oracle

Generato da tests/eval (groq=oracle, riferimento=attuale-oracle, tetto=20000, conversazioni=318).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anche | 34 | 32 (94.1%) | 32 | 2 | 0 | 0 | 0 | 0% | 0 | 34 | 0 |
| correzione | 29 | 25 (86.2%) | 25 | 4 | 0 | 0 | 0 | 3.4% | 1 | 29 | 0 |
| ripristino | 24 | 20 (83.3%) | 20 | 4 | 0 | 0 | 0 | 2% | 1 | 12 | 0 |
| chiarimento | 31 | 31 (100%) | 31 | 0 | 0 | 0 | 0 | 46.2% | 0 | 28 | 0 |
| multipla | 18 | 12 (66.7%) | 12 | 4 | 2 | 0 | 0 | 44.4% | 4 | 17 | 0 |
| scaduto | 18 | 17 (94.4%) | 17 | 1 | 0 | 0 | 0 | 30.6% | 4 | 15 | 0 |
| domanda | 25 | 25 (100%) | 23 | 0 | 0 | 2 | 0 | 7.4% | 2 | 9 | 0 |
| negazione | 21 | 20 (95.2%) | 20 | 1 | 0 | 0 | 0 | 13% | 3 | 9 | 0 |
| ambiguita | 20 | 19 (95%) | 19 | 0 | 1 | 0 | 0 | 90% | 1 | 12 | 0 |
| togli | 17 | 16 (94.1%) | 16 | 0 | 1 | 0 | 0 | 5% | 1 | 7 | 0 |
| vocale | 32 | 29 (90.6%) | 29 | 3 | 0 | 0 | 0 | 0% | 0 | 23 | 0 |
| qa1710 | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 25% | 0 | 1 | 0 |
| manuel | 5 | 4 (80%) | 4 | 0 | 1 | 0 | 0 | 50% | 4 | 1 | 0 |
| batterie | 36 | 31 (86.1%) | 31 | 4 | 1 | 0 | 0 | 23.3% | 13 | 20 | 0 |
| multi-turno | 207 | 185 (89.4%) | 185 | 19 | 3 | 0 | 0 | 20% | 28 | 163 | 0 |
| TOTALE | 318 | 289 (90.9%) | 287 | 23 | 6 | 2 | 0 | 20.5% | 34 | 217 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 1.7 ms · p95 4.7 ms. Con la latenza Groq registrata: p50 1.7 ms · p95 4.7 ms.
IA: 247 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| correzione-non-applicata | 10 | 0 | 0 |
| richiesta-persa | 8 | 0 | 0 |
| non-applicato | 7 | 0 | 0 |
| chiede-invece-di-agire | 0 | 4 | 0 |
| chiarimento-mancante | 0 | 4 | 0 |
| risposta-non-pertinente | 0 | 0 | 2 |

