# Banco E · y-off

Generato da tests/eval (groq=off, bot=nuovo, conversazioni=558).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 558 | 339 (60.8%) | 339 | 180 | 39 | 0 | 105 | 25.4% | 97 | 230 | 230 |
| multi-turno | 254 | 145 (57.1%) | 145 | 86 | 23 | 0 | 47 | 33.4% | 76 | 141 | 141 |
| TOTALE | 558 | 339 (60.8%) | 339 | 180 | 39 | 0 | 105 | 25.4% | 97 | 230 | 230 |

Latenza harness (webhook→risposta, senza rete) p50 1.1 ms · p95 3.1 ms. Con la latenza Groq registrata: p50 1.1 ms · p95 3.1 ms.
IA: 0 risposte (cache o vere), 874 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 127 | 0 | 0 |
| modifica-non-richiesta | 98 | 0 | 0 |
| modifica-sbagliata | 25 | 0 | 0 |
| correzione-non-applicata | 18 | 0 | 0 |
| scrive-invece-di-chiedere | 9 | 0 | 0 |
| errore-generico | 5 | 0 | 0 |
| richiesta-persa | 4 | 0 | 0 |
| eliminato-senza-conferma | 1 | 0 | 0 |
| chiarimento-mancante | 0 | 67 | 0 |
| chiede-invece-di-agire | 0 | 39 | 0 |
| categoria-fuori-ordine | 0 | 1 | 0 |

