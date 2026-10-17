# Banco E · y-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=558).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 558 | 368 (65.9%) | 368 | 140 | 50 | 0 | 119 | 28.3% | 117 | 230 | 0 |
| multi-turno | 254 | 157 (61.8%) | 157 | 66 | 31 | 0 | 49 | 37.2% | 91 | 141 | 0 |
| TOTALE | 558 | 368 (65.9%) | 368 | 140 | 50 | 0 | 119 | 28.3% | 117 | 230 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 1.2 ms · p95 4.6 ms. Con la latenza Groq registrata: p50 1.2 ms · p95 4.6 ms.
IA: 273 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta | 98 | 0 | 0 |
| non-applicato | 85 | 0 | 0 |
| modifica-sbagliata | 39 | 0 | 0 |
| correzione-non-applicata | 13 | 0 | 0 |
| scrive-invece-di-chiedere | 9 | 0 | 0 |
| richiesta-persa | 8 | 0 | 0 |
| eliminato-senza-conferma | 1 | 0 | 0 |
| chiarimento-mancante | 0 | 60 | 0 |
| chiede-invece-di-agire | 0 | 45 | 0 |
| senza-contesto | 0 | 1 | 0 |
| categoria-fuori-ordine | 0 | 1 | 0 |

