# Motore Haiku · set notte-1022 · mock

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T21:31:52.075Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **18/57 (31.6%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 11 — sicurezza 3, altri 8 |
| MEDI | 28 |
| Domande ogni 10 messaggi | 8.8 (non attese 8.5) |
| Latenza chiamata Haiku p50 / p95 | 0 / 0 ms (108 chiamate) |
| Latenza turno p50 / p95 | 16 / 27 ms (harness + latenza Haiku registrata) |
| Chiamate Haiku per messaggio | 1.33 |
| Token medi per messaggio (in · out · cache read · cache write) | 158 · 160 · 5708 · 0 |
| Cache hit (cache_read > 0) | 108/108 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.5 $) |
| Costo equivalente dal vivo · per messaggio | 0.012381 $ · 0.000153 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 0 · 0 · 108 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 2.9 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| formula-non-applicata | 4 | 0 | 0 |
| non-applicato | 3 | 0 | 0 |
| menu-nominato-ignorato (sicurezza) | 3 | 0 | 0 |
| comando-perso | 2 | 0 | 0 |
| chiede-invece-di-agire | 0 | 32 | 0 |

## Falliti (trascrizione)

### n-pronome-anche [GRAVE]
- titolare: la marinara a 6,50
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: stesso prezzo anche alla napoli
  - bot: «Non ho cambiato nulla.»
- atteso: price|Marinara|6.5, price|Napoli|6.5 · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: price|Marinara|6.5, price|Napoli|6.5
- **GRAVE** comando-perso: turno 2: «stesso prezzo anche alla napoli» né eseguito né una domanda («Non ho cambiato nulla.»)

### n-pronome-quello-prima [GRAVE]
- titolare: nascondi il supplì
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: e la crocchetta pure
  - bot: «Non ho cambiato nulla.»
- titolare: anzi quello di prima rimettilo
  - bot: «Quale piatto intendi?»
- atteso: hidden|Crocchetta|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Crocchetta|true
- **GRAVE** comando-perso: turno 2: «e la crocchetta pure» né eseguito né una domanda («Non ho cambiato nulla.»)

### n-grazie-dopo [GRAVE]
- titolare: birra media a 5,50
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: grazie mille
  - bot: «Non ho cambiato nulla.»
- atteso: price|Birra media|5.5 · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: price|Birra media|5.5

### n-omonimo-cena [GRAVE]
- titolare: aggiungi la bufalina a 9 nelle pizze della cena
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: create|bufalina|9|pizze · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|bufalina|9|pizze
- **GRAVE** menu-nominato-ignorato: dopo il turno 1: «Bufalina» non è nel Cena > Pizze a 9

### n-omonimo-menu [GRAVE]
- titolare: aggiungi la quattro stagioni a 9 nel menu pizze
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: create|quattro stagioni|9|pizze · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|quattro stagioni|9|pizze
- **GRAVE** menu-nominato-ignorato: dopo il turno 1: «Quattro stagioni» non è nel Pizze > Pizze a 9

### n-nuovo-parole [GRAVE]
- titolare: aggiungi nei secondi del pranzo la salsiccia e friarielli a tredici euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: create|salsiccia e friarielli|13|secondi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|salsiccia e friarielli|13|secondi
- **GRAVE** menu-nominato-ignorato: dopo il turno 1: «Salsiccia e friarielli» non è nel Pranzo > Secondi a 13

### n-nuovo-senza-prezzo [GRAVE]
- titolare: aggiungi il cacio e pepe nei primi del pranzo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: 11
  - bot: «Non ho cambiato nulla.»
- atteso: create|cacio e pepe|11|primi · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: create|cacio e pepe|11|primi

### n-pf-notte-01 [GRAVE]
- titolare: il completo del pranzo portalo a tredici e cinquanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** formula-non-applicata: turno 1: «Menu pranzo» resta fisso · complet=12, atteso fisso · complet=13.5

### n-pf-notte-03 [GRAVE]
- titolare: solo primo della cena a nove e mezzo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** formula-non-applicata: turno 1: «Menu cena» resta fisso · complet=16.9 · sol prim=9 · sol second=10, atteso fisso · complet=16.9 · sol prim=9.5 · sol second=10

