# Motore Haiku · set notte-caccia · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T22:30:13.998Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **62/63 (98.4%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 2.9 (non attese 2.2) |
| Latenza chiamata Haiku p50 / p95 | 1915 / 3710 ms (179 chiamate) |
| Latenza turno p50 / p95 | 19 / 45 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.07 |
| Token medi per messaggio (in · out · cache read · cache write) | 301 · 245 · 10263 · 340 |
| Cache hit (cache_read > 0) | 177/179 (98.9%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.049695 $ · 0.000298 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 179 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 5 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 1 | 0 |

## Falliti (trascrizione)

### cc-giornata-05 [MEDIO] — piatto eliminato e poi citato: al turno 4 non deve dire che costa 14 (non c'è più); «rimetti» = ricrearlo (prezzo chiest
- titolare: elimina i rigatoni con la pajata
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Elimino *Rigatoni con la pajata* dal menu? Rispondi sì. Da eliminare, serve il tuo sì: 1. *Rigatoni con la pajata*: da eliminare»
- titolare: sì
  - bot: «Ok, elimino *Rigatoni con la pajata*. *Rigatoni con la pajata*: *eliminato* dal menu»
- titolare: il saltimbocca a 16
  - bot: «Ok, il *Saltimbocca alla romana* passa a 16 €. *Saltimbocca alla romana*: prezzo da 15,00 € a *16,00 €*»
- titolare: ❓ quanto costa la pajata?
  - bot: «Per «quanto costa la pajata?» mi manca un dettaglio: qual è il nome esatto del piatto (o del sottomenu) e cosa devo cambiare? Per esempio «la carbonara a 12».»
- titolare: rimetti i rigatoni con la pajata
  - bot: «Ti chiedo solo una cosa: quale piatto devo rimettere com'era prima? Dimmi il nome, per esempio *Saltimbocca alla romana*.»
- titolare: 14 euro nei primi
  - bot: «Per «14 euro nei primi» mi manca un dettaglio: qual è il nome esatto del piatto (o del sottomenu) e cosa devo cambiare? Per esempio «la carbonara a 12».»
- titolare: la cicoria è finita
  - bot: «Ok, segno *Cicoria ripassata* come esaurita. *Cicoria ripassata*: *finito*»
- titolare: ❓ grazie
  - bot: «Di niente! Se serve altro, dimmi pure.»
- atteso: available|Cicoria ripassata|false, create|rigatoni con la pajata|14|primi, delete|Rigatoni con la pajata, price|Saltimbocca alla romana|16 · ottenuto: available|Cicoria ripassata|false, delete|Rigatoni con la pajata, price|Saltimbocca alla romana|16
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|rigatoni con la pajata|14|primi

