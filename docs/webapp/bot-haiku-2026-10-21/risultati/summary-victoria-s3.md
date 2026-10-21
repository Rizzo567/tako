# Motore Haiku · set victoria · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T08:28:57.366Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **9/10 (90%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 3.6 (non attese 1.8) |
| Latenza chiamata Haiku p50 / p95 | 2222 / 4847 ms (14 chiamate) |
| Latenza turno p50 / p95 | 2837 / 7201 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.27 |
| Token medi per messaggio (in · out · cache read · cache write) | 233 · 500 · 11158 · 153 |
| Cache hit (cache_read > 0) | 14/14 (100%) |
| Costo speso in questo giro | 0.003491 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.004444 $ · 0.000404 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 2 · 12 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 32.6 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 1 | 0 |
| domanda-superflua | 0 | 1 | 0 |

## Falliti (trascrizione)

### vic-10 [MEDIO] — alias attivo «la sorrentina» = Pizza Sorrentina → nessuna domanda
- titolare: 🎤 la sorrentina finita
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi *Gnocchi alla sorrentina* o *Pizza Sorrentina*? 1. *Gnocchi alla sorrentina* (11,00 €) 2. *Pizza Sorrentina* (9,00 €)»
- atteso: available|Pizza Sorrentina|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Pizza Sorrentina|false
- **MEDIO** domanda-superflua: turno 1: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »

