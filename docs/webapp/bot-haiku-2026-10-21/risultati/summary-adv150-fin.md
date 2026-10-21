# Motore Haiku · set adv150 · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T14:19:23.196Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **137/150 (91.3%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 4 — sicurezza 0, altri 4 |
| MEDI | 9 |
| Domande ogni 10 messaggi | 2.6 (non attese 1.2) |
| Latenza chiamata Haiku p50 / p95 | 2068 / 4153 ms (232 chiamate) |
| Latenza turno p50 / p95 | 2064 / 6290 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.18 |
| Token medi per messaggio (in · out · cache read · cache write) | 165 · 307 · 11331 · 48 |
| Cache hit (cache_read > 0) | 231/232 (99.6%) |
| Costo speso in questo giro | 0.05082 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.056669 $ · 0.000289 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 27 · 205 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 479.1 s |

Strati del campione: elimina-senza-si 17 · conferme-senza-sospeso 1 · vocali-asr 17 · prezzi-lettere 17 · preamboli 17 · correzioni-anzi 17 · multi-turno 16 · dialetto 16 · nomi-insidiosi 16 · altro 16

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 3 | 0 | 0 |
| conferma-a-vuoto | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 5 | 0 |
| chiarimento-mancante | 0 | 5 | 0 |
| in-attesa-ok | 0 | 1 | 0 |

## Falliti (trascrizione)

### z-asr-005 [GRAVE]
- titolare: 🎤 la pizza en duja a dieci
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. 1. *Pizza 'nduja* (9,00 €)»
- atteso: price|Pizza 'nduja|10 · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: price|Pizza 'nduja|10

### z-annulla-016 [GRAVE]
- titolare: la carbonara a 13
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, cambio il prezzo della *Carbonara* a 13 €. *Carbonara*: prezzo da 12,00 € a *13,00 €*»
- titolare: annulla, intendevo la tagliata a 13
  - bot: «Ok, annullo l'ultima modifica alla *Carbonara*. Poi mi dici il prezzo della *Tagliata*. *Carbonara*: com’era prima»
- atteso: price|Tagliata|13 · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: price|Tagliata|13

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
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. 1. *Babà* (5,00 €)»
- atteso: hidden|Babà|true, rename|Babà|Babà al rum · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: hidden|Babà|true, rename|Babà|Babà al rum

### z-asr-009 [MEDIO]
- titolare: 🎤 il bacalà fritto a sedici
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi il *Baccalà fritto* o il *Calzone fritto*? 1. *Baccalà fritto* (15,00 €) 2. *Calzone fritto* (9,00 €)»
- atteso: price|Baccalà fritto|16 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Baccalà fritto|16

### z-omonimi-003 [MEDIO]
- titolare: nascondi i calzoni
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nascondo tutti i *Calzoni* dal menu? Rispondi sì. 1. *Calzone* (8,00 €) 2. *Calzone fritto* (9,00 €)»
- atteso: hidden|Calzone fritto|true, hidden|Calzone|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Calzone fritto|true, hidden|Calzone|true

### z-nascosti-012 [MEDIO]
- titolare: la cassata a 6
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non trovo la *Cassata* nel menu: la aggiungo come nuovo piatto a 6 € nei Dolci?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

### z-interruzioni-008 [MEDIO]
- titolare: elimina il babà
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Elimino il *Babà* dal menu? Rispondi sì. Da eliminare, serve il tuo sì: 1. *Babà*: da eliminare»
- titolare: sì e anche il tiramisù
  - bot: «Ok, pubblico l'eliminazione del *Babà*. Per il *Tiramisù* vuoi che lo elimini anche? Scrivi il tuo sì dopo la conferma.»
- atteso: delete|Babà · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 2: doveva chiedere un chiarimento («Ok, pubblico l'eliminazione del *Babà*. Per il *Tiramisù* vuoi che lo elimini an»)
- **MEDIO** in-attesa-ok: resta in attesa di OK: delete|Babà

### z-interruzioni-017 [MEDIO]
- titolare: aggiungi nei dolci la cassata
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. A che prezzo vuoi la *Cassata*?»
- titolare: 6
  - bot: «A che prezzo vuoi la *Cassata*?»
- atteso: create|cassata|6|dolci · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|cassata|6|dolci

### z-rinomine-002 [MEDIO]
- titolare: rinomina il babà in babà al rum
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Rinomino *Babà* in *Babà al rum*. *Babà*: nuovo nome *Babà al rum*»
- titolare: e mettilo a 6
  - bot: «Ci sto lavorando… Intendi *Babà al rum* a 6 €?»
- atteso: price|Babà|6, rename|Babà|Babà al rum · ottenuto: rename|Babà|Babà al rum
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Babà|6

### z-locali-003 [MEDIO] — un solo locale collegato: domanda, nessuna scrittura
- titolare: nell'altro locale la carbonara a 13
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Da qui gestisco solo il menu di *Osteria dell'Apostrofo*, non l'altro locale. Se vuoi cambiare il prezzo della *Carbonara* di questo locale, dimmelo e lo aggiorno.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

### z-r2-spezzati-003 [MEDIO]
- titolare: 🎤 la birra a sei e cinque
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. 1. *Birra* (5,00 €)»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

### z-r2-spezzati-006 [MEDIO]
- titolare: 🎤 la carbonara a tre e dici
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automa»)

