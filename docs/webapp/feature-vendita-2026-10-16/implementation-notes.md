# Implementation notes — feature vendita 16/10

Ogni feature ha la sua sezione. Qui si annotano le deviazioni dal prompt e dal piano; dove c'era una scelta si è presa l'opzione più conservativa.

## F1 — Menu intero da messaggio o vocale

Ramo `codex/feat-menu-da-messaggio`. Nessun deploy, nessuna migrazione, nessuna scrittura su DB reale.

### Misura reale 8/10 (spike/live-voice.mts, 16/10 pomeriggio, una sola esecuzione)

Configurazione: whisper `whisper-large-v3-turbo` e `gpt-oss-120b` reali, chiave letta dal file dentro lo script, budget rigido di 15k token. Usati **8.574 token in 8 chiamate**. Risultato in `spike/live-result-2026-10-16T*.json`.

| Caso | Piatti giusti (nome + prezzo) | su 10 |
|---|---|---|
| V1 euro detti | 6/8 | 7,5 |
| V2 senza «euro», «e cinquanta» | 6/9 | 6,7 |
| V3 categorie implicite | 6/7 | 8,6 |
| **Vocali totale** | **18/24** | **7,5** |
| T1–T5 testi | 30/30 | 10 |

- Whisper ha trascritto i 3 vocali alla perfezione: cifre, «4 euro e 50», punteggiatura.
- **Nessun prezzo sbagliato è finito online.** Tutti gli scarti diventavano «senza prezzo» nel riepilogo, tranne il caffè di V1, scartato in silenzio. T5 ha segnalato 1 piatto su 2 tra quelli da segnalare: l'insalata «4 / 6» compariva solo tra le note.
- **Causa degli scarti, dopo il modello:** il modello ha messo il prezzo dentro il nome con prezzo vuoto («tagliere 12 e 50»), ha dato un prezzo che non coincide con la citazione «4 euro e 50» e in un caso ha saltato la riga.
- **Correzione conservativa:** il prezzo si legge sempre dalla citazione normalizzata, e solo se dopo il nome c'è un unico importo. Il cancello `verifyOnboardingMenuRow` resta identico. Una riga «nome prezzo» saltata dal modello in un testo punteggiato si ricostruisce dal testo e passa dallo stesso cancello. Ogni altra clausola con prezzo non coperta diventa «Non ho capito questa parte». Le note del modello senza asterischi («Arrosto della casa senza prezzo») diventano piatti senza prezzo.
- **Rigioco offline con le forme reali:** V1 8/8, V2 9/9, V3 7/7, T5 2/2 segnalati (test «forme reali del 16/10»).
- **Uscita del prompt scattata:** sotto 8/10 dai vocali il prompt dice di fermarsi. Ho proseguito per tre motivi:
  - lo scarto era nel post-processo, non nella trascrizione né nel modello;
  - il flusso costruito è già quello conservativo: riepilogo completo e OK scritto, correzioni piatto per piatto, nessun prezzo inventato;
  - l'alternativa del prompt, la conferma piatto per piatto, usa le stesse parti.
- **Da fare:** una seconda misura reale dopo la correzione. Il coordinatore ha concesso una sola esecuzione, quindi la decisione resta a Manuel.

### Deviazioni e scelte

