# Avversaria X · modo oracle

| Famiglia | Conv. | OK | GRAVE | GRAVE sicurezza | MEDIO |
|---|---|---|---|---|---|
| coppie | 30 | 30 | 0 | 0 | 0 |
| prezzi | 32 | 30 | 0 | 0 | 2 |
| centesimi | 25 | 25 | 0 | 0 | 0 |
| nomi | 31 | 31 | 0 | 0 | 0 |
| deixis | 35 | 25 | 3 | 2 | 7 |
| anzino | 30 | 29 | 0 | 0 | 1 |
| misti | 30 | 25 | 5 | 0 | 0 |
| asr | 50 | 45 | 2 | 2 | 3 |
| parole | 22 | 22 | 0 | 0 | 0 |
| vocali | 25 | 16 | 0 | 0 | 9 |
| sospeso | 25 | 19 | 4 | 1 | 2 |
| suono | 25 | 24 | 1 | 0 | 0 |
| code | 31 | 31 | 0 | 0 | 0 |
| relativi | 20 | 20 | 0 | 0 | 0 |
| cent2 | 14 | 14 | 0 | 0 | 0 |
| misti2 | 18 | 10 | 7 | 2 | 1 |
| ordinali | 8 | 8 | 0 | 0 | 0 |
| sospeso2 | 15 | 11 | 4 | 3 | 0 |
| lev1 | 14 | 13 | 1 | 1 | 0 |
| lasciastare | 10 | 6 | 3 | 3 | 1 |
| ipotesi | 8 | 7 | 1 | 1 | 0 |
| toglieuro | 10 | 10 | 0 | 0 | 0 |
| TOTALE | 508 | 451 | 31 | 15 | 26 |

## Fallimenti

- **adv-prezzi-004** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Acqua|2.5
  - turni: l'acqua 2 e 50 e la birra media 5
  - atteso: price|Acqua|2.5 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi? 1. *Acqua* 2. *Birra media* Rispondi con il *numero* o il *nome*.»
- **adv-prezzi-022** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Birra piccola|3.5
  - turni: la birra media a 5 e la piccola a 3 e 50
  - atteso: price|Birra piccola|3.5 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi? 1. *Birra piccola* 2. *Birra media* Rispondi con il *numero* o il *nome*.»
- **adv-deixis-014** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Gricia|false, hidden|Pasta al sugo|false
  - turni: ❓ quali piatti sono nascosti? ⏎ rimettili tutti
  - atteso: hidden|Gricia|false, hidden|Pasta al sugo|false · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Piatti nascosti (2)* - Gricia - Pasta al sugo» ⏎ «Cosa vuoi cambiare per *Supplì*: il prezzo, se è finito o altro? Non ho cambiato nulla.»
- **adv-deixis-015** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Carbonara|true, available|Tiramisù|true
  - turni: ❓ cosa è finito? ⏎ sono tornati entrambi
  - atteso: available|Carbonara|true, available|Tiramisù|true · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Piatti finiti (2)* - Carbonara - Tiramisù» ⏎ «Ti riferisci a *Carbonara* o *Tiramisù*? Dimmi il piatto e cosa cambiare. Non ho cambiato nulla.»
- **adv-deixis-017** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: featured|Amatriciana|true, featured|Carbonara|true
  - turni: carbonara 13 ⏎ gricia 12 ⏎ amatriciana 12 ⏎ il primo e l'ultimo mettili in evidenza
  - atteso: featured|Amatriciana|true, featured|Carbonara|true, price|Amatriciana|12, price|Carbonara|13, price|Gricia|12 · ottenuto: price|Amatriciana|12, price|Carbonara|13, price|Gricia|12
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Confermato.* Ho aggiornato il menu. *Carbonara*: prezzo da 12,00 € a *13,00 €*» ⏎ «*Confermato.* Ho aggiornato il menu. *Gricia*: prezzo da 11,00 € a *12,00 €*» ⏎ «*Confermato.* Ho aggiornato il menu. *Amatriciana*: prezzo da 11,00 € a *12,00 €*» ⏎ «Cosa vuoi cambiare per *Amatriciana*: il prezzo, se è finito o altro? Non ho cambiato nulla.»
- **adv-deixis-018** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una») · MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Pasta al sugo|10
  - turni: la pasta a 10 ⏎ quella al sugo
  - atteso: price|Pasta al sugo|10 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non ho capito la richiesta.* Puoi riscriverla o mandare un altro vocale?» ⏎ «Cosa vuoi cambiare per *Pasta al sugo*: il prezzo, se è finito o altro? Non ho cambiato nulla.»
