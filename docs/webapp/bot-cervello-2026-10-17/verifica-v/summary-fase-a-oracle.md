# Banco E · fase-a-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, tetto=20000, conversazioni=143).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| v-deixis | 13 | 13 (100%) | 13 | 0 | 0 | 0 | 0 | 0% | 0 | 13 | 0 |
| v-elimina | 10 | 3 (30%) | 3 | 6 | 1 | 0 | 5 | 21.4% | 3 | 5 | 0 |
| v-aggiunte | 11 | 11 (100%) | 11 | 0 | 0 | 0 | 0 | 26.7% | 1 | 5 | 0 |
| v-categorie | 8 | 1 (12.5%) | 0 | 3 | 4 | 1 | 1 | 63.6% | 6 | 2 | 0 |
| v-composti | 11 | 11 (100%) | 11 | 0 | 0 | 0 | 0 | 26.7% | 4 | 2 | 0 |
| v-correzioni | 11 | 9 (81.8%) | 9 | 2 | 0 | 0 | 1 | 26.3% | 3 | 8 | 0 |
| v-risposte | 9 | 9 (100%) | 9 | 0 | 0 | 0 | 0 | 50% | 0 | 1 | 0 |
| v-prezzi | 9 | 9 (100%) | 9 | 0 | 0 | 0 | 0 | 50% | 0 | 1 | 0 |
| v-verbi | 10 | 10 (100%) | 10 | 0 | 0 | 0 | 0 | 28.6% | 4 | 1 | 0 |
| v-asr | 10 | 10 (100%) | 10 | 0 | 0 | 0 | 0 | 18.2% | 0 | 4 | 0 |
| v-stato | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 0% | 0 | 5 | 0 |
| v-annulla | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 5.6% | 1 | 5 | 0 |
| v-misti | 7 | 7 (100%) | 7 | 0 | 0 | 0 | 0 | 0% | 0 | 6 | 0 |
| v-frasefissa | 6 | 4 (66.7%) | 4 | 1 | 1 | 0 | 1 | 50% | 2 | 3 | 0 |
| v-coerenza | 6 | 5 (83.3%) | 5 | 0 | 1 | 0 | 0 | 18.2% | 2 | 4 | 0 |
| v-rinomina | 6 | 0 (0%) | 0 | 6 | 0 | 0 | 0 | 0% | 0 | 1 | 0 |
| multi-turno | 70 | 59 (84.3%) | 59 | 6 | 5 | 0 | 5 | 28.4% | 23 | 42 | 0 |
| TOTALE | 143 | 118 (82.5%) | 117 | 18 | 7 | 1 | 8 | 22.4% | 26 | 66 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 1.1 ms · p95 4.2 ms. Con la latenza Groq registrata: p50 1.1 ms · p95 4.2 ms.
IA: 84 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 10 | 0 | 0 |
| modifica-non-richiesta | 7 | 0 | 0 |
| modifica-sbagliata | 5 | 0 | 0 |
| richiesta-persa | 2 | 0 | 0 |
| correzione-non-applicata | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 12 | 0 |
| risposta-non-pertinente | 0 | 0 | 1 |

