# Banco E · a-off

Generato da tests/eval (groq=off, bot=nuovo, conversazioni=658).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 186 | 186 (100%) | 186 | 0 | 0 | 0 | 0 | 58.8% | 4 | 6 | 6 |
| a2-prezzi | 160 | 54 (33.8%) | 54 | 106 | 0 | 0 | 0 | 5.5% | 0 | 106 | 106 |
| a3-nomi | 156 | 156 (100%) | 156 | 0 | 0 | 0 | 0 | 37.6% | 0 | 0 | 0 |
| a4-validatore | 156 | 44 (28.2%) | 44 | 112 | 0 | 0 | 0 | 17.2% | 15 | 112 | 112 |
| multi-turno | 352 | 244 (69.3%) | 244 | 108 | 0 | 0 | 0 | 39.7% | 4 | 114 | 114 |
| TOTALE | 658 | 440 (66.9%) | 440 | 218 | 0 | 0 | 0 | 33.6% | 19 | 224 | 224 |

Latenza harness (webhook→risposta, senza rete) p50 0.7 ms · p95 1.8 ms. Con la latenza Groq registrata: p50 0.7 ms · p95 1.8 ms.
IA: 0 risposte (cache o vere), 1032 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| errore-generico | 214 | 0 | 0 |
| non-applicato | 135 | 0 | 0 |
| richiesta-persa | 40 | 0 | 0 |
| correzione-non-applicata | 8 | 0 | 0 |
| chiarimento-mancante | 0 | 16 | 0 |
| chiede-invece-di-agire | 0 | 15 | 0 |
| risposta-non-pertinente | 0 | 0 | 28 |

