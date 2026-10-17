# Banco E · nuovo-oracle

Generato da tests/eval (groq=oracle, riferimento=attuale-oracle, tetto=20000, conversazioni=318).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anche | 34 | 29 (85.3%) | 29 | 4 | 1 | 0 | 0 | 0% | 0 | 34 | 0 |
| correzione | 29 | 23 (79.3%) | 23 | 5 | 1 | 0 | 0 | 3.4% | 1 | 29 | 0 |
| ripristino | 24 | 18 (75%) | 18 | 6 | 0 | 0 | 1 | 2% | 1 | 13 | 0 |
| chiarimento | 31 | 30 (96.8%) | 30 | 1 | 0 | 0 | 0 | 46.2% | 0 | 9 | 0 |
| multipla | 18 | 3 (16.7%) | 3 | 13 | 2 | 0 | 1 | 16.7% | 2 | 17 | 0 |
| scaduto | 18 | 12 (66.7%) | 12 | 1 | 5 | 0 | 1 | 16.7% | 4 | 14 | 0 |
| domanda | 25 | 25 (100%) | 23 | 0 | 0 | 2 | 0 | 7.4% | 2 | 9 | 0 |
| negazione | 21 | 20 (95.2%) | 20 | 1 | 0 | 0 | 0 | 4.3% | 1 | 9 | 0 |
| ambiguita | 20 | 17 (85%) | 17 | 0 | 3 | 0 | 0 | 75% | 0 | 3 | 0 |
| togli | 17 | 16 (94.1%) | 16 | 0 | 1 | 0 | 0 | 5% | 1 | 7 | 0 |
| vocale | 32 | 26 (81.3%) | 26 | 5 | 1 | 0 | 0 | 2.9% | 1 | 23 | 0 |
| qa1710 | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 25% | 0 | 1 | 0 |
| manuel | 5 | 4 (80%) | 4 | 0 | 1 | 0 | 0 | 50% | 4 | 1 | 0 |
| batterie | 36 | 31 (86.1%) | 31 | 1 | 4 | 0 | 0 | 23.3% | 13 | 19 | 0 |
| multi-turno | 207 | 162 (78.3%) | 162 | 32 | 13 | 0 | 3 | 16.5% | 26 | 143 | 0 |
| TOTALE | 318 | 262 (82.4%) | 260 | 37 | 19 | 2 | 3 | 17% | 30 | 188 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 1.8 ms · p95 4.2 ms. Con la latenza Groq registrata: p50 1.8 ms · p95 4.2 ms.
IA: 218 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| richiesta-persa | 23 | 0 | 0 |
| correzione-non-applicata | 11 | 0 | 0 |
| non-applicato | 4 | 0 | 0 |
| fatto-falso | 3 | 0 | 0 |
| chiarimento-mancante | 0 | 19 | 0 |
| chiede-invece-di-agire | 0 | 8 | 0 |
| in-attesa-ok | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 2 |

