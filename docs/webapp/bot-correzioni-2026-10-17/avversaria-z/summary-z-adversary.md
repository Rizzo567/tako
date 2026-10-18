# Banco E · z-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=408).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b1-elimina | 408 | 230 (56.4%) | 230 | 1 | 177 | 0 | 0 | 91.4% | 408 | 407 | 0 |
| multi-turno | 103 | 58 (56.3%) | 58 | 1 | 44 | 0 | 0 | 95.2% | 190 | 103 | 0 |
| TOTALE | 408 | 230 (56.4%) | 230 | 1 | 177 | 0 | 0 | 91.4% | 408 | 407 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 3.6 ms · p95 7 ms. Con la latenza Groq registrata: p50 3.6 ms · p95 7 ms.
IA: 931 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 176 | 0 |
| categoria-fuori-ordine | 0 | 1 | 0 |

