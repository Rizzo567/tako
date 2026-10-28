# Banco E · base-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, tetto=20000, conversazioni=143).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| v-deixis | 13 | 1 (7.7%) | 1 | 8 | 4 | 0 | 6 | 14.7% | 5 | 13 | 0 |
| v-elimina | 10 | 2 (20%) | 2 | 7 | 1 | 0 | 4 | 14.3% | 2 | 5 | 0 |
| v-aggiunte | 11 | 5 (45.5%) | 5 | 3 | 3 | 0 | 2 | 53.3% | 5 | 5 | 0 |
| v-categorie | 8 | 1 (12.5%) | 0 | 6 | 1 | 1 | 2 | 27.3% | 3 | 2 | 0 |
| v-composti | 11 | 7 (63.6%) | 7 | 2 | 2 | 0 | 2 | 40% | 6 | 3 | 0 |
| v-correzioni | 11 | 9 (81.8%) | 9 | 1 | 1 | 0 | 1 | 21.1% | 2 | 8 | 0 |
| v-risposte | 9 | 6 (66.7%) | 6 | 3 | 0 | 0 | 3 | 50% | 0 | 1 | 0 |
| v-prezzi | 9 | 4 (44.4%) | 4 | 4 | 1 | 0 | 4 | 41.7% | 1 | 4 | 0 |
| v-verbi | 10 | 6 (60%) | 6 | 4 | 0 | 0 | 4 | 28.6% | 4 | 1 | 0 |
| v-asr | 10 | 7 (70%) | 7 | 1 | 2 | 0 | 0 | 27.3% | 2 | 4 | 0 |
| v-stato | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 0% | 0 | 5 | 0 |
| v-annulla | 8 | 7 (87.5%) | 7 | 1 | 0 | 0 | 0 | 16.7% | 3 | 5 | 0 |
| v-misti | 7 | 3 (42.9%) | 3 | 3 | 1 | 0 | 0 | 12.5% | 1 | 6 | 0 |
| v-frasefissa | 6 | 3 (50%) | 3 | 0 | 3 | 0 | 0 | 75% | 4 | 3 | 0 |
| v-coerenza | 6 | 4 (66.7%) | 4 | 2 | 0 | 0 | 2 | 9.1% | 1 | 4 | 0 |
| v-rinomina | 6 | 0 (0%) | 0 | 6 | 0 | 0 | 0 | 0% | 0 | 1 | 0 |
| multi-turno | 70 | 33 (47.1%) | 33 | 27 | 10 | 0 | 23 | 29.7% | 29 | 42 | 0 |
| TOTALE | 143 | 73 (51%) | 72 | 51 | 19 | 1 | 30 | 26.3% | 39 | 70 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 1.1 ms · p95 3.5 ms. Con la latenza Groq registrata: p50 1.1 ms · p95 3.5 ms.
IA: 88 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 37 | 0 | 0 |
| modifica-non-richiesta | 24 | 0 | 0 |
| modifica-sbagliata | 7 | 0 | 0 |
| richiesta-persa | 7 | 0 | 0 |
| correzione-non-applicata | 4 | 0 | 0 |
| scrive-invece-di-chiedere | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 21 | 0 |
| frase-fissa | 0 | 2 | 0 |
| chiarimento-mancante | 0 | 2 | 0 |
| risposta-non-pertinente | 0 | 0 | 2 |

