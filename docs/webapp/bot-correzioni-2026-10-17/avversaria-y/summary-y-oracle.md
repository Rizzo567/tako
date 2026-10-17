# Banco E · y-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, conversazioni=558).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 558 | 508 (91%) | 503 | 5 | 45 | 5 | 0 | 44.2% | 228 | 558 | 0 |
| multi-turno | 254 | 228 (89.8%) | 228 | 5 | 21 | 0 | 0 | 49.3% | 144 | 254 | 0 |
| TOTALE | 558 | 508 (91%) | 503 | 5 | 45 | 5 | 0 | 44.2% | 228 | 558 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 4.2 ms · p95 6.8 ms. Con la latenza Groq registrata: p50 4.2 ms · p95 6.8 ms.
IA: 1017 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 4 | 0 | 0 |
| eliminato-senza-conferma | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 43 | 0 |
| categoria-fuori-ordine | 0 | 1 | 0 |
| chiarimento-mancante | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 5 |

