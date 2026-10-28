# Banco E · fase-a-off

Generato da tests/eval (groq=off, bot=nuovo, tetto=20000, conversazioni=143).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| v-deixis | 13 | 0 (0%) | 0 | 13 | 0 | 0 | 0 | 5.9% | 2 | 13 | 13 |
| v-elimina | 10 | 2 (20%) | 2 | 8 | 0 | 0 | 4 | 14.3% | 2 | 5 | 5 |
| v-aggiunte | 11 | 6 (54.5%) | 6 | 5 | 0 | 0 | 0 | 40% | 3 | 5 | 5 |
| v-categorie | 8 | 1 (12.5%) | 0 | 4 | 3 | 1 | 0 | 72.7% | 7 | 2 | 2 |
| v-composti | 11 | 9 (81.8%) | 9 | 2 | 0 | 0 | 0 | 26.7% | 4 | 2 | 2 |
| v-correzioni | 11 | 5 (45.5%) | 5 | 6 | 0 | 0 | 2 | 31.6% | 4 | 8 | 8 |
| v-risposte | 9 | 9 (100%) | 9 | 0 | 0 | 0 | 0 | 50% | 0 | 1 | 1 |
| v-prezzi | 9 | 8 (88.9%) | 8 | 1 | 0 | 0 | 0 | 50% | 0 | 1 | 1 |
| v-verbi | 10 | 10 (100%) | 10 | 0 | 0 | 0 | 0 | 28.6% | 4 | 1 | 1 |
| v-asr | 10 | 7 (70%) | 7 | 3 | 0 | 0 | 0 | 45.5% | 3 | 4 | 4 |
| v-stato | 8 | 5 (62.5%) | 5 | 3 | 0 | 0 | 0 | 7.1% | 1 | 5 | 5 |
| v-annulla | 8 | 4 (50%) | 4 | 4 | 0 | 0 | 0 | 33.3% | 6 | 5 | 5 |
| v-misti | 7 | 2 (28.6%) | 2 | 5 | 0 | 0 | 0 | 12.5% | 1 | 6 | 6 |
| v-frasefissa | 6 | 3 (50%) | 3 | 3 | 0 | 0 | 0 | 50% | 2 | 3 | 3 |
| v-coerenza | 6 | 4 (66.7%) | 4 | 2 | 0 | 0 | 0 | 18.2% | 2 | 4 | 4 |
| v-rinomina | 6 | 0 (0%) | 0 | 6 | 0 | 0 | 0 | 0% | 0 | 1 | 1 |
| multi-turno | 70 | 37 (52.9%) | 37 | 32 | 1 | 0 | 3 | 32.9% | 30 | 42 | 42 |
| TOTALE | 143 | 75 (52.4%) | 74 | 65 | 3 | 1 | 6 | 28.9% | 41 | 66 | 66 |

Latenza harness (webhook→risposta, senza rete) p50 1.2 ms · p95 3.2 ms. Con la latenza Groq registrata: p50 1.2 ms · p95 3.2 ms.
IA: 0 risposte (cache o vere), 286 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| errore-generico | 59 | 0 | 0 |
| non-applicato | 36 | 0 | 0 |
| richiesta-persa | 7 | 0 | 0 |
| modifica-non-richiesta | 5 | 0 | 0 |
| correzione-non-applicata | 2 | 0 | 0 |
| modifica-sbagliata | 2 | 0 | 0 |
| frase-come-piatto | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 17 | 0 |
| risposta-non-pertinente | 0 | 0 | 6 |

