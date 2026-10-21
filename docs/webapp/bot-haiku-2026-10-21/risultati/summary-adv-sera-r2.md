# Motore Haiku · set adv-sera · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T19:26:47.638Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **139/154 (90.3%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 14 — sicurezza 4, altri 10 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 4.5 (non attese 4.5) |
| Latenza chiamata Haiku p50 / p95 | 2945 / 5316 ms (328 chiamate) |
| Latenza turno p50 / p95 | 22 / 6596 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.07 |
| Token medi per messaggio (in · out · cache read · cache write) | 275 · 515 · 10574 · 10 |
| Cache hit (cache_read > 0) | 328/328 (100%) |
| Costo speso in questo giro | 0.056659 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.11991 $ · 0.000392 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 161 · 167 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 456.7 s |

Strati del campione: elimina-senza-si 0 · conferme-senza-sospeso 1 · vocali-asr 0 · prezzi-lettere 0 · preamboli 0 · correzioni-anzi 0 · multi-turno 0 · dialetto 0 · nomi-insidiosi 0 · altro 153

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| comando-perso | 8 | 0 | 0 |
| modifica-non-richiesta (sicurezza) | 8 | 0 | 0 |
| non-applicato | 3 | 0 | 0 |
| struttura-non-creata | 3 | 0 | 0 |
| si-ignorato | 2 | 0 | 0 |
| menu-nominato-ignorato (sicurezza) | 2 | 0 | 0 |
| rinomina-mancante | 2 | 0 | 0 |
| modifica-sbagliata (sicurezza) | 1 | 0 | 0 |
| struttura-non-richiesta (sicurezza) | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 2 | 0 |

## Falliti (trascrizione)

### as-si-04 [GRAVE]
- titolare: nel menu pranzo metti la cotoletta a 14
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Cotoletta*: creo il sottomenu *Secondi* e lo metto lì a *14,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: sì
  - bot: «Nuovo Sottomenu *Secondi* nel Menu *Menu pranzo* Nuovo piatto *Cotoletta* in *Secondi*: *14,00 €*»
- atteso: create|cotoletta|14|secondi · ottenuto: create|cotoletta|14|secondi
- **GRAVE** comando-perso: turno 1: «nel menu pranzo metti la cotoletta a 14» né eseguito né una domanda («Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una p»)

### as-si-16 [GRAVE]
- titolare: nel menu pranzo metti la cotoletta a 14
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Cotoletta*: creo il sottomenu *Secondi* e lo metto lì a *14,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: sì voglio chiamarlo primi
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Cotoletta* in *Primi*: *14,00 €*»
- atteso: create|cotoletta|14|secondi · ottenuto: create|cotoletta|14|primi
- **GRAVE** modifica-sbagliata: valore sbagliato: create|cotoletta|14|primi
- **GRAVE** non-applicato: non applicato: create|cotoletta|14|secondi
- **GRAVE** struttura-non-creata: dopo il turno 2: manca il sottomenu «Secondi» nel Menu «Menu pranzo»
- **GRAVE** struttura-non-richiesta: dopo il turno 2: sottomenu «Primi» nel Menu «Menu pranzo» non richiesto

### as-si-27 [GRAVE]
- titolare: 🎤 aggiungi gnocchi al ragu in menu pranzo a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Gnocchi al ragù*: creo il sottomenu *Primi* e lo metto lì a *10,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: va benissimo
  - bot: «Non ho cambiato nulla.»
- atteso: create|gnocchi al ragu|10|primi · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: create|gnocchi al ragu|10|primi
- **GRAVE** struttura-non-creata: dopo il turno 2: manca il sottomenu «Primi» nel Menu «Menu pranzo»
- **GRAVE** si-ignorato: turno 2: «va benissimo» a una proposta con azioni e nessuna scrittura («Non ho cambiato nulla.»)
- **GRAVE** menu-nominato-ignorato: dopo il turno 2: «Gnocchi al ragù» non è nel Menu pranzo

