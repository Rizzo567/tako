# Banco E · x-off

Generato da tests/eval (groq=off, bot=nuovo, conversazioni=508).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 508 | 313 (61.6%) | 313 | 181 | 14 | 0 | 0 | 20.6% | 92 | 306 | 306 |
| multi-turno | 151 | 97 (64.2%) | 97 | 44 | 10 | 0 | 0 | 21.2% | 30 | 105 | 105 |
| TOTALE | 508 | 313 (61.6%) | 313 | 181 | 14 | 0 | 0 | 20.6% | 92 | 306 | 306 |

Latenza harness (webhook→risposta, senza rete) p50 1.9 ms · p95 3.5 ms. Con la latenza Groq registrata: p50 1.9 ms · p95 3.5 ms.
IA: 0 risposte (cache o vere), 1248 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 111 | 0 | 0 |
| errore-generico | 57 | 0 | 0 |
| correzione-non-applicata | 16 | 0 | 0 |
| richiesta-persa | 5 | 0 | 0 |
| chiede-invece-di-agire | 0 | 39 | 0 |
| chiarimento-mancante | 0 | 13 | 0 |
| in-attesa-ok | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 6 |

