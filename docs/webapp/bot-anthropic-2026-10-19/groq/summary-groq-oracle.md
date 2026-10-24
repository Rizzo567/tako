# Banco E · groq-oracle

Generato da tests/eval (groq=oracle, bot=nuovo, tetto=20000, conversazioni=122).

| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |
|---|---|---|---|---|---|---|---|---|---|---|---|
| bv-semplici | 56 | 49 (87.5%) | 47 | 3 | 4 | 2 | 1 | 21.4% | 9 | 56 | 0 |
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
| multi-turno | 48 | 37 (77.1%) | 36 | 2 | 9 | 1 | 0 | 38.3% | 29 | 48 | 0 |
| TOTALE | 122 | 103 (84.4%) | 98 | 3 | 16 | 5 | 1 | 36.5% | 43 | 122 | 0 |

Latenza harness (webhook→risposta, senza rete) p50 12.8 ms · p95 29.4 ms. Con la latenza Groq registrata: p50 12.8 ms · p95 29.4 ms.
IA: 214 risposte (cache o vere), 0 richieste senza risposta (Groq giù/cache assente), 0 token veri spesi in questo giro.

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| correzione-non-applicata | 1 | 0 | 0 |
| non-applicato | 1 | 0 | 0 |
| scrittura-su-domanda | 1 | 0 | 0 |
| modifica-non-richiesta | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 17 | 0 |
| chiarimento-mancante | 0 | 2 | 0 |
| risposta-non-pertinente | 0 | 0 | 5 |


## Metriche Groq 122

```json
{
 "motore": "nuovo (fase R, Groq gpt-oss)",
 "groq": "oracle",
 "giorno": "2026-10-19T18:04:45.970Z",
 "totale": {
  "n": 122,
  "ok": 103,
  "successo": 84.4,
  "messaggi": 189,
  "conGRAVI": 3,
  "graviTotali": 4,
  "conGRAVIsicurezza": 1,
  "graviSicurezzaTotali": 2,
  "idGRAVIsicurezza": [
   "x-024"
  ],
  "domandePer10Messaggi": 3.7,
  "conIAmancante": 0
 },
 "bancoVero92": {
  "n": 92,
  "ok": 80,
  "successo": 87,
  "messaggi": 149,
  "conGRAVI": 0,
  "graviTotali": 0,
  "conGRAVIsicurezza": 0,
  "graviSicurezzaTotali": 0,
  "idGRAVIsicurezza": [],
  "domandePer10Messaggi": 3.8,
  "conIAmancante": 0
 },
 "nuove30": {
  "n": 30,
  "ok": 23,
  "successo": 76.7,
  "messaggi": 40,
  "conGRAVI": 3,
  "graviTotali": 4,
  "conGRAVIsicurezza": 1,
  "graviSicurezzaTotali": 2,
  "idGRAVIsicurezza": [
   "x-024"
  ],
  "domandePer10Messaggi": 3.3,
  "conIAmancante": 0
 },
 "sempliciBancoVero": {
  "n": 26,
  "ok": 26,
  "successo": 100,
  "messaggi": 30,
  "conGRAVI": 0,
  "graviTotali": 0,
  "conGRAVIsicurezza": 0,
  "graviSicurezzaTotali": 0,
  "idGRAVIsicurezza": [],
  "domandePer10Messaggi": 0.7,
  "conIAmancante": 0
 },
 "sempliciTutte": {
  "n": 56,
  "ok": 49,
  "successo": 87.5,
  "messaggi": 70,
  "conGRAVI": 3,
  "graviTotali": 4,
  "conGRAVIsicurezza": 1,
  "graviSicurezzaTotali": 2,
  "idGRAVIsicurezza": [
   "x-024"
  ],
  "domandePer10Messaggi": 2.1,
  "conIAmancante": 0
 },
 "latenzaStimataTurnoMs": {
  "p50": 13,
  "p95": 29,
  "turni": 189,
  "nota": "harness + recordedLlmMs per turno; significativa in replay"
 },
 "token": {
  "usageTotali": 0,
  "usagePrompt": 0,
  "usageCompletion": 0,
  "spesiInQuestoGiro": 0,
  "perChiave": {}
 },
 "chiamateIA": {
  "risposte": 214,
  "dallaCache": 0,
  "registrateOra": 0,
  "oracolo": 214,
  "senzaRisposta": 0,
  "rifiutatePerTetto": 0,
  "risposte429": 0,
  "fileCachePrima": 181,
  "fileCacheDopo": 181
 },
 "conversazioniConIAmancante": []
}
```
