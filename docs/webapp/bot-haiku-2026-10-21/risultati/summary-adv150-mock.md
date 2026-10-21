# Motore Haiku · set adv150 · mock

Generato da tests/eval/eval-haiku.test.ts (2026-10-20T23:12:10.499Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **78/150 (52%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 1, altri 0 |
| MEDI | 71 |
| Domande ogni 10 messaggi | 9.9 (non attese 8.3) |
| Latenza chiamata Haiku p50 / p95 | 0 / 0 ms (194 chiamate) |
| Latenza turno p50 / p95 | 12 / 24 ms (harness + latenza Haiku registrata) |
| Chiamate Haiku per messaggio | 0.99 |
| Token medi per messaggio (in · out · cache read · cache write) | 30 · 119 · 2223 · 0 |
| Cache hit (cache_read > 0) | 194/194 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.5 $) |
| Costo equivalente dal vivo · per messaggio | 0.016591 $ · 0.000085 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 0 · 0 · 194 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **1** |
| Durata del giro | 4.3 s |

Strati del campione: elimina-senza-si 17 · conferme-senza-sospeso 1 · vocali-asr 17 · prezzi-lettere 17 · preamboli 17 · correzioni-anzi 17 · multi-turno 16 · dialetto 16 · nomi-insidiosi 16 · altro 16

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| errore-generico | 1 | 0 | 0 |
| v4-groq-chat (sicurezza) | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 71 | 0 |

## Falliti (trascrizione)

### z-lunghi-010 [GRAVE]
- titolare: la carbonara a 13 la carbonara a 13 la carbonara a 13 la carbonara a 13 la carbonara a 13 la carbonara a 13 la carbonara a 13 la carbonara a 13 la carbonara a 13 la carbonara a 13 la carbonara a 13 la
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono riuscito a leggere il menu. *Non ho cambiato nulla.* Riprova tra poco o mandalo scritto.»
- atteso: price|Carbonara|13 · ottenuto: nessuna modifica
- **GRAVE** errore-generico: turno 1: errore generico
- **GRAVE** v4-groq-chat: 1 richieste a Groq chat con il motore Haiku

### z-dialetto-002 [MEDIO]
- titolare: o babà è fernuto
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Babà|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Babà|false

### z-dialetto-003 [MEDIO]
- titolare: 'o babà nun ce sta cchiù
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Babà|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Babà|false

### z-dialetto-004 [MEDIO]
- titolare: la tagliata oggi nun ce sta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Tagliata|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Tagliata|false

### z-dialetto-006 [MEDIO]
- titolare: la burrata falla a dieci, va bbuono
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Burrata|10 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Burrata|10

### z-dialetto-008 [MEDIO]
- titolare: la birra a sei, ja
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Birra|6 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Birra|6

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

### z-dialetto-023 [MEDIO]
- titolare: aò la coca a tre e cinquanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Coca Cola|3.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Coca Cola|3.5

### z-asr-001 [MEDIO]
- titolare: 🎤 la carbo nara a tredici euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13

### z-asr-005 [MEDIO]
- titolare: 🎤 la pizza en duja a dieci
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Pizza 'nduja|10 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Pizza 'nduja|10

### z-asr-007 [MEDIO]
- titolare: 🎤 il greco di tufo a ventotto
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Greco di Tufo|28 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Greco di Tufo|28

### z-asr-009 [MEDIO]
- titolare: 🎤 il bacalà fritto a sedici
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Baccalà fritto|16 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Baccalà fritto|16

### z-asr-013 [MEDIO]
- titolare: 🎤 la tagliata a diciannove. Punto.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Tagliata|19 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tagliata|19

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

### z-asr-020 [MEDIO]
- titolare: 🎤 quattro stagioni a nove
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Quattro stagioni|9 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Quattro stagioni|9

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

### z-numeri-006 [MEDIO]
- titolare: il greco di tufo a trentadue
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Greco di Tufo|32 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Greco di Tufo|32

### z-numeri-007 [MEDIO]
- titolare: il greco di tufo a trentotto
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Greco di Tufo|38 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Greco di Tufo|38

### z-numeri-011 [MEDIO]
- titolare: l'acqua a un euro e cinquanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Acqua|1.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Acqua|1.5

### z-numeri-012 [MEDIO]
- titolare: l'acqua a uno e cinquanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Acqua|1.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Acqua|1.5

### z-numeri-015 [MEDIO] — «quattro» è nel nome, il prezzo è nove
- titolare: la quattro stagioni a nove
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Quattro stagioni|9 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Quattro stagioni|9

### z-numeri-017 [MEDIO]
- titolare: quattro stagioni 9
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Quattro stagioni|9 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Quattro stagioni|9

### z-numeri-018 [MEDIO]
- titolare: aumenta la quattro stagioni di un euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Quattro stagioni|9.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Quattro stagioni|9.5

### z-numeri-019 [MEDIO]
- titolare: aumenta la tagliata di due euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Tagliata|20 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tagliata|20

### z-numeri-021 [MEDIO]
- titolare: la tagliata un euro in più
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Tagliata|19 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tagliata|19

### z-numeri-025 [MEDIO]
- titolare: aggiungi nei dolci la cassata a sei
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: create|cassata|6|dolci · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|cassata|6|dolci

### z-tempo-004 [MEDIO]
- titolare: per oggi niente babà
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Babà|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Babà|false

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

### z-tempo-017 [MEDIO] — oltre 30 min: o 21 o chiede, mai altro
- titolare: la tagliata a 20
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: [+45 min]
  - bot: «Quale piatto intendi?»
- titolare: anzi 21
  - bot: «»
- atteso: price|Tagliata|21 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tagliata|21

### z-omonimi-003 [MEDIO]
- titolare: nascondi i calzoni
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: hidden|Calzone fritto|true, hidden|Calzone|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Calzone fritto|true, hidden|Calzone|true

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

### z-omonimi-018 [MEDIO] — «e» dentro il nome: un solo piatto
- titolare: la pasta e patate a 11
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Pasta e patate|11 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Pasta e patate|11

### z-omonimi-020 [MEDIO]
- titolare: nascondi pasta e patate
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: hidden|Pasta e patate|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Pasta e patate|true

### z-riepilogo-004 [MEDIO]
- titolare: la carbonara a 13, la tagliata a 19, la birra a 6 e il babà a 4
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: la birra lasciala com'è
  - bot: «Quale piatto intendi?»
- titolare: ok
  - bot: «Quale piatto intendi?»
- atteso: price|Babà|4, price|Carbonara|13, price|Tagliata|19 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Babà|4, price|Carbonara|13, price|Tagliata|19

### z-riepilogo-013 [MEDIO]
- titolare: la carbonara a 13, la tagliata a 19, la birra a 6 e il babà a 4
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: ok ok
  - bot: «Quale piatto intendi?»
- atteso: price|Babà|4, price|Birra|6, price|Carbonara|13, price|Tagliata|19 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Babà|4, price|Birra|6, price|Carbonara|13, price|Tagliata|19

### z-riepilogo-019 [MEDIO]
- titolare: la carbonara a 13, la tagliata a 19, la birra a 6, il babà a 4 e il tiramisù a 7
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: ok
  - bot: «Quale piatto intendi?»
- atteso: price|Babà|4, price|Birra|6, price|Carbonara|13, price|Tagliata|19, price|Tiramisù|7 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Babà|4, price|Birra|6, price|Carbonara|13, price|Tagliata|19, price|Tiramisù|7

### z-lunghi-001 [MEDIO]
- titolare: Buongiorno, allora, scusa se ti scrivo così presto ma stamattina sono andato al mercato e il pesce costava tantissimo, quindi ho deciso: il polpo all'insalata lo metti a 16, gli spaghetti all'astice a
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Polpo all'insalata|16, price|Spaghetti all'astice|26 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Polpo all'insalata|16, price|Spaghetti all'astice|26

### z-lunghi-005 [MEDIO]
- titolare: Ciao! Oggi è una giornata pienissima, abbiamo 40 coperti a pranzo, quindi per favore: il babà è finito, la burrata pure, e metti in evidenza la tagliata che ne abbiamo tanta. Grazie!
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Babà|false, available|Burrata|false, featured|Tagliata|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Babà|false, available|Burrata|false, featured|Tagliata|true

### z-emoji-002 [MEDIO]
- titolare: carbonara ➡️ 13
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13

### z-emoji-003 [MEDIO]
- titolare: carbonara 13€ ✅
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13

### z-emoji-010 [MEDIO]
- titolare: la carbonara a 13
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 👍
  - bot: «Quale piatto intendi?»
- atteso: price|Carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13

### z-annulla-016 [MEDIO]
- titolare: la carbonara a 13
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: annulla, intendevo la tagliata a 13
  - bot: «Quale piatto intendi?»
- atteso: price|Tagliata|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tagliata|13

### z-apostrofi-004 [MEDIO]
- titolare: la frittatina 'e pasta a 3,50
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Frittatina 'e pasta|3.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Frittatina 'e pasta|3.5

### z-apostrofi-008 [MEDIO]
- titolare: il tagliere dell oste a 16
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Tagliere dell'oste|16 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tagliere dell'oste|16

### z-apostrofi-011 [MEDIO]
- titolare: «Pizza all’ortolana» a 9
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Pizza all'ortolana|9 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Pizza all'ortolana|9

### z-apostrofi-016 [MEDIO]
- titolare: rinomina il babà in "Babà al rum"
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: rename|Babà|Babà al rum · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|Babà|Babà al rum

### z-apostrofi-019 [MEDIO]
- titolare: l'astice a 26
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Spaghetti all'astice|26 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Spaghetti all'astice|26

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

### z-ripeti-010 [MEDIO]
- titolare: elimina il babà
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: sì
  - bot: «Quale piatto intendi?»
- titolare: elimina il babà
  - bot: «Quale piatto intendi?»
- titolare: sì
  - bot: «Quale piatto intendi?»
- atteso: delete|Babà · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: delete|Babà

### z-interruzioni-002 [MEDIO] — il sì dopo un'altra modifica: pericoloso se elimina
- titolare: elimina il babà
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: la carbonara a 13
  - bot: «Quale piatto intendi?»
- titolare: sì
  - bot: «Quale piatto intendi?»
- atteso: price|Carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13

### z-interruzioni-008 [MEDIO]
- titolare: elimina il babà
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: sì e anche il tiramisù
  - bot: «Quale piatto intendi?»
- atteso: delete|Babà · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: delete|Babà

### z-interruzioni-011 [MEDIO]
- titolare: elimina il babà e il tiramisù
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: solo il babà
  - bot: «Quale piatto intendi?»
- titolare: sì
  - bot: «Quale piatto intendi?»
- atteso: delete|Babà · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: delete|Babà

### z-interruzioni-017 [MEDIO]
- titolare: aggiungi nei dolci la cassata
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 6
  - bot: «Quale piatto intendi?»
- atteso: create|cassata|6|dolci · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|cassata|6|dolci

### z-promo-011 [MEDIO]
- titolare: togli la tagliata dall'evidenza
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: featured|Tagliata|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: featured|Tagliata|false

### z-rinomine-002 [MEDIO]
- titolare: rinomina il babà in babà al rum
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: e mettilo a 6
  - bot: «Quale piatto intendi?»
- atteso: price|Babà|6, rename|Babà|Babà al rum · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Babà|6, rename|Babà|Babà al rum

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

### z-rinomine-013 [MEDIO]
- titolare: chiama la burrata burrata pugliese
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: rename|Burrata|burrata pugliese · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|Burrata|burrata pugliese

### z-locali-001 [MEDIO]
- titolare: nel menu bevande la birra a 6
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Birra|6 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Birra|6

### z-locali-008 [MEDIO]
- titolare: aggiungi nei vini il fiano a 22
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: create|fiano|22|vini · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|fiano|22|vini

### z-r2-ritiri-004 [MEDIO]
- titolare: la birra a 6 e il babà... no il babà niente
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Birra|6 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Birra|6

