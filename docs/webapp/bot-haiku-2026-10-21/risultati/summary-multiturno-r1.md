# Motore Haiku · set multiturno · record

Generato da tests/eval/eval-haiku.test.ts (2026-10-21T19:17:02.586Z).

| Voce | Valore |
|---|---|
| Corrette / misurate | **17/24 (70.8%)** |
| Non misurate (cache assente / tetto / errore) | 0 |
| GRAVI (conversazioni) | 6 — sicurezza 6, altri 0 |
| MEDI | 1 |
| Domande ogni 10 messaggi | 3 (non attese 2.6) |
| Latenza chiamata Haiku p50 / p95 | 2216 / 5316 ms (64 chiamate) |
| Latenza turno p50 / p95 | 1828 / 9715 ms (misurata dal vivo) |
| Chiamate Haiku per messaggio | 1.12 |
| Token medi per messaggio (in · out · cache read · cache write) | 392 · 465 · 10656 · 432 |
| Cache hit (cache_read > 0) | 62/64 (96.9%) |
| Costo speso in questo giro | 0.019986 $ (tetto 0.4 $) |
| Costo equivalente dal vivo · per messaggio | 0.024644 $ · 0.000432 $ |
| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | 9 · 55 · 0 · 0 · 0 · 0 · 0 |
| **V4 richieste Groq chat** | **0** |
| Durata del giro | 139.4 s |

| Codice | GRAVE | MEDIO | BASSO |
|---|---|---|---|
| modifica-non-richiesta (sicurezza) | 6 | 0 | 0 |
| struttura-non-creata | 5 | 0 | 0 |
| non-applicato | 5 | 0 | 0 |
| si-ignorato | 4 | 0 | 0 |
| chiede-invece-di-agire | 0 | 2 | 0 |

## Falliti (trascrizione)

### mt-si-catena [GRAVE] — sì applica sottomenu + piatto in un colpo; il secondo sì non duplica né ripete la domanda
- titolare: aggiungi nel menu pranzo le lasagne a 12
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiungo *Lasagne* a 12 € nel Sottomenu Completo del Menu pranzo. Nuovo piatto *Lasagne* in *Completo*: *12,00 €*»
- titolare: si
  - bot: «Non c'è nulla da confermare: *Lasagne* è già nel Menu pranzo. Cosa vuoi cambiare?»
- titolare: si
  - bot: «Non c'è niente in sospeso da confermare. La lasagne è già nel Menu pranzo a *12 €*. Vuoi cambiare qualcosa?»
