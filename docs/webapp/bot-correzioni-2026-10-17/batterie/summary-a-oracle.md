# Banco E · a-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=658).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 186 | 186 (100%) | 186 | 0 | 0 | 0 | 0 | 58.3% | 2 | 6 | 0 |
| a2-prezzi | 160 | 160 (100%) | 160 | 0 | 0 | 0 | 0 | 5.5% | 0 | 106 | 0 |
| a3-nomi | 156 | 156 (100%) | 156 | 0 | 0 | 0 | 0 | 37.6% | 0 | 0 | 0 |
| a4-validatore | 156 | 156 (100%) | 156 | 0 | 0 | 0 | 0 | 17.6% | 0 | 112 | 0 |
| multi-turno | 352 | 352 (100%) | 352 | 0 | 0 | 0 | 0 | 41.3% | 2 | 114 | 0 |
| TOTALE | 658 | 658 (100%) | 658 | 0 | 0 | 0 | 0 | 33.6% | 2 | 224 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 0.7 ms · p95 2 ms. Con la latenza Groq registrata: p50 0.7 ms · p95 2 ms.
IA: 302 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|

