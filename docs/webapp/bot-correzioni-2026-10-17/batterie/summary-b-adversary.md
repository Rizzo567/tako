# Banco E · b-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=452).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 150 | 42 (28%) | 42 | 0 | 108 | 0 | 0 | 92.8% | 169 | 150 | 0 |
| b2-categorie | 150 | 54 (36%) | 50 | 0 | 96 | 4 | 0 | 71.6% | 107 | 150 | 0 |
| b3-sposta-rinomina | 152 | 51 (33.6%) | 49 | 6 | 95 | 2 | 0 | 80.1% | 153 | 152 | 0 |
| multi-turno | 226 | 54 (23.9%) | 52 | 6 | 166 | 2 | 0 | 90.3% | 274 | 226 | 0 |
| TOTALE | 452 | 147 (32.5%) | 141 | 6 | 299 | 6 | 0 | 83.5% | 429 | 452 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 2 ms · p95 5.9 ms. Con la latenza Groq registrata: p50 2 ms · p95 5.9 ms.
IA: 1212 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 6 | 0 | 0 |
| chiede-invece-di-agire | 0 | 299 | 0 |
| risposta-non-pertinente | 0 | 0 | 11 |

