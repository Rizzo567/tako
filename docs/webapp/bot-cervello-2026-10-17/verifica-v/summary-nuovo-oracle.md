# Banco E · nuovo-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, tetto=20000, conversazioni=143).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| v-deixis | 13 | 12 (92.3%) | 12 | 0 | 1 | 0 | 0 | 5.9% | 2 | 13 | 0 |
| v-elimina | 10 | 2 (20%) | 2 | 0 | 8 | 0 | 0 | 78.6% | 11 | 10 | 0 |
| v-aggiunte | 11 | 11 (100%) | 11 | 0 | 0 | 0 | 0 | 33.3% | 1 | 11 | 0 |
| v-categorie | 8 | 7 (87.5%) | 6 | 0 | 1 | 1 | 0 | 27.3% | 2 | 8 | 0 |
| v-composti | 11 | 11 (100%) | 11 | 0 | 0 | 0 | 0 | 26.7% | 4 | 11 | 0 |
| v-correzioni | 11 | 10 (90.9%) | 10 | 0 | 1 | 0 | 0 | 26.3% | 3 | 11 | 0 |
| v-risposte | 9 | 9 (100%) | 9 | 0 | 0 | 0 | 0 | 50% | 0 | 9 | 0 |
| v-prezzi | 9 | 9 (100%) | 9 | 0 | 0 | 0 | 0 | 50% | 0 | 9 | 0 |
| v-verbi | 10 | 10 (100%) | 10 | 0 | 0 | 0 | 0 | 35.7% | 5 | 10 | 0 |
| v-asr | 10 | 10 (100%) | 10 | 0 | 0 | 0 | 0 | 18.2% | 0 | 10 | 0 |
| v-stato | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 7.1% | 1 | 8 | 0 |
| v-annulla | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 22.2% | 4 | 8 | 0 |
| v-misti | 7 | 7 (100%) | 7 | 0 | 0 | 0 | 0 | 0% | 0 | 7 | 0 |
| v-frasefissa | 6 | 4 (66.7%) | 4 | 0 | 2 | 0 | 0 | 62.5% | 3 | 6 | 0 |
| v-coerenza | 6 | 5 (83.3%) | 5 | 0 | 1 | 0 | 0 | 27.3% | 3 | 6 | 0 |
| v-rinomina | 6 | 6 (100%) | 6 | 0 | 0 | 0 | 0 | 0% | 0 | 6 | 0 |
| multi-turno | 70 | 62 (88.6%) | 62 | 0 | 8 | 0 | 0 | 33.5% | 31 | 70 | 0 |
| TOTALE | 143 | 129 (90.2%) | 128 | 0 | 14 | 1 | 0 | 28.5% | 39 | 143 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 2.2 ms · p95 6.7 ms. Con la latenza Groq registrata: p50 2.2 ms · p95 6.7 ms.
IA: 242 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 14 | 0 |
| risposta-non-pertinente | 0 | 0 | 1 |

