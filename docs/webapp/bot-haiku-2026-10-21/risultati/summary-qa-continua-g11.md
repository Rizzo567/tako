# Motore Haiku · set qa-continua · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-22T02:45:09.578Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **1/2 (50%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 1.7 (non attese 1.7) |
| Latenza chiamata Haiku p50 / p95 | 2463 / 4486 ms (192 chiamate) |
| Latenza turno p50 / p95 | 39 / 5530 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 0.89 |
| Token medi per messaggio (in · out · cache read · cache write) | 711 · 184 · 8685 · 64 |
| Cache hit (cache_read > 0) | 192/192 (100%) |
| Costo speso in questo giro | 0.035613 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.055748 $ · 0.000258 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 70 · 122 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 349.8 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| risposta-vietata | 0 | 1 | 0 |
| non-applicato | 0 | 1 | 0 |

## Falliti (trascrizione)

### qa-continua-rapida [MEDIO]
- titolare: aggiungi il vitello tonnato
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. In quale sottomenu metto *Vitello tonnato* e a che prezzo?»
- titolare: annulla
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: quanto costa il riso giallo?
  - bot: «Il *riso giallo* costa 8 €. *riso giallo*: *8,00 €* · disponibile»
- titolare: quanto costa il riso giallo?
  - bot: «Il *riso giallo* costa 8 €. *riso giallo*: *8,00 €* · disponibile»
- titolare: alzalo di un euro
  - bot: «*riso giallo*: prezzo da 8,00 € a *9,00 €*»
- titolare: annulla
  - bot: «Annullo l'ultima modifica sul *riso giallo*. *riso giallo*: com’era prima»
- titolare: quanto costa la pasta carbonara?
  - bot: «La *pasta carbonara* costa *9 €*. *pasta carbonara*: *9,00 €* · disponibile»
- titolare: mettila a 10
  - bot: «*pasta carbonara*: prezzo da 9,00 € a *10,00 €*»
- titolare: annulla
  - bot: «Annullo l'ultima modifica sulla *pasta carbonara*. *pasta carbonara*: com’era prima»
- titolare: quanto costa la pasta al ragù?
  - bot: «La *pasta al ragù* costa *10 €*. *pasta al ragù*: *10,00 €* · disponibile»
- titolare: toglila
  - bot: «*pasta al ragù*: *nascosto* dal menu»
- titolare: rimettila
  - bot: «*pasta al ragù*: di nuovo *visibile* nel menu»
- titolare: c'è il tiramisù?
  - bot: «Sì, il *tiramisù* c'è nel menu, disponibile. *tiramisù*: *15,00 €* · disponibile»
- titolare: è finito
  - bot: «*tiramisù*: *finito*»
- titolare: è tornato
  - bot: «*tiramisù*: di nuovo *disponibile*»
- titolare: aggiungi le patatine fritte
  - bot: «In quale sottomenu metto *Patatine fritte* e a che prezzo?»
- titolare: 4
  - bot: «Ok, *4,00 €*. In quale sottomenu metto *Patatine fritte*? Rispondi col numero o col nome. 1. *Piatti di prova* (Menu di verifica · web QA) 2. *Primi* (Menu di verifica · web QA)»
- titolare: nei Piatti di prova
  - bot: «Nuovo piatto *Patatine fritte* in *Piatti di prova*: *4,00 €*»
- titolare: annulla
  - bot: «Annullo l'ultima pubblicazione: *Patatine fritte*. *Patatine fritte*: tolto (era stato aggiunto)»
- titolare: aggiungi patatine fritte a 4
  - bot: «Ok, *4,00 €*. In quale sottomenu metto *Patatine fritte*? Rispondi col numero o col nome. 1. *Piatti di prova* (Menu di verifica · web QA) 2. *Primi* (Menu di verifica · web QA)»
- titolare: nei Primi del Menu di verifica
  - bot: «Nuovo piatto *Patatine fritte* in *Primi*: *4,00 €*»
- titolare: annulla
  - bot: «Annullo l'ultima pubblicazione: *Patatine fritte*. *Patatine fritte*: tolto (era stato aggiunto)»
- titolare: aggiungi il vitello tonnato nei Primi del Menu di verifica
  - bot: «Quanto costa il *Vitello tonnato*?»
- titolare: 14
  - bot: «Nuovo piatto *Vitello tonnato* in *Primi*: *14,00 €*»
