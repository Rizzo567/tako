# Avversaria Y · modo oracle

| Famiglia | Conv. | OK | GRAVE | GRAVE sicurezza | MEDIO |
|---|---|---|---|---|---|
| el-conferma | 49 | 49 | 0 | 0 | 0 |
| el-multi | 16 | 14 | 0 | 0 | 2 |
| el-misto | 16 | 13 | 0 | 0 | 3 |
| el-annulla | 16 | 16 | 0 | 0 | 0 |
| cat-crea | 25 | 23 | 0 | 0 | 2 |
| cat-piatti | 22 | 18 | 0 | 0 | 4 |
| cat-rinomina | 19 | 15 | 0 | 0 | 4 |
| sposta | 37 | 32 | 0 | 0 | 5 |
| rinomina | 24 | 21 | 0 | 0 | 3 |
| lunghe | 14 | 14 | 0 | 0 | 0 |
| cambio | 14 | 14 | 0 | 0 | 0 |
| ripeti | 12 | 12 | 0 | 0 | 0 |
| numeri | 31 | 31 | 0 | 0 | 0 |
| unita | 17 | 15 | 0 | 0 | 2 |
| emoji | 15 | 15 | 0 | 0 | 0 |
| refusi | 23 | 23 | 0 | 0 | 0 |
| vuoti | 15 | 15 | 0 | 0 | 0 |
| fuoritempo | 11 | 10 | 0 | 0 | 1 |
| varianti | 37 | 35 | 0 | 0 | 2 |
| r2-el-misto | 20 | 20 | 0 | 0 | 0 |
| r2-el-si | 17 | 17 | 0 | 0 | 0 |
| r2-rinomina | 18 | 17 | 0 | 0 | 1 |
| r2-cat | 16 | 16 | 0 | 0 | 0 |
| r2-sposta | 16 | 16 | 0 | 0 | 0 |
| r2-relativi | 16 | 16 | 0 | 0 | 0 |
| r2-code | 16 | 16 | 0 | 0 | 0 |
| r3-conferme | 26 | 24 | 0 | 0 | 2 |
| TOTALE | 558 | 527 | 0 | 0 | 31 |

## Fallimenti

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
- **y-el-misto-015** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: delete|Tagliata, price|Pollo arrosto|12
  - turni: elimina la tagliata e togli 2 euro al pollo ⏎ sì
  - atteso: delete|Tagliata, price|Pollo arrosto|12 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
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
- **y-sposta-019** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Birra|Caffè
  - turni: sposta la birra nel caffè
  - atteso: move|Birra|Caffè · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-sposta-026** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Pollo arrosto|Speciali, move|Tagliata|Speciali
  - turni: la tagliata a 19 ⏎ e il pollo a 15 ⏎ spostali negli speciali
  - atteso: move|Pollo arrosto|Speciali, move|Tagliata|Speciali, price|Pollo arrosto|15, price|Tagliata|19 · ottenuto: price|Pollo arrosto|15, price|Tagliata|19
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. *Tagliata*: prezzo da 18,00 € a *19,00 €*» ⏎ «Fatto. *Pollo arrosto*: prezzo da 14,00 € a *15,00 €*» ⏎ «Quale intendi? 1. *Pollo arrosto* (15,00 €) 2. *Tagliata* (19,00 €)»
- **y-sposta-035** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Pizza fritta|Speciali
  - turni: sposta la pizza negli speciali ⏎ la fritta
  - atteso: move|Pizza fritta|Speciali · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-sposta-036** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: move|Pizza fritta|Speciali
  - turni: sposta la pizza negli speciali ⏎ la seconda
  - atteso: move|Pizza fritta|Speciali · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
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
- **y-r3-conferme-010** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|11.5
  - turni: togli 50 cent alla carbonara
  - atteso: price|Carbonara|11.5 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **y-r3-conferme-020** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Tagliata|true
  - turni: rinomina la tagliata in Tagliata di manzo ⏎ nascondila
  - atteso: hidden|Tagliata|true, rename|Tagliata|Tagliata di manzo · ottenuto: rename|Tagliata|Tagliata di manzo
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. *Tagliata*: nuovo nome *Tagliata di manzo*» ⏎ «Non sono sicuro di aver capito: cosa vuoi cambiare?»
