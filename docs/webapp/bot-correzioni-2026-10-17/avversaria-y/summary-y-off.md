# Banco E · y-off

Generato da tests/eval (groq=off, bot=nuovo, conversazioni=558).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 558 | 141 (25.3%) | 133 | 324 | 93 | 8 | 0 | 0% | 0 | 558 | 558 |
| multi-turno | 254 | 22 (8.7%) | 22 | 157 | 75 | 0 | 0 | 0% | 0 | 254 | 254 |
| TOTALE | 558 | 141 (25.3%) | 133 | 324 | 93 | 8 | 0 | 0% | 0 | 558 | 558 |

Latenza harness (webhook→risposta, senza rete) p50 1.3 ms · p95 1.9 ms. Con la latenza Groq registrata: p50 1.3 ms · p95 1.9 ms.
IA: 0 risposte (cache o vere), 1846 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 324 | 0 | 0 |
| chiarimento-mancante | 0 | 210 | 0 |
| risposta-non-pertinente | 0 | 0 | 8 |

