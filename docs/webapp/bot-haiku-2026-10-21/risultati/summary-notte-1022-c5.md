# Motore Haiku · set notte-1022 · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T22:57:18.531Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **72/73 (98.6%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 1.9 (non attese 1.1) |
| Latenza chiamata Haiku p50 / p95 | 2142 / 5469 ms (112 chiamate) |
| Latenza turno p50 / p95 | 19 / 41 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.04 |
| Token medi per messaggio (in · out · cache read · cache write) | 148 · 325 · 9896 · 287 |
| Cache hit (cache_read > 0) | 110/112 (98.2%) |
| Costo speso in questo giro | 0.002436 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.033705 $ · 0.000312 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 110 · 2 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 15.5 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 1 | 0 |

## Falliti (trascrizione)

### n-gruppo-pizze-due-menu [MEDIO] — «Pizze» è un sottomenu in due Menu: si chiede quale
- titolare: alza le pizze di 1 euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi *Acqua* a *1,00 €* (adesso 2,00 €)? Rispondi *sì* oppure dimmi il piatto e il prezzo giusti.»
- titolare: quelle del menu pizze
  - bot: «Ci sto lavorando… Per «quelle del menu pizze» a quale piatto ti riferisci? Rispondi col numero. 1. *Margherita* (7,00 €) 2. *Margherita bufala* (9,00 €) 3. *Diavola* (8,50 €) 4. *Capricciosa* (9,00 €)»
- atteso: price|Capricciosa|10, price|Diavola|9.5, price|Margherita bufala|10, price|Margherita|8 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Capricciosa|10, price|Diavola|9.5, price|Margherita bufala|10, price|Margherita|8

