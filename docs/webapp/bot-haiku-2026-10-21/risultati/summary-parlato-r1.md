# Motore Haiku · set parlato · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T00:49:49.266Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **26/30 (86.7%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 4 |
| Parlato sporco: corrette · domande giuste · GRAVI | 26 · 0 · 0 (corrette o domanda giusta 86.7%) |
| Domande ogni 10 messaggi | 0 (non attese 0) |
| Latenza chiamata Haiku p50 / p95 | 2231 / 4265 ms (34 chiamate) |
| Latenza turno p50 / p95 | 2259 / 6731 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.13 |
| Token medi per messaggio (in · out · cache read · cache write) | 93 · 292 · 7976 · 30 |
| Cache hit (cache_read > 0) | 34/34 (100%) |
| Costo speso in questo giro | 0.007158 $ (tetto 0.15 $) |
| Costo equivalente dal vivo · per messaggio | 0.007158 $ · 0.000239 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 0 · 34 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 81.1 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| nessuna-azione | 0 | 4 | 0 |

## Falliti (trascrizione)

### ps-01 [MEDIO]
- titolare: 🎤 carbonar tredic
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. 1. *Carbonara* (12,00 €)»
- atteso: price|Carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** nessuna-azione: né modifica né domanda («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### ps-02 [MEDIO]
- titolare: 🎤 la lasagn… a dodic
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, aggiorno la *Lasagna*.»
- atteso: price|Lasagna|12 · ottenuto: nessuna modifica
- **MEDIO** nessuna-azione: né modifica né domanda («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### ps-03 [MEDIO]
- titolare: 🎤 saltimbocc… sedic
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. 1. *Saltimbocca alla romana* (15,00 €)»
- atteso: price|Saltimbocca alla romana|16 · ottenuto: nessuna modifica
- **MEDIO** nessuna-azione: né modifica né domanda («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### ps-06 [MEDIO]
- titolare: 🎤 la ghisa a dodici
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla.»
- atteso: price|Gricia|12 · ottenuto: nessuna modifica
- **MEDIO** nessuna-azione: né modifica né domanda («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

