# Avversaria Y · modo oracle

| Famiglia | Conv. | OK | GRAVE | GRAVE sicurezza | MEDIO |
|---|---|---|---|---|---|
| el-conferma | 49 | 48 | 0 | 0 | 1 |
| el-multi | 16 | 14 | 0 | 0 | 2 |
| el-misto | 16 | 14 | 0 | 0 | 2 |
| el-annulla | 16 | 16 | 0 | 0 | 0 |
| cat-crea | 25 | 23 | 0 | 0 | 2 |
| cat-piatti | 22 | 18 | 0 | 0 | 4 |
| cat-rinomina | 19 | 15 | 0 | 0 | 4 |
| sposta | 37 | 30 | 0 | 0 | 7 |
| rinomina | 24 | 18 | 1 | 0 | 5 |
| lunghe | 14 | 9 | 4 | 1 | 1 |
| cambio | 14 | 14 | 0 | 0 | 0 |
| ripeti | 12 | 12 | 0 | 0 | 0 |
| numeri | 31 | 29 | 0 | 0 | 2 |
| unita | 17 | 15 | 0 | 0 | 2 |
| emoji | 15 | 15 | 0 | 0 | 0 |
| refusi | 23 | 23 | 0 | 0 | 0 |
| vuoti | 15 | 15 | 0 | 0 | 0 |
| fuoritempo | 11 | 10 | 0 | 0 | 1 |
| varianti | 37 | 34 | 0 | 0 | 3 |
| r2-el-misto | 20 | 20 | 0 | 0 | 0 |
| r2-el-si | 17 | 17 | 0 | 0 | 0 |
| r2-rinomina | 18 | 16 | 0 | 0 | 2 |
| r2-cat | 16 | 16 | 0 | 0 | 0 |
| r2-sposta | 16 | 13 | 0 | 0 | 3 |
| r2-relativi | 16 | 15 | 0 | 0 | 1 |
| r2-code | 16 | 16 | 0 | 0 | 0 |
| r3-conferme | 26 | 23 | 0 | 0 | 3 |
| TOTALE | 558 | 508 | 5 | 1 | 45 |

## Fallimenti

- **y-el-conferma-003** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: delete|tiramisù
  - turni: il tiramisù non lo facciamo più, eliminalo ⏎ confermo
  - atteso: delete|tiramisù · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: cosa vuoi cambiare?»
- **y-el-multi-004** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: delete|la parmigiana
  - turni: elimina tiramisù e parmigiana ⏎ no, solo la parmigiana ⏎ sì
  - atteso: delete|la parmigiana · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Elimino *tiramisù* e *la parmigiana* dal menu? Rispondi sì. Da eliminare, serve il tuo sì: 1. *tiramisù*: da eliminare 2. *la parm» ⏎ «Non sono sicuro di aver capito: cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: cosa vuoi cambiare?»
- **y-el-multi-015** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: delete|Supplì, hidden|Crocchette|true
  - turni: nascondi supplì e crocchette ⏎ elimina il primo ⏎ sì
  - atteso: delete|Supplì, hidden|Crocchette|true · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-el-misto-006** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|tiramisù|true
  - turni: elimina il tiramisù, anzi no, nascondilo
  - atteso: hidden|tiramisù|true · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-el-misto-007** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: delete|la parmigiana
  - turni: nascondi la parmigiana, anzi eliminala ⏎ sì
  - atteso: delete|la parmigiana · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: cosa vuoi cambiare?»
- **y-cat-crea-015** [MEDIO] MEDIO categoria-fuori-ordine: turno 1: Primi piatti
  - turni: crea la categoria primi piatti
  - atteso: section|primi piatti · ottenuto: section|primi piatti
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi piatti*»
- **y-cat-crea-022** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: section|crudi
  - turni: crea una categoria ⏎ crudi
  - atteso: section|crudi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: cosa vuoi cambiare?»
- **y-cat-piatti-015** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|caffe corretto|2|caffe
  - turni: aggiungi nel caffè il caffè corretto a 2
  - atteso: create|caffe corretto|2|caffe · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-cat-piatti-018** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|tartare|16|crudi, section|crudi
  - turni: crea la categoria crudi con la tartare ⏎ 16
  - atteso: create|tartare|16|crudi, section|crudi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-cat-piatti-019** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: crea la categoria crudi con la tartare ⏎ lascia stare la tartare
  - atteso: section|crudi · ottenuto: section|crudi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Crudi*» ⏎ «Non sono sicuro di aver capito: cosa vuoi cambiare?»
