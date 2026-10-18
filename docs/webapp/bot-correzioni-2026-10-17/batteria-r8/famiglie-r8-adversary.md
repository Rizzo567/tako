# Batteria R8 · modo adversary

| Famiglia | Conv. | OK | GRAVE | GRAVE sicurezza | MEDIO |
|---|---|---|---|---|---|
| nuova-categoria | 48 | 0 | 0 | 0 | 48 |
| sposta-poi-piatti | 32 | 0 | 0 | 0 | 32 |
| categoria-esistente | 48 | 0 | 0 | 0 | 48 |
| piatto-esistente | 16 | 16 | 0 | 0 | 0 |
| niente-fatto | 16 | 16 | 0 | 0 | 0 |
| TOTALE | 160 | 32 | 0 | 0 | 128 |

## Fallimenti

- **r8-nuova-categoria-001** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
metti le paste a 10 euro e il riso a 8 euro
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-002** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
le paste a 10 e il riso a 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-nuova-categoria-003** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
tutti a 10 tranne il riso a 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-004** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
a 10, 10 e 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-005** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
le paste 10 euro, il riso 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-006** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
10 euro le paste e 8 euro il riso
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-nuova-categoria-007** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
paste a 10 €, il riso a 8 €
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-008** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
tutte le paste a dieci euro e il riso a otto
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-009** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
metti le paste a 10 euro e il riso a 8 euro ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-010** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
le paste a 10 e il riso a 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-011** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
tutti a 10 tranne il riso a 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-012** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
a 10, 10, 10 e 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-013** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
le paste 10 euro, il riso 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-014** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
10 euro le paste e 8 euro il riso ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-015** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
paste a 10 €, il riso a 8 € ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-016** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
tutte le paste a dieci euro e il riso a otto ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-017** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
metti le paste a 10 euro e il riso a 8 euro
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-018** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
le paste a 10 e il riso a 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-nuova-categoria-019** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
tutti a 10 tranne il riso a 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-020** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
a 10, 10 e 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-021** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
le paste 10 euro, il riso 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-022** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
10 euro le paste e 8 euro il riso
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-nuova-categoria-023** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
paste a 10 €, il riso a 8 €
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-024** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
tutte le paste a dieci euro e il riso a otto
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-025** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
metti le paste a 10 euro e il riso a 8 euro ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-026** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
le paste a 10 e il riso a 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-027** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
tutti a 10 tranne il riso a 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-028** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
a 10, 10, 10 e 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-029** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
le paste 10 euro, il riso 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-030** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
10 euro le paste e 8 euro il riso ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-031** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
paste a 10 €, il riso a 8 € ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-032** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
tutte le paste a dieci euro e il riso a otto ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: section|primi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Primi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-033** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto, pasta carbonara, riso giallo.
metti le paste a 10 euro e il riso a 8 euro
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: section|paste e risi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Paste e risi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-034** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto, pasta carbonara, riso giallo.
le paste a 10 e il riso a 8
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: section|paste e risi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Paste e risi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-035** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto, pasta carbonara, riso giallo.
tutti a 10 tranne il riso a 8
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: section|paste e risi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Paste e risi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-036** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto, pasta carbonara, riso giallo.
a 10, 10 e 8
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: section|paste e risi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Paste e risi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-037** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto, pasta carbonara, riso giallo.
le paste 10 euro, il riso 8
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: section|paste e risi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Paste e risi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-038** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto, pasta carbonara, riso giallo.
10 euro le paste e 8 euro il riso
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: section|paste e risi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Paste e risi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-039** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto, pasta carbonara, riso giallo.
paste a 10 €, il riso a 8 €
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: section|paste e risi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Paste e risi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-040** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto, pasta carbonara, riso giallo.
tutte le paste a dieci euro e il riso a otto
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: section|paste e risi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Paste e risi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-041** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
metti le paste a 10 euro e il riso a 8 euro ⏎ ok
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: section|paste e risi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Paste e risi*» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-042** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
le paste a 10 e il riso a 8 ⏎ ok
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: section|paste e risi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Paste e risi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-043** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
tutti a 10 tranne il riso a 8 ⏎ ok
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: section|paste e risi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Paste e risi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-044** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
a 10, 10, 10 e 8 ⏎ ok
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: section|paste e risi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Paste e risi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-045** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
le paste 10 euro, il riso 8 ⏎ ok
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: section|paste e risi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Paste e risi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-046** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
10 euro le paste e 8 euro il riso ⏎ ok
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: section|paste e risi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Paste e risi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-047** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
paste a 10 €, il riso a 8 € ⏎ ok
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: section|paste e risi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Paste e risi*» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-nuova-categoria-048** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
tutte le paste a dieci euro e il riso a otto ⏎ ok
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: section|paste e risi
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Fatto. Nuova categoria *Paste e risi*» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-sposta-poi-piatti-001** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, sect
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
metti le paste a 10 euro e il riso a 8 euro
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)»
- **r8-sposta-poi-piatti-002** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, sect
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
le paste a 10 e il riso a 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-sposta-poi-piatti-003** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, sect
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
tutti a 10 tranne il riso a 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)»
- **r8-sposta-poi-piatti-004** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, sect
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
a 10, 10 e 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-sposta-poi-piatti-005** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, sect
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
le paste 10 euro, il riso 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)»
- **r8-sposta-poi-piatti-006** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, sect
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
10 euro le paste e 8 euro il riso
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)»
- **r8-sposta-poi-piatti-007** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, sect
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
paste a 10 €, il riso a 8 €
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)»
- **r8-sposta-poi-piatti-008** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, sect
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
tutte le paste a dieci euro e il riso a otto
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)»
- **r8-sposta-poi-piatti-009** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
metti le paste a 10 euro e il riso a 8 euro ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-sposta-poi-piatti-010** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
le paste a 10 e il riso a 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-sposta-poi-piatti-011** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
tutti a 10 tranne il riso a 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-sposta-poi-piatti-012** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
a 10, 10, 10 e 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-sposta-poi-piatti-013** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
le paste 10 euro, il riso 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-sposta-poi-piatti-014** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
10 euro le paste e 8 euro il riso ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)» ⏎ «Quale intendi? 1. *tiramisù* (15,00 €) 2. *Pasta al pesto e lasagna* (10,01 €)»
- **r8-sposta-poi-piatti-015** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
paste a 10 €, il riso a 8 € ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-sposta-poi-piatti-016** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso gi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
tutte le paste a dieci euro e il riso a otto ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-sposta-poi-piatti-017** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Pri
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-sposta-poi-piatti-018** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Pri
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-sposta-poi-piatti-019** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Pri
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)»
- **r8-sposta-poi-piatti-020** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Pri
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
a 10, 10 e 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)»
- **r8-sposta-poi-piatti-021** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Pri
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)»
- **r8-sposta-poi-piatti-022** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Pri
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)»
- **r8-sposta-poi-piatti-023** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Pri
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
paste a 10 €, il risotto a 8 €
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)»
- **r8-sposta-poi-piatti-024** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Pri
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
tutte le paste a dieci euro e il risotto a otto
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-sposta-poi-piatti-025** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-sposta-poi-piatti-026** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.» ⏎ «Non sono sicuro di aver capito: cosa vuoi cambiare?»
- **r8-sposta-poi-piatti-027** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-sposta-poi-piatti-028** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
a 10, 10, 10 e 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.» ⏎ «Non sono sicuro di aver capito: cosa vuoi cambiare?»
- **r8-sposta-poi-piatti-029** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-sposta-poi-piatti-030** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-sposta-poi-piatti-031** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
paste a 10 €, il risotto a 8 € ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-sposta-poi-piatti-032** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
tutte le paste a dieci euro e il risotto a otto ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare? Sezioni del menu: Piatti di prova (nel menu digitale: Altre proposte)» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-001** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora in primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-002** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora in primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-003** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora in primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-004** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora in primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
a 10, 10 e 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-005** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora in primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-006** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora in primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-categoria-esistente-007** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: ora in primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-008** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: ora in primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-009** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: ora in primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-010** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: ora in primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
a 10, 10, 10 e 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-011** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: ora in primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-categoria-esistente-012** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: ora in primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-013** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-014** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-015** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-016** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
a 10, 10 e 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-017** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-018** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-019** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-020** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-categoria-esistente-021** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-022** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
a 10, 10, 10 e 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-023** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-024** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-025** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: nei primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-026** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: nei primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-027** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: nei primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-028** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: nei primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
a 10, 10 e 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-categoria-esistente-029** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: nei primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-030** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: nei primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-031** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: nei primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-032** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: nei primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-033** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: nei primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-034** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: nei primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
a 10, 10, 10 e 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-035** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: nei primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-categoria-esistente-036** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: nei primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-categoria-esistente-037** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: aggiungi nei primi pasta alla norma, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-038** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: aggiungi nei primi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-039** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: aggiungi nei primi pasta alla norma, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-040** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: aggiungi nei primi pasta alla norma, pasta e fagioli, risotto ai funghi.
a 10, 10 e 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-041** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: aggiungi nei primi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-042** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: aggiungi nei primi pasta alla norma, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-categoria-esistente-043** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: aggiungi nei primi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-044** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: aggiungi nei primi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-045** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: aggiungi nei primi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-046** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: aggiungi nei primi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
a 10, 10, 10 e 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
- **r8-categoria-esistente-047** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: aggiungi nei primi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?» ⏎ «Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.»
- **r8-categoria-esistente-048** [MEDIO] MEDIO chiede-invece-di-agire: domanda invece di agire / contesto perso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai f
  - turni: aggiungi nei primi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Vuoi che pubblichi le modifiche in sospeso? Rispondi sì o no.» ⏎ «Non sono sicuro di aver capito: puoi dirmi esattamente cosa vuoi cambiare?»