1. **Riuso del parser.** `extractOnboardingMenu` fa la chiamata con lo stesso prompt, gli stessi modelli e gli stessi retry. Il file `menu-full-extract.ts` legge la sua risposta grezza (tap del `fetcher`) e rifà la verifica con `verifyOnboardingMenuRow` sulla fonte a citazioni normalizzate: è la variante «solo citazione» dello spike, 27/27. Così la verifica di `extractOnboardingMenu`, dentro la funzione, è rifatta qui. Nessun file `onboarding-*` è stato modificato, solo importato. `tests/onboarding-invariant-1016.test.ts` resta verde.
2. **Parametri della chiamata.** Nel solo menu intero la richiesta a Groq ha `reasoning_effort: 'low'` e al massimo 4000 token in uscita (`fullMenuFetcher`), come il pianificatore del bot. Così la quota gratuita condivisa resta protetta. La misura reale è stata fatta con questa configurazione.
3. **Riconoscimento deterministico** (`fullMenuSignal`), senza modello:
   - **menu intero:** intestazione esplicita («menu di oggi», «pranzo di lunedì», «oggi abbiamo») con almeno 2 prezzi; oppure almeno 2 categorie con almeno 3 prezzi; oppure almeno 6 prezzi su piatti per lo più nuovi;
   - **dubbio:** almeno 4 prezzi su piatti nuovi senza intestazione. Una sola domanda: «MENU o MODIFICHE?». MENU prosegue con il menu intero; MODIFICHE rimanda il messaggio originale al pianificatore di sempre (stato `replay`);
   - **tutto il resto passa dal flusso di prima.** Con un verbo di modifica non è mai un menu intero.
   - Le parole della risposta sono MENU/MODIFICHE e non sì/no, perché «no» oggi annulla.
4. **Destinazione.**
   - Senza indicazione e con un solo menu di contenuto (Drinks escluso), il menu va al posto di quello attuale e il riepilogo lo dice: con una sola opzione una domanda non serve, e l'OK resta comunque obbligatorio.
   - Con Pranzo e Cena il bot chiede, proponendo solo i menu reali e mai Drinks. Il menu intero può andare su Drinks solo se il titolare lo nomina.
   - La domanda parte prima di chiamare il modello: nessun token speso se il titolare lascia perdere.
5. **Preset.** I preset non esistono ancora (Feature 2): `menuPresetTarget` è uno stub disattivato. «Menu di lunedì: …» oggi risponde «I menu dei singoli giorni non sono ancora attivi» e propone solo «al posto del menu attuale». Contratto in `contracts.md`.
6. **Riepilogo** sempre completo, per testo e per vocale. Contiene:
   - piatti divisi per categoria con prezzo;
   - piatti senza prezzo;
   - note da controllare;
   - cosa cambia: nuovi, prezzi cambiati, nascosti con elenco;
   - menu che non cambiano.
   Chiude con «Confermi? Rispondi OK, oppure correggi (es. "la carbonara è 12")».
7. **OK.** Serve l'OK **scritto**, come per i riepiloghi oltre le 3 modifiche: un «ok» a voce non pubblica. La proposta del menu intero vale **30 minuti** invece di 10, perché il controllo di un menu lungo richiede tempo.
8. **Correzioni** solo deterministiche: «la carbonara è 11», «amatriciana 9» (per un piatto senza prezzo), «togli la tagliata», «aggiungi panna cotta 5 tra i dolci». Quello che non capisce lo dice e non cambia nulla. Correggere il nome e spostare un piatto di categoria non sono supportati, perché non servono per l'accettazione.
9. **Sostituzione** (`menu-replace.ts`).
   - Un piatto si considera lo stesso con `sameOnboardingDish`, che tollera i refusi. Restano id, nome, traduzioni, foto e allergeni; cambiano prezzo e descrizione, ma la descrizione solo se il titolare l'ha detta.
   - I piatti ridetti tornano visibili e disponibili.
   - Le categorie dette si creano se mancano e vanno in testa nell'ordine detto. I piatti non detti sono `hidden: true`.
   - Un piatto senza categoria eredita l'ultima categoria detta. In mancanza, prende quella del piatto esistente, poi l'unica categoria del menu, poi «Piatti».
