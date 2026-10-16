# Benchmark modelli bot WhatsApp Takomenu — 16/10/2026

Eval: 207 casi (`eval/cases.jsonl`), eseguiti 45 (15 facili/15 medi/15 difficili) per la quota Groq free. Prompt congelato `eval/prompt.md`, grader deterministico `grade.ts`. Modelli Anthropic esclusi (decisione di Manuel).

| Modello (Groq) | Esatti | Innocui | Gravi | JSON KO | p50 | p95 | $/1000 msg |
|---|---|---|---|---|---|---|---|
| **gpt-oss-120b** | **95,6 %** | 4,4 % | **0 %** | 0 % | 1,26 s | 3,44 s | **0,36** |
| gpt-oss-20b | 91,1 % | 6,7 % | 2,2 % | 2,2 % | 0,84 s | 2,15 s | 0,21 |
| qwen3.8-27b (preview) | 93,3 % | 2,2 % | 4,4 % | 0 % | 0,42 s | 1,12 s | 1,06 |

## Conclusioni
- Un modello più intelligente oggi non conviene: gli errori dei collaudi venivano da schema/merge, non dal modello. Resta gpt-oss-120b, riserva gpt-oss-20b.
- Groq FREE regge ~25–30 locali (~155 msg/giorno, 6/min); i 429 causano attese 7–120 s. Piano Developer: 10 locali ~0,5 $/mese, 50 ~2,7 $, 200 ~11 $.
- Costo 200 locali/mese a confronto: DeepSeek V4.1 Flash ~22 $, MiniMax M3 ~22 $, Gemini 3.5 Flash-Lite 36 $, Gemini 3.8 Flash 62 $, GLM-5.3 87 $, Qwen3.8-Max 121 $, Kimi K3 250 $.
- Modelli cinesi via API ufficiali: non eseguiti (chiavi assenti); comandi in `run.ts` (prova completa < 4 $ in totale). Privacy: API ufficiali DeepSeek (Cina) e Kimi (Singapore, training sui dati) da escludere per dati clienti; ok se ospitati da provider USA/UE con DPA.
- Gemini: la chiave presente (formato `AQ.`) dà 401; serve chiave AI Studio su progetto a pagamento.

## Da fare
1. Groq Developer prima del rollout (~22/10) + ZDR + DPA.
2. Contare anche l'onboarding in `tako_whatsapp_ai_usage` (oggi 284 job vs 25 registrati).
3. Valutare output a operazioni tipizzate come nel benchmark.
4. Pseudonimizzare telefoni/email prima della chiamata al modello.
