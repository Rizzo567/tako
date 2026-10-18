# Avversaria Z · modo oracle

| Famiglia | Conv. | OK | GRAVE | GRAVE sicurezza | MEDIO |
|---|---|---|---|---|---|
| dialetto | 25 | 24 | 0 | 0 | 1 |
| asr | 25 | 22 | 0 | 0 | 3 |
| numeri | 25 | 25 | 0 | 0 | 0 |
| tempo | 20 | 20 | 0 | 0 | 0 |
| omonimi | 24 | 24 | 0 | 0 | 0 |
| riepilogo | 20 | 18 | 0 | 0 | 2 |
| lunghi | 10 | 10 | 0 | 0 | 0 |
| emoji | 15 | 15 | 0 | 0 | 0 |
| contraddizioni | 15 | 15 | 0 | 0 | 0 |
| annulla | 20 | 20 | 0 | 0 | 0 |
| nascosti | 20 | 19 | 0 | 0 | 1 |
| assurdi | 15 | 15 | 0 | 0 | 0 |
| apostrofi | 20 | 20 | 0 | 0 | 0 |
| ripeti | 10 | 9 | 0 | 0 | 1 |
| interruzioni | 20 | 18 | 0 | 0 | 2 |
| travestite | 25 | 25 | 0 | 0 | 0 |
| promo | 20 | 19 | 0 | 0 | 1 |
| sposta | 15 | 14 | 0 | 0 | 1 |
| rinomine | 15 | 13 | 0 | 0 | 2 |
| locali | 10 | 10 | 0 | 0 | 0 |
| r2-percento | 8 | 8 | 0 | 0 | 0 |
| r2-spezzati | 6 | 6 | 0 | 0 | 0 |
| r2-opposti | 5 | 3 | 0 | 0 | 2 |
| r2-ritiri | 5 | 5 | 0 | 0 | 0 |
| r2-nonprezzi | 7 | 7 | 0 | 0 | 0 |
| r2-disfa | 8 | 8 | 0 | 0 | 0 |
| TOTALE | 408 | 392 | 0 | 0 | 16 |

## Fallimenti

- **z-dialetto-005** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Burrata|10
  - turni: mettece la burrata a diece euro
  - atteso: price|Burrata|10 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: cosa vuoi cambiare?»
- **z-asr-003** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Tiramisù|false
  - turni: 🎤 il tira mi su è finito
  - atteso: available|Tiramisù|false · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi Tiramisù? Rispondi sì o no.»
- **z-asr-005** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Pizza 'nduja|10
  - turni: 🎤 la pizza en duja a dieci
  - atteso: price|Pizza 'nduja|10 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale intendi? 1. *Pizza 'nduja* (9,00 €) 2. *Pizza all'ortolana* (8,00 €)»
- **z-asr-009** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Baccalà fritto|16
  - turni: 🎤 il bacalà fritto a sedici
  - atteso: price|Baccalà fritto|16 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale intendi? 1. *Calzone fritto* (9,00 €) 2. *Baccalà fritto* (15,00 €)»
- **z-riepilogo-003** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Babà|4, price|Carbonara|13, price|Tagliata|19
  - turni: la carbonara a 13, la tagliata a 19, la birra a 6 e il babà a 4 ⏎ togli la birra dalla lista ⏎ ok
  - atteso: price|Babà|4, price|Carbonara|13, price|Tagliata|19 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Quale intendi? 1. *Carbonara* (12,00 €) 2. *Tagliata* (18,00 €) 3. *Babà* (5,00 €)» ⏎ «Quale intendi? 1. *Birra* (5,00 €) 2. *Carbonara* (12,00 €) 3. *Tagliata* (18,00 €) 4. *Babà* (5,00 €)»