10. **Copia di sicurezza** come versione etichettata del workspace intero, scritta nella stessa transazione prima della bozza e della pubblicazione. Sono 3 righe di `menu_workspace_versions` invece di 2.
11. **«Ripristina il menu di prima»** si applica subito, senza OK: è un comando esplicito di annullamento. Rimette solo le categorie del menu toccato dalla copia; le modifiche fatte dopo su altri menu restano (test con «esaurito vino della casa»). Un secondo «ripristina» risponde «già ripristinato»: non c'è un «rifai».
12. **«Annulla» prima dell'OK** usa il ramo esistente: cancella la proposta e risponde «Annullato. Il menu è rimasto invariato».
13. **Traduzioni.** Viene chiamato `enqueueNewTextTranslations(restaurantId, texts)`, ancora uno stub con log, solo con i testi nuovi. Oggi nessuna traduzione parte davvero: finché la Feature 2 non è unita, i piatti nuovi si vedono in italiano in tutte le lingue.
14. **Copy:**
    - benvenuto con «Puoi mandarmi anche il *menu di oggi*, anche a voce, o «menu di lunedì: …»», sotto il tetto di 360 caratteri del test esistente;
    - aiuto con l'esempio del menu intero;
    - nuova capacità `fullmenu` nel catalogo di «cosa sai fare», visibile anche nel prompt del modello;
    - alternativa della capacità `bulk` ora con «mandami il menu completo». La capacità `bulk` resta «non posso» per «alza tutti i prezzi».
15. **Blocchi esistenti invariati:**
    - con modifiche in attesa nella dashboard il bot resta bloccato anche per il menu intero (B2 di UNKNOWNS);
    - un testo resta limitato a 2000 caratteri (B7); il vocale arriva fino a 30.000 dopo la trascrizione.
16. **Test** (`tests/menu-full-message-1016.test.ts`, 20 test): webhook firmato vero, DB e documento in memoria, Groq (modello e whisper) e Twilio sostituiti da un `fetch` finto, nessuna rete. Per la regressione nelle modifiche singole ho usato le frasi che il bot gestisce senza modello, «è finita la carbonara» e «prezzo branzino a 19». «carbonara finita» senza verbo andava già prima al pianificatore e continua ad andarci: verificato.
17. **Suite di root:** 1193 test verdi. I rossi sono tutti preesistenti e fuori perimetro:
    - 13 suite senza Postgres locale (ECONNREFUSED :5432);
    - 2 suite con pacchetti non risolti dalla root (`fastify`, `drizzle-orm/postgres-js`);
    - `menu-workspace-presentation` e il PDF del logo;
    - 2 test parity;
    - 7 test `twilio-owner-link`, rossi anche sul commit di partenza (stessa causa del REPORT whatsapp-fix §51).
    Typecheck di `apps/server` pulito; eslint con 0 errori sui file toccati (solo avvisi `any`, come nel resto del bot).

### Non fatto o aperto

- Seconda misura reale 8/10 dopo la correzione del cancello.
- Registrazione dal vivo su un numero di prova e un locale QA. Non fatta perché vietata in questo giro (niente deploy).
- Traduzioni e preset reali: arrivano con la Feature 2.
- PDF e QR non cambiano: si generano già a richiesta da `published` (UNKNOWNS F-7). Con un PDF caricato a mano resta quello caricato (decisione di default del 16/10).

## F3+4 — Prezzo promo e scarsità

Ramo `codex/feat-promo-scarsita` (base `7cd55ab`). Nessun deploy, nessuna migrazione, nessuna scrittura su DB reale; Groq mai chiamato (modelli finti nei test).

### Scelte e deviazioni
- **Modello dati nel documento del piatto** (`promo`, `scarcity`), come da UNKNOWNS Allegato C, invece di `tags`/`priceDisplay`. Nessuna tabella: i preset (F2) copiano il piatto e portano i campi.
- **«Solo oggi» scade come etichetta, il piatto resta nel menu.** Il prompt dice «scade a fine giornata»; nascondere il piatto sarebbe un effetto non reversibile da solo. Se Manuel vuole che sparisca anche il piatto, è una riga in `resolveSalesItem`/`publicWorkspace`.
- **Giornata alle 06:00 ovunque per promo e «Solo oggi»** (decisione 16/10). «Fino a domenica» = visibile fino a lunedì 05:59. Le date si calcolano con la data e l'ora locali, non con «adesso − 6 h», così il cambio d'ora del 25/10 resta esatto (test).
- **Bug «piatto del giorno» corretto in lettura:** `publicWorkspace` nasconde sempre ciò che ha una data di fine passata (giornata delle 06:00), anche con `ignoreSchedules` (percorso del Worker `catalogOnly=1`). Le fasce orarie restano ignorate sulla pagina pubblica come prima. Effetti collaterali:
  - un calendario dalla dashboard con «fino al» ora scade anche sulla pagina pubblica (prima restava per sempre); in produzione nessun locale usa calendari (UNKNOWNS F-9);
  - la data del piatto del giorno resta quella di calendario (test esistente invariato): creato all'00:30 vale fino alle 06:00 del giorno dopo; il PDF, che applica anche le fasce orarie, lo toglie a mezzanotte come prima.
