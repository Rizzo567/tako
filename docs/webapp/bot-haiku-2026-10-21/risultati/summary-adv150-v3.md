# Motore Haiku · set adv150 · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T10:16:28.138Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **138/150 (92%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 3 — sicurezza 0, altri 3 |
| MEDI | 9 |
| Domande ogni 10 messaggi | 2.8 (non attese 1.4) |
| Latenza chiamata Haiku p50 / p95 | 1720 / 4698 ms (235 chiamate) |
| Latenza turno p50 / p95 | 21 / 3405 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.2 |
| Token medi per messaggio (in · out · cache read · cache write) | 178 · 334 · 10561 · 94 |
| Cache hit (cache_read > 0) | 233/235 (99.1%) |
| Costo speso in questo giro | 0.02017 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.059204 $ · 0.000302 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 153 · 82 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 177.2 s |

Strati del campione: elimina-senza-si 17 · conferme-senza-sospeso 1 · vocali-asr 17 · prezzi-lettere 17 · preamboli 17 · correzioni-anzi 17 · multi-turno 16 · dialetto 16 · nomi-insidiosi 16 · altro 16

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 2 | 0 | 0 |
| conferma-a-vuoto | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 7 | 0 |
| chiarimento-mancante | 0 | 3 | 0 |

## Falliti (trascrizione)

### z-asr-005 [GRAVE]
- titolare: 🎤 la pizza en duja a dieci
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. 1. *Pizza 'nduja* (9,00 €)»
- atteso: price|Pizza 'nduja|10 · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: price|Pizza 'nduja|10

### z-interruzioni-011 [GRAVE]
- titolare: elimina il babà e il tiramisù
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Elimino il *Babà* e il *Tiramisù* dal menu? Rispondi sì. Da eliminare, serve il tuo sì: 1. *Babà*: da eliminare 2. *Tiramisù*: da eliminare»
- titolare: solo il babà
  - bot: «Elimino il *Babà* dal menu? Rispondi sì.»
- titolare: sì
  - bot: «Elimino il *Babà* dal menu? Rispondi sì.»
- atteso: delete|Babà · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: delete|Babà
- **GRAVE** conferma-a-vuoto: turno 3: «sì» dopo una richiesta di conferma, e il bot chiede ancora conferma («Elimino il *Babà* dal menu? Rispondi sì.»)

### z-rinomine-009 [GRAVE]
- titolare: rinomina il babà in babà al rum, e nascondilo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. 1. *Babà* (5,00 €)»
- atteso: hidden|Babà|true, rename|Babà|Babà al rum · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: hidden|Babà|true, rename|Babà|Babà al rum

### z-asr-009 [MEDIO]
- titolare: 🎤 il bacalà fritto a sedici
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi il *Baccalà fritto* o il *Calzone fritto*? 1. *Baccalà fritto* (15,00 €) 2. *Calzone fritto* (9,00 €)»
- atteso: price|Baccalà fritto|16 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Baccalà fritto|16

### z-omonimi-003 [MEDIO]
- titolare: nascondi i calzoni
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nascondo tutto il Sottomenu *Calzoni*? Rispondi sì. 1. *Calzone* (8,00 €) 2. *Calzone fritto* (9,00 €)»
- atteso: hidden|Calzone fritto|true, hidden|Calzone|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Calzone fritto|true, hidden|Calzone|true

### z-riepilogo-019 [MEDIO]
- titolare: la carbonara a 13, la tagliata a 19, la birra a 6, il babà a 4 e il tiramisù a 7
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quali prezzi vuoi che aggiorni: *Carbonara* a 13, *Tagliata* a 19, *Birra* a 6, *Babà* a 4 o *Tiramisù* a 7? 1. *Carbonara* (12,00 €) 2. *Tagliata* (18,00 €) 3. *Birra* (5,00 €) 4. *Babà* (5,00 €) 5. *Tiramisù* (6,00 €)»
- titolare: ok
  - bot: «Quali di questi prezzi vuoi che aggiorni: *Carbonara* a 13, *Tagliata* a 19, *Birra* a 6, *Babà* a 4 o *Tiramisù* a 7? 1. *Carbonara* (12,00 €) 2. *Tagliata* (18,00 €) 3. *Birra* (5,00 €) 4. *Babà* (5,00 €) 5. *Tiramisù* (6,00 €)»
- atteso: price|Babà|4, price|Birra|6, price|Carbonara|13, price|Tagliata|19, price|Tiramisù|7 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Babà|4, price|Birra|6, price|Carbonara|13, price|Tagliata|19, price|Tiramisù|7

### z-assurdi-008 [MEDIO]
- titolare: la carbonara a 13.000
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

### z-interruzioni-008 [MEDIO]
- titolare: elimina il babà
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Elimino il *Babà* dal menu? Rispondi sì. Da eliminare, serve il tuo sì: 1. *Babà*: da eliminare»
- titolare: sì e anche il tiramisù
  - bot: «Confermo l'eliminazione del *Babà*. Vuoi eliminare anche il *Tiramisù*?»
- atteso: delete|Babà · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: delete|Babà

### z-interruzioni-017 [MEDIO]
- titolare: aggiungi nei dolci la cassata
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. A quanto costa la *Cassata*?»
- titolare: 6
  - bot: «A quanto costa la *Cassata*?»
- atteso: create|cassata|6|dolci · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|cassata|6|dolci

### z-rinomine-002 [MEDIO]
- titolare: rinomina il babà in babà al rum
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Rinomino *Babà* in *Babà al rum*. *Babà*: nuovo nome *Babà al rum*»
- titolare: e mettilo a 6
  - bot: «Intendi *Babà al rum* a 6 €?»
- atteso: price|Babà|6, rename|Babà|Babà al rum · ottenuto: rename|Babà|Babà al rum
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Babà|6

### z-r2-spezzati-003 [MEDIO]
- titolare: 🎤 la birra a sei e cinque
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. 1. *Birra* (5,00 €)»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

### z-r2-spezzati-006 [MEDIO]
- titolare: 🎤 la carbonara a tre e dici
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. 1. *Carbonara* (12,00 €)»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

