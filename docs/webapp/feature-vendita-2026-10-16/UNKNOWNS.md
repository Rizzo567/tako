# Fase 0 — Incognite: feature vendita (menu intero, preset, promo, scarsità)

Data: 16/10/2026. Solo lettura sul codice: nessun sorgente toccato, nessun branch/commit, nessun deploy, nessuna migrazione. Sul DB solo `SELECT` in transazione `READ ONLY`. Scritti solo `UNKNOWNS.md` e `spike/`.
Base del codice: working tree condiviso su `codex/manuel-leads-trials` (HEAD `e9d9c2c`, 12:39). I file `onboarding-chat.ts`, `onboarding-clauses.ts`, `onboarding-menu-merge.ts` e `DigitalMenu.tsx`, `WorkspaceMenuRenderer.tsx`, `public-menu-cache.ts` risultano modificati e non committati da altre sessioni: letti nella versione del working tree.
Prompt di riferimento: `/Users/manuel/Downloads/2026-10-16_prompt_feature_vendita.md` (v2).

## 0. Domande che solo Manuel può decidere (prima quelle che cambiano architettura)

1. **Pubblicazione automatica dei preset: ok a un job programmato lato server?** Serve infrastruttura nuova da autorizzare (abilitare `pg_net` per far chiamare a `pg_cron` la funzione edge, oppure un cron nel Worker Cloudflare gratuito) e un deploy del backend (oggi bloccato). L'alternativa senza job è «il preset del giorno si pubblica alla prima apertura/messaggio del titolare», ma allora a mezzanotte il menu pubblico non cambia e il live non scatta. Raccomando il job.
2. **Preset: ok a una migrazione DB (tabella nuova `menu_presets`, consigliata) o preferisci nessuna migrazione, con i preset in un blocco JSON dentro la bozza?** Il JSON è più semplice da consegnare ma il documento cresce 3–4 volte e un bundle vecchio rimesso online li cancellerebbe al primo salvataggio.
3. **A mezzanotte, se il titolare ha una bozza dalla dashboard non pubblicata: aspettare e avvisare (consigliato, stessa regola del bot) o pubblicare tutto compresa la bozza?** Pubblicare il preset pubblica anche la bozza pendente: non c'è modo di pubblicare solo il preset.
4. **Traduzioni di un menu che cambia ogni giorno: ok a tradurre automaticamente solo inglese, tedesco e arabo (94% degli accessi stranieri negli ultimi 30 giorni, dati reali) e le altre lingue solo dalla dashboard, mostrando l'italiano finché non sono pronte?** Tradurre in tutte e 11 le lingue costa stimati 25–30k token a cambio completo contro una quota Groq free di 200k/giorno condivisa col bot; con 3 lingue ~7k (la decisione sul piano Developer è rimandata).
5. **Locali con PDF caricato a mano (es. Victoria): ok dire al venditore che per questi il PDF resta quello caricato e non segue il menu?** Il codice restituisce quel file al posto di quello generato.
6. **Scadenza promo e «Solo oggi»: ok la regola «valido fino alla fine del giorno indicato, fuso del locale» (promo «fino a domenica» = tutta la domenica)?** Lo assumo se non dici altro.

Heads-up (non è una domanda): il **«piatto del giorno» del bot non sparisce a fine giornata sulla pagina pubblica** (vedi §1, F-9, provato in locale). Va deciso se correggerlo qui o altrove, perché promo e «Solo oggi» non possono basarsi sugli orari (`schedule`).

**Misura 8/10 sui vocali: NON ESEGUITA, DA RIFARE con LLM e whisper reali quando la quota Groq si resetta** (contrordine del coordinatore: oggi nessuna chiamata a Groq). Fatta solo la parte deterministica (§5): con modello ideale simulato il cancello del parser lascia passare 16/27 piatti dettati così com'è, 19/27 normalizzando tutto il testo, **27/27 normalizzando solo la citazione**. Il criterio di stop del prompt resta aperto fino alla misura reale.

---

## 1. Cosa sappiamo (con prova)

