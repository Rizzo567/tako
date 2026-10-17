# Banco E · x-off

Generato da tests/eval (groq=off, bot=nuovo, conversazioni=508).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 508 | 142 (28%) | 142 | 351 | 15 | 0 | 50 | 23.2% | 119 | 344 | 344 |
| multi-turno | 151 | 42 (27.8%) | 42 | 100 | 9 | 0 | 13 | 27% | 54 | 128 | 128 |
| TOTALE | 508 | 142 (28%) | 142 | 351 | 15 | 0 | 50 | 23.2% | 119 | 344 | 344 |

Latenza harness (webhook→risposta, senza rete) p50 2.4 ms · p95 4.4 ms. Con la latenza Groq registrata: p50 2.4 ms · p95 4.4 ms.
IA: 0 risposte (cache o vere), 1430 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| errore-generico | 322 | 0 | 0 |
| non-applicato | 162 | 0 | 0 |
| modifica-non-richiesta | 44 | 0 | 0 |
| correzione-non-applicata | 20 | 0 | 0 |
| frase-come-piatto | 11 | 0 | 0 |
| richiesta-persa | 7 | 0 | 0 |
| scrive-invece-di-chiedere | 6 | 0 | 0 |
| modifica-sbagliata | 5 | 0 | 0 |
| fatto-falso | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 48 | 0 |
| chiarimento-mancante | 0 | 15 | 0 |
| in-attesa-ok | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 7 |