- **z-riepilogo-004** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Babà|4, price|Carbonara|13, price|Tagliata|19
  - turni: la carbonara a 13, la tagliata a 19, la birra a 6 e il babà a 4 ⏎ la birra lasciala com'è ⏎ ok
  - atteso: price|Babà|4, price|Carbonara|13, price|Tagliata|19 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Quale intendi? 1. *Carbonara* (12,00 €) 2. *Tagliata* (18,00 €) 3. *Babà* (5,00 €)» ⏎ «Quale intendi? 1. *Birra* (5,00 €) 2. *Carbonara* (12,00 €) 3. *Tagliata* (18,00 €) 4. *Babà* (5,00 €)»
- **z-nascosti-010** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Babà|false, hidden|Burrata|false
  - turni: ❓ quali sono nascosti? ⏎ rimettili tutti
  - atteso: hidden|Babà|false, hidden|Burrata|false · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Posso cambiare prezzi e disponibilità, nascondere o mettere in evidenza i piatti, aggiungerne di nuovi, eliminarli, spostarli e ri» ⏎ «Non sono sicuro di aver capito: cosa vuoi cambiare?»
- **z-ripeti-007** [MEDIO] MEDIO categoria-fuori-ordine: turno 1: Contorni
  - turni: crea la categoria contorni ⏎ crea la categoria contorni
  - atteso: section|contorni · ottenuto: section|contorni
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Contorni*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **z-interruzioni-008** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: delete|Babà
  - turni: elimina il babà ⏎ sì e anche il tiramisù
  - atteso: delete|Babà · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Elimino *Babà* dal menu? Rispondi sì. Da eliminare, serve il tuo sì: 1. *Babà*: da eliminare» ⏎ «Non sono sicuro di aver capito: cosa vuoi cambiare?»
- **z-interruzioni-011** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: delete|Babà
  - turni: elimina il babà e il tiramisù ⏎ solo il babà ⏎ sì
  - atteso: delete|Babà · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Elimino *Babà* e *Tiramisù* dal menu? Rispondi sì. Da eliminare, serve il tuo sì: 1. *Babà*: da eliminare 2. *Tiramisù*: da elimin» ⏎ «Non sono sicuro di aver capito: cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: cosa vuoi cambiare?»
- **z-promo-015** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: featured|Babà|true, featured|Delizia al limone|true, featured|Tiramisù|true
  - turni: metti tutti i dolci in evidenza
  - atteso: featured|Babà|true, featured|Delizia al limone|true, featured|Tiramisù|true · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale intendi? 1. *Tiramisù* (6,00 €) 2. *Babà* (5,00 €) 3. *Delizia al limone* (5,50 €)»
- **z-sposta-008** [MEDIO] MEDIO categoria-fuori-ordine: turno 2: Contorni
  - turni: sposta la burrata nei contorni ⏎ sì
  - atteso: move|Burrata|Contorni, section|contorni · ottenuto: move|Burrata|Contorni, section|contorni
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel menu non c'è la categoria Contorni: la creo? Rispondi sì. Categoria nuova, serve il tuo sì: 1. Nuova categoria *Contorni* 2. *» ⏎ «Fatto. Nuova categoria *Contorni* *Burrata*: spostato in *Contorni*»
- **z-rinomine-002** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Babà|6
  - turni: rinomina il babà in babà al rum ⏎ e mettilo a 6
  - atteso: price|Babà|6, rename|Babà|Babà al rum · ottenuto: rename|Babà|Babà al rum
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. *Babà*: nuovo nome *Babà al rum*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **z-rinomine-009** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Babà|true, rename|Babà|Babà al rum
  - turni: rinomina il babà in babà al rum, e nascondilo
  - atteso: hidden|Babà|true, rename|Babà|Babà al rum · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **z-r2-opposti-003** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Birra|4
  - turni: alza la birra, anzi abbassala di 1
  - atteso: price|Birra|4 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **z-r2-opposti-004** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: mostra e nascondi il babà
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nessuna modifica: il menu è *già così*. Non ho cambiato nulla.»
