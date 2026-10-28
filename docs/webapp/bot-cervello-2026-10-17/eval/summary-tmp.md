# Banco E · tmp

Generato da tests/eval (groq=oracle, riferimento=attuale-oracle, tetto=20000, conversazioni=2).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anche | 1 | 0 (0%) | 0 | 1 | 0 | 0 | 0 | 50% | 1 | 1 | 0 |
| multipla | 1 | 0 (0%) | 0 | 1 | 0 | 0 | 0 | 50% | 0 | 1 | 0 |
| multi-turno | 2 | 0 (0%) | 0 | 2 | 0 | 0 | 0 | 50% | 1 | 2 | 0 |
| TOTALE | 2 | 0 (0%) | 0 | 2 | 0 | 0 | 0 | 50% | 1 | 2 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 17.6 ms · p95 41.9 ms. Con la latenza Groq registrata: p50 17.6 ms · p95 41.9 ms.
IA: 6 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 2 | 0 | 0 |

