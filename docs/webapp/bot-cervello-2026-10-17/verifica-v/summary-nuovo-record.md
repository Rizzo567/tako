# Banco E · nuovo-record

Generato da tests/eval (groq=record, bot=nuovo, tetto=351447, conversazioni=11).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| v-deixis | 1 | 1 (100%) | 1 | 0 | 0 | 0 | 0 | 0% | 0 | 1 | 0 |
| v-elimina | 2 | 0 (0%) | 0 | 2 | 0 | 0 | 1 | 0% | 0 | 2 | 0 |
| v-aggiunte | 2 | 1 (50%) | 1 | 0 | 1 | 0 | 0 | 50% | 1 | 2 | 1 |
| v-composti | 1 | 1 (100%) | 1 | 0 | 0 | 0 | 0 | 0% | 0 | 1 | 1 |
| v-correzioni | 1 | 1 (100%) | 1 | 0 | 0 | 0 | 0 | 0% | 0 | 1 | 0 |
| v-asr | 2 | 0 (0%) | 0 | 1 | 1 | 0 | 0 | 50% | 1 | 2 | 0 |
| v-misti | 1 | 0 (0%) | 0 | 0 | 1 | 0 | 0 | 100% | 1 | 1 | 0 |
| v-coerenza | 1 | 1 (100%) | 1 | 0 | 0 | 0 | 0 | 0% | 0 | 1 | 0 |
| multi-turno | 4 | 3 (75%) | 3 | 1 | 0 | 0 | 1 | 0% | 0 | 4 | 0 |
| TOTALE | 11 | 5 (45.5%) | 5 | 3 | 3 | 0 | 1 | 20% | 3 | 11 | 2 |

Latenza harness (webhook→risposta, senza rete) p50 1133.2 ms · p95 2826.4 ms. Con la latenza Groq registrata: p50 2253.2 ms · p95 5620.4 ms.
IA: 11 risposte (cache o vere), 4 richieste senza risposta (Groq giù/cache assente), 32837 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 2 | 0 | 0 |
| modifica-non-richiesta | 1 | 0 | 0 |
| richiesta-persa | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 3 | 0 |
| frase-fissa | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 1 |