- titolare: annulla
  - bot: «Annullo l'ultima pubblicazione: *Vitello tonnato*. *Vitello tonnato*: tolto (era stato aggiunto)»
- titolare: aggiungi patatine fritte a 4
  - bot: «Ok, *4,00 €*. In quale sottomenu metto *Patatine fritte*? Rispondi col numero o col nome. 1. *Piatti di prova* (Menu di verifica · web QA) 2. *Primi* (Menu di verifica · web QA)»
- titolare: sì
  - bot: «Scegli il sottomenu per *Patatine fritte* (4,00 €): rispondi col numero o col nome. 1. *Piatti di prova* (Menu di verifica · web QA) 2. *Primi* (Menu di verifica · web QA)»
- titolare: lascia stare
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: quanto costano il riso giallo e la pasta carbonara?
  - bot: «Il *Riso giallo* e la *Pasta carbonara* sono nel menu con i loro prezzi attuali. *riso giallo*: *8,00 €* · disponibile *pasta carbonara*: *9,00 €* · disponibile»
- titolare: alzali tutti e due di 50 centesimi
  - bot: «Aumentati di 0,50 € i prezzi di 2 piatti. *pasta carbonara*: prezzo da 9,00 € a *9,50 €* *riso giallo*: prezzo da 8,00 € a *8,50 €* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: annulla
  - bot: «Annullo l'ultima pubblicazione: *pasta carbonara* e *riso giallo*. *pasta carbonara*: com’era prima *riso giallo*: com’era prima»
- titolare: alza di 50 centesimi i primi del Menu di verifica
  - bot: «Aumentati di 0,50 € i prezzi di 4 piatti. *la parmigiana*: prezzo da 12,50 € a *13,00 €* *pasta al pesto*: prezzo da 9,00 € a *9,50 €* *pasta carbonara*: prezzo da 9,00 € a *9,50 €* *riso giallo*: prezzo da 8,00 € a *8,50 €* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: annulla
  - bot: «Annullo l'ultima pubblicazione: *la parmigiana*, *pasta al pesto*, *pasta carbonara* e *riso giallo*. *la parmigiana*: com’era prima *pasta al pesto*: com’era prima *pasta carbonara*: com’era prima *riso giallo*: com’era prima»
- titolare: alza di 50 centesimi i primi
  - bot: «Aumentati di 0,50 € i prezzi di 4 piatti. *la parmigiana*: prezzo da 12,50 € a *13,00 €* *pasta al pesto*: prezzo da 9,00 € a *9,50 €* *pasta carbonara*: prezzo da 9,00 € a *9,50 €* *riso giallo*: prezzo da 8,00 € a *8,50 €* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: annulla
  - bot: «Annullo l'ultima pubblicazione: *la parmigiana*, *pasta al pesto*, *pasta carbonara* e *riso giallo*. *la parmigiana*: com’era prima *pasta al pesto*: com’era prima *pasta carbonara*: com’era prima *riso giallo*: com’era prima»
- titolare: il riso giallo a otto e cinquanta
  - bot: «Ok, il *Riso giallo* lo metto a *8,50 €*. *riso giallo*: prezzo da 8,00 € a *8,50 €*»
- titolare: annulla
  - bot: «Annullo l'ultima pubblicazione: *riso giallo*. *riso giallo*: com’era prima *riso giallo*: com’era prima»
- titolare: la pasta al sugo a dieci euro e mezzo
  - bot: «Ok, la *Pasta al sugo* la metto a *10,50 €*. *Pasta al sugo*: prezzo da 9,00 € a *10,50 €*»
- titolare: annulla
  - bot: «Annullo l'ultima pubblicazione: *Pasta al sugo*. Ti torna il prezzo di prima. *Pasta al sugo*: com’era prima»
- titolare: nascondi il riso giallo
  - bot: «Nascondo *Riso giallo* dal menu. *riso giallo*: *nascosto* dal menu»
- titolare: mostralo di nuovo
  - bot: «Ok, rimetto *Riso giallo* nel menu come prima. *riso giallo*: di nuovo *visibile* nel menu»
- titolare: la pasta al sugo è finita
  - bot: «Ok, segno la *Pasta al sugo* come esaurita. *Pasta al sugo*: *finito*»
- titolare: la pasta al sugo è tornata
  - bot: «Ok, rimetto la *Pasta al sugo* disponibile. *Pasta al sugo*: di nuovo *disponibile*»
