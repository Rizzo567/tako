# Avversaria X · modo oracle

| Famiglia | Conv. | OK | GRAVE | GRAVE sicurezza | MEDIO |
|---|---|---|---|---|---|
| coppie | 30 | 30 | 0 | 0 | 0 |
| prezzi | 32 | 30 | 0 | 0 | 2 |
| centesimi | 25 | 25 | 0 | 0 | 0 |
| nomi | 31 | 31 | 0 | 0 | 0 |
| deixis | 35 | 33 | 0 | 0 | 2 |
| anzino | 30 | 29 | 0 | 0 | 1 |
| misti | 30 | 30 | 0 | 0 | 0 |
| asr | 50 | 47 | 0 | 0 | 3 |
| parole | 22 | 22 | 0 | 0 | 0 |
| vocali | 25 | 25 | 0 | 0 | 0 |
| sospeso | 25 | 24 | 0 | 0 | 1 |
| suono | 25 | 25 | 0 | 0 | 0 |
| code | 31 | 31 | 0 | 0 | 0 |
| relativi | 20 | 20 | 0 | 0 | 0 |
| cent2 | 14 | 14 | 0 | 0 | 0 |
| misti2 | 18 | 18 | 0 | 0 | 0 |
| ordinali | 8 | 8 | 0 | 0 | 0 |
| sospeso2 | 15 | 15 | 0 | 0 | 0 |
| lev1 | 14 | 14 | 0 | 0 | 0 |
| lasciastare | 10 | 10 | 0 | 0 | 0 |
| ipotesi | 8 | 8 | 0 | 0 | 0 |
| toglieuro | 10 | 10 | 0 | 0 | 0 |
| TOTALE | 508 | 499 | 0 | 0 | 9 |

## Fallimenti

- **adv-prezzi-004** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Acqua|2.5
  - turni: l'acqua 2 e 50 e la birra media 5
  - atteso: price|Acqua|2.5 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi? 1. *Acqua* 2. *Birra media* Rispondi con il *numero* o il *nome*.»
- **adv-prezzi-022** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Birra piccola|3.5
  - turni: la birra media a 5 e la piccola a 3 e 50
  - atteso: price|Birra piccola|3.5 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi? 1. *Birra piccola* 2. *Birra media* Rispondi con il *numero* o il *nome*.»
- **adv-deixis-020** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Pasta al pesto|true
  - turni: nascondi la pasta ⏎ tutte
  - atteso: hidden|Pasta al pesto|true · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Cosa vuoi cambiare per *Pasta al pesto*: il prezzo, se è finito o altro? Non ho cambiato nulla.» ⏎ «Ti riferisci a *Pasta al sugo* o *Pasta al pesto*? Dimmi il piatto e cosa cambiare. Non ho cambiato nulla.»
- **adv-deixis-026** [MEDIO] MEDIO chiarimento-mancante: turno 2: doveva chiedere un chiarimento («Nessuna modifica: il menu è *già così*. Non ho cambiato nulla.»)
  - turni: la carbonara è finita ⏎ anche gli altri due primi romani
  - atteso: available|Carbonara|false · ottenuto: available|Carbonara|false
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Confermato.* Ho aggiornato il menu. *Carbonara*: *finito*» ⏎ «Nessuna modifica: il menu è *già così*. Non ho cambiato nulla.»
- **adv-anzino-010** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: featured|Tagliata di tonno|true
  - turni: metti in evidenza la tagliata ⏎ no anzi tutte e due
  - atteso: featured|Tagliata di tonno|true, featured|Tagliata|true · ottenuto: featured|Tagliata|true
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Confermato.* Ho aggiornato il menu. *Tagliata*: *in evidenza*» ⏎ «Quale piatto intendi: *Tagliata*, *Tagliata di tonno*? Dimmi quale e cosa cambiare. Non ho cambiato nulla.»
- **adv-asr-005** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: 🎤 la carbonata a 13
  - atteso: nessuna modifica · ottenuto: price|Carbonara|13
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Confermato.* Ho aggiornato il menu. *Carbonara*: prezzo da 12,00 € a *13,00 €*»
- **adv-asr-021** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: 🎤 il pollo alla griglia a 15
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non ho capito la richiesta.* Puoi riscriverla o mandare un altro vocale?»
- **adv-asr-022** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: 🎤 il polpo al curry a 15
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non ho capito la richiesta.* Puoi riscriverla o mandare un altro vocale?»
- **adv-sospeso-010** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13, price|Torta della nonna|7
  - turni: la torta a 7, la birra a 4 e la carbonara a 13 ⏎ la nonna
  - atteso: price|Carbonara|13, price|Torta della nonna|7 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ho capito, *non ancora pubblicato*: 1. *Carbonara*: prezzo da 12,00 € a *13,00 €* 2. *Torta della nonna*: prezzo da 6,00 € a *7,00» ⏎ «Ho capito, *non ancora pubblicato*: 1. *Carbonara*: prezzo da 12,00 € a *13,00 €* 2. *Torta della nonna*: prezzo da 6,00 € a *7,00 €* «la birra a 4» non l’ho capito: cosa intendevi? Rispondi e pubblico tutto insieme: *no»
