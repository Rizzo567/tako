# Banco E · b-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=452).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 150 | 138 (92%) | 138 | 8 | 4 | 0 | 0 | 48.1% | 26 | 25 | 0 |
| b2-categorie | 150 | 150 (100%) | 150 | 0 | 0 | 0 | 0 | 16.5% | 0 | 2 | 0 |
| b3-sposta-rinomina | 152 | 132 (86.8%) | 132 | 0 | 20 | 0 | 0 | 19.4% | 28 | 20 | 0 |
| multi-turno | 226 | 194 (85.8%) | 194 | 8 | 24 | 0 | 0 | 44.1% | 46 | 39 | 0 |
| TOTALE | 452 | 420 (92.9%) | 420 | 8 | 24 | 0 | 0 | 31.4% | 54 | 47 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 2.9 ms · p95 7.9 ms. Con la latenza Groq registrata: p50 2.9 ms · p95 7.9 ms.
IA: 55 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| correzione-non-applicata | 8 | 0 | 0 |
| chiede-invece-di-agire | 0 | 32 | 0 |