- titolare: elimina la pasta al sugo
  - bot: «Elimino *Pasta al sugo* dal menu? Rispondi *sì*. Da eliminare, serve il tuo sì: 1. *Pasta al sugo*: da eliminare»
- titolare: annulla
  - bot: «Ok, annullo l'eliminazione di *Pasta al sugo*. Il piatto resta nel menu.»
- titolare: metti tutto a zero
  - bot: «Intendi azzerare il prezzo di quali piatti? Dimmi il Menu o i piatti.»
- titolare: no
  - bot: «Ok, lascio stare.»
- titolare: elimina tutti i primi
  - bot: «Ci sto lavorando… Quali *Primi* vuoi eliminare? Ce ne sono in più Menu. 1. *Pasta al sugo* (9,00 €) 2. *la parmigiana* (12,50 €) 3. *pasta al pesto* (9,00 €) 4. *pasta carbonara* (9,00 €) 5. *riso giallo* (8,00 €)»
- titolare: no
  - bot: «Ok, lascio stare.»
- titolare: riso giallo a 9, pasta carbonara a 10, pasta al sugo a 10, tiramisù a 16
  - bot: «Non ancora pubblicato, da confermare con OK: 1. *riso giallo*: prezzo da 8,00 € a *9,00 €* 2. *pasta carbonara*: prezzo da 9,00 € a *10,00 €* 3. *Pasta al sugo*: prezzo da 9,00 € a *10,00 €* 4. *tiramisù*: prezzo da 15,00 € a *16,00 €*»
- titolare: 👍
  - bot: «Ok, pubblico le modifiche di *riso giallo*, *pasta carbonara*, *Pasta al sugo* e *tiramisù*. *riso giallo*: prezzo da 8,00 € a *9,00 €* *pasta carbonara*: prezzo da 9,00 € a *10,00 €* *Pasta al sugo*: prezzo da 9,00 € a *10,00 €* *tiramisù*: prezzo da 15,00 € a *16,00 €*»
- titolare: annulla
  - bot: «Ok, annullo l'ultima pubblicazione: *riso giallo*, *pasta carbonara*, *Pasta al sugo* e *tiramisù* tornano ai prezzi di prima. *Pasta al sugo*: com’era prima *tiramisù*: com’era prima *pasta carbonara*: com’era prima *riso giallo*: com’era prima»
- titolare: alza il pesto di un euro
  - bot: «Ci sto lavorando… Intendi *pasta al pesto* o *Pasta al pesto e lasagna*? 1. *pasta al pesto* (9,00 €) 2. *Pasta al pesto e lasagna* (10,01 €)»
- titolare: la pasta al pesto dei primi
  - bot: «*pasta al pesto*: prezzo da 9,00 € a *10,00 €*»
- titolare: annulla
  - bot: «Ok, annullo l'ultima pubblicazione: *pasta al pesto* torna al prezzo di prima. *pasta al pesto*: com’era prima»
- titolare: cosa c'è nei primi?
  - bot: «Nei *Primi* del Menu di verifica ci sono *la parmigiana*, *pasta al pesto*, *pasta carbonara* e *riso giallo*. *la parmigiana*: *12,50 €* · disponibile *pasta al pesto*: *9,00 €* · disponibile *pasta carbonara*: *9,00 €* · disponibile *riso giallo*: *8,00 €* · disponibile»
- titolare: quante paste ho nei primi?
  - bot: «Nei *Primi* del *Menu di verifica · web QA* ci sono 2 piatti: *pasta al pesto*: *9,00 €* · disponibile *pasta carbonara*: *9,00 €* · disponibile»
- titolare: il riso giallo a 80
  - bot: «Intendi *80 €* per il *riso giallo*? Il prezzo attuale è *8,00 €*.»
- titolare: no
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: il riso giallo a 9
  - bot: «Ok, metto *riso giallo* a *9,00 €*. *riso giallo*: prezzo da 8,00 € a *9,00 €*»
- titolare: anzi rimettilo a 8
  - bot: «*riso giallo*: prezzo da 9,00 € a *8,00 €*»
- titolare: togli la carbonara
  - bot: «*Carbonara* è già nascosto dal menu.»
- titolare: rimetti la pasta carbonara nel menu
  - bot: «*pasta carbonara* è già visibile nel menu.»
