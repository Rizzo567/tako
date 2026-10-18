# Banco E · z-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=7).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 7 | 0 (0%) | 0 | 5 | 2 | 0 | 5 | 28.6% | 2 | 7 | 0 |
| multi-turno | 0 | 0 (0%) | 0 | 0 | 0 | 0 | 0 | 0% | 0 | 0 | 0 |
| TOTALE | 7 | 0 (0%) | 0 | 5 | 2 | 0 | 5 | 28.6% | 2 | 7 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 9.7 ms · p95 41 ms. Con la latenza Groq registrata: p50 9.7 ms · p95 41 ms.
IA: 9 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-sbagliata | 3 | 0 | 0 |
| non-applicato | 3 | 0 | 0 |
| scrive-invece-di-chiedere | 2 | 0 | 0 |
| modifica-non-richiesta | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 2 | 0 |

