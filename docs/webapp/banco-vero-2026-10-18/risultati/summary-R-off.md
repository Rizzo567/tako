# Banco E · R-off

Generato da tests/eval (groq=off, bot=nuovo, tetto=20000, conversazioni=92).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| bv-semplici | 26 | 6 (23.1%) | 1 | 20 | 0 | 5 | 0 | 0% | 0 | 26 | 26 |
| bv-domande | 10 | 9 (90%) | 4 | 1 | 0 | 5 | 0 | 0% | 0 | 10 | 10 |
| bv-multiple | 9 | 0 (0%) | 0 | 9 | 0 | 0 | 0 | 0% | 0 | 9 | 9 |
| bv-correzioni | 7 | 0 (0%) | 0 | 6 | 1 | 0 | 0 | 0% | 0 | 7 | 7 |
| bv-deixis | 4 | 0 (0%) | 0 | 3 | 1 | 0 | 0 | 0% | 0 | 4 | 4 |
| bv-aggiunte | 6 | 1 (16.7%) | 1 | 3 | 2 | 0 | 0 | 0% | 0 | 6 | 6 |
| bv-elimina | 5 | 0 (0%) | 0 | 3 | 2 | 0 | 0 | 0% | 0 | 5 | 5 |
| bv-categorie | 3 | 0 (0%) | 0 | 3 | 0 | 0 | 0 | 0% | 0 | 3 | 3 |
| bv-annulla | 8 | 7 (87.5%) | 7 | 1 | 0 | 0 | 0 | 0% | 0 | 8 | 8 |
| bv-dialetto | 5 | 2 (40%) | 2 | 2 | 1 | 0 | 0 | 0% | 0 | 5 | 5 |
| bv-asr | 5 | 0 (0%) | 0 | 4 | 1 | 0 | 0 | 0% | 0 | 5 | 5 |
| bv-fuori | 4 | 2 (50%) | 2 | 0 | 2 | 0 | 0 | 0% | 0 | 4 | 4 |
| multi-turno | 39 | 12 (30.8%) | 9 | 26 | 1 | 3 | 0 | 0% | 0 | 39 | 39 |
| TOTALE | 92 | 27 (29.3%) | 17 | 55 | 10 | 10 | 0 | 0% | 0 | 92 | 92 |

Latenza harness (webhook→risposta, senza rete) p50 1.1 ms · p95 2 ms. Con la latenza Groq registrata: p50 1.1 ms · p95 2 ms.
IA: 0 risposte (cache o vere), 298 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 55 | 0 | 0 |
| chiarimento-mancante | 0 | 23 | 0 |
| risposta-non-pertinente | 0 | 0 | 10 |


## Metriche del confronto

```json
{
 "conversazioni": 92,
 "messaggi": 149,
 "successo": 29.3,
 "successoSemplici": 23.1,
 "semplici": 26,
 "domandePer10Messaggi": 0,
 "domandeNonAttesePer10": 0,
 "gravi": 55,
 "graviTotali": 55,
 "ambigue": {
  "n": 9,
  "successo": 0
 },
 "latenzaMs": {
  "p50": 1,
  "p95": 2,
  "conGroqRegistratoTotale": 0
 },
 "token": 0,
 "chiamateIA": 0,
 "iaMancanti": 298
}
```
