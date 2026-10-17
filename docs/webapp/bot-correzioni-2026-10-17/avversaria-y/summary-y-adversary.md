# Banco E · y-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=558).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 558 | 375 (67.2%) | 375 | 54 | 129 | 0 | 11 | 46.7% | 250 | 270 | 0 |
| multi-turno | 254 | 167 (65.7%) | 167 | 24 | 63 | 0 | 3 | 55.6% | 169 | 145 | 0 |
| TOTALE | 558 | 375 (67.2%) | 375 | 54 | 129 | 0 | 11 | 46.7% | 250 | 270 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 1.2 ms · p95 4 ms. Con la latenza Groq registrata: p50 1.2 ms · p95 4 ms.
IA: 314 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| richiesta-persa | 23 | 0 | 0 |
| non-applicato | 17 | 0 | 0 |
| correzione-non-applicata | 10 | 0 | 0 |
| modifica-non-richiesta | 7 | 0 | 0 |
| modifica-sbagliata | 4 | 0 | 0 |
| scrive-invece-di-chiedere | 2 | 0 | 0 |
| eliminato-senza-conferma | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 113 | 0 |
| chiarimento-mancante | 0 | 27 | 0 |
| senza-contesto | 0 | 1 | 0 |
| categoria-fuori-ordine | 0 | 1 | 0 |

