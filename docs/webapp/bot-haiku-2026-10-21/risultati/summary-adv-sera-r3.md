# Motore Haiku · set adv-sera · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T19:53:58.994Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **168/187 (89.8%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 3 — sicurezza 0, altri 3 |
| MEDI | 16 |
| Domande ogni 10 messaggi | 4.3 (non attese 4.2) |
| Latenza chiamata Haiku p50 / p95 | 2942 / 5316 ms (342 chiamate) |
| Latenza turno p50 / p95 | 17 / 2471 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 0.97 |
| Token medi per messaggio (in · out · cache read · cache write) | 217 · 463 · 9537 · 45 |
| Cache hit (cache_read > 0) | 341/342 (99.7%) |
| Costo speso in questo giro | 0.015208 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.12542 $ · 0.000354 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 292 · 50 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 128.6 s |

Strati del campione: elimina-senza-si 0 · conferme-senza-sospeso 1 · vocali-asr 0 · prezzi-lettere 0 · preamboli 0 · correzioni-anzi 0 · multi-turno 0 · dialetto 0 · nomi-insidiosi 0 · altro 186

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| comando-perso | 1 | 0 | 0 |
| formula-non-applicata | 1 | 0 | 0 |
| sostituzione-incompleta | 1 | 0 | 0 |
| nome-alterato | 0 | 14 | 0 |
| chiede-invece-di-agire | 0 | 4 | 0 |

## Falliti (trascrizione)

### as-numeri-02 [GRAVE]
- titolare: il tiramisu a sei euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Tiramisù* è già a *6 €*.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** comando-perso: turno 1: «il tiramisu a sei euro» né eseguito né una domanda («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Tiramisù*»)

### as-lunghe-04 [GRAVE]
- titolare: a cena il solo primo a 9,50 e alla carta la margherita a 7,50
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Per «a cena il solo primo a 9,50 e alla carta la margherita a 7,50» mi manca un dettaglio: qual è il nome esatto del piatto (o del sottomenu) e cosa devo cambiare? Per esempio «la carbonara a 12». Non ancora pubblicato: 1. *Margherita*: prezzo da 7,00 € a *7,50 €*»
- atteso: price|Margherita|7.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Margherita|7.5
- **GRAVE** formula-non-applicata: turno 1: «Menu cena» resta fisso · complet=16.9 · sol prim=9 · sol second=10, atteso fisso · complet=16.9 · sol prim=9.5 · sol second=10

### as-sessione-05 [GRAVE]
- titolare: modifichiamo menu cena
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, modifichiamo i piatti di oggi del *Menu cena*: cosa metto in *Primi*, *Secondi*, *Contorni*? Puoi scrivere tutto insieme o un pezzo alla volta; se un sottomenu resta com’è, dimmelo.»
- titolare: primi tagliatelle al ragù e carbonara
  - bot: «Segnato: *Primi* (Tagliatelle al ragù, Carbonara). E per *Secondi* e *Contorni* cosa metto? Se qualcuno resta com’è dimmelo.»
- titolare: no la carbonara toglila
  - bot: «Ok, tolgo la *Carbonara* dai *Primi*. Per *Secondi* e *Contorni* cosa metto?»
- titolare: secondi e contorni come ieri
  - bot: «Ci sto lavorando… Non ho l'elenco di ieri, quindi non so cosa rimettere. Quali piatti vanno in *Secondi* e in *Contorni* per stasera?»
- atteso: hidden|Gnocchi al pomodoro|true, hidden|Spaghetti alle vongole|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Gnocchi al pomodoro|true, hidden|Spaghetti alle vongole|true
- **GRAVE** sostituzione-incompleta: turno 4: «Menu cena > Primi»: «Spaghetti alle vongole» visibile ma non detto; «Gnocchi al pomodoro» visibile ma non detto

### as-si-02 [MEDIO]
- titolare: 🎤 aggiungi gnocchi al ragu in menu pranzo a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Gnocchi al ragu*: creo il sottomenu *Primi* e lo metto lì a *10,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: si
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Gnocchi al ragu* in *Primi*: *10,00 €*»
- atteso: create|gnocchi al ragu|10|primi · ottenuto: create|gnocchi al ragu|10|primi
- **MEDIO** nome-alterato: «Gnocchi al ragu» invece di «Gnocchi al ragù»

