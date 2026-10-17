# Banco E · b-off

Generato da tests/eval (groq=off, bot=nuovo, conversazioni=452).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 150 | 134 (89.3%) | 134 | 16 | 0 | 0 | 0 | 41.9% | 22 | 25 | 25 |
| b2-categorie | 150 | 150 (100%) | 150 | 0 | 0 | 0 | 0 | 16.5% | 0 | 2 | 2 |
| b3-sposta-rinomina | 152 | 127 (83.6%) | 127 | 20 | 5 | 0 | 0 | 13.1% | 15 | 26 | 26 |
| multi-turno | 226 | 190 (84.1%) | 190 | 36 | 0 | 0 | 0 | 36.4% | 24 | 40 | 40 |
| TOTALE | 452 | 411 (90.9%) | 411 | 36 | 5 | 0 | 0 | 26.8% | 37 | 53 | 53 |

Latenza harness (webhook→risposta, senza rete) p50 0.7 ms · p95 2.1 ms. Con la latenza Groq registrata: p50 0.7 ms · p95 2.1 ms.
IA: 0 risposte (cache o vere), 172 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| correzione-non-applicata | 24 | 0 | 0 |
| richiesta-persa | 10 | 0 | 0 |
| non-applicato | 10 | 0 | 0 |
| frase-come-piatto | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 21 | 0 |
| chiarimento-mancante | 0 | 16 | 0 |

