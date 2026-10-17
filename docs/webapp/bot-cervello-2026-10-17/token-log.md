# Consumo token Groq · perimetro Q (17/10/2026)

Tetto assegnato: 10.000 token. Chiave: `groq-key.txt` (bot), perché `groq-key-test.txt` non esiste. Mai la chiave delle traduzioni.

| Ora | Cosa | Chiamate | Token | Totale |
|---|---|---|---|---|
| 17/10 pomeriggio | Gate Groq in locale, sola lettura, 5 frasi con «togli» (`live-Q/groq-gate-q.mts`, esito `live-Q/groq-gate-q-result.json`) | 5 chat gpt-oss-120b | 6.369 | 6.369 |
| 17/10 | Batterie round1–6, 6b, unità: modello finto | 0 | 0 | 6.369 |
| 17/10 | Verifica dal vivo sul QA: solo sequenze deterministiche (nessuna chiamata all'IA, nessun vocale) | 0 | 0 | 6.369 |

Stima prima del gate: 5 × ≈1,3k = 6,5k. Usati 6.369, sotto il tetto di 10k. Whisper: il `prompt` con i nomi del locale non usa token LLM.
