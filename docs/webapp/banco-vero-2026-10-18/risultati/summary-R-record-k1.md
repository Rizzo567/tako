# Banco E · R-record-k1

Generato da tests/eval (groq=record, bot=nuovo, tetto=260000, conversazioni=92).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| bv-semplici | 26 | 26 (100%) | 26 | 0 | 0 | 0 | 0 | 10% | 3 | 26 | 0 |
| bv-domande | 10 | 9 (90%) | 4 | 1 | 0 | 5 | 0 | 0% | 0 | 10 | 10 |
| bv-multiple | 9 | 0 (0%) | 0 | 9 | 0 | 0 | 0 | 0% | 0 | 9 | 9 |
| bv-correzioni | 7 | 0 (0%) | 0 | 6 | 1 | 0 | 0 | 0% | 0 | 7 | 7 |
| bv-deixis | 4 | 0 (0%) | 0 | 3 | 1 | 0 | 0 | 0% | 0 | 4 | 4 |
| bv-aggiunte | 6 | 1 (16.7%) | 1 | 4 | 1 | 0 | 0 | 0% | 0 | 6 | 6 |
| bv-elimina | 5 | 1 (20%) | 1 | 2 | 2 | 0 | 0 | 0% | 0 | 5 | 5 |
| bv-categorie | 3 | 0 (0%) | 0 | 3 | 0 | 0 | 0 | 0% | 0 | 3 | 3 |
| bv-annulla | 8 | 2 (25%) | 2 | 6 | 0 | 0 | 0 | 0% | 0 | 8 | 8 |
| bv-dialetto | 5 | 2 (40%) | 2 | 2 | 1 | 0 | 0 | 0% | 0 | 5 | 5 |
| bv-asr | 5 | 0 (0%) | 0 | 4 | 1 | 0 | 0 | 0% | 0 | 5 | 5 |
| bv-fuori | 4 | 2 (50%) | 2 | 0 | 2 | 0 | 0 | 0% | 0 | 4 | 4 |
| multi-turno | 39 | 12 (30.8%) | 9 | 26 | 1 | 3 | 0 | 3.1% | 3 | 39 | 35 |
| TOTALE | 92 | 43 (46.7%) | 38 | 40 | 9 | 5 | 0 | 2% | 3 | 92 | 66 |

Latenza harness (webhook→risposta, senza rete) p50 6.3 ms · p95 61291.3 ms. Con la latenza Groq registrata: p50 6.6 ms · p95 62323.9 ms.
IA: 45 risposte (cache o vere), 218 richieste senza risposta (Groq giù/cache assente), 115777 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 35 | 0 | 0 |
| correzione-non-applicata | 6 | 0 | 0 |
| chiarimento-mancante | 0 | 23 | 0 |
| risposta-non-pertinente | 0 | 0 | 5 |


## Metriche del confronto

```json
{
 "conversazioni": 92,
 "messaggi": 149,
 "successo": 46.7,
 "successoSemplici": 100,
 "semplici": 26,
 "domandePer10Messaggi": 0.2,
 "domandeNonAttesePer10": 0.2,
 "gravi": 40,
 "graviTotali": 41,
 "ambigue": {
  "n": 9,
  "successo": 0
 },
 "latenzaMs": {
  "p50": 6,
  "p95": 61291,
  "conGroqRegistratoTotale": 40750
 },
 "token": 115777,
 "chiamateIA": 45,
 "iaMancanti": 218
}
```
