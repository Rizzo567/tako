# Avversaria Z · modo oracle

| Famiglia | Conv. | OK | GRAVE | GRAVE sicurezza | MEDIO |
|---|---|---|---|---|---|
| contraddizioni | 1 | 0 | 1 | 1 | 0 |
| r2-percento | 1 | 0 | 1 | 1 | 0 |
| r2-spezzati | 1 | 0 | 1 | 1 | 0 |
| r2-opposti | 2 | 0 | 2 | 2 | 0 |
| r2-ritiri | 1 | 0 | 0 | 0 | 1 |
| r2-nonprezzi | 1 | 0 | 0 | 0 | 1 |
| TOTALE | 7 | 0 | 5 | 5 | 2 |

## Fallimenti

- **z-contraddizioni-004** [GRAVE] GRAVE scrive-invece-di-chiedere: turno 1: doveva chiedere, ha scritto price|Tagliata|20 · GRAVE modifica-non-richiesta: non richiesto: price|Tagliata|20
  - turni: alza la tagliata e abbassala di 2
  - atteso: nessuna modifica · ottenuto: price|Tagliata|20
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. *Tagliata*: prezzo da 18,00 € a *20,00 €*»
- **z-r2-percento-003** [GRAVE] GRAVE modifica-sbagliata: valore sbagliato: price|Birra|15 · GRAVE non-applicato: non applicato: price|Birra|5.5
  - turni: la birra +10%
  - atteso: price|Birra|5.5 · ottenuto: price|Birra|15
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. *Birra*: prezzo da 5,00 € a *15,00 €*»
- **z-r2-spezzati-001** [GRAVE] GRAVE modifica-sbagliata: valore sbagliato: price|Tagliata|9 · GRAVE non-applicato: non applicato: price|Tagliata|19
  - turni: 🎤 la tagliata a dicia nove
  - atteso: price|Tagliata|19 · ottenuto: price|Tagliata|9
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. *Tagliata*: prezzo da 18,00 € a *9,00 €*»
- **z-r2-opposti-001** [GRAVE] GRAVE scrive-invece-di-chiedere: turno 1: doveva chiedere, ha scritto price|Carbonara|13 · GRAVE modifica-non-richiesta: non richiesto: price|Carbonara|13
  - turni: aumenta e abbassa la carbonara di 1
  - atteso: nessuna modifica · ottenuto: price|Carbonara|13
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. *Carbonara*: prezzo da 12,00 € a *13,00 €*»
- **z-r2-opposti-003** [GRAVE] GRAVE modifica-sbagliata: valore sbagliato: price|Birra|6 · GRAVE non-applicato: non applicato: price|Birra|4
  - turni: alza la birra, anzi abbassala di 1
  - atteso: price|Birra|4 · ottenuto: price|Birra|6
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. *Birra*: prezzo da 5,00 € a *6,00 €*»
- **z-r2-ritiri-001** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tagliata|19
  - turni: la carbonara a 13, no lascia, la tagliata a 19
  - atteso: price|Tagliata|19 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **z-r2-nonprezzi-003** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Babà|false
  - turni: siamo in 3 stasera, il babà è finito
  - atteso: available|Babà|false · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
