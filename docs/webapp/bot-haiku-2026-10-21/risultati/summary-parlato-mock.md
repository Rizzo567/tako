# Motore Haiku · set parlato · mock

Generato da tests/eval/eval-haiku.test.ts (2026-10-20T23:12:00.476Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **0/30 (0%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 30 |
| Parlato sporco: corrette · domande giuste · GRAVI | 0 · 0 · 0 (corrette o domanda giusta 0%) |
| Domande ogni 10 messaggi | 10 (non attese 10) |
| Latenza chiamata Haiku p50 / p95 | 0 / 0 ms (30 chiamate) |
| Latenza turno p50 / p95 | 14 / 27 ms (harness + latenza Haiku registrata) |
| Chiamate Haiku per messaggio | 1 |
| Token medi per messaggio (in · out · cache read · cache write) | 18 · 120 · 2208 · 0 |
| Cache hit (cache_read > 0) | 30/30 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.5 $) |
| Costo equivalente dal vivo · per messaggio | 0.002516 $ · 0.000084 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 0 · 0 · 30 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 1.8 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| domanda-sbagliata | 0 | 30 | 0 |

## Falliti (trascrizione)

### ps-01 [MEDIO]
- titolare: 🎤 carbonar tredic
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina carbonara

### ps-02 [MEDIO]
- titolare: 🎤 la lasagn… a dodic
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Lasagna|12 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina lasagna

### ps-03 [MEDIO]
- titolare: 🎤 saltimbocc… sedic
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Saltimbocca alla romana|16 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina saltimbocca

### ps-04 [MEDIO]
- titolare: 🎤 polpett… finite
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Polpette al sugo|false · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina polpette

### ps-05 [MEDIO]
- titolare: 🎤 margherita otto
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Margherita|8 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina margherita

### ps-06 [MEDIO]
- titolare: 🎤 la ghisa a dodici
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Gricia|12 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina gricia

### ps-07 [MEDIO]
- titolare: 🎤 amatricana finita
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Amatriciana|false · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina amatriciana

### ps-08 [MEDIO]
- titolare: 🎤 la cocacola mettila a tre e cinquanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Coca Cola|3.5 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina coca

### ps-09 [MEDIO]
- titolare: 🎤 la sorrendina a dieci
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Sorrentina|10 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina sorrentina

### ps-10 [MEDIO]
- titolare: 🎤 il cacio pepe… dodici e… cinquanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Cacio e pepe|12.5 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina cacio/pepe

### ps-11 [MEDIO]
- titolare: 🎤 la sorrentina… finita
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Sorrentina|false · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina sorrentina

### ps-12 [MEDIO]
- titolare: 🎤 saltimbocca… nun ce sta… finito
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Saltimbocca alla romana|false · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina saltimbocca

### ps-13 [MEDIO]
- titolare: 🎤 gricia e carbonara… finite
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Carbonara|false, available|Gricia|false · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina gricia/carbonara

### ps-14 [MEDIO]
- titolare: 🎤 eh allora senti eh la… la carbonara… mettila a… quattordici
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Carbonara|14 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina carbonara

### ps-15 [MEDIO]
- titolare: 🎤 la coda… la coda alla vaccinara diciassette
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Coda alla vaccinara|17 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina coda/vaccinara

### ps-16 [MEDIO]
- titolare: 🎤 l'abbacchio… è finito l'abbacchio
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Abbacchio scottadito|false · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina abbacchio

### ps-17 [MEDIO]
- titolare: 🎤 la birra… la birra a sei
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Birra|6 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina birra

### ps-18 [MEDIO]
- titolare: 🎤 eh… la crostata… togli la crostata
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: hidden|Crostata|true · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina crostata

### ps-19 [MEDIO]
- titolare: 🎤 mo… la diavola… la diavola a nove
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Diavola|9 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina diavola

### ps-20 [MEDIO]
- titolare: 🎤 amatriciana… undici e cinquanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Amatriciana|11.5 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina amatriciana

### ps-21 [MEDIO]
- titolare: 🎤 l'acqua… due e cinquanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Acqua naturale|2.5 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina acqua

### ps-22 [MEDIO]
- titolare: 🎤 vino della casa… sei euri
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Vino della casa 1/4|6 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina vino

### ps-23 [MEDIO]
- titolare: 🎤 la cicoria mettila a sei euro… sei
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Cicoria ripassata|6 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina cicoria

### ps-24 [MEDIO]
- titolare: 🎤 le patate quattro e mezzo… no cinque
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Patate al forno|5 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina patate

### ps-25 [MEDIO]
- titolare: 🎤 er caffè… uno e cinquanta… no uno e sessanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Caffè|1.6 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina caffe

### ps-26 [MEDIO]
- titolare: 🎤 allora… la carbonara… no aspetta… l'amatriciana a tredici
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Amatriciana|13 · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina amatriciana

### ps-27 [MEDIO]
- titolare: 🎤 a gricia nun ce sta cchiù
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Gricia|false · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina gricia

### ps-28 [MEDIO]
- titolare: 🎤 o tiramisù levalo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: hidden|Tiramisù|true · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina tiramisu

### ps-29 [MEDIO]
- titolare: 🎤 a panna cotta… nun c'è cchiù
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Panna cotta|false · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina panna/cotta

### ps-30 [MEDIO]
- titolare: 🎤 eh senti… le polpette… rimettile… ci stanno di nuovo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Polpette al sugo|true · ottenuto: nessuna modifica
- **MEDIO** domanda-sbagliata: la domanda non nomina polpette

