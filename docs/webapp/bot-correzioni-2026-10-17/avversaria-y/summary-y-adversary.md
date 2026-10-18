# Banco E · y-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=558).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 558 | 257 (46.1%) | 252 | 9 | 292 | 5 | 1 | 91.2% | 633 | 558 | 0 |
| multi-turno | 254 | 102 (40.2%) | 102 | 8 | 144 | 0 | 0 | 92.2% | 383 | 254 | 0 |
| TOTALE | 558 | 257 (46.1%) | 252 | 9 | 292 | 5 | 1 | 91.2% | 633 | 558 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 12.1 ms · p95 24 ms. Con la latenza Groq registrata: p50 12.1 ms · p95 24 ms.
IA: 1568 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 6 | 0 | 0 |
| correzione-non-applicata | 3 | 0 | 0 |
| modifica-sbagliata | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 292 | 0 |
| risposta-non-pertinente | 0 | 0 | 5 |

