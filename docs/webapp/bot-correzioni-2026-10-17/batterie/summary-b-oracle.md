# Banco E · b-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=452).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 150 | 150 (100%) | 150 | 0 | 0 | 0 | 0 | 46.3% | 20 | 150 | 0 |
| b2-categorie | 150 | 150 (100%) | 150 | 0 | 0 | 0 | 0 | 17.5% | 2 | 150 | 0 |
| b3-sposta-rinomina | 152 | 152 (100%) | 145 | 0 | 0 | 7 | 0 | 9.7% | 8 | 152 | 0 |
| multi-turno | 226 | 226 (100%) | 219 | 0 | 0 | 7 | 0 | 37.7% | 14 | 226 | 0 |
| TOTALE | 452 | 452 (100%) | 445 | 0 | 0 | 7 | 0 | 28.1% | 30 | 452 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 2 ms · p95 5.4 ms. Con la latenza Groq registrata: p50 2 ms · p95 5.4 ms.
IA: 729 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| risposta-non-pertinente | 0 | 0 | 7 |

