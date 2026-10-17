# Banco E · nuovo-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, tetto=20000, conversazioni=92).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| bv-semplici | 26 | 25 (96.2%) | 25 | 1 | 0 | 0 | 0 | 10% | 3 | 10 | 0 |
| bv-domande | 10 | 10 (100%) | 8 | 0 | 0 | 2 | 0 | 26.7% | 4 | 5 | 0 |
| bv-multiple | 9 | 6 (66.7%) | 6 | 1 | 2 | 0 | 0 | 31.3% | 5 | 8 | 0 |
| bv-correzioni | 7 | 4 (57.1%) | 4 | 2 | 1 | 0 | 2 | 57.1% | 2 | 4 | 0 |
| bv-deixis | 4 | 4 (100%) | 4 | 0 | 0 | 0 | 0 | 28.6% | 0 | 3 | 0 |
| bv-aggiunte | 6 | 5 (83.3%) | 5 | 0 | 1 | 0 | 0 | 44.4% | 0 | 2 | 0 |
| bv-elimina | 5 | 5 (100%) | 5 | 0 | 0 | 0 | 0 | 50% | 1 | 2 | 0 |
| bv-categorie | 3 | 2 (66.7%) | 2 | 1 | 0 | 0 | 1 | 0% | 0 | 1 | 0 |
| bv-annulla | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 5% | 1 | 7 | 0 |
| bv-dialetto | 5 | 4 (80%) | 4 | 0 | 1 | 0 | 0 | 50% | 2 | 5 | 0 |
| bv-asr | 5 | 0 (0%) | 0 | 4 | 1 | 0 | 2 | 38.5% | 5 | 5 | 0 |
| bv-fuori | 4 | 4 (100%) | 4 | 0 | 0 | 0 | 0 | 50% | 0 | 0 | 0 |
| multi-turno | 39 | 31 (79.5%) | 30 | 6 | 2 | 1 | 4 | 32.3% | 19 | 28 | 0 |
| TOTALE | 92 | 77 (83.7%) | 75 | 9 | 6 | 2 | 5 | 28.2% | 23 | 52 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 1.4 ms · p95 5.5 ms. Con la latenza Groq registrata: p50 1.4 ms · p95 5.5 ms.
IA: 60 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 4 | 0 | 0 |
| modifica-sbagliata | 3 | 0 | 0 |
| scrive-invece-di-chiedere | 2 | 0 | 0 |
| correzione-non-applicata | 2 | 0 | 0 |
| modifica-non-richiesta | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 5 | 0 |
| chiarimento-mancante | 0 | 2 | 0 |
| in-attesa-ok | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 2 |


## Metriche del confronto

```json
{
 "conversazioni": 92,
 "messaggi": 149,
 "successo": 83.7,
 "successoSemplici": 96.2,
 "semplici": 26,
 "domandePer10Messaggi": 2.8,
 "domandeNonAttesePer10": 1.5,
 "gravi": 9,
 "graviTotali": 12,
 "ambigue": {
  "n": 9,
  "successo": 55.6
 },
 "latenzaMs": {
  "p50": 1,
  "p95": 6,
  "conGroqRegistratoTotale": 0
 },
 "token": 0,
 "chiamateIA": 60,
 "iaMancanti": 0
}
```