- titolare: aggiungi le patatine fritte a 4 nei Piatti di prova
  - bot: «Aggiungo *Patatine fritte* a *4 €* nei *Piatti di prova*. Nuovo piatto *Patatine fritte* in *Piatti di prova*: *4,00 €*»
- titolare: elimina le patatine fritte
  - bot: «Elimino *Patatine fritte* dal menu? Rispondi *sì*. Da eliminare, serve il tuo sì: 1. *Patatine fritte*: da eliminare»
- titolare: sì
  - bot: «Ok, elimino *Patatine fritte* dal menu. *Patatine fritte*: *eliminato* dal menu»
- titolare: aggiungi patatine fritte a 4
  - bot: «Ok, *4,00 €*. In quale sottomenu metto *Patatine fritte*? Rispondi col numero o col nome. 1. *Piatti di prova* (Menu di verifica · web QA) 2. *Primi* (Menu di verifica · web QA)»
- titolare: nei Primi del Menu di verifica
  - bot: «Nuovo piatto *Patatine fritte* in *Primi*: *4,00 €*»
- titolare: annulla
  - bot: «Ok, annullo l'ultima modifica: *Patatine fritte*. *Patatine fritte*: tolto (era stato aggiunto)»
- titolare: alza il pesto di un euro
  - bot: «Intendi *pasta al pesto* o *Pasta al pesto e lasagna*? 1. *pasta al pesto* (9,00 €) 2. *Pasta al pesto e lasagna* (10,01 €)»
- titolare: la pasta al pesto dei primi
  - bot: «*pasta al pesto*: prezzo da 9,00 € a *10,00 €*»
- titolare: annulla
  - bot: «Ok, annullo l'ultima modifica: *pasta al pesto*. *pasta al pesto*: com’era prima»
- titolare: il riso giallo a 9
  - bot: «Ok, metto *riso giallo* a *9 €*. *riso giallo*: prezzo da 8,00 € a *9,00 €*»
- titolare: anzi rimettilo a 8
  - bot: «*riso giallo*: prezzo da 9,00 € a *8,00 €*»
- titolare: aggiungi le patatine fritte a 4 nei Piatti di prova
  - bot: «Ok, aggiungo *Patatine fritte* a *4 €* nei *Piatti di prova*. Nuovo piatto *Patatine fritte* in *Piatti di prova*: *4,00 €*»
- titolare: nei Piatti di prova
  - bot: «Intendi aggiungere di nuovo *Patatine fritte* a *4 €* nei *Piatti di prova*?»
- titolare: annulla
  - bot: «*Patatine fritte*: tolto (era stato aggiunto)»
- titolare: aggiungi il vitello tonnato a 14 nei Piatti di prova
  - bot: «Ok, aggiungo *Vitello tonnato* a *14 €* nei *Piatti di prova*. Nuovo piatto *Vitello tonnato* in *Piatti di prova*: *14,00 €*»
- titolare: no, nei Primi del Menu di verifica
  - bot: «Ci sto lavorando… *Vitello tonnato*: spostato in *Primi*»
- titolare: elimina il vitello tonnato
  - bot: «Elimino *Vitello tonnato* dal menu? Rispondi *sì*. Da eliminare, serve il tuo sì: 1. *Vitello tonnato*: da eliminare»
- titolare: sì
  - bot: «Ok, elimino *Vitello tonnato* dal menu. *Vitello tonnato*: *eliminato* dal menu»
- titolare: cosa c'è nei primi?
  - bot: «Nei *Primi* del *Menu di verifica · web QA* ci sono 4 piatti: *la parmigiana*: *12,50 €* · disponibile *pasta al pesto*: *9,00 €* · disponibile *pasta carbonara*: *9,00 €* · disponibile *riso giallo*: *8,00 €* · disponibile»
- titolare: aggiungi le trofie al pesto a 11 nei primi
  - bot: «Ok, *11,00 €*. In quale sottomenu metto *Trofie al pesto*? Non ancora pubblicato: 1. Nuovo piatto *Trofie al pesto* in *Primi*: *11,00 €*»
- titolare: annulla
  - bot: «Ok, lascio stare.»
- titolare: quanto costa la pasta carbonara?
  - bot: «La *pasta carbonara* costa *9 €* nel Primi del Menu di verifica. *pasta carbonara*: *9,00 €* · disponibile»
- titolare: alzala di un euro
  - bot: «*pasta carbonara*: prezzo da 9,00 € a *10,00 €*»
