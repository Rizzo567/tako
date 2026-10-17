# Banco E · y-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=558).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 558 | 454 (81.4%) | 454 | 29 | 75 | 0 | 9 | 31.4% | 125 | 270 | 0 |
| multi-turno | 254 | 196 (77.2%) | 196 | 17 | 41 | 0 | 2 | 39.7% | 88 | 145 | 0 |
| TOTALE | 558 | 454 (81.4%) | 454 | 29 | 75 | 0 | 9 | 31.4% | 125 | 270 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 1.4 ms · p95 5.1 ms. Con la latenza Groq registrata: p50 1.4 ms · p95 5.1 ms.
IA: 316 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 15 | 0 | 0 |
| correzione-non-applicata | 9 | 0 | 0 |
| modifica-sbagliata | 5 | 0 | 0 |
| richiesta-persa | 4 | 0 | 0 |
| modifica-non-richiesta | 4 | 0 | 0 |
| scrive-invece-di-chiedere | 2 | 0 | 0 |
| eliminato-senza-conferma | 1 | 0 | 0 |
| chiarimento-mancante | 0 | 43 | 0 |
| chiede-invece-di-agire | 0 | 34 | 0 |
| senza-contesto | 0 | 1 | 0 |
| categoria-fuori-ordine | 0 | 1 | 0 |

