# Banco E · a-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=809).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 186 | 186 (100%) | 186 | 0 | 0 | 0 | 0 | 58.3% | 2 | 6 | 0 |
| a2-prezzi | 160 | 160 (100%) | 160 | 0 | 0 | 0 | 0 | 5.5% | 0 | 106 | 0 |
| a3-nomi | 156 | 156 (100%) | 156 | 0 | 0 | 0 | 0 | 29.4% | 0 | 0 | 0 |
| a4-validatore | 156 | 156 (100%) | 156 | 0 | 0 | 0 | 0 | 17.6% | 0 | 112 | 0 |
| a5-asr | 151 | 151 (100%) | 151 | 0 | 0 | 0 | 0 | 13.2% | 6 | 87 | 0 |
| multi-turno | 363 | 363 (100%) | 363 | 0 | 0 | 0 | 0 | 39.9% | 2 | 130 | 0 |
| TOTALE | 809 | 809 (100%) | 809 | 0 | 0 | 0 | 0 | 29.5% | 8 | 311 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 0.9 ms · p95 2.6 ms. Con la latenza Groq registrata: p50 0.9 ms · p95 2.6 ms.
IA: 389 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|

