# Banco E · x-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=508).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 508 | 501 (98.6%) | 501 | 0 | 7 | 0 | 0 | 25.3% | 113 | 508 | 0 |
| multi-turno | 151 | 148 (98%) | 148 | 0 | 3 | 0 | 0 | 32% | 60 | 151 | 0 |
| TOTALE | 508 | 501 (98.6%) | 501 | 0 | 7 | 0 | 0 | 25.3% | 113 | 508 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 4 ms · p95 6.9 ms. Con la latenza Groq registrata: p50 4 ms · p95 6.9 ms.
IA: 746 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 6 | 0 |
| in-attesa-ok | 0 | 1 | 0 |

