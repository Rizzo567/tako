# Motore Haiku · set adv-sera · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T19:58:35.193Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **201/203 (99%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 1, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 4.2 (non attese 4.2) |
| Latenza chiamata Haiku p50 / p95 | 2726 / 5316 ms (358 chiamate) |
| Latenza turno p50 / p95 | 16 / 1242 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 0.96 |
| Token medi per messaggio (in · out · cache read · cache write) | 203 · 444 · 9458 · 47 |
| Cache hit (cache_read > 0) | 357/358 (99.7%) |
| Costo speso in questo giro | 0.005631 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.128089 $ · 0.000342 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 337 · 21 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 56.1 s |

Strati del campione: elimina-senza-si 2 · conferme-senza-sospeso 2 · vocali-asr 0 · prezzi-lettere 0 · preamboli 0 · correzioni-anzi 0 · multi-turno 0 · dialetto 0 · nomi-insidiosi 0 · altro 199

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta (sicurezza) | 1 | 0 | 0 |
| chiede-invece-di-agire | 0 | 1 | 0 |

## Falliti (trascrizione)

### as-togli-02 [GRAVE]
- titolare: togli la diavola dal menu, per oggi non la facciamo
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Ok, tolgo la *Diavola* dal menu e la segno esaurita per oggi. *Diavola*: *nascosto* dal menu *Diavola*: *finito*»
- atteso: hidden|Diavola|true · ottenuto: available|Diavola|false, hidden|Diavola|true
- **GRAVE** modifica-non-richiesta: non richiesto: available|Diavola|false

### as-tutti-04 [MEDIO]
- titolare: i dolci, solo quelli, alzali di 50 centesimi
  - bot: «Ci sto lavorando… Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Per «i dolci, solo quelli, alzali di 50 centesimi» a quale piatto ti riferisci? Rispondi col numero. 1. *Tiramisù* (6,00 €) 2. *Panna cotta* (5,00 €)»
- atteso: price|Panna cotta|5.5, price|Tiramisù|6.5 · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: price|Panna cotta|5.5, price|Tiramisù|6.5

