# Motore Haiku · set struttura · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T08:14:52.698Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **70/74 (94.6%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 4 — sicurezza 2, altri 2 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 2.3 (non attese 1.3) |
| Latenza chiamata Haiku p50 / p95 | 1949 / 3901 ms (102 chiamate) |
| Latenza turno p50 / p95 | 1924 / 4212 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.06 |
| Token medi per messaggio (in · out · cache read · cache write) | 143 · 314 · 8780 · 89 |
| Cache hit (cache_read > 0) | 102/102 (100%) |
| Costo speso in questo giro | 0.023592 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.025914 $ · 0.00027 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 10 · 92 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 208.6 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| struttura-non-creata | 2 | 0 | 0 |
| struttura-non-richiesta (sicurezza) | 2 | 0 | 0 |

## Falliti (trascrizione)

### str-a-sezione-03 [GRAVE]
- titolare: nel sottomenu Vini metti una sezione Rossi
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Una Sezione dentro un Sottomenu oggi non si crea da chat: falla dal pannello del menu digitale.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** struttura-non-creata: dopo il turno 1: manca la Sezione «Rossi» dentro «Vini» (Menu «Bevande»)

### str-a-sezione-04 [GRAVE]
- titolare: nei Secondi della cena crea la sezione Pesce
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Una Sezione dentro un Sottomenu oggi non si crea da chat: la puoi aggiungere dal pannello del menu digitale.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** struttura-non-creata: dopo il turno 1: manca la Sezione «Pesce» dentro «Secondi» (Menu «Cena»)

### str-a-correzioni-01 [GRAVE]
- titolare: in pranzo aggiungi il sottomenu Dolci
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ho aggiunto il Sottomenu *Dolci* al Menu Pranzo. Nuovo Sottomenu *Dolci* nel Menu *Pranzo* Menu e Sottomenu vuoti non si vedono ai clienti finché non ci metti dei piatti.»
- titolare: no, in cena non in pranzo
  - bot: «Ok, aggiungo il Sottomenu *Dolci* al Menu *Cena*. Il Sottomenu *Dolci* del Menu *Pranzo* resta com'è. Nuovo Sottomenu *Dolci* nel Menu *Cena* Menu e Sottomenu vuoti non si vedono ai clienti finché non ci metti dei piatti.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** struttura-non-richiesta: dopo il turno 2: sottomenu «Dolci» nel Menu «Pranzo» non richiesto

### str-a-correzioni-03 [GRAVE]
- titolare: crea il menu Brunch
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Creo il Menu *Brunch*. Nuovo Menu *Brunch* Menu e Sottomenu vuoti non si vedono ai clienti finché non ci metti dei piatti.»
- titolare: no, chiamalo Colazione
  - bot: «Ok, creo il Menu *Colazione*. Il Menu *Brunch* resta com'è. Nuovo Menu *Colazione* Menu e Sottomenu vuoti non si vedono ai clienti finché non ci metti dei piatti.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** struttura-non-richiesta: dopo il turno 2: Menu «Brunch» non richiesto

