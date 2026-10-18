# Banco E · y-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=558).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 558 | 527 (94.4%) | 522 | 0 | 31 | 5 | 0 | 41.3% | 200 | 558 | 0 |
| multi-turno | 254 | 239 (94.1%) | 239 | 0 | 15 | 0 | 0 | 46.5% | 126 | 254 | 0 |
| TOTALE | 558 | 527 (94.4%) | 522 | 0 | 31 | 5 | 0 | 41.3% | 200 | 558 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 3.2 ms · p95 5.3 ms. Con la latenza Groq registrata: p50 3.2 ms · p95 5.3 ms.
IA: 994 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 29 | 0 |
| categoria-fuori-ordine | 0 | 1 | 0 |
| chiarimento-mancante | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 5 |

