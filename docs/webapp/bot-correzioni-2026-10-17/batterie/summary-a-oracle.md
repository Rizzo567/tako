# Banco E · a-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=502).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 186 | 186 (100%) | 186 | 0 | 0 | 0 | 0 | 58.3% | 2 | 6 | 0 |
| a2-prezzi | 160 | 160 (100%) | 160 | 0 | 0 | 0 | 0 | 5.5% | 0 | 106 | 0 |
| a3-nomi | 156 | 156 (100%) | 156 | 0 | 0 | 0 | 0 | 37.6% | 0 | 0 | 0 |
| multi-turno | 316 | 316 (100%) | 316 | 0 | 0 | 0 | 0 | 43.7% | 2 | 90 | 0 |
| TOTALE | 502 | 502 (100%) | 502 | 0 | 0 | 0 | 0 | 36.9% | 2 | 112 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 0.7 ms · p95 1.9 ms. Con la latenza Groq registrata: p50 0.7 ms · p95 1.9 ms.
IA: 190 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|

