# Motore Haiku · set parlato · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T12:37:53.876Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **29/30 (96.7%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Parlato sporco: corrette · domande giuste · GRAVI | 29 · 0 · 0 (corrette o domanda giusta 96.7%) |
| Domande ogni 10 messaggi | 0.3 (non attese 0.3) |
| Latenza chiamata Haiku p50 / p95 | 1638 / 3310 ms (31 chiamate) |
| Latenza turno p50 / p95 | 34 / 124 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.03 |
| Token medi per messaggio (in · out · cache read · cache write) | 61 · 227 · 9307 · 33 |
| Cache hit (cache_read > 0) | 31/31 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.006509 $ · 0.000217 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 31 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 2.8 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| domanda-sbagliata | 0 | 1 | 0 |

## Falliti (trascrizione)

### ps-06 [MEDIO]
- titolare: 🎤 la ghisa a dodici
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi con *la ghisa*? Dimmi il nome e il prezzo che vuoi.»
- atteso: price|Gricia|12 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina gricia

