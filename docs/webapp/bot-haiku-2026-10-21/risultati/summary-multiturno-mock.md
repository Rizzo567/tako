# Motore Haiku · set multiturno · mock

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T19:14:35.734Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **14/24 (58.3%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 2 — sicurezza 1, altri 1 |
| MEDI | 8 |
| Domande ogni 10 messaggi | 6.1 (non attese 5.8) |
| Latenza chiamata Haiku p50 / p95 | 0 / 0 ms (52 chiamate) |
| Latenza turno p50 / p95 | 16 / 56 ms (harness + latenza Haiku registrata) |
| Chiamate Haiku per messaggio | 0.91 |
| Token medi per messaggio (in · out · cache read · cache write) | 165 · 109 · 3944 · 0 |
| Cache hit (cache_read > 0) | 52/52 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.5 $) |
| Costo equivalente dal vivo · per messaggio | 0.006308 $ · 0.000111 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 0 · 0 · 52 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 2.6 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-sbagliata (sicurezza) | 1 | 0 | 0 |
| non-applicato | 1 | 0 | 0 |
| rinomina-mancante | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 8 | 0 |

## Falliti (trascrizione)

### mt-vera [GRAVE] — conversazione vera: 5 «solamente pasta al pesto e carbonara» può valere come correzione (solo quelle due a 9) o come con
- titolare: 🎤 La parmigiana passa a 12.50.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 🎤 No, ha detto la parmigiana.
  - bot: «Non ho cambiato nulla.»
- titolare: 🎤 Ok, adesso metti tutte le paste a 9 euro.
  - bot: «Messi a 9,00 € i prezzi di 6 piatti. *pasta al ragù*: prezzo da 10,00 € a *9,00 €* *Pasta al pesto e lasagna*: prezzo da 10,01 € a *9,00 €* *pasta al pesto*: prezzo da 11,00 € a *9,00 €* *pasta carbonara*: prezzo da 10,00 € a *9,00 €* *pasta all'amatriciana*: prezzo da 11,00 € a *9,00 €* *pasta alla norma*: prezzo da 10,00 € a *9,00 €* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: 🎤 No, no, diminuisci il prezzo solamente a quelle là che sono visibili.
  - bot: «*pasta all'amatriciana*: prezzo da 9,00 € a *11,00 €* *pasta alla norma*: prezzo da 9,00 € a *10,00 €*»
- titolare: solamente pasta al pesto e carbonara
  - bot: «Quale piatto intendi?»
- titolare: 🎤 Cambia il nome del menù, da menù di verifica a menù di prova.
  - bot: «Menu *Menu di verifica · web QA*: ora si chiama *Menu di prova* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: 🎤 No vabbè fa niente, voglio che aggiungi nel menù pranzo le lasagne.
  - bot: «Nel *Menu pranzo* non c’è un sottomenu adatto a *Lasagna*: creo il sottomenu *Primi* e lo metto lì? Rispondi *sì* oppure dimmi il nome del sottomenu. Dimmi anche il prezzo.»
- titolare: 🎤 Tu come mi consiglieresti di chiamare il sottomenù?
  - bot: «Quale piatto intendi?»
- titolare: si
  - bot: «Ho creato il sottomenu *Primi* nel Menu *Menu pranzo*. A che prezzo metto *Lasagna* nei *Primi*?»
- titolare: si
  - bot: «Mi serve solo il prezzo: quanto costa *Lasagna*? Scrivimi il numero, per esempio «12».»
- titolare: si voglio chiamarlo primi
  - bot: «Quale piatto intendi?»
- titolare: aumenta tutti i primi di 1 euro
  - bot: «Aumentati di 1,00 € i prezzi di 6 piatti. *la parmigiana*: prezzo da 15,00 € a *16,00 €* *pasta al pesto*: prezzo da 9,00 € a *10,00 €* *pasta carbonara*: prezzo da 9,00 € a *10,00 €* *riso giallo*: prezzo da 8,00 € a *9,00 €* *pasta all'amatriciana*: prezzo da 11,00 € a *12,00 €* *pasta alla norma*: prezzo da 10,00 € a *11,00 €* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: aggiungi gnocchi al ragu in menu pranzo a 10
  - bot: «Nuovo piatto *Gnocchi al ragù* in *Primi*: *10,00 €*»
