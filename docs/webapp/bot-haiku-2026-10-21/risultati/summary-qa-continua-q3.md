# Motore Haiku · set qa-continua · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-22T00:36:28.509Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **0/1 (0%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 2.2 (non attese 2.2) |
| Latenza chiamata Haiku p50 / p95 | 1716 / 2526 ms (66 chiamate) |
| Latenza turno p50 / p95 | 19 / 162 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.05 |
| Token medi per messaggio (in · out · cache read · cache write) | 827 · 217 · 10136 · 174 |
| Cache hit (cache_read > 0) | 65/66 (98.5%) |
| Costo speso in questo giro | 0.001179 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.019806 $ · 0.000314 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 62 · 4 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 9.1 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| risposta-vietata | 0 | 2 | 0 |
| non-applicato | 0 | 1 | 0 |

## Falliti (trascrizione)

### qa-continua [MEDIO]
- titolare: aggiungi il vitello tonnato
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. In quale Sottomenu lo metto e a che prezzo vuoi *Vitello tonnato*?»
- titolare: annulla
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: [+2 min]
  - bot: «Il *Riso giallo* costa 8 €. *riso giallo*: *8,00 €* · disponibile»
- titolare: quanto costa il riso giallo?
  - bot: «Il *Riso giallo* costa 8 €. *riso giallo*: *8,00 €* · disponibile»
- titolare: [+2 min]
  - bot: «*riso giallo*: prezzo da 8,00 € a *9,00 €*»
- titolare: quanto costa il riso giallo?
  - bot: «Ok, annullo l'ultima modifica sul *Riso giallo*. *riso giallo*: com’era prima»
- titolare: alzalo di un euro
  - bot: «La *Pasta carbonara* costa 9 €. *pasta carbonara*: *9,00 €* · disponibile»
- titolare: annulla
  - bot: «Ok, metto la *Pasta carbonara* a 10 €. *pasta carbonara*: prezzo da 9,00 € a *10,00 €*»
- titolare: [+2 min]
  - bot: «Ok, annullo l'ultima modifica sulla *Pasta carbonara*. *pasta carbonara*: com’era prima»
- titolare: quanto costa la pasta carbonara?
  - bot: «La *Pasta al ragù* costa 10 €. *pasta al ragù*: *10,00 €* · disponibile»
- titolare: mettila a 10
  - bot: «Tolgo la *Pasta al ragù* dal menu. *pasta al ragù*: *nascosto* dal menu»
- titolare: annulla
  - bot: «Rimetto la *Pasta al ragù* nel menu. *pasta al ragù*: di nuovo *visibile* nel menu»
- titolare: [+2 min]
  - bot: «Sì, il *tiramisù* c'è, costa 15 € e risulta disponibile. *tiramisù*: *15,00 €* · disponibile»
- titolare: quanto costa la pasta al ragù?
  - bot: «*tiramisù*: *finito*»
- titolare: toglila
  - bot: «Rimetto il *tiramisù* disponibile. *tiramisù*: di nuovo *disponibile*»
- titolare: rimettila
  - bot: «In quale Sottomenu vuoi aggiungere le *Patatine fritte*? Ti chiedo anche il prezzo.»
- titolare: [+2 min]
  - bot: «Ok, *4,00 €*. In quale sottomenu metto *Patatine fritte*? Rispondi col numero o col nome. 1. *Piatti di prova* (Menu di verifica · web QA) 2. *Primi* (Menu di verifica · web QA) 3. *Completo* (Menu pranzo)»
- titolare: c'è il tiramisù?
  - bot: «Nuovo piatto *Patatine fritte* in *Piatti di prova*: *4,00 €*»
- titolare: è finito
  - bot: «Ok, annullo l'ultima pubblicazione: tolgo le *Patatine fritte*. *Patatine fritte*: tolto (era stato aggiunto)»
- titolare: è tornato
  - bot: «In quale Sottomenu vuoi aggiungere le *Patatine fritte* a 4 €?»
- titolare: [+2 min]
  - bot: «Nuovo piatto *Patatine fritte* in *Primi*: *4,00 €*»
