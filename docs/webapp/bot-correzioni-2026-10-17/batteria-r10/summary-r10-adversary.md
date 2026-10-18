# Banco E · r10-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=181).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b2-categorie | 181 | 64 (35.4%) | 64 | 71 | 46 | 0 | 0 | 34.4% | 35 | 181 | 0 |
| multi-turno | 73 | 6 (8.2%) | 6 | 21 | 46 | 0 | 0 | 39.1% | 35 | 73 | 0 |
| TOTALE | 181 | 64 (35.4%) | 64 | 71 | 46 | 0 | 0 | 34.4% | 35 | 181 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 4.5 ms · p95 6.8 ms. Con la latenza Groq registrata: p50 4.5 ms · p95 6.8 ms.
IA: 510 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 71 | 0 | 0 |
| chiede-invece-di-agire | 0 | 31 | 0 |
| solo-nulla | 0 | 30 | 0 |
| in-attesa-ok | 0 | 15 | 0 |
| domanda-ripetuta-generica | 0 | 13 | 0 |

