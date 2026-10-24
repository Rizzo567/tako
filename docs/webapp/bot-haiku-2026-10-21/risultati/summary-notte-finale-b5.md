# Motore Haiku · set notte-finale · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-22T03:34:05.407Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **68/73 (93.2%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 2 — sicurezza 1, altri 1 |
| MEDI | 3 |
| Domande ogni 10 messaggi | 2.6 (non attese 1.9) |
| Latenza chiamata Haiku p50 / p95 | 2140 / 4171 ms (111 chiamate) |
| Latenza turno p50 / p95 | 2134 / 5508 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.01 |
| Token medi per messaggio (in · out · cache read · cache write) | 151 · 248 · 9650 · 260 |
| Cache hit (cache_read > 0) | 110/111 (99.1%) |
| Costo speso in questo giro | 0.027583 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.02949 $ · 0.000268 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 4 · 107 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 257.7 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| struttura-non-creata | 1 | 0 | 0 |
| menu-nominato-ignorato (sicurezza) | 1 | 0 | 0 |
| si-ignorato | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 3 | 0 |
| risposta-senza-contenuto | 0 | 2 | 0 |

## Falliti (trascrizione)

### fin-nuovo-proposta-dolci [GRAVE] — nel Pranzo non ci sono Dolci: propone il sottomenu, «ok» lo crea col piatto
- titolare: a pranzo aggiungi la panna cotta a 5
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, *5,00 €*. In quale sottomenu metto *Panna cotta*?»
- titolare: ok
  - bot: «Ok, *5,00 €*. In quale sottomenu metto *Panna cotta*? Rispondi col numero o col nome. 1. *Antipasti* (Pranzo) 2. *Primi* (Pranzo) 3. *Secondi* (Pranzo) 4. *Primi* (Cena) 5. *Secondi* (Cena) 6. *Pizze* (Cena)»
- atteso: create|panna cotta|5|dolci · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|panna cotta|5|dolci
- **GRAVE** struttura-non-creata: dopo il turno 2: manca il sottomenu «Dolci» nel Menu «Pranzo»
- **GRAVE** menu-nominato-ignorato: dopo il turno 2: «Panna cotta» non è nel Pranzo a 5

### fin-elimina-pollice [GRAVE] — il pollice su vale sì
- titolare: elimina il toast
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Elimino *Toast* dal menu? Rispondi *sì*. Da eliminare, serve il tuo sì: 1. *Toast*: da eliminare»
- titolare: 👍
  - bot: «Per eliminare mi serve un *sì* scritto: rispondi *sì* per confermare oppure *annulla*.»
- atteso: delete|Toast · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: delete|Toast
- **GRAVE** si-ignorato: turno 2: «👍» a una proposta con azioni e nessuna scrittura («Per eliminare mi serve un *sì* scritto: rispondi *sì* per confermare oppure *annulla*.»)

### fin-cosa-sai-fare [MEDIO]
- titolare: ❓ buonasera, cosa sai fare?
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Cosa vuoi cambiare? Scrivimi il piatto e la modifica, per esempio «la carbonara a 12».»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** risposta-senza-contenuto: turno 1: manca /prezz/i («Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non »)

### fin-posso-prezzi [MEDIO]
- titolare: ❓ posso cambiare i prezzi da qui?
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Quale piatto vuoi cambiare e a quale prezzo?»
- atteso: nessuna modifica · ottenuto: nessuna modifica
- **MEDIO** risposta-senza-contenuto: turno 1: manca /\bs[iì]\b|puoi|certo|basta/i («Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non »)

### fin-nuovo-senza-sottomenu [MEDIO] — il sottomenu ovvio (Aperitivi) senza domande
- titolare: aggiungi lo Spritz Hugo a 6,50
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, *6,50 €*. In quale sottomenu metto *Spritz Hugo*? Rispondi col numero o col nome. 1. *Caffetteria* (Bar) 2. *Aperitivi* (Bar) 3. *Panini* (Bar) 4. *Bibite* (Bar)»
- atteso: create|spritz hugo|6.5|* · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|spritz hugo|6.5|*

