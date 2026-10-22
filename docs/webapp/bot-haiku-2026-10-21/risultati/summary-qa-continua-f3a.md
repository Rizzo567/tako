# Motore Haiku · set qa-continua · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-22T00:59:00.185Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **1/2 (50%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 2.1 (non attese 2.1) |
| Latenza chiamata Haiku p50 / p95 | 1769 / 3354 ms (135 chiamate) |
| Latenza turno p50 / p95 | 36 / 3476 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.07 |
| Token medi per messaggio (in · out · cache read · cache write) | 886 · 239 · 10325 · 220 |
| Cache hit (cache_read > 0) | 133/135 (98.5%) |
| Costo speso in questo giro | 0.01919 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.042707 $ · 0.000339 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 71 · 64 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 119.7 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| risposta-senza-contenuto | 0 | 1 | 0 |

## Falliti (trascrizione)

### qa-continua-rapida [MEDIO]
- titolare: aggiungi il vitello tonnato
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. In quale Sottomenu lo metto e a che prezzo vuoi *Vitello tonnato*?»
- titolare: annulla
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: quanto costa il riso giallo?
  - bot: «Il *Riso giallo* costa 8 €. *riso giallo*: *8,00 €* · disponibile»
- titolare: quanto costa il riso giallo?
  - bot: «Il *Riso giallo* costa 8 €. *riso giallo*: *8,00 €* · disponibile»
- titolare: alzalo di un euro
  - bot: «Alzo il *Riso giallo* di un euro. *riso giallo*: prezzo da 8,00 € a *9,00 €*»
- titolare: annulla
  - bot: «Annullo l'ultima modifica sul *Riso giallo*. *riso giallo*: com’era prima»
- titolare: quanto costa la pasta carbonara?
  - bot: «La *Pasta carbonara* costa *9 €*. *pasta carbonara*: *9,00 €* · disponibile»
- titolare: mettila a 10
  - bot: «Metto la *Pasta carbonara* a 10 €. *pasta carbonara*: prezzo da 9,00 € a *10,00 €*»
- titolare: annulla
  - bot: «Annullo l'ultima modifica sulla *Pasta carbonara*. *pasta carbonara*: com’era prima»
- titolare: quanto costa la pasta al ragù?
  - bot: «La *Pasta al ragù* costa *10 €*. *pasta al ragù*: *10,00 €* · disponibile»
- titolare: toglila
  - bot: «*pasta al ragù*: *nascosto* dal menu»
- titolare: rimettila
  - bot: «Rimetto la *Pasta al ragù* nel menu. *pasta al ragù*: di nuovo *visibile* nel menu»
- titolare: c'è il tiramisù?
  - bot: «Sì, il *tiramisù* c'è nel menu, a 15 €. *tiramisù*: *15,00 €* · disponibile»
- titolare: è finito
  - bot: «*tiramisù*: *finito*»
- titolare: è tornato
  - bot: «Rimetto il *tiramisù* disponibile. *tiramisù*: di nuovo *disponibile*»
- titolare: aggiungi le patatine fritte
  - bot: «In quale sottomenu vuoi mettere le *Patatine fritte*? Dimmi il sottomenu e il prezzo.»
- titolare: 4
  - bot: «Ok, *4,00 €*. In quale sottomenu metto *Patatine fritte*? Rispondi col numero o col nome. 1. *Piatti di prova* (Menu di verifica · web QA) 2. *Primi* (Menu di verifica · web QA) 3. *Completo* (Menu pranzo)»
- titolare: nei Piatti di prova
  - bot: «Nuovo piatto *Patatine fritte* in *Piatti di prova*: *4,00 €*»
- titolare: annulla
  - bot: «Annullo l'ultima pubblicazione: *Patatine fritte*. *Patatine fritte*: tolto (era stato aggiunto)»
- titolare: aggiungi patatine fritte a 4
  - bot: «Ok, *4,00 €*. In quale sottomenu metto *Patatine fritte*? Rispondi col numero o col nome. 1. *Piatti di prova* (Menu di verifica · web QA) 2. *Primi* (Menu di verifica · web QA) 3. *Completo* (Menu pranzo)»
- titolare: nei Primi del Menu di verifica
  - bot: «Nuovo piatto *Patatine fritte* in *Primi*: *4,00 €*»
- titolare: annulla
  - bot: «Annullo l'ultima pubblicazione: *Patatine fritte*. *Patatine fritte*: tolto (era stato aggiunto)»
