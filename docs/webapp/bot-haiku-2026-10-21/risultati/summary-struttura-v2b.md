# Motore Haiku · set struttura · replay

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T09:30:26.753Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **91/94 (96.8%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 2 — sicurezza 2, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 1.8 (non attese 0.8) |
| Latenza chiamata Haiku p50 / p95 | 2333 / 3874 ms (127 chiamate) |
| Latenza turno p50 / p95 | 2346 / 4854 ms (harness + latenza Haiku registrata) |
| Chiamate Haiku per messaggio | 1.07 |
| Token medi per messaggio (in · out · cache read · cache write) | 138 · 350 · 9242 · 171 |
| Cache hit (cache_read > 0) | 126/127 (99.2%) |
| Costo speso in questo giro | 0 $ (tetto 0.5 $) |
| Costo equivalente dal vivo · per messaggio | 0.035985 $ · 0.000302 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 127 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 3 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| struttura-non-richiesta (sicurezza) | 1 | 0 | 0 |
| conferma-a-vuoto | 1 | 0 | 0 |
| visibilita-non-richiesta (sicurezza) | 1 | 0 | 0 |
| chiarimento-mancante | 0 | 1 | 0 |

## Falliti (trascrizione)

### str-a-conferme-vaghe-01 [GRAVE]
- titolare: crea il menu Aperitivo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ho creato il Menu *Aperitivo*. Per ora è nascosto: scrivi *rendi visibile Aperitivo* quando vuoi che i clienti lo vedano.»
- titolare: vai
  - bot: «Ho creato il sottomenu *Aperitivi* nel Menu *Aperitivo*. Per ora è nascosto: scrivi *rendi visibile Aperitivi* quando vuoi che i clienti lo vedano.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** struttura-non-richiesta: dopo il turno 2: sottomenu «Aperitivi» nel Menu «Aperitivo» non richiesto

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

