# Motore Haiku · set notte-1022 · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T21:51:34.373Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **71/72 (98.6%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 1.9 (non attese 1) |
| Latenza chiamata Haiku p50 / p95 | 2119 / 5192 ms (113 chiamate) |
| Latenza turno p50 / p95 | 19 / 176 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.06 |
| Token medi per messaggio (in · out · cache read · cache write) | 155 · 316 · 10161 · 207 |
| Cache hit (cache_read > 0) | 112/113 (99.1%) |
| Costo speso in questo giro | 0.001706 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.032206 $ · 0.000301 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 107 · 6 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 17.1 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| in-attesa-ok | 0 | 1 | 0 |

## Falliti (trascrizione)

### n-gruppo-pizze-due-menu [MEDIO] — «Pizze» è un sottomenu in due Menu: si chiede quale
- titolare: alza le pizze di 1 euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Le *Pizze* ci sono in più Menu: in quale? *Pizze* o *Cena*?»
- titolare: quelle del menu pizze
  - bot: «Ci sto lavorando… Aumento di *1 €* le pizze del Menu Pizze. Rispondi OK per pubblicare.»
- atteso: price|Capricciosa|10, price|Diavola|9.5, price|Margherita bufala|10, price|Margherita|8 · ottenuto: nessuna modifica
- **MEDIO** in-attesa-ok: resta in attesa di OK: price|Capricciosa|10, price|Diavola|9.5, price|Margherita bufala|10, price|Margherita|8

