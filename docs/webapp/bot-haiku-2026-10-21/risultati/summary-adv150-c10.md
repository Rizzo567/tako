# Motore Haiku · set adv150 · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T23:35:19.557Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **148/150 (98.7%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 0, altri 1 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 3.4 (non attese 1.8) |
| Latenza chiamata Haiku p50 / p95 | 1878 / 3930 ms (214 chiamate) |
| Latenza turno p50 / p95 | 18 / 36 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.09 |
| Token medi per messaggio (in · out · cache read · cache write) | 130 · 278 · 10665 · 54 |
| Cache hit (cache_read > 0) | 213/214 (99.5%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.052055 $ · 0.000266 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 214 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 5.8 s |

Strati del campione: elimina-senza-si 17 · conferme-senza-sospeso 1 · vocali-asr 17 · prezzi-lettere 17 · preamboli 17 · correzioni-anzi 17 · multi-turno 16 · dialetto 16 · nomi-insidiosi 16 · altro 16

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 1 | 0 |

## Falliti (trascrizione)

### z-omonimi-010 [GRAVE]
- titolare: rinomina la categoria calzoni in ripieni
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sottomenu *Calzoni*: nuovo nome *Ripieni* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: move|Calzone fritto|Ripieni, move|Calzone|Ripieni · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: move|Calzone fritto|Ripieni, move|Calzone|Ripieni

### z-omonimi-003 [MEDIO]
- titolare: nascondi i calzoni
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Per «nascondi i calzoni» a quale piatto ti riferisci? Rispondi col numero. 1. *Calzone* (8,00 €) 2. *Calzone fritto* (9,00 €)»
- atteso: hidden|Calzone fritto|true, hidden|Calzone|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Calzone fritto|true, hidden|Calzone|true