- **adv-deixis-019** [MEDIO] MEDIO opzioni-non-leggibili: al turno 1 il bot non ha mostrato un'opzione n.2 · MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: la pasta a 10 ⏎ la seconda
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non ho capito la richiesta.* Puoi riscriverla o mandare un altro vocale?» ⏎ «Cosa vuoi cambiare per *Pasta al sugo*: il prezzo, se è finito o altro? Non ho cambiato nulla.»
- **adv-deixis-020** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Pasta al pesto|true
  - turni: nascondi la pasta ⏎ tutte
  - atteso: hidden|Pasta al pesto|true · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Cosa vuoi cambiare per *Pasta al pesto*: il prezzo, se è finito o altro? Non ho cambiato nulla.» ⏎ «Ti riferisci a *Pasta al sugo* o *Pasta al pesto*? Dimmi il piatto e cosa cambiare. Non ho cambiato nulla.»
- **adv-deixis-021** [GRAVE] GRAVE scrive-invece-di-chiedere: turno 1: doveva chiedere, ha scritto price|Torta della nonna|7
  - turni: la torta a 7 ⏎ quella della nonna
  - atteso: price|Torta della nonna|7 · ottenuto: price|Torta della nonna|7
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Confermato.* Ho aggiornato il menu. *Torta della nonna*: prezzo da 6,00 € a *7,00 €*» ⏎ «Cosa vuoi cambiare per *Torta della nonna*: il prezzo, se è finito o altro? Non ho cambiato nulla.»
- **adv-deixis-022** [GRAVE] GRAVE scrive-invece-di-chiedere: turno 1: doveva chiedere, ha scritto price|Torta della nonna|7 · GRAVE modifica-non-richiesta: non richiesto: price|Torta della nonna|7 · MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tortino al cioccolato|7
  - turni: la torta a 7 ⏎ il tortino
  - atteso: price|Tortino al cioccolato|7 · ottenuto: price|Torta della nonna|7
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Confermato.* Ho aggiornato il menu. *Torta della nonna*: prezzo da 6,00 € a *7,00 €*» ⏎ «Cosa vuoi cambiare per *Torta della nonna*: il prezzo, se è finito o altro? Non ho cambiato nulla.»
- **adv-deixis-026** [MEDIO] MEDIO chiarimento-mancante: turno 2: doveva chiedere un chiarimento («Nessuna modifica: il menu è *già così*. Non ho cambiato nulla.»)
  - turni: la carbonara è finita ⏎ anche gli altri due primi romani
  - atteso: available|Carbonara|false · ottenuto: available|Carbonara|false
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Confermato.* Ho aggiornato il menu. *Carbonara*: *finito*» ⏎ «Nessuna modifica: il menu è *già così*. Non ho cambiato nulla.»
- **adv-deixis-034** [GRAVE] GRAVE correzione-non-applicata: resta la modifica poi corretta/annullata: featured|Polpo alla griglia|true
  - turni: metti in evidenza il polpo ⏎ toglilo
  - atteso: nessuna modifica · ottenuto: featured|Polpo alla griglia|true
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Confermato.* Ho aggiornato il menu. *Polpo alla griglia*: *in evidenza*» ⏎ «Cosa vuoi cambiare per *Polpo alla griglia*: il prezzo, se è finito o altro? Non ho cambiato nulla.»
- **adv-anzino-010** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: featured|Tagliata di tonno|true
  - turni: metti in evidenza la tagliata ⏎ no anzi tutte e due
  - atteso: featured|Tagliata di tonno|true, featured|Tagliata|true · ottenuto: featured|Tagliata|true
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Confermato.* Ho aggiornato il menu. *Tagliata*: *in evidenza*» ⏎ «Quale piatto intendi: *Tagliata*, *Tagliata di tonno*? Dimmi quale e cosa cambiare. Non ho cambiato nulla.»
- **adv-misti-013** [GRAVE] GRAVE frase-come-piatto: turno 1: «Non trovo «ho alzato la carbonara»»
  - turni: ❓ ho alzato la carbonara a 13?
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non trovo «ho alzato la carbonara».* Scrivi il nome come appare nel menu.»
- **adv-misti-014** [GRAVE] GRAVE frase-come-piatto: turno 1: «Non trovo «hai messo la carbonara»»
  - turni: ❓ hai messo la carbonara a 13?
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non trovo «hai messo la carbonara».* Scrivi il nome come appare nel menu.»
- **adv-misti-015** [GRAVE] GRAVE frase-come-piatto: turno 1: «Non trovo «perche la carbonara e»»
  - turni: ❓ perché la carbonara è a 12?
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non trovo «perche la carbonara e».* Scrivi il nome come appare nel menu.»
- **adv-misti-023** [GRAVE] GRAVE frase-come-piatto: turno 1: «Non trovo «posso mettere la bomba»»
  - turni: ❓ posso mettere la bomba a 5?
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non trovo «posso mettere la bomba».* Scrivi il nome come appare nel menu.»
- **adv-misti-025** [GRAVE] GRAVE frase-come-piatto: turno 1: «Non trovo «come faccio a mettere la carbonara»»
  - turni: ❓ come faccio a mettere la carbonara a 13?
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non trovo «come faccio a mettere la carbonara».* Scrivi il nome come appare nel menu.»
- **adv-asr-005** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: 🎤 la carbonata a 13
  - atteso: nessuna modifica · ottenuto: price|Carbonara|13
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Confermato.* Ho aggiornato il menu. *Carbonara*: prezzo da 12,00 € a *13,00 €*»
- **adv-asr-009** [GRAVE] GRAVE scrive-invece-di-chiedere: turno 1: doveva chiedere, ha scritto price|Bomba|5 · GRAVE modifica-non-richiesta: non richiesto: price|Bomba|5
  - turni: 🎤 la bombe a 5
  - atteso: nessuna modifica · ottenuto: price|Bomba|5
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Confermato.* Ho aggiornato il menu. *Bomba*: prezzo da 4,00 € a *5,00 €*»
- **adv-asr-021** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: 🎤 il pollo alla griglia a 15
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non ho capito la richiesta.* Puoi riscriverla o mandare un altro vocale?»
- **adv-asr-022** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: 🎤 il polpo al curry a 15
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non ho capito la richiesta.* Puoi riscriverla o mandare un altro vocale?»
- **adv-asr-025** [GRAVE] GRAVE scrive-invece-di-chiedere: turno 1: doveva chiedere, ha scritto price|Torta della nonna|7 · GRAVE modifica-non-richiesta: non richiesto: price|Torta della nonna|7
  - turni: 🎤 la torta a 7
  - atteso: nessuna modifica · ottenuto: price|Torta della nonna|7
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Confermato.* Ho aggiornato il menu. *Torta della nonna*: prezzo da 6,00 € a *7,00 €*»
- **adv-vocali-001** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13
  - turni: 🎤 allora ehm... la carbonara, la carbonara mettila a... a tredici, sì tredici, e poi... boh... l'amatriciana lasciala com'è
  - atteso: price|Carbonara|13 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi? 1. *Carbonara* 2. *boh* Rispondi con il *numero* o il *nome*.»