**Documento menu e pubblicazione**
- F-1. Il documento vive in `menu_workspaces(draft, published, revision, published_revision)`. `mutateWorkspace(..., publish)` (`lib/menu-workspace-store.ts:39-79`) scrive la bozza e, se `publish`, copia **la bozza intera** in `published` e **riscrive le tabelle** `menus/menu_sections/menu_items/item_variants/menu_item_translations` (disattiva tutti i menu e rende non disponibili tutti i piatti, poi upsert dei correnti, righe 48-73), più una riga in `menu_workspace_versions` (snapshot completo, riga 77).
- F-2. Il menu pubblico legge `published` + l'elenco degli id piatto con `menu_items.available=true` e scarta i piatti non in quell'elenco (`lib/published-menu.ts:20-30`). **Quindi un contenuto che non è stato materializzato in `menu_items` non appare**: una «risoluzione in lettura» di un preset non basta senza riscrivere le tabelle.
- F-3. Misure sul DB reale (SELECT read-only, 16/10): 35 locali attivi, 24 con `published`; `published` medio **85 KB**, max **379 KB**; piatto medio 799 byte (451 senza traduzioni, in media 2 lingue). Menu per locale: 2,0 in media (max 3). Tipi: `main` 23, `drinks` 17, `lunch` 4, `dinner` 4 (4 locali hanno Pranzo+Cena: L'Agora, L'Osterietta, La Bottega del Gusto, PortoFranco, da 22 a 171 piatti per menu). 1 bozza pendente su 35. 2 numeri WhatsApp titolare collegati e attivi.
- F-4. **Fuso orario**: `restaurants.settings.timezone` è presente solo in **2 locali su 35**; gli altri 33 non ce l'hanno. Il bot usa già il ripiego `Europe/Rome` (`twilio-menu.ts:45`, `localDate`). Ogni calcolo «giorno del locale» deve usare lo stesso ripiego.
- F-5. Esistono già i campi `schedule` (menu/categoria/piatto: `enabled`, `timezone`, `windows[weekdays,start,end]`, `from`, `until`) in `menu-workspace-contract.ts`; `menu.type` ∈ `main|lunch|dinner|seasonal|event|drinks`. Non esistono campi per preset, promo o scarsità. Nello schema c'è già `pdfPresets` (preset **del PDF**): attenzione al nome, il codice nuovo non deve chiamarsi `presets`.

