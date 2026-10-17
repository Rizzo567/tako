# Banco E · nuovo-off

Generato da tests/eval (groq=off, bot=nuovo, tetto=20000, conversazioni=143).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| v-deixis | 13 | 0 (0%) | 0 | 13 | 0 | 0 | 0 | 5.9% | 2 | 13 | 13 |
| v-elimina | 10 | 2 (20%) | 2 | 8 | 0 | 0 | 4 | 14.3% | 2 | 5 | 5 |
| v-aggiunte | 11 | 5 (45.5%) | 5 | 6 | 0 | 0 | 1 | 40% | 3 | 5 | 5 |
| v-categorie | 8 | 1 (12.5%) | 0 | 7 | 0 | 1 | 2 | 27.3% | 3 | 2 | 2 |
| v-composti | 11 | 6 (54.5%) | 6 | 5 | 0 | 0 | 2 | 26.7% | 4 | 3 | 3 |
| v-correzioni | 11 | 5 (45.5%) | 5 | 6 | 0 | 0 | 2 | 31.6% | 4 | 8 | 8 |
| v-risposte | 9 | 6 (66.7%) | 6 | 3 | 0 | 0 | 3 | 50% | 0 | 1 | 1 |
| v-prezzi | 9 | 1 (11.1%) | 1 | 8 | 0 | 0 | 4 | 33.3% | 0 | 4 | 4 |
| v-verbi | 10 | 6 (60%) | 6 | 4 | 0 | 0 | 4 | 28.6% | 4 | 1 | 1 |
| v-asr | 10 | 6 (60%) | 6 | 3 | 1 | 0 | 0 | 45.5% | 4 | 4 | 4 |
| v-stato | 8 | 5 (62.5%) | 5 | 3 | 0 | 0 | 0 | 7.1% | 1 | 5 | 5 |
| v-annulla | 8 | 4 (50%) | 4 | 4 | 0 | 0 | 0 | 33.3% | 6 | 5 | 5 |
| v-misti | 7 | 2 (28.6%) | 2 | 5 | 0 | 0 | 0 | 12.5% | 1 | 6 | 6 |
| v-frasefissa | 6 | 3 (50%) | 3 | 3 | 0 | 0 | 0 | 50% | 2 | 3 | 3 |
| v-coerenza | 6 | 4 (66.7%) | 4 | 2 | 0 | 0 | 1 | 9.1% | 1 | 4 | 4 |
| v-rinomina | 6 | 0 (0%) | 0 | 6 | 0 | 0 | 0 | 0% | 0 | 1 | 1 |
| multi-turno | 70 | 26 (37.1%) | 26 | 43 | 1 | 0 | 16 | 29% | 28 | 42 | 42 |
| TOTALE | 143 | 56 (39.2%) | 55 | 86 | 1 | 1 | 23 | 25.4% | 37 | 70 | 70 |

Latenza harness (webhook→risposta, senza rete) p50 1.2 ms · p95 3.4 ms. Con la latenza Groq registrata: p50 1.2 ms · p95 3.4 ms.
IA: 0 risposte (cache o vere), 302 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| errore-generico | 63 | 0 | 0 |
| non-applicato | 55 | 0 | 0 |
| modifica-non-richiesta | 21 | 0 | 0 |
| richiesta-persa | 9 | 0 | 0 |
| modifica-sbagliata | 3 | 0 | 0 |
| correzione-non-applicata | 2 | 0 | 0 |
| scrive-invece-di-chiedere | 2 | 0 | 0 |
| frase-come-piatto | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 13 | 0 |
| chiarimento-mancante | 0 | 2 | 0 |
| risposta-non-pertinente | 0 | 0 | 6 |

