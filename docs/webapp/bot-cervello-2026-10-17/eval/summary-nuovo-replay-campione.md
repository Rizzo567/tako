# Banco E · nuovo-replay-campione

Generato da tests/eval (groq=replay, riferimento=attuale-oracle-n2, tetto=20000, conversazioni=38).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| anche | 3 | 2 (66.7%) | 2 | 0 | 1 | 0 | 0 | 16.7% | 1 | 3 | 0 |
| correzione | 3 | 3 (100%) | 3 | 0 | 0 | 0 | 0 | 0% | 0 | 3 | 0 |
| ripristino | 3 | 3 (100%) | 3 | 0 | 0 | 0 | 0 | 0% | 0 | 3 | 0 |
| chiarimento | 3 | 3 (100%) | 3 | 0 | 0 | 0 | 0 | 50% | 0 | 3 | 0 |
| multipla | 3 | 3 (100%) | 3 | 0 | 0 | 0 | 0 | 33.3% | 0 | 3 | 0 |
| scaduto | 3 | 3 (100%) | 3 | 0 | 0 | 0 | 0 | 33.3% | 0 | 3 | 0 |
| domanda | 3 | 3 (100%) | 3 | 0 | 0 | 0 | 0 | 0% | 0 | 3 | 0 |
| negazione | 3 | 3 (100%) | 3 | 0 | 0 | 0 | 0 | 33.3% | 1 | 3 | 0 |
| ambiguita | 3 | 2 (66.7%) | 2 | 0 | 1 | 0 | 0 | 66.7% | 0 | 3 | 1 |
| togli | 3 | 3 (100%) | 3 | 0 | 0 | 0 | 0 | 0% | 0 | 3 | 0 |
| vocale | 3 | 3 (100%) | 3 | 0 | 0 | 0 | 0 | 0% | 0 | 3 | 0 |
| qa1710 | 1 | 1 (100%) | 1 | 0 | 0 | 0 | 0 | 0% | 0 | 1 | 0 |
| manuel | 1 | 0 (0%) | 0 | 1 | 0 | 0 | 0 | 33.3% | 1 | 1 | 1 |
| batterie | 3 | 2 (66.7%) | 2 | 1 | 0 | 0 | 0 | 0% | 0 | 3 | 3 |
| multi-turno | 29 | 26 (89.7%) | 26 | 2 | 1 | 0 | 0 | 15% | 2 | 29 | 4 |
| TOTALE | 38 | 34 (89.5%) | 34 | 2 | 2 | 0 | 0 | 17.4% | 3 | 38 | 5 |

Latenza harness (webhook→risposta, senza rete) p50 2.6 ms · p95 6.5 ms. Con la latenza Groq registrata: p50 5.8 ms · p95 1551.9 ms.
IA: 37 risposte (cache o vere), 14 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| errore-generico | 2 | 0 | 0 |
| correzione-non-applicata | 1 | 0 | 0 |
| non-applicato | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 1 | 0 |
| chiarimento-mancante | 0 | 1 | 0 |