### as-si-28 [GRAVE]
- titolare: nel menu pranzo metti la cotoletta a 14
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Cotoletta*: creo il sottomenu *Secondi* e lo metto lì a *14,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: va benissimo
  - bot: «Ci sto lavorando… Non ho cambiato nulla.»
- atteso: create|cotoletta|14|secondi · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: create|cotoletta|14|secondi
- **GRAVE** struttura-non-creata: dopo il turno 2: manca il sottomenu «Secondi» nel Menu «Menu pranzo»
- **GRAVE** si-ignorato: turno 2: «va benissimo» a una proposta con azioni e nessuna scrittura («Ci sto lavorando… Non ho cambiato nulla.»)
- **GRAVE** menu-nominato-ignorato: dopo il turno 2: «Cotoletta» non è nel Menu pranzo

### as-menu-05 [GRAVE]
- titolare: 🎤 aggiungi la lasagna al menu pranzo a 9
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Lasagna*: creo il sottomenu *Primi* e lo metto lì a *9,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: si
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Lasagna* in *Primi*: *9,00 €*»
- atteso: create|lasagna|9|primi · ottenuto: create|lasagna|9|primi
- **GRAVE** comando-perso: turno 1: «aggiungi la lasagna al menu pranzo a 9» né eseguito né una domanda («Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una p»)

### as-menu-07 [GRAVE]
- titolare: aggiungi la carbonara in menu pranzo a 12
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Carbonara*: creo il sottomenu *Primi* e lo metto lì a *12,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: si
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Carbonara* in *Primi*: *12,00 €*»
- atteso: create|carbonara|12|primi · ottenuto: create|carbonara|12|primi
- **GRAVE** comando-perso: turno 1: «aggiungi la carbonara in menu pranzo a 12» né eseguito né una domanda («Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una p»)

### as-menu-08 [GRAVE]
- titolare: 🎤 aggiungi le polpette nel menu pranzo a 9
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Polpette*: creo il sottomenu *Secondi* e le metto lì a *9,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: ok
  - bot: «Nuovo Sottomenu *Secondi* nel Menu *Menu pranzo* Nuovo piatto *Polpette* in *Secondi*: *9,00 €*»
- atteso: create|polpette|9|secondi · ottenuto: create|polpette|9|secondi
- **GRAVE** comando-perso: turno 1: «aggiungi le polpette nel menu pranzo a 9» né eseguito né una domanda («Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una p»)

### as-menu-13 [GRAVE]
- titolare: inserisci la lasagna al menu pranzo al prezzo di 9 euro
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Lasagna*: creo il sottomenu *Primi* e lo metto lì a *9,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: si
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Lasagna* in *Primi*: *9,00 €*»
- atteso: create|lasagna|9|primi · ottenuto: create|lasagna|9|primi
- **GRAVE** comando-perso: turno 1: «inserisci la lasagna al menu pranzo al prezzo di 9 euro» né eseguito né una domanda («Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una p»)

### as-menu-15 [GRAVE]
- titolare: inserisci la carbonara in menu pranzo al prezzo di 12 euro
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Carbonara*: creo il sottomenu *Primi* e lo metto lì a *12,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: si
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Carbonara* in *Primi*: *12,00 €*»
- atteso: create|carbonara|12|primi · ottenuto: create|carbonara|12|primi
- **GRAVE** comando-perso: turno 1: «inserisci la carbonara in menu pranzo al prezzo di 12 euro» né eseguito né una domanda («Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una p»)

### as-menu-16 [GRAVE]
- titolare: inserisci le polpette nel menu pranzo al prezzo di 9 euro
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Polpette*: creo il sottomenu *Secondi* e le metto lì a *9,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: ok
  - bot: «Nuovo Sottomenu *Secondi* nel Menu *Menu pranzo* Nuovo piatto *Polpette* in *Secondi*: *9,00 €*»
