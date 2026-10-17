# Banco E · nuovo-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, tetto=20000, conversazioni=143).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| v-deixis | 13 | 13 (100%) | 13 | 0 | 0 | 0 | 0 | 0% | 0 | 13 | 0 |
| v-elimina | 10 | 2 (20%) | 2 | 2 | 6 | 0 | 2 | 57.1% | 8 | 3 | 0 |
| v-aggiunte | 11 | 11 (100%) | 11 | 0 | 0 | 0 | 0 | 26.7% | 1 | 5 | 0 |
| v-categorie | 8 | 7 (87.5%) | 6 | 1 | 0 | 1 | 1 | 9.1% | 0 | 1 | 0 |
| v-composti | 11 | 11 (100%) | 11 | 0 | 0 | 0 | 0 | 26.7% | 4 | 2 | 0 |
| v-correzioni | 11 | 11 (100%) | 11 | 0 | 0 | 0 | 0 | 15.8% | 1 | 8 | 0 |
| v-risposte | 9 | 9 (100%) | 9 | 0 | 0 | 0 | 0 | 50% | 0 | 1 | 0 |
| v-prezzi | 9 | 9 (100%) | 9 | 0 | 0 | 0 | 0 | 50% | 0 | 1 | 0 |
| v-verbi | 10 | 10 (100%) | 10 | 0 | 0 | 0 | 0 | 28.6% | 4 | 1 | 0 |
| v-asr | 10 | 10 (100%) | 10 | 0 | 0 | 0 | 0 | 18.2% | 0 | 4 | 0 |
| v-stato | 8 | 7 (87.5%) | 7 | 1 | 0 | 0 | 0 | 7.1% | 1 | 3 | 0 |
| v-annulla | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 5.6% | 1 | 5 | 0 |
| v-misti | 7 | 7 (100%) | 7 | 0 | 0 | 0 | 0 | 0% | 0 | 6 | 0 |
| v-frasefissa | 6 | 4 (66.7%) | 4 | 1 | 1 | 0 | 1 | 37.5% | 1 | 3 | 0 |
| v-coerenza | 6 | 6 (100%) | 6 | 0 | 0 | 0 | 0 | 18.2% | 2 | 3 | 0 |
| v-rinomina | 6 | 6 (100%) | 6 | 0 | 0 | 0 | 0 | 0% | 0 | 0 | 0 |
| multi-turno | 70 | 63 (90%) | 63 | 5 | 2 | 0 | 4 | 24.5% | 17 | 39 | 0 |
| TOTALE | 143 | 131 (91.6%) | 130 | 5 | 7 | 1 | 4 | 21.1% | 23 | 59 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 1.1 ms · p95 4.1 ms. Con la latenza Groq registrata: p50 1.1 ms · p95 4.1 ms.
IA: 76 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-sbagliata | 4 | 0 | 0 |
| modifica-non-richiesta | 3 | 0 | 0 |
| non-applicato | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 9 | 0 |
| in-attesa-ok | 0 | 2 | 0 |
| risposta-non-pertinente | 0 | 0 | 1 |

