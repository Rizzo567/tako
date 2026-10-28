# Banco E · tmp

Generato da tests/eval (groq=oracle, bot=nuovo, tetto=20000, conversazioni=1).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| v-correzioni | 1 | 0 (0%) | 0 | 0 | 1 | 0 | 0 | 100% | 1 | 1 | 0 |
| multi-turno | 0 | 0 (0%) | 0 | 0 | 0 | 0 | 0 | 0% | 0 | 0 | 0 |
| TOTALE | 1 | 0 (0%) | 0 | 0 | 1 | 0 | 0 | 100% | 1 | 1 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 46.6 ms · p95 46.6 ms. Con la latenza Groq registrata: p50 46.6 ms · p95 46.6 ms.
IA: 2 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 1 | 0 |

