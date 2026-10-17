# Banco E · nuovo-record

Generato da tests/eval (groq=record, riferimento=attuale-oracle-n2, tetto=320000, conversazioni=38).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anche | 3 | 3 (100%) | 3 | 0 | 0 | 0 | 0 | 0% | 0 | 3 | 0 |
| correzione | 3 | 1 (33.3%) | 1 | 2 | 0 | 0 | 0 | 0% | 0 | 3 | 1 |
| ripristino | 3 | 2 (66.7%) | 2 | 1 | 0 | 0 | 0 | 0% | 0 | 3 | 0 |
| chiarimento | 3 | 1 (33.3%) | 1 | 1 | 1 | 0 | 0 | 33.3% | 0 | 3 | 0 |
| multipla | 3 | 1 (33.3%) | 1 | 2 | 0 | 0 | 0 | 33.3% | 0 | 3 | 1 |
| scaduto | 3 | 1 (33.3%) | 1 | 0 | 2 | 0 | 0 | 33.3% | 1 | 3 | 0 |
| domanda | 3 | 3 (100%) | 3 | 0 | 0 | 0 | 0 | 0% | 0 | 3 | 0 |
| negazione | 3 | 3 (100%) | 3 | 0 | 0 | 0 | 0 | 33.3% | 1 | 3 | 0 |
| ambiguita | 3 | 1 (33.3%) | 1 | 0 | 2 | 0 | 0 | 33.3% | 0 | 3 | 0 |
| togli | 3 | 3 (100%) | 3 | 0 | 0 | 0 | 0 | 0% | 0 | 3 | 0 |
| vocale | 3 | 1 (33.3%) | 1 | 1 | 1 | 0 | 0 | 20% | 1 | 3 | 0 |
| qa1710 | 1 | 1 (100%) | 1 | 0 | 0 | 0 | 0 | 0% | 0 | 1 | 0 |
| manuel | 1 | 1 (100%) | 1 | 0 | 0 | 0 | 0 | 33.3% | 1 | 1 | 0 |
| batterie | 3 | 3 (100%) | 3 | 0 | 0 | 0 | 0 | 0% | 0 | 3 | 0 |
| multi-turno | 29 | 18 (62.1%) | 18 | 7 | 4 | 0 | 0 | 13.3% | 3 | 29 | 2 |
| TOTALE | 38 | 25 (65.8%) | 25 | 7 | 6 | 0 | 0 | 14.5% | 4 | 38 | 2 |

Latenza harness (webhook→risposta, senza rete) p50 620.8 ms · p95 1203.4 ms. Con la latenza Groq registrata: p50 1085.2 ms · p95 2644.7 ms.
IA: 44 risposte (cache o vere), 3 richieste senza risposta (Groq giù/cache assente), 151619 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| richiesta-persa | 4 | 0 | 0 |
| correzione-non-applicata | 3 | 0 | 0 |
| chiarimento-mancante | 0 | 4 | 0 |
| chiede-invece-di-agire | 0 | 2 | 0 |
| opzioni-non-leggibili | 0 | 1 | 0 |

