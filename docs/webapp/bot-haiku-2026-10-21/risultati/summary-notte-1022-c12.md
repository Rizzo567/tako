# Motore Haiku · set notte-1022 · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T23:47:00.875Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **72/73 (98.6%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 1.9 (non attese 1.1) |
| Latenza chiamata Haiku p50 / p95 | 2145 / 5192 ms (110 chiamate) |
| Latenza turno p50 / p95 | 19 / 40 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.02 |
| Token medi per messaggio (in · out · cache read · cache write) | 139 · 311 · 9801 · 201 |
| Cache hit (cache_read > 0) | 109/110 (99.1%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.031593 $ · 0.000293 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 110 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 3.8 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 1 | 0 |

## Falliti (trascrizione)

### n-nuovo-senza-prezzo [MEDIO]
- titolare: aggiungi il cacio e pepe nei primi del pranzo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. A che prezzo metto il *Cacio e pepe* nei Primi del Pranzo?»
- titolare: 11
  - bot: «Ok, *11,00 €*. In quale sottomenu metto *Cacio e pepe*? Rispondi col numero o col nome. 1. *Primi* (Pranzo) 2. *Secondi* (Pranzo) 3. *Dolci* (Pranzo) 4. *Pizze* (Pizze) 5. *Fritti* (Pizze) 6. *Pizze* (Cena)»
- atteso: create|cacio e pepe|11|primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|cacio e pepe|11|primi

