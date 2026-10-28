# Banco E · r8-off

Generato da tests/eval (groq=off, bot=nuovo, conversazioni=160).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b2-categorie | 160 | 1 (0.6%) | 1 | 129 | 30 | 0 | 0 | 0% | 0 | 160 | 160 |
| multi-turno | 112 | 0 (0%) | 0 | 105 | 7 | 0 | 0 | 0% | 0 | 112 | 112 |
| TOTALE | 160 | 1 (0.6%) | 1 | 129 | 30 | 0 | 0 | 0% | 0 | 160 | 160 |

Latenza harness (webhook→risposta, senza rete) p50 1.4 ms · p95 1.9 ms. Con la latenza Groq registrata: p50 1.4 ms · p95 1.9 ms.
IA: 0 risposte (cache o vere), 624 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 129 | 0 | 0 |
| chiarimento-mancante | 0 | 30 | 0 |

