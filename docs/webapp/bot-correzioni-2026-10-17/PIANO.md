# Correzioni bot titolare dopo le prove vocali di Manuel · PIANO (17/10/2026)

Base: branch `codex/bot-fix-1017` da `codex/bot-verify-1017` e8df7ac (= origin/main 329bbd4 + 143 casi di V).
Online: edge operativa v112, cervello acceso solo sul QA 26050ecd-2e55-4057-a4c5-bff2b449cd47.
Fonti: `docs/webapp/bot-cervello-2026-10-17/VERIFICA-V.md`, `verifica-v/esiti-V.json`, `tests/eval/cases/manuel-1017.ts`, REPORT-N2.md, REGOLE-AGENTI.md.

**Regola di avanzamento:** ogni sottotask finito → spunta `[x]` in questo file subito, con una nota breve (commit, numeri). Una deviazione dal piano va in `implementation-notes.md`; se tocca architettura o scope → stop e report.

## Decisioni (17/10, Manuel: «procedi in completa autonomia»)
- **«elimina / cancella / rimuovi completamente / levalo proprio»** = cancellazione vera, **solo dopo conferma** («Elimino *X* dal menu? Rispondi sì»), recuperabile con «annulla» per 10 minuti (cancellazione logica, poi definitiva). **«togli» resta = nascondi.** Il piatto del giorno non si tocca con annulla.
- Le regole già decise restano: parti incerte multiple → una domanda per ciascuna; «no» pubblica le parti chiare; «annulla» = solo ultima pubblicazione; mai «fatto» senza riga scritta; niente frasi fisse.

## Goal / verifier / stop
- **Goal fase A**: i 143 casi di V + batterie nuove (150–200 frasi per famiglia toccata) → **0 GRAVI**, MEDI ≤ 2%; batterie round1–6* restano 0/0/0; suite completa senza nuovi rossi rispetto alla base (12 rossi noti); banco E oracolo non peggiora (≥ 92,5% / multi-turno ≥ 91,3%, 0 GRAVI).
- **Goal fase B**: come A sulle famiglie nuove (elimina, categorie, sposta, rinomina).
- **Goal finale (gate Developer)**: banco completo 318 conversazioni con gpt-oss vero ≥ 90% successo, 0 GRAVI di sicurezza; p50 ≤ 3 s comandi semplici sul QA.
- **Exit**: max 5 giri banco→fix per fase; se dopo 3 giri un GRAVE resta → stop, report, niente deploy di quella parte.
- **Token**: solo `groq-key-test.txt` poi `groq-key-test-2.txt`, ≤ 40k token/fase finché non c'è il Developer; mai `groq-key.txt` (ristoranti) né `groq-key-traduzioni.txt`. Registrare tutto in `token-log.md`.

## Vincoli (da REGOLE-AGENTI.md, invariati)
Scritture solo sul QA, poi ripristino verificato per hash. Nessun messaggio al numero di Manuel: live solo con webhook firmato + `TakoSyncTest=1` (risposte nel TwiML). Deploy edge solo dal bundle online + `check-active.mjs` + diff per sezioni + rollback pronto in `~/.config/tako-webapp/rollback-edge-20261017/`. SQL solo additivo con `rollback.sql`. Niente git checkout/restore/stash/force-push; fast-forward only. Mai stampare chiavi. Il cervello resta acceso solo sul QA.

---

## FASE A — niente più pubblicazioni sbagliate

### A1. «X e Y» e risposte con più prezzi (GRAVE, 6 casi)
- [x] A1.1 Bozza in sospeso non esclude più il cervello (`twilio-menu.ts:132` `!draft`): correzioni («no, sono due piatti», «no, intendevo…») arrivano al modello con la bozza nel contesto. — *F 17/10: risposte pulite deterministiche; se la bozza resterebbe ferma (stessa domanda) → cervello con «IN SOSPESO (aggiunta…)» nel contesto e i nomi/prezzi della bozza validi per le creazioni; correzioni del nome («no, intendevo X») sostituiscono il nome. Commit A1.*
- [x] A1.2 `twilio-menu-create.ts`: «X e Y» senza prezzo con X e Y entrambi nomi plausibili e non un composto noto (pasta e fagioli, cacio e pepe, pane e coperto… dal glossario) → domanda «due piatti o uno solo?»; mai bozza unica in silenzio. — *F: `splitPair` + glossario di ~80 coppie e «pasta/riso/pane e …»; bozza con `names/split/prices`.*
- [x] A1.3 Risposte a più prezzi («uno a 10 e uno a 20», «10 e 20», «la prima 10 la seconda 20») → assegnazione in ordine a più piatti; con un solo piatto e due prezzi → domanda, mai scrittura. — *F: `answerPrices` (per nome, ordinale o in ordine); «X e Y a 10 e 20» in un messaggio solo.*
- [x] A1.4 Batteria A1 (≥150 frasi, multi-turno) verde. — *F: `tests/eval/cases/fix-a.ts` a1-composti 186 conv., `eval-fix-a.test.ts` oracolo 186/186, Groq giù 186/186, avversario 186/186, 0 GRAVI. Banco V fase A falliti 46→13 (oracolo), banco E 294/318 invariato, round1–6* verdi.*

