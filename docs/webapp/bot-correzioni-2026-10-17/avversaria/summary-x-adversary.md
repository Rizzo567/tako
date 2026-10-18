# Banco E · x-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=508).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 508 | 239 (47%) | 239 | 6 | 263 | 0 | 0 | 89.9% | 578 | 508 | 0 |
| multi-turno | 151 | 61 (40.4%) | 61 | 6 | 84 | 0 | 0 | 90.9% | 274 | 151 | 0 |
| TOTALE | 508 | 239 (47%) | 239 | 6 | 263 | 0 | 0 | 89.9% | 578 | 508 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 17.4 ms · p95 30.9 ms. Con la latenza Groq registrata: p50 17.4 ms · p95 30.9 ms.
IA: 1234 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| correzione-non-applicata | 4 | 0 | 0 |
| non-applicato | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 264 | 0 |
| risposta-non-pertinente | 0 | 0 | 7 |

