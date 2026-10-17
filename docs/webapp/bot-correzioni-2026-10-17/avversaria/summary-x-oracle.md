# Banco E · x-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=508).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 508 | 499 (98.2%) | 499 | 0 | 9 | 0 | 0 | 17.4% | 60 | 304 | 0 |
| multi-turno | 151 | 147 (97.4%) | 147 | 0 | 4 | 0 | 0 | 24% | 32 | 105 | 0 |
| TOTALE | 508 | 499 (98.2%) | 499 | 0 | 9 | 0 | 0 | 17.4% | 60 | 304 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 2.7 ms · p95 7.7 ms. Con la latenza Groq registrata: p50 2.7 ms · p95 7.7 ms.
IA: 347 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 5 | 0 |
| chiarimento-mancante | 0 | 4 | 0 |

