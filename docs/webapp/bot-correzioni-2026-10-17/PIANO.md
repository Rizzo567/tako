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
- [x] A4.1 Una sola categoria → usata senza chiedere (validatore `twilio-menu-ai.ts:58-65`). — *F: validatore + scheda del cervello; il caso vero delle 17:30 (gpt-oss: create_item con section null) ora crea.*
- [x] A4.2 Via «Rimandami/Riscrivimi la richiesta completa» e gli esempi con prezzi/piatti non detti dalle 6 copy; le domande citano solo ciò che l'utente ha detto. — *F: 12 copy riscritte (anche brainWhatFor/brainNoContext/holdPrice/alreadyExists/clarifyText con esempi «a 13», «12 euro»); invarianti `frase-fissa` ed `esempio-inventato` nelle batterie.*
- [x] A4.3 Aggiunte multiple: nessuna parte persa (ragù/pesto/caviale); le parti chiare vanno, le incerte domandate. — *F: «aggiungi X a P» con X già nel menu = prezzo (uguale = lo dice) senza perdere il resto; `missing` dell'IA → bozza come nel deterministico.*
- [x] A4.4 Messaggi misti modifica + domanda: fa la modifica e risponde alla domanda (`twilio-menu.ts:189`); vocale con due modifiche su due piatti → entrambe. — *F: `mixedMessage` (anche «costa ancora 6? se sì…» con condizione verificata sul menu) + `after` scritto dal server dopo il salvataggio; «la X no» toglie davvero dal riepilogo.*
- [x] A4.5 «Non ho una richiesta recente» solo se la cronologia è davvero vuota. — *F: con cronologia la domanda cita i piatti recenti (`recentIds`).*
- [x] A4.6 Batteria A4 (≥150 frasi) verde. — *F: a4-validatore 156: oracolo 156/156, Groq giù/avversario 0 GRAVI di sicurezza. Batterie A1–A4 658/658 sull'oracolo. Banco V fase A falliti 10→3 (restano solo A5), banco E 294/318, multi 91,3%, 0 GRAVI di sicurezza.*

### A5. Nomi storpiati (ASR)
- [x] A5.1 Corrispondenza fonetica/sfocata sui nomi del menu (es. «kenesac»→«Che ne sacc», «Bu»→«boh», «Passa il ragù»→«Pasta al ragù»), solo verso piatti esistenti, con soglia; dubbio → domanda con ipotesi. — *F: `twilio-menu-phonetic.ts` (chiave fonetica italiana + distanza); forte (≥0,85, unico) = nominato per il validatore, debole = domanda «per «Bu» intendi boh…? Rispondi sì o no»; nel deterministico solo al posto di «Non trovo».*
- [x] A5.2 Batteria A5 (≥150 frasi) verde, incluso nessun falso abbinamento. — *F: a5-asr 151 (32 frasi di controllo fuori menu): oracolo 151/151, Groq giù/avversario 0 GRAVI di sicurezza. Banco V fase A falliti 3→0; banco E 296/318 (93,1%), multi 91,3%, 0 GRAVI di sicurezza.*

