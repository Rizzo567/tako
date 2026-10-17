# Banco E · b-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=452).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 150 | 150 (100%) | 150 | 0 | 0 | 0 | 0 | 45.3% | 17 | 25 | 0 |
| b2-categorie | 150 | 150 (100%) | 150 | 0 | 0 | 0 | 0 | 16.5% | 0 | 2 | 0 |
| b3-sposta-rinomina | 152 | 152 (100%) | 152 | 0 | 0 | 0 | 0 | 9.7% | 8 | 26 | 0 |
| multi-turno | 226 | 226 (100%) | 226 | 0 | 0 | 0 | 0 | 38.3% | 17 | 40 | 0 |
| TOTALE | 452 | 452 (100%) | 452 | 0 | 0 | 0 | 0 | 27.4% | 25 | 53 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 0.8 ms · p95 2.7 ms. Con la latenza Groq registrata: p50 0.8 ms · p95 2.7 ms.
IA: 61 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|

