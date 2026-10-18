# Banco E · a-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=809).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 186 | 186 (100%) | 186 | 0 | 0 | 0 | 0 | 57.8% | 0 | 186 | 0 |
| a2-prezzi | 160 | 160 (100%) | 160 | 0 | 0 | 0 | 0 | 5.5% | 0 | 160 | 0 |
| a3-nomi | 156 | 156 (100%) | 156 | 0 | 0 | 0 | 0 | 29.4% | 0 | 156 | 0 |
| a4-validatore | 156 | 156 (100%) | 156 | 0 | 0 | 0 | 0 | 23.5% | 0 | 156 | 0 |
| a5-asr | 151 | 151 (100%) | 151 | 0 | 0 | 0 | 0 | 28.7% | 32 | 151 | 0 |
| multi-turno | 363 | 363 (100%) | 363 | 0 | 0 | 0 | 0 | 39.7% | 0 | 363 | 0 |
| TOTALE | 809 | 809 (100%) | 809 | 0 | 0 | 0 | 0 | 32.2% | 32 | 809 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 2 ms · p95 6.4 ms. Con la latenza Groq registrata: p50 2 ms · p95 6.4 ms.
IA: 1360 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|

