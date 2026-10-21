# Motore Haiku · set visibilita · replay

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T09:30:22.522Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **18/20 (90%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 1, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 1.7 (non attese 1.3) |
| Latenza chiamata Haiku p50 / p95 | 2431 / 5808 ms (26 chiamate) |
| Latenza turno p50 / p95 | 2214 / 7046 ms (harness + latenza Haiku registrata) |
| Chiamate Haiku per messaggio | 1.13 |
| Token medi per messaggio (in · out · cache read · cache write) | 155 · 418 · 9664 · 489 |
| Cache hit (cache_read > 0) | 25/26 (96.2%) |
| Costo speso in questo giro | 0 $ (tetto 0.5 $) |
| Costo equivalente dal vivo · per messaggio | 0.008792 $ · 0.000382 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 26 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 1.9 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| conferma-a-vuoto | 1 | 0 | 0 |
| visibilita-non-richiesta (sicurezza) | 1 | 0 | 0 |
| chiarimento-mancante | 0 | 1 | 0 |

## Falliti (trascrizione)

### str-v-10 [GRAVE] — Menu con piatti: prima la conferma, poi nascosto
- titolare: nascondi tutto il menu cena
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nascondo tutto il *Menu Cena*? Rispondi sì. 1. *Risotto ai funghi* (15,00 €) 2. *Tagliatelle al ragù* (13,00 €) 3. *Filetto al pepe* (24,00 €) 4. *Branzino al forno* (22,00 €) 5. *Margherita* (7,00 €)»
- titolare: sì
  - bot: «Nascondo tutto il *Menu Cena*? Rispondi sì. 1. *Risotto ai funghi* (15,00 €) 2. *Tagliatelle al ragù* (13,00 €) 3. *Filetto al pepe* (24,00 €) 4. *Branzino al forno* (22,00 €) 5. *Margherita* (7,00 €)»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** conferma-a-vuoto: turno 2: «sì» dopo una richiesta di conferma, e il bot chiede ancora conferma («Nascondo tutto il *Menu Cena*? Rispondi sì. 1. *Risotto ai funghi* (15,00 €) 2. *Tagliatel»)
- **GRAVE** visibilita-non-richiesta: dopo il turno 2: «Cena» è visibile ai clienti senza che il titolare l'abbia chiesto

### str-v-16 [MEDIO] — non esiste: una domanda
- titolare: mostra il menu della colazione
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non trovo un Menu *Colazione*. Intendi il Menu *Brunch*, che è nascosto e ancora vuoto?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

