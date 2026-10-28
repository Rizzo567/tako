# Batteria R8 · modo off

| Famiglia | Conv. | OK | GRAVE | GRAVE sicurezza | MEDIO |
|---|---|---|---|---|---|
| nuova-categoria | 48 | 0 | 48 | 0 | 0 |
| sposta-poi-piatti | 32 | 0 | 32 | 0 | 0 |
| categoria-esistente | 48 | 0 | 48 | 0 | 0 |
| piatto-esistente | 16 | 0 | 0 | 0 | 16 |
| niente-fatto | 16 | 1 | 1 | 0 | 14 |
| TOTALE | 160 | 1 | 129 | 0 | 30 |

## Fallimenti

- **r8-nuova-categoria-001** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
metti le paste a 10 euro e il riso a 8 euro
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-002** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
le paste a 10 e il riso a 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-003** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
tutti a 10 tranne il riso a 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-004** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
a 10, 10 e 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-005** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
le paste 10 euro, il riso 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-006** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
10 euro le paste e 8 euro il riso
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-007** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
paste a 10 €, il riso a 8 €
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-008** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
tutte le paste a dieci euro e il riso a otto
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-009** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
metti le paste a 10 euro e il riso a 8 euro ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-010** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
le paste a 10 e il riso a 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-011** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
tutti a 10 tranne il riso a 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-012** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
a 10, 10, 10 e 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-013** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
le paste 10 euro, il riso 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-014** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
10 euro le paste e 8 euro il riso ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-015** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
paste a 10 €, il riso a 8 € ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-016** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
tutte le paste a dieci euro e il riso a otto ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-017** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
metti le paste a 10 euro e il riso a 8 euro
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-018** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
le paste a 10 e il riso a 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-019** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
tutti a 10 tranne il riso a 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-020** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
a 10, 10 e 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-021** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
le paste 10 euro, il riso 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-022** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
10 euro le paste e 8 euro il riso
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-023** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
paste a 10 €, il riso a 8 €
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-024** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
tutte le paste a dieci euro e il riso a otto
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-025** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
metti le paste a 10 euro e il riso a 8 euro ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-026** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
le paste a 10 e il riso a 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-027** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
tutti a 10 tranne il riso a 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-028** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
a 10, 10, 10 e 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-029** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
le paste 10 euro, il riso 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-030** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
10 euro le paste e 8 euro il riso ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-031** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
paste a 10 €, il riso a 8 € ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-032** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi
  - turni: crea una nuova sezione primi ⏎ ora in primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
tutte le paste a dieci euro e il riso a otto ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-033** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto, pasta carbonara, riso giallo.
metti le paste a 10 euro e il riso a 8 euro
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-034** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto, pasta carbonara, riso giallo.
le paste a 10 e il riso a 8
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-035** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto, pasta carbonara, riso giallo.
tutti a 10 tranne il riso a 8
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-036** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto, pasta carbonara, riso giallo.
a 10, 10 e 8
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-037** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto, pasta carbonara, riso giallo.
le paste 10 euro, il riso 8
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-038** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto, pasta carbonara, riso giallo.
10 euro le paste e 8 euro il riso
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-039** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto, pasta carbonara, riso giallo.
paste a 10 €, il riso a 8 €
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-040** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto, pasta carbonara, riso giallo.
tutte le paste a dieci euro e il riso a otto
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-041** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
metti le paste a 10 euro e il riso a 8 euro ⏎ ok
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-042** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
le paste a 10 e il riso a 8 ⏎ ok
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-043** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
tutti a 10 tranne il riso a 8 ⏎ ok
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-044** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
a 10, 10, 10 e 8 ⏎ ok
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-045** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
le paste 10 euro, il riso 8 ⏎ ok
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-046** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
10 euro le paste e 8 euro il riso ⏎ ok
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-047** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
paste a 10 €, il riso a 8 € ⏎ ok
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-nuova-categoria-048** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8
  - turni: aggiungi la categoria Paste e risi ⏎ ora in paste e risi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
tutte le paste a dieci euro e il riso a otto ⏎ ok
  - atteso: create|pasta al pesto|10|paste e risi, create|pasta all amatriciana|10|paste e risi, create|pasta carbonara|10|paste e risi, create|riso giallo|8|paste e risi, section|paste e risi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-001** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
