# Banco E · x-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=508).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 508 | 344 (67.7%) | 344 | 29 | 135 | 0 | 6 | 46.8% | 271 | 306 | 0 |
| multi-turno | 151 | 93 (61.6%) | 93 | 26 | 32 | 0 | 6 | 49.9% | 125 | 105 | 0 |
| TOTALE | 508 | 344 (67.7%) | 344 | 29 | 135 | 0 | 6 | 46.8% | 271 | 306 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 1.8 ms · p95 4.9 ms. Con la latenza Groq registrata: p50 1.8 ms · p95 4.9 ms.
IA: 352 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| correzione-non-applicata | 16 | 0 | 0 |
| non-applicato | 6 | 0 | 0 |
| richiesta-persa | 5 | 0 | 0 |
| modifica-non-richiesta | 3 | 0 | 0 |
| modifica-sbagliata | 3 | 0 | 0 |
| chiede-invece-di-agire | 0 | 145 | 0 |
| chiarimento-mancante | 0 | 3 | 0 |
| risposta-non-pertinente | 0 | 0 | 7 |

