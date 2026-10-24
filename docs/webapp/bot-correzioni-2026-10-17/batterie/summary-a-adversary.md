# Banco E · a-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=809).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 186 | 16 (8.6%) | 16 | 0 | 170 | 0 | 0 | 98.1% | 170 | 186 | 0 |
| a2-prezzi | 160 | 32 (20%) | 32 | 0 | 128 | 0 | 0 | 95.9% | 264 | 160 | 0 |
| a3-nomi | 156 | 0 (0%) | 0 | 0 | 156 | 0 | 0 | 100% | 156 | 156 | 0 |
| a4-validatore | 156 | 40 (25.6%) | 40 | 13 | 103 | 0 | 13 | 77.9% | 111 | 156 | 0 |
| a5-asr | 151 | 32 (21.2%) | 32 | 0 | 119 | 0 | 0 | 100% | 151 | 151 | 0 |
| multi-turno | 363 | 16 (4.4%) | 16 | 9 | 338 | 0 | 9 | 93.8% | 466 | 363 | 0 |
| TOTALE | 809 | 120 (14.8%) | 120 | 13 | 676 | 0 | 13 | 95% | 852 | 809 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 10.6 ms · p95 30.6 ms. Con la latenza Groq registrata: p50 10.6 ms · p95 30.6 ms.
IA: 2309 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta | 31 | 0 | 0 |
| non-applicato | 13 | 0 | 0 |
| chiede-invece-di-agire | 0 | 676 | 0 |
| risposta-non-pertinente | 0 | 0 | 21 |

