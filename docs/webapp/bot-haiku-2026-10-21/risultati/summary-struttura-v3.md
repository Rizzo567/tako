# Motore Haiku · set struttura · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T10:11:33.823Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **92/94 (97.9%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 1, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 1.6 (non attese 0.7) |
| Latenza chiamata Haiku p50 / p95 | 2333 / 3874 ms (126 chiamate) |
| Latenza turno p50 / p95 | 15 / 24 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.06 |
| Token medi per messaggio (in · out · cache read · cache write) | 131 · 346 · 9162 · 176 |
| Cache hit (cache_read > 0) | 125/126 (99.2%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.035667 $ · 0.0003 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 126 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 3.4 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| visibilita-non-richiesta (sicurezza) | 1 | 0 | 0 |
| chiarimento-mancante | 0 | 1 | 0 |

## Falliti (trascrizione)

### str-v-10 [GRAVE] — Menu con piatti: prima la conferma, poi nascosto
- titolare: nascondi tutto il menu cena
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nascondo tutto il *Menu Cena*? Rispondi sì. Non ancora pubblicato, da confermare con OK: 1. Menu *Cena*: *nascosto* ai clienti (7 piatti)»
- titolare: sì
  - bot: «Il menu è cambiato nel frattempo, quindi *non ho applicato nulla*. Dimmi di nuovo cosa vuoi cambiare.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** visibilita-non-richiesta: dopo il turno 2: «Cena» è visibile ai clienti senza che il titolare l'abbia chiesto

### str-v-16 [MEDIO] — non esiste: una domanda
- titolare: mostra il menu della colazione
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non trovo un Menu *Colazione*. Intendi il Menu *Brunch*, che è nascosto e ancora vuoto?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

