# Motore Haiku · set adv-sera · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T22:29:06.031Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **226/227 (99.6%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 4.2 (non attese 4.2) |
| Latenza chiamata Haiku p50 / p95 | 2945 / 5316 ms (321 chiamate) |
| Latenza turno p50 / p95 | 16 / 29 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 0.72 |
| Token medi per messaggio (in · out · cache read · cache write) | 131 · 350 · 7073 · 41 |
| Cache hit (cache_read > 0) | 320/321 (99.7%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.118274 $ · 0.000264 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 321 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 9.7 s |

Strati del campione: elimina-senza-si 2 · conferme-senza-sospeso 2 · vocali-asr 0 · prezzi-lettere 0 · preamboli 0 · correzioni-anzi 0 · multi-turno 0 · dialetto 0 · nomi-insidiosi 0 · altro 223

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| in-attesa-ok | 0 | 1 | 0 |

## Falliti (trascrizione)

### as-gruppo-12 [MEDIO]
- titolare: metti tutti i primi a 12
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Intendi i *Primi* del Menu di verifica o quelli del Menu del giorno? Non ancora pubblicato, da confermare con OK: 1. *la parmigiana*: prezzo da 15,00 € a *12,00 €* 2. *pasta al pesto*: prezzo da 11,00 € a *12,00 €* 3. *pasta carbonara*: prezzo da 10,00 € a *12,00 €* 4. *riso giallo*: prezzo da 8,00 € a *12,00»
- atteso: price|la parmigiana|12, price|pasta al pesto|12, price|pasta all'amatriciana|12, price|pasta alla norma|12, price|pasta carbonara|12, price|riso giallo|12 · ottenuto: nessuna modifica
- **MEDIO** in-attesa-ok: resta in attesa di OK: price|la parmigiana|12, price|pasta al pesto|12, price|pasta all'amatriciana|12, price|pasta alla norma|12, price|pasta carbonara|12, price|riso giallo|12

