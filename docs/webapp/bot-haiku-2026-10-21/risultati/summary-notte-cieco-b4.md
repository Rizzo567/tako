# Motore Haiku · set notte-cieco · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-22T00:44:48.744Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **72/72 (100%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 1.3 (non attese 0.9) |
| Latenza chiamata Haiku p50 / p95 | 1998 / 4295 ms (124 chiamate) |
| Latenza turno p50 / p95 | 19 / 51 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.04 |
| Token medi per messaggio (in · out · cache read · cache write) | 170 · 303 · 10036 · 234 |
| Cache hit (cache_read > 0) | 124/124 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.035476 $ · 0.000298 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 124 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 4.2 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| piu-domande | 0 | 0 | 2 |

## Falliti (trascrizione)

### cieco-osteria-04 [BASSO] — senza prezzo: lo chiede, mai inventato; sottomenu libero
- titolare: aggiungi il vitello tonnato
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. In quale Sottomenu lo metto e a che prezzo?»
- titolare: 14
  - bot: «Ok, *14,00 €*. In quale sottomenu metto *Vitello tonnato*? Rispondi col numero o col nome. 1. *Antipasti* (Pranzo) 2. *Primi* (Pranzo) 3. *Secondi* (Pranzo) 4. *Primi* (Cena) 5. *Secondi* (Cena) 6. *Pizze* (Cena)»
- atteso: create|vitello tonnato|14|* · ottenuto: nessuna modifica
- **BASSO** piu-domande: 2 domande

### cieco-bimbum-05 [BASSO] — (coordinatore 02:00: senza un sottomenu ovvio chiedere dove metterlo tenendo il prezzo è corretto) nessun sottomenu adat
- titolare: aggiungi patatine fritte a 4
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. In quale Sottomenu metto *Patatine fritte* a 4 €: Antipasti, Primi, Secondi o Dolci?»
- titolare: sì
  - bot: «Ok, *4,00 €*. In quale sottomenu metto *Patatine fritte*? Rispondi col numero o col nome. 1. *Antipasti* (Menu) 2. *Primi* (Menu) 3. *Secondi* (Menu) 4. *Dolci* (Menu)»
- atteso: create|patatine fritte|4|* · ottenuto: nessuna modifica
- **BASSO** piu-domande: 2 domande