### A6. Chiusura fase A
- [x] A6.1 143 casi V + batterie A1–A5: 0 GRAVI, MEDI ≤ 2%. — *F (oracolo): V fase A 118 casi 0 GRAVI / 0 MEDI (base 45 falliti); i 25 casi che chiedono capacità di fase B (elimina, rinomina, sposta, categoria nuova, togliere un piatto appena creato) restano falliti, sicurezza 8→8, non peggiorano (implementation-notes 1, 13). Batterie A1–A5 809/809, 0 MEDI; Groq giù e avversario 0 GRAVI di sicurezza, 0 prezzi non detti.*
- [x] A6.2 Batterie round1–6* 0/0/0; suite = 12 rossi noti; banco E oracolo non peggiora. — *F: round1–6* verdi; suite 3.187 test, gli stessi 12 rossi della base; banco E oracolo 296/318 (93,1%, era 92,5%), multi 189/207 (91,3%), 0 GRAVI di sicurezza.*
- [ ] A6.3 Gpt-oss vero sui casi V che passano dal cervello, entro tetto token (o rimandato al gate Developer, segnalato). — *F: **RIMANDATO al gate Developer**: le due chiavi di test sono già oltre 150k token oggi (166k e 165k nel registro); 0 token spesi. La scheda del cervello è cambiata, quindi serve una registrazione nuova (comando in token-log.md, ~300k token).*
- [ ] A6.4 Verifica avversariale indipendente (agente diverso): cerca frasi nuove che pubblicano cose sbagliate; tutto ciò che trova → batteria + fix.
- [ ] A6.5 Deploy edge v113 (QA solo per il cervello) con check-active, diff, rollback; live sul QA solo TwiML: rifare la sequenza vocale delle 17:26 di Manuel → tutto giusto; QA ripristinato per hash; 0 messaggi al numero di Manuel (verifica API Twilio prima/dopo).
- [ ] A6.6 Fast-forward origin/main e origin/codex/release-1016; REPORT-A.md.

## FASE B — capacità nuove da WhatsApp

### B1. Elimina con conferma
- [x] B1.1 Azione `delete` nello schema del cervello e nel percorso deterministico; «elimina/cancella/rimuovi completamente/levalo proprio» → conferma → cancellazione logica; «togli» resta nascondi. — *F: `twilio-menu-structure.ts` (verbi, lettura deterministica, applicazione) + `delete_item` nel cervello e nel validatore (verbo nel messaggio di ADESSO); eliminare propone sempre «Elimino X dal menu? Rispondi sì».*
- [x] B1.2 «annulla» entro 10 min ripristina; dopo → definitiva (SQL additivo se serve + rollback.sql). Coerenza tra cervello e deterministico (oggi si contraddicono). — *F: annulla col menu intero di prima (impronta di quello di dopo) per eliminazioni/spostamenti/categorie; oltre 10 minuti definitiva. **Nessun SQL**: la cancellazione logica è il record `undo:` (10 min) + il ritiro «morbido» dei piatti tolti che la pubblicazione fa già (`items_off`). Capacità «non posso eliminare» tolta dalle copy: cervello e deterministico coerenti.*
- [x] B1.3 Batteria B1 (≥150 frasi) verde. — *F: b1-elimina 150, oracolo 150/150; Groq giù e avversario 0 GRAVI di sicurezza; invariante «eliminato-senza-conferma» 0.*

