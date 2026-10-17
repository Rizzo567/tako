# Banco E · attuale-oracle

Generato da tests/eval (groq=oracle, tetto=20000, orologio=2026-10-16T10:00:00Z, conversazioni=318).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anche | 34 | 16 (47.1%) | 16 | 17 | 1 | 0 | 0 | 1.5% | 1 | 20 | 0 |
| correzione | 29 | 19 (65.5%) | 19 | 9 | 1 | 0 | 0 | 0% | 0 | 10 | 0 |
| ripristino | 24 | 6 (25%) | 6 | 18 | 0 | 0 | 0 | 9.8% | 5 | 13 | 0 |
| chiarimento | 31 | 28 (90.3%) | 28 | 0 | 3 | 0 | 0 | 50.8% | 3 | 2 | 0 |
| multipla | 18 | 4 (22.2%) | 4 | 13 | 1 | 0 | 0 | 36.1% | 0 | 17 | 0 |
| scaduto | 18 | 8 (44.4%) | 8 | 3 | 7 | 0 | 0 | 13.9% | 4 | 15 | 0 |
| domanda | 25 | 25 (100%) | 24 | 0 | 0 | 1 | 0 | 7.4% | 2 | 8 | 0 |
| negazione | 21 | 20 (95.2%) | 20 | 1 | 0 | 0 | 0 | 4.3% | 1 | 9 | 0 |
| ambiguita | 20 | 17 (85%) | 17 | 0 | 3 | 0 | 0 | 75% | 0 | 3 | 0 |
| togli | 17 | 16 (94.1%) | 16 | 1 | 0 | 0 | 0 | 0% | 0 | 9 | 0 |
| vocale | 32 | 26 (81.3%) | 26 | 5 | 1 | 0 | 0 | 2.9% | 1 | 22 | 0 |
| qa1710 | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 25% | 0 | 0 | 0 |
| manuel | 5 | 1 (20%) | 1 | 3 | 1 | 0 | 0 | 0% | 0 | 5 | 0 |
| batterie | 36 | 35 (97.2%) | 35 | 0 | 1 | 0 | 0 | 22.1% | 12 | 9 | 0 |
| multi-turno | 207 | 128 (61.8%) | 128 | 65 | 14 | 0 | 0 | 18.1% | 26 | 92 | 0 |
| TOTALE | 318 | 229 (72%) | 228 | 70 | 19 | 1 | 0 | 17.9% | 29 | 142 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 1.2 ms · p95 3 ms. Con la latenza Groq registrata: p50 1.2 ms · p95 3 ms.
IA: 156 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| richiesta-persa | 39 | 0 | 0 |
| correzione-non-applicata | 28 | 0 | 0 |
| non-applicato | 9 | 0 | 0 |
| chiarimento-mancante | 0 | 13 | 0 |
| chiede-invece-di-agire | 0 | 6 | 0 |
| risposta-non-pertinente | 0 | 0 | 1 |