**Lettura pubblica, cache, live**
- F-6. Il Worker `takomenu-public` forza `catalogOnly=1` su ogni lettura del menu (`deploy/cloudflare/worker.mjs:21-27`) e risponde `Cache-Control: no-store` (riga 36). Con `catalogOnly` il server chiama `publicWorkspace(..., {ignoreSchedules:true})` (`published-menu.ts:25`): **gli orari `schedule` sono ignorati sulla pagina pubblica** (scelta documentata in `docs/webapp/public-menus/DELIVERY.md`). Nessuna cache CDN, nessuna cache HTTP; resta solo la cache in memoria della scheda (`public-menu-cache.ts`), che riconferma sempre dal server (compito-2 §1).
- F-7. Il **PDF** si genera a richiesta dalla dashboard (`routes/menu-workspace.ts:52`, da `published`, o da `draft` per l'anteprima) e applica `publicWorkspace(workspace)` **con** gli orari (`lib/menu-workspace-pdf.ts:36`). Non esiste un PDF memorizzato, salvo `loadSuppliedMenuPdf` (PDF caricato a mano) che sostituisce quello generato. Il QR punta all'URL del menu digitale.
- F-8. Live (altra sessione): quattro trigger sono **già nel DB di produzione** (verificato: `tako_menu_live_workspace`, `tako_menu_live_items_update`, `tako_menu_live_items_delete`, `tako_menu_live_restaurant`). Scattano quando cambia `menu_workspaces.published/published_revision`, `menu_items.available` o `restaurants.name/settings/active`, e mandano un broadcast `{at}` sul canale `menu-live:<restaurant_id>` (`compito-2/sql/up.sql`). **Il live parte da una scrittura nel DB, non da un orologio.**
- F-9. **Bug esistente, provato in locale** (`spike/special-visibility.mts`, senza rete né DB): un «piatto del giorno» creato il 15/10 con `applyActions` (`schedule from=until=oggi`) il 17/10 è ancora presente con `ignoreSchedules:true` (cioè sul percorso Worker), ed è nascosto solo con gli orari. In produzione nessun locale ha ancora sezioni «Piatto del giorno» o sezioni con `schedule.enabled` (query), quindi non è ancora osservabile, ma lo diventerà al primo uso reale del comando.
- F-10. `pg_cron` **è installato** ed è già usato in produzione (`scripts/serverless/onboarding-lifecycle.sql:31-35`, una funzione SQL ogni minuto). `pg_net` **non** è installato (estensioni presenti: pg_cron, pg_stat_statements, pgcrypto, plpgsql, supabase_vault, uuid-ossp). Il ruolo runtime non legge `cron.job`. Il Worker Cloudflare non ha trigger cron configurati (`deploy/cloudflare/*.jsonc`).

**Traduzioni**
- F-11. Le traduzioni stanno **dentro ogni entità** (`translations[lang]` su menu, categoria, piatto) con `sourceFingerprint` (hash di nome+descrizione). `translateWorkspace` traduce una lingua per volta, solo le voci «mancanti» (o «modificate» se il fingerprint non coincide), **al massimo 200 etichette per chiamata**, e non tocca le voci `approved` (`lib/menu-workspace-translate.ts`). 12 lingue comuni (it + 11, `COMMON_MENU_LANGUAGES`).
- F-12. Se una traduzione manca, il menu pubblico mostra il testo italiano con `nameLang`/`descriptionLang` (`publicMenuProjection`, `published-menu.ts:32-39`), quindi non si blocca nulla. Oggi la pubblicazione da WhatsApp **non lancia nessun job di traduzione** (l'help dice «Le traduzioni si gestiscono dalla dashboard», `twilio-menu-copy.ts:125`); un job incrementale automatico per i locali attivi **non esiste**: il prompt lo dà per esistente, in realtà c'è solo quello dell'onboarding (`translateOnboarding`, `onboarding-chat.ts:182`) e uno script locale una tantum per MenuSmart.

**Bot titolare**
- F-13. Dettaglio nell'Allegato A.

## 2. Sappiamo di non sapere

| # | Cosa manca | Come si chiude |
|---|---|---|
| S1 | Tempo reale di `mutateWorkspace(publish)` su un menu da 171 piatti (L'Agora cena) e su un cambio completo (tutti i piatti nuovi) | Misura su un locale di test con 170 piatti sintetici, solo in locale/QA |
| S2 | Se un job ogni minuto via `pg_cron`+`pg_net` regge il rate limit e i cold start dell'edge (1,7–2 s) | Spike dopo l'autorizzazione di Manuel; fino ad allora solo calcolo a tavolino |
| S3 | Piano Cloudflare/Supabase (il Worker cron è gratuito ma conta nelle richieste) | Chiedere a Manuel / dashboard |
| S4 | **Aperta: misura 8/10 con modello e whisper reali** (vietata oggi). Come si comporta un vocale **reale** (rumore, accento, parlato veloce) rispetto al `say` | Dopo lo spike, 3-5 vocali veri di Manuel o Ale su un numero di prova |
| S5 | ~~Quante lingue servono davvero~~ chiusa: `menu_workspace_events`, ultimi 30 giorni, 22 locali: it 2067, en 516, de 203, ar 180, poi fr 12, zh 9, ja 8, le altre 5-6 ciascuna. en+de+ar = 94% degli accessi stranieri | — |
| S6 | Se i vecchi bundle online (operativa e read-edge) rimetterebbero a zero i campi nuovi (zod toglie le chiavi sconosciute) | Test automatico di andata e ritorno con lo schema precedente; verifica sul bundle online (non sul locale) prima del primo uso |
| S7 | Come il titolare vuole dire «preset» a voce («menu di lunedì», «martedì a pranzo», «il menu del venerdì pesce») | Raccolta di frasi con Ale; per ora si prevedono nomi liberi + giorni |
| S8 | Se il blocco `dashboardPending` (bozza non pubblicata) fa fallire le demo: oggi il bot **non fa nulla** se `revision != published_revision` (`twilio-menu.ts:40`) | Da decidere con la domanda 3, vale anche per «menu intero» |

## 3. Ipotesi da verificare

| # | Ipotesi | Come si verifica | Se è falsa |
|---|---|---|---|
| H1 | **Preset in tabella separata** (`menu_presets`: id, restaurant_id, menu_id, name, weekday null o 0-6, content jsonb con sezioni+piatti+traduzioni, updated_at) è la scelta migliore; il preset **attivo è il menu stesso** (`menu.activePresetId`): attivare = salvare le sezioni correnti nel preset uscente e caricare quelle entranti nel menu | Prototipo su fixture: attivare 100 volte A→B→A, nessuna perdita di id/traduzioni; confronto byte a byte di `published` | Se Manuel nega la migrazione: JSON in bozza (`draft.menus[].presets[]`), da **togliere da `published`** alla pubblicazione (altrimenti ×3-4 su ogni lettura pubblica) |
| H2 | Un solo job idempotente ogni minuto («il preset del giorno è quello pubblicato? se no pubblicalo») regge cambio giorno, ritardi e riavvii | Test con orologio finto: 23:59→00:00, salto di 3 giorni, locale senza fuso, preset del giorno assente/vuoto, due esecuzioni in parallelo | Se `pg_net` non si può abilitare: Worker cron con secret; se nemmeno: ripiego «alla prima interazione» + avviso |
| H3 | Il live a mezzanotte parte da solo perché il job passa da `mutateWorkspace(publish)` (trigger F-8) | Test su QA dopo il via: pubblicare un preset e leggere il broadcast | Se il job usa SQL diretto invece di `mutateWorkspace` nessun trigger scatta e le tabelle divergono: vietato |
| H4 | Promo e «Solo oggi» si risolvono **in lettura** dentro `publicWorkspace()` (unica funzione usata da pagina pubblica, read-edge e PDF) con data e fuso passati come parametro, senza job | Test unitari con orologio finto su pagina e PDF; la scadenza non deve dipendere da `ignoreSchedules` | Se il live deve ridisegnare a mezzanotte: aggiungere la pulizia al job di H2 |
| H5 | Il parser di onboarding (`extractOnboardingMenu`) è riusabile per un locale attivo con un normalizzatore delle **citazioni** dei prezzi detti a voce (file nuovo) | Tetto deterministico 27/27 (§5); misura reale 8/10 da rifare con LLM e whisper reali | Se il normalizzatore non basta: conferma piatto per piatto (alternativa del prompt) |
| H6 | Sostituzione menu = aggiorna per nome (stesso `id`, quindi traduzioni e fingerprint conservati dove nome e descrizione non cambiano), crea i nuovi, **nasconde** (`hidden:true`) gli assenti | Test su fixture con traduzioni: dopo la sostituzione solo i piatti nuovi/modificati risultano da tradurre | Se gli id non si conservano: costo traduzioni ×N (domanda 4) |
| H7 | «Ripristina il menu di prima» si può fare ripristinando **solo il menu toccato** da uno snapshot salvato nella proposta, non l'intero workspace (`/versions/:id/restore` ripristina tutto e cancellerebbe modifiche fatte dopo) | Test: sostituzione, poi una modifica di prezzo su un altro menu, poi ripristino: la modifica sull'altro menu resta | Se serve l'intero workspace: avvisare nel messaggio |

## 4. Punti ciechi

- **B1. «Pubblicare il preset» pubblica anche la bozza pendente.** `mutateWorkspace(publish)` promuove l'intera bozza (riga 43). Il job notturno non può essere «pulito»: o salta se c'è una bozza pendente (domanda 3) o la pubblica senza che il titolare l'abbia vista.
- **B2. Il bot è bloccato da una bozza pendente** (`dashboardPending`). In una demo sembra «rotto». Stesso blocco per «menu intero» e «metti online il menu di lunedì».
- **B3. Bundle vecchi cancellano i campi nuovi.** zod toglie le chiavi sconosciute: se un bundle senza i campi preset/promo/scarsità torna online (è successo più volte oggi: v72→v82, rollback) e il bot o la dashboard salvano, i dati nuovi spariscono in silenzio. Serve ordine di deploy (schema prima, uso dopo), test di andata e ritorno e, per i preset, la tabella separata.
- **B4. Il live è «un solo canale per locale»**: un cambio di preset a mezzanotte rimbalza su tutti i telefoni aperti con `{at}`; coerente, ma non deve contare come visita (flag `prefetch`), già previsto dall'altra sessione.
- **B5. `menu_items.available` vive fuori dal workspace** (`PATCH /items/:id/availability`, `routes/menu.ts:199`): «esaurito» dalla dashboard non passa dal documento. Per «quando il piatto è esaurito l'etichetta Ultime porzioni si rimuove» la regola deve stare in **tre** punti (azione del bot, salvataggio dashboard, e lettura pubblica che già nasconde i non disponibili), non in uno.
- **B6. Pubblicazione da bot oltre le 3 modifiche**: la proposta scade dopo 10 minuti (`tako_whatsapp_proposals.expires_at`), una proposta per telefono (`ON CONFLICT(phone)`). Un menu intero **sostituisce** un'eventuale proposta aperta: va detto.
- **B7. Limite di 2000 caratteri** sul testo in arrivo (`twilio-menu.ts:215`, risposta 400). Un menu scritto lungo con descrizioni può superarlo; il vocale no (limite 30000 dopo la trascrizione). Il riepilogo in uscita si spezza già in blocchi da 1400 (`splitWhatsAppText`).
- **B8. Lingue e id**: i piatti nuovi hanno `id` nuovi; l'ordinamento, le foto e le statistiche per piatto si perdono se il nome cambia anche di una lettera («Tiramisù» → «Tiramisu»). La corrispondenza per nome deve essere tollerante (chiave `onboardingDishKey`).
- **B9. Il parser di onboarding considera «Menu» la categoria quando la parola non c'è nel testo** (`onboarding-planner.ts:135`): le **categorie implicite non vengono mai dedotte**, cadono in una categoria «Menu». Vale per ogni testo senza «Primi:/Secondi:». Va deciso come mostrarlo nel riepilogo (§5).
- **B10. Piatti con due prezzi o senza prezzo** vengono scartati e segnalati (non vanno mai a 0 €): coerente con la regola 7 del prompt, ma il testo dei dubbi è scritto per l'onboarding («invia una foto più nitida»): per un locale attivo va riscritto.
- **B11. Conflitto di nome «preset»** con `pdfPresets` (già in schema, già nella dashboard): scegliere un nome diverso nel codice (`dayPresets`/`menuPresets`) e «Preset» solo nell'interfaccia.
- **B12. Ordini**: prezzi sempre dal DB (`menu_items.price`); il prezzo promo non viene scritto lì. Oggi gli ordini pubblici sono disattivati (`customerOrderingEnabled=false` nel Worker), quindi nessun impatto, ma se si riattivano la promo non si applica.

---

## 5. Spike del parser (domanda 3) — solo parte deterministica

**Contrordine**: nessuna chiamata a Groq (né modello né whisper). `spike/run-spike.mts` (5 testi + 3 vocali con `say`+whisper+modello, pronto con cassa dei token) è **disabilitato** (rete bloccata salvo `SPIKE_ALLOW_NETWORK=1`) e **mai eseguito**; audio generati con `say` in `spike/audio/` (nessuna rete). `spike/cases.mts` ha i 5 testi e le verità attese.

**Cosa è stato misurato (nessuna rete, `spike/*.mts`)**
1. `price-gate.ts`: 30 forme di prezzo scritte come le scrive whisper passano dal cancello `verifyOnboardingMenuRow`: **18/30 accettate**. Rifiutate: «dieci e cinquanta», «10 e 50», «10 euro e 50», «10 euro e cinquanta», «dieci»/«dodici» senza «euro», «dieci e mezzo», «ventidue e cinquanta», «22 e 50».
2. `deterministic.mts`: 3 trascrizioni «stile whisper» scritte a mano (minuscole, senza punteggiatura, prezzi in lettere/misti), 27 piatti. Il **modello è simulato ideale** (nome/prezzo/evidenza esatti), quindi i numeri sono il **tetto** della pipeline, non una stima del modello reale:

| Variante | Piatti accettati | per 10 | Vocale 1 (euro in lettere) | Vocale 2 (senza «euro», «e cinquanta») | Vocale 3 (cifre miste, categorie implicite) |
|---|---|---|---|---|---|
| Parser com'è | 16/27 | 5,9 | 10/10 | **0/9** | 6/8 |
| Normalizza tutto il testo prima del parser | 19/27 | 7,0 | 10/10 | 1/9 | 8/8 |
| **Normalizza solo la citazione del modello** e la riscrive nel testo prima del controllo | **27/27** | **10** | 10/10 | 9/9 | 8/8 |

3. Perché la seconda variante fallisce: senza punteggiatura non ci sono confini di frase, quindi «bruschetta cinque tagliere dodici e cinquanta» non si segmenta con regole. Il lavoro di segmentare spetta al modello; poi il server converte in cifre solo la **citazione** che il modello ha delimitato (`bruschetta cinque` → `bruschetta 5 €`) e la riscrive nel testo prima di `verifyOnboardingMenuRow`. Il controllo «il prezzo è letterale nella fonte» resta intatto (il testo mostrato al titolare è quello normalizzato).
4. `spoken-prices.mts`: normalizzatore prototipo (29/30 sulle 30 forme, «Quattro formaggi» a inizio frase non viene toccato). Va ancora scritto con test; vive in un file nuovo.
5. Categorie: tutte le 22 categorie dette esplicitamente sono mantenute; le implicite finiscono in «Menu» (B9). Il riepilogo deve dirlo («senza categoria») e chiedere dove metterle, oppure l'estrattore va istruito a inferirle (cambia il controllo di grounding: decisione di prodotto da prendere dopo la misura reale).

**Limiti dichiarati**: modello simulato ideale; trascrizioni inventate da me; voce `say` non è parlato reale. **Da rifare con LLM e whisper reali** (budget ~40k token, dopo il reset): i 5 testi, 3 vocali, e la misura dei piatti giusti su 10 (nome+prezzo+categoria) contro la soglia 8/10.

## Allegato A — Inventario del bot titolare (`twilio-menu-*`) e punto di innesto di «menu intero»

**Flusso** (`routes/twilio-menu.ts`): webhook `POST /whatsapp/twilio` (riga 186, firma Twilio) → se il numero è collegato, transazione con lock per telefono, cache per `MessageSid`, `menuTurn` (righe 36-75, deterministico) → se serve il modello risponde `{llm:true}` e parte un job in background (`runJob`/`jobMessage`/`resolveTurn`, righe 102-152, timeout 90 s) che chiama Groq `gpt-oss-120b` (riserva 20b, `reasoning_effort:'low'`) e rientra in `menuTurn` con un `planned`. Vocali: scaricati da Twilio e trascritti con `whisper-large-v3-turbo` (`transcribeAudio`, prompt «CONFERMA, ANNULLA, prezzo, euro…»), poi come testo (riga 142-149).

**Azioni** (`MenuAction`, `twilio-menu-ai.ts:8`): `price`, `available`, `hidden`, `featured`, `image`, `description`, `tag` (solo `vegetariano, vegano, piccante, surgelato, biologico, locale`), `create` (in categoria **esistente**), `special` (piatto del giorno con `schedule` = oggi). Letture: piatti, esauriti, nascosti. Altro: `OK/CONFERMA/ANNULLA`, scelta tra omonimi, foto (proposta + `CONFERMA`), «cosa sai fare» (capabilities). **Non fa**: allergeni, eliminare, rinominare, spostare, categorie, grafica, traduzioni, modifiche in blocco («bulk», `twilio-menu-copy.ts:119-125`).

**Regole**: fino a 3 azioni si applicano e si pubblicano subito (`bozza` + `pubblicazione` nella stessa transazione, righe 73-74); oltre 3 → proposta `{kind:'batch', requiresTypedOk:true}` in `tako_whatsapp_proposals` (jsonb, un record per telefono, 10 minuti) e serve **OK scritto** (un vocale non basta, riga 43). Bloccato se `revision != published_revision` (riga 40) o se non c'è un pubblicato (riga 40). Nessuno snapshot dedicato: c'è la riga di `menu_workspace_versions` di ogni `mutateWorkspace`.

**Dove «menu intero» si innesta** (nessuna modifica fatta, solo piano):
1. **Riconoscimento**, dentro `menuTurn`, **prima** del ramo riga 50 (virgole/«;»/«e» → `{llm:true}`), perché un menu intero oggi finirebbe nel pianificatore di modifiche singole. Classificatore deterministico (≥ N clausole con prezzo, intestazioni «Primi:», «menu di oggi/lunedì») con eventuale conferma LLM solo nel dubbio. Funzioni utili già pronte: `onboardingPriceClauses`, `onboardingClauses`.
2. **Estrazione** nel job (come `resolveTurn`): `extractOnboardingMenu` → righe `{section,name,price,description}` + dubbi.
3. **Stato**: nuovo tipo di proposta `{kind:'fullmenu', stage:'where'|'confirm', destinationMenuId, rows, issues, snapshot}` nello stesso record `tako_whatsapp_proposals` (nessuna migrazione, la colonna è jsonb). Le correzioni («la carbonara è 11») modificano le righe della proposta con la ricerca piatti già esistente (`findDishes`/`dishMatches`).
4. **Applicazione**: nuova funzione pura `replaceMenuContent(workspace, menuId, rows)` in un **file nuovo** (non dentro `onboarding-menu-merge.ts`), poi `mutateWorkspace` bozza+pubblica come righe 73-74, con snapshot del solo menu toccato dentro la proposta per «ripristina».
5. **Testi**: `twilio-menu-copy.ts` (esempi di benvenuto, `bulk` da «non posso» a «posso»), `twilio-menu-prompt.ts` se serve un'intenzione `fullmenu` per il modello.

## Allegato B — Riuso del parser di onboarding per un locale già attivo

- **Si riusa**: `extractOnboardingMenu(text, key, fetcher)` (`onboarding-planner.ts:140`) è **pura** (testo → righe+dubbi, nessun DB, nessuna sessione): chiama Groq (`gpt-oss-120b` poi `20b`, JSON, senza `reasoning_effort:'low'`), accetta una riga solo se nome e prezzo sono **citati alla lettera** nel testo (`verifyOnboardingMenuRow`) e segnala il resto. Utili anche `onboardingDishKey`/`sameOnboardingDish` (`onboarding-dish-name.ts`) e `onboardingDisplayCase`.
- **Non si riusa**: `mergeOnboardingRows` (`onboarding-menu-merge.ts`) è una *fusione* conversazionale (non nasconde mai nulla, fa domande su omonimi e «mantieni/cambia», crea menu nuovi): la sostituzione richiesta dal prompt è un'altra operazione. Nemmeno `handleOnboardingChat` (sessioni di bozza di un nuovo locale).
- **Cosa non va per un locale attivo** (misurato in `spike/price-gate.ts`, 30 forme di prezzo, nessuna chiamata di rete): il cancello rifiuta **12 forme su 30**: «dieci e cinquanta», «10 e 50», «10 euro e 50», «dieci euro e cinquanta» (con digit+euro), «dieci»/«dodici» senza «euro», «dieci e mezzo», «ventidue e cinquanta». Accetta «dieci euro e cinquanta», «10,50», «10.50», «dodici euro». In più, la categoria che non compare letteralmente nel testo diventa «Menu» (B9).
- **Prototipo già provato** (`spike/spoken-prices.mts`, senza rete): lo stesso cancello accetta **18/30** forme senza normalizzatore e **29/30** con il pre-normalizzatore (resta fuori solo «dieci cinquanta», senza «e»; «Quattro formaggi» a inizio frase non viene toccato).
- **Piano** (corretto dopo §5): un normalizzatore in un file nuovo (es. `lib/menu-spoken-prices.ts`) converte in cifre la **citazione** di ogni riga restituita dal modello e la riscrive nel testo sorgente prima di `verifyOnboardingMenuRow` (normalizzare tutto il testo prima non basta senza punteggiatura); in origine pensato per il testo intero («dieci e cinquanta» → «10,50 €» solo dopo un nome di piatto, non a inizio frase, per non rompere «Quattro formaggi»), e quel testo normalizzato è anche quello che il bot mostra nel riepilogo. Così non si tocca `onboarding-clauses.ts`.
- **Congelare** con l'agente WhatsApp le firme di: `extractOnboardingMenu`, `verifyOnboardingMenuRow`, `onboardingDishKey`, `sameOnboardingDish`, `onboardingDisplayCase`. Oggi `onboarding-planner.ts` e `onboarding-dish-name.ts` non risultano modificati; `onboarding-clauses.ts` sì (1 riga).

## Allegato C — Modello dati: promo e scarsità

**Campi esistenti** (item): `tags` (stringhe libere; solo 8 «caratteristiche» note e rese come cerchietti con simbolo/numero, non come etichetta discreta), `featured`, `priceDisplay` (testo libero che **sostituisce** il prezzo in pagina e PDF, usato da 52 piatti reali), `schedule` (ignorato in pagina, F-6), `available`, `hidden`. Nessuno è adatto: `priceDisplay` non permette barrato+promo e scadenza, `tags` non ha scadenza.

**Proposta**: due campi additivi sull'item, con default nullo:
- `promo: { price: number > 0 e < price, until: 'YYYY-MM-DD' | null } | null`
- `scarcity: 'last' | 'today' | null` più, per «Solo oggi», la data del giorno in cui è stato impostato (`scarcityDate`), così scade a fine giornata nel fuso del locale senza job.

**Risoluzione**: in `publicWorkspace(workspace, now, {…, timezone})` (`menu-workspace-schedule.ts`) — unico punto usato da pagina pubblica, read-edge e PDF — i valori scaduti vengono azzerati, **indipendentemente da `ignoreSchedules`**. Il fuso arriva da `restaurants.settings.timezone` con ripiego `Europe/Rome` (F-4); la query `readPublishedCatalog` ha già `r.settings`.

**Impatto** (elenco sorgenti → Allegato D): pagina pubblica (prezzo barrato + promo + «Promo», etichetta discreta, senza animazioni), PDF (`pdfItemPrice` oggi restituisce una sola stringa), proiezione (`publicMenuProjection` ha una lista esplicita di campi, `published-menu.ts:48-56`) e tipo `PublicItem` (`packages/types/src/index.ts:117`), azioni e testi del bot (`MenuAction`, `describeAction`, `applyActions`, prompt, `twilio-menu-nlu.ts`), scheda piatto in dashboard. «Esaurito» → scarsità `last` va azzerata (B5). Nei preset i campi viaggiano dentro il contenuto del preset; «Solo oggi» dentro un preset usa la data in cui il preset va online (si imposta al momento dell'attivazione).
**Rischio**: B3 (bundle vecchi) e disallineamento con le traduzioni: l'etichetta «Promo»/«Ultime porzioni»/«Solo oggi» va nel catalogo `foodTranslations` come le altre, così è tradotta in 12 lingue.

## Allegato D — File toccati da ogni feature e conflitti previsti

Sessioni parallele (stato del working tree, 16/10): **WhatsApp** (`onboarding-*.ts`, `tests/onboarding-*.test.ts`, deploy edge operativa), **live** (`DigitalMenu.tsx`, `WorkspaceMenuRenderer.tsx`, `public-menu-cache.ts`, nuovo `public-menu-live.ts`, trigger DB, `13-menu-live-sync.js`, worker/read-edge), **lead** (`agency-leads*`, `twilio-menu-alerts.ts`, `routes/agency*`).

| File | F1 menu intero | F2 preset | F3 promo | F4 scarsità | Rischio |
|---|---|---|---|---|---|
| `routes/twilio-menu.ts` | sì (menuTurn, proposta `fullmenu`) | sì (comandi chat) | sì | sì | medio: file caldo, deployato da altre sessioni; modifiche piccole e localizzate |
| `lib/twilio-menu-ai.ts` | sì (tipi, descrizione) | sì | sì (azione) | sì (azione) | medio |
| `lib/twilio-menu-copy.ts` / `-nlu.ts` / `-prompt.ts` | sì (testi, help, benvenuto) | sì | sì | sì | basso (la sessione lead tocca solo `-alerts`) |
| **nuovi** `lib/menu-replace.ts`, `lib/menu-spoken-prices.ts`, `lib/menu-presets.ts`, `lib/menu-promo.ts` | sì | sì | sì | sì | nullo |
| `lib/onboarding-planner.ts`, `-dish-name.ts` | solo import | — | — | — | basso: congelare le firme (Allegato B) |
| `lib/onboarding-menu-merge.ts`, `-clauses.ts`, `-chat.ts` | **non toccare** | — | — | — | alto: modificati adesso dall'agente WhatsApp |
| `lib/menu-workspace-contract.ts` | — | sì (`activePresetId`, modalità) | sì (campi item) | sì | medio: schema condiviso, dipende dall'ordine di deploy (B3) |
| `lib/menu-workspace-store.ts` (`mutateWorkspace`) | forse (snapshot) | sì (attivazione) | — | — | **alto**: core della pubblicazione, usato da bot e dashboard; evitare modifiche, aggiungere funzioni accanto |
| `lib/menu-workspace-schedule.ts` (`publicWorkspace`) | — | — | sì | sì | medio: usato da pagina, read-edge e PDF |
| `lib/published-menu.ts`, `packages/types/src/index.ts` | — | — | sì | sì | medio: tipo pubblico condiviso con la sessione live |
| `lib/menu-workspace-pdf.ts` | — | — | sì | sì | medio (modificato in giornata da altra sessione, ora committato) |
| `apps/web/src/components/WorkspaceMenuRenderer.tsx` | — | — | sì | sì | **alto**: modificato adesso dalla sessione live (non committato) |
| `apps/web/src/components/DigitalMenu.tsx`, `lib/public-menu-cache.ts` | — | — | — | — | non toccare |
| `apps/dashboard/public/staff/src/13-menu-workspace.js` (+ CSS) | riepilogo? (no) | sì (barra `.mw-studio-toolbar`, riga 162; selettore menu) | sì (scheda piatto) | sì | medio: file da 128 KB a una sola funzione; preferire un modulo nuovo `13-menu-presets.js` e un solo punto di aggancio |
| `13-menu-live-sync.js` | — | — | — | — | non toccare |
| `routes/menu-workspace.ts` | — | sì (CRUD preset, pubblica preset) | — | — | medio |
| scheduler (SQL o Worker + route interna) | — | sì | — | — | richiede deploy e autorizzazione (domanda 1) |
| migrazione SQL + grant ruolo runtime (`runtime-role-grants.json`) | — | sì se tabella | — | — | richiede via (domanda 2) |
| `tests/…` | nuovi file | nuovi file | nuovi file | nuovi file | basso; non toccare `onboarding-*.test.ts` |

**Regola di convivenza proposta**: file nuovi per ogni logica; nei file caldi solo agganci di poche righe; nessun deploy dalla copia locale (blocco 16/10, base = bundle online); `renderer`/`DigitalMenu`/`public-menu-cache` solo dopo che la sessione live ha committato.

## Allegato E — Domande 1, 2, 4 in dettaglio

**Q1. Dove salvare i preset.** Requisiti del prompt: una sola fonte per pagina, PDF, traduzioni; pubblicare copia nel pubblicato; si appoggia a bozza/pubblicato.
- *In `menus[].presets[]`* (nel documento): nessuna migrazione, riusa revisione/conflitti/versioni, ma ×3–4 sul peso (F-3: 175 piatti di preset ≈ 140–300 KB in più su 85 KB medi), e **va tolto da `published`** o ogni lettura pubblica (limite 100 richieste/min) legge fino a 3 MB. Bundle vecchi li cancellano (B3).
- *Tabella `menu_presets`* (consigliata): il documento non cresce, il bot e il job leggono solo ciò che serve, un bundle vecchio non può cancellarli. Costo: migrazione + grant + CRUD + gestione conflitti propria.
- *Il preset attivo è il menu*: il contenuto «online» vive solo in `menu.sections` (come oggi); i preset sono varianti salvate. «Modifica il preset di oggi → cambia il pubblico» diventa gratis (si modifica il menu), e non c'è una seconda copia da tenere allineata.

**Q2. Cron o lettura.**
- *Lettura*: non basta (F-2 materializzazione in `menu_items`; F-8 nessun live a mezzanotte; ogni lettore — pagina, read-edge, PDF, traduzioni, bot, dashboard — dovrebbe applicare lo stesso risolutore, quindi di fatto più fonti).
- *Job*: unico caso coerente: usa `mutateWorkspace(publish)` quindi tabelle, versioni, PDF e live (F-8) restano allineati. Cache: nessuna cache lato Worker/CDN (F-6), quindi nessuna invalidazione. Idempotente ogni minuto (come `takomenu-onboarding-expiry`, F-10): auto-ripara ritardi e riavvii. Salta e avvisa se bozza pendente (B1) o se il giorno non ha un preset.
- *Promo e scarsità*: lettura (H4), niente job.

**Q4. Traduzioni e PDF quando cambia tutto il menu.**
- *PDF*: generato a richiesta da `published` (F-7): segue il menu senza lavoro, salvo PDF caricato a mano (domanda 5). Il QR non cambia. Le immagini restano agganciate all'id del piatto.
- *Traduzioni*: i piatti nuovi non hanno traduzioni: il pubblico mostra l'italiano (F-12), nulla si blocca. Per ogni piatto con **stesso nome e stessa descrizione** si conserva l'`id` e quindi la traduzione (H6); per i piatti ricorrenti nei preset di giorni diversi la traduzione viaggia dentro il contenuto del preset. Un job incrementale per i locali attivi non esiste (F-12): va costruito (una lingua per volta, 200 etichette, `sourceFingerprint`) e va dimensionato sulla quota Groq free (domanda 4).
- *Stima costo* (da confermare con una misura): menu da 25 piatti, nome+descrizione, una chiamata per lingua ≈ 2,5k token. In 11 lingue ≈ 27k token per cambio completo: con 200k token/giorno condivisi col bot bastano ~7 cambi completi al giorno su tutta la piattaforma. Solo en+de+ar (94% degli accessi stranieri, S5) ≈ 7,5k token: ~26 cambi al giorno.
