# Banco E · a-off

Generato da tests/eval (groq=off, bot=nuovo, conversazioni=502).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 186 | 186 (100%) | 186 | 0 | 0 | 0 | 0 | 58.8% | 4 | 6 | 6 |
| a2-prezzi | 160 | 54 (33.8%) | 54 | 106 | 0 | 0 | 0 | 5.5% | 0 | 106 | 106 |
| a3-nomi | 156 | 156 (100%) | 156 | 0 | 0 | 0 | 0 | 37.6% | 0 | 0 | 0 |
| multi-turno | 316 | 232 (73.4%) | 232 | 84 | 0 | 0 | 0 | 44% | 4 | 90 | 90 |
| TOTALE | 502 | 396 (78.9%) | 396 | 106 | 0 | 0 | 0 | 37.1% | 4 | 112 | 112 |

Latenza harness (webhook→risposta, senza rete) p50 0.6 ms · p95 1.7 ms. Con la latenza Groq registrata: p50 0.6 ms · p95 1.7 ms.
IA: 0 risposte (cache o vere), 584 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| errore-generico | 102 | 0 | 0 |
| non-applicato | 58 | 0 | 0 |
| richiesta-persa | 40 | 0 | 0 |
| correzione-non-applicata | 8 | 0 | 0 |

