# Banco E · nuovo-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, tetto=20000, conversazioni=92).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| bv-semplici | 26 | 26 (100%) | 26 | 0 | 0 | 0 | 0 | 6.7% | 2 | 26 | 0 |
| bv-domande | 10 | 10 (100%) | 7 | 0 | 0 | 3 | 0 | 33.3% | 5 | 10 | 0 |
| bv-multiple | 9 | 6 (66.7%) | 6 | 0 | 3 | 0 | 0 | 37.5% | 6 | 9 | 0 |
| bv-correzioni | 7 | 3 (42.9%) | 3 | 0 | 4 | 0 | 0 | 71.4% | 6 | 7 | 0 |
| bv-deixis | 4 | 3 (75%) | 3 | 0 | 1 | 0 | 0 | 42.9% | 1 | 4 | 0 |
| bv-aggiunte | 6 | 6 (100%) | 6 | 0 | 0 | 0 | 0 | 66.7% | 1 | 6 | 0 |
| bv-elimina | 5 | 5 (100%) | 5 | 0 | 0 | 0 | 0 | 40% | 0 | 5 | 0 |
| bv-categorie | 3 | 2 (66.7%) | 2 | 0 | 1 | 0 | 0 | 40% | 2 | 3 | 0 |
| bv-annulla | 8 | 8 (100%) | 8 | 0 | 0 | 0 | 0 | 5% | 1 | 8 | 0 |
| bv-dialetto | 5 | 4 (80%) | 4 | 0 | 1 | 0 | 0 | 83.3% | 4 | 5 | 0 |
| bv-asr | 5 | 3 (60%) | 3 | 0 | 2 | 0 | 0 | 69.2% | 7 | 5 | 0 |
| bv-fuori | 4 | 4 (100%) | 4 | 0 | 0 | 0 | 0 | 75% | 1 | 4 | 0 |
| multi-turno | 39 | 31 (79.5%) | 30 | 0 | 8 | 1 | 0 | 39.6% | 27 | 39 | 0 |
| TOTALE | 92 | 80 (87%) | 77 | 0 | 12 | 3 | 0 | 37.6% | 36 | 92 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 2.6 ms · p95 5.5 ms. Con la latenza Groq registrata: p50 2.6 ms · p95 5.5 ms.
IA: 168 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 12 | 0 |
| chiarimento-mancante | 0 | 2 | 0 |
| risposta-non-pertinente | 0 | 0 | 3 |


## Metriche del confronto

```json
{
 "conversazioni": 92,
 "messaggi": 149,
 "successo": 87,
 "successoSemplici": 100,
 "semplici": 26,
 "domandePer10Messaggi": 3.8,
 "domandeNonAttesePer10": 2.4,
 "gravi": 0,
 "graviTotali": 0,
 "ambigue": {
  "n": 8,
  "successo": 100
 },
 "latenzaMs": {
  "p50": 3,
  "p95": 6,
  "conGroqRegistratoTotale": 0
 },
 "token": 0,
 "chiamateIA": 168,
 "iaMancanti": 0
}
```
