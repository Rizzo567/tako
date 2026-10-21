# Motore Haiku · set notte-cieco · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T23:54:10.862Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **69/72 (95.8%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 3 |
| Domande ogni 10 messaggi | 1.4 (non attese 1) |
| Latenza chiamata Haiku p50 / p95 | 1971 / 4295 ms (125 chiamate) |
| Latenza turno p50 / p95 | 20 / 52 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.05 |
| Token medi per messaggio (in · out · cache read · cache write) | 173 · 305 · 10119 · 234 |
| Cache hit (cache_read > 0) | 125/125 (100%) |
| Costo speso in questo giro | 0.000254 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.0357 $ · 0.0003 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 124 · 1 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 6.3 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| chiede-invece-di-agire | 0 | 3 | 0 |

## Falliti (trascrizione)

### cieco-checco-10 [MEDIO] — il figlio ha già messo 13 dalla dashboard: si parte da 13
- titolare: [dashboard: Carbonara price=13]
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Per *Carbonara* (adesso 13,00 €) che prezzo metto? Scrivimelo in cifre, per esempio «carbonara 6,50».»
- titolare: 🎤 la carbonara alzala de cinquanta centesimi
  - bot: «»
- atteso: price|Carbonara|13.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Carbonara|13.5

### cieco-osteria-04 [MEDIO] — senza prezzo: lo chiede, mai inventato; sottomenu libero
- titolare: aggiungi il vitello tonnato
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. In quale Sottomenu lo metto e a che prezzo?»
- titolare: 14
  - bot: «Ok, *14,00 €*. In quale sottomenu metto *Vitello tonnato*? Rispondi col numero o col nome. 1. *Antipasti* (Pranzo) 2. *Primi* (Pranzo) 3. *Secondi* (Pranzo) 4. *Primi* (Cena) 5. *Secondi* (Cena) 6. *Pizze* (Cena)»
- atteso: create|vitello tonnato|14|* · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|vitello tonnato|14|*

### cieco-bimbum-05 [MEDIO] — nessun sottomenu adatto: può proporre Contorni (sì) o metterle dove ha senso
- titolare: aggiungi patatine fritte a 4
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. In quale Sottomenu metto *Patatine fritte* a 4 €: Antipasti, Primi, Secondi o Dolci?»
- titolare: sì
  - bot: «Ok, *4,00 €*. In quale sottomenu metto *Patatine fritte*? Rispondi col numero o col nome. 1. *Antipasti* (Menu) 2. *Primi* (Menu) 3. *Secondi* (Menu) 4. *Dolci* (Menu)»
- atteso: create|patatine fritte|4|* · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|patatine fritte|4|*