### n-pf-notte-04 [GRAVE]
- titolare: alza il completo della cena a 17
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: annulla
  - bot: «Non ho cambiato nulla.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** formula-non-applicata: turno 1: «Menu cena» resta fisso · complet=16.9 · sol prim=9 · sol second=10, atteso fisso · complet=17 · sol prim=9 · sol second=10

### n-pf-notte-06 [GRAVE]
- titolare: 🎤 il completo della cena a diciassette e cinquanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** formula-non-applicata: turno 1: «Menu cena» resta fisso · complet=16.9 · sol prim=9 · sol second=10, atteso fisso · complet=17.5 · sol prim=9 · sol second=10

### n-prezzo-parole [MEDIO]
- titolare: la carbonara mettila a dodici e cinquanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Carbonara|12.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|12.5

### n-prezzo-punto [MEDIO]
- titolare: amatriciana 12.5
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Amatriciana|12.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Amatriciana|12.5

### n-prezzo-mezzo [MEDIO]
- titolare: la gricia a 12 euro e mezzo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Gricia|12.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Gricia|12.5

### n-prezzo-euro [MEDIO]
- titolare: tagliata 19,50€
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Tagliata|19.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tagliata|19.5

### n-prezzo-a-e [MEDIO]
- titolare: 🎤 la diavola a 9 e 50
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Diavola|9.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Diavola|9.5

### n-prezzo-centesimi [MEDIO]
- titolare: abbassa la birra media di cinquanta centesimi
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Birra media|4.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Birra media|4.5

### n-prezzo-due-voce [MEDIO]
- titolare: 🎤 l'acqua a due e cinquanta e la coca a tre e ottanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Acqua|2.5, price|Coca Cola|3.8 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Acqua|2.5, price|Coca Cola|3.8

### n-simile-pistacchio [MEDIO]
- titolare: il tiramisù al pistacchio a 8
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Tiramisù al pistacchio|8 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tiramisù al pistacchio|8

### n-simile-mare-voce [MEDIO]
- titolare: 🎤 metti la carbonera di mare a sedici
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Carbonara di mare|16 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara di mare|16

### n-pronome-prima [MEDIO]
- titolare: ❓ quanto costa la carbonara di mare?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: mettila a 16
  - bot: «Per «mettila a 16» mi manca un dettaglio: qual è il nome esatto del piatto (o del sottomenu) e cosa devo cambiare? Per esempio «la carbonara a 12».»
- atteso: price|Carbonara di mare|16 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara di mare|16

### n-domanda-poi-comando [MEDIO]
- titolare: ❓ quanto sta la birra?
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: mettila a 5,50
  - bot: «Per «mettila a 5,50» mi manca un dettaglio: qual è il nome esatto del piatto (o del sottomenu) e cosa devo cambiare? Per esempio «la carbonara a 12».»
- atteso: price|Birra media|5.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Birra media|5.5

### n-multi-tre [MEDIO]
- titolare: alza la carbonara a 13, nascondi la gricia e la coca a 4
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: hidden|Gricia|true, price|Carbonara|13, price|Coca Cola|4 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Gricia|true, price|Carbonara|13, price|Coca Cola|4

### n-ripensa-stesso [MEDIO]
- titolare: la tagliata a 20... no anzi 19
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Tagliata|19 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Tagliata|19

### n-ripensa-turni [MEDIO]
- titolare: supplì a 3
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: no scusa, a 2,80
  - bot: «Per «no scusa, a 2,80» mi manca un dettaglio: qual è il nome esatto del piatto (o del sottomenu) e cosa devo cambiare? Per esempio «la carbonara a 12».»
- atteso: price|Supplì|2.8 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Supplì|2.8

### n-lungo-motivato [MEDIO]
- titolare: ciao allora volevo dirti che da domani la carbonara costa 13 euro perché il guanciale è aumentato, e già che ci sei anche l'amatriciana a 12
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Amatriciana|12, price|Carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Amatriciana|12, price|Carbonara|13

