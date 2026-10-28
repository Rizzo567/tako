# VERIFICA V — prove vocali di Manuel 17/10 e problemi derivati · su 329bbd4 (edge v112), cervello ACCESO

Branch locale `codex/bot-verify-1017` (da origin/main 329bbd4), niente push. Solo test locali: niente deploy, SQL, DB di produzione, webhook o messaggi WhatsApp.
- Casi: `tests/eval/cases/manuel-1017.ts`, 143 conversazioni in 16 famiglie `v-*`. Formato del banco E, set separato: il banco principale non cambia.
- Runner: `tests/eval/eval-manuel-1017.test.ts`. È il route vero con `settings.botBrain=true` e le tabelle del cervello emulate. In più del giudice c'è il MEDIO `frase-fissa`.
- Risultati: `verifica-v/`. `esiti-V.json` contiene l'esito per caso con la fonte della misura.

Aggiunte additive al banco:
- `types.ts`: operazioni attese `delete`, `rename`, `move` e `V_FAMILIES`;
- `judge.ts`: chiavi per le operazioni nuove (il diff le produceva già);
- `fixtures/menus.ts`: `qa` (il QA delle 17:26, una sola categoria) e `qasporco` (con il piatto «Inserisce il piatto la parmigiana»);
- `runner.ts`: riepilogo anche per le famiglie V.

`judge.test.ts` resta verde (11/11).

## Come è misurato ogni caso (stop: misurato oppure dichiarato non verificabile)
- **deterministico**: 73 casi in cui nessun turno chiama l'IA. Il percorso è deterministico, quindi l'esito è quello vero e vale in qualunque modo Groq.
- **gpt-oss vero**: 12 casi registrati con le chiavi di test, 36.300 token (`verifica-v/token-log.md`).
- **dal vivo**: le risposte vere di Tako delle 17:26–17:40 per le stesse frasi.
- **per schema**: il fallimento è certo perché lo schema del cervello e il percorso deterministico non hanno l'azione. `BRAIN_ACTIONS` in `owner-brain-plan.ts:17` non ha né delete né rename né create_section né move.
- **NON verificato con gpt-oss**: 50 casi passano dal cervello e non sono stati registrati per il tetto dei token (le 87 chiamate costerebbero circa 300k token). Per questi c'è solo l'oracolo, che **non è affidabile** su queste famiglie.
  - L'oracolo trasforma «quei **due**», «tutti e **tre**» e «in **una** categoria» in prezzi 2, 3 e 1.
  - Ne restano utili solo le osservazioni lato server, segnate come «iniezione».
- Groq giù (`off`): tutti i turni che vanno al cervello finiscono in «errore generico» o «non ho capito» (riserva → vecchia IA → giù). È atteso e non entra nelle tabelle.

## Tabella per famiglia
I «falliti» sono misurati. La colonna NV conta i casi non verificati con gpt-oss.

