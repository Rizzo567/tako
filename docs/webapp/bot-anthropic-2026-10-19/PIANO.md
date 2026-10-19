# Bot titolare Takomenu · motore Anthropic a strumenti · PIANO (17/10/2026)

Decisione: decisioni/2026-10-17-takomenu-doppio-motore-anthropic-groq.md. Motore **Haiku 5.5** (`claude-haiku-5-5`), **Sonnet 5.5** sui messaggi che Haiku dichiara incerti, **Groq gpt-oss + validatore** (fase R, in costruzione) come riserva se Anthropic non risponde. GPT-6 Luna scartato.
Repo: /Users/manuel/Projects/Tako (il lavoro parte da main dopo il merge della fase R). Worktree dedicato `Tako-bot-anthropic`, branch `codex/bot-anthropic-1018`.

**Regola di avanzamento:** spunta `[x]` solo a misura verde, con nota; deviazioni in `implementation-notes.md`; deviazione di architettura/scope → stop e report a Manuel.

## Risultato atteso
Il ristoratore scrive o parla come a un cameriere di fiducia; il menu cambia come intendeva; il bot chiede solo quando serve e impara dal primo giorno come scrive quel locale; nessuna pubblicazione sbagliata; ≈ 0,30 €/locale/mese.

## Decisioni ritoccabili (in testa)
1. **Ciclo a strumenti**, non piano JSON unico. Il modello chiama strumenti e vede i risultati prima di decidere: `cerca_piatti(testo)`, `leggi_menu(filtri)`, `cambia_prezzo`, `nascondi/mostra`, `finito/disponibile`, `crea_piatto`, `elimina_piatto` (richiede conferma al turno dopo), `crea_categoria`, `rinomina_piatto/categoria`, `sposta_piatto`, `descrizione`, `promo`, `evidenza`, `piatto_del_giorno`, `annulla_ultima`, `chiedi(domanda)`, `rispondi(testo)`. Max 6 passi per messaggio.
2. **Vincolo duro unico, condiviso con Groq**: nessuna scrittura senza prezzo/nome presente nel testo dell'utente o in un risultato di strumento; cancellazioni solo dopo «sì»; «annulla» solo l'ultima pubblicazione, mai il piatto del giorno. Il validatore dei fatti è lo stesso modulo della fase R (riuso), ma senza interpretazione del linguaggio.
3. **Contesto per chiamata** (ordine fisso per la cache): system = regole del titolare + glossario (~1,5k) → scheda locale: menu compatto + **nota del locale** (≤500 token) → cronologia della **giornata di servizio** (dalle 06:00, compressa oltre i 20 scambi) → operazioni in sospeso → messaggio. Target ≤ 5k token tipico.
4. **Nota del locale**: testo libero riscritto dal modello (Haiku) a fine conversazione (dopo 10 min di silenzio) con una chiamata separata: «cosa ho imparato su come scrive questo titolare?». Solo significati, mai messaggi interi; visibile e modificabile dalla dashboard; «dimentica X» la aggiorna. Niente stati candidato/attivo.
5. **Escalation a Sonnet**: Haiku può chiamare `passa_al_modello_forte(motivo)`; anche automatica se il validatore respinge due volte. Target ≤ 15% dei messaggi.
6. **Vocali**: Whisper (Groq) con `prompt` = nomi del locale; al modello si passa il testo con l'avviso «trascrizione, può contenere errori di ascolto» e, se disponibili, le alternative; la riconciliazione fonetica la fa il modello col menu davanti (`cerca_piatti` è tollerante).
7. **Risposte**: scritte dal modello, brevi; il server appende solo i fatti riletti dal DB. Testi fissi ammessi: riga «assistente automatico» al primo messaggio; «non disponibile, riprova tra un minuto» se anche la riserva Groq è giù.
8. **Instradamento**: `settings.botEngine` per locale = `anthropic | groq`; default `anthropic` quando il gate passa; errore/timeout Anthropic (>6 s) → stesso messaggio alla riserva Groq (fase R) con lo stesso vincolo duro.
9. **Costo**: cache Anthropic (1 h) sul prefisso system+scheda; `max_tokens` bassi; monitoraggio token per locale nella dashboard chiavi.

