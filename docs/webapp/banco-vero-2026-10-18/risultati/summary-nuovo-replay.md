# Banco E · nuovo-replay

Generato da tests/eval (groq=replay, bot=nuovo, tetto=20000, conversazioni=92).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| bv-semplici | 26 | 26 (100%) | 26 | 0 | 0 | 0 | 0 | 10% | 3 | 26 | 0 |
| bv-domande | 10 | 10 (100%) | 7 | 0 | 0 | 3 | 0 | 26.7% | 4 | 10 | 1 |
| bv-multiple | 9 | 3 (33.3%) | 3 | 5 | 1 | 0 | 0 | 37.5% | 6 | 9 | 5 |
| bv-correzioni | 7 | 0 (0%) | 0 | 6 | 1 | 0 | 0 | 0% | 0 | 7 | 7 |
| bv-deixis | 4 | 0 (0%) | 0 | 3 | 1 | 0 | 0 | 0% | 0 | 4 | 4 |
| bv-aggiunte | 6 | 1 (16.7%) | 1 | 3 | 2 | 0 | 0 | 0% | 0 | 6 | 6 |
| bv-elimina | 5 | 1 (20%) | 1 | 2 | 2 | 0 | 0 | 0% | 0 | 5 | 5 |
| bv-categorie | 3 | 0 (0%) | 0 | 3 | 0 | 0 | 0 | 0% | 0 | 3 | 3 |
| bv-annulla | 8 | 2 (25%) | 2 | 6 | 0 | 0 | 0 | 0% | 0 | 8 | 8 |
| bv-dialetto | 5 | 2 (40%) | 2 | 2 | 1 | 0 | 0 | 0% | 0 | 5 | 5 |
| bv-asr | 5 | 0 (0%) | 0 | 4 | 1 | 0 | 0 | 0% | 0 | 5 | 5 |
| bv-fuori | 4 | 2 (50%) | 2 | 0 | 2 | 0 | 0 | 0% | 0 | 4 | 4 |
| multi-turno | 39 | 13 (33.3%) | 11 | 24 | 2 | 2 | 0 | 12.5% | 12 | 39 | 30 |
| TOTALE | 92 | 47 (51.1%) | 44 | 34 | 11 | 3 | 0 | 8.7% | 13 | 92 | 53 |

Latenza harness (webhook→risposta, senza rete) p50 1.4 ms · p95 5.4 ms. Con la latenza Groq registrata: p50 1.8 ms · p95 2396.4 ms.
IA: 79 risposte (cache o vere), 172 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 29 | 0 | 0 |
| correzione-non-applicata | 6 | 0 | 0 |
| chiarimento-mancante | 0 | 22 | 0 |
| chiede-invece-di-agire | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 3 |


## Metriche del confronto

```json
{
 "conversazioni": 92,
 "messaggi": 149,
 "successo": 51.1,
 "successoSemplici": 100,
 "semplici": 26,
 "domandePer10Messaggi": 0.9,
 "domandeNonAttesePer10": 0.9,
 "gravi": 34,
 "graviTotali": 35,
 "ambigue": {
  "n": 8,
  "successo": 0
 },
 "latenzaMs": {
  "p50": 1,
  "p95": 5,
  "conGroqRegistratoTotale": 78672
 },
 "token": 0,
 "chiamateIA": 79,
 "iaMancanti": 172
}
```
