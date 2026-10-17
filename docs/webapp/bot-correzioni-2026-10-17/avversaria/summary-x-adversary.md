# Banco E · x-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=508).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 508 | 264 (52%) | 264 | 104 | 140 | 0 | 52 | 50.8% | 308 | 344 | 0 |
| multi-turno | 151 | 71 (47%) | 71 | 42 | 38 | 0 | 13 | 56.5% | 154 | 128 | 0 |
| TOTALE | 508 | 264 (52%) | 264 | 104 | 140 | 0 | 52 | 50.8% | 308 | 344 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 2 ms · p95 5.2 ms. Con la latenza Groq registrata: p50 2 ms · p95 5.2 ms.
IA: 400 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 52 | 0 | 0 |
| modifica-non-richiesta | 44 | 0 | 0 |
| correzione-non-applicata | 23 | 0 | 0 |
| frase-come-piatto | 11 | 0 | 0 |
| richiesta-persa | 9 | 0 | 0 |
| scrive-invece-di-chiedere | 6 | 0 | 0 |
| modifica-sbagliata | 5 | 0 | 0 |
| fatto-falso | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 149 | 0 |
| senza-contesto | 0 | 5 | 0 |
| chiarimento-mancante | 0 | 5 | 0 |
| opzioni-non-leggibili | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 5 |