- titolare: aggiungi il vitello tonnato nei Primi del Menu di verifica
  - bot: «Aggiungo il piatto *Vitello tonnato* nei *Primi* del Menu di verifica. Quanto costa?»
- titolare: 14
  - bot: «Nuovo piatto *Vitello tonnato* in *Primi*: *14,00 €*»
- titolare: annulla
  - bot: «Annullo l'ultima pubblicazione: *Vitello tonnato*. *Vitello tonnato*: tolto (era stato aggiunto)»
- titolare: aggiungi patatine fritte a 4
  - bot: «In quale sottomenu metto *Patatine fritte*? Rispondi col numero o col nome. 1. *Piatti di prova* (Menu di verifica · web QA) 2. *Primi* (Menu di verifica · web QA) 3. *Completo* (Menu pranzo)»
- titolare: sì
  - bot: «Ok, *4,00 €*. In quale sottomenu metto *Patatine fritte*? Rispondi col numero o col nome. 1. *Piatti di prova* (Menu di verifica · web QA) 2. *Primi* (Menu di verifica · web QA) 3. *Completo* (Menu pranzo)»
- titolare: lascia stare
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: quanto costano il riso giallo e la pasta carbonara?
  - bot: «Il *Riso giallo* costa *8,00 €* e la *Pasta carbonara* costa *9,00 €*. *riso giallo*: *8,00 €* · disponibile *pasta carbonara*: *9,00 €* · disponibile»
- titolare: alzali tutti e due di 50 centesimi
  - bot: «Aumentati di 0,50 € i prezzi di 2 piatti. *pasta carbonara*: prezzo da 9,00 € a *9,50 €* *riso giallo*: prezzo da 8,00 € a *8,50 €* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: annulla
  - bot: «Annullo l'ultima pubblicazione: *pasta carbonara* e *riso giallo*. Tornano ai prezzi di prima. *pasta carbonara*: com’era prima *riso giallo*: com’era prima»
- titolare: alza di 50 centesimi i primi del Menu di verifica
  - bot: «Aumentati di 0,50 € i prezzi di 4 piatti. *la parmigiana*: prezzo da 12,50 € a *13,00 €* *pasta al pesto*: prezzo da 9,00 € a *9,50 €* *pasta carbonara*: prezzo da 9,00 € a *9,50 €* *riso giallo*: prezzo da 8,00 € a *8,50 €* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: annulla
  - bot: «Annullo l'ultima pubblicazione: *la parmigiana*, *pasta al pesto*, *pasta carbonara* e *riso giallo*. Tornano ai prezzi di prima. *la parmigiana*: com’era prima *pasta al pesto*: com’era prima *pasta carbonara*: com’era prima *riso giallo*: com’era prima»
- titolare: alza di 50 centesimi i primi
  - bot: «Ci sto lavorando… Aumentati di 0,50 € i prezzi di 4 piatti. *la parmigiana*: prezzo da 12,50 € a *13,00 €* *pasta al pesto*: prezzo da 9,00 € a *9,50 €* *pasta carbonara*: prezzo da 9,00 € a *9,50 €* *riso giallo*: prezzo da 8,00 € a *8,50 €* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: annulla
  - bot: «Annullo l'ultima pubblicazione: *la parmigiana*, *pasta al pesto*, *pasta carbonara* e *riso giallo*. Tornano ai prezzi di prima. *la parmigiana*: com’era prima *pasta al pesto*: com’era prima *pasta carbonara*: com’era prima *riso giallo*: com’era prima»
- titolare: il riso giallo a otto e cinquanta
  - bot: «Ok, il *Riso giallo* lo metto a *8,50 €*. *riso giallo*: prezzo da 8,00 € a *8,50 €*»
- titolare: annulla
  - bot: «Annullo l'ultima pubblicazione: *riso giallo*. Torna al prezzo di prima. *riso giallo*: com’era prima»
- titolare: la pasta al sugo a dieci euro e mezzo
  - bot: «Ok, la *Pasta al sugo* la metto a *10,50 €*. *Pasta al sugo*: prezzo da 9,00 € a *10,50 €*»
- titolare: annulla
  - bot: «Annullo l'ultima pubblicazione: *Pasta al sugo*. Torna al prezzo di prima. *Pasta al sugo*: com’era prima»
- titolare: nascondi il riso giallo
  - bot: «Nascondo *Riso giallo* dal menu. *riso giallo*: *nascosto* dal menu»
