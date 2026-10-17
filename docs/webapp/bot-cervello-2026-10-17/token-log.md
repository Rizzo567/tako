# Consumo token Groq · perimetro Q (17/10/2026)

Tetto assegnato: 10.000 token. Chiave: `groq-key.txt` (bot), perché `groq-key-test.txt` non esiste. Mai la chiave delle traduzioni.

| Ora | Cosa | Chiamate | Token | Totale |
|---|---|---|---|---|
| 17/10 pomeriggio | Gate Groq in locale, sola lettura, 5 frasi con «togli» (`live-Q/groq-gate-q.mts`, esito `live-Q/groq-gate-q-result.json`) | 5 chat gpt-oss-120b | 6.369 | 6.369 |
| 17/10 | Batterie round1–6, 6b, unità: modello finto | 0 | 0 | 6.369 |
| 17/10 | Verifica dal vivo sul QA: solo sequenze deterministiche (nessuna chiamata all'IA, nessun vocale) | 0 | 0 | 6.369 |

Stima prima del gate: 5 × ≈1,3k = 6,5k. Usati 6.369, sotto il tetto di 10k. Whisper: il `prompt` con i nomi del locale non usa token LLM.

## N (cervello)

| quando | agente | caso | modello | prompt | in cache | completion | latenza | chiave |
|---|---|---|---|---|---|---|---|---|
| 2026-10-17T12:08:00.518Z | N | stesso-prezzo | openai/gpt-oss-120b | 3067 | 0 | 302 | 1114 ms | chiave bot |
| 2026-10-17T12:08:08.054Z | N | domanda | openai/gpt-oss-120b | 3053 | 0 | 157 | 798 ms | chiave bot |
| 2026-10-17T12:08:08.730Z | N | multi-turno | openai/gpt-oss-20b | 3124 | 0 | 123 | 590 ms | chiave bot |
| 2026-10-17T12:08:15.823Z | N | dialetto | openai/gpt-oss-120b | 3067 | 0 | 296 | 1053 ms | chiave bot |
| 2026-10-17T12:08:27.836Z | N | grande | - | 0 | 0 | 0 | - ms | chiave bot |
| 2026-10-17T12:11:44.581Z | N | grande | openai/gpt-oss-120b | 6285 | 0 | 553 | 1650 ms | chiave bot |
| 2026-10-17T12:11:53.409Z | N | domanda | openai/gpt-oss-20b | 3127 | 0 | 109 | 419 ms | chiave bot |

Totale N fase 1: 23.263 token (prompt+completion) su 6 chiamate riuscite, chiave del bot (nessuna groq-key-test.txt). Tetto assegnato 25.000.

## N fase 2 (17/10 sera)
| uso | chiave | token |
|---|---|---|
| banco E, record campione giro 1 (38 conversazioni) | groq-key-test | ~124.000 |
| banco E, record campione giro 2 (stesse 38, prompt nuovo) | groq-key-test (resto) + groq-key-test-2 | ~139.000 (12 richieste rifiutate a tetto per chiave) |
| totale chiavi di test oggi | test 148.043 · test-2 146.499 | 294.542 (tetto 150k per chiave rispettato) |
| verifica dal vivo v112 sul QA (4 sequenze, 2 chiamate IA) | chiave del bot (edge di produzione) | ~6.900 (tetto 12k) |
Il banco in oracolo e in replay costa 0 token. Le risposte vere sono in tests/eval/cache/groq (90 file), si riusano in replay.