- titolare: aggiungi le patatine fritte
  - bot: «Ok, annullo l'ultima pubblicazione: tolgo le *Patatine fritte* da *Primi*. *Patatine fritte*: tolto (era stato aggiunto)»
- titolare: 4
  - bot: «In quale sottomenu metto *Vitello tonnato* e a che prezzo?»
- titolare: nei Piatti di prova
  - bot: «Nuovo piatto *Vitello tonnato* in *Primi*: *14,00 €*»
- titolare: annulla
  - bot: «Ok, annullo l'ultima pubblicazione: tolgo il *Vitello tonnato* da *Primi*. *Vitello tonnato*: tolto (era stato aggiunto)»
- titolare: [+2 min]
  - bot: «In quale Sottomenu vuoi aggiungere le *Patatine fritte* a 4 €?»
- titolare: aggiungi patatine fritte a 4
  - bot: «Ok, *4,00 €*. In quale sottomenu metto *Patatine fritte*? Rispondi col numero o col nome. 1. *Piatti di prova* (Menu di verifica · web QA) 2. *Primi* (Menu di verifica · web QA) 3. *Completo* (Menu pranzo)»
- titolare: nei Primi del Menu di verifica
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: annulla
  - bot: «Il *Riso giallo* costa *8 €* e la *Pasta carbonara* costa *9 €*. *riso giallo*: *8,00 €* · disponibile *pasta carbonara*: *9,00 €* · disponibile»
- titolare: [+2 min]
  - bot: «Aumentati di 0,50 € i prezzi di 2 piatti. *pasta carbonara*: prezzo da 9,00 € a *9,50 €* *riso giallo*: prezzo da 8,00 € a *8,50 €* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: aggiungi il vitello tonnato nei Primi del Menu di verifica
  - bot: «Ok, annullo l'ultima pubblicazione: riporto *Pasta carbonara* e *Riso giallo* ai prezzi di prima. *pasta carbonara*: com’era prima *riso giallo*: com’era prima»
- titolare: 14
  - bot: «Aumentati di 0,50 € i prezzi di 4 piatti. *la parmigiana*: prezzo da 12,50 € a *13,00 €* *pasta al pesto*: prezzo da 9,00 € a *9,50 €* *pasta carbonara*: prezzo da 9,00 € a *9,50 €* *riso giallo*: prezzo da 8,00 € a *8,50 €* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: annulla
  - bot: «Ok, annullo l'ultima pubblicazione: riporto *La parmigiana*, *Pasta al pesto*, *Pasta carbonara* e *Riso giallo* ai prezzi di prima. *la parmigiana*: com’era prima *pasta al pesto*: com’era prima *pasta carbonara*: com’era prima *riso giallo*: com’era prima»
- titolare: [+2 min]
  - bot: «Aumentati di 0,50 € i prezzi di 4 piatti. *la parmigiana*: prezzo da 12,50 € a *13,00 €* *pasta al pesto*: prezzo da 9,00 € a *9,50 €* *pasta carbonara*: prezzo da 9,00 € a *9,50 €* *riso giallo*: prezzo da 8,00 € a *8,50 €* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: aggiungi patatine fritte a 4
  - bot: «Ok, annullo l'ultima pubblicazione: riporto *La parmigiana*, *Pasta al pesto*, *Pasta carbonara* e *Riso giallo* ai prezzi di prima. *la parmigiana*: com’era prima *pasta al pesto*: com’era prima *pasta carbonara*: com’era prima *riso giallo*: com’era prima»
- titolare: sì
  - bot: «Ok, metto il *Riso giallo* a *8,50 €*. *riso giallo*: prezzo da 8,00 € a *8,50 €*»
- titolare: lascia stare
  - bot: «Ok, annullo l'ultima pubblicazione: riporto *Riso giallo* al prezzo di prima. *riso giallo*: com’era prima»
- titolare: [+2 min]
  - bot: «Ok, metto la *Pasta al sugo* a *10,50 €*. *Pasta al sugo*: prezzo da 9,00 € a *10,50 €*»
