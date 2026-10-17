# Banco E · a-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=502).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a1-composti | 186 | 186 (100%) | 186 | 0 | 0 | 0 | 0 | 58.3% | 2 | 6 | 0 |
| a2-prezzi | 160 | 72 (45%) | 72 | 16 | 72 | 0 | 3 | 56.8% | 150 | 106 | 0 |
| a3-nomi | 156 | 156 (100%) | 156 | 0 | 0 | 0 | 0 | 37.6% | 0 | 0 | 0 |
| multi-turno | 316 | 242 (76.6%) | 242 | 16 | 58 | 0 | 3 | 60.2% | 130 | 90 | 0 |
| TOTALE | 502 | 414 (82.5%) | 414 | 16 | 72 | 0 | 3 | 52.5% | 152 | 112 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 0.6 ms · p95 1.6 ms. Con la latenza Groq registrata: p50 0.6 ms · p95 1.6 ms.
IA: 190 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 12 | 0 | 0 |
| correzione-non-applicata | 4 | 0 | 0 |
| modifica-non-richiesta | 3 | 0 | 0 |
| chiede-invece-di-agire | 0 | 76 | 0 |
| frase-fissa | 0 | 73 | 0 |

