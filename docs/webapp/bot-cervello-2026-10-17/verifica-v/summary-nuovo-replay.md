# Banco E · nuovo-replay

Generato da tests/eval (groq=replay, bot=nuovo, tetto=20000, conversazioni=10).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| v-deixis | 2 | 2 (100%) | 2 | 0 | 0 | 0 | 0 | 0% | 0 | 2 | 0 |
| v-elimina | 2 | 0 (0%) | 0 | 2 | 0 | 0 | 1 | 0% | 0 | 2 | 0 |
| v-aggiunte | 1 | 0 (0%) | 0 | 0 | 1 | 0 | 0 | 100% | 1 | 1 | 0 |
| v-correzioni | 1 | 1 (100%) | 1 | 0 | 0 | 0 | 0 | 0% | 0 | 1 | 0 |
| v-asr | 2 | 0 (0%) | 0 | 1 | 1 | 0 | 0 | 50% | 1 | 2 | 0 |
| v-misti | 1 | 0 (0%) | 0 | 0 | 1 | 0 | 0 | 100% | 1 | 1 | 0 |
| v-coerenza | 1 | 1 (100%) | 1 | 0 | 0 | 0 | 0 | 0% | 0 | 1 | 0 |
| multi-turno | 5 | 4 (80%) | 4 | 1 | 0 | 0 | 1 | 0% | 0 | 5 | 0 |
| TOTALE | 10 | 4 (40%) | 4 | 3 | 3 | 0 | 1 | 20% | 3 | 10 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 3.3 ms · p95 20.9 ms. Con la latenza Groq registrata: p50 1076.4 ms · p95 1462.5 ms.
IA: 10 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 2 | 0 | 0 |
| modifica-non-richiesta | 1 | 0 | 0 |
| richiesta-persa | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 3 | 0 |
| frase-fissa | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 1 |