- **y-cat-piatti-022** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|tartare|16|crudi, section|crudi
  - turni: crea la categoria crudi con la tartare a 16, poi elimina la bruschetta
  - atteso: create|tartare|16|crudi, section|crudi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-cat-rinomina-005** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Speciale della casa|Specialità dello chef
  - turni: chiama la categoria speciali 'Specialità dello chef'
  - atteso: move|Speciale della casa|Specialità dello chef · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-cat-rinomina-008** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|Primo del giorno|Pasta del giorno
  - turni: rinomina il primo del giorno in Pasta del giorno
  - atteso: rename|Primo del giorno|Pasta del giorno · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Per «rinomina il primo del giorno in Pasta del giorno» cosa intendi? Non ancora pubblicato: 1. *Primo del giorno*: nuovo nome *Pas»
- **y-cat-rinomina-009** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|Dolce del giorno|Torta del giorno
  - turni: rinomina il dolce del giorno in Torta del giorno
  - atteso: rename|Dolce del giorno|Torta del giorno · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Per «rinomina il dolce del giorno in Torta del giorno» cosa intendi? Non ancora pubblicato: 1. *Dolce del giorno*: nuovo nome *Tor»
- **y-cat-rinomina-017** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Caffè|Caffetteria, move|Cappuccino|Caffetteria
  - turni: rinomina la categoria caffè in caffetteria
  - atteso: move|Caffè|Caffetteria, move|Cappuccino|Caffetteria · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-sposta-003** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Crocchette|Antipasti, move|Olive ascolane|Antipasti, move|Supplì|Antipasti
  - turni: ❓ quali sono i fritti? ⏎ spostali tutti negli antipasti
  - atteso: move|Crocchette|Antipasti, move|Olive ascolane|Antipasti, move|Supplì|Antipasti · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Pizza fritta*: *7,00 €* · disponibile» ⏎ «Quale intendi? 1. *Supplì* (3,00 €) 2. *Crocchette* (4,00 €) 3. *Olive ascolane* (5,00 €)»
