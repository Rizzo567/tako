# Banco E · r8-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=160).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b2-categorie | 160 | 32 (20%) | 32 | 0 | 128 | 0 | 0 | 81.4% | 224 | 160 | 0 |
| multi-turno | 112 | 8 (7.1%) | 8 | 0 | 104 | 0 | 0 | 78.4% | 200 | 112 | 0 |
| TOTALE | 160 | 32 (20%) | 32 | 0 | 128 | 0 | 0 | 81.4% | 224 | 160 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 4.8 ms · p95 7 ms. Con la latenza Groq registrata: p50 4.8 ms · p95 7 ms.
IA: 556 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 128 | 0 |