metti le paste a 10 euro e il riso a 8 euro
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-002** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
le paste a 10 e il riso a 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-003** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
tutti a 10 tranne il riso a 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-004** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
a 10, 10 e 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-005** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
le paste 10 euro, il riso 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-006** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
10 euro le paste e 8 euro il riso
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-007** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
paste a 10 €, il riso a 8 €
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-008** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto, pasta carbonara, riso giallo.
tutte le paste a dieci euro e il riso a otto
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-009** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
metti le paste a 10 euro e il riso a 8 euro ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-010** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
le paste a 10 e il riso a 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-011** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
tutti a 10 tranne il riso a 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-012** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
a 10, 10, 10 e 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-013** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
le paste 10 euro, il riso 8 ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-014** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
10 euro le paste e 8 euro il riso ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-015** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
paste a 10 €, il riso a 8 € ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-016** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta al pesto , pasta all'amatriciana, pasta carbonara, riso giallo.
tutte le paste a dieci euro e il riso a otto ⏎ ok
  - atteso: create|pasta al pesto|10|primi, create|pasta all amatriciana|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-017** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-018** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-019** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-020** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
a 10, 10 e 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-021** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-022** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-023** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
paste a 10 €, il risotto a 8 €
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-024** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
tutte le paste a dieci euro e il risotto a otto
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-025** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramis
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-026** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramis
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-027** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramis
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-028** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramis
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
a 10, 10, 10 e 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-029** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramis
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-030** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramis
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-031** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramis
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
paste a 10 €, il risotto a 8 € ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-sposta-poi-piatti-032** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramis
  - turni: sposta il tiramisù in una nuova sezione, crea la nuova sezione "primi" ⏎ ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
tutte le paste a dieci euro e il risotto a otto ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi, move|tiramisù|Primi, section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-001** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora in primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-002** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora in primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-003** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora in primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-004** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora in primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
a 10, 10 e 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-005** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora in primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-006** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora in primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-007** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora in primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-008** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora in primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-009** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora in primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-010** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora in primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
a 10, 10, 10 e 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-011** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora in primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-012** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora in primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-013** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-014** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-015** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-016** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
a 10, 10 e 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-017** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-018** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-019** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-020** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-021** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-022** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
a 10, 10, 10 e 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-023** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-024** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: ora nella sezione primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-025** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: nei primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-026** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: nei primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-027** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: nei primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-028** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: nei primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
a 10, 10 e 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-029** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: nei primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-030** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: nei primi aggiungi pasta alla norma, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-031** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: nei primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-032** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: nei primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-033** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: nei primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-034** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: nei primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
a 10, 10, 10 e 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-035** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: nei primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-036** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: nei primi aggiungi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-037** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: aggiungi nei primi pasta alla norma, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-038** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: aggiungi nei primi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-039** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: aggiungi nei primi pasta alla norma, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-040** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: aggiungi nei primi pasta alla norma, pasta e fagioli, risotto ai funghi.
a 10, 10 e 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-041** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: aggiungi nei primi pasta alla norma, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-042** [GRAVE] GRAVE non-applicato: non applicato: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: aggiungi nei primi pasta alla norma, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto
  - atteso: create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-043** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: aggiungi nei primi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
metti le paste a 10 euro e il risotto a 8 euro ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-044** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: aggiungi nei primi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste a 10 e il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-045** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: aggiungi nei primi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
tutti a 10 tranne il risotto a 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-046** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: aggiungi nei primi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
a 10, 10, 10 e 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-047** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: aggiungi nei primi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
le paste 10 euro, il risotto 8 ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-categoria-esistente-048** [GRAVE] GRAVE non-applicato: non applicato: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi
  - turni: aggiungi nei primi pasta alla norma, pasta al tonno, pasta e fagioli, risotto ai funghi.
10 euro le paste e 8 euro il risotto ⏎ ok
  - atteso: create|pasta al tonno|10|primi, create|pasta alla norma|10|primi, create|pasta e fagioli|10|primi, create|risotto ai funghi|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-piatto-esistente-001** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: ora in primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.
