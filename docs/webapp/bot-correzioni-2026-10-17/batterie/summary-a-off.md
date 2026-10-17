# Banco E · a-off

Generato da tests/eval (groq=off, bot=nuovo, conversazioni=809).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 186 | 186 (100%) | 186 | 0 | 0 | 0 | 0 | 58.8% | 4 | 6 | 6 |
| a2-prezzi | 160 | 68 (42.5%) | 68 | 92 | 0 | 0 | 0 | 5.5% | 0 | 100 | 100 |
| a3-nomi | 156 | 147 (94.2%) | 147 | 0 | 9 | 0 | 0 | 33.5% | 9 | 9 | 9 |
| a4-validatore | 156 | 48 (30.8%) | 48 | 92 | 16 | 0 | 0 | 17.2% | 15 | 112 | 112 |
| a5-asr | 151 | 102 (67.5%) | 102 | 33 | 16 | 0 | 0 | 34.1% | 45 | 87 | 87 |
| multi-turno | 363 | 251 (69.1%) | 251 | 96 | 16 | 0 | 0 | 37.8% | 4 | 130 | 130 |
| TOTALE | 809 | 551 (68.1%) | 551 | 217 | 41 | 0 | 0 | 32.9% | 73 | 314 | 314 |

Latenza harness (webhook→risposta, senza rete) p50 0.8 ms · p95 2.1 ms. Con la latenza Groq registrata: p50 0.8 ms · p95 2.1 ms.
IA: 0 risposte (cache o vere), 1230 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 133 | 0 | 0 |
| errore-generico | 44 | 0 | 0 |
| richiesta-persa | 40 | 0 | 0 |
| correzione-non-applicata | 8 | 0 | 0 |
| chiede-invece-di-agire | 0 | 63 | 0 |
| chiarimento-mancante | 0 | 20 | 0 |
| risposta-non-pertinente | 0 | 0 | 28 |

