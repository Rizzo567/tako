# Motore Haiku · set qa-continua · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-22T00:32:52.543Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **0/1 (0%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 2.4 (non attese 2.4) |
| Latenza chiamata Haiku p50 / p95 | 1699 / 3411 ms (69 chiamate) |
| Latenza turno p50 / p95 | 1747 / 4316 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.1 |
| Token medi per messaggio (in · out · cache read · cache write) | 886 · 238 · 10504 · 276 |
| Cache hit (cache_read > 0) | 68/69 (98.6%) |
| Costo speso in questo giro | 0.021866 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.021866 $ · 0.000347 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 0 · 69 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 136.7 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| risposta-senza-contenuto | 0 | 3 | 0 |
| risposta-vietata | 0 | 3 | 0 |
| non-applicato | 0 | 3 | 0 |

## Falliti (trascrizione)

### qa-continua [MEDIO]
- titolare: aggiungi il vitello tonnato
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. In quale Sottomenu lo metto e a che prezzo vuoi *Vitello tonnato*?»
- titolare: annulla
  - bot: «Ci sto lavorando… Ok, lascio stare: non ho cambiato nulla.»
- titolare: [+2 min]
  - bot: «Il *Riso giallo* costa 8 €. *riso giallo*: *8,00 €* · disponibile»
- titolare: quanto costa il riso giallo?
  - bot: «Il *Riso giallo* costa 8 €. *riso giallo*: *8,00 €* · disponibile»
- titolare: [+2 min]
  - bot: «Alzo di un euro il *tiramisù*? Dimmi quale piatto e di quanto.»
- titolare: quanto costa il riso giallo?
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: alzalo di un euro
  - bot: «La *Pasta carbonara* costa 9 €. *pasta carbonara*: *9,00 €* · disponibile»
- titolare: annulla
  - bot: «Intendi la *Pasta carbonara* a 10 €?»
- titolare: [+2 min]
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: quanto costa la pasta carbonara?
  - bot: «La *Pasta al ragù* costa 10 €. *pasta al ragù*: *10,00 €* · disponibile»
- titolare: mettila a 10
  - bot: «*pasta al ragù*: *nascosto* dal menu»
- titolare: annulla
  - bot: «Rimetto in menu la *Pasta al ragù*. *pasta al ragù*: di nuovo *visibile* nel menu»
- titolare: [+2 min]
  - bot: «Sì, il *tiramisù* c'è nel menu a 15 €. *tiramisù*: *15,00 €* · disponibile»
- titolare: quanto costa la pasta al ragù?
  - bot: «Non ho cambiato nulla. 1. *pasta al ragù* (10,00 €)»
- titolare: toglila
  - bot: «*pasta al ragù* è già disponibile.»
- titolare: rimettila
  - bot: «In quale Sottomenu vuoi mettere le *Patatine fritte*, e a che prezzo?»
- titolare: [+2 min]
  - bot: «Ti serve sapere in quale Sottomenu e a che prezzo: in quale Sottomenu la metto, e a quanto?»
- titolare: c'è il tiramisù?
  - bot: «Aggiungo le *Patatine fritte* a 4 € nei *Piatti di prova*. Nuovo piatto *Patatine fritte* in *Piatti di prova*: *4,00 €*»
- titolare: è finito
  - bot: «Annullo l'ultima modifica: le *Patatine fritte* tornano come prima. *Patatine fritte*: tolto (era stato aggiunto)»
- titolare: è tornato
  - bot: «Ok, *4,00 €*. In quale sottomenu metto *Patatine fritte*? Rispondi col numero o col nome. 1. *Piatti di prova* (Menu di verifica · web QA) 2. *Primi* (Menu di verifica · web QA) 3. *Completo* (Menu pranzo)»
- titolare: [+2 min]
  - bot: «Nuovo piatto *Patatine fritte* in *Primi*: *4,00 €*»
- titolare: aggiungi le patatine fritte
  - bot: «Annullo l'ultima pubblicazione: tolgo le *Patatine fritte* appena aggiunte. *Patatine fritte*: tolto (era stato aggiunto)»