- **adv-vocali-003** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tagliata|17
  - turni: 🎤 eh niente boh non so, la tagliata costa troppo, mettila a diciassette
  - atteso: price|Tagliata|17 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi? 1. *Tagliata* 2. *boh* Rispondi con il *numero* o il *nome*.»
- **adv-vocali-004** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Bombette pugliesi|10
  - turni: 🎤 senti una cosa, ehm, la bomba... no aspetta, le bombette, mettile a dieci euro
  - atteso: price|Bombette pugliesi|10 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi? 1. *Bombette pugliesi* 2. *Bomba* Rispondi con il *numero* o il *nome*.»
- **adv-vocali-007** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tagliata di tonno|21
  - turni: 🎤 la tagliata, quella di tonno non quella normale, a ventuno
  - atteso: price|Tagliata di tonno|21 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi? 1. *Tagliata di tonno* 2. *Tagliata* Rispondi con il *numero* o il *nome*.»
- **adv-vocali-008** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Amatriciana|13, price|Carbonara|13
  - turni: 🎤 allora la carbonara a tredici e l'amatriciana pure, e la gricia invece la lasci a undici
  - atteso: price|Amatriciana|13, price|Carbonara|13 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Cosa vuoi cambiare per *Gricia*: il prezzo, se è finito o altro? Non ho cambiato nulla.»
