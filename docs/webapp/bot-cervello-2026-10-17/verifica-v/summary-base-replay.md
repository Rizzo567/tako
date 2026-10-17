# Banco E · base-replay

Generato da tests/eval (groq=replay, bot=nuovo, tetto=20000, conversazioni=143).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| v-deixis | 13 | 2 (15.4%) | 2 | 11 | 0 | 0 | 0 | 5.9% | 2 | 13 | 11 |
| v-elimina | 10 | 2 (20%) | 2 | 8 | 0 | 0 | 4 | 14.3% | 2 | 5 | 3 |
| v-aggiunte | 11 | 6 (54.5%) | 6 | 4 | 1 | 0 | 1 | 40% | 3 | 5 | 4 |
| v-categorie | 8 | 1 (12.5%) | 0 | 7 | 0 | 1 | 2 | 27.3% | 3 | 2 | 2 |
| v-composti | 11 | 7 (63.6%) | 7 | 4 | 0 | 0 | 2 | 26.7% | 4 | 3 | 3 |
| v-correzioni | 11 | 5 (45.5%) | 5 | 6 | 0 | 0 | 2 | 31.6% | 4 | 8 | 7 |
| v-risposte | 9 | 6 (66.7%) | 6 | 3 | 0 | 0 | 3 | 50% | 0 | 1 | 1 |
| v-prezzi | 9 | 1 (11.1%) | 1 | 8 | 0 | 0 | 4 | 33.3% | 0 | 4 | 4 |
| v-verbi | 10 | 6 (60%) | 6 | 4 | 0 | 0 | 4 | 28.6% | 4 | 1 | 1 |
| v-asr | 10 | 6 (60%) | 6 | 2 | 2 | 0 | 0 | 36.4% | 3 | 4 | 2 |
| v-stato | 8 | 5 (62.5%) | 5 | 3 | 0 | 0 | 0 | 7.1% | 1 | 5 | 5 |
| v-annulla | 8 | 4 (50%) | 4 | 3 | 1 | 0 | 0 | 33.3% | 6 | 5 | 4 |
| v-misti | 7 | 2 (28.6%) | 2 | 4 | 1 | 0 | 0 | 25% | 2 | 6 | 5 |
| v-frasefissa | 6 | 4 (66.7%) | 4 | 2 | 0 | 0 | 0 | 50% | 2 | 3 | 3 |
| v-coerenza | 6 | 4 (66.7%) | 4 | 2 | 0 | 0 | 1 | 9.1% | 1 | 4 | 3 |
| v-rinomina | 6 | 0 (0%) | 0 | 6 | 0 | 0 | 0 | 0% | 0 | 1 | 1 |
| multi-turno | 70 | 28 (40%) | 28 | 40 | 2 | 0 | 16 | 29% | 28 | 42 | 36 |
| TOTALE | 143 | 61 (42.7%) | 60 | 77 | 5 | 1 | 23 | 25.4% | 37 | 70 | 59 |

Latenza harness (webhook→risposta, senza rete) p50 1.2 ms · p95 3.6 ms. Con la latenza Groq registrata: p50 1.2 ms · p95 1074.5 ms.
IA: 17 risposte (cache o vere), 246 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 50 | 0 | 0 |
| errore-generico | 49 | 0 | 0 |
| modifica-non-richiesta | 21 | 0 | 0 |
| richiesta-persa | 9 | 0 | 0 |
| modifica-sbagliata | 3 | 0 | 0 |
| correzione-non-applicata | 2 | 0 | 0 |
| scrive-invece-di-chiedere | 2 | 0 | 0 |
| frase-come-piatto | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 13 | 0 |
| frase-fissa | 0 | 5 | 0 |
| chiarimento-mancante | 0 | 2 | 0 |
| risposta-non-pertinente | 0 | 0 | 6 |

