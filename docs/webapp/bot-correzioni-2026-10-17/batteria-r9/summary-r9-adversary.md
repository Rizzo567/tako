# Banco E · r9-adversary

Generato da tests/eval (groq=adversary, bot=nuovo, conversazioni=185).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| b2-categorie | 185 | 20 (10.8%) | 20 | 0 | 165 | 0 | 0 | 94.8% | 158 | 185 | 0 |
| multi-turno | 173 | 20 (11.6%) | 20 | 0 | 153 | 0 | 0 | 94.7% | 146 | 173 | 0 |
| TOTALE | 185 | 20 (10.8%) | 20 | 0 | 165 | 0 | 0 | 94.8% | 158 | 185 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 3.6 ms · p95 5.9 ms. Con la latenza Groq registrata: p50 3.6 ms · p95 5.9 ms.
IA: 702 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 151 | 0 |
| domanda-ripetuta-generica | 0 | 83 | 0 |
| chiarimento-mancante | 0 | 17 | 0 |

