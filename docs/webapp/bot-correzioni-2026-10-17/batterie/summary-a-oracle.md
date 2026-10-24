# Banco E · a-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=809).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 186 | 186 (100%) | 186 | 0 | 0 | 0 | 0 | 57.8% | 0 | 186 | 0 |
| a2-prezzi | 160 | 132 (82.5%) | 132 | 28 | 0 | 0 | 28 | 5.5% | 0 | 160 | 0 |
| a3-nomi | 156 | 156 (100%) | 156 | 0 | 0 | 0 | 0 | 29.4% | 0 | 156 | 0 |
| a4-validatore | 156 | 120 (76.9%) | 120 | 36 | 0 | 0 | 36 | 23.5% | 0 | 156 | 0 |
| a5-asr | 151 | 151 (100%) | 151 | 0 | 0 | 0 | 0 | 28.7% | 32 | 151 | 0 |
| multi-turno | 363 | 315 (86.8%) | 315 | 48 | 0 | 0 | 48 | 39.7% | 0 | 363 | 0 |
| TOTALE | 809 | 745 (92.1%) | 745 | 64 | 0 | 0 | 64 | 32.2% | 32 | 809 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 12.2 ms · p95 35.3 ms. Con la latenza Groq registrata: p50 12.2 ms · p95 35.3 ms.
IA: 1365 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta | 120 | 0 | 0 |
| non-applicato | 64 | 0 | 0 |

