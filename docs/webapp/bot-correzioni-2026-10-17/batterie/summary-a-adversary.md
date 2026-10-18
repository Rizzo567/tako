# Banco E · a-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=809).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 186 | 16 (8.6%) | 16 | 0 | 170 | 0 | 0 | 98.6% | 172 | 186 | 0 |
| a2-prezzi | 160 | 32 (20%) | 32 | 0 | 128 | 0 | 0 | 95.9% | 264 | 160 | 0 |
| a3-nomi | 156 | 0 (0%) | 0 | 0 | 156 | 0 | 0 | 100% | 156 | 156 | 0 |
| a4-validatore | 156 | 47 (30.1%) | 47 | 0 | 109 | 0 | 0 | 81.4% | 118 | 156 | 0 |
| a5-asr | 151 | 32 (21.2%) | 32 | 0 | 119 | 0 | 0 | 100% | 151 | 151 | 0 |
| multi-turno | 363 | 19 (5.2%) | 19 | 0 | 344 | 0 | 0 | 94.9% | 475 | 363 | 0 |
| TOTALE | 809 | 127 (15.7%) | 127 | 0 | 682 | 0 | 0 | 95.7% | 861 | 809 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 8.5 ms · p95 23.8 ms. Con la latenza Groq registrata: p50 8.5 ms · p95 23.8 ms.
IA: 2311 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 682 | 0 |
| risposta-non-pertinente | 0 | 0 | 21 |