## Goal / verifier / stop
- **Banco vero (criterio principale)**: ≥ 60 conversazioni reali di Manuel (le 32 vocali del 17/10 + nuove) + i casi dei primi locali; esecuzione col **modello vero**; metrica = menu finale corretto. Obiettivo ≥ 90% complessivo, ≥ 97% sui comandi semplici, 0 GRAVI.
- **Anti-regressione**: tutte le batterie esistenti (round1–6*, fix-a, fix-b, V, X, Y, banco E) adattate al nuovo motore: 0 GRAVI, MEDI ≤ 2%, col modello avversario 0 GRAVI di sicurezza.
- **Esperienza**: ≤ 2 domande ogni 10 messaggi sul banco vero; nota del locale che riduce le domande ripetute a 0 dal secondo giorno (test a due giorni simulati).
- **Costo e tempi**: ≤ 0,40 €/locale/mese stimato dai token reali; p50 ≤ 3,5 s; escalation Sonnet ≤ 15%.
- **Exit**: max 5 giri banco→fix; se dopo 3 giri il banco vero resta < 85% → stop e report; Groq resta il default.

## Perimetri (worktree disgiunti, sottoagenti con comando goal)
- **T – strumenti e ciclo** (server): schema strumenti, runner del ciclo con Anthropic SDK (tool use nativo, streaming off, timeout), validatore dei fatti riusato, escalation, riserva Groq. ~6 h.
- **M – memoria e contesto**: scheda compatta, cronologia di giornata con compressione, nota del locale (tabella + job di riscrittura + «dimentica» + pannello dashboard sola lettura/modifica), prompt di Whisper. ~5 h.
- **B – banco vero**: raccolta conversazioni reali (Twilio → trascrizioni), formato unico, giudice sullo stato finale, runner col modello vero con tetto di spesa, confronto Anthropic vs Groq sulle stesse conversazioni. ~3 h.
- **Z – avversaria**: terzo verificatore indipendente sulle due architetture. ~2 h.
Totale stimato: 16–18 h di agenti, 2 giorni di calendario con i gate.

## Task
> Sostituita il 19/10/2026 18:20 UTC con la checklist della run unica (prompt «Motore Anthropic del bot titolare», max 4 h). Fonte di avanzamento: questa sezione + `STATO.md` + `git log`. Una casella = un commit.
> Run partita 17:59 UTC. Passaggio forzato a test/report alle 21:29 UTC. Fine massima 21:59 UTC.

- [x] A0 Prova chiavi a costo quasi zero — Anthropic: `ANTHROPIC_API_KEY` assente → 401, tutto offline col client registrato; Groq ok su `GROQ_API_KEY` e `GROQ_API_KEY2` (CHIAVI-OK.md).
- [x] A1 PIANO.md con questa checklist, STATO.md, `@anthropic-ai/sdk` ^0.135 in apps/server, typecheck server pulito.
- [ ] A2 Schema strumenti + runner del ciclo (SDK, Haiku, max 6 passi, timeout, cache) + client registrato per i test.
- [ ] A3 Esecutori degli strumenti sul simulatore di menu dello spike e, dietro la stessa interfaccia, sul DB (Drizzle).
- [ ] A4 Validatore dei fatti riusato + regole dure del server (elimina dopo «sì», annulla 10 min, piatto del giorno, >3 → OK, «sì» a due opzioni).
- [ ] A5 `sostituisci_menu` + aggancio import testo/foto esistente.
- [ ] A6 Contesto a ordine fisso, scheda compatta, cronologia di giornata compressa, alias confermati (SQL non applicata, repository, endpoint), prompt Whisper.
- [ ] A7 Riserva Groq, `settings.botEngine`, kill switch, `runOwnerTurn` esposto + README.
- [ ] A8 Risposte: generate dal modello + fatti dal DB; nessun testo fisso oltre i 2 ammessi.
- [ ] B1 Test: i 10 casi di Victoria (un tentativo di fix ciascuno, poi si segna).
- [ ] B2 Test: le 122 conversazioni dello spike rigiocate sul nuovo ciclo; batterie anti-regressione della fase R sul nuovo motore; suite completa senza nuovi rossi oltre i ~14 noti (elencarli).
- [ ] C1 Confronto Haiku vs Groq sullo stesso banco (122 dello spike + 10 di Victoria), stesso giudice sullo stato finale del menu. Con le chiavi: modelli veri; senza: offline e dichiarato.
- [ ] C2 REPORT.md con pagella, problemi, costi, cosa resta. STATO.md = «run conclusa, in attesa del via di Manuel». Commit+push. STOP.

<details><summary>Task del piano 17/10 (sostituiti dalla checklist sopra)</summary>

