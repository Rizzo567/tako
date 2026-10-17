# Banco E · a3-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, tetto=20000, conversazioni=143).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| v-deixis | 13 | 13 (100%) | 13 | 0 | 0 | 0 | 0 | 0% | 0 | 13 | 0 |
| v-elimina | 10 | 2 (20%) | 2 | 7 | 1 | 0 | 5 | 21.4% | 3 | 5 | 0 |
| v-aggiunte | 11 | 11 (100%) | 11 | 0 | 0 | 0 | 0 | 26.7% | 1 | 5 | 0 |
| v-categorie | 8 | 1 (12.5%) | 0 | 2 | 5 | 1 | 0 | 72.7% | 7 | 2 | 0 |
| v-composti | 11 | 11 (100%) | 11 | 0 | 0 | 0 | 0 | 26.7% | 4 | 2 | 0 |
| v-correzioni | 11 | 9 (81.8%) | 9 | 2 | 0 | 0 | 1 | 26.3% | 3 | 8 | 0 |
| v-risposte | 9 | 9 (100%) | 9 | 0 | 0 | 0 | 0 | 50% | 0 | 1 | 0 |
| v-prezzi | 9 | 9 (100%) | 9 | 0 | 0 | 0 | 0 | 50% | 0 | 1 | 0 |
| v-verbi | 10 | 10 (100%) | 10 | 0 | 0 | 0 | 0 | 28.6% | 4 | 1 | 0 |
| v-asr | 10 | 7 (70%) | 7 | 1 | 2 | 0 | 0 | 27.3% | 2 | 4 | 0 |
| v-stato | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 0% | 0 | 5 | 0 |
| v-annulla | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 5.6% | 1 | 5 | 0 |
| v-misti | 7 | 3 (42.9%) | 3 | 3 | 1 | 0 | 0 | 12.5% | 1 | 6 | 0 |
| v-frasefissa | 6 | 4 (66.7%) | 4 | 0 | 2 | 0 | 0 | 62.5% | 3 | 3 | 0 |
| v-coerenza | 6 | 4 (66.7%) | 4 | 1 | 1 | 0 | 1 | 18.2% | 2 | 4 | 0 |
| v-rinomina | 6 | 0 (0%) | 0 | 6 | 0 | 0 | 0 | 0% | 0 | 1 | 0 |
| multi-turno | 70 | 57 (81.4%) | 57 | 5 | 8 | 0 | 4 | 29.7% | 26 | 42 | 0 |
| TOTALE | 143 | 109 (76.2%) | 108 | 22 | 12 | 1 | 7 | 24.1% | 31 | 66 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 1.1 ms · p95 3.9 ms. Con la latenza Groq registrata: p50 1.1 ms · p95 3.9 ms.
IA: 84 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 13 | 0 | 0 |
| modifica-non-richiesta | 8 | 0 | 0 |
| richiesta-persa | 4 | 0 | 0 |
| modifica-sbagliata | 1 | 0 | 0 |
| correzione-non-applicata | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 15 | 0 |
| frase-fissa | 0 | 2 | 0 |
| chiarimento-mancante | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 2 |

