# Banco E · attuale-replay

Generato da tests/eval (groq=replay, tetto=20000, orologio=2026-10-16T10:00:00Z, conversazioni=318).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anche | 34 | 14 (41.2%) | 14 | 20 | 0 | 0 | 0 | 4.4% | 3 | 20 | 18 |
| correzione | 29 | 18 (62.1%) | 18 | 11 | 0 | 0 | 0 | 6.8% | 4 | 10 | 9 |
| ripristino | 24 | 6 (25%) | 6 | 18 | 0 | 0 | 0 | 13.7% | 7 | 13 | 12 |
| chiarimento | 31 | 26 (83.9%) | 26 | 2 | 3 | 0 | 0 | 47.7% | 3 | 2 | 2 |
| multipla | 18 | 0 (0%) | 0 | 17 | 1 | 0 | 0 | 13.9% | 0 | 17 | 16 |
| scaduto | 18 | 3 (16.7%) | 3 | 14 | 1 | 0 | 0 | 11.1% | 3 | 15 | 13 |
| domanda | 25 | 17 (68%) | 17 | 8 | 0 | 0 | 0 | 18.5% | 5 | 8 | 8 |
| negazione | 21 | 12 (57.1%) | 12 | 8 | 1 | 0 | 0 | 30.4% | 7 | 9 | 8 |
| ambiguita | 20 | 16 (80%) | 16 | 3 | 1 | 0 | 0 | 75% | 0 | 3 | 3 |
| togli | 17 | 8 (47.1%) | 8 | 9 | 0 | 0 | 0 | 15% | 3 | 9 | 9 |
| vocale | 32 | 9 (28.1%) | 9 | 23 | 0 | 0 | 0 | 52.9% | 18 | 22 | 21 |
| qa1710 | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 25% | 0 | 0 | 0 |
| manuel | 5 | 0 (0%) | 0 | 3 | 2 | 0 | 0 | 40% | 4 | 5 | 3 |
| batterie | 36 | 27 (75%) | 27 | 9 | 0 | 0 | 0 | 23.3% | 13 | 9 | 9 |
| multi-turno | 207 | 105 (50.7%) | 105 | 96 | 6 | 0 | 0 | 19% | 40 | 92 | 84 |
| TOTALE | 318 | 164 (51.6%) | 164 | 145 | 9 | 0 | 0 | 23.6% | 70 | 142 | 131 |

Latenza harness (webhook→risposta, senza rete) p50 1.2 ms · p95 2.9 ms. Con la latenza Groq registrata: p50 1.2 ms · p95 3.7 ms.
IA: 15 risposte (cache o vere), 282 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| errore-generico | 141 | 0 | 0 |
| non-applicato | 60 | 0 | 0 |
| correzione-non-applicata | 28 | 0 | 0 |
| richiesta-persa | 5 | 0 | 0 |
| chiede-invece-di-agire | 0 | 33 | 0 |
| chiarimento-mancante | 0 | 23 | 0 |
| risposta-non-pertinente | 0 | 0 | 8 |

