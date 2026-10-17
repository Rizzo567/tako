# Banco E · nuovo-off

Generato da tests/eval (groq=off, bot=nuovo, tetto=20000, conversazioni=92).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| bv-semplici | 26 | 17 (65.4%) | 16 | 9 | 0 | 1 | 0 | 23.3% | 7 | 10 | 10 |
| bv-domande | 10 | 8 (80%) | 6 | 2 | 0 | 2 | 0 | 33.3% | 5 | 5 | 5 |
| bv-multiple | 9 | 3 (33.3%) | 3 | 6 | 0 | 0 | 2 | 31.3% | 5 | 8 | 8 |
| bv-correzioni | 7 | 3 (42.9%) | 3 | 4 | 0 | 0 | 0 | 78.6% | 5 | 4 | 4 |
| bv-deixis | 4 | 1 (25%) | 1 | 3 | 0 | 0 | 0 | 57.1% | 2 | 3 | 3 |
| bv-aggiunte | 6 | 5 (83.3%) | 5 | 1 | 0 | 0 | 0 | 55.6% | 0 | 2 | 2 |
| bv-elimina | 5 | 4 (80%) | 4 | 1 | 0 | 0 | 0 | 60% | 2 | 2 | 2 |
| bv-categorie | 3 | 2 (66.7%) | 2 | 1 | 0 | 0 | 0 | 40% | 2 | 1 | 1 |
| bv-annulla | 8 | 6 (75%) | 6 | 2 | 0 | 0 | 0 | 25% | 5 | 7 | 7 |
| bv-dialetto | 5 | 2 (40%) | 2 | 2 | 1 | 0 | 0 | 16.7% | 1 | 5 | 5 |
| bv-asr | 5 | 1 (20%) | 1 | 4 | 0 | 0 | 1 | 61.5% | 6 | 5 | 5 |
| bv-fuori | 4 | 4 (100%) | 4 | 0 | 0 | 0 | 0 | 50% | 0 | 0 | 0 |
| multi-turno | 39 | 22 (56.4%) | 21 | 17 | 0 | 1 | 3 | 44.8% | 31 | 28 | 28 |
| TOTALE | 92 | 56 (60.9%) | 53 | 35 | 1 | 3 | 3 | 40.9% | 40 | 52 | 52 |

Latenza harness (webhook→risposta, senza rete) p50 1.6 ms · p95 4.7 ms. Con la latenza Groq registrata: p50 1.6 ms · p95 4.7 ms.
IA: 0 risposte (cache o vere), 214 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| errore-generico | 28 | 0 | 0 |
| non-applicato | 9 | 0 | 0 |
| correzione-non-applicata | 4 | 0 | 0 |
| modifica-non-richiesta | 2 | 0 | 0 |
| modifica-sbagliata | 2 | 0 | 0 |
| scrive-invece-di-chiedere | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 17 | 0 |
| chiarimento-mancante | 0 | 1 | 0 |
| risposta-non-pertinente | 0 | 0 | 7 |


## Metriche del confronto

```json
{
 "conversazioni": 92,
 "messaggi": 149,
 "successo": 60.9,
 "successoSemplici": 65.4,
 "semplici": 26,
 "domandePer10Messaggi": 4.1,
 "domandeNonAttesePer10": 2.7,
 "gravi": 35,
 "graviTotali": 46,
 "ambigue": {
  "n": 9,
  "successo": 44.4
 },
 "latenzaMs": {
  "p50": 2,
  "p95": 5,
  "conGroqRegistratoTotale": 0
 },
 "token": 0,
 "chiamateIA": 0,
 "iaMancanti": 214
}
```
