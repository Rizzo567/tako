# Motore Haiku · set playground · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T01:06:14.271Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **19/20 (95%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 0 — sicurezza 0, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 3 (non attese 1) |
| Latenza chiamata Haiku p50 / p95 | 2415 / 4880 ms (23 chiamate) |
| Latenza turno p50 / p95 | 27 / 161 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.15 |
| Token medi per messaggio (in · out · cache read · cache write) | 128 · 400 · 8925 · 82 |
| Cache hit (cache_read > 0) | 23/23 (100%) |
| Costo speso in questo giro | 0 $ (tetto 0.2 $) |
| Costo equivalente dal vivo · per messaggio | 0.006243 $ · 0.000312 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 23 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 1.9 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| in-attesa-ok | 0 | 1 | 0 |

## Falliti (trascrizione)

### pg-04 [MEDIO]
- titolare: aggiungi nei primi cacio e pepe che costa 11
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiungo *Cacio e pepe* a 11 € tra i Primi di Pranzo. Confermi? Non ancora pubblicato, da confermare con OK: 1. Nuovo piatto *Cacio e pepe* in *Primi*: *11,00 €*»
- atteso: create|cacio e pepe|11|primi · ottenuto: nessuna modifica
- **MEDIO** in-attesa-ok: resta in attesa di OK: create|cacio e pepe|11|primi