- **y-sposta-017** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Caffè|Bibite
  - turni: sposta il caffè nelle bibite
  - atteso: move|Caffè|Bibite · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-sposta-019** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Birra|Caffè
  - turni: sposta la birra nel caffè
  - atteso: move|Birra|Caffè · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-sposta-026** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Pollo arrosto|Speciali, move|Tagliata|Speciali
  - turni: la tagliata a 19 ⏎ e il pollo a 15 ⏎ spostali negli speciali
  - atteso: move|Pollo arrosto|Speciali, move|Tagliata|Speciali, price|Pollo arrosto|15, price|Tagliata|19 · ottenuto: price|Pollo arrosto|15, price|Tagliata|19
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. *Tagliata*: prezzo da 18,00 € a *19,00 €*» ⏎ «Fatto. *Pollo arrosto*: prezzo da 14,00 € a *15,00 €*» ⏎ «Quale intendi? 1. *Pollo arrosto* (15,00 €) 2. *Tagliata* (19,00 €)»
- **y-sposta-028** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Panna cotta|Speciali, move|Tiramisù|Speciali
  - turni: sposta il tiramisù negli speciali ⏎ anche la panna cotta
  - atteso: move|Panna cotta|Speciali, move|Tiramisù|Speciali · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale intendi? 1. *Tiramisù* (6,00 €) 2. *Panna cotta* (5,00 €)» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-sposta-035** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Pizza fritta|Speciali
  - turni: sposta la pizza negli speciali ⏎ la fritta
  - atteso: move|Pizza fritta|Speciali · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-sposta-036** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Pizza fritta|Speciali
  - turni: sposta la pizza negli speciali ⏎ la seconda
  - atteso: move|Pizza fritta|Speciali · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-rinomina-004** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tagliata|20, rename|Tagliata|Tagliata di manzo
  - turni: chiama la tagliata 'Tagliata di manzo' ⏎ la tagliata di manzo a 20
  - atteso: price|Tagliata|20, rename|Tagliata|Tagliata di manzo · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-rinomina-013** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|Pollo arrosto|Pollo alla diavola
  - turni: rinomina il pollo in Pollo alla diavola
  - atteso: rename|Pollo arrosto|Pollo alla diavola · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-rinomina-014** [GRAVE] GRAVE non-applicato: non applicato: rename|Pollo arrosto|Pollo alla diavola
  - turni: rinomina il pollo in Pollo alla diavola ⏎ la diavola a 9
  - atteso: price|Diavola|9, rename|Pollo arrosto|Pollo alla diavola · ottenuto: price|Diavola|9
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Fatto. *Diavola*: prezzo da 8,00 € a *9,00 €*»
- **y-rinomina-016** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|Tiramisù|Tiramisù della casa
  - turni: rinomina il tiramisù ⏎ Tiramisù della casa
  - atteso: rename|Tiramisù|Tiramisù della casa · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-rinomina-018** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Panna cotta|6
  - turni: cambia nome alla panna cotta: Panna cotta al caramello ⏎ e mettila a 6
  - atteso: price|Panna cotta|6, rename|Panna cotta|Panna cotta al caramello · ottenuto: rename|Panna cotta|Panna cotta al caramello
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. *Panna cotta*: nuovo nome *Panna cotta al caramello*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-rinomina-021** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Supplì|Antipasti, rename|Supplì|Supplì al telefono
  - turni: rinomina il supplì in Supplì al telefono e spostalo negli antipasti
  - atteso: move|Supplì|Antipasti, rename|Supplì|Supplì al telefono · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-lunghe-003** [GRAVE] GRAVE non-applicato: non applicato: price|Gricia|13
  - turni: ciao ⏎ la carbonara a 13 ⏎ ❓ quanto costa la gricia? ⏎ mettila uguale alla carbonara ⏎ grazie
  - atteso: price|Carbonara|13, price|Gricia|13 · ottenuto: price|Carbonara|13
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Di nulla.» ⏎ «Fatto. *Carbonara*: prezzo da 12,00 € a *13,00 €*» ⏎ «*Gricia*: *11,00 €* · disponibile» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Di nulla.»
- **y-lunghe-004** [GRAVE] GRAVE non-applicato: non applicato: featured|cacio e pepe|true
  - turni: aggiungi la cacio e pepe ⏎ nei primi ⏎ 12 ⏎ mettila in evidenza ⏎ ❓ che primi ho? ⏎ ok grazie
  - atteso: create|cacio e pepe|12|primi, featured|cacio e pepe|true · ottenuto: create|cacio e pepe|12|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quanto costa cacio e pepe? In quale categoria lo metto?» ⏎ «Non sono sicuro di aver capito: cosa vuoi cambiare?» ⏎ «Fatto. Nuovo piatto *cacio e pepe* in *Primi*: *12,00 €*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «*Primo del giorno*: *10,00 €* · disponibile» ⏎ «Di nulla.»
- **y-lunghe-007** [GRAVE] GRAVE non-applicato: non applicato: create|carpaccio|14|crudi di mare, create|tartare|16|crudi di mare, move|Insalata di mare|Crudi di mare
  - turni: crea la categoria crudi ⏎ aggiungi nei crudi la tartare a 16 ⏎ aggiungi nei crudi il carpaccio a 14 ⏎ sposta l'insalata di mare nei crudi ⏎ rinomina la categoria crudi in Crudi di mare ⏎ ❓ cosa c'è nei crudi di mare?
  - atteso: create|carpaccio|14|crudi di mare, create|tartare|16|crudi di mare, move|Insalata di mare|Crudi di mare, section|crudi di mare · ottenuto: section|crudi di mare
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Crudi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Fatto. Categoria *Crudi di mare*: nuovo nome *Crudi di mare*» ⏎ «*Insalata di mare*: *13,00 €* · disponibile»
- **y-lunghe-012** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: featured|Diavola|true
  - turni: nascondi la diavola ⏎ ❓ la diavola è nascosta? ⏎ rimettila ⏎ ❓ e adesso? ⏎ mettila in evidenza
  - atteso: featured|Diavola|true · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. *Diavola*: *nascosto* dal menu» ⏎ «*Piatti nascosti (1)* - Diavola» ⏎ «Fatto. *Diavola*: di nuovo *visibile* nel menu» ⏎ «*Diavola*: *8,00 €* · disponibile» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-lunghe-013** [GRAVE] GRAVE eliminato-senza-conferma: turno 4: delete|lasagna
  - turni: aggiungi la lasagna ⏎ 14 ⏎ mettila in evidenza ⏎ anzi no ⏎ nascondi boh ⏎ il tiramisù a 7 ⏎ annulla
  - atteso: create|lasagna|14|piatti di prova, hidden|boh|true · ottenuto: hidden|boh|true
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quanto costa lasagna?» ⏎ «Fatto. Nuovo piatto *lasagna* in *Piatti di prova*: *14,00 €*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Ho annullato l’ultima modifica. *lasagna*: tolto (era stato aggiunto)» ⏎ «Fatto. *boh*: *nascosto* dal menu» ⏎ «Fatto. *tiramisù*: prezzo da 6,00 € a *7,00 €*» ⏎ «Ho annullato l’ultima modifica. *tiramisù*: com’era prima»
- **y-numeri-015** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Caffè|1.3
  - turni: il caffè a un euro e trenta
  - atteso: price|Caffè|1.3 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-numeri-016** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Caffè|1.3
  - turni: il caffè a 1 e 30
  - atteso: price|Caffè|1.3 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-unita-009** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Birra|6
  - turni: la birra da 66 a 6
  - atteso: price|Birra|6 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-unita-010** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Birra|5.5
  - turni: la birra 0,4 l a 5,50
  - atteso: price|Birra|5.5 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-fuoritempo-002** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|lasagna|14|piatti di prova
  - turni: aggiungi la lasagna ⏎ [+20 min] ⏎ 14
  - atteso: create|lasagna|14|piatti di prova · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quanto costa lasagna?» ⏎ «Non sono sicuro di aver capito: cosa vuoi cambiare?»