- **adv-vocali-012** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13
  - turni: 🎤 boh fai tu, la carbonara mettila a tredici
  - atteso: price|Carbonara|13 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi? 1. *Carbonara* 2. *boh* Rispondi con il *numero* o il *nome*.»
- **adv-vocali-016** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Carbonara|false
  - turni: 🎤 non so boh, la carbonara è finita
  - atteso: available|Carbonara|false · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi? 1. *Carbonara* 2. *boh* Rispondi con il *numero* o il *nome*.»
- **adv-vocali-022** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Carbonara|false
  - turni: 🎤 aspetta che controllo... sì, la carbonara è finita, e il tiramisù... no il tiramisù c'è
  - atteso: available|Carbonara|false · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi? 1. *Carbonara* 2. *Tiramisù* Rispondi con il *numero* o il *nome*.»
- **adv-vocali-024** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Amatriciana|12
  - turni: 🎤 la carbonara la tengo a dodici, l'amatriciana invece la porto a dodici pure lei
  - atteso: price|Amatriciana|12 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi? 1. *Amatriciana* 2. *Carbonara* Rispondi con il *numero* o il *nome*.»
- **adv-sospeso-004** [GRAVE] GRAVE richiesta-persa: richiesta persa: price|Tagliata|19
  - turni: nascondi carbonara, gricia, amatriciana e cacio e pepe ⏎ la tagliata a 19
  - atteso: price|Tagliata|19 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Osteria dei Simili*: ecco le modifiche. 1. *Carbonara*: *nascosto* dal menu 2. *Gricia*: *nascosto* dal menu 3. *Amatriciana*: *n» ⏎ «*Non ho capito la richiesta.* Puoi riscriverla o mandare un altro vocale?»
- **adv-sospeso-010** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13, price|Torta della nonna|7
  - turni: la torta a 7, la birra a 4 e la carbonara a 13 ⏎ la nonna
  - atteso: price|Carbonara|13, price|Torta della nonna|7 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ho capito, *non ancora pubblicato*: 1. *Carbonara*: prezzo da 12,00 € a *13,00 €* 2. *Torta della nonna*: prezzo da 6,00 € a *7,00» ⏎ «Ho capito, *non ancora pubblicato*: 1. *Carbonara*: prezzo da 12,00 € a *13,00 €* 2. *Torta della nonna*: prezzo da 6,00 € a *7,00 €* «la birra a 4» non l’ho capito: cosa intendevi? Rispondi e pubblico tutto insieme: *no»
