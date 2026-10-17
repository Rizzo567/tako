# Banco E · a-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=809).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 186 | 186 (100%) | 186 | 0 | 0 | 0 | 0 | 58.3% | 2 | 6 | 0 |
| a2-prezzi | 160 | 78 (48.8%) | 78 | 16 | 66 | 0 | 3 | 54.8% | 144 | 100 | 0 |
| a3-nomi | 156 | 147 (94.2%) | 147 | 9 | 0 | 0 | 0 | 29.4% | 0 | 9 | 0 |
| a4-validatore | 156 | 74 (47.4%) | 74 | 28 | 54 | 0 | 0 | 44.1% | 54 | 112 | 0 |
| a5-asr | 151 | 96 (63.6%) | 96 | 0 | 55 | 0 | 0 | 46.1% | 61 | 87 | 0 |
| multi-turno | 363 | 265 (73%) | 265 | 16 | 82 | 0 | 3 | 57.6% | 154 | 130 | 0 |
| TOTALE | 809 | 581 (71.8%) | 581 | 53 | 175 | 0 | 3 | 48.9% | 261 | 314 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 0.8 ms · p95 2.3 ms. Con la latenza Groq registrata: p50 0.8 ms · p95 2.3 ms.
IA: 400 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| richiesta-persa | 37 | 0 | 0 |
| non-applicato | 12 | 0 | 0 |
| correzione-non-applicata | 4 | 0 | 0 |
| modifica-non-richiesta | 3 | 0 | 0 |
| chiede-invece-di-agire | 0 | 179 | 0 |
| risposta-non-pertinente | 0 | 0 | 18 |

