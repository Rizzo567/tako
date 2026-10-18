# Banco E · z-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=408).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 408 | 392 (96.1%) | 392 | 0 | 16 | 0 | 0 | 39.6% | 131 | 407 | 0 |
| multi-turno | 103 | 95 (92.2%) | 95 | 0 | 8 | 0 | 0 | 42.4% | 68 | 103 | 0 |
| TOTALE | 408 | 392 (96.1%) | 392 | 0 | 16 | 0 | 0 | 39.6% | 131 | 407 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 3.8 ms · p95 9.2 ms. Con la latenza Groq registrata: p50 3.8 ms · p95 9.2 ms.
IA: 583 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 13 | 0 |
| categoria-fuori-ordine | 0 | 2 | 0 |
| chiarimento-mancante | 0 | 1 | 0 |

