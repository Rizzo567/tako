# Banco E · b-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=452).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 150 | 150 (100%) | 150 | 0 | 0 | 0 | 0 | 44.4% | 14 | 25 | 0 |
| b2-categorie | 150 | 150 (100%) | 150 | 0 | 0 | 0 | 0 | 16.5% | 0 | 2 | 0 |
| b3-sposta-rinomina | 152 | 152 (100%) | 152 | 0 | 0 | 0 | 0 | 9.7% | 8 | 20 | 0 |
| multi-turno | 226 | 226 (100%) | 226 | 0 | 0 | 0 | 0 | 37.7% | 14 | 39 | 0 |
| TOTALE | 452 | 452 (100%) | 452 | 0 | 0 | 0 | 0 | 26.9% | 22 | 47 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 3.5 ms · p95 10.4 ms. Con la latenza Groq registrata: p50 3.5 ms · p95 10.4 ms.
IA: 55 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|