### as-si-03 [MEDIO]
- titolare: 🎤 aggiungi gnocchi al ragu in menu pranzo a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Gnocchi al ragu*: creo il sottomenu *Primi* e lo metto lì a *10,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: sì
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Gnocchi al ragu* in *Primi*: *10,00 €*»
- atteso: create|gnocchi al ragu|10|primi · ottenuto: create|gnocchi al ragu|10|primi
- **MEDIO** nome-alterato: «Gnocchi al ragu» invece di «Gnocchi al ragù»

### as-si-08 [MEDIO]
- titolare: 🎤 aggiungi gnocchi al ragu in menu pranzo a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Gnocchi al ragu*: creo il sottomenu *Primi* e lo metto lì a *10,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: esatto
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Gnocchi al ragu* in *Primi*: *10,00 €*»
- atteso: create|gnocchi al ragu|10|primi · ottenuto: create|gnocchi al ragu|10|primi
- **MEDIO** nome-alterato: «Gnocchi al ragu» invece di «Gnocchi al ragù»

### as-si-09 [MEDIO]
- titolare: 🎤 aggiungi gnocchi al ragu in menu pranzo a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Gnocchi al ragu*: creo il sottomenu *Primi* e lo metto lì a *10,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: va bene
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Gnocchi al ragu* in *Primi*: *10,00 €*»
- atteso: create|gnocchi al ragu|10|primi · ottenuto: create|gnocchi al ragu|10|primi
- **MEDIO** nome-alterato: «Gnocchi al ragu» invece di «Gnocchi al ragù»

### as-si-14 [MEDIO]
- titolare: 🎤 aggiungi gnocchi al ragu in menu pranzo a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Gnocchi al ragu*: creo il sottomenu *Primi* e lo metto lì a *10,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: sì grazie
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Gnocchi al ragu* in *Primi*: *10,00 €*»
- atteso: create|gnocchi al ragu|10|primi · ottenuto: create|gnocchi al ragu|10|primi
- **MEDIO** nome-alterato: «Gnocchi al ragu» invece di «Gnocchi al ragù»

### as-si-15 [MEDIO]
- titolare: 🎤 aggiungi gnocchi al ragu in menu pranzo a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Gnocchi al ragu*: creo il sottomenu *Primi* e lo metto lì a *10,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: sì voglio chiamarlo primi
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Gnocchi al ragu* in *Primi*: *10,00 €*»
- atteso: create|gnocchi al ragu|10|primi · ottenuto: create|gnocchi al ragu|10|primi
- **MEDIO** nome-alterato: «Gnocchi al ragu» invece di «Gnocchi al ragù»

### as-si-20 [MEDIO]
- titolare: 🎤 aggiungi gnocchi al ragu in menu pranzo a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Gnocchi al ragu*: creo il sottomenu *Primi* e lo metto lì a *10,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: perfetto
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Gnocchi al ragu* in *Primi*: *10,00 €*»
- atteso: create|gnocchi al ragu|10|primi · ottenuto: create|gnocchi al ragu|10|primi
- **MEDIO** nome-alterato: «Gnocchi al ragu» invece di «Gnocchi al ragù»

### as-si-21 [MEDIO]
- titolare: 🎤 aggiungi gnocchi al ragu in menu pranzo a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Gnocchi al ragu*: creo il sottomenu *Primi* e lo metto lì a *10,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: ok vai
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Gnocchi al ragu* in *Primi*: *10,00 €*»
- atteso: create|gnocchi al ragu|10|primi · ottenuto: create|gnocchi al ragu|10|primi
- **MEDIO** nome-alterato: «Gnocchi al ragu» invece di «Gnocchi al ragù»

