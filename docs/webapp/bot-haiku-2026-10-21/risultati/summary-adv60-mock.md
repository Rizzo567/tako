# Motore Haiku · set adv60 · mock

Generato da tests/eval/eval-haiku.test.ts (2026-10-20T23:12:04.756Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **28/60 (46.7%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 32 |
| Domande ogni 10 messaggi | 10 (non attese 8.8) |
| Latenza chiamata Haiku p50 / p95 | 0 / 0 ms (76 chiamate) |
| Latenza turno p50 / p95 | 14 / 39 ms (harness + latenza Haiku registrata) |
| Chiamate Haiku per messaggio | 1 |
| Token medi per messaggio (in · out · cache read · cache write) | 31 · 120 · 2247 · 0 |
| Cache hit (cache_read > 0) | 76/76 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.5 $) |
| Costo equivalente dal vivo · per messaggio | 0.006504 $ · 0.000086 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 0 · 0 · 76 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 2.7 s |

Strati del campione: elimina-senza-si 7 · conferme-senza-sospeso 1 · vocali-asr 7 · prezzi-lettere 7 · preamboli 7 · correzioni-anzi 7 · multi-turno 6 · dialetto 6 · nomi-insidiosi 6 · altro 6

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 32 | 0 |

## Falliti (trascrizione)

### z-dialetto-002 [MEDIO]
- titolare: o babà è fernuto
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Babà|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Babà|false

### z-dialetto-004 [MEDIO]
- titolare: la tagliata oggi nun ce sta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Tagliata|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Tagliata|false

### z-dialetto-010 [MEDIO]
- titolare: la carbonara mettimela a 13 nè
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13

### z-dialetto-011 [MEDIO]
- titolare: la tagliata è finita, abbiamo finito tutto stasera
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Tagliata|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Tagliata|false

### z-dialetto-022 [MEDIO]
- titolare: lo spaghetto all'astice fallo a ventisei
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Spaghetti all'astice|26 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Spaghetti all'astice|26

### z-asr-007 [MEDIO]
- titolare: 🎤 il greco di tufo a ventotto
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Greco di Tufo|28 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Greco di Tufo|28

### z-asr-015 [MEDIO]
- titolare: 🎤 la burata a nove e cinquanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Burrata|9.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Burrata|9.5

### z-asr-016 [MEDIO]
- titolare: 🎤 la delizia al limone a sei
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Delizia al limone|6 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Delizia al limone|6

### z-asr-018 [MEDIO]
- titolare: 🎤 il calzone fritto a dieci e il calzone a nove
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Calzone fritto|10, price|Calzone|9 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Calzone fritto|10, price|Calzone|9

### z-asr-019 [MEDIO]
- titolare: 🎤 il calzone a nove e il calzone fritto a dieci
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Calzone fritto|10, price|Calzone|9 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Calzone fritto|10, price|Calzone|9

### z-numeri-002 [MEDIO]
- titolare: la tagliata a ventuno
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Tagliata|21 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tagliata|21

### z-numeri-003 [MEDIO]
- titolare: la tagliata a ventidue e cinquanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Tagliata|22.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tagliata|22.5

### z-numeri-005 [MEDIO]
- titolare: la tagliata a diciannove virgola cinque
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Tagliata|19.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tagliata|19.5

### z-numeri-015 [MEDIO] — «quattro» è nel nome, il prezzo è nove
- titolare: la quattro stagioni a nove
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Quattro stagioni|9 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Quattro stagioni|9

### z-numeri-018 [MEDIO]
- titolare: aumenta la quattro stagioni di un euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Quattro stagioni|9.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Quattro stagioni|9.5

### z-numeri-025 [MEDIO]
- titolare: aggiungi nei dolci la cassata a sei
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: create|cassata|6|dolci · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|cassata|6|dolci

### z-tempo-010 [MEDIO]
- titolare: da ora la carbonara a 13
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13

### z-tempo-013 [MEDIO]
- titolare: la tagliata è tornata
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Tagliata|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Tagliata|true

### z-omonimi-006 [MEDIO]
- titolare: sposta il calzone nelle pizze
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: move|Calzone|Pizze · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Calzone|Pizze

### z-omonimi-010 [MEDIO]
- titolare: rinomina la categoria calzoni in ripieni
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: move|Calzone fritto|Ripieni, move|Calzone|Ripieni · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Calzone fritto|Ripieni, move|Calzone|Ripieni

### z-riepilogo-004 [MEDIO]
- titolare: la carbonara a 13, la tagliata a 19, la birra a 6 e il babà a 4
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: la birra lasciala com'è
  - bot: «Quale piatto intendi?»
- titolare: ok
  - bot: «Quale piatto intendi?»
- atteso: price|Babà|4, price|Carbonara|13, price|Tagliata|19 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Babà|4, price|Carbonara|13, price|Tagliata|19

### z-lunghi-001 [MEDIO]
- titolare: Buongiorno, allora, scusa se ti scrivo così presto ma stamattina sono andato al mercato e il pesce costava tantissimo, quindi ho deciso: il polpo all'insalata lo metti a 16, gli spaghetti all'astice a
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Polpo all'insalata|16, price|Spaghetti all'astice|26 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Polpo all'insalata|16, price|Spaghetti all'astice|26

### z-emoji-003 [MEDIO]
- titolare: carbonara 13€ ✅
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13

### z-apostrofi-008 [MEDIO]
- titolare: il tagliere dell oste a 16
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Tagliere dell'oste|16 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tagliere dell'oste|16

### z-apostrofi-016 [MEDIO]
- titolare: rinomina il babà in "Babà al rum"
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: rename|Babà|Babà al rum · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|Babà|Babà al rum

### z-ripeti-002 [MEDIO]
- titolare: la carbonara a 13
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: la carbonara a 13
  - bot: «Quale piatto intendi?»
- titolare: la carbonara a 13
  - bot: «Quale piatto intendi?»
- atteso: price|Carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13

### z-ripeti-006 [MEDIO]
- titolare: rinomina il babà in babà al rum
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: rinomina il babà in babà al rum
  - bot: «Quale piatto intendi?»
- atteso: rename|Babà|Babà al rum · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|Babà|Babà al rum

### z-ripeti-009 [MEDIO]
- titolare: la carbonara a 13 la carbonara a 13
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13

### z-interruzioni-008 [MEDIO]
- titolare: elimina il babà
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: sì e anche il tiramisù
  - bot: «Quale piatto intendi?»
- atteso: delete|Babà · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: delete|Babà

### z-rinomine-004 [MEDIO]
- titolare: rinomina il babà in babà al rum
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: il babà a 6
  - bot: «Quale piatto intendi?»
- atteso: price|Babà|6, rename|Babà|Babà al rum · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Babà|6, rename|Babà|Babà al rum

### z-rinomine-009 [MEDIO]
- titolare: rinomina il babà in babà al rum, e nascondilo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: hidden|Babà|true, rename|Babà|Babà al rum · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Babà|true, rename|Babà|Babà al rum

### z-r2-ritiri-004 [MEDIO]
- titolare: la birra a 6 e il babà... no il babà niente
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Birra|6 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Birra|6

