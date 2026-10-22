# COSTI — Anthropic, run 21/10/2026 (tetto 3,00 $)

Prezzi Haiku 5.5 (skill claude-api, cache 06/10/2026): input 0,10 $/M · output 0,50 $/M (prompt ≤ 100k) · cache read 0,01 $/M · cache write 0,125 $/M · cache minima 512 token.

| Quando | Cosa | Chiamate | In | Out | Cache read | $ |
|---|---|---|---|---|---|---|
| 20/10–21/10 00:55 | prove main thread (P1, A0 schema test) | ~3 | — | — | — | ~0,001 |
| 21/10 01:05 | A0 schema vero | 1 | 1.802 | 207 | 0 | 0,0003 |
| 21/10 02:41–03:26 | giri Haiku (victoria, banco, parlato, playground ×5; avversario 150; debug) — dettaglio in `tests/eval/cache/anthropic/ledger.json` (33 giri) | ~1.600 | — | — | ~99% hit | 0,2214 |
| **Totale notte** | | | | | | **~0,223 $** (tetto 3,00 $) |

Costo per messaggio misurato: ~0,0003 $ (cache read ~8–9k token per chiamata, 1,2 chiamate/messaggio). 500 msg/mese ≈ 0,15 $ ≈ 0,14 € per locale (senza cache, caso peggiore, ≈ 0,50 €). Nessun deploy → collaudo QA 0 $.

| 22/10 23:11–07:00 | run notturna caccia ai bug (5 set nuovi, ~60 giri di regressione; prove dal vivo QA ~800 msg fuori registro) | — | — | — | ~99% hit | ~0,99 (registro 1,78 → 2,77 $; tetto notte 8 $) |