- titolare: quanto costano il riso giallo e la pasta carbonara?
  - bot: «Ok, annullo l'ultima pubblicazione: riporto *Pasta al sugo* al prezzo di prima. *Pasta al sugo*: com’era prima»
- titolare: alzali tutti e due di 50 centesimi
  - bot: «Nascondo il *Riso giallo* dal menu. *riso giallo*: *nascosto* dal menu»
- titolare: annulla
  - bot: «Rimetto il *Riso giallo* nel menu. *riso giallo*: di nuovo *visibile* nel menu»
- titolare: [+2 min]
  - bot: «Segno la *Pasta al sugo* come esaurita. *Pasta al sugo*: *finito*»
- titolare: alza di 50 centesimi i primi del Menu di verifica
  - bot: «Rimetto la *Pasta al sugo* disponibile. *Pasta al sugo*: di nuovo *disponibile*»
- titolare: annulla
  - bot: «Elimino la *Pasta al sugo* dal menu? Rispondi sì. Da eliminare, serve il tuo sì: 1. *Pasta al sugo*: da eliminare»
- titolare: [+2 min]
  - bot: «Ok, non elimino la *Pasta al sugo*.»
- titolare: alza di 50 centesimi i primi
  - bot: «Intendi mettere a zero i prezzi di quali piatti o di quale Menu?»
- titolare: annulla
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: [+2 min]
  - bot: «Di quale Menu parli, *Menu di verifica* o *Menu cena*?»
- titolare: il riso giallo a otto e cinquanta
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: annulla
  - bot: «Non ancora pubblicato, da confermare con OK: 1. *riso giallo*: prezzo da 8,00 € a *9,00 €* 2. *pasta carbonara*: prezzo da 9,00 € a *10,00 €* 3. *Pasta al sugo*: prezzo da 9,00 € a *10,00 €* 4. *tiramisù*: prezzo da 15,00 € a *16,00 €*»
- titolare: [+2 min]
  - bot: «Ok, pubblico le modifiche: *riso giallo* a 9 €, *pasta carbonara* a 10 €, *Pasta al sugo* a 10 €, *tiramisù* a 16 €. *riso giallo*: prezzo da 8,00 € a *9,00 €* *pasta carbonara*: prezzo da 9,00 € a *10,00 €* *Pasta al sugo*: prezzo da 9,00 € a *10,00 €* *tiramisù*: prezzo da 15,00 € a *16,00 €*»
- titolare: la pasta al sugo a dieci euro e mezzo
  - bot: «Ok, annullo l'ultima pubblicazione: torno ai prezzi di prima per *riso giallo*, *pasta carbonara*, *Pasta al sugo* e *tiramisù*. *Pasta al sugo*: com’era prima *tiramisù*: com’era prima *pasta carbonara*: com’era prima *riso giallo*: com’era prima»
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
  - bot: «A quale piatto metto *80,00 €*? Scrivimi il nome, per esempio «la carbonara a 80».»
- titolare: la pasta al sugo è tornata
  - bot: «Ok, lascio stare: non ho cambiato nulla.»
- titolare: [+2 min]
  - bot: «Per «il riso giallo a 9» intendi *la parmigiana*? Rispondi sì oppure dimmi il nome giusto. 1. *la parmigiana* (12,50 €)»
- titolare: elimina la pasta al sugo
  - bot: «*riso giallo* è già a *8 €*.»
- titolare: annulla
  - bot: «Tolgo *pasta carbonara* dal menu? Rispondi sì.»
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
- **MEDIO** risposta-vietata: [nuovo-solo-sottomenu] turno 23: contiene /sottomenu.*\?/i («In quale sottomenu metto *Vitello tonnato* e a che prezzo?»)
- **MEDIO** risposta-vietata: [anzi-rimettilo] turno 60: contiene /\?/i («Per «il riso giallo a 9» intendi *la parmigiana*? Rispondi sì oppure dimmi il nome giusto. 1. *la pa»)
- **MEDIO** non-applicato: [anzi-rimettilo] turno 60: menu mancano [price|riso giallo|9] in più [] («Per «il riso giallo a 9» intendi *la parmigiana*? Rispondi sì oppure dimmi il nome giusto. 1. *la pa»)

