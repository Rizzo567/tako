# Banco E · R-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, tetto=20000, conversazioni=92).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| bv-semplici | 26 | 25 (96.2%) | 25 | 1 | 0 | 0 | 0 | 6.7% | 2 | 26 | 0 |
| bv-domande | 10 | 10 (100%) | 7 | 0 | 0 | 3 | 0 | 33.3% | 5 | 10 | 0 |
| bv-multiple | 9 | 4 (44.4%) | 4 | 1 | 4 | 0 | 0 | 50% | 8 | 9 | 0 |
| bv-correzioni | 7 | 3 (42.9%) | 3 | 0 | 4 | 0 | 0 | 71.4% | 6 | 7 | 0 |
| bv-deixis | 4 | 1 (25%) | 1 | 1 | 2 | 0 | 0 | 71.4% | 3 | 4 | 0 |
| bv-aggiunte | 6 | 5 (83.3%) | 5 | 1 | 0 | 0 | 1 | 55.6% | 1 | 6 | 0 |
| bv-elimina | 5 | 5 (100%) | 5 | 0 | 0 | 0 | 0 | 40% | 0 | 5 | 0 |
| bv-categorie | 3 | 2 (66.7%) | 2 | 1 | 0 | 0 | 1 | 0% | 0 | 3 | 0 |
| bv-annulla | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 5% | 1 | 8 | 0 |
| bv-dialetto | 5 | 4 (80%) | 4 | 0 | 1 | 0 | 0 | 83.3% | 4 | 5 | 0 |
| bv-asr | 5 | 1 (20%) | 1 | 3 | 1 | 0 | 2 | 61.5% | 7 | 5 | 0 |
| bv-fuori | 4 | 4 (100%) | 4 | 0 | 0 | 0 | 0 | 75% | 1 | 4 | 0 |
| multi-turno | 39 | 27 (69.2%) | 26 | 5 | 7 | 1 | 2 | 39.6% | 28 | 39 | 0 |
| TOTALE | 92 | 72 (78.3%) | 69 | 8 | 12 | 3 | 4 | 37.6% | 38 | 92 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 2.4 ms · p95 4.8 ms. Con la latenza Groq registrata: p50 2.4 ms · p95 4.8 ms.
IA: 168 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 4 | 0 | 0 |
| modifica-sbagliata | 2 | 0 | 0 |
| scrive-invece-di-chiedere | 2 | 0 | 0 |
| modifica-non-richiesta | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 12 | 0 |
| chiarimento-mancante | 0 | 3 | 0 |
| in-attesa-ok | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 3 |


## Metriche del confronto

```json
{
 "conversazioni": 92,
 "messaggi": 149,
 "successo": 78.3,
 "successoSemplici": 96.2,
 "semplici": 26,
 "domandePer10Messaggi": 3.8,
 "domandeNonAttesePer10": 2.6,
 "gravi": 8,
 "graviTotali": 9,
 "ambigue": {
  "n": 9,
  "successo": 66.7
 },
 "latenzaMs": {
  "p50": 2,
  "p95": 5,
  "conGroqRegistratoTotale": 0
 },
 "token": 0,
 "chiamateIA": 168,
 "iaMancanti": 0
}
```
