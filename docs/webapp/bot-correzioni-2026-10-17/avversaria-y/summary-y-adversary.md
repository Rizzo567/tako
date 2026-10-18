# Banco E · y-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=558).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 558 | 256 (45.9%) | 251 | 8 | 294 | 5 | 0 | 91.8% | 638 | 558 | 0 |
| multi-turno | 254 | 102 (40.2%) | 102 | 8 | 144 | 0 | 0 | 92.6% | 385 | 254 | 0 |
| TOTALE | 558 | 256 (45.9%) | 251 | 8 | 294 | 5 | 0 | 91.8% | 638 | 558 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 3 ms · p95 5.1 ms. Con la latenza Groq registrata: p50 3 ms · p95 5.1 ms.
IA: 1571 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 5 | 0 | 0 |
| correzione-non-applicata | 3 | 0 | 0 |
| chiede-invece-di-agire | 0 | 294 | 0 |
| risposta-non-pertinente | 0 | 0 | 5 |