- titolare: 4
  - bot: «Cosa vuoi cambiare? Scrivimi il piatto e la modifica, per esempio «la carbonara a 12».»
- titolare: nei Piatti di prova
  - bot: «Nuovo piatto *Vitello tonnato* in *Primi*: *14,00 €*»
- titolare: annulla
  - bot: «Annullo l'ultima pubblicazione: tolgo il *Vitello tonnato* appena aggiunto. *Vitello tonnato*: tolto (era stato aggiunto)»
- titolare: [+2 min]
  - bot: «Ok, *4,00 €*. In quale sottomenu metto *Patatine fritte*? Rispondi col numero o col nome. 1. *Piatti di prova* (Menu di verifica · web QA) 2. *Primi* (Menu di verifica · web QA) 3. *Completo* (Menu pranzo)»
- titolare: aggiungi patatine fritte a 4
  - bot: «Scegli il sottomenu per *Patatine fritte* (4,00 €): rispondi col numero o col nome. 1. *Piatti di prova* (Menu di verifica · web QA) 2. *Primi* (Menu di verifica · web QA) 3. *Completo* (Menu pranzo)»
- titolare: nei Primi del Menu di verifica
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: annulla
  - bot: «Il *riso giallo* costa *8 €* e la *pasta carbonara* costa *9 €*. *riso giallo*: *8,00 €* · disponibile *pasta carbonara*: *9,00 €* · disponibile»
- titolare: [+2 min]
  - bot: «Aumentati di 0,50 € i prezzi di 2 piatti. *pasta carbonara*: prezzo da 9,00 € a *9,50 €* *riso giallo*: prezzo da 8,00 € a *8,50 €* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: aggiungi il vitello tonnato nei Primi del Menu di verifica
  - bot: «Annullo l'ultima pubblicazione: ripristino il prezzo di *pasta carbonara* e *riso giallo*. *pasta carbonara*: com’era prima *riso giallo*: com’era prima»
- titolare: 14
  - bot: «Aumentati di 0,50 € i prezzi di 4 piatti. *la parmigiana*: prezzo da 12,50 € a *13,00 €* *pasta al pesto*: prezzo da 9,00 € a *9,50 €* *pasta carbonara*: prezzo da 9,00 € a *9,50 €* *riso giallo*: prezzo da 8,00 € a *8,50 €* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: annulla
  - bot: «Annullo l'ultima pubblicazione: ripristino i prezzi di *la parmigiana*, *pasta al pesto*, *pasta carbonara* e *riso giallo*. *la parmigiana*: com’era prima *pasta al pesto*: com’era prima *pasta carbonara*: com’era prima *riso giallo*: com’era prima»
- titolare: [+2 min]
  - bot: «Ci sto lavorando… Aumentati di 0,50 € i prezzi di 4 piatti. *la parmigiana*: prezzo da 12,50 € a *13,00 €* *pasta al pesto*: prezzo da 9,00 € a *9,50 €* *pasta carbonara*: prezzo da 9,00 € a *9,50 €* *riso giallo*: prezzo da 8,00 € a *8,50 €* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: aggiungi patatine fritte a 4
  - bot: «Annullo l'ultima pubblicazione: ripristino i prezzi di *la parmigiana*, *pasta al pesto*, *pasta carbonara* e *riso giallo*. *la parmigiana*: com’era prima *pasta al pesto*: com’era prima *pasta carbonara*: com’era prima *riso giallo*: com’era prima»
- titolare: sì
  - bot: «Ok, metto il *riso giallo* a *8,50 €*. *riso giallo*: prezzo da 8,00 € a *8,50 €*»
- titolare: lascia stare
  - bot: «Annullo l'ultima pubblicazione: ripristino il prezzo di *riso giallo*. *riso giallo*: com’era prima»
- titolare: [+2 min]
  - bot: «Ok, metto la *Pasta al sugo* a *10,50 €*. *Pasta al sugo*: prezzo da 9,00 € a *10,50 €*»
- titolare: quanto costano il riso giallo e la pasta carbonara?
  - bot: «Annullo l'ultima pubblicazione: ripristino il prezzo di *Pasta al sugo*. *Pasta al sugo*: com’era prima»