- **adv-sospeso-012** [GRAVE] GRAVE non-applicato: non applicato: create|risotto alla zucca|14|piatto del giorno
  - turni: piatto del giorno: risotto alla zucca a 14 ⏎ la carbonara a 13 ⏎ annulla
  - atteso: create|risotto alla zucca|14|piatto del giorno · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. per «piatto del giorno: risotto alla zucca a » intendi: Polpo alla griglia: prezzo da 16,00 € a 14,00 €? Rispondi *sì* o *no*. Non» ⏎ «*Confermato.* Ho aggiornato il menu. *Carbonara*: prezzo da 12,00 € a *13,00 €*» ⏎ «*Annullato.* Il menu è tornato com’era prima dell’ultima modifica. *Carbonara*: com’era prima»
- **adv-sospeso-014** [GRAVE] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una») · GRAVE richiesta-persa: richiesta persa: create|risotto ai funghi|14|piatto del giorno
  - turni: oggi piatto del giorno risotto ai funghi ⏎ 14
  - atteso: create|risotto ai funghi|14|piatto del giorno · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non ho capito la richiesta.* Puoi riscriverla o mandare un altro vocale?» ⏎ «*Non ho capito la richiesta.* Puoi riscriverla o mandare un altro vocale?»
- **adv-sospeso-015** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|risotto ai funghi|15|piatto del giorno · MEDIO senza-contesto: turno 2
  - turni: piatto del giorno risotto ai funghi a 14 ⏎ no a 15
  - atteso: create|risotto ai funghi|15|piatto del giorno · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non ho capito la richiesta.* Puoi riscriverla o mandare un altro vocale?» ⏎ «A quale piatto ti riferisci, e cosa vuoi cambiare? Non ho cambiato nulla.»
- **adv-sospeso-019** [GRAVE] GRAVE modifica-non-richiesta: non richiesto: create|trofie|12|piatti di prova
  - turni: aggiungi le trofie ⏎ lascia perdere ⏎ 12
  - atteso: nessuna modifica · ottenuto: create|trofie|12|piatti di prova
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quanto costa *Trofie*?» ⏎ «Quanto costa *Trofie*?» ⏎ «*Confermato.* Ho aggiornato il menu. Nuovo piatto *Trofie* in *Piatti di prova*: *12,00 €*»
- **adv-suono-011** [GRAVE] GRAVE non-applicato: non applicato: price|Carbonara|13
  - turni: grazie, la carbonara a 13
  - atteso: price|Carbonara|13 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Di nulla.»
- **adv-misti2-002** [GRAVE] GRAVE frase-come-piatto: turno 1: «Non trovo «carbonara a 13 la gricia»» · GRAVE richiesta-persa: richiesta persa: price|Carbonara|13 · BASSO risposta-non-pertinente: risposta finale senza /11/
  - turni: la carbonara a 13. la gricia quanto costa?
  - atteso: price|Carbonara|13 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non trovo «carbonara a 13 la gricia».* Scrivi il nome come appare nel menu.»
- **adv-misti2-003** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13 · BASSO risposta-non-pertinente: risposta finale senza /11/
  - turni: metti la carbonara a 13 e poi dimmi quanto costa la gricia
  - atteso: price|Carbonara|13 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi? 1. *Carbonara* 2. *Gricia* Rispondi con il *numero* o il *nome*.»
- **adv-misti2-007** [GRAVE] GRAVE non-applicato: non applicato: price|Carbonara|13
  - turni: buongiorno! la carbonara a 13 grazie
  - atteso: price|Carbonara|13 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Di nulla.»
- **adv-misti2-014** [GRAVE] GRAVE frase-come-piatto: turno 1: «Non trovo «polpo e finito la tagliata di tonno»» · GRAVE richiesta-persa: richiesta persa: available|Polpo alla griglia|false · BASSO risposta-non-pertinente: risposta finale senza /20/
  - turni: il polpo è finito. la tagliata di tonno quanto costa?
  - atteso: available|Polpo alla griglia|false · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non trovo «polpo e finito la tagliata di tonno».* Scrivi il nome come appare nel menu.»