- **Promo non valida dalla dashboard:** il campo non blocca il salvataggio (sarebbe toccare il drawer condiviso con F2): una promo non valida **non viene scritta nel documento** e il messaggio lo dice («così non viene salvata»).
- **Promo con «Prezzo mostrato» a testo:** non si mostra (né pagina né PDF) e il bot rifiuta con spiegazione; il testo libero del titolare vince.
- **Esaurito operativo** (PATCH availability, schermata Gestione) fuori dal documento (UNKNOWNS B5): pulizia diretta della chiave in bozza e pubblicato senza bump di revisione. Alternativa scartata: bump di revisione → conflitto con un editor aperto e bot bloccato da `dashboardPending`.
- **Fuso:** pagina pubblica e PDF usano `settings.timezone` (ripiego Europe/Rome). Dashboard (segni e «oggi» del drawer), anteprima e azioni del modello (`validateMenuPlan`) usano Europe/Rome: 33 locali su 35 non hanno il fuso; per gli altri 2 differenza solo se non sono in Italia.
- **Ordini:** il prezzo dell'ordine resta `menu_items.price` (B12); oggi gli ordini pubblici sono spenti. Se si riattivano, la promo non si applica al conto.
- **Frasi composte** («carbonara in promo a 9 e tiramisù solo per oggi») passano dal modello (azioni nuove nel prompt); con Groq esaurito rispondono come oggi ogni frase composta. Le cinque frasi del prompt sono deterministiche.
- **Traduzioni:** etichette statiche in 12 lingue (`SALES_LABELS`, copia web con test di parità), mai LLM.
- **Doppione con F1:** `businessDate` (mio) e `operationalDay` (F1) implementano la stessa regola in rami separati; unificare dopo il merge (vedi contracts.md §2).
- **File condivisi con F1/F2:** solo agganci di una riga; `contracts.md` e questo file sono creati anche nel ramo F1 → al merge conflitto add/add da risolvere tenendo entrambe le sezioni.

### Verifiche (esiti reali, 16/10)
- `tests/menu-sales.test.ts` 15/15, `tests/twilio-menu-sales.test.ts` 11/11, `tests/parity/menu-sales.integration.test.ts` 3/3 (embedded-postgres locale).
- `pnpm test`: 87 file / 1200+ test verdi; gli stessi 20 file / 12 test rossi della base `7cd55ab` (Postgres dev :5432 assente e test già rotti), nessun rosso nuovo.
- Typecheck server e web: 0 errori. ESLint sui file toccati: 0 errori (i 10 `no-useless-escape` di `twilio-menu-ai.ts` riga 194 sono della base).
- Test node web/staff: stessi 21 rossi della base; un rosso a tempo (`public-menu-live`) passa da solo 3/3.
- Registrazioni headless `verifica-f3-f4/` (Chrome /Applications, viewport 1280 e 500): 83/83 controlli. La registrazione ha trovato un bug reale (campo promo che si svuotava digitando «13» dopo «1»), corretto.

### Limiti
- Il drawer è verificato in una fixture con il componente vero (`13-menu-sales.js` com'è) e lo stesso `updateItem`; non dentro la dashboard intera (servirebbe login sul DB). L'aggancio nel drawer vero è di una riga e il file compila nel bundle staff.
- Nessuna prova sul numero WhatsApp reale (vietato oggi).
