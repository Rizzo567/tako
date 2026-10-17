# Banco E · b-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=452).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 150 | 138 (92%) | 138 | 8 | 4 | 0 | 0 | 49.1% | 29 | 25 | 0 |
| b2-categorie | 150 | 150 (100%) | 150 | 0 | 0 | 0 | 0 | 16.5% | 0 | 2 | 0 |
| b3-sposta-rinomina | 152 | 130 (85.5%) | 130 | 0 | 22 | 0 | 0 | 21.4% | 32 | 26 | 0 |
| multi-turno | 226 | 194 (85.8%) | 194 | 8 | 24 | 0 | 0 | 45.1% | 51 | 40 | 0 |
| TOTALE | 452 | 418 (92.5%) | 418 | 8 | 26 | 0 | 0 | 32.4% | 61 | 53 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 0.7 ms · p95 1.9 ms. Con la latenza Groq registrata: p50 0.7 ms · p95 1.9 ms.
IA: 61 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| correzione-non-applicata | 8 | 0 | 0 |
| chiede-invece-di-agire | 0 | 34 | 0 |