metti le paste a 10 euro e il riso a 8 euro
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-piatto-esistente-002** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: ora in primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.
le paste a 10 e il riso a 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-piatto-esistente-003** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: ora in primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.
tutti a 10 tranne il riso a 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-piatto-esistente-004** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: ora in primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.
a 10, 10, 10 e 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-piatto-esistente-005** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: ora in primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.
le paste 10 euro, il riso 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-piatto-esistente-006** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: ora in primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.
10 euro le paste e 8 euro il riso
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-piatto-esistente-007** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: ora in primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.
paste a 10 €, il riso a 8 €
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-piatto-esistente-008** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: ora in primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.
tutte le paste a dieci euro e il riso a otto
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-piatto-esistente-009** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: ora nella sezione primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.
metti le paste a 10 euro e il riso a 8 euro
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-piatto-esistente-010** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: ora nella sezione primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.
le paste a 10 e il riso a 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-piatto-esistente-011** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: ora nella sezione primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.
tutti a 10 tranne il riso a 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-piatto-esistente-012** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: ora nella sezione primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.
a 10, 10, 10 e 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-piatto-esistente-013** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: ora nella sezione primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.
le paste 10 euro, il riso 8
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-piatto-esistente-014** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: ora nella sezione primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.
10 euro le paste e 8 euro il riso
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-piatto-esistente-015** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: ora nella sezione primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.
paste a 10 €, il riso a 8 €
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-piatto-esistente-016** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: ora nella sezione primi aggiungi pasta al pesto , pasta al ragu, pasta carbonara, riso giallo.
tutte le paste a dieci euro e il riso a otto
  - atteso: create|pasta al pesto|10|primi, create|pasta carbonara|10|primi, create|riso giallo|8|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-niente-fatto-001** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: in primi aggiungi pasta al pesto e riso giallo
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-niente-fatto-002** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: nei secondi aggiungi pasta al pesto a 10 e riso giallo a 8
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-niente-fatto-003** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: in primi aggiungi le paste a 10 e il riso a 8
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-niente-fatto-004** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: ora in primi aggiungi pasta al pesto, pasta carbonara. metti le paste a
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-niente-fatto-005** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: nella sezione dolci aggiungi pasta al pesto a 10
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-niente-fatto-006** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: aggiungi in primi
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-niente-fatto-007** [MEDIO] MEDIO chiarimento-mancante: turno 1: doveva chiedere un chiarimento («Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una»)
  - turni: in primi metti riso giallo a
  - atteso: nessuna modifica · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-niente-fatto-009** [GRAVE] GRAVE non-applicato: non applicato: section|primi
  - turni: crea la categoria "primi" ⏎ ❓ quanto costano le paste in primi?
  - atteso: section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-niente-fatto-010** [MEDIO] MEDIO chiarimento-mancante: turno 2: doveva chiedere un chiarimento («Sono momentaneamente non disponibile, riprova tra un minuto.»)
  - turni: crea la categoria "primi" ⏎ in primi aggiungi pasta al pesto e riso giallo
  - atteso: section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-niente-fatto-011** [MEDIO] MEDIO chiarimento-mancante: turno 2: doveva chiedere un chiarimento («Sono momentaneamente non disponibile, riprova tra un minuto.»)
  - turni: crea la categoria "primi" ⏎ nei secondi aggiungi pasta al pesto a 10 e riso giallo a 8
  - atteso: section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-niente-fatto-012** [MEDIO] MEDIO chiarimento-mancante: turno 2: doveva chiedere un chiarimento («Sono momentaneamente non disponibile, riprova tra un minuto.»)
  - turni: crea la categoria "primi" ⏎ in primi aggiungi le paste a 10 e il riso a 8
  - atteso: section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-niente-fatto-013** [MEDIO] MEDIO chiarimento-mancante: turno 2: doveva chiedere un chiarimento («Sono momentaneamente non disponibile, riprova tra un minuto.»)
  - turni: crea la categoria "primi" ⏎ ora in primi aggiungi pasta al pesto, pasta carbonara. metti le paste a
  - atteso: section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-niente-fatto-014** [MEDIO] MEDIO chiarimento-mancante: turno 2: doveva chiedere un chiarimento («Sono momentaneamente non disponibile, riprova tra un minuto.»)
  - turni: crea la categoria "primi" ⏎ nella sezione dolci aggiungi pasta al pesto a 10
  - atteso: section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-niente-fatto-015** [MEDIO] MEDIO chiarimento-mancante: turno 2: doveva chiedere un chiarimento («Sono momentaneamente non disponibile, riprova tra un minuto.»)
  - turni: crea la categoria "primi" ⏎ aggiungi in primi
  - atteso: section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
- **r8-niente-fatto-016** [MEDIO] MEDIO chiarimento-mancante: turno 2: doveva chiedere un chiarimento («Sono momentaneamente non disponibile, riprova tra un minuto.»)
  - turni: crea la categoria "primi" ⏎ in primi metti riso giallo a
  - atteso: section|primi · ottenuto: nessuna modifica
  - risposte: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sono momentaneamente non disponibile, riprova tra un minuto.» ⏎ «Sono momentaneamente non disponibile, riprova tra un minuto.»