### A2. Prezzi inventati (GRAVE, 4 casi + rischio validatore)
- [x] A2.1 `spokenCents` (`twilio-menu-nlu.ts:135`): centesimi solo da forme esplicite («10 e 50», «10,50», «dieci e cinquanta»); «10 euro e uno deve…» → 10,00 + resto della frase. — *F: secondo numero 10–99 in fondo alla parte; anche «costa 12 e 50» senza «euro» per un piatto solo; stessa regola in `parseCreate`.*
- [x] A2.2 Validatore cervello (`owner-brain-plan.ts:239`): un prezzo è «detto» solo se compare come prezzo nel testo/cronologia; quantità e rimandi («quei due», «entrambi», «tutti e tre») non valgono come prezzo. — *F: `withoutQuantities` dentro `g9Prices`; `deixisReferents` («quei due», «tutti e tre», «il primo», «tutti tranne X»): un'azione senza nome deve toccare esattamente quei piatti.*
- [x] A2.3 Invariante globale: nessuna scrittura con prezzo assente dal testo dell'utente (o da un'operazione esplicita «stesso prezzo di X»/«+1 euro»). — *F: alle fonti (centesimi, quantità, prezzo dal contesto solo con rimando esplicito e mai con «lascialo stare», prezzo sul piatto della sua parte `priceClauseProblem`) + invariante `prezzo-non-detto` nelle batterie su 3 modelli: 0. Niente guardia unica nel route (vedi implementation-notes 7).*
- [x] A2.4 Batteria A2 (≥150 frasi) verde. — *F: a2-prezzi 160 conv.: oracolo 160/160; Groq giù e avversario 0 GRAVI di sicurezza, 0 prezzi non detti. Unità: `tests/owner-brain-fix-a.test.ts` 34/34.*

### A3. Nomi del piatto sporchi (GRAVE, 6 casi)
- [x] A3.1 Pulizia nome: verbi/forme di cortesia in testa («inserisce/inserisci il piatto», «per favore», «mi metti», «voglio che…») tolti. — *F: forme dei vocali («Inserisce», «aggiungere», «aggiunga») e cortesia ovunque nella frase.*
- [x] A3.2 Code di categoria tolte dal nome («nei primi pasti», «in una categoria nuova che si chiama…», «tra i primi») → diventano categoria richiesta (esistente → usata; inesistente → fase B / domanda). — *F: `unknownSectionAt`; la bozza tiene nome e `sectionName`, domanda «Nel menu non c'è la categoria *X*. In quale categoria metto…?».*
- [x] A3.3 Risposte di conferma («sì creala», «ok», «vai») mai usate come nome. — *F: anche domande e comandi senza verbo iniziale non diventano nome (`NAME_BAD`).*
- [x] A3.4 Batteria A3 (≥150 frasi) verde. — *F: a3-nomi 156 conv.: 156/156 in tutti e 3 i modi. Banco V fase A falliti 13→10, banco E 294/318 (91,3% multi), 0 GRAVI di sicurezza.*

### A4. Validatore e copy (MEDI)
- [ ] A4.1 Una sola categoria → usata senza chiedere (validatore `twilio-menu-ai.ts:58-65`).
- [ ] A4.2 Via «Rimandami/Riscrivimi la richiesta completa» e gli esempi con prezzi/piatti non detti dalle 6 copy; le domande citano solo ciò che l'utente ha detto.
- [ ] A4.3 Aggiunte multiple: nessuna parte persa (ragù/pesto/caviale); le parti chiare vanno, le incerte domandate.
- [ ] A4.4 Messaggi misti modifica + domanda: fa la modifica e risponde alla domanda (`twilio-menu.ts:189`); vocale con due modifiche su due piatti → entrambe.
- [ ] A4.5 «Non ho una richiesta recente» solo se la cronologia è davvero vuota.
- [ ] A4.6 Batteria A4 (≥150 frasi) verde.

