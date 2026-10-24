# Motore Haiku · set notte-1022 · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T23:49:37.975Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **72/73 (98.6%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 1.9 (non attese 1.1) |
| Latenza chiamata Haiku p50 / p95 | 2142 / 5192 ms (109 chiamate) |
| Latenza turno p50 / p95 | 18 / 39 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.01 |
| Token medi per messaggio (in · out · cache read · cache write) | 137 · 304 · 9710 · 201 |
| Cache hit (cache_read > 0) | 108/109 (99.1%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.031114 $ · 0.000288 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 109 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 3.8 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 1 | 0 |

## Falliti (trascrizione)

### n-nuovo-cambio-argomento [MEDIO]
- titolare: aggiungi il cacio e pepe nei primi del pranzo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. A che prezzo metto il *Cacio e pepe* nei Primi del Pranzo?»
- titolare: ah la coca mettila a 4
  - bot: «A che prezzo metto *Cacio e pepe* in *Primi*? Scrivimi per esempio «cacio e pepe 12».»
- atteso: price|Coca Cola|4 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Coca Cola|4

