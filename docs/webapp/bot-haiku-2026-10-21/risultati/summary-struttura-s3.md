# Motore Haiku · set struttura · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T08:22:37.982Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **71/74 (95.9%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 3 — sicurezza 1, altri 2 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 1.8 (non attese 0.7) |
| Latenza chiamata Haiku p50 / p95 | 2021 / 5050 ms (99 chiamate) |
| Latenza turno p50 / p95 | 2042 / 4079 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.03 |
| Token medi per messaggio (in · out · cache read · cache write) | 126 · 325 · 8478 · 343 |
| Cache hit (cache_read > 0) | 96/99 (97%) |
| Costo speso in questo giro | 0.024922 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.029066 $ · 0.000303 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 10 · 89 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 213.1 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| struttura-non-creata | 2 | 0 | 0 |
| struttura-sbagliata (sicurezza) | 1 | 0 | 0 |

## Falliti (trascrizione)

### str-a-correzioni-02 [GRAVE]
- titolare: crea il menu Aperitivo con il sottomenu Spritz
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, creo il Menu *Aperitivo* con il Sottomenu *Spritz*. Nuovo Menu *Aperitivo* Nuovo Sottomenu *Spritz* nel Menu *Aperitivo* Menu e Sottomenu vuoti non si vedono ai clienti finché non ci metti dei piatti.»
- titolare: no, anche Cocktail
  - bot: «Ok, tolgo il Sottomenu *Spritz* e creo il Sottomenu *Cocktail* nel Menu *Aperitivo*. Tolto il Sottomenu vuoto *Spritz* dal Menu *Aperitivo* Nuovo Sottomenu *Cocktail* nel Menu *Aperitivo* Menu e Sottomenu vuoti non si vedono ai clienti finché non ci metti dei piatti.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** struttura-non-creata: dopo il turno 2: manca il sottomenu «Spritz» nel Menu «Aperitivo»

### str-a-correzioni-04 [GRAVE]
- titolare: in pranzo metti Contorni
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Creo il Sottomenu *Contorni* nel Menu Pranzo. Nuovo Sottomenu *Contorni* nel Menu *Pranzo* Menu e Sottomenu vuoti non si vedono ai clienti finché non ci metti dei piatti.»
- titolare: no, anche Insalate
  - bot: «Tolgo il Sottomenu *Contorni* dal Menu *Pranzo* e creo *Insalate* al suo posto. Tolto il Sottomenu vuoto *Contorni* dal Menu *Pranzo* Nuovo Sottomenu *Insalate* nel Menu *Pranzo* Menu e Sottomenu vuoti non si vedono ai clienti finché non ci metti dei piatti.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** struttura-non-creata: dopo il turno 2: manca il sottomenu «Contorni» nel Menu «Pranzo»

### str-a-correzioni-06 [GRAVE]
- titolare: crea il menu Pranzo con il sottomenu Completo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Creo il Menu *Pranzo* con il Sottomenu *Completo*. Nuovo Menu *Pranzo* Nuovo Sottomenu *Completo* nel Menu *Pranzo* Menu e Sottomenu vuoti non si vedono ai clienti finché non ci metti dei piatti.»
- titolare: no, anche completo nella cena, crea pure il menu Cena
  - bot: «Ok, creo il Menu *Cena* con il Sottomenu *Completo* e tolgo *Completo* dal Menu *Pranzo*. Nuovo Menu *Cena* Tolto il Sottomenu vuoto *Completo* dal Menu *Pranzo* Nuovo Sottomenu *Completo* nel Menu *Cena* Menu e Sottomenu vuoti non si vedono ai clienti finché non ci metti dei piatti.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** struttura-sbagliata: dopo il turno 2: sottomenu «Completo» creato nel Menu «Cena» invece di «Pranzo»

