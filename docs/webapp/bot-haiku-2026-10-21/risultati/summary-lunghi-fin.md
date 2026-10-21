# Motore Haiku · set lunghi · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T20:02:17.170Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **39/42 (92.9%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 1, altri 0 |
| MEDI | 2 |
| Domande ogni 10 messaggi | 0.5 (non attese 0.1) |
| Latenza chiamata Haiku p50 / p95 | 4086 / 6999 ms (81 chiamate) |
| Latenza turno p50 / p95 | 62 / 137 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.04 |
| Token medi per messaggio (in · out · cache read · cache write) | 330 · 803 · 10435 · 21 |
| Cache hit (cache_read > 0) | 81/81 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.042226 $ · 0.000541 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 81 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 6.4 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta (sicurezza) | 6 | 0 | 0 |
| scrive-invece-di-chiedere (sicurezza) | 1 | 0 | 0 |
| chiarimento-mancante | 0 | 2 | 0 |

## Falliti (trascrizione)

### lng-manuel [GRAVE] — vocale vero di Manuel sul QA (timeout 11:30): una domanda (13.000 e carbonara detta due volte), nessuna scrittura, mai «
- titolare: 🎤 metti la carbonara a 12,50, la pasta del giorno a 9 euro anziché 8,50, poi la pasta al ragù a 10, la carbonara a 13.000, poi aumenta tutti i primi di un euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aumentati di 1,00 € i prezzi di 6 piatti. *Spaghetti alla carbonara*: prezzo da 12,00 € a *13,00 €* *Pasta e fagioli*: prezzo da 9,00 € a *10,00 €* *Spaghetti aglio olio e peperoncino*: prezzo da 8,00 € a *9,00 €* *Lasagna al forno*: prezzo da 11,00 € a *12,00 €* *Gnocchi 4 formaggi*: prezzo da 10,00 € a *11,»
- atteso: nessuna modifica · ottenuto: price|Gnocchi 4 formaggi|11, price|Lasagna al forno|12, price|Pasta del giorno|10, price|Pasta e fagioli|10, price|Spaghetti aglio olio e peperoncino|9, price|Spaghetti alla carbonara|13
- **GRAVE** scrive-invece-di-chiedere: turno 1: doveva chiedere, ha scritto price|Gnocchi 4 formaggi|11, price|Lasagna al forno|12, price|Pasta del giorno|10, price|Pasta e fagioli|10, price|Spaghetti aglio olio e peperoncino|9, price|Spaghetti alla carbonara|13
- **GRAVE** modifica-non-richiesta: non richiesto: price|Gnocchi 4 formaggi|11
- **GRAVE** modifica-non-richiesta: non richiesto: price|Lasagna al forno|12
- **GRAVE** modifica-non-richiesta: non richiesto: price|Pasta del giorno|10
- **GRAVE** modifica-non-richiesta: non richiesto: price|Pasta e fagioli|10
- **GRAVE** modifica-non-richiesta: non richiesto: price|Spaghetti aglio olio e peperoncino|9
- **GRAVE** modifica-non-richiesta: non richiesto: price|Spaghetti alla carbonara|13

### lng-mig-3 [MEDIO] — «13.000»: una domanda, nessuna scrittura
- titolare: la margherita a 8 euro anziché 7, e poi la tagliata diciannove euro, ah e aggiungi nei dolci il cannolo a 4 euro, sposta il burger classico nei secondi, la carbonara a 13.000
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Per la *Carbonara* intendi *13 €*? Rispondi OK per pubblicare. Non ancora pubblicato: 1. *Margherita*: prezzo da 7,00 € a *8,00 €* 2. *Tagliata di manzo*: prezzo da 18,00 € a *19,00 €* 3. Nuovo piatto *Cannolo* in *Dolci*: *4,00 €* 4. *Burger classico*: spostato in *Secondi* «13.000»: 1. *Spaghetti alla carbo»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

### lng-mig-4 [MEDIO] — «13.000»: una domanda, nessuna scrittura
- titolare: 🎤 eh la diavola a 9 anzi 9,50, ah e la birra media a 5,50, aggiungi tra le pizze la bufalina a 10, poi il cappuccino a 2 euro, la carbonara a 13.000
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiorno la *Diavola* a 9,50, la *Birra media* a 5,50, il *Cappuccino* a 2 e aggiungo la *Bufalina* a 10 tra le Pizze. Per la *Carbonara* intendi 13 euro? Rispondi OK per pubblicare. Non ancora pubblicato: 1. *Diavola*: prezzo da 8,50 € a *9,50 €* 2. *Birra media*: prezzo da 5,00 € a *5,50 €* 3. Nuovo piatto »
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)

