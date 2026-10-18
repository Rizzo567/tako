# Banco E · nuovo-off

Generato da tests/eval (groq=off, bot=nuovo, tetto=20000, conversazioni=143).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| v-deixis | 13 | 1 (7.7%) | 1 | 12 | 0 | 0 | 0 | 0% | 0 | 13 | 13 |
| v-elimina | 10 | 0 (0%) | 0 | 10 | 0 | 0 | 0 | 0% | 0 | 10 | 10 |
| v-aggiunte | 11 | 1 (9.1%) | 1 | 9 | 1 | 0 | 0 | 0% | 0 | 11 | 11 |
| v-categorie | 8 | 1 (12.5%) | 0 | 7 | 0 | 1 | 0 | 0% | 0 | 8 | 8 |
| v-composti | 11 | 0 (0%) | 0 | 11 | 0 | 0 | 0 | 0% | 0 | 11 | 11 |
| v-correzioni | 11 | 1 (9.1%) | 1 | 9 | 1 | 0 | 0 | 0% | 0 | 11 | 11 |
| v-risposte | 9 | 0 (0%) | 0 | 9 | 0 | 0 | 0 | 0% | 0 | 9 | 9 |
| v-prezzi | 9 | 1 (11.1%) | 1 | 5 | 3 | 0 | 0 | 0% | 0 | 9 | 9 |
| v-verbi | 10 | 1 (10%) | 1 | 9 | 0 | 0 | 0 | 0% | 0 | 10 | 10 |
| v-asr | 10 | 0 (0%) | 0 | 9 | 1 | 0 | 0 | 0% | 0 | 10 | 10 |
| v-stato | 8 | 3 (37.5%) | 1 | 5 | 0 | 2 | 0 | 0% | 0 | 8 | 8 |
| v-annulla | 8 | 5 (62.5%) | 5 | 3 | 0 | 0 | 0 | 0% | 0 | 8 | 8 |
| v-misti | 7 | 0 (0%) | 0 | 7 | 0 | 0 | 0 | 0% | 0 | 7 | 7 |
| v-frasefissa | 6 | 0 (0%) | 0 | 4 | 2 | 0 | 0 | 0% | 0 | 6 | 6 |
| v-coerenza | 6 | 1 (16.7%) | 1 | 5 | 0 | 0 | 0 | 0% | 0 | 6 | 6 |
| v-rinomina | 6 | 0 (0%) | 0 | 6 | 0 | 0 | 0 | 0% | 0 | 6 | 6 |
| multi-turno | 70 | 9 (12.9%) | 8 | 58 | 3 | 1 | 0 | 0% | 0 | 70 | 70 |
| TOTALE | 143 | 15 (10.5%) | 12 | 120 | 8 | 3 | 0 | 0% | 0 | 143 | 143 |

Latenza harness (webhook→risposta, senza rete) p50 1 ms · p95 2.1 ms. Con la latenza Groq registrata: p50 1 ms · p95 2.1 ms.
IA: 0 risposte (cache o vere), 456 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 120 | 0 | 0 |
| chiarimento-mancante | 0 | 26 | 0 |
| risposta-non-pertinente | 0 | 0 | 11 |

