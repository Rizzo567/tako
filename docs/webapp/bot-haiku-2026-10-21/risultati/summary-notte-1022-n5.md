# Motore Haiku · set notte-1022 · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T21:48:21.944Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **70/72 (97.2%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 0, altri 1 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 1.9 (non attese 1.1) |
| Latenza chiamata Haiku p50 / p95 | 2122 / 5197 ms (115 chiamate) |
| Latenza turno p50 / p95 | 19 / 83 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.07 |
| Token medi per messaggio (in · out · cache read · cache write) | 160 · 324 · 10350 · 201 |
| Cache hit (cache_read > 0) | 114/115 (99.1%) |
| Costo speso in questo giro | 0.000918 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.03283 $ · 0.000307 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 111 · 4 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 11.1 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| testo-non-richiesto | 1 | 0 | 0 |
| chiarimento-mancante | 0 | 1 | 0 |
| in-attesa-ok | 0 | 1 | 0 |

## Falliti (trascrizione)

### n-annulla-lascia-stare [GRAVE]
- titolare: aggiungi la burrata nei fritti
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. A quanto la metto, la *Burrata*?»
- titolare: lascia stare
  - bot: «Per «lascia stare» mi manca un dettaglio: qual è il nome esatto del piatto (o del sottomenu) e cosa devo cambiare? Per esempio «la carbonara a 12».»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** testo-non-richiesto: turno 2: contiene /\?/

### n-gruppo-pizze-due-menu [MEDIO] — «Pizze» è un sottomenu in due Menu: si chiede quale
- titolare: alza le pizze di 1 euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Alzo di 1 euro Margherita, Margherita bufala, Diavola, Capricciosa e Marinara. Anche *Napoli* la alzo? Non ancora pubblicato, da confermare con OK: 1. *Margherita*: prezzo da 7,00 € a *8,00 €* 2. *Margherita bufala*: prezzo da 9,00 € a *10,00 €* 3. *Diavola*: prezzo da 8,50 € a *9,50 €* 4. *Capricciosa*: prez»
- titolare: quelle del menu pizze
  - bot: «Alzo di 1 euro *Margherita*, *Margherita bufala*, *Diavola* e *Capricciosa* del Menu pizze? Rispondi OK per confermare. 1. *Margherita* (7,00 €) 2. *Margherita bufala* (9,00 €) 3. *Diavola* (8,50 €) 4. *Capricciosa* (9,00 €)»
- atteso: price|Capricciosa|10, price|Diavola|9.5, price|Margherita bufala|10, price|Margherita|8 · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
- **MEDIO** in-attesa-ok: resta in attesa di OK: price|Capricciosa|10, price|Diavola|9.5, price|Margherita bufala|10, price|Margherita|8

