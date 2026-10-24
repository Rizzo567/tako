# Motore Haiku · set playground · mock

Generato da tests/eval/eval-haiku.test.ts (2026-10-20T23:11:57.271Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **4/20 (20%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 16 |
| Domande ogni 10 messaggi | 10 (non attese 8) |
| Latenza chiamata Haiku p50 / p95 | 0 / 0 ms (20 chiamate) |
| Latenza turno p50 / p95 | 19 / 109 ms (harness + latenza Haiku registrata) |
| Chiamate Haiku per messaggio | 1 |
| Token medi per messaggio (in · out · cache read · cache write) | 17 · 120 · 2318 · 0 |
| Cache hit (cache_read > 0) | 20/20 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.5 $) |
| Costo equivalente dal vivo · per messaggio | 0.001697 $ · 0.000085 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 0 · 0 · 20 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 1.7 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 10 | 0 |
| risposta-senza-contenuto | 0 | 5 | 1 |
| domanda-sbagliata | 0 | 1 | 0 |
| riepilogo-mancante | 0 | 1 | 0 |

## Falliti (trascrizione)

### pg-01 [MEDIO]
- titolare: la carbonara mettila a 13 euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Spaghetti alla carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Spaghetti alla carbonara|13

### pg-02 [MEDIO]
- titolare: è finita la lasagna
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Lasagna al forno|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Lasagna al forno|false

### pg-03 [MEDIO]
- titolare: ❓ quanto costa la diavola?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** risposta-senza-contenuto: turno 1: manca /8[,.]5/ («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### pg-04 [MEDIO]
- titolare: aggiungi nei primi cacio e pepe che costa 11
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: create|cacio e pepe|11|primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|cacio e pepe|11|primi

### pg-05 [MEDIO]
- titolare: elimina la panna cotta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** risposta-senza-contenuto: turno 1: manca /\bs[iì](?![a-z])/i («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### pg-06 [MEDIO]
- titolare: la carbo a 12 anzi 13
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Spaghetti alla carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Spaghetti alla carbonara|13

### pg-07 [MEDIO]
- titolare: 🎤 eh allora senti eh la… la carbo… mettila a… tredici
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Spaghetti alla carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Spaghetti alla carbonara|13

### pg-08 [MEDIO]
- titolare: 🎤 la lasagn… finit
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Lasagna al forno|false · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina lasagna

### pg-09 [MEDIO]
- titolare: 🎤 gnocchi quattro formag dodic
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Gnocchi 4 formaggi|12 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Gnocchi 4 formaggi|12

### pg-10 [MEDIO]
- titolare: 🎤 a coca… non ce n'è più
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Coca Cola 33cl|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Coca Cola 33cl|false

### pg-11 [MEDIO]
- titolare: 🎤 la tagliat… diciott e cinquant
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Tagliata di manzo|18.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tagliata di manzo|18.5

### pg-13 [MEDIO]
- titolare: 🎤 o tiramis… levalo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: hidden|Tiramisù|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Tiramisù|true

### pg-14 [MEDIO]
- titolare: 🎤 bruschett cinque e mezz
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Bruschetta al pomodoro|5.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Bruschetta al pomodoro|5.5

### pg-16 [MEDIO] — già a 3 €: nessuna scrittura, lo dice
- titolare: la coca a 3
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** risposta-senza-contenuto: turno 1: manca /\bgi[aà](?![a-z])/i («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)
- **MEDIO** risposta-senza-contenuto: turno 1: manca /\b3\b/ («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### pg-17 [MEDIO] — 4 pizze → oltre 3 modifiche: riepilogo + OK
- titolare: aumenta tutte le pizze di un euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** riepilogo-mancante: turno 1: manca il riepilogo con «Rispondi OK» («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### pg-19 [MEDIO] — intero Menu cena: una conferma, nessuna scrittura al primo turno
- titolare: nascondi tutta la cena
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** risposta-senza-contenuto: turno 1: manca /cena/i («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### pg-20 [BASSO]
- titolare: ❓ cosa sai fare?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **BASSO** risposta-senza-contenuto: turno 1: manca /prezz/i («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