- titolare: mostralo di nuovo
  - bot: «Rimetto *Riso giallo* nel menu. *riso giallo*: di nuovo *visibile* nel menu»
- titolare: la pasta al sugo è finita
  - bot: «Segno *Pasta al sugo* come esaurita. *Pasta al sugo*: *finito*»
- titolare: la pasta al sugo è tornata
  - bot: «Rimetto *Pasta al sugo* disponibile. *Pasta al sugo*: di nuovo *disponibile*»
- titolare: elimina la pasta al sugo
  - bot: «Elimino *Pasta al sugo* dal menu? Rispondi sì. Da eliminare, serve il tuo sì: 1. *Pasta al sugo*: da eliminare»
- titolare: annulla
  - bot: «Ok, annullo l'eliminazione di *Pasta al sugo*. Il piatto resta nel menu.»
- titolare: metti tutto a zero
  - bot: «Vuoi mettere a zero *tutti i piatti* di quale Menu? Dimmi il nome del Menu.»
- titolare: no
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: elimina tutti i primi
  - bot: «Quali *Primi* intendi, quelli del Menu di verifica o quelli del Menu cena?»
- titolare: no
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: riso giallo a 9, pasta carbonara a 10, pasta al sugo a 10, tiramisù a 16
  - bot: «Non ancora pubblicato, da confermare con OK: 1. *tiramisù*: prezzo da 15,00 € a *16,00 €* 2. *pasta carbonara*: prezzo da 9,00 € a *10,00 €* 3. *Pasta al sugo*: prezzo da 9,00 € a *10,00 €* 4. *riso giallo*: prezzo da 8,00 € a *9,00 €*»
- titolare: 👍
  - bot: «Ok, pubblico le modifiche di prezzo in sospeso. *tiramisù*: prezzo da 15,00 € a *16,00 €* *pasta carbonara*: prezzo da 9,00 € a *10,00 €* *Pasta al sugo*: prezzo da 9,00 € a *10,00 €* *riso giallo*: prezzo da 8,00 € a *9,00 €*»
- titolare: annulla
  - bot: «Ok, annullo l'ultima pubblicazione: torno indietro sui prezzi di *Pasta al sugo*, *tiramisù*, *pasta carbonara* e *riso giallo*. *Pasta al sugo*: com’era prima *tiramisù*: com’era prima *pasta carbonara*: com’era prima *riso giallo*: com’era prima»
- titolare: alza il pesto di un euro
  - bot: «Intendi *pasta al pesto* o *Pasta al pesto e lasagna*? 1. *pasta al pesto* (9,00 €) 2. *Pasta al pesto e lasagna* (10,01 €)»
- titolare: la pasta al pesto dei primi
  - bot: «*pasta al pesto*: prezzo da 9,00 € a *10,00 €*»
- titolare: annulla
  - bot: «Ok, annullo l'ultima pubblicazione: torno indietro sul prezzo di *pasta al pesto*. *pasta al pesto*: com’era prima»
- titolare: cosa c'è nei primi?
  - bot: «*Lasagna*: *senza prezzo* · disponibile *Carbonara*: *senza prezzo* · disponibile · nascosto *Gnocchi al ragù*: *senza prezzo* · disponibile»
- titolare: quante paste ho nei primi?
  - bot: «Nei *Primi* del *Menu di verifica · web QA* ci sono 2 piatti: *pasta al pesto*: *9,00 €* · disponibile *pasta carbonara*: *9,00 €* · disponibile»
- titolare: il riso giallo a 80
  - bot: «Intendi *riso giallo* a *80 €*? Confermami il prezzo.»
- titolare: no
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: il riso giallo a 9
  - bot: «Ok, metto il *riso giallo* a 9 euro. *riso giallo*: prezzo da 8,00 € a *9,00 €*»
- titolare: anzi rimettilo a 8
  - bot: «Ok, rimetto il *riso giallo* a 8 euro. *riso giallo*: prezzo da 9,00 € a *8,00 €*»
- titolare: togli la carbonara
  - bot: «Tolgo *pasta carbonara* dal menu. Confermi?»
- titolare: annulla
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** risposta-senza-contenuto: [lettura-primi] turno 56: manca /riso giallo/i («*Lasagna*: *senza prezzo* · disponibile *Carbonara*: *senza prezzo* · disponibile · nascosto *Gnocch»)