- titolare: alzali tutti e due di 50 centesimi
  - bot: «Nascondo il *riso giallo* dal menu. *riso giallo*: *nascosto* dal menu»
- titolare: annulla
  - bot: «Rimetto il *riso giallo* nel menu. *riso giallo*: di nuovo *visibile* nel menu»
- titolare: [+2 min]
  - bot: «Ok, segno la *Pasta al sugo* come esaurita. *Pasta al sugo*: *finito*»
- titolare: alza di 50 centesimi i primi del Menu di verifica
  - bot: «Ok, rimetto la *Pasta al sugo* disponibile. *Pasta al sugo*: di nuovo *disponibile*»
- titolare: annulla
  - bot: «Elimino la *Pasta al sugo* dal menu? Rispondi sì. Da eliminare, serve il tuo sì: 1. *Pasta al sugo*: da eliminare»
- titolare: [+2 min]
  - bot: «Ok, annullo l'eliminazione della *Pasta al sugo*. Non elimino nulla.»
- titolare: alza di 50 centesimi i primi
  - bot: «Intendi *azzerare* il prezzo di tutti i piatti? Dimmi quale Menu o quali piatti vuoi toccare.»
- titolare: annulla
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: [+2 min]
  - bot: «Ci sto lavorando… Intendi i *Primi* del Menu di verifica o quelli del Menu del giorno? 1. *pasta al ragù* (10,00 €) 2. *la parmigiana* (12,50 €) 3. *pasta al pesto* (9,00 €) 4. *pasta carbonara* (9,00 €) 5. *riso giallo* (8,00 €)»
- titolare: il riso giallo a otto e cinquanta
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: annulla
  - bot: «Non ancora pubblicato, da confermare con OK: 1. *riso giallo*: prezzo da 8,00 € a *9,00 €* 2. *pasta carbonara*: prezzo da 9,00 € a *10,00 €* 3. *Pasta al sugo*: prezzo da 9,00 € a *10,00 €* 4. *tiramisù*: prezzo da 15,00 € a *16,00 €*»
- titolare: [+2 min]
  - bot: «Ok, pubblico le modifiche in sospeso. *riso giallo*: prezzo da 8,00 € a *9,00 €* *pasta carbonara*: prezzo da 9,00 € a *10,00 €* *Pasta al sugo*: prezzo da 9,00 € a *10,00 €* *tiramisù*: prezzo da 15,00 € a *16,00 €*»
- titolare: la pasta al sugo a dieci euro e mezzo
  - bot: «Ok, annullo l'ultima pubblicazione: torno ai prezzi di prima per *Pasta al sugo*, *tiramisù*, *pasta carbonara* e *riso giallo*. *Pasta al sugo*: com’era prima *tiramisù*: com’era prima *pasta carbonara*: com’era prima *riso giallo*: com’era prima»
- titolare: annulla
  - bot: «Intendi la *pasta al pesto* o la *Pasta al pesto e lasagna*? 1. *pasta al pesto* (9,00 €) 2. *Pasta al pesto e lasagna* (10,01 €)»
- titolare: [+2 min]
  - bot: «*pasta al pesto*: prezzo da 9,00 € a *10,00 €*»
- titolare: nascondi il riso giallo
  - bot: «Ok, annullo l'ultima pubblicazione: torno al prezzo di prima per *pasta al pesto*. *pasta al pesto*: com’era prima»
- titolare: mostralo di nuovo
  - bot: «Nei *Primi* del Menu di verifica ci sono: *la parmigiana*, *pasta al pesto*, *pasta carbonara* e *riso giallo*. *la parmigiana*: *12,50 €* · disponibile *pasta al pesto*: *9,00 €* · disponibile *pasta carbonara*: *9,00 €* · disponibile *riso giallo*: *8,00 €* · disponibile»
- titolare: [+2 min]
  - bot: «Nei *Primi* del *Menu di verifica · web QA* ci sono 2 piatti: *pasta al pesto*: *9,00 €* · disponibile *pasta carbonara*: *9,00 €* · disponibile»
