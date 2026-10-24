# Motore Haiku · set notte-caccia · replay

Generato da tests/eval/eval-haiku.test.ts (2026-10-24T17:32:17.257Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **8/14 (57.1%)** |
| Non misurate (cache assente / tetto / errore) | 107 — cc-giornata-01, cc-giornata-02, cc-giornata-03, cc-giornata-04, cc-giornata-05, cc-giornata-06, cc-annulla-01, cc-annulla-02, cc-annulla-03, cc-scaduta-01, cc-scaduta-02, cc-scaduta-03, cc-scaduta-04, cc-scaduta-05, cc-scaduta-06 |
| GRAVI (conversazioni) | 3 — sicurezza 3, altri 0 |
| MEDI | 3 |
| Domande ogni 10 messaggi | 4 (non attese 3.5) |
| Latenza chiamata Haiku p50 / p95 | 0 / 0 ms (0 chiamate) |
| Latenza turno p50 / p95 | 8 / 25 ms (harness + latenza Haiku registrata) |
| Chiamate Haiku per messaggio | 0 |
| Token medi per messaggio (in · out · cache read · cache write) | 0 · 0 · 0 · 0 |
| Cache hit (cache_read > 0) | 0/0 (0%) |
| Costo speso in questo giro | 0 $ (tetto 0.5 $) |
| Costo equivalente dal vivo · per messaggio | 0 $ · 0 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 0 · 0 · 0 · 240 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 5.1 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta (sicurezza) | 12 | 0 | 0 |
| visibilita-non-richiesta (sicurezza) | 3 | 0 | 0 |
| risposta-senza-contenuto | 0 | 6 | 0 |

## Falliti (trascrizione)

### cc-b1-12 [GRAVE] — v145: «tutti i <sottomenu>» = il sottomenu nascosto (una domanda, poi sì), non i piatti uno per uno
- titolare: nascondi tutti i dolci
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Elimino tutti i 4 piatti dei *Dolci* del Menu *Pranzo e cena*? Il sottomenu resta. Rispondi *sì* per eliminarli, oppure *no*. Da eliminare, serve il tuo sì: 1. *Tiramisù*: da eliminare 2. *Maritozzo con la panna*: da eliminare 3. *Crostata di visciole*: da eliminare 4. *Panna cotta*: da eliminare»
- titolare: sì
  - bot: «*Tiramisù*: *eliminato* dal menu *Maritozzo con la panna*: *eliminato* dal menu *Crostata di visciole*: *eliminato* dal menu *Panna cotta*: *eliminato* dal menu»
- atteso: nessuna modifica · ottenuto: delete|Crostata di visciole, delete|Maritozzo con la panna, delete|Panna cotta, delete|Tiramisù
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Crostata di visciole
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Maritozzo con la panna
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Panna cotta
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Tiramisù
- **GRAVE** visibilita-non-richiesta: dopo il turno 2: «Pranzo e cena>Dolci» è visibile ai clienti senza che il titolare l'abbia chiesto

### cc-v145-12 [GRAVE]
- titolare: nascondi tutti i dolci della cena
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Elimino tutti i 3 piatti dei *Dolci* del *Menu cena*? Il sottomenu resta. Rispondi *sì* per eliminarli, oppure *no*. Da eliminare, serve il tuo sì: 1. *Tiramisù della casa*: da eliminare 2. *Panna cotta ai frutti di bosco*: da eliminare 3. *Cheesecake*: da eliminare»
- titolare: sì
  - bot: «*Tiramisù della casa*: *eliminato* dal menu *Panna cotta ai frutti di bosco*: *eliminato* dal menu *Cheesecake*: *eliminato* dal menu»
- atteso: nessuna modifica · ottenuto: delete|Cheesecake, delete|Panna cotta ai frutti di bosco, delete|Tiramisù della casa
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Cheesecake
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Panna cotta ai frutti di bosco
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Tiramisù della casa
- **GRAVE** visibilita-non-richiesta: dopo il turno 2: «Menu cena>Dolci» è visibile ai clienti senza che il titolare l'abbia chiesto

### cc-v145-13 [GRAVE]
- titolare: nascondi tutti i fritti
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Elimino tutti i 5 piatti dei *Fritti* del Menu *Cena*? Il sottomenu resta. Rispondi *sì* per eliminarli, oppure *no*. Da eliminare, serve il tuo sì: 1. *Frittatina di pasta*: da eliminare 2. *Frittatina di patate*: da eliminare 3. *Crocchè*: da eliminare 4. *Montanarina*: da eliminare 5. *Arancino*: da elimin»
- titolare: sì
  - bot: «*Frittatina di pasta*: *eliminato* dal menu *Frittatina di patate*: *eliminato* dal menu *Crocchè*: *eliminato* dal menu *Montanarina*: *eliminato* dal menu *Arancino*: *eliminato* dal menu»
- atteso: nessuna modifica · ottenuto: delete|Arancino, delete|Crocchè, delete|Frittatina di pasta, delete|Frittatina di patate, delete|Montanarina
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Arancino
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Crocchè
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Frittatina di pasta
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Frittatina di patate
- **GRAVE** modifica-non-richiesta: non richiesto: delete|Montanarina
- **GRAVE** visibilita-non-richiesta: dopo il turno 2: «Cena>Fritti» è visibile ai clienti senza che il titolare l'abbia chiesto

### cc-primo-contatto-01 [MEDIO] — risposta breve del server su cosa sa fare
- titolare: ❓ buonasera, cosa sai fare?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Scrivimi come a un collega, anche con un vocale. Per esempio: • «togli i primi del pranzo», poi «inserisci lasagna, carbonara» • «la carbonara è finita» • «aggiungi la panna cotta a 5 nei dolci» • «annulla» per tornare indietro»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** risposta-senza-contenuto: turno 1: manca /prezz/i («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)
- **MEDIO** risposta-senza-contenuto: turno 1: manca /nuov/i («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### cc-primo-contatto-02 [MEDIO]
- titolare: ❓ come funziona?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Scrivimi come a un collega, anche con un vocale. Per esempio: • «togli i primi del pranzo», poi «inserisci lasagna, carbonara» • «la carbonara è finita» • «aggiungi la panna cotta a 5 nei dolci» • «annulla» per tornare indietro»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** risposta-senza-contenuto: turno 1: manca /prezz/i («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)
- **MEDIO** risposta-senza-contenuto: turno 1: manca /piatti nuovi/i («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)

### cc-primo-contatto-04 [MEDIO]
- titolare: ❓ che sai fare
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Scrivimi come a un collega, anche con un vocale. Per esempio: • «togli i primi del pranzo», poi «inserisci lasagna, carbonara» • «la carbonara è finita» • «aggiungi la panna cotta a 5 nei dolci» • «annulla» per tornare indietro»
- titolare: aiuto
  - bot: «Scrivimi come a un collega, anche con un vocale. Per esempio: • «togli i primi del pranzo», poi «inserisci lasagna, carbonara» • «la carbonara è finita» • «aggiungi la panna cotta a 5 nei dolci» • «annulla» per tornare indietro»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** risposta-senza-contenuto: turno 1: manca /prezz/i («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. »)
- **MEDIO** risposta-senza-contenuto: turno 2: manca /prezz/i («Scrivimi come a un collega, anche con un vocale. Per esempio: • «togli i primi del pranzo»»)

