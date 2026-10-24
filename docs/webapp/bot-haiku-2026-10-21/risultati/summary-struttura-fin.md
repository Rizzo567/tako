# Motore Haiku · set struttura · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T20:02:40.006Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **89/94 (94.7%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 5 — sicurezza 0, altri 5 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 2.4 (non attese 1.4) |
| Latenza chiamata Haiku p50 / p95 | 2397 / 4004 ms (124 chiamate) |
| Latenza turno p50 / p95 | 14 / 1353 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.04 |
| Token medi per messaggio (in · out · cache read · cache write) | 134 · 347 · 10083 · 95 |
| Cache hit (cache_read > 0) | 124/124 (100%) |
| Costo speso in questo giro | 0.002523 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.035632 $ · 0.000299 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 118 · 6 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 21.6 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| struttura-non-creata | 6 | 0 | 0 |
| visibilita-mancante | 1 | 0 | 0 |

## Falliti (trascrizione)

### str-m2 [GRAVE] — variante: il turno 1 basta da solo (Menu vuoti subito), il turno 2 aggiunge i sottomenu
- titolare: voglio che aggiungi un nuovo menù che si chiama pranzo e un nuovo menù che si chiama cena
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Come vuoi chiamarlo? Scrivimi il nome nuovo, per esempio «rinomina il menu pranzo in Pranzo veloce».»
- titolare: in pranzo metti completo come sottomenu, invece in cena metti completo, primo e secondo
  - bot: «Ho creato il Menu *Pranzo* con il sottomenu *Completo*. Per ora è nascosto: scrivi *rendi visibile Pranzo* quando vuoi che i clienti lo vedano. Ho creato il Menu *Cena* con i sottomenu *Completo*, *Primo*, *Secondo*. Per ora è nascosto: scrivi *rendi visibile Cena* quando vuoi che i clienti lo vedano.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** struttura-non-creata: dopo il turno 1: manca il Menu «Pranzo»
- **GRAVE** struttura-non-creata: dopo il turno 1: manca il Menu «Cena»

### str-m3 [GRAVE] — solo il turno 1: due Menu vuoti creati subito (una domanda di seguito sui sottomenu è ammessa)
- titolare: voglio che aggiungi un nuovo menù che si chiama pranzo e un nuovo menù che si chiama cena
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Come vuoi chiamarlo? Scrivimi il nome nuovo, per esempio «rinomina il menu pranzo in Pranzo veloce».»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** struttura-non-creata: dopo il turno 1: manca il Menu «Pranzo»
- **GRAVE** struttura-non-creata: dopo il turno 1: manca il Menu «Cena»

### str-a-menu-nuovo-02 [GRAVE]
- titolare: aggiungi un nuovo menù che si chiama Brunch
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Come vuoi chiamarlo? Scrivimi il nome nuovo, per esempio «rinomina il menu pranzo in Pranzo veloce».»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** struttura-non-creata: dopo il turno 1: manca il Menu «Brunch»

### str-a-menu-nuovo-05 [GRAVE]
- titolare: voglio un menù nuovo, chiamalo Asporto
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale Menu vuoi rinominare? Ci sono: Pranzo, Cena, Bevande.»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** struttura-non-creata: dopo il turno 1: manca il Menu «Asporto»

### str-v-08 [GRAVE]
- titolare: fai vedere i dolci della cena
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quali *Dolci* vuoi rendere visibili, quelli del *Pranzo* o della *Cena*?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **GRAVE** visibilita-mancante: dopo il turno 1: «Cena>Dolci» è ancora nascosto

