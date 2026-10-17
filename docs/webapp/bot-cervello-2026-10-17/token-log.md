# Consumo token Groq (giri reali)

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