- atteso: create|gnocchi al ragu|10|primi, price|Pasta al pesto e lasagna|9, price|la parmigiana|13.5, price|pasta al pesto|10, price|pasta al ragù|9, price|pasta all'amatriciana|12, price|pasta alla norma|11, price|riso giallo|9 · ottenuto: create|gnocchi al ragu|10|primi, price|Pasta al pesto e lasagna|9, price|la parmigiana|16, price|pasta al pesto|10, price|pasta al ragù|9, price|pasta all'amatriciana|12, price|pasta alla norma|11, price|riso giallo|9
- **GRAVE** modifica-sbagliata: valore sbagliato: price|la parmigiana|16
- **GRAVE** non-applicato: non applicato: price|la parmigiana|13.5

### mt-rinomina-annulla [GRAVE]
- titolare: rinomina il menu pranzo in Pranzo veloce
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Menu *Menu pranzo*: ora si chiama *Pranzo veloce* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: annulla
  - bot: «Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** rinomina-mancante: dopo il turno 2: nessun Menu «Menu pranzo»

### mt-si-vocale [MEDIO]
- titolare: 🎤 aggiungi nel menù pranzo le lasagne a dodici euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Lasagna*: creo il sottomenu *Primi* e lo metto lì? Rispondi *sì* oppure dimmi il nome del sottomenu. Dimmi anche il prezzo.»
- titolare: 🎤 sì
  - bot: «Ho creato il sottomenu *Primi* nel Menu *Menu pranzo*. A che prezzo metto *Lasagna* nei *Primi*?»
- atteso: create|lasagna|12|primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|lasagna|12|primi

### mt-si-senza-prezzo [MEDIO] — senza prezzo: al sì il sottomenu, poi il prezzo completa il piatto
- titolare: aggiungi nel menu pranzo le lasagne
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Lasagna*: creo il sottomenu *Primi* e lo metto lì? Rispondi *sì* oppure dimmi il nome del sottomenu. Dimmi anche il prezzo.»
- titolare: si
  - bot: «Ho creato il sottomenu *Primi* nel Menu *Menu pranzo*. A che prezzo metto *Lasagna* nei *Primi*?»
- titolare: 12
  - bot: «Quale piatto intendi?»
- atteso: create|lasagna|12|primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|lasagna|12|primi

### mt-fa-niente [MEDIO]
- titolare: aggiungi nel menu pranzo le lasagne
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Lasagna*: creo il sottomenu *Primi* e lo metto lì? Rispondi *sì* oppure dimmi il nome del sottomenu. Dimmi anche il prezzo.»
- titolare: 🎤 No vabbè fa niente, nascondi il riso giallo
  - bot: «Quale piatto intendi?»
- atteso: hidden|riso giallo|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|riso giallo|true

### mt-comando-su-domanda [MEDIO]
- titolare: la pasta a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: metti il tiramisù a 7
  - bot: «Per «metti il tiramisù a 7» mi manca un dettaglio: qual è il nome esatto del piatto (o del sottomenu) e cosa devo cambiare? Per esempio «la carbonara a 12».»
- atteso: price|tiramisù|7 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|tiramisù|7

### mt-no-poi-comando [MEDIO]
- titolare: la pasta a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: no lascia stare
  - bot: «Non ho cambiato nulla.»
- titolare: metti il tiramisù a 7
  - bot: «Quale piatto intendi?»
- atteso: price|tiramisù|7 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|tiramisù|7

### mt-no-poi-comando-voce [MEDIO]
- titolare: aggiungi nel menu pranzo le lasagne a 12
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Lasagna*: creo il sottomenu *Primi* e lo metto lì a *12,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: 🎤 no
  - bot: «Quale piatto intendi?»
- titolare: 🎤 nascondi la pasta al sugo
  - bot: «Per «nascondi la pasta al sugo» mi manca un dettaglio: qual è il nome esatto del piatto (o del sottomenu) e cosa devo cambiare? Per esempio «la carbonara a 12».»
- atteso: hidden|Pasta al sugo|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Pasta al sugo|true

### mt-rinomina-piatto [MEDIO]
- titolare: rinomina la pasta carbonara in Carbonara romana
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: rename|pasta carbonara|Carbonara romana · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|pasta carbonara|Carbonara romana

### mt-parmigiana [MEDIO]
- titolare: 🎤 La parmigiana passa a 12.50.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|la parmigiana|12.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|12.5