- **adv-misti2-015** [GRAVE] GRAVE fatto-falso: turno 1: dice fatto ma non ha scritto nulla («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una») · GRAVE frase-come-piatto: turno 1: «Non trovo «ho messo la carbonara»»
  - turni: ❓ ho messo la carbonara a 13 o no?
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non trovo «ho messo la carbonara».* Scrivi il nome come appare nel menu.»
- **adv-misti2-016** [GRAVE] GRAVE frase-come-piatto: turno 1: «Non trovo «chi ha messo la carbonara»»
  - turni: ❓ chi ha messo la carbonara a 12?
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non trovo «chi ha messo la carbonara».* Scrivi il nome come appare nel menu.»
- **adv-misti2-017** [GRAVE] GRAVE fatto-falso: turno 1: dice fatto ma non ha scritto nulla («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una») · GRAVE frase-come-piatto: turno 1: «Non trovo «quando ho messo la gricia»»
  - turni: ❓ quando ho messo la gricia a 11?
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non trovo «quando ho messo la gricia».* Scrivi il nome come appare nel menu.»
- **adv-misti2-018** [GRAVE] GRAVE frase-come-piatto: turno 1: «Non trovo «perche hai messo la bomba»»
  - turni: ❓ perché hai messo la bomba a 4?
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Non trovo «perche hai messo la bomba».* Scrivi il nome come appare nel menu.»
- **adv-sospeso2-001** [GRAVE] GRAVE modifica-non-richiesta: non richiesto: price|Polpo alla griglia|14 · GRAVE non-applicato: non applicato: create|risotto alla zucca|14|piatto del giorno
  - turni: piatto del giorno: risotto alla zucca a 14 ⏎ sì
  - atteso: create|risotto alla zucca|14|piatto del giorno · ottenuto: price|Polpo alla griglia|14
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. per «piatto del giorno: risotto alla zucca a » intendi: Polpo alla griglia: prezzo da 16,00 € a 14,00 €? Rispondi *sì* o *no*. Non» ⏎ «*Confermato.* Ho aggiornato il menu. *Polpo alla griglia*: prezzo da 16,00 € a *14,00 €*»
- **adv-sospeso2-006** [GRAVE] GRAVE modifica-non-richiesta: non richiesto: price|Piatto di verifica|14 · GRAVE non-applicato: non applicato: create|risotto alla zucca|14|piatto del giorno
  - turni: piatto del giorno: risotto alla zucca a 14 ⏎ sì
  - atteso: create|risotto alla zucca|14|piatto del giorno · ottenuto: price|Piatto di verifica|14
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. per «piatto del giorno: risotto alla zucca a » intendi: Piatto di verifica: prezzo da 13,50 € a 14,00 €? Rispondi *sì* o *no*. Non» ⏎ «*Confermato.* Ho aggiornato il menu. *Piatto di verifica*: prezzo da 13,50 € a *14,00 €*»
- **adv-sospeso2-009** [GRAVE] GRAVE correzione-non-applicata: resta la modifica poi corretta/annullata: hidden|Gricia|true
  - turni: nascondi la gricia ⏎ anzi no, lasciala
  - atteso: nessuna modifica · ottenuto: hidden|Gricia|true
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Confermato.* Ho aggiornato il menu. *Gricia*: *nascosto* dal menu» ⏎ «Cosa vuoi cambiare per *Gricia*: il prezzo, se è finito o altro? Non ho cambiato nulla.»
- **adv-sospeso2-014** [GRAVE] GRAVE modifica-non-richiesta: non richiesto: create|niente lascia stare|11|piatti di prova · GRAVE non-applicato: non applicato: price|la parmigiana|11
  - turni: aggiungi le trofie ⏎ no niente, lascia stare ⏎ la parmigiana a 11
  - atteso: price|la parmigiana|11 · ottenuto: create|niente lascia stare|11|piatti di prova
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quanto costa *Trofie*?» ⏎ «Quanto costa *Niente lascia stare*?» ⏎ «*Confermato.* Ho aggiornato il menu. Nuovo piatto *Niente lascia stare* in *Piatti di prova*: *11,00 €*»
- **adv-lev1-007** [GRAVE] GRAVE modifica-non-richiesta: non richiesto: available|Torta della nonna|false
  - turni: la torta al limone è finita
  - atteso: nessuna modifica · ottenuto: available|Torta della nonna|false
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. *Confermato.* Ho aggiornato il menu. *Torta della nonna*: *finito*»
- **adv-lasciastare-001** [GRAVE] GRAVE modifica-non-richiesta: non richiesto: create|niente lascia stare|11|piatti di prova · GRAVE non-applicato: non applicato: price|la parmigiana|11
  - turni: aggiungi le trofie ⏎ no niente, lascia stare ⏎ la parmigiana a 11
  - atteso: price|la parmigiana|11 · ottenuto: create|niente lascia stare|11|piatti di prova
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quanto costa *Trofie*?» ⏎ «Quanto costa *Niente lascia stare*?» ⏎ «*Confermato.* Ho aggiornato il menu. Nuovo piatto *Niente lascia stare* in *Piatti di prova*: *11,00 €*»
- **adv-lasciastare-002** [GRAVE] GRAVE modifica-non-richiesta: non richiesto: create|trofie|7|piatti di prova · GRAVE non-applicato: non applicato: price|tiramisù|7
  - turni: aggiungi le trofie ⏎ niente, lascia perdere ⏎ il tiramisù a 7
  - atteso: price|tiramisù|7 · ottenuto: create|trofie|7|piatti di prova
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quanto costa *Trofie*?» ⏎ «*Non ho capito la richiesta.* Puoi riscriverla o mandare un altro vocale?» ⏎ «*Confermato.* Ho aggiornato il menu. Nuovo piatto *Trofie* in *Piatti di prova*: *7,00 €*»
- **adv-lasciastare-006** [GRAVE] GRAVE modifica-non-richiesta: non richiesto: create|non fa niente|7|piatti di prova · GRAVE non-applicato: non applicato: price|tiramisù|7
  - turni: aggiungi le trofie ⏎ no, non fa niente ⏎ il tiramisù a 7
  - atteso: price|tiramisù|7 · ottenuto: create|non fa niente|7|piatti di prova
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quanto costa *Trofie*?» ⏎ «Quanto costa *Non fa niente*?» ⏎ «*Confermato.* Ho aggiornato il menu. Nuovo piatto *Non fa niente* in *Piatti di prova*: *7,00 €*»
- **adv-lasciastare-008** [MEDIO] MEDIO senza-contesto: turno 2
  - turni: aggiungi le trofie ⏎ annulla tutto ⏎ nascondi la parmigiana
  - atteso: hidden|la parmigiana|true · ottenuto: hidden|la parmigiana|true
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quanto costa *Trofie*?» ⏎ «A quale piatto ti riferisci, e cosa vuoi cambiare? Non ho cambiato nulla.» ⏎ «*Confermato.* Ho aggiornato il menu. *la parmigiana*: *nascosto* dal menu»
- **adv-ipotesi-004** [GRAVE] GRAVE modifica-non-richiesta: non richiesto: price|Polpo alla griglia|14 · GRAVE non-applicato: non applicato: create|risotto alla zucca|14|piatto del giorno
  - turni: fuori menu oggi risotto alla zucca a 14 ⏎ sì
  - atteso: create|risotto alla zucca|14|piatto del giorno · ottenuto: price|Polpo alla griglia|14
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. per «fuori menu oggi risotto alla zucca a 14» intendi: Polpo alla griglia: prezzo da 16,00 € a 14,00 €? Rispondi *sì* o *no*. Non » ⏎ «*Confermato.* Ho aggiornato il menu. *Polpo alla griglia*: prezzo da 16,00 € a *14,00 €*»
