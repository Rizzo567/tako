# Consumo token Groq · verifica V (17/10/2026)

Tetto assegnato: 40.000 token totali. Chiavi: solo `groq-key-test.txt` e, al 429, `groq-key-test-2.txt`. Mai `groq-key.txt` né `groq-key-traduzioni.txt`. Nessuna chiave stampata o scritta.

| Ora (locale) | Cosa | Chiamate registrate | Token | Chiave |
|---|---|---|---|---|
| 17/10 sera | Banco V in `oracle` e `off` (143 conversazioni, tre giri) | 0 | 0 | — |
| 17/10 sera | `record` su 11 conversazioni scelte (`results-nuovo-record.json`): 11 risposte vere, 1 risposta 429 (passaggio a test-2), 2 conversazioni finite nella riserva per errore HTTP | 11 | 32.837 | test 14.608 · test-2 18.229 |
| 17/10 sera | `record` su v-deixis-013 (`results-nuovo-record-2.json`) | 1 | 3.463 | test-2 |
| **Totale** | | **12** | **36.300** | sotto il tetto di 40.000 |

Stima prima: 3,1–3,5k token per chiamata del cervello. Le 87 chiamate del cervello nell'intero set sarebbero costate circa 300k token: per questo il resto è misurato in modo deterministico o resta «non verificato con gpt-oss» (vedi VERIFICA-V.md). Le risposte vere sono in `tests/eval/cache/groq/`, quindi il replay costa 0 token.
