# Motore Haiku · set notte-caccia · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-22T00:39:55.167Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **115/116 (99.1%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 2.9 (non attese 2.3) |
| Latenza chiamata Haiku p50 / p95 | 2004 / 4495 ms (274 chiamate) |
| Latenza turno p50 / p95 | 18 / 36 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.02 |
| Token medi per messaggio (in · out · cache read · cache write) | 238 · 280 · 9755 · 316 |
| Cache hit (cache_read > 0) | 271/274 (98.9%) |
| Costo speso in questo giro | 0.001101 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.080949 $ · 0.000301 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 271 · 3 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 16.1 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 1 | 0 |

## Falliti (trascrizione)

### cc-qv-03 [MEDIO] — Primi in due Menu: vale quello alla carta visibile (Menu di verifica), il fisso no
- titolare: aggiungi la frittatina
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi aggiungere una nuova *Frittatina* o una delle frittate già nel menu?»
- titolare: 3,50
  - bot: «Ci sto lavorando… In quale Sottomenu metto la *Frittatina* a 3,50 €?»
- titolare: nei primi
  - bot: «A che prezzo metto *Frittatina* in *Primi*? Scrivimi per esempio «frittatina 12».»
- atteso: create|frittatina|3.5|primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|frittatina|3.5|primi

