# Motore Haiku · set notte-1022 · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T21:35:14.146Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **53/57 (93%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 0, altri 1 |
| MEDI | 3 |
| Domande ogni 10 messaggi | 1.7 (non attese 1.5) |
| Latenza chiamata Haiku p50 / p95 | 1973 / 4413 ms (86 chiamate) |
| Latenza turno p50 / p95 | 2106 / 5220 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.06 |
| Token medi per messaggio (in · out · cache read · cache write) | 141 · 279 · 10199 · 225 |
| Cache hit (cache_read > 0) | 85/86 (98.8%) |
| Costo speso in questo giro | 0.02262 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.022986 $ · 0.000284 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 1 · 85 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 196.2 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| correzione-non-applicata | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 3 | 0 |

## Falliti (trascrizione)

### n-pronome-quello-prima [GRAVE]
- titolare: nascondi il supplì
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nascondo il *Supplì* dal menu. *Supplì*: *nascosto* dal menu»
- titolare: e la crocchetta pure
  - bot: «Nascondo la *Crocchetta* dal menu. *Crocchetta*: *nascosto* dal menu»
- titolare: anzi quello di prima rimettilo
  - bot: «Quale piatto vuoi rimettere nel menu, il *Supplì* o la *Crocchetta*? 1. *Supplì* (2,50 €) 2. *Crocchetta* (2,00 €)»
- atteso: hidden|Crocchetta|true · ottenuto: hidden|Crocchetta|true, hidden|Supplì|true
- **GRAVE** correzione-non-applicata: resta la modifica poi corretta/annullata: hidden|Supplì|true

### n-lungo-motivato [MEDIO]
- titolare: ciao allora volevo dirti che da domani la carbonara costa 13 euro perché il guanciale è aumentato, e già che ci sei anche l'amatriciana a 12
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Per «ciao allora volevo dirti che da domani la carbonara costa 13 euro perché il guanciale è au» a quale piatto ti riferisci? Rispondi col numero. 1. *Carbonara* (12,00 €) 2. *Amatriciana* (11,00 €)»
- atteso: price|Amatriciana|12, price|Carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Amatriciana|12, price|Carbonara|13

### n-dialetto [MEDIO]
- titolare: mett a carbonar a 13 e a gricia pur
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi *Carbonara* o *Carbonara di mare*? 1. *Carbonara* (12,00 €) 2. *Carbonara di mare* (15,00 €)»
- atteso: price|Carbonara|13, price|Gricia|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13, price|Gricia|13

### n-menu-cena-pizze-aumento [MEDIO]
- titolare: nel menu cena alza le pizze di 50 centesimi
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Per «nel menu cena alza le pizze di 50 centesimi» a quale piatto ti riferisci? Rispondi col numero. 1. *Marinara* (6,00 €) 2. *Napoli* (7,50 €)»
- atteso: price|Marinara|6.5, price|Napoli|8 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Marinara|6.5, price|Napoli|8

