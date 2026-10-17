# Banco E · b-off

Generato da tests/eval (groq=off, bot=nuovo, conversazioni=452).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 150 | 134 (89.3%) | 134 | 16 | 0 | 0 | 0 | 41.9% | 22 | 25 | 25 |
| b2-categorie | 150 | 150 (100%) | 150 | 0 | 0 | 0 | 0 | 16.5% | 0 | 2 | 2 |
| b3-sposta-rinomina | 152 | 132 (86.8%) | 132 | 20 | 0 | 0 | 0 | 9.7% | 8 | 20 | 20 |
| multi-turno | 226 | 190 (84.1%) | 190 | 36 | 0 | 0 | 0 | 36% | 22 | 39 | 39 |
| TOTALE | 452 | 416 (92%) | 416 | 36 | 0 | 0 | 0 | 25.8% | 30 | 47 | 47 |

Latenza harness (webhook→risposta, senza rete) p50 0.7 ms · p95 1.8 ms. Con la latenza Groq registrata: p50 0.7 ms · p95 1.8 ms.
IA: 0 risposte (cache o vere), 154 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| correzione-non-applicata | 24 | 0 | 0 |
| richiesta-persa | 10 | 0 | 0 |
| non-applicato | 10 | 0 | 0 |
| frase-come-piatto | 2 | 0 | 0 |
| chiarimento-mancante | 0 | 16 | 0 |
| chiede-invece-di-agire | 0 | 16 | 0 |

