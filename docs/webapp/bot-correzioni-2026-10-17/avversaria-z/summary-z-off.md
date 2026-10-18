# Banco E · z-off

Generato da tests/eval (groq=off, bot=nuovo, conversazioni=408).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 408 | 143 (35%) | 143 | 195 | 70 | 0 | 0 | 0% | 0 | 407 | 407 |
| multi-turno | 103 | 37 (35.9%) | 37 | 48 | 18 | 0 | 0 | 0% | 0 | 103 | 103 |
| TOTALE | 408 | 143 (35%) | 143 | 195 | 70 | 0 | 0 | 0% | 0 | 407 | 407 |

Latenza harness (webhook→risposta, senza rete) p50 1.8 ms · p95 3.3 ms. Con la latenza Groq registrata: p50 1.8 ms · p95 3.3 ms.
IA: 0 risposte (cache o vere), 1069 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 194 | 0 | 0 |
| errore-generico | 1 | 0 | 0 |
| chiarimento-mancante | 0 | 82 | 0 |

