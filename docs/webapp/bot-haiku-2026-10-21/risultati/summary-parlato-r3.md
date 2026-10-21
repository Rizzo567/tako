# Motore Haiku · set parlato · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T01:06:17.538Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **21/30 (70%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 9 |
| Parlato sporco: corrette · domande giuste · GRAVI | 21 · 0 · 0 (corrette o domanda giusta 70%) |
| Domande ogni 10 messaggi | 0 (non attese 0) |
| Latenza chiamata Haiku p50 / p95 | 2124 / 3346 ms (31 chiamate) |
| Latenza turno p50 / p95 | 21 / 88 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.03 |
| Token medi per messaggio (in · out · cache read · cache write) | 61 · 243 · 7795 · 30 |
| Cache hit (cache_read > 0) | 31/31 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.2 $) |
| Costo equivalente dal vivo · per messaggio | 0.006276 $ · 0.000209 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 31 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 2 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| nessuna-azione | 0 | 9 | 0 |

## Falliti (trascrizione)

### ps-03 [MEDIO]
- titolare: 🎤 saltimbocc… sedic
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, il *Saltimbocca alla romana* lo porto a 16 €. Pubblico? Non ancora pubblicato, da confermare con OK: 1. *Saltimbocca alla romana*: prezzo da 15,00 € a *16,00 €*»
- atteso: price|Saltimbocca alla romana|16 · ottenuto: nessuna modifica
- **MEDIO** nessuna-azione: né modifica né domanda («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### ps-05 [MEDIO]
- titolare: 🎤 margherita otto
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, metto la *Margherita* a 8 €. Confermi? Non ancora pubblicato, da confermare con OK: 1. *Margherita*: prezzo da 7,00 € a *8,00 €*»
- atteso: price|Margherita|8 · ottenuto: nessuna modifica
- **MEDIO** nessuna-azione: né modifica né domanda («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### ps-06 [MEDIO]
- titolare: 🎤 la ghisa a dodici
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non ho cambiato nulla. 1. *Gricia* (11,00 €)»
- atteso: price|Gricia|12 · ottenuto: nessuna modifica
- **MEDIO** nessuna-azione: né modifica né domanda («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### ps-10 [MEDIO]
- titolare: 🎤 il cacio pepe… dodici e… cinquanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, *Cacio e pepe* lo porto a 12,50 €. Confermi? Non ancora pubblicato, da confermare con OK: 1. *Cacio e pepe*: prezzo da 10,00 € a *12,50 €*»
- atteso: price|Cacio e pepe|12.5 · ottenuto: nessuna modifica
- **MEDIO** nessuna-azione: né modifica né domanda («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### ps-14 [MEDIO]
- titolare: 🎤 eh allora senti eh la… la carbonara… mettila a… quattordici
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Metto la *Carbonara* a 14 €. Confermi? Non ancora pubblicato, da confermare con OK: 1. *Carbonara*: prezzo da 12,00 € a *14,00 €*»
- atteso: price|Carbonara|14 · ottenuto: nessuna modifica
- **MEDIO** nessuna-azione: né modifica né domanda («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### ps-15 [MEDIO]
- titolare: 🎤 la coda… la coda alla vaccinara diciassette
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, aggiorno *Coda alla vaccinara* a 17 €. Confermi? Non ancora pubblicato, da confermare con OK: 1. *Coda alla vaccinara*: prezzo da 16,00 € a *17,00 €*»
- atteso: price|Coda alla vaccinara|17 · ottenuto: nessuna modifica
- **MEDIO** nessuna-azione: né modifica né domanda («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### ps-20 [MEDIO]
- titolare: 🎤 amatriciana… undici e cinquanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, aggiorno il prezzo dell'*Amatriciana*. Confermi? Non ancora pubblicato, da confermare con OK: 1. *Amatriciana*: prezzo da 11,00 € a *11,50 €*»
- atteso: price|Amatriciana|11.5 · ottenuto: nessuna modifica
- **MEDIO** nessuna-azione: né modifica né domanda («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### ps-21 [MEDIO]
- titolare: 🎤 l'acqua… due e cinquanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, *Acqua naturale* lo metto a 2,50 €. Lo pubblico? Non ancora pubblicato, da confermare con OK: 1. *Acqua naturale*: prezzo da 2,00 € a *2,50 €*»
- atteso: price|Acqua naturale|2.5 · ottenuto: nessuna modifica
- **MEDIO** nessuna-azione: né modifica né domanda («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### ps-24 [MEDIO]
- titolare: 🎤 le patate quattro e mezzo… no cinque
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, aggiorno *Patate al forno* a 5 €. Confermi? Non ancora pubblicato, da confermare con OK: 1. *Patate al forno*: prezzo da 4,50 € a *5,00 €*»
- atteso: price|Patate al forno|5 · ottenuto: nessuna modifica
- **MEDIO** nessuna-azione: né modifica né domanda («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

