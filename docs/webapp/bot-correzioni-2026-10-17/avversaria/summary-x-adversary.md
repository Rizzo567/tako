# Banco E · x-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=508).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 508 | 238 (46.9%) | 238 | 6 | 264 | 0 | 0 | 90.1% | 580 | 508 | 0 |
| multi-turno | 151 | 60 (39.7%) | 60 | 6 | 85 | 0 | 0 | 91.2% | 275 | 151 | 0 |
| TOTALE | 508 | 238 (46.9%) | 238 | 6 | 264 | 0 | 0 | 90.1% | 580 | 508 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 4.6 ms · p95 8.4 ms. Con la latenza Groq registrata: p50 4.6 ms · p95 8.4 ms.
IA: 1234 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| correzione-non-applicata | 4 | 0 | 0 |
| non-applicato | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 265 | 0 |
| risposta-non-pertinente | 0 | 0 | 7 |

