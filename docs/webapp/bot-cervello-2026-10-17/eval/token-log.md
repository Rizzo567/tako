# Banco E · consumo Groq (17/10/2026)

**Chiave**: quella del bot (`groq-key.txt`), perché `groq-key-test.txt` non esiste. Mai usata la chiave traduzioni.
**Tetto assegnato a E**: 20.000 token. **Speso: 16.905 token**, in 10 chiamate a `openai/gpt-oss-120b`, senza ricadute sul 20b.
**Fonte del conteggio**: il campo `usage` delle risposte, registrato in `tests/eval/cache/token-ledger.json`.

| Ora | Conversazione | Prompt | Totale | Latenza | Esito del modello |
|---|---|---|---|---|---|
| sonda | manuel-001, turno 1 | 1638 | 1749 | 622 ms | set_price tiramisù 6 («tojibo» ignorato) |
| sonda | manuel-001, turno 2 | 1632 | 1693 | 580 ms | clarify tra Che ne sacc / boh / pasta al ragù |
| giro 1 | anche-001 | 1628 | 1716 | 629 ms | clarify su Parmigiana |
| giro 1 | correzione-005 | 1620 | 1680 | 447 ms | clarify |
| giro 1 | ripristino-001 | 1620 | 1678 | 277 ms | clarify |
| giro 2 | multipla-001 | 1634 | 1758 | 710 ms | 3 set_price, supplì scelto da solo |
| giro 3 | scaduto-004 | 1618 | 1781 | 787 ms | read (nessun contesto) |
| giro 3 | negazione-015 | 1453 | 1695 | 673 ms | set_available pesce spada (sbagliato) + tonno 18; il server chiede un chiarimento |
| giro 3 | vocale-010 | 1417 | 1493 | 465 ms | set_price marinara 5,5 (giusto); il validatore lo scarta |
| giro 4 | anche-012 | 1619 | 1662 | 576 ms | clarify |

- **Un 429** nel giro 1, per il limite di 8k token al minuto del piano free, condiviso coi ristoranti. Il banco si è fermato da solo; nessun token speso su quella chiamata. Da allora, in `record` passano almeno 30 s tra una conversazione e l'altra (`TAKO_EVAL_GROQ_PACE_MS`).
- **Le esecuzioni in replay, off e oracolo** (6 run complete da 318 conversazioni) **sono a 0 token**.
