# Banco E · nuovo-off

Generato da tests/eval (groq=off, riferimento=attuale-oracle, tetto=20000, conversazioni=318).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anche | 34 | 0 (0%) | 0 | 34 | 0 | 0 | 0 | 0% | 0 | 34 | 34 |
| correzione | 29 | 2 (6.9%) | 2 | 27 | 0 | 0 | 0 | 0% | 0 | 29 | 29 |
| ripristino | 24 | 20 (83.3%) | 20 | 4 | 0 | 0 | 0 | 0% | 0 | 24 | 24 |
| chiarimento | 31 | 0 (0%) | 0 | 24 | 7 | 0 | 0 | 0% | 0 | 31 | 31 |
| multipla | 18 | 0 (0%) | 0 | 18 | 0 | 0 | 0 | 0% | 0 | 18 | 18 |
| scaduto | 18 | 2 (11.1%) | 2 | 16 | 0 | 0 | 0 | 0% | 0 | 18 | 18 |
| domanda | 25 | 23 (92%) | 3 | 2 | 0 | 20 | 0 | 0% | 0 | 25 | 25 |
| negazione | 21 | 7 (33.3%) | 7 | 14 | 0 | 0 | 0 | 0% | 0 | 21 | 21 |
| ambiguita | 20 | 1 (5%) | 1 | 1 | 18 | 0 | 0 | 0% | 0 | 20 | 20 |
| togli | 17 | 2 (11.8%) | 2 | 15 | 0 | 0 | 0 | 0% | 0 | 17 | 17 |
| vocale | 32 | 0 (0%) | 0 | 32 | 0 | 0 | 0 | 0% | 0 | 32 | 32 |
| qa1710 | 8 | 1 (12.5%) | 1 | 6 | 1 | 0 | 0 | 0% | 0 | 8 | 8 |
| manuel | 5 | 0 (0%) | 0 | 5 | 0 | 0 | 0 | 0% | 0 | 5 | 5 |
| batterie | 36 | 6 (16.7%) | 6 | 28 | 2 | 0 | 0 | 0% | 0 | 36 | 36 |
| multi-turno | 207 | 32 (15.5%) | 32 | 166 | 9 | 0 | 0 | 0% | 0 | 207 | 207 |
| TOTALE | 318 | 64 (20.1%) | 44 | 226 | 28 | 20 | 0 | 0% | 0 | 318 | 318 |

Latenza harness (webhook→risposta, senza rete) p50 6.6 ms · p95 10.8 ms. Con la latenza Groq registrata: p50 6.6 ms · p95 10.8 ms.
IA: 0 risposte (cache o vere), 1094 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 226 | 0 | 0 |
| chiarimento-mancante | 0 | 82 | 0 |
| opzioni-non-leggibili | 0 | 5 | 0 |
| risposta-non-pertinente | 0 | 0 | 25 |