### B2. Categorie
- [x] B2.1 Crea categoria («aggiungi la categoria primi», «crea una categoria che si chiama speciali»), anche dentro una richiesta con piatti («crea primi e mettici pasta al pesto»). — *F: esplicita → subito; implicita («tra i primi» che non c'è) → «la creo?» → sì; prezzo mancante → bozza nella categoria nuova.*
- [x] B2.2 Rinomina categoria; nessun doppione; ordine sensato nel menu pubblico. — *F: `courseRank` (antipasti → … → bevande) e menu scelto per portata; doppioni rifiutati (singolare/plurale).*
- [x] B2.3 Batteria B2 (≥150 frasi) verde. — *F: b2-categorie 150, oracolo 150/150; invarianti «categoria-doppia» 0 e «categoria-fuori-ordine» 0.*

### B3. Sposta e rinomina piatti
- [x] B3.1 Sposta piatto/i tra categorie («sposta il caviale negli speciali», «metti quei due nei primi»). — *F: deterministico per i comandi espliciti, cervello per i rimandi; categoria che non c'è → «la creo?».*
- [x] B3.2 Rinomina piatto («cambia il nome di X in Y», «chiamala Z»), con alias appreso nella memoria del ristorante. — *F: vecchio nome → alias attivo (solo col cervello acceso), mai verso un nome di un altro piatto; nome già preso → domanda.*
- [x] B3.3 Batteria B3 (≥150 frasi) verde. — *F: b3-sposta-rinomina 152, oracolo 152/152; avversario (elimina al posto di nascondere, rinomina/sposta a caso, categorie inventate): 0 GRAVI di sicurezza.*

### B4. Chiusura fase B
- [x] B4.1 Tutte le batterie A+B: 0 GRAVI, MEDI ≤ 2%; round1–6* 0/0/0; suite = 12 rossi noti. — *F: A 809/809 + B 452/452 (oracolo), 0 GRAVI di sicurezza con Groq giù e avversario; round1–6* verdi; suite 3.203 test, gli stessi 12 rossi; banco E 296/318 (multi 91,3%, 0 GRAVI di sicurezza); banco V 12 falliti su 143 (era 70), di cui 11 in attesa del «sì»/«OK» per decisione (implementation-notes 21).*
- [x] B4.2 Menu pubblico e dashboard mostrano subito categorie nuove/spostamenti/cancellazioni (tempo reale come oggi). — *F: verificato **solo nel codice** (niente live, come richiesto): implementation-notes 25.*
- [ ] B4.3 Verifica avversariale indipendente su B.
- [ ] B4.4 Deploy edge v114 (o v113 se A e B escono insieme) come in A6.5; live sul QA solo TwiML; ripristino per hash; 0 messaggi a Manuel.
- [ ] B4.5 Fast-forward main e release-1016; REPORT-B.md.

## GATE DEVELOPER (18/10, dopo che Manuel attiva il piano Groq)
- [ ] G1 Banco completo 318 conversazioni + casi V + batterie con gpt-oss vero (chiave Developer da file indicato da Manuel; comando in REPORT-N2.md).
- [ ] G2 ≥ 90% successo, 0 GRAVI di sicurezza, tasso JSON invalido/ripiego 20b, token in cache, p50 latenza sul QA.
- [ ] G3 Se sotto obiettivo: giri di fix (max 3) → ridistribuire su QA.
- [ ] G4 Report finale a Manuel; accensione per i clienti solo su suo via.

## A7 — correzioni dalla verifica avversaria X (aggiunto 17/10 sera, dopo A6.4)
Fonte: branch `codex/bot-adv-1017` (13d4354 + REPORT-X), `docs/webapp/bot-correzioni-2026-10-17/avversaria/REPORT-X.md`; runner `TAKO_ADV=1 npx vitest run tests/eval/eval-adv-a.test.ts` e 31 sonde `tests/owner-brain-adv-a.test.ts`. Si fa dopo B4.1 (stessi file). Prima: merge di codex/bot-adv-1017 in codex/bot-fix-1017.
- [x] A6.4 Verifica avversaria eseguita (508 conversazioni, ~79 GRAVI / ~65 MEDI) — X, 13d4354
- [x] A7.1 G1/G2 somiglianza parole troppo larga (torna→Torta, pollo→polpo, torno→tonno) — famiglie X lev1/suono a 0 GRAVI (softEdit su consonanti 5–6 lettere); c8dfb22
- [x] A7.2 G3 «togli N euro» = ribasso di prezzo, non nascondi — «togli/leva N euro» → ribasso dal prezzo attuale; famiglie toglieuro/relativi 0 GRAVI; c8dfb22
- [x] A7.3 G4 code e teste nel nome del piatto nuovo (se puoi, dai, per stasera, da domani, al/sul menu…) — code/teste tolte dal nome; famiglia code 0 GRAVI; c8dfb22
- [x] A7.4 G5 «X e Y a N» → domanda uno/due piatti anche col prezzo; M6 prezzi nella risposta («8 tutti e due») — «X e Y a N» → due piatti / domanda; «8 tutti e due»; famiglia coppie 0 GRAVI; c8dfb22
- [x] A7.5 G6/M12 bozza in sospeso + «lascia stare/lascia perdere/niente» chiude la bozza — bozza chiusa da «lascia stare/niente/annulla/no», mai nome; lasciastare/sospeso 0 GRAVI; 4134c28 (note 27–28)
- [x] A7.6 G7/G11 ipotesi fonetiche e match su una sola parola: mai verso piatto con parole diverse; «sì» a un'ipotesi sbagliata non scrive l'altro piatto — ipotesi deboli solo con parole allineate; «sì» non scrive l'altro piatto; ipotesi/sospeso2 0 GRAVI; 4134c28 (nota 29)
- [x] A7.7 G8 prezzi relativi (aumenta/abbassa di N, +1, N centesimi in più) → calcolo dal prezzo attuale, direzione verificata — differenze dal prezzo attuale, comparativo «e la X uno in meno» dal prezzo appena messo; 4134c28 (nota 36)
- [x] A7.8 G9/M7 centesimi («7 euro 90», «quindici e novanta», «13 virgola 50», «3 e 50») — centesimi in g9Prices/spokenCents; famiglia centesimi 0 GRAVI; c8dfb22
- [x] A7.9 G10/M8 ordinali e rimandi a elenchi del bot sempre verificati — elenco del bot come riferimento, «il primo e l'ultimo», verbo diverso ≠ scelta; deixis/ordinali 0 GRAVI; 4134c28 (nota 32)
- [x] A7.10 G12/M5 correzioni: «lasciala stare» sul piatto toccato = ripristino; «anzi no» da solo = annulla ultima azione — «lasciala stare» = ripristino del piatto toccato, «anzi no» da solo = annulla; anzino 0 GRAVI; c8dfb22
- [x] A7.11 M1/M2/M3/M4 misti, saluti in testa, domande, «boh» come esitazione — misti, saluti, domande, «boh» intercalare; misti/misti2/vocali 0 GRAVI; c8dfb22 + 4134c28 (nota 33)
- [x] A7.12 M9/M10/M11 domanda giusta invece di «non ho capito»; Groq spento → riserva utile, non «C'è stato un problema»; categoria dedotta — scelta numerata invece di «non ho capito», Groq giù → aiDown e correzioni lette senza IA; 4134c28 (note 34–35)
- [x] A7.13 Runner avversario: oracolo 0 GRAVI, off e avversario 0 GRAVI di sicurezza; 31 sonde verdi; fix-a, B, round1–6* non peggiorano; suite = 12 rossi — oracolo 0 GRAVI / 9 MEDI (1,8%) su 508; off 0 e avversario 0 GRAVI di sicurezza; 31 sonde verdi; fix-a/fix-b verdi, round1–6* 1673/1673, banco E 298/318 (93,7%, multi 191/207, 0 GRAVI sicurezza), suite 12 rossi (stessi file d'ambiente); 4134c28
- [ ] A7.14 Secondo giro avversario indipendente (≥200 conversazioni nuove) → se GRAVI, ripetere A7 (max 3 giri)

## A8 — giro 2 avversario Y (aggiunto 17/10 notte)
A7.14 NON superato: Y (codex/bot-adv2-1017 cd777a8, `avversaria-y/REPORT-Y.md`) su 558 conversazioni nuove → ~114 GRAVI veri in 11 famiglie, quasi tutti nel percorso deterministico (uguali con Groq spento). Lezione: le correzioni a lista fissa (code, verbi) non reggono frasi nuove → serve un cambio di struttura, non altre liste.
- [x] A7.14 Secondo giro avversario eseguito (558 conv., 337 su fase B) — Y, cd777a8
- [ ] A8.0 **Regola strutturale «lettura completa»**: il percorso deterministico può SCRIVERE (o proporre una conferma) solo se ogni parte del messaggio è stata letta con un significato (verbo, piatto/categoria esistente, prezzo, cortesia/riempitivo noto); se resta testo non spiegato → passa al cervello (validatore) o, con Groq spento, domanda breve che cita il testo. Nomi nuovi (piatto, categoria, rinomina) solo da posizioni esplicite (dopo «che si chiama», «in», tra virgolette, fine frase senza altri verbi); un secondo verbo dopo il nome chiude il nome. Documentare in implementation-notes. — WIP (17/10 notte, fermato dal coordinatore): regola fatta nel deterministico (37024cd, 5aa8757) e applicata al cervello come «parti perse» → hold con domanda (bcf824a); NON spuntato: runner Y non ancora verde
- [ ] A8.1 Y1 «elimina/cancella» mai = nascondi, anche in multi-azione/elenchi/refusi; conferma unica per tutte le eliminazioni del messaggio — WIP: elimina≠nascondi coperto dalla regola (verbo «elimina» senza azione delete = non letto); manca la conferma unica nei messaggi misti (elimina X e nascondi Y)
- [ ] A8.2 Y3/M1 conferma in attesa chiusa da qualunque correzione o nuova richiesta; «no, solo X» → nuova proposta solo per X; «no, nascondilo e basta» → nascondi — WIP misurato sulle famiglie r2-el-si/el-conferma (0 GRAVI in oracolo) — 44b5c04; non spuntato finché A8.7 non è verde
- [ ] A8.3 Y2/Y7/Y8 prezzi relativi: delta legato al piatto giusto della clausola; decimali («un euro e mezzo», «1,50»); «togli N» con N decimale = ribasso; verbi scala/riduci/cala/meno → validatore li ferma — WIP misurato sulla famiglia r2-relativi (0 GRAVI in oracolo) — 1f2317f; non spuntato finché A8.7 non è verde
- [ ] A8.4 Y4/Y5/Y6/Y9/Y10 nomi nuovi e categorie: via A8.0 (niente code, virgolette rispettate, «X e Y a 16 e 14» → due piatti 16 e 14); categoria vs piatto («i dolci» = categoria se esiste) — WIP: code/virgolette/secondo verbo nei nomi, categoria al plurale come sorgente (5aa8757); restano rinomine con prezzo/elenchi nel nome dal cervello
- [ ] A8.5 Y11/M4/M6 rimandi dopo domande, spostamenti, rinomine («anche la gricia» dopo sposta); «il primo/il secondo» ordinali vs Primo/Secondo del giorno — WIP: seguiti degli spostamenti («anche X», «anzi negli Y»), ordinali non sono piatti; restano Y11 (price_ref sul piatto sbagliato, «rimettila» → evidenza) e «la seconda no»
- [ ] A8.6 M2/M3/M5/M8 domanda sul nome mancante; parti perse nei misti; «a 0» → domanda, negativi rifiutati; formati «13€», «€ 13», «13,00» anche senza IA — non iniziato (a 0 / negativi, nome categoria mancante, formati prezzo senza IA)
- [ ] A8.7 Runner Y + X: oracolo 0 GRAVI, off e avversario 0 GRAVI di sicurezza, MEDI ≤ 2%; fix-a, fix-b, round1–6*, banco E, V non peggiorano; suite = 12 rossi — non raggiunto: Y oracolo 29 GRAVI (era 140), off 8 e avversario 10 di sicurezza; X 0 GRAVI, fix-a/fix-b verdi, round1–6* 1721/1721, banco E 298/318, V invariato
- [ ] A8.8 Terzo e ultimo giro avversario indipendente (Z, ≥300 conv. nuove). Se restano GRAVI → STOP: niente deploy delle parti coinvolte, report a Manuel (exit del piano: max 3 giri)

---
# FASE R — un solo cervello (decisione Manuel 17/10 notte)
«Il bot vecchio non deve più esserci» + «messaggi e azioni prestabiliti da togliere» + Groq giù = opzione A. A8 si ferma qui (WIP 6004b81): il percorso a regole NON decide più. Le parti utili di A–A8 restano solo come VALIDATORE del piano del modello (piatto esiste, prezzo detto con lettore indipendente, parti perse, rimandi, polarità prezzi relativi, nomi puliti, cancellazione solo con conferma, conferme in sospeso chiuse da correzioni).

## Decisioni ritoccabili
1. **Instradamento**: ogni messaggio del titolare → cervello (contesto: scheda generale → scheda ristoratore → cronologia ≤10 scambi/30 min → operazioni in sospeso [bozze, conferme, riepiloghi, domande aperte] → messaggio). Nessun percorso deterministico che interpreta frasi.
2. **Risposte**: il testo lo scrive il modello (`reply_draft`); il server aggiunge solo i fatti riletti dal DB (cosa è cambiato, prezzi da→a). Testi fissi ammessi SOLO: riga «assistente automatico» al primo messaggio (AI Act) e messaggio «non disponibile» (Groq giù). Niente elenchi di comandi, niente «Rimandami…».
3. **Azioni**: il modello sceglie tra strumenti primitivi (prezzo, nascondi/mostra, finito/disponibile, crea piatto, elimina→conferma, crea/rinomina categoria, sposta, rinomina piatto, descrizione, promo, evidenza, piatto del giorno, annulla, domanda). Nessun flusso a copione: le conferme e le domande le formula il modello; il server impone solo i vincoli (es. elimina richiede «sì» al turno dopo).
4. **Validatore fallito** → il server rimanda al modello l'errore una volta (auto-correzione); se ancora fallisce → il modello formula una domanda; mai scrittura.
5. **Groq giù / 429 / JSON invalido dopo ripiego 20b** → «Sono momentaneamente non disponibile, riprova tra un minuto.», nessuna modifica.
6. Interruttore `settings.botBrain` resta (solo QA) finché il gate Developer non passa; con l'interruttore spento i clienti restano sul comportamento v112.

## Goal / verifier / stop
- Tutte le batterie (round1–6*, fix-a, fix-b, V 143, X 508, Y 558, banco E 318) con l'oracolo: 0 GRAVI, MEDI ≤ 2%; il modello avversario: 0 GRAVI di sicurezza (il validatore ferma tutto).
- Nessun testo fisso fuori dai 2 ammessi (test che scansiona le risposte).
- Gate Developer (18/10, gpt-oss vero): ≥ 97% sulle famiglie di comandi semplici (era il calo 97→58 misurato da N) e ≥ 90% complessivo, 0 GRAVI di sicurezza, p50 ≤ 3 s.
- Exit: max 5 giri; se col modello vero i comandi semplici restano < 90% dopo 3 giri di prompt → stop e report a Manuel (non si torna alle regole senza il suo via).

## Task
### R0 Scoperta
- [x] R0.1 UNKNOWNS-R.md: perché le famiglie semplici calavano 97→58 col cervello su tutto (prompt? validatore? oracolo?); cosa del percorso deterministico è interpretazione (da togliere) e cosa è vincolo (da tenere nel validatore); stati in sospeso oggi gestiti a copione. — *R 17/10: UNKNOWNS-R.md; spike misurato (cervello su tutto senza strumenti: E 298→281, fix-a 809→538): il calo è architettura (stati in sospeso senza strumenti), testi fissi del server e oracolo, non gpt-oss.*
- [x] R0.2 Mappa dei testi fissi in twilio-menu-copy.ts e simili: quali spariscono, quali diventano fatti del server, i 2 ammessi. — *R: MAPPA-TESTI-R.md (valida solo a cervello acceso; clienti invariati).*
### R1 Instradamento unico
- [x] R1.1 Route: tutti i messaggi al cervello quando `botBrain` è acceso; percorso deterministico non più chiamato per interpretare. — *R: `brainEntry` in testa a `menuTurnCore` + `brainTurnR` nel job: col cervello acceso nessun messaggio passa dal percorso a regole (fuori solo foto/menu intero/preset/memoria, nota 49). Misurato su tutte le batterie.*
- [x] R1.2 Operazioni in sospeso (bozze, conferme elimina, riepiloghi, domande aperte, scelte numerate) passate nel contesto e risolte dal modello; il server tiene solo lo stato e i vincoli. — *R: stati `batch` (why), `hold` (source), `brain_ask` e annulla possibile nel contesto; il modello conferma/scarta/completa, il server tiene stato e vincoli (note 50–51).*
- [x] R1.3 Groq giù → messaggio A, nessuna modifica; test con Groq finto in errore/429/JSON rotto. — *R: `copy.brainDown` per 503/429/timeout/JSON rotto/nessuna chiave, nessuna modifica: `tests/owner-brain-r.test.ts` 20/20; Groq giù su tutte le batterie 0 GRAVI di sicurezza.*
### R2 Strumenti e validatore
- [x] R2.1 Schema azioni completo (incl. fase B: elimina, categorie, sposta, rinomina) nello schema strict. — *R: `confirm_pending`/`cancel_pending`/`undo_last` nello schema strict (fase B era già dentro).*
- [x] R2.2 Validatore unico: riusa i controlli di A–A8 (lettore prezzi indipendente, parti perse, rimandi, polarità, nomi, conferma elimina, conferme chiuse da correzioni, quantità ≠ prezzi, formati prezzo). — *R: validatore di A–A8 riusato + vincoli nuovi e allentamenti misurati (nota 55); avversario con anche gli strumenti di controllo a sproposito: 0 GRAVI di sicurezza su fix-a/fix-b/X/Y.*
- [x] R2.3 Auto-correzione: errore del validatore rimandato al modello una volta; poi domanda. — *R: un rifiuto torna al modello una volta col motivo, poi domanda del modello; banco E 12 auto-correzioni su 547 turni (nota 52).*
### R3 Risposte generate
- [x] R3.1 Rimozione dei testi fissi (tranne i 2 ammessi); fatti del server in coda alla bozza del modello. — *R: testi fissi del percorso a regole via col cervello acceso; restano `aiDisclosure`, `copy.brainDown` e fatti di stato (nota 53, MAPPA-TESTI-R.md).*
- [x] R3.2 Test che scansiona tutte le risposte di tutte le batterie: 0 testi fissi vietati. — *R: `tests/owner-brain-r-texts.test.ts`: 16 file di risultati, 0 frammenti vietati.*
### R4 Scheda e prompt
- [x] R4.1 Scheda generale: comandi semplici con esempi (dalle batterie round1–6 e dai vocali di Manuel), regole del titolare, glossario; misura token (target ≤ 3,5k tipico). — *R: scheda riscritta, riga ESEMPI dai round e dai vocali, accorciata: 2,8k token la scheda, contesto tipico 3,2–3,5k (≤3,9k con 10 scambi) (nota 59).*
- [x] R4.2 Oracolo del banco aggiornato al nuovo instradamento (documentato). — *R: `brain-oracle-r.ts` + avversario `attackR`, documentati (nota 58): misura instradamento/contesto/strumenti/validatore, non gpt-oss.*
### R5 Misura
- [ ] R5.1 Tutte le batterie con oracolo e avversario → goal sopra; suite senza nuovi rossi oltre i 12 noti (i test del vecchio percorso che cambiano significato vanno aggiornati e motivati in implementation-notes). — *R: NON raggiunto. Oracolo: fix-a 809/809, fix-b 452/452, X 502/508 (0 GRAVI, 6 MEDI 1,2%), banco E 306/318 (era 298; 7 GRAVI non di sicurezza, 5 MEDI), V 128/143 (era 131; 4 GRAVI di cui 2 di sicurezza già nella base, 11 MEDI), Y 508/558 (era 454; 5 GRAVI, 1 di sicurezza = falso positivo noto y-lunghe-013, 45 MEDI 8%). Avversario e Groq giù 0 GRAVI di sicurezza ovunque. Round1–6* col cervello spento 1679/1679, suite = gli stessi 14 rossi di 6004b81.*
- [ ] R5.2 Campione gpt-oss vero solo se le chiavi di test hanno quota (tetto 40k), altrimenti gate Developer. — *R: RIMANDATO al gate Developer: chiavi di test oltre 150k/giorno (166k e 165k), 0 token (nota 61).*
### R6 Avversaria Z
- [ ] R6.1 Terzo giro avversario indipendente (≥300 conv. nuove) sulla nuova struttura; GRAVI → fix (max 3 giri).
### R7 Gate Developer e rilascio
- [ ] R7.1 Banco completo + tutte le batterie con gpt-oss vero (chiave Developer).
- [ ] R7.2 Deploy edge sul QA (check-active, diff, rollback), live solo TwiML, ripristino per hash, 0 messaggi a Manuel; rifare la sequenza vocale delle 17:26.
- [ ] R7.3 Fast-forward main/release-1016; REPORT-R.md; accensione clienti solo col via di Manuel.
