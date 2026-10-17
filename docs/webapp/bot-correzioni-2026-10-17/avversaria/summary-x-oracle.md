# Banco E · x-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=508).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 508 | 362 (71.3%) | 362 | 115 | 31 | 0 | 74 | 21.7% | 99 | 344 | 0 |
| multi-turno | 151 | 106 (70.2%) | 106 | 29 | 16 | 0 | 14 | 31.7% | 65 | 128 | 0 |
| TOTALE | 508 | 362 (71.3%) | 362 | 115 | 31 | 0 | 74 | 21.7% | 99 | 344 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 2.8 ms · p95 6.1 ms. Con la latenza Groq registrata: p50 2.8 ms · p95 6.1 ms.
IA: 397 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 81 | 0 | 0 |
| modifica-non-richiesta | 45 | 0 | 0 |
| modifica-sbagliata | 28 | 0 | 0 |
| correzione-non-applicata | 11 | 0 | 0 |
| frase-come-piatto | 11 | 0 | 0 |
| scrive-invece-di-chiedere | 6 | 0 | 0 |
| richiesta-persa | 4 | 0 | 0 |
| fatto-falso | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 27 | 0 |
| chiarimento-mancante | 0 | 6 | 0 |
| senza-contesto | 0 | 5 | 0 |
| opzioni-non-leggibili | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 3 |