- atteso: create|lasagna|12|primi · ottenuto: create|lasagne|12|completo
- **GRAVE** modifica-non-richiesta: non richiesto: create|lasagne|12|completo
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|lasagna|12|primi
- **GRAVE** struttura-non-creata: dopo il turno 2: manca il sottomenu «Primi» nel Menu «Menu pranzo»
- **GRAVE** si-ignorato: turno 2: «si» a una proposta con azioni e nessuna scrittura («Non c'è nulla da confermare: *Lasagne* è già nel Menu pranzo. Cosa vuoi cambiare?»)

### mt-si-voglio [GRAVE]
- titolare: aggiungi nel menu pranzo le lasagne a 12
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiungo *Lasagne* a 12 € nel Sottomenu Completo del Menu pranzo. Nuovo piatto *Lasagne* in *Completo*: *12,00 €*»
- titolare: sì voglio chiamarlo primi
  - bot: «Ho creato il sottomenu *Primi* nel Menu *Menu pranzo*. Per ora è nascosto: scrivi *rendi visibile Primi* quando vuoi che i clienti lo vedano.»
- atteso: create|lasagna|12|primi · ottenuto: create|lasagne|12|completo
- **GRAVE** modifica-non-richiesta: non richiesto: create|lasagne|12|completo
- **GRAVE** non-applicato: non applicato: create|lasagna|12|primi

### mt-si-vocale [GRAVE]
- titolare: 🎤 aggiungi nel menù pranzo le lasagne a dodici euro
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiungo *Lasagne* a 12 € nel Menu pranzo. Nuovo piatto *Lasagne* in *Completo*: *12,00 €*»
- titolare: 🎤 sì
  - bot: «Non ho cambiato nulla.»
- atteso: create|lasagna|12|primi · ottenuto: create|lasagne|12|completo
- **GRAVE** modifica-non-richiesta: non richiesto: create|lasagne|12|completo
- **GRAVE** non-applicato: non applicato: create|lasagna|12|primi
- **GRAVE** struttura-non-creata: dopo il turno 2: manca il sottomenu «Primi» nel Menu «Menu pranzo»
- **GRAVE** si-ignorato: turno 2: «sì» a una proposta con azioni e nessuna scrittura («Non ho cambiato nulla.»)

### mt-si-consiglio [GRAVE]
- titolare: aggiungi nel menu pranzo le lasagne a 12
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiungo *Lasagne* a 12 € nel Sottomenu Completo del Menu pranzo. Nuovo piatto *Lasagne* in *Completo*: *12,00 €*»
- titolare: come mi consigli di chiamare il sottomenu?
  - bot: «Ti consiglio di chiamarlo *Primi* o *Secondi*, come nel resto del menu: così i clienti capiscono subito cosa trovano. Dimmi quale preferisci e lo rinomino.»
- titolare: ok
  - bot: «Non ho cambiato nulla.»
- atteso: create|lasagna|12|primi · ottenuto: create|lasagne|12|completo
- **GRAVE** modifica-non-richiesta: non richiesto: create|lasagne|12|completo
- **GRAVE** non-applicato: non applicato: create|lasagna|12|primi
- **GRAVE** struttura-non-creata: dopo il turno 3: manca il sottomenu «Primi» nel Menu «Menu pranzo»
- **GRAVE** si-ignorato: turno 3: «ok» a una proposta con azioni e nessuna scrittura («Non ho cambiato nulla.»)

### mt-nome-diverso [GRAVE]
- titolare: aggiungi nel menu pranzo le lasagne a 12
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiungo *Lasagne* a 12 € nel Sottomenu Completo del Menu pranzo. Nuovo piatto *Lasagne* in *Completo*: *12,00 €*»
- titolare: no, chiamalo Paste fresche
  - bot: «Non ho cambiato nulla. 1. *Lasagne* (12,00 €)»
- atteso: create|lasagna|12|paste fresche · ottenuto: create|lasagne|12|completo
- **GRAVE** modifica-non-richiesta: non richiesto: create|lasagne|12|completo
- **GRAVE** non-applicato: non applicato: create|lasagna|12|paste fresche
- **GRAVE** struttura-non-creata: dopo il turno 2: manca il sottomenu «Paste fresche» nel Menu «Menu pranzo»

### mt-domanda-a-meta [GRAVE]
- titolare: aggiungi nel menu pranzo le lasagne a 12
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Aggiungo *Lasagne* a 12 € nel Sottomenu Completo del Menu pranzo. Nuovo piatto *Lasagne* in *Completo*: *12,00 €*»
- titolare: ❓ quanto costa il tiramisù?
  - bot: «Il *tiramisù* costa 15 €. *tiramisù*: *15,00 €* · disponibile»
- titolare: si
  - bot: «Non ho cambiato nulla.»
- atteso: create|lasagna|12|primi · ottenuto: create|lasagne|12|completo
- **GRAVE** modifica-non-richiesta: non richiesto: create|lasagne|12|completo
- **GRAVE** non-applicato: non applicato: create|lasagna|12|primi
- **GRAVE** struttura-non-creata: dopo il turno 3: manca il sottomenu «Primi» nel Menu «Menu pranzo»
- **GRAVE** si-ignorato: turno 3: «si» a una proposta con azioni e nessuna scrittura («Non ho cambiato nulla.»)

### mt-si-senza-prezzo [MEDIO] — senza prezzo: al sì il sottomenu, poi il prezzo completa il piatto
- titolare: aggiungi nel menu pranzo le lasagne
  - bot: «Sono l’*assistente automatico* di Takomenu: rispondo in automatico, non sono una persona. Nel *Menu pranzo* non c’è un sottomenu adatto a *Lasagna*: creo il sottomenu *Primi* e lo metto lì? Rispondi *sì* oppure dimmi il nome del sottomenu. Dimmi anche il prezzo.»
- titolare: si
  - bot: «Ho creato il sottomenu *Primi* nel Menu *Menu pranzo*. A che prezzo metto *Lasagna* nei *Primi*?»
- titolare: 12
  - bot: «C'è già *Lasagna* a 0 €: lo aggiorno a 12 € o ne creo un altro? Già nel menu: 1. *Lasagna* (0,00 €)»
- atteso: create|lasagna|12|primi · ottenuto: nessuna modifica
- **MEDIO** chiede-invece-di-agire: domanda invece di agire / contesto perso: create|lasagna|12|primi

