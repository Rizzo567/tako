# Motore Haiku · set notte-1022 · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T22:50:42.268Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **72/73 (98.6%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 1.9 (non attese 1.1) |
| Latenza chiamata Haiku p50 / p95 | 2142 / 5192 ms (113 chiamate) |
| Latenza turno p50 / p95 | 19 / 42 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.05 |
| Token medi per messaggio (in · out · cache read · cache write) | 152 · 317 · 10067 · 205 |
| Cache hit (cache_read > 0) | 112/113 (99.1%) |
| Costo speso in questo giro | 0.000369 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.032416 $ · 0.0003 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 112 · 1 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 6.7 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 1 | 0 |

## Falliti (trascrizione)

### n-refusi [MEDIO] — «cotolleta» può valere una domanda tra le due cotolette
- titolare: amatriciàna a 11,50 e la cotolleta a 15
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi *Cotoletta* o *Cotoletta alla bolognese*? Intanto aggiorno *Amatriciana* a 11,50 €. Non ancora pubblicato: 1. *Amatriciana*: prezzo da 11,00 € a *11,50 €* «Cotoletta»: 1. *Cotoletta* (14,00 €) 2. *Cotoletta alla bolognese* (16,00 €)»
- atteso: price|Amatriciana|11.5, price|Cotoletta|15 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Amatriciana|11.5, price|Cotoletta|15

