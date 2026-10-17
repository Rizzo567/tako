# Banco E · R-dopo-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, tetto=20000, conversazioni=143).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| v-deixis | 13 | 11 (84.6%) | 11 | 1 | 1 | 0 | 0 | 8.8% | 3 | 13 | 0 |
| v-elimina | 10 | 2 (20%) | 2 | 0 | 8 | 0 | 0 | 78.6% | 11 | 10 | 0 |
| v-aggiunte | 11 | 11 (100%) | 11 | 0 | 0 | 0 | 0 | 26.7% | 1 | 11 | 0 |
| v-categorie | 8 | 7 (87.5%) | 6 | 1 | 0 | 1 | 1 | 9.1% | 0 | 8 | 0 |
| v-composti | 11 | 11 (100%) | 11 | 0 | 0 | 0 | 0 | 26.7% | 4 | 11 | 0 |
| v-correzioni | 11 | 11 (100%) | 11 | 0 | 0 | 0 | 0 | 15.8% | 1 | 11 | 0 |
| v-risposte | 9 | 9 (100%) | 9 | 0 | 0 | 0 | 0 | 50% | 0 | 9 | 0 |
| v-prezzi | 9 | 9 (100%) | 9 | 0 | 0 | 0 | 0 | 50% | 0 | 9 | 0 |
| v-verbi | 10 | 10 (100%) | 10 | 0 | 0 | 0 | 0 | 35.7% | 5 | 10 | 0 |
| v-asr | 10 | 10 (100%) | 10 | 0 | 0 | 0 | 0 | 18.2% | 0 | 10 | 0 |
| v-stato | 8 | 7 (87.5%) | 7 | 1 | 0 | 0 | 0 | 7.1% | 1 | 8 | 0 |
| v-annulla | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 16.7% | 3 | 8 | 0 |
| v-misti | 7 | 7 (100%) | 7 | 0 | 0 | 0 | 0 | 0% | 0 | 7 | 0 |
| v-frasefissa | 6 | 4 (66.7%) | 4 | 1 | 1 | 0 | 1 | 37.5% | 1 | 6 | 0 |
| v-coerenza | 6 | 5 (83.3%) | 5 | 0 | 1 | 0 | 0 | 27.3% | 3 | 6 | 0 |
| v-rinomina | 6 | 6 (100%) | 6 | 0 | 0 | 0 | 0 | 0% | 0 | 6 | 0 |
| multi-turno | 70 | 61 (87.1%) | 61 | 4 | 5 | 0 | 2 | 29.7% | 25 | 70 | 0 |
| TOTALE | 143 | 128 (89.5%) | 127 | 4 | 11 | 1 | 2 | 25.4% | 33 | 143 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 2.4 ms · p95 6.9 ms. Con la latenza Groq registrata: p50 2.4 ms · p95 6.9 ms.
IA: 239 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-sbagliata | 4 | 0 | 0 |
| non-applicato | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 11 | 0 |
| in-attesa-ok | 0 | 2 | 0 |
| risposta-non-pertinente | 0 | 0 | 1 |

