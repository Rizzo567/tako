# Banco E · x-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=508).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 508 | 451 (88.8%) | 451 | 31 | 26 | 0 | 15 | 20% | 86 | 321 | 0 |
| multi-turno | 151 | 125 (82.8%) | 125 | 15 | 11 | 0 | 10 | 28.9% | 55 | 120 | 0 |
| TOTALE | 508 | 451 (88.8%) | 451 | 31 | 26 | 0 | 15 | 20% | 86 | 321 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 2.3 ms · p95 6.1 ms. Con la latenza Groq registrata: p50 2.3 ms · p95 6.1 ms.
IA: 371 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta | 12 | 0 | 0 |
| frase-come-piatto | 11 | 0 | 0 |
| non-applicato | 10 | 0 | 0 |
| scrive-invece-di-chiedere | 4 | 0 | 0 |
| richiesta-persa | 4 | 0 | 0 |
| correzione-non-applicata | 2 | 0 | 0 |
| fatto-falso | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 21 | 0 |
| chiarimento-mancante | 0 | 7 | 0 |
| senza-contesto | 0 | 2 | 0 |
| opzioni-non-leggibili | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 3 |