### as-si-26 [MEDIO]
- titolare: 🎤 aggiungi gnocchi al ragu in menu pranzo a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Gnocchi al ragu*: creo il sottomenu *Primi* e lo metto lì a *10,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: si si crealo pure
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Gnocchi al ragu* in *Primi*: *10,00 €*»
- atteso: create|gnocchi al ragu|10|primi · ottenuto: create|gnocchi al ragu|10|primi
- **MEDIO** nome-alterato: «Gnocchi al ragu» invece di «Gnocchi al ragù»

### as-si-27 [MEDIO]
- titolare: 🎤 aggiungi gnocchi al ragu in menu pranzo a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Gnocchi al ragu*: creo il sottomenu *Primi* e lo metto lì a *10,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: va benissimo
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Gnocchi al ragu* in *Primi*: *10,00 €*»
- atteso: create|gnocchi al ragu|10|primi · ottenuto: create|gnocchi al ragu|10|primi
- **MEDIO** nome-alterato: «Gnocchi al ragu» invece di «Gnocchi al ragù»

### as-si-32 [MEDIO]
- titolare: 🎤 aggiungi gnocchi al ragu in menu pranzo a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Gnocchi al ragu*: creo il sottomenu *Primi* e lo metto lì a *10,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: d'accordo
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Gnocchi al ragu* in *Primi*: *10,00 €*»
- atteso: create|gnocchi al ragu|10|primi · ottenuto: create|gnocchi al ragu|10|primi
- **MEDIO** nome-alterato: «Gnocchi al ragu» invece di «Gnocchi al ragù»

### as-catena-04 [MEDIO]
- titolare: 🎤 aggiungi gnocchi al ragu in menu pranzo a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Gnocchi al ragu*: creo il sottomenu *Primi* e lo metto lì a *10,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: si
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Gnocchi al ragu* in *Primi*: *10,00 €*»
- titolare: si
  - bot: «Non ho cambiato nulla.»
- atteso: create|gnocchi al ragu|10|primi · ottenuto: create|gnocchi al ragu|10|primi
- **MEDIO** nome-alterato: «Gnocchi al ragu» invece di «Gnocchi al ragù»

### as-catena-05 [MEDIO]
- titolare: 🎤 aggiungi gnocchi al ragu in menu pranzo a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Gnocchi al ragu*: creo il sottomenu *Primi* e lo metto lì a *10,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: ok
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Gnocchi al ragu* in *Primi*: *10,00 €*»
- titolare: sì
  - bot: «Non ho cambiato nulla.»
- atteso: create|gnocchi al ragu|10|primi · ottenuto: create|gnocchi al ragu|10|primi
- **MEDIO** nome-alterato: «Gnocchi al ragu» invece di «Gnocchi al ragù»

### as-catena-06 [MEDIO]
- titolare: 🎤 aggiungi gnocchi al ragu in menu pranzo a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Gnocchi al ragu*: creo il sottomenu *Primi* e lo metto lì a *10,00 €*? Rispondi *sì* oppure dimmi il nome del sottomenu.»
- titolare: si
  - bot: «Nuovo Sottomenu *Primi* nel Menu *Menu pranzo* Nuovo piatto *Gnocchi al ragu* in *Primi*: *10,00 €*»
- titolare: ok
  - bot: «Non ho cambiato nulla.»
- titolare: si
  - bot: «Non ho cambiato nulla.»
- atteso: create|gnocchi al ragu|10|primi · ottenuto: create|gnocchi al ragu|10|primi
- **MEDIO** nome-alterato: «Gnocchi al ragu» invece di «Gnocchi al ragù»

### as-metti-02 [MEDIO]
- titolare: metti la bufalina tra le pizze a 10
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Per «metti la bufalina tra le pizze a 10» mi manca un dettaglio: qual è il nome esatto del piatto (o del sottomenu) e cosa devo cambiare? Per esempio «la carbonara a 12».»
- atteso: create|bufalina|10|pizze · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|bufalina|10|pizze

### as-metti-03 [MEDIO]
- titolare: metti la lasagna nei primi del pranzo
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Per «metti la lasagna nei primi del pranzo» mi manca un dettaglio: qual è il nome esatto del piatto (o del sottomenu) e cosa devo cambiare? Per esempio «la carbonara a 12».»
- atteso: create|lasagna|0|primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|lasagna|0|primi

