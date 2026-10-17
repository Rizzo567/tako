# Banco E · y-off

Generato da tests/eval (groq=off, bot=nuovo, conversazioni=558).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 558 | 392 (70.3%) | 392 | 79 | 87 | 0 | 7 | 34.6% | 140 | 270 | 270 |
| multi-turno | 254 | 182 (71.7%) | 182 | 31 | 41 | 0 | 0 | 41.7% | 89 | 145 | 145 |
| TOTALE | 558 | 392 (70.3%) | 392 | 79 | 87 | 0 | 7 | 34.6% | 140 | 270 | 270 |

Latenza harness (webhook→risposta, senza rete) p50 1.3 ms · p95 3.5 ms. Con la latenza Groq registrata: p50 1.3 ms · p95 3.5 ms.
IA: 0 risposte (cache o vere), 972 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 61 | 0 | 0 |
| correzione-non-applicata | 14 | 0 | 0 |
| errore-generico | 4 | 0 | 0 |
| richiesta-persa | 4 | 0 | 0 |
| modifica-non-richiesta | 4 | 0 | 0 |
| modifica-sbagliata | 3 | 0 | 0 |
| scrive-invece-di-chiedere | 2 | 0 | 0 |
| eliminato-senza-conferma | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 73 | 0 |
| chiarimento-mancante | 0 | 29 | 0 |
| categoria-fuori-ordine | 0 | 1 | 0 |