### n-dialetto [MEDIO]
- titolare: mett a carbonar a 13 e a gricia pur
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Carbonara|13, price|Gricia|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13, price|Gricia|13

### n-refusi [MEDIO] — «cotolleta» può valere una domanda tra le due cotolette
- titolare: amatriciàna a 11,50 e la cotolleta a 15
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Amatriciana|11.5, price|Cotoletta|15 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Amatriciana|11.5, price|Cotoletta|15

### n-voce-nascondi [MEDIO]
- titolare: 🎤 la gritcia la nascondi
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: hidden|Gricia|true · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Gricia|true

### n-esaurito [MEDIO]
- titolare: la tagliata è finita per oggi
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: available|Tagliata|false · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: available|Tagliata|false

### n-rinomina [MEDIO]
- titolare: la cotoletta chiamala cotoletta alla milanese
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: rename|Cotoletta|Cotoletta alla milanese · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: rename|Cotoletta|Cotoletta alla milanese

### n-annulla-poi-comando [MEDIO]
- titolare: nel menu cena alza le pizze di 1 euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: annulla
  - bot: «Non ho cambiato nulla.»
- titolare: alza solo la napoli di 1 euro
  - bot: «Quale piatto intendi?»
- atteso: price|Napoli|8.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Napoli|8.5

### n-annulla-a-meta-sessione [MEDIO]
- titolare: carbonara a 13
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: amatriciana a 12
  - bot: «Per «amatriciana a 12» mi manca un dettaglio: qual è il nome esatto del piatto (o del sottomenu) e cosa devo cambiare? Per esempio «la carbonara a 12».»
- titolare: annulla l'ultima
  - bot: «Quale piatto intendi?»
- atteso: price|Carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13

### n-menu-cena-pizze-aumento [MEDIO]
- titolare: nel menu cena alza le pizze di 50 centesimi
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|Marinara|6.5, price|Napoli|8 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Marinara|6.5, price|Napoli|8

### n-nuovo-cambio-argomento [MEDIO]
- titolare: aggiungi il cacio e pepe nei primi del pranzo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: ah la coca mettila a 4
  - bot: «Per «ah la coca mettila a 4» mi manca un dettaglio: qual è il nome esatto del piatto (o del sottomenu) e cosa devo cambiare? Per esempio «la carbonara a 12».»
- atteso: price|Coca Cola|4 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Coca Cola|4

### n-sessione-lunga [MEDIO]
- titolare: allora oggi facciamo così
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- titolare: carbonara a 13
  - bot: «Per «carbonara a 13» mi manca un dettaglio: qual è il nome esatto del piatto (o del sottomenu) e cosa devo cambiare? Per esempio «la carbonara a 12».»
- titolare: amatriciana pure
  - bot: «Quale piatto intendi?»
- titolare: e la gricia la togli
  - bot: «Per «e la gricia la togli» mi manca un dettaglio: qual è il nome esatto del piatto (o del sottomenu) e cosa devo cambiare? Per esempio «la carbonara a 12».»
- titolare: ❓ fatto?
  - bot: «Quale piatto intendi?»
- atteso: hidden|Gricia|true, price|Amatriciana|13, price|Carbonara|13 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: hidden|Gricia|true, price|Amatriciana|13, price|Carbonara|13

### n-parmigiana-simile [MEDIO]
- titolare: la parmigiana a 14
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|la parmigiana|14 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|la parmigiana|14

### n-lasagne-parole [MEDIO]
- titolare: aggiungi nel menu pranzo le lasagne a dodici e cinquanta
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Lasagna*: creo il sottomenu *Primi* e la metto lì? Rispondi *sì* oppure dimmi il nome del sottomenu. Dimmi anche il prezzo.»
- titolare: si
  - bot: «Ho creato il sottomenu *Primi* nel Menu *Menu pranzo*. A che prezzo metto *Lasagna* nei *Primi*?»
- atteso: create|lasagna|12.5|primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|lasagna|12.5|primi

### n-tiramisu-voce [MEDIO]
- titolare: 🎤 il tiramisu mettilo a dodici euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto intendi?»
- atteso: price|tiramisù|12 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|tiramisù|12

