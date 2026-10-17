# Banco E · a-off

Generato da tests/eval (groq=off, bot=nuovo, conversazioni=809).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 186 | 0 (0%) | 0 | 170 | 16 | 0 | 0 | 0% | 0 | 186 | 186 |
| a2-prezzi | 160 | 16 (10%) | 16 | 128 | 16 | 0 | 0 | 0% | 0 | 160 | 160 |
| a3-nomi | 156 | 0 (0%) | 0 | 156 | 0 | 0 | 0 | 0% | 0 | 156 | 156 |
| a4-validatore | 156 | 4 (2.6%) | 4 | 132 | 20 | 0 | 0 | 0% | 0 | 156 | 156 |
| a5-asr | 151 | 32 (21.2%) | 32 | 119 | 0 | 0 | 0 | 0% | 0 | 151 | 151 |
| multi-turno | 363 | 0 (0%) | 0 | 347 | 16 | 0 | 0 | 0% | 0 | 363 | 363 |
| TOTALE | 809 | 52 (6.4%) | 52 | 705 | 52 | 0 | 0 | 0% | 0 | 809 | 809 |

Latenza harness (webhook→risposta, senza rete) p50 1 ms · p95 2.2 ms. Con la latenza Groq registrata: p50 1 ms · p95 2.2 ms.
IA: 0 risposte (cache o vere), 2612 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 705 | 0 | 0 |
| chiarimento-mancante | 0 | 377 | 0 |
| risposta-non-pertinente | 0 | 0 | 28 |

