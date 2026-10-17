# Banco E · a-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=658).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 186 | 186 (100%) | 186 | 0 | 0 | 0 | 0 | 58.3% | 2 | 6 | 0 |
| a2-prezzi | 160 | 72 (45%) | 72 | 16 | 72 | 0 | 3 | 56.8% | 150 | 106 | 0 |
| a3-nomi | 156 | 156 (100%) | 156 | 0 | 0 | 0 | 0 | 37.6% | 0 | 0 | 0 |
| a4-validatore | 156 | 74 (47.4%) | 74 | 28 | 54 | 0 | 0 | 44.1% | 54 | 112 | 0 |
| multi-turno | 352 | 270 (76.7%) | 270 | 16 | 66 | 0 | 3 | 57.1% | 138 | 114 | 0 |
| TOTALE | 658 | 488 (74.2%) | 488 | 44 | 126 | 0 | 3 | 51% | 206 | 224 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 0.6 ms · p95 1.6 ms. Con la latenza Groq registrata: p50 0.6 ms · p95 1.6 ms.
IA: 302 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| richiesta-persa | 28 | 0 | 0 |
| non-applicato | 12 | 0 | 0 |
| correzione-non-applicata | 4 | 0 | 0 |
| modifica-non-richiesta | 3 | 0 | 0 |
| chiede-invece-di-agire | 0 | 130 | 0 |
| risposta-non-pertinente | 0 | 0 | 18 |