- atteso: create|polpette|9|secondi · ottenuto: create|polpette|9|secondi
- **GRAVE** comando-perso: turno 1: «inserisci le polpette nel menu pranzo al prezzo di 9 euro» né eseguito né una domanda («Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una p»)

### as-rinomina-menu-06 [GRAVE]
- titolare: cambia nome al menu pranzo: Pranzo di lavoro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Come vuoi chiamarlo? Scrivimi il nome nuovo, per esempio «rinomina il menu pranzo in Pranzo veloce».»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** rinomina-mancante: dopo il turno 1: nessun Menu «Pranzo di lavoro»

### as-rinomina-sottomenu-03 [GRAVE]
- titolare: rinomina la categoria Completo in Primi piatti
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale sottomenu vuoi rinominare? Ci sono: Piatti di prova (Menu di verifica · web QA), Primi (Menu di verifica · web QA), Completo (Menu pranzo), Primi (Menu cena), Primi (Menu del giorno), Secondi (Menu del giorno).»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** rinomina-mancante: dopo il turno 1: nel Menu pranzo non c'è il sottomenu «Primi piatti»

### as-rinomina-sottomenu-04 [GRAVE]
- titolare: rinomina il sottomenu Piatti di prova in Altre proposte
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sottomenu *Piatti di prova*: nuovo nome *Altre proposte* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: nessuna modifica · ottenuto: move|Che ne sacc|Altre proposte, move|Inserisce il piatto la parmigiana|Altre proposte, move|Pasta al pesto e lasagna|Altre proposte, move|Pasta al sugo|Altre proposte, move|Piatto di verifica|Altre proposte, move|boh|Altre proposte, move|pasta al ragù|Altre proposte, move|tiramisù|Altre proposte
- **GRAVE** modifica-non-richiesta: non richiesto: move|Che ne sacc|Altre proposte
- **GRAVE** modifica-non-richiesta: non richiesto: move|Inserisce il piatto la parmigiana|Altre proposte
- **GRAVE** modifica-non-richiesta: non richiesto: move|Pasta al pesto e lasagna|Altre proposte
- **GRAVE** modifica-non-richiesta: non richiesto: move|Pasta al sugo|Altre proposte
- **GRAVE** modifica-non-richiesta: non richiesto: move|Piatto di verifica|Altre proposte
- **GRAVE** modifica-non-richiesta: non richiesto: move|boh|Altre proposte
- **GRAVE** modifica-non-richiesta: non richiesto: move|pasta al ragù|Altre proposte
- **GRAVE** modifica-non-richiesta: non richiesto: move|tiramisù|Altre proposte

### as-gruppo-02 [GRAVE]
- titolare: 🎤 tutte le paste a 10
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi *tutte* le paste a *10 €*, anche le due nascoste (*pasta all'amatriciana* e *pasta alla norma*)? 1. *pasta al ragù* (10,00 €) 2. *Pasta al sugo* (9,00 €) 3. *Pasta al pesto e lasagna* (10,01 €) 4. *pasta al pesto* (11,00 €) 5. *pasta carbonara* (10,00 €) 6. *pasta all'amatriciana* (1»
- atteso: price|Pasta al pesto e lasagna|10, price|Pasta al sugo|10, price|pasta al pesto|10, price|pasta all'amatriciana|10 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Pasta al pesto e lasagna|10, price|Pasta al sugo|10, price|pasta al pesto|10, price|pasta all'amatriciana|10
- **GRAVE** comando-perso: turno 1: «tutte le paste a 10» né eseguito né una domanda («Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una p»)

### as-gruppo-12 [MEDIO]
- titolare: metti tutti i primi a 12
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi i *Primi* del Menu di verifica o quelli del Menu del giorno?»
- atteso: price|la parmigiana|12, price|pasta al pesto|12, price|pasta all'amatriciana|12, price|pasta alla norma|12, price|pasta carbonara|12, price|riso giallo|12 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|12, price|pasta al pesto|12, price|pasta all'amatriciana|12, price|pasta alla norma|12, price|pasta carbonara|12, price|riso giallo|12

