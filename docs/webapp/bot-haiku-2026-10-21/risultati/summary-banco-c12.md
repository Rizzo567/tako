# Motore Haiku · set banco · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T23:47:26.612Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **90/92 (97.8%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 0, altri 1 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 3.4 (non attese 1.9) |
| Latenza chiamata Haiku p50 / p95 | 2077 / 5185 ms (167 chiamate) |
| Latenza turno p50 / p95 | 12 / 22 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.12 |
| Token medi per messaggio (in · out · cache read · cache write) | 220 · 342 · 10514 · 125 |
| Cache hit (cache_read > 0) | 166/167 (99.4%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.046722 $ · 0.000314 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 167 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 3.6 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| correzione-non-applicata | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 2 | 0 |

## Falliti (trascrizione)

### bv-correzioni-004 [GRAVE] — il turno 2 corregge: tiramisù a prezzo pieno 10, niente promo
- titolare: 🎤 Ok, metti la parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo in promo a 3 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, aggiorno *la parmigiana* e metto il *tiramisù* in promo. *la parmigiana*: prezzo da 10,00 € a *15,00 €* *tiramisù*: in *promo* a *3,00 €* (prezzo pieno 6,00 €), finché non la togli»
- titolare: 🎤 No, ho detto, mettila parmigiana a 7 euro, anzi no, mettila a 15 euro e il tiramisù mettilo a 3 euro, anzi no, mettila a 10 euro.
  - bot: «Quale *parmigiana* intendi, *la parmigiana* o *Inserisce il piatto la parmigiana*? Non ancora pubblicato: 1. *tiramisù*: prezzo da 6,00 € a *3,00 €* 2. *tiramisù*: tolgo la *promo*, torna a 6,00 € «la parmigiana»: 1. *la parmigiana* (15,00 €) 2. *Inserisce il piatto la parmigiana* (12,00 €)»
- atteso: price|la parmigiana|15, price|tiramisù|10 · ottenuto: price|la parmigiana|15, promo|tiramisù|3
- **GRAVE** correzione-non-applicata: resta la modifica poi corretta/annullata: promo|tiramisù|3
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|tiramisù|10

### bv-categorie-001 [MEDIO] — il ragù esistente va nei Primi (nota 62: prezzo 10 accettato, non richiesto perché la domanda sul ragù è rimasta senza r
- titolare: 🎤 E aggiungi pasta al ragù a 10 euro, aggiungi pasta al pesto a 15 euro, aggiungi caviale a 150 euro.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiungo *pasta al pesto* a 15 € e *caviale* a 150 €. C'è già *pasta al ragù* a 12 €: lo aggiorno a 10 € o ne creo un altro? Non ancora pubblicato: 1. Nuovo piatto *pasta al pesto* in *Piatti di prova*: *15,00 €* 2. Nuovo piatto *caviale* in *Piatti di prova*: *150,00 €* «pasta al ragù»: 1. *pasta al ragù* (1»
- titolare: 🎤 No, fai una cosa, aggiungi un'altra categoria, ovvero primi, e lì aggiungi quei due piatti che ti ho detto, invece il caviale aggiungere un'altra categoria ancora, chiamandola speciali.
  - bot: «Ok, creo *Primi* con *pasta al pesto* a *15 €* e *Speciali* con *caviale* a *150 €* in *Piatti di prova*. Per *pasta al ragù* ti chiedo: lo sposto in *Primi* e lo aggiorno a *10 €*, o lo lasci com'è?»
- atteso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|caviale|150|speciali, create|pasta al pesto|15|primi, move|pasta al ragù|Primi