### 0. Scoperta (UNKNOWNS.md)
- [ ] 0.1 Chiave Anthropic: account, limiti di velocità, cache 1 h, prezzi ufficiali Haiku 5.5/Sonnet 5.5 (confermare 0,10/0,50 e soglia 100k).
- [ ] 0.2 Spike 1 h: 10 vocali di Manuel col ciclo a strumenti su Haiku 5.5, misurare passi per messaggio, token, latenza, errori di strumenti. Kill criterion: p50 > 5 s o > 4 passi medi → rivedere decisione 1.
- [ ] 0.3 Spike: Haiku con «cerca_piatti» tollerante risolve «kenesac», «u tunnu», «Bu», «passa il ragù»? (≥ 3/4).
- [ ] 0.4 Cosa della fase R si riusa tal quale (validatore fatti, schema operazioni, batterie, banco E) e cosa no.
### 1. Strumenti e ciclo (T)
- [ ] 1.1 Schema strumenti + runner Anthropic (SDK ufficiale, `claude-haiku-5-5`, tool use, max 6 passi, timeout 6 s, cache sul prefisso).
- [ ] 1.2 Validatore dei fatti condiviso applicato a ogni chiamata di scrittura; esito respinto → rimandato al modello come risultato dello strumento (auto-correzione), seconda volta → escalation Sonnet, terza → domanda.
- [ ] 1.3 Elimina con conferma, annulla 10 min, piatto del giorno protetto: come vincoli del server, non come copione.
- [ ] 1.4 Riserva Groq: errore/timeout Anthropic → fase R con stesso messaggio e contesto; test con fornitore finto in errore.
- [ ] 1.5 `settings.botEngine` + kill switch `TAKO_BOT_ANTHROPIC_OFF=1`.
### 2. Memoria e contesto (M)
- [ ] 2.1 Scheda locale compatta (riuso N) + cronologia di giornata con compressione oltre 20 scambi (riassunto scritto da Haiku).
- [ ] 2.2 Tabella `nota del locale` (SQL additivo + rollback) + job di riscrittura dopo 10 min di silenzio + «dimentica X».
- [ ] 2.3 Pannello dashboard: la nota è leggibile e modificabile dal titolare (sezione WhatsApp del titolare).
- [ ] 2.4 Prompt Whisper con nomi del locale + avviso «trascrizione» al modello.
- [ ] 2.5 Misura token: tipico ≤ 5k, menu grande ≤ 8k; cache verificata dai campi `usage`.
### 3. Risposte
- [ ] 3.1 Risposte generate, fatti appesi dal server; test che scansiona tutte le batterie: nessun testo fisso oltre i 2 ammessi.
- [ ] 3.2 Lunghezza: media ≤ 40 parole; conferme numerate quando le modifiche sono > 1.
### 4. Banco vero (B)
- [ ] 4.1 Raccolta: 32 vocali del 17/10 + risposte attese scritte da Manuel/da me; formato unico con il banco E.
- [ ] 4.2 Runner col modello vero (tetto di spesa per giro, es. 2 $) e con la riserva Groq; stesso giudice.
- [ ] 4.3 Confronto Anthropic vs Groq (fase R) sulle stesse conversazioni: tabella successo / domande / latenza / costo.
### 5. Anti-regressione
- [ ] 5.1 Batterie round1–6*, fix-a, fix-b, V, X, Y, banco E adattate al nuovo motore (oracolo e avversario): 0 GRAVI, MEDI ≤ 2%.
- [ ] 5.2 Suite completa senza nuovi rossi oltre i 12 noti.
### 6. Avversaria Z
- [ ] 6.1 ≥ 300 conversazioni nuove sul motore Anthropic (modello vero su un campione ≥ 50) → GRAVI = 0 dopo max 3 giri.
### 7. Rilascio
- [ ] 7.1 Deploy edge sul QA (check-active, diff, rollback), `botEngine=anthropic` solo sul QA, live solo TwiML, 0 messaggi a Manuel, ripristino per hash; rifare la sequenza vocale delle 17:26.
- [ ] 7.2 Prova di Manuel dal telefono (una giornata).
- [ ] 7.3 Se banco vero ≥ 90% e prova ok: default `anthropic` per i nuovi locali; i 21 clienti passano solo col via di Manuel. REPORT finale con costi reali.

</details>

## Rischi
- Latenza del ciclo (2–3 chiamate): mitigata con cache, strumenti che restituiscono poco, «sta scrivendo» immediato.
- Nota del locale che impara cose sbagliate: riscritta non appesa, visibile al titolare, «dimentica».
- Doppio motore da mantenere: il vincolo duro e il banco sono unici; solo l'interprete cambia.
- Prezzi di terze parti: confermare in console prima di promettere cifre.