| Famiglia | Casi | Misurati | Falliti | Gravità | Causa nel codice | Fix proposto · stima |
|---|---|---|---|---|---|---|
| v-deixis («quei due», «entrambi», «l'ultimo», «tutti tranne») | 13 | 2 (gpt-oss) | 0 | — · rischio GRAVE | Con gpt-oss «nascondi quei due piatti» e «mettila anche in evidenza» vanno bene. **Iniezione**: un piano col prezzo 2 da «quei due» passa il validatore e viene pubblicato. Il controllo dei prezzi detti (`owner-brain-plan.ts:239-245`, `g9Prices`) conta come prezzo anche i numeri che fanno da quantità («quei due», «tutti e tre», «una categoria»). | Le quantità dopo «quei/questi/tutti e/entrambi/in una» non sono prezzi detti. Batteria di 150 frasi. **1 h**. NV 11 (entrambi, l'ultimo, il primo, quelli, tutti tranne, tutti e tre) |
| v-elimina («rimuovi completamente», «cancella», «elimina») | 10 | 9 | 7 | 6 GRAVE (capacità) · 1 MEDIO | **Capacità mancante**: nessuna azione delete. Deterministico: nasconde con la nota (`twilio-menu.ts:240`, `copy.hiddenNotDeleted` `twilio-menu-copy.ts:117`). Cervello (gpt-oss): «Da questa chat non posso eliminare… nascondi il polpo» (`twilio-menu-copy.ts:159`). **Le due strade si contraddicono**. Dal vivo alle 17:30: domanda «Quale piatto intendi… Riscrivimi». | Eliminare con conferma («Elimino *X* dal menu? Scrivi OK»), annulla dalla versione, schema del cervello più deterministico più copy unica. Da decidere con Manuel se «elimina» deve eliminare. **3–4 h** |
| v-aggiunte (multiple, con o senza prezzi o categoria) | 11 | 8 | 2 | 1 GRAVE · 1 MEDIO | Caso vero delle 17:30 riprodotto con gpt-oss: il cervello risponde `missing:section`. Il validatore (`twilio-menu-ai.ts:58-59,65`) chiede la categoria **anche con una sola categoria**, a differenza del deterministico (`twilio-menu-create.ts:75`). La copy `createMissing` (`twilio-menu-copy.ts:61`) mette **«12 euro» fisso** e un solo piatto: pesto e caviale si perdono. «aggiungi pasta al pesto e lasagna» crea UN piatto (vedi composti). | Categoria unica come predefinita nel validatore e nel prompt. `createMissing` costruita con tutti i piatti e i prezzi capiti, mai un prezzo d'esempio. **1 h**. NV 3 |
| v-categorie (creare, piatto in una categoria nuova, spostare) | 8 | 8 | 7 | 6 GRAVE · 1 MEDIO | **Capacità mancante** (`twilio-menu.ts:177,180` → «si creano dalla dashboard»). Tre bug veri del deterministico: «…a 12 nei primi pasti» con la categoria inesistente crea **«Pasta al sugo nei primi pasti»** in Piatti di prova (`twilio-menu-create.ts:74-75`); «sì creala» diventa il nome del piatto, **«Creala»** (`createStep`, `twilio-menu-create.ts:112-123`, la risposta sovrascrive il nome della bozza); «in una categoria nuova che si chiama speciali» diventa il nome «Caviale in una». | Azioni `create_section` e `move_item` (cervello e deterministico) con conferma. Parser: le parole di una categoria sconosciuta non entrano nel nome; «sì / creala / ok» non è un nome. **3 h** |
| v-composti («X e Y» due piatti o nome composto) | 11 | 9 | 2 | 2 GRAVE | Caso delle 17:39–17:40 riprodotto **identico**: piatto unico «Pasta al pesto e lasagna» a **10,01 €**. `createStep` mette tutto in una bozza col nome composto. **Con la bozza in sospeso il cervello è escluso** (`twilio-menu.ts:132`, `!draft`): «no, sono due piatti separati» non arriva mai al modello e la domanda si ripete uguale. I nomi composti veri («pasta e fagioli», «pane e coperto», «spaghetti cacio e pepe») vanno bene. | Una bozza con «X e Y» in cui X e Y non sono un piatto noto chiede «due piatti o uno?». Con la bozza in sospeso, un messaggio che non è una risposta pulita va al cervello con la bozza nel contesto. Bozze multiple. **3 h** |
| v-correzioni («no, intendevo…», «anzi no», dopo una domanda) | 11 | 4 | 0 | — | Misurati OK: «no, intendevo il tiramisù» (gpt-oss, con ripristino), «no, ho detto togli boh» (ora nasconde), «anzi lascia stare». Il caso vero «No, sono due piatti separati» è contato in composti. | NV 7: «anzi no» a catena (13:27–13:28), «no scusa 14» dopo un'aggiunta. **Solo oracolo** |
| v-risposte (risposte brevi: «10 e 20», «uno a 10 e uno a 20», «il primo») | 9 | 8 | 3 | 3 GRAVE | Dopo «aggiungi pasta al pesto e lasagna»: «10 e 20» e «la prima 10 la seconda 20» creano il piatto unico a 20 €, «uno a 10 e uno a 20» a 10,01 €. Stessa causa dei composti (bozza unica più `parseCreate` che prende un solo numero). «20», «20 euro», «venti», «10 euro e 50» vanno bene. | Insieme al fix dei composti; due prezzi per una bozza da un solo piatto → domanda. **compreso sopra** |
| v-prezzi (prezzi inventati o arrotondati) | 9 | 5 | 4 | 4 GRAVE | **10,01 € e 20,01 €**: `spokenCents` (`twilio-menu-nlu.ts:135-136`, chiamato su ogni messaggio in `twilio-menu.ts:108`) legge «10 euro **e uno** deve…» come 10,01. Con un piatto solo e due prezzi scrive invece di chiedere. | «N euro e M» diventa centesimi solo se M chiude la frase o segue «centesimi», mai con «e uno/una + verbo/a». Batteria di 150 frasi. **1 h**. NV 4 |
| v-verbi (verbi nel nome del piatto) | 10 | 9 | 4 | 4 GRAVE | Ancora rotto come alle 13:20: «Inserisce il piatto la parmigiana…» crea il piatto con quel nome, e «mi aggiungi **per favore** la pasta alla norma» crea «Per favore la pasta alla norma». Il verbo iniziale è riconosciuto (`waNewVerb`, `twilio-menu-create.ts:17`), ma l'insieme `lead` (`twilio-menu-create.ts:38`) non toglie «inserisce/inserire/aggiungere/per favore». | Togliere tutte le forme del verbo e le formule di cortesia; nome finale ≤5 parole, senza verbi. **0,5 h** |
| v-asr (nomi storpiati) | 10 | 8 | 2 | 1 GRAVE · 1 MEDIO | **«nel kenesac metti la promo a 12»** → gpt-oss: «Non ho capito la richiesta» (nessuna somiglianza fonetica nel contesto). Il vocale delle 13:24 («Bo descrizione + Kenesac promo») → domanda solo su boh, la promo si perde. «parmiggiana», «tiramisu a sette», «bo mettilo a 25», «tojibo» → domanda: OK. | Somiglianza fonetica (scheletro di consonanti) nel blocco ristoratore e domanda «intendi *Che ne sacc*?» invece di «non ho capito». **2 h**. NV 2: «Bu costa 40», «Passa il ragù» |
| v-stato (domande dopo le modifiche) | 8 | 4 | 0 | — | OK misurati: «quanto costa adesso», «cosa sai fare», «quanti visibili», «quanto costa boh». | NV 4 |
| v-annulla (dopo multi-azione) | 8 | 3 | 0 | — | OK: annulla dopo un'aggiunta, dopo il vocale multiplo, oltre la finestra. | NV 5 (anche «rimetti il tiramisù com'era») |
| v-misti (domanda + modifica) | 7 | 2 | 1 | 1 MEDIO | gpt-oss su «metti la parmigiana a 12 e dimmi quanto costa il tiramisù»: chiarimento con una sola azione → il route ne fa una scelta **tra parmigiana e tiramisù** («Quale piatto intendi? 1. 2.», `twilio-menu.ts:189`). Il route mescola il piatto dell'azione e quello della domanda. | Con `piatto_nominato_senza_azione` applicare l'azione chiara e rispondere alla lettura. **1 h**. NV 5 |
| v-frasefissa («Rimandami/Riscrivimi la richiesta completa») | 6 | 4 | 1 | 1 MEDIO (più 3 casi in altre famiglie) | La frase c'è ancora in 6 copy: `twilio-menu-copy.ts:43` (menuChanged), `:50`, `:51`, `:53`, `:56` (whichDish, usata alle 17:30), `:61` (createMissing, usata alle 17:30 e 17:31). Vista con gpt-oss (aggiunte-001) e dal vivo. | Le domande citano ciò che si è capito e chiedono solo il pezzo mancante. **1 h** (con aggiunte) |
| v-coerenza (contraddizioni tra turni) | 6 | 4 | 1 | 1 GRAVE | «crea la categoria primi pasti» → poi «aggiungi la pasta al sugo nei primi pasti a 12» crea «Pasta al sugo nei primi pasti» (stessa causa delle categorie). Altre contraddizioni: elimina contro «non posso eliminare» (vedi elimina); `brainNoContext` (`twilio-menu-copy.ts:34`, `twilio-menu.ts:301`) dice «Non ho una richiesta recente» anche con 4 scambi in cronologia (iniezione). | Copy di `brainNoContext` solo a cronologia vuota, altrimenti la domanda cita l'ultimo piatto. **0,5 h** |
| v-rinomina (piatti e categorie) | 6 | 6 | 6 | 6 GRAVE (capacità) | **Capacità mancante** (`twilio-menu.ts:176` → «Il nome del piatto si cambia dalla dashboard»). Anche «rinomina la **categoria**» riceve la copy del piatto (BASSO). | Azione `rename_item` / `rename_section` con conferma e annulla. **1,5 h** (insieme alle categorie) |
| **Totale** | **143** | **93** | **40** | **34 GRAVE · 6 MEDIO** | | NV 50 |

