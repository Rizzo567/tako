# Banco E · a-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=809).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 186 | 16 (8.6%) | 16 | 0 | 170 | 0 | 0 | 98.6% | 172 | 186 | 0 |
| a2-prezzi | 160 | 32 (20%) | 32 | 0 | 128 | 0 | 0 | 95.9% | 264 | 160 | 0 |
| a3-nomi | 156 | 0 (0%) | 0 | 0 | 156 | 0 | 0 | 100% | 156 | 156 | 0 |
| a4-validatore | 156 | 35 (22.4%) | 35 | 0 | 121 | 0 | 0 | 81.4% | 130 | 156 | 0 |
| a5-asr | 151 | 32 (21.2%) | 32 | 0 | 119 | 0 | 0 | 100% | 151 | 151 | 0 |
| multi-turno | 363 | 19 (5.2%) | 19 | 0 | 344 | 0 | 0 | 94.9% | 475 | 363 | 0 |
| TOTALE | 809 | 115 (14.2%) | 115 | 0 | 694 | 0 | 0 | 95.7% | 873 | 809 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 2.3 ms · p95 7.8 ms. Con la latenza Groq registrata: p50 2.3 ms · p95 7.8 ms.
IA: 2309 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 694 | 0 |
| risposta-non-pertinente | 0 | 0 | 21 |

