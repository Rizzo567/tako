# Motore Haiku · set multiturno · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-22T00:08:47.360Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **36/38 (94.7%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 2 — sicurezza 2, altri 0 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 5.5 (non attese 5.3) |
| Latenza chiamata Haiku p50 / p95 | 2927 / 5628 ms (52 chiamate) |
| Latenza turno p50 / p95 | 15 / 44 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 0.49 |
| Token medi per messaggio (in · out · cache read · cache write) | 160 · 239 · 4583 · 264 |
| Cache hit (cache_read > 0) | 50/52 (96.2%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.022737 $ · 0.000215 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 52 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 3.3 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| menu-nominato-ignorato (sicurezza) | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 2 | 0 |

## Falliti (trascrizione)

### mt-vera [GRAVE] — conversazione vera: 5 «solamente pasta al pesto e carbonara» può valere come correzione (solo quelle due a 9) o come con
- titolare: 🎤 La parmigiana passa a 12.50.
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, aggiorno *La parmigiana* a 12,50 €. *la parmigiana*: prezzo da 15,00 € a *12,50 €*»
- titolare: 🎤 No, ha detto la parmigiana.
  - bot: «Per «No, ha detto la parmigiana.» intendi *la parmigiana*? Rispondi sì oppure dimmi il nome giusto. 1. *la parmigiana* (12,50 €)»
- titolare: 🎤 Ok, adesso metti tutte le paste a 9 euro.
  - bot: «Messi a 9,00 € i prezzi di 6 piatti. *pasta al ragù*: prezzo da 10,00 € a *9,00 €* *Pasta al pesto e lasagna*: prezzo da 10,01 € a *9,00 €* *pasta al pesto*: prezzo da 11,00 € a *9,00 €* *pasta carbonara*: prezzo da 10,00 € a *9,00 €* *pasta all'amatriciana*: prezzo da 11,00 € a *9,00 €* *pasta alla norma*: prezzo da 10,00 € a *9,00 €* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: 🎤 No, no, diminuisci il prezzo solamente a quelle là che sono visibili.
  - bot: «*pasta all'amatriciana*: prezzo da 9,00 € a *11,00 €* *pasta alla norma*: prezzo da 9,00 € a *10,00 €*»
- titolare: solamente pasta al pesto e carbonara
  - bot: «Intendi *pasta al pesto* e *pasta carbonara* a 9 €? Dimmi sì o indicami quali piatti cambiare. 1. *pasta al pesto* (9,00 €) 2. *pasta carbonara* (9,00 €)»
- titolare: 🎤 Cambia il nome del menù, da menù di verifica a menù di prova.
  - bot: «Menu *Menu di verifica · web QA*: ora si chiama *Menu di prova* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: 🎤 No vabbè fa niente, voglio che aggiungi nel menù pranzo le lasagne.
  - bot: «Nel *Menu pranzo* non c’è un sottomenu adatto a *Lasagna*: creo il sottomenu *Primi* e la metto lì? Rispondi *sì* oppure dimmi il nome del sottomenu. Dimmi anche il prezzo.»
- titolare: 🎤 Tu come mi consiglieresti di chiamare il sottomenù?
  - bot: «Ti consiglio *Primi*, va bene così o preferisci un altro nome?»
- titolare: si
  - bot: «Ho creato il sottomenu *Primi* nel Menu *Menu pranzo*. A che prezzo metto *Lasagna* nei *Primi*?»
- titolare: si
  - bot: «Il sottomenu *Primi* è pronto. Per mettere *Lasagna* mi manca solo il prezzo: scrivimi per esempio «lasagna 12».»
- titolare: si voglio chiamarlo primi
  - bot: «Il sottomenu *Primi* c’è già. Per mettere *Lasagna* mi manca solo il prezzo: scrivimi per esempio «lasagna 12».»
- titolare: aumenta tutti i primi di 1 euro
  - bot: «Aumentati di 1,00 € i prezzi di 6 piatti. *la parmigiana*: prezzo da 12,50 € a *13,50 €* *pasta al pesto*: prezzo da 9,00 € a *10,00 €* *pasta carbonara*: prezzo da 9,00 € a *10,00 €* *riso giallo*: prezzo da 8,00 € a *9,00 €* *pasta all'amatriciana*: prezzo da 11,00 € a *12,00 €* *pasta alla norma*: prezzo da 10,00 € a *11,00 €* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- titolare: aggiungi gnocchi al ragu in menu pranzo a 10
  - bot: «Ok, *10,00 €*. In quale sottomenu metto *Gnocchi al ragù*? Rispondi col numero o col nome. 1. *Piatti di prova* (Menu di prova) 2. *Primi* (Menu di prova) 3. *Completo* (Menu pranzo) 4. *Primi* (Menu pranzo)»
- atteso: create|gnocchi al ragu|10|primi, price|Pasta al pesto e lasagna|9, price|la parmigiana|13.5, price|pasta al pesto|10, price|pasta al ragù|9, price|pasta all'amatriciana|12, price|pasta alla norma|11, price|riso giallo|9 · ottenuto: price|Pasta al pesto e lasagna|9, price|la parmigiana|13.5, price|pasta al pesto|10, price|pasta al ragù|9, price|pasta all'amatriciana|12, price|pasta alla norma|11, price|riso giallo|9
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|gnocchi al ragu|10|primi
- **GRAVE** menu-nominato-ignorato: dopo il turno 13: «Gnocchi al ragù» non è nel Menu pranzo a 10

### mt-menu-nominato-cena [GRAVE]
- titolare: aggiungi gnocchi al ragù nel menu cena a 12
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Metto *Gnocchi al ragù* a *12,00 €* in *Primi* (Menu *di verifica · web QA*)? Rispondi *sì* oppure dimmi il sottomenu giusto.»
- atteso: create|gnocchi al ragu|12|primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|gnocchi al ragu|12|primi
- **GRAVE** menu-nominato-ignorato: dopo il turno 1: «Gnocchi al ragù» non è nel Menu cena a 12