- **y-varianti-008** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tagliata|16
  - turni: la tagliata 2 euro in meno
  - atteso: price|Tagliata|16 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: cosa vuoi cambiare?»
- **y-varianti-031** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Birra|4.5
  - turni: abbassa di 50 cent la birra
  - atteso: price|Birra|4.5 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-varianti-032** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Birra|5.5
  - turni: la birra 50 cent in più
  - atteso: price|Birra|5.5 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-r2-rinomina-001** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: featured|Gricia|true, rename|Gricia|Gricia romana
  - turni: rinomina la gricia in Gricia romana e mettila in evidenza
  - atteso: featured|Gricia|true, rename|Gricia|Gricia romana · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-r2-rinomina-010** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|Gricia|Gricia romana
  - turni: chiama la gricia "Gricia romana"
  - atteso: rename|Gricia|Gricia romana · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-r2-sposta-006** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Carbonara|Secondi, move|Gricia|Secondi
  - turni: sposta la carbonara nei secondi ⏎ e anche la gricia
  - atteso: move|Carbonara|Secondi, move|Gricia|Secondi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale intendi? 1. *Carbonara* (12,00 €) 2. *Gricia* (11,00 €)» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-r2-sposta-007** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Carbonara|Secondi, move|Gricia|Secondi
  - turni: sposta la carbonara nei secondi ⏎ pure la gricia
  - atteso: move|Carbonara|Secondi, move|Gricia|Secondi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale intendi? 1. *Carbonara* (12,00 €) 2. *Gricia* (11,00 €)» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-r2-sposta-008** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Carbonara|Secondi, move|Gricia|Secondi
  - turni: sposta la carbonara nei secondi ⏎ la gricia uguale
  - atteso: move|Carbonara|Secondi, move|Gricia|Secondi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale intendi? 1. *Carbonara* (12,00 €) 2. *Gricia* (11,00 €)» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-r2-relativi-005** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13
  - turni: la carbonara 1 euro in più
  - atteso: price|Carbonara|13 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: cosa vuoi cambiare?»
- **y-r3-conferme-010** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|11.5
  - turni: togli 50 cent alla carbonara
  - atteso: price|Carbonara|11.5 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-r3-conferme-018** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|Tagliata|Tagliata di manzo
  - turni: chiama la tagliata «Tagliata di manzo»
  - atteso: rename|Tagliata|Tagliata di manzo · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-r3-conferme-020** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Tagliata|true
  - turni: rinomina la tagliata in Tagliata di manzo ⏎ nascondila
  - atteso: hidden|Tagliata|true, rename|Tagliata|Tagliata di manzo · ottenuto: rename|Tagliata|Tagliata di manzo
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. *Tagliata*: nuovo nome *Tagliata di manzo*» ⏎ «Non sono sicuro di aver capito: cosa vuoi cambiare?»
