# Banco E · y-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=558).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 558 | 323 (57.9%) | 323 | 142 | 93 | 0 | 110 | 39.8% | 220 | 230 | 0 |
| multi-turno | 254 | 132 (52%) | 132 | 76 | 46 | 0 | 50 | 46.7% | 147 | 141 | 0 |
| TOTALE | 558 | 323 (57.9%) | 323 | 142 | 93 | 0 | 110 | 39.8% | 220 | 230 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 1.1 ms · p95 3.3 ms. Con la latenza Groq registrata: p50 1.1 ms · p95 3.3 ms.
IA: 271 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta | 101 | 0 | 0 |
| non-applicato | 81 | 0 | 0 |
| modifica-sbagliata | 27 | 0 | 0 |
| correzione-non-applicata | 14 | 0 | 0 |
| richiesta-persa | 10 | 0 | 0 |
| scrive-invece-di-chiedere | 9 | 0 | 0 |
| eliminato-senza-conferma | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 98 | 0 |
| chiarimento-mancante | 0 | 57 | 0 |
| senza-contesto | 0 | 1 | 0 |
| categoria-fuori-ordine | 0 | 1 | 0 |

