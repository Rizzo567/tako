# Avversaria X · modo oracle

| Famiglia | Conv. | OK | GRAVE | GRAVE sicurezza | MEDIO |
|---|---|---|---|---|---|
| coppie | 30 | 30 | 0 | 0 | 0 |
| prezzi | 32 | 29 | 0 | 0 | 3 |
| centesimi | 25 | 25 | 0 | 0 | 0 |
| nomi | 31 | 30 | 0 | 0 | 1 |
| deixis | 35 | 33 | 0 | 0 | 2 |
| anzino | 30 | 29 | 0 | 0 | 1 |
| misti | 30 | 30 | 0 | 0 | 0 |
| asr | 50 | 50 | 0 | 0 | 0 |
| parole | 22 | 22 | 0 | 0 | 0 |
| vocali | 25 | 25 | 0 | 0 | 0 |
| sospeso | 25 | 25 | 0 | 0 | 0 |
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
| TOTALE | 508 | 501 | 0 | 0 | 7 |

## Fallimenti

- **adv-prezzi-004** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Acqua|2.5
  - turni: l'acqua 2 e 50 e la birra media 5
  - atteso: price|Acqua|2.5 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **adv-prezzi-010** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Amatriciana|12, price|Carbonara|13
  - turni: carbonara 13 e l'amatriciana un euro in meno
  - atteso: price|Amatriciana|12, price|Carbonara|13 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **adv-prezzi-022** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Birra piccola|3.5
  - turni: la birra media a 5 e la piccola a 3 e 50
  - atteso: price|Birra piccola|3.5 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **adv-nomi-002** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|tagliata di pollo|14|secondi
  - turni: aggiungi tra i secondi la tagliata di pollo a 14 per favore grazie
  - atteso: create|tagliata di pollo|14|secondi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. C'è già Tagliata a 18 €: lo aggiorno o ne creo un altro? Non ancora pubblicato: 1. Nuovo piatto *tagliata di pollo* in *Secondi*: »
- **adv-deixis-018** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Pasta al sugo|10
  - turni: la pasta a 10 ⏎ quella al sugo
  - atteso: price|Pasta al sugo|10 · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale intendi? 1. *Pasta al ragù* (12,00 €) 2. *Pasta al sugo* (9,00 €) 3. *Pasta al pesto* (10,00 €) 4. *Pasta e ceci* (9,00 €)» ⏎ «Quale intendi? 1. *Pasta al sugo* (9,00 €) 2. *Polpette al sugo* (11,00 €)»
- **adv-deixis-020** [MEDIO] MEDIO in-attesa-ok: resta in attesa di OK: hidden|Pasta al pesto|true, hidden|Pasta al ragù|true, hidden|Pasta al sugo|true, hidden|Pasta e ceci|true
  - turni: nascondi la pasta ⏎ tutte
  - atteso: hidden|Pasta al pesto|true, hidden|Pasta al ragù|true, hidden|Pasta al sugo|true, hidden|Pasta e ceci|true · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale intendi? 1. *Pasta al ragù* (12,00 €) 2. *Pasta al sugo* (9,00 €) 3. *Pasta al pesto* (10,00 €) 4. *Pasta e ceci* (9,00 €)» ⏎ «Rispondi OK per pubblicare. Non ancora pubblicato, da confermare con OK: 1. *Pasta al ragù*: *nascosto* dal menu 2. *Pasta al sugo*: *nascosto* dal menu 3. *Pasta al pesto*: *nascosto* dal menu 4. *Pasta e ceci*: *nascos»
- **adv-anzino-010** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: featured|Tagliata di tonno|true
  - turni: metti in evidenza la tagliata ⏎ no anzi tutte e due
  - atteso: featured|Tagliata di tonno|true, featured|Tagliata|true · ottenuto: featured|Tagliata|true
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. *Tagliata*: *in evidenza*» ⏎ «Quale intendi? 1. *Tagliata* (18,00 €) 2. *Tagliata di tonno* (20,00 €)»
