# Motore Haiku · set parlato · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T00:55:26.258Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **29/30 (96.7%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Parlato sporco: corrette · domande giuste · GRAVI | 29 · 0 · 0 (corrette o domanda giusta 96.7%) |
| Domande ogni 10 messaggi | 0 (non attese 0) |
| Latenza chiamata Haiku p50 / p95 | 2124 / 3346 ms (31 chiamate) |
| Latenza turno p50 / p95 | 2148 / 3380 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.03 |
| Token medi per messaggio (in · out · cache read · cache write) | 61 · 243 · 7795 · 30 |
| Cache hit (cache_read > 0) | 31/31 (100%) |
| Costo speso in questo giro | 0.006276 $ (tetto 0.2 $) |
| Costo equivalente dal vivo · per messaggio | 0.006276 $ · 0.000209 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 0 · 31 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 70.4 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| nessuna-azione | 0 | 1 | 0 |

## Falliti (trascrizione)

### ps-06 [MEDIO]
- titolare: 🎤 la ghisa a dodici
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. 1. *Gricia* (11,00 €)»
- atteso: price|Gricia|12 · ottenuto: nessuna modifica
- **MEDIO** nessuna-azione: né modifica né domanda («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