- titolare: la pasta al sugo è finita
  - bot: «Intendi *8 €* o *80 €* per il *riso giallo*?»
- titolare: la pasta al sugo è tornata
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: [+2 min]
  - bot: «Ok, cambio il prezzo del *riso giallo* a *9,00 €*. *riso giallo*: prezzo da 8,00 € a *9,00 €*»
- titolare: elimina la pasta al sugo
  - bot: «Ok, rimetto il *riso giallo* a *8,00 €*. *riso giallo*: prezzo da 9,00 € a *8,00 €*»
- titolare: annulla
  - bot: «Per «togli la carbonara» intendi *Carbonara*? Rispondi sì oppure dimmi il nome giusto. Non salvato: *pasta carbonara*: *nascosto* dal menu 1. *Carbonara* (0,00 €)»
- titolare: [+2 min]
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: metti tutto a zero
  - bot: «»
- titolare: no
  - bot: «»
- titolare: [+2 min]
  - bot: «»
- titolare: elimina tutti i primi
  - bot: «»
- titolare: no
  - bot: «»
- titolare: [+2 min]
  - bot: «»
- titolare: riso giallo a 9, pasta carbonara a 10, pasta al sugo a 10, tiramisù a 16
  - bot: «»
- titolare: 👍
  - bot: «»
- titolare: annulla
  - bot: «»
- titolare: [+2 min]
  - bot: «»
- titolare: alza il pesto di un euro
  - bot: «»
- titolare: la pasta al pesto dei primi
  - bot: «»
- titolare: annulla
  - bot: «»
- titolare: [+2 min]
  - bot: «»
- titolare: cosa c'è nei primi?
  - bot: «»
- titolare: [+2 min]
  - bot: «»
- titolare: quante paste ho nei primi?
  - bot: «»
- titolare: [+2 min]
  - bot: «»
- titolare: il riso giallo a 80
  - bot: «»
- titolare: no
  - bot: «»
- titolare: [+2 min]
  - bot: «»
- titolare: il riso giallo a 9
  - bot: «»
- titolare: anzi rimettilo a 8
  - bot: «»
- titolare: [+2 min]
  - bot: «»
- titolare: togli la carbonara
  - bot: «»
- titolare: annulla
  - bot: «»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** risposta-senza-contenuto: [pronome-alzalo] turno 5: manca /\b9\b/i («Alzo di un euro il *tiramisù*? Dimmi quale piatto e di quanto.»)
- **MEDIO** risposta-vietata: [pronome-alzalo] turno 5: contiene /intendi|\?/i («Alzo di un euro il *tiramisù*? Dimmi quale piatto e di quanto.»)
- **MEDIO** non-applicato: [pronome-alzalo] turno 5: menu mancano [price|riso giallo|9] in più [] («Alzo di un euro il *tiramisù*? Dimmi quale piatto e di quanto.»)
- **MEDIO** risposta-vietata: [pronome-mettila] turno 8: contiene /\?/i («Intendi la *Pasta carbonara* a 10 €?»)
- **MEDIO** non-applicato: [pronome-mettila] turno 8: menu mancano [price|pasta carbonara|10] in più [] («Intendi la *Pasta carbonara* a 10 €?»)
- **MEDIO** non-applicato: [pronome-finito] turno 14: menu mancano [available|tiramisù|false] in più [] («Non ho cambiato nulla. 1. *pasta al ragù* (10,00 €)»)
- **MEDIO** risposta-senza-contenuto: [nuovo-solo-prezzo] turno 17: manca /\b4\b/i («Ti serve sapere in quale Sottomenu e a che prezzo: in quale Sottomenu la metto, e a quanto?»)
- **MEDIO** risposta-vietata: [nuovo-solo-prezzo] turno 17: contiene /prezz.*\?/i («Ti serve sapere in quale Sottomenu e a che prezzo: in quale Sottomenu la metto, e a quanto?»)
- **MEDIO** risposta-senza-contenuto: [nuovo-solo-sottomenu] turno 23: manca /prezz|quanto/i («Cosa vuoi cambiare? Scrivimi il piatto e la modifica, per esempio «la carbonara a 12».»)

