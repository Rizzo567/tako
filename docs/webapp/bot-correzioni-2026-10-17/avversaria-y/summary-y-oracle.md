# Banco E · y-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=558).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 558 | 516 (92.5%) | 511 | 0 | 42 | 5 | 0 | 42.8% | 215 | 558 | 0 |
| multi-turno | 254 | 236 (92.9%) | 236 | 0 | 18 | 0 | 0 | 47.2% | 131 | 254 | 0 |
| TOTALE | 558 | 516 (92.5%) | 511 | 0 | 42 | 5 | 0 | 42.8% | 215 | 558 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 3.2 ms · p95 5.2 ms. Con la latenza Groq registrata: p50 3.2 ms · p95 5.2 ms.
IA: 1003 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 40 | 0 |
| categoria-fuori-ordine | 0 | 1 | 0 |
| chiarimento-mancante | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 5 |

