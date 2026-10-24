# Motore Haiku · set adv-sera · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-22T00:08:58.231Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **219/227 (96.5%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 8 — sicurezza 8, altri 0 |
| MEDI | 0 |
| Domande ogni 10 messaggi | 4.3 (non attese 4.3) |
| Latenza chiamata Haiku p50 / p95 | 2945 / 5316 ms (320 chiamate) |
| Latenza turno p50 / p95 | 15 / 29 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 0.71 |
| Token medi per messaggio (in · out · cache read · cache write) | 130 · 350 · 7051 · 41 |
| Cache hit (cache_read > 0) | 319/320 (99.7%) |
| Costo speso in questo giro | 0 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.118043 $ · 0.000263 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 320 · 0 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 9.3 s |

Strati del campione: elimina-senza-si 2 · conferme-senza-sospeso 2 · vocali-asr 0 · prezzi-lettere 0 · preamboli 0 · correzioni-anzi 0 · multi-turno 0 · dialetto 0 · nomi-insidiosi 0 · altro 223

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| menu-nominato-ignorato (sicurezza) | 8 | 0 | 0 |
| chiede-invece-di-agire | 0 | 8 | 0 |

## Falliti (trascrizione)

### as-menu-01 [GRAVE]
- titolare: aggiungi gnocchi al ragù nel menu cena a 12
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Metto *Gnocchi al ragù* a *12,00 €* in *Primi* (Menu *di verifica · web QA*)? Rispondi *sì* oppure dimmi il sottomenu giusto.»
- atteso: create|gnocchi al ragu|12|primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|gnocchi al ragu|12|primi
- **GRAVE** menu-nominato-ignorato: dopo il turno 1: «Gnocchi al ragù» non è nel Menu cena

### as-menu-02 [GRAVE]
- titolare: 🎤 nel menu cena aggiungi la lasagna a 11
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Metto *Lasagna* a *11,00 €* in *Primi* (Menu *di verifica · web QA*)? Rispondi *sì* oppure dimmi il sottomenu giusto.»
- atteso: create|lasagna|11|primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|lasagna|11|primi
- **GRAVE** menu-nominato-ignorato: dopo il turno 1: «Lasagna» non è nel Menu cena

### as-menu-03 [GRAVE]
- titolare: aggiungi la carbonara nel menù cena a 13
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Metto *Carbonara* a *13,00 €* in *Primi* (Menu *di verifica · web QA*)? Rispondi *sì* oppure dimmi il sottomenu giusto.»
- atteso: create|carbonara|13|primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|carbonara|13|primi
- **GRAVE** menu-nominato-ignorato: dopo il turno 1: «Carbonara» non è nel Menu cena

### as-menu-04 [GRAVE]
- titolare: metti la lasagna nel menu cena a 10
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Metto *Lasagna* a *10,00 €* in *Primi* (Menu *di verifica · web QA*)? Rispondi *sì* oppure dimmi il sottomenu giusto.»
- atteso: create|lasagna|10|primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|lasagna|10|primi
- **GRAVE** menu-nominato-ignorato: dopo il turno 1: «Lasagna» non è nel Menu cena

### as-menu-09 [GRAVE]
- titolare: inserisci gnocchi al ragù nel menu cena al prezzo di 12 euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Metto *gnocchi al ragù* a *12,00 €* in *Primi* (Menu *di verifica · web QA*)? Rispondi *sì* oppure dimmi il sottomenu giusto.»
- atteso: create|gnocchi al ragu|12|primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|gnocchi al ragu|12|primi
- **GRAVE** menu-nominato-ignorato: dopo il turno 1: «Gnocchi al ragù» non è nel Menu cena

### as-menu-10 [GRAVE]
- titolare: nel menu cena aggiungi la lasagna al prezzo di 11 euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Metto *Lasagna* a *11,00 €* in *Primi* (Menu *di verifica · web QA*)? Rispondi *sì* oppure dimmi il sottomenu giusto.»
- atteso: create|lasagna|11|primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|lasagna|11|primi
- **GRAVE** menu-nominato-ignorato: dopo il turno 1: «Lasagna» non è nel Menu cena

### as-menu-11 [GRAVE]
- titolare: 🎤 inserisci la carbonara nel menù cena al prezzo di 13 euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Metto *Carbonara* a *13,00 €* in *Primi* (Menu *di verifica · web QA*)? Rispondi *sì* oppure dimmi il sottomenu giusto.»
- atteso: create|carbonara|13|primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|carbonara|13|primi
- **GRAVE** menu-nominato-ignorato: dopo il turno 1: «Carbonara» non è nel Menu cena

### as-menu-12 [GRAVE]
- titolare: metti la lasagna nel menu cena al prezzo di 10 euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Metto *Lasagna* a *10,00 €* in *Primi* (Menu *di verifica · web QA*)? Rispondi *sì* oppure dimmi il sottomenu giusto.»
- atteso: create|lasagna|10|primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|lasagna|10|primi
- **GRAVE** menu-nominato-ignorato: dopo il turno 1: «Lasagna» non è nel Menu cena

