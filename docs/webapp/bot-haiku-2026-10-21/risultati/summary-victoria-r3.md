# Motore Haiku · set victoria · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T01:06:11.126Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **9/10 (90%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 2.7 (non attese 0.9) |
| Latenza chiamata Haiku p50 / p95 | 2600 / 5006 ms (13 chiamate) |
| Latenza turno p50 / p95 | 36 / 156 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.18 |
| Token medi per messaggio (in · out · cache read · cache write) | 196 · 498 · 8482 · 793 |
| Cache hit (cache_read > 0) | 12/13 (92.3%) |
| Costo speso in questo giro | 0 $ (tetto 0.2 $) |
| Costo equivalente dal vivo · per messaggio | 0.004982 $ · 0.000453 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 13 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 1.8 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| in-attesa-ok | 0 | 1 | 0 |

## Falliti (trascrizione)

### vic-01 [MEDIO] — prezzo
- titolare: la carbonara mettila a 14
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, metto *Carbonara* a 14 €. Confermi? Non ancora pubblicato, da confermare con OK: 1. *Carbonara*: prezzo da 13,00 € a *14,00 €*»
- atteso: price|Carbonara|14 · ottenuto: nessuna modifica
- **MEDIO** in-attesa-ok: resta in attesa di OK: price|Carbonara|14