### A5. Nomi storpiati (ASR)
- [ ] A5.1 Corrispondenza fonetica/sfocata sui nomi del menu (es. «kenesac»→«Che ne sacc», «Bu»→«boh», «Passa il ragù»→«Pasta al ragù»), solo verso piatti esistenti, con soglia; dubbio → domanda con ipotesi.
- [ ] A5.2 Batteria A5 (≥150 frasi) verde, incluso nessun falso abbinamento.

### A6. Chiusura fase A
- [ ] A6.1 143 casi V + batterie A1–A5: 0 GRAVI, MEDI ≤ 2%.
- [ ] A6.2 Batterie round1–6* 0/0/0; suite = 12 rossi noti; banco E oracolo non peggiora.
- [ ] A6.3 Gpt-oss vero sui casi V che passano dal cervello, entro tetto token (o rimandato al gate Developer, segnalato).
- [ ] A6.4 Verifica avversariale indipendente (agente diverso): cerca frasi nuove che pubblicano cose sbagliate; tutto ciò che trova → batteria + fix.
- [ ] A6.5 Deploy edge v113 (QA solo per il cervello) con check-active, diff, rollback; live sul QA solo TwiML: rifare la sequenza vocale delle 17:26 di Manuel → tutto giusto; QA ripristinato per hash; 0 messaggi al numero di Manuel (verifica API Twilio prima/dopo).
- [ ] A6.6 Fast-forward origin/main e origin/codex/release-1016; REPORT-A.md.

## FASE B — capacità nuove da WhatsApp

### B1. Elimina con conferma
- [ ] B1.1 Azione `delete` nello schema del cervello e nel percorso deterministico; «elimina/cancella/rimuovi completamente/levalo proprio» → conferma → cancellazione logica; «togli» resta nascondi.
- [ ] B1.2 «annulla» entro 10 min ripristina; dopo → definitiva (SQL additivo se serve + rollback.sql). Coerenza tra cervello e deterministico (oggi si contraddicono).
- [ ] B1.3 Batteria B1 (≥150 frasi) verde.

### B2. Categorie
- [ ] B2.1 Crea categoria («aggiungi la categoria primi», «crea una categoria che si chiama speciali»), anche dentro una richiesta con piatti («crea primi e mettici pasta al pesto»).
- [ ] B2.2 Rinomina categoria; nessun doppione; ordine sensato nel menu pubblico.
- [ ] B2.3 Batteria B2 (≥150 frasi) verde.

### B3. Sposta e rinomina piatti
- [ ] B3.1 Sposta piatto/i tra categorie («sposta il caviale negli speciali», «metti quei due nei primi»).
- [ ] B3.2 Rinomina piatto («cambia il nome di X in Y», «chiamala Z»), con alias appreso nella memoria del ristorante.
- [ ] B3.3 Batteria B3 (≥150 frasi) verde.

### B4. Chiusura fase B
- [ ] B4.1 Tutte le batterie A+B: 0 GRAVI, MEDI ≤ 2%; round1–6* 0/0/0; suite = 12 rossi noti.
- [ ] B4.2 Menu pubblico e dashboard mostrano subito categorie nuove/spostamenti/cancellazioni (tempo reale come oggi).
- [ ] B4.3 Verifica avversariale indipendente su B.
- [ ] B4.4 Deploy edge v114 (o v113 se A e B escono insieme) come in A6.5; live sul QA solo TwiML; ripristino per hash; 0 messaggi a Manuel.
- [ ] B4.5 Fast-forward main e release-1016; REPORT-B.md.

## GATE DEVELOPER (18/10, dopo che Manuel attiva il piano Groq)
- [ ] G1 Banco completo 318 conversazioni + casi V + batterie con gpt-oss vero (chiave Developer da file indicato da Manuel; comando in REPORT-N2.md).
- [ ] G2 ≥ 90% successo, 0 GRAVI di sicurezza, tasso JSON invalido/ripiego 20b, token in cache, p50 latenza sul QA.
- [ ] G3 Se sotto obiettivo: giri di fix (max 3) → ridistribuire su QA.
- [ ] G4 Report finale a Manuel; accensione per i clienti solo su suo via.
