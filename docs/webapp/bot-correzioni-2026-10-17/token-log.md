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

## Fase R (agente R, 17/10 notte)

| Quando | Cosa | Chiave | Token |
|---|---|---|---|
| 17/10 22:00–23:40 | tutte le batterie (fix-a, fix-b, X, Y, V, banco E) × oracolo/Groq giù/avversario, test R: solo modelli finti | nessuna | 0 |
| 17/10 23:20 | R5.2 campione gpt-oss: **non eseguito**. Registro: `groq-key-test` 166.114, `groq-key-test-2` 164.728 token oggi, oltre il tetto di 150k/giorno per chiave. Rimandato al gate Developer | — | 0 |

**Totale fase R: 0 token** (tetto 40.000).

## Fase R5.2 (agente R2, 18/10 02:09–03:50) — gpt-oss-120b vero sul banco vero

Tetto: 130k token per chiave (quota free ~200k/giorno), mai `groq-key.txt` né `groq-key-traduzioni.txt`. Stima prima: scheda+menu+cronologia ≈ 3,5k token per chiamata → 168 chiamate (oracolo) ≈ 600k: il banco intero NON entra in 260k; ordine di registrazione = ordine delle famiglie (semplici, domande, multiple…). Limite al minuto rispettato prima della chiamata (finestra 60 s, 7k/min ⇒ ~1 chiamata al minuto). Nessun 429.

| Quando | Cosa | Chiave | Chiamate | Token (usage) |
|---|---|---|---|---|
| 02:08 | sonda bv-semplici-001 | test | 3 | 11.039 |
| 02:09–02:43 | banco vero, record dall'inizio | test | 32 | 115.777 |
| 02:45–03:50 | banco vero, stesso giro (replay del già registrato + nuovo) | test-2 | 33 | 125.957 |

**Totale: 252.773 token (test 126.816, test-2 125.957).** Media 3.632 token per chiamata, 4.843 per conversazione. Entrambe le chiavi al tetto: STOP. Misurate col modello vero 41/92 conversazioni (tutte le semplici e le domande, 5 multiple); le altre 51 risultano «non disponibile» (nessuna risposta in cache) e NON sono misure. Mancano ~110 chiamate ≈ 400k token per finire il banco vero, più ~250k per il campione di banco E (60 conv.) e i casi Y/E: tutto al gate Developer.
