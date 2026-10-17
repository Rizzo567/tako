# Banco E · x-off

Generato da tests/eval (groq=off, bot=nuovo, conversazioni=508).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 508 | 317 (62.4%) | 317 | 177 | 14 | 0 | 0 | 21.4% | 98 | 304 | 304 |
| multi-turno | 151 | 96 (63.6%) | 96 | 45 | 10 | 0 | 0 | 21.5% | 31 | 105 | 105 |
| TOTALE | 508 | 317 (62.4%) | 317 | 177 | 14 | 0 | 0 | 21.4% | 98 | 304 | 304 |

Latenza harness (webhook→risposta, senza rete) p50 2.1 ms · p95 4 ms. Con la latenza Groq registrata: p50 2.1 ms · p95 4 ms.
IA: 0 risposte (cache o vere), 1230 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 106 | 0 | 0 |
| errore-generico | 57 | 0 | 0 |
| correzione-non-applicata | 17 | 0 | 0 |
| richiesta-persa | 5 | 0 | 0 |
| chiede-invece-di-agire | 0 | 40 | 0 |
| chiarimento-mancante | 0 | 13 | 0 |
| in-attesa-ok | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 6 |

