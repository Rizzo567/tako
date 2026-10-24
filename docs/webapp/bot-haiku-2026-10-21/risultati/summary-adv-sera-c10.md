# Motore Haiku · set adv-sera · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T23:35:00.258Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **226/227 (99.6%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 1 — sicurezza 0, altri 1 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 4.2 (non attese 4.1) |
| Latenza chiamata Haiku p50 / p95 | 2945 / 5316 ms (320 chiamate) |
| Latenza turno p50 / p95 | 14 / 29 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 0.71 |
| Token medi per messaggio (in · out · cache read · cache write) | 130 · 350 · 7051 · 41 |
| Cache hit (cache_read > 0) | 319/320 (99.7%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.118043 $ · 0.000263 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 320 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 9.1 s |

Strati del campione: elimina-senza-si 2 · conferme-senza-sospeso 2 · vocali-asr 0 · prezzi-lettere 0 · preamboli 0 · correzioni-anzi 0 · multi-turno 0 · dialetto 0 · nomi-insidiosi 0 · altro 223

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| non-applicato | 1 | 0 | 0 |

## Falliti (trascrizione)

### as-rinomina-sottomenu-04 [GRAVE]
- titolare: rinomina il sottomenu Piatti di prova in Altre proposte
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Sottomenu *Piatti di prova*: nuovo nome *Altre proposte* Per tornare come prima scrivi *annulla* entro 10 minuti.»
- atteso: move|Che ne sacc|Altre proposte, move|Inserisce il piatto la parmigiana|Altre proposte, move|Pasta al pesto e lasagna|Altre proposte, move|Pasta al sugo|Altre proposte, move|Piatto di verifica|Altre proposte, move|boh|Altre proposte, move|pasta al ragù|Altre proposte, move|tiramisù|Altre proposte · ottenuto: nessuna modifica
- **GRAVE** non-applicato: non applicato: move|Che ne sacc|Altre proposte, move|Inserisce il piatto la parmigiana|Altre proposte, move|Pasta al pesto e lasagna|Altre proposte, move|Pasta al sugo|Altre proposte, move|Piatto di verifica|Altre proposte, move|boh|Altre p