## Le frasi vere di Manuel: stato su 329bbd4
| Frase (ora) | Oggi | Fonte |
|---|---|---|
| 17:30 «rimuovi completamente quei due piatti» | ROTTO: niente delete. Il cervello non sa cosa fare e chiede «Quale piatto… Riscrivimi». Con «nascondi quei due» al posto di «rimuovi completamente» va bene (gpt-oss) | dal vivo + gpt-oss |
| 17:30 «aggiungi pasta al ragù a 10, pesto a 15, caviale a 150» | ROTTO: categoria chiesta con una sola categoria, frase fissa con «12 euro» | dal vivo + gpt-oss |
| 17:31 «aggiungi un'altra categoria primi… speciali» | ROTTO: capacità mancante più frase fissa | dal vivo + oracolo |
| 17:38 «crea un'altra categoria primi pasti» | MANCA LA FUNZIONE. Il passo dopo crea «Pasta al sugo nei primi pasti» | deterministico |
| 17:39–17:40 «pasta al pesto e lasagna» → «sono due piatti» → «uno a 10 e uno a 20» | ROTTO, GRAVE: piatto unico a 10,01 € | deterministico |
| 13:17 «Bu costa 40» | non verificato con gpt-oss (oracolo: «Non ho capito») | NV |
| 13:18 «Passa il ragù, metti prezzo a 20» | non verificato con gpt-oss (oracolo OK) | NV |
| 13:18 «Elimina il piatto…» | nasconde con la nota (decisione 17/10); il cervello dice «non posso eliminare». Il delete vero manca | deterministico + gpt-oss |
| 13:20 «Inserisce il piatto la parmigiana» | ANCORA ROTTO (nome sporco) | deterministico |
| 13:24 «Cambia il nome del piatto» | ANCORA solo dalla dashboard | deterministico |
| 13:23–13:24 «kenesac» promo / descrizione | ANCORA ROTTO: «Non ho capito», oppure domanda solo su boh | gpt-oss |
| 13:26 «No, ho detto togli boh» | OK (nasconde) | deterministico |
| 13:27 «Quale piatto: Inserisce il piatto la parmigiana, la parmigiana» | OK (prende il nome esatto) | deterministico |
| 13:27–13:28 «anzi no» a catena | non verificato con gpt-oss (oracolo OK) | NV |

