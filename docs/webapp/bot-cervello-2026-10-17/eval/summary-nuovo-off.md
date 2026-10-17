# Banco E · nuovo-off

Generato da tests/eval (groq=off, riferimento=attuale-off, tetto=20000, conversazioni=318).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anche | 34 | 14 (41.2%) | 14 | 20 | 0 | 0 | 0 | 4.4% | 3 | 34 | 34 |
| correzione | 29 | 18 (62.1%) | 18 | 11 | 0 | 0 | 0 | 8.5% | 5 | 29 | 29 |
| ripristino | 24 | 15 (62.5%) | 15 | 9 | 0 | 0 | 0 | 5.9% | 3 | 12 | 12 |
| chiarimento | 31 | 26 (83.9%) | 26 | 2 | 3 | 0 | 0 | 47.7% | 3 | 28 | 28 |
| multipla | 18 | 0 (0%) | 0 | 18 | 0 | 0 | 0 | 13.9% | 0 | 17 | 17 |
| scaduto | 18 | 5 (27.8%) | 5 | 13 | 0 | 0 | 0 | 16.7% | 4 | 15 | 15 |
| domanda | 25 | 17 (68%) | 17 | 8 | 0 | 0 | 0 | 18.5% | 5 | 9 | 9 |
| negazione | 21 | 12 (57.1%) | 12 | 9 | 0 | 0 | 0 | 30.4% | 7 | 9 | 9 |
| ambiguita | 20 | 16 (80%) | 16 | 3 | 1 | 0 | 0 | 75% | 0 | 12 | 12 |
| togli | 17 | 11 (64.7%) | 11 | 5 | 1 | 0 | 0 | 10% | 2 | 7 | 7 |
| vocale | 32 | 9 (28.1%) | 9 | 23 | 0 | 0 | 0 | 55.9% | 19 | 23 | 23 |
| qa1710 | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 25% | 0 | 1 | 1 |
| manuel | 5 | 3 (60%) | 3 | 1 | 1 | 0 | 0 | 50% | 4 | 1 | 1 |
| batterie | 36 | 26 (72.2%) | 26 | 10 | 0 | 0 | 0 | 24.4% | 14 | 20 | 20 |
| multi-turno | 207 | 118 (57%) | 118 | 86 | 3 | 0 | 0 | 19% | 39 | 163 | 163 |
| TOTALE | 318 | 180 (56.6%) | 180 | 132 | 6 | 0 | 0 | 23.8% | 69 | 217 | 217 |

Latenza harness (webhook→risposta, senza rete) p50 1.8 ms · p95 3.7 ms. Con la latenza Groq registrata: p50 1.8 ms · p95 3.7 ms.
IA: 0 risposte (cache o vere), 784 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| errore-generico | 135 | 0 | 0 |
| non-applicato | 60 | 0 | 0 |
| correzione-non-applicata | 21 | 0 | 0 |
| richiesta-persa | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 33 | 0 |
| chiarimento-mancante | 0 | 21 | 0 |
| risposta-non-pertinente | 0 | 0 | 8 |

