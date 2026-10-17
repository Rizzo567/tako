# token-log · correzioni fase A (agente F, 17/10/2026)

Tetto fase A: 40.000 token, solo `groq-key-test.txt` poi `groq-key-test-2.txt`. Mai `groq-key.txt` né `groq-key-traduzioni.txt`.

| Quando | Cosa | Chiave | Token | Totale fase A |
|---|---|---|---|---|
| 17/10 18:45 | banco V base (oracolo, replay, off) | nessuna | 0 | 0 |
| 17/10 18:50–20:00 | banco V, banco E e batterie A1–A5 (oracolo, Groq giù, avversario): solo modelli finti | nessuna | 0 | 0 |
| 17/10 20:00 | A6.3 gpt-oss vero: **non eseguito**. Il registro `tests/eval/cache/token-ledger.json` dice che oggi `groq-key-test` ha già 166.114 token e `groq-key-test-2` 164.728: entrambe oltre il tetto di 150k/giorno per chiave delle REGOLE-AGENTI. Nessuna chiamata, nessuna altra chiave usata. Rimandato al gate Developer | — | 0 | 0 |

**Totale fase A: 0 token** (tetto 40.000).

Per il gate Developer (A6.3 + G1): la scheda del cervello è cambiata (riga «CASI FREQUENTI»), quindi le risposte registrate prima non valgono più (il replay V ora trova 3 risposte su 283 richieste). Comando, con la chiave indicata da Manuel:
```sh
TAKO_EVAL=1 TAKO_EVAL_GROQ=record TAKO_EVAL_GROQ_KEY_FILE=<file chiave Developer> TAKO_EVAL_GROQ_MAX_TOKENS=<tetto> TAKO_EVAL_GROQ_MAX_TOKENS_PER_KEY=<tetto> TAKO_EVAL_GROQ_PACE_MS=5000 TAKO_EVAL_OUT=fase-a-record npx vitest run tests/eval/eval-manuel-1017.test.ts
node tests/eval/fix-a-count.mjs docs/webapp/bot-cervello-2026-10-17/verifica-v/results-fase-a-record.json --list
```
Stima: 66 conversazioni V passano dal cervello, 84 chiamate × ~3,6k token ≈ 300k token.