- titolare: alzala ancora di 50 centesimi
  - bot: «*pasta carbonara*: prezzo da 10,00 € a *10,50 €*»
- titolare: rimettila a 9
  - bot: «*pasta carbonara*: prezzo da 10,50 € a *9,00 €*»
- titolare: il riso giallo a 9 e la pasta carbonara a 10
  - bot: «Ci sto lavorando… Aumentati di 1,00 € i prezzi di 2 piatti. *riso giallo*: prezzo da 8,00 € a *9,00 €* *pasta carbonara*: prezzo da 9,00 € a *10,00 €* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: abbassali tutti e due di un euro
  - bot: «Ci sto lavorando… Abbassati di 1,00 € i prezzi di 2 piatti. *pasta carbonara*: prezzo da 10,00 € a *9,00 €* *riso giallo*: prezzo da 9,00 € a *8,00 €* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: c'è la pasta al ragù?
  - bot: «Sì, c'è la *pasta al ragù* a *10,00 €* nel Menu di verifica. È disponibile. *pasta al ragù*: *10,00 €* · disponibile»
- titolare: è finita
  - bot: «*pasta al ragù*: *finito*»
- titolare: no scusa, è tornata
  - bot: «Ok, *pasta al ragù* di nuovo disponibile. *pasta al ragù*: di nuovo *disponibile*»
- titolare: nascondi il tiramisù
  - bot: «*tiramisù*: *nascosto* dal menu»
- titolare: rimettilo
  - bot: «*tiramisù*: di nuovo *visibile* nel menu»
- titolare: la pasta al sugo a 10
  - bot: «Ok, *Pasta al sugo* a *10,00 €*. *Pasta al sugo*: prezzo da 9,00 € a *10,00 €*»
- titolare: quanto costa il riso giallo?
  - bot: «Il *riso giallo* costa *8,00 €*. *riso giallo*: *8,00 €* · disponibile»
- titolare: mettilo a 9
  - bot: «*riso giallo*: prezzo da 8,00 € a *9,00 €*»
- titolare: annulla
  - bot: «Ok, annullo l'ultima modifica sul *riso giallo*. *riso giallo*: com’era prima»
- titolare: la pasta al sugo a 9
  - bot: «Ok, *Pasta al sugo* a *9,00 €*. *Pasta al sugo*: prezzo da 10,00 € a *9,00 €*»
- titolare: aggiungi la frittatina
  - bot: «Intendi la *Frittata di zucchine* o la *Frittata di patate*? Oppure vuoi un piatto nuovo chiamato *Frittatina*? 1. *Frittata di zucchine* (0,00 €) 2. *Frittata di patate* (0,00 €)»
- titolare: lascia stare
  - bot: «Ok, lascio stare.»
- titolare: quanti piatti ho nei Primi del Menu di verifica?
  - bot: «Nei *Primi* del *Menu di verifica · web QA* ci sono 4 piatti: *la parmigiana*: *12,50 €* · disponibile *pasta al pesto*: *9,00 €* · disponibile *pasta carbonara*: *9,00 €* · disponibile *riso giallo*: *8,00 €* · disponibile»
- titolare: metti in evidenza il tiramisù
  - bot: «Ok, metto in evidenza il *tiramisù*. *tiramisù*: *in evidenza*»
- titolare: toglilo dall'evidenza
  - bot: «Ok, tolgo il *tiramisù* dall'evidenza. *tiramisù*: non più in evidenza»
- titolare: il riso giallo è finito
  - bot: «Ok, segno il *riso giallo* come esaurito. *riso giallo*: *finito*»
- titolare: quanto costa la pasta al pesto?
  - bot: «La *pasta al pesto* costa *9,00 €*. *pasta al pesto*: *9,00 €* · disponibile»
- titolare: il riso giallo è tornato
  - bot: «Ok, rimetto il *riso giallo* disponibile. *riso giallo*: di nuovo *disponibile*»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** risposta-vietata: [lettura-poi-nuovo] turno 83: contiene /\?/i («Ok, *11,00 €*. In quale sottomenu metto *Trofie al pesto*? Non ancora pubblicato: 1. Nuovo piatto *T»)
- **MEDIO** non-applicato: [lettura-poi-nuovo] turno 83: menu mancano [create|trofie al pesto|11|primi] in più [] («Ok, *11,00 €*. In quale sottomenu metto *Trofie al pesto*? Non ancora pubblicato: 1. Nuovo piatto *T»)

