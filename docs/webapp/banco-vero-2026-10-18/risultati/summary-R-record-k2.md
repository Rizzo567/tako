# Banco E · R-record-k2

Generato da tests/eval (groq=record, bot=nuovo, tetto=260000, conversazioni=92).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| bv-semplici | 26 | 26 (100%) | 26 | 0 | 0 | 0 | 0 | 10% | 3 | 26 | 0 |
| bv-domande | 10 | 10 (100%) | 8 | 0 | 0 | 2 | 0 | 26.7% | 4 | 10 | 0 |
| bv-multiple | 9 | 2 (22.2%) | 2 | 4 | 3 | 0 | 0 | 56.3% | 9 | 9 | 4 |
| bv-correzioni | 7 | 0 (0%) | 0 | 6 | 1 | 0 | 0 | 0% | 0 | 7 | 7 |
| bv-deixis | 4 | 0 (0%) | 0 | 3 | 1 | 0 | 0 | 0% | 0 | 4 | 4 |
| bv-aggiunte | 6 | 1 (16.7%) | 1 | 3 | 2 | 0 | 0 | 0% | 0 | 6 | 6 |
| bv-elimina | 5 | 1 (20%) | 1 | 2 | 2 | 0 | 0 | 0% | 0 | 5 | 5 |
| bv-categorie | 3 | 0 (0%) | 0 | 3 | 0 | 0 | 0 | 0% | 0 | 3 | 3 |
| bv-annulla | 8 | 2 (25%) | 2 | 6 | 0 | 0 | 0 | 0% | 0 | 8 | 8 |
| bv-dialetto | 5 | 2 (40%) | 2 | 2 | 1 | 0 | 0 | 0% | 0 | 5 | 5 |
| bv-asr | 5 | 0 (0%) | 0 | 4 | 1 | 0 | 0 | 0% | 0 | 5 | 5 |
| bv-fuori | 4 | 2 (50%) | 2 | 0 | 2 | 0 | 0 | 0% | 0 | 4 | 4 |
| multi-turno | 39 | 13 (33.3%) | 12 | 22 | 4 | 1 | 0 | 15.6% | 15 | 39 | 27 |
| TOTALE | 92 | 46 (50%) | 44 | 33 | 13 | 2 | 0 | 10.7% | 16 | 92 | 51 |

Latenza harness (webhook→risposta, senza rete) p50 8 ms · p95 122457.5 ms. Con la latenza Groq registrata: p50 11.4 ms · p95 122513.7 ms.
IA: 84 risposte (cache o vere), 166 richieste senza risposta (Groq giù/cache assente), 125957 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 28 | 0 | 0 |
| correzione-non-applicata | 6 | 0 | 0 |
| chiarimento-mancante | 0 | 22 | 0 |
| chiede-invece-di-agire | 0 | 3 | 0 |
| risposta-non-pertinente | 0 | 0 | 2 |


## Metriche del confronto

```json
{
 "conversazioni": 92,
 "messaggi": 149,
 "successo": 50,
 "successoSemplici": 100,
 "semplici": 26,
 "domandePer10Messaggi": 1.1,
 "domandeNonAttesePer10": 1.1,
 "gravi": 33,
 "graviTotali": 34,
 "ambigue": {
  "n": 8,
  "successo": 0
 },
 "latenzaMs": {
  "p50": 8,
  "p95": 122458,
  "conGroqRegistratoTotale": 84134
 },
 "token": 125957,
 "chiamateIA": 84,
 "iaMancanti": 166
}
```
