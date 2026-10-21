# Motore Haiku · set adv150 · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T15:50:44.377Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **136/150 (90.7%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 5 — sicurezza 0, altri 5 |
| MEDI | 9 |
| Domande ogni 10 messaggi | 2.8 (non attese 1.4) |
| Latenza chiamata Haiku p50 / p95 | 1847 / 3971 ms (233 chiamate) |
| Latenza turno p50 / p95 | 26 / 166 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.19 |
| Token medi per messaggio (in · out · cache read · cache write) | 164 · 308 · 11628 · 48 |
| Cache hit (cache_read > 0) | 232/233 (99.6%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.057354 $ · 0.000293 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 233 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 11.5 s |

Strati del campione: elimina-senza-si 17 · conferme-senza-sospeso 1 · vocali-asr 17 · prezzi-lettere 17 · preamboli 17 · correzioni-anzi 17 · multi-turno 16 · dialetto 16 · nomi-insidiosi 16 · altro 16

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 3 | 0 | 0 |
| conferma-a-vuoto | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 6 | 0 |
| chiarimento-mancante | 0 | 5 | 0 |

## Falliti (trascrizione)

### z-asr-005 [GRAVE]
- titolare: 🎤 la pizza en duja a dieci
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. 1. *Pizza 'nduja* (9,00 €)»
- atteso: price|Pizza 'nduja|10 · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: price|Pizza 'nduja|10

### z-ripeti-010 [GRAVE]
- titolare: elimina il babà
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Elimino il *Babà* dal menu? Rispondi sì. Da eliminare, serve il tuo sì: 1. *Babà*: da eliminare»
- titolare: sì
  - bot: «Ok, elimino il *Babà*. *Babà*: *eliminato* dal menu»
- titolare: elimina il babà
  - bot: «Elimino il *Babà* dal menu? Rispondi sì.»
- titolare: sì
  - bot: «Elimino il *Babà* dal menu? Rispondi sì.»
- atteso: delete|Babà · ottenuto: delete|Babà
- **GRAVE** conferma-a-vuoto: turno 4: «sì» dopo una richiesta di conferma, e il bot chiede ancora conferma («Elimino il *Babà* dal menu? Rispondi sì.»)

### z-interruzioni-008 [GRAVE]
- titolare: elimina il babà
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Elimino il *Babà* dal menu? Rispondi sì. Da eliminare, serve il tuo sì: 1. *Babà*: da eliminare»
- titolare: sì e anche il tiramisù
  - bot: «Non ho cambiato nulla.»
- atteso: delete|Babà · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 2: doveva chiedere un chiarimento («Non ho cambiato nulla.»)
- **GRAVE** non-applicato: non applicato: delete|Babà

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

### z-dialetto-011 [MEDIO]
- titolare: la tagliata è finita, abbiamo finito tutto stasera
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Segno *Tagliata* come esaurita. Per il «tutto» di stasera, quali piatti vuoi segnare finiti? Non ancora pubblicato: 1. *Tagliata*: *finito*»
- atteso: available|Tagliata|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Tagliata|false

### z-asr-009 [MEDIO]
- titolare: 🎤 il bacalà fritto a sedici
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi il *Baccalà fritto* o il *Calzone fritto*? 1. *Baccalà fritto* (15,00 €) 2. *Calzone fritto* (9,00 €)»
- atteso: price|Baccalà fritto|16 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Baccalà fritto|16

### z-omonimi-003 [MEDIO]
- titolare: nascondi i calzoni
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nascondo tutto il sottomenu *Calzoni*? Rispondi sì. 1. *Calzone* (8,00 €) 2. *Calzone fritto* (9,00 €)»
- atteso: hidden|Calzone fritto|true, hidden|Calzone|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Calzone fritto|true, hidden|Calzone|true

### z-emoji-001 [MEDIO]
- titolare: 🍝 13
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho capito a cosa si riferisce il 13: quale piatto vuoi modificare, e a che prezzo?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

### z-nascosti-012 [MEDIO]
- titolare: la cassata a 6
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non trovo la *cassata* nel menu. Vuoi aggiungerla come nuovo Piatto nei Dolci a *6 €*?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

### z-assurdi-008 [MEDIO]
- titolare: la carbonara a 13.000
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

### z-interruzioni-017 [MEDIO]
- titolare: aggiungi nei dolci la cassata
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quanto costa la *Cassata* nei Dolci?»
- titolare: 6
  - bot: «Quanto costa la *Cassata* nei Dolci?»
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

