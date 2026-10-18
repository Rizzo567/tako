# Banco E · b-off

Generato da tests/eval (groq=off, bot=nuovo, conversazioni=452).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 150 | 6 (4%) | 6 | 120 | 24 | 0 | 0 | 0% | 0 | 150 | 150 |
| b2-categorie | 150 | 18 (12%) | 6 | 132 | 0 | 12 | 0 | 0% | 0 | 150 | 150 |
| b3-sposta-rinomina | 152 | 22 (14.5%) | 22 | 130 | 0 | 0 | 0 | 0% | 0 | 152 | 152 |
| multi-turno | 226 | 14 (6.2%) | 14 | 188 | 24 | 0 | 0 | 0% | 0 | 226 | 226 |
| TOTALE | 452 | 46 (10.2%) | 34 | 382 | 24 | 12 | 0 | 0% | 0 | 452 | 452 |

Latenza harness (webhook→risposta, senza rete) p50 1.5 ms · p95 3.6 ms. Con la latenza Groq registrata: p50 1.5 ms · p95 3.6 ms.
IA: 0 risposte (cache o vere), 1440 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 382 | 0 | 0 |
| chiarimento-mancante | 0 | 172 | 0 |
| risposta-non-pertinente | 0 | 0 | 20 |

