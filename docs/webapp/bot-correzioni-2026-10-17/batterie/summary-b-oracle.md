# Banco E · b-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=452).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 150 | 134 (89.3%) | 134 | 16 | 0 | 0 | 16 | 46.3% | 20 | 150 | 0 |
| b2-categorie | 150 | 134 (89.3%) | 134 | 16 | 0 | 0 | 0 | 17.5% | 2 | 150 | 0 |
| b3-sposta-rinomina | 152 | 152 (100%) | 145 | 0 | 0 | 7 | 0 | 9.7% | 8 | 152 | 0 |
| multi-turno | 226 | 226 (100%) | 219 | 0 | 0 | 7 | 0 | 37.7% | 14 | 226 | 0 |
| TOTALE | 452 | 420 (92.9%) | 413 | 32 | 0 | 7 | 16 | 28.1% | 30 | 452 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 12.5 ms · p95 30.4 ms. Con la latenza Groq registrata: p50 12.5 ms · p95 30.4 ms.
IA: 729 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 32 | 0 | 0 |
| modifica-non-richiesta | 16 | 0 | 0 |
| eliminato-senza-conferma | 16 | 0 | 0 |
| risposta-non-pertinente | 0 | 0 | 7 |

