# Banco E · attuale-off

Generato da tests/eval (groq=off, tetto=20000, orologio=2026-10-16T10:00:00Z, conversazioni=318).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anche | 34 | 14 (41.2%) | 14 | 20 | 0 | 0 | 0 | 4.4% | 3 | 20 | 20 |
| correzione | 29 | 18 (62.1%) | 18 | 11 | 0 | 0 | 0 | 8.5% | 5 | 10 | 10 |
| ripristino | 24 | 6 (25%) | 6 | 18 | 0 | 0 | 0 | 13.7% | 7 | 13 | 13 |
| chiarimento | 31 | 26 (83.9%) | 26 | 2 | 3 | 0 | 0 | 47.7% | 3 | 2 | 2 |
| multipla | 18 | 0 (0%) | 0 | 18 | 0 | 0 | 0 | 13.9% | 0 | 17 | 17 |
| scaduto | 18 | 3 (16.7%) | 3 | 15 | 0 | 0 | 0 | 11.1% | 3 | 15 | 15 |
| domanda | 25 | 17 (68%) | 17 | 8 | 0 | 0 | 0 | 18.5% | 5 | 8 | 8 |
| negazione | 21 | 12 (57.1%) | 12 | 9 | 0 | 0 | 0 | 30.4% | 7 | 9 | 9 |
| ambiguita | 20 | 16 (80%) | 16 | 3 | 1 | 0 | 0 | 75% | 0 | 3 | 3 |
| togli | 17 | 8 (47.1%) | 8 | 9 | 0 | 0 | 0 | 15% | 3 | 9 | 9 |
| vocale | 32 | 9 (28.1%) | 9 | 23 | 0 | 0 | 0 | 55.9% | 19 | 22 | 22 |
| qa1710 | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 25% | 0 | 0 | 0 |
| manuel | 5 | 0 (0%) | 0 | 5 | 0 | 0 | 0 | 60% | 5 | 5 | 5 |
| batterie | 36 | 27 (75%) | 27 | 9 | 0 | 0 | 0 | 23.3% | 13 | 9 | 9 |
| multi-turno | 207 | 105 (50.7%) | 105 | 99 | 3 | 0 | 0 | 19.5% | 42 | 92 | 92 |
| TOTALE | 318 | 164 (51.6%) | 164 | 150 | 4 | 0 | 0 | 24.3% | 73 | 142 | 142 |

Latenza harness (webhook→risposta, senza rete) p50 1.1 ms · p95 2.4 ms. Con la latenza Groq registrata: p50 1.1 ms · p95 2.4 ms.
IA: 0 risposte (cache o vere), 312 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| errore-generico | 156 | 0 | 0 |
| non-applicato | 65 | 0 | 0 |
| correzione-non-applicata | 28 | 0 | 0 |
| richiesta-persa | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 35 | 0 |
| chiarimento-mancante | 0 | 22 | 0 |
| risposta-non-pertinente | 0 | 0 | 8 |

