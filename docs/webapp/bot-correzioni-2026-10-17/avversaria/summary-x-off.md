# Banco E · x-off

Generato da tests/eval (groq=off, bot=nuovo, conversazioni=508).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 508 | 192 (37.8%) | 192 | 290 | 26 | 0 | 0 | 0% | 0 | 508 | 508 |
| multi-turno | 151 | 41 (27.2%) | 41 | 97 | 13 | 0 | 0 | 0% | 0 | 151 | 151 |
| TOTALE | 508 | 192 (37.8%) | 192 | 290 | 26 | 0 | 0 | 0% | 0 | 508 | 508 |

Latenza harness (webhook→risposta, senza rete) p50 6.9 ms · p95 10 ms. Con la latenza Groq registrata: p50 6.9 ms · p95 10 ms.
IA: 0 risposte (cache o vere), 1440 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 290 | 0 | 0 |
| chiarimento-mancante | 0 | 69 | 0 |
| opzioni-non-leggibili | 0 | 2 | 0 |
| risposta-non-pertinente | 0 | 0 | 7 |

