# Banco E · b-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=452).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 150 | 42 (28%) | 42 | 0 | 108 | 0 | 0 | 91.9% | 166 | 150 | 0 |
| b2-categorie | 150 | 42 (28%) | 38 | 12 | 96 | 4 | 0 | 71.6% | 107 | 150 | 0 |
| b3-sposta-rinomina | 152 | 52 (34.2%) | 50 | 6 | 94 | 2 | 0 | 73.8% | 140 | 152 | 0 |
| multi-turno | 226 | 55 (24.3%) | 53 | 6 | 165 | 2 | 0 | 87% | 258 | 226 | 0 |
| TOTALE | 452 | 136 (30.1%) | 130 | 18 | 298 | 6 | 0 | 81.3% | 413 | 452 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 12.1 ms · p95 32.6 ms. Con la latenza Groq registrata: p50 12.1 ms · p95 32.6 ms.
IA: 1200 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 18 | 0 | 0 |
| chiede-invece-di-agire | 0 | 298 | 0 |
| risposta-non-pertinente | 0 | 0 | 12 |