## Ipotizzati ma risultati OK (misurati)
- Rimandi al plurale «nascondi quei due piatti» dopo il vocale multiplo e «mettila anche in evidenza» (gpt-oss).
- Il validatore accetta piatti presi dalla cronologia.
- «rimetti boh» dopo «elimina boh»: il cervello lo prende per primo e va bene (gpt-oss).
- «no, intendevo il tiramisù» con ripristino della parmigiana (gpt-oss).
- Nomi composti veri: «pasta e fagioli», «pane e coperto», «spaghetti cacio e pepe», «pasta e fagioli alla napoletana» nei primi.
- Aggiunte multiple con i prezzi nella riserva: «pasta al pesto a 10 e lasagna a 20», «pesto 15 e caviale 150» (il cervello è andato in 429, la riserva ha creato bene).
- Risposte «20», «20 euro», «venti», «10 euro e 50». «togli boh» = nascondi. Doppioni non creati («pasta al ragù a 12» c'è già). Annulla oltre la finestra. «cosa sai fare?».

## Capacità mancanti (nessun modello le può fare: lo schema non le ha)
1. Eliminare un piatto. Oggi nasconde nel deterministico e dice «non posso» nel cervello.
2. Creare una categoria (anche con un piatto dentro).
3. Spostare un piatto tra categorie.
4. Rinominare un piatto.
5. Rinominare una categoria.

## Stima per sistemare tutto
| Gruppo | Ore |
|---|---|
| Bug GRAVI del deterministico: 10,01, «X e Y», bozza che esclude il cervello, verbi nel nome, nome «Creala» o «…nei primi pasti», categoria unica nel validatore | ~6 h |
| Validatore: quantità non sono prezzi; chiarimento più azione nel route; copy senza frasi fisse; `brainNoContext`; una sola copy per «elimina» | ~3,5 h |
| ASR fonetico nel contesto («kenesac», «Bu») | ~2 h |
| Capacità nuove: elimina, crea, sposta e rinomina categorie e piatti (schema del cervello, deterministico, conferma, annulla, test) | ~8–9 h |
| Batterie di 150–200 frasi per ogni bug (regola), più banco V completo con gpt-oss sul piano Developer (~300k token, ~1 h di macchina) | ~3 h |
| **Totale** | **~22–24 h** |

## Rilanciare
```sh
# 0 token: deterministico + oracolo · riserva (Groq giù) · replay delle 12 conversazioni vere
TAKO_EVAL=1 TAKO_EVAL_GROQ=oracle npx vitest run tests/eval/eval-manuel-1017.test.ts
TAKO_EVAL=1 TAKO_EVAL_GROQ=off    npx vitest run tests/eval/eval-manuel-1017.test.ts
TAKO_EVAL=1 TAKO_EVAL_GROQ=replay TAKO_EVAL_OUT=nuovo-replay npx vitest run tests/eval/eval-manuel-1017.test.ts
# gpt-oss vero (piano Developer): tutte le 143
TAKO_EVAL=1 TAKO_EVAL_GROQ=record TAKO_EVAL_GROQ_MAX_TOKENS=<tetto> TAKO_EVAL_GROQ_PACE_MS=5000 TAKO_EVAL_OUT=nuovo-record-completo npx vitest run tests/eval/eval-manuel-1017.test.ts
# traccia del percorso (GATE/BRAIN) per caso: TAKO_BRAIN_DEBUG=<file>
```
Non c'è un'attesa indebolita: un caso che il bot non passa resta com'è. Le scelte di prodotto aperte sono nelle `note` dei casi: «rimuovi» da solo, «levalo proprio», «gnocchi e polpette», «ci metti anche…?».
