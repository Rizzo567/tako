# Revisione tecnica Tako — sintesi finale
**Data:** 2026-08-25 · **Repo:** `/Users/manuel/Projects/Tako` (branch `feat/owner-app`, con file non committati) · **Corsie ricevute:** iOS, macOS, server, DB (parziale)
**Nota di onestà a monte:** la corsia **web/PWA** non ha consegnato dati e la corsia **DB** si è interrotta a metà del secondo finding. Il semaforo per quelle due voci è dichiarato *non misurato*, non "verde".

---

## 1. Verdetto in 5 righe

Il nucleo che conta — transazioni sui conti, lock per tavolo, ricalcolo del totale dagli ordini, perimetro tenant — è **da prodotto vero**, e i tre P1 sui soldi della review del 15/07 risultano davvero chiusi nel codice.
Sopra quel nucleo ci sono **un buco di accesso (SRV-01) e uno script distruttivo (LDB-01)** che da soli decidono a chi puoi vendere oggi.
**Vendibile oggi:** a un locale che installi tu, con Wi-Fi separato per i clienti (o QR in modalità cloud), con Mac lasciato acceso e aggiornato a mano da te.
**Non vendibile oggi:** a un locale con Wi-Fi aperto ai clienti (SRV-01 = takeover owner in 3 richieste), né come "app dello Store che ti avvisa quando arriva un ordine" (L-IOS-05: l'app nativa non ha alcuna notifica), né in remoto senza notarizzazione Apple (MAC-04).
**Distanza dalla vendibilità piena:** un solo blocco è mezza giornata (SRV-01); il resto è una settimana di lavoro ordinato, tranne firma/notarizzazione macOS che è giorni veri.

---

## 2. Semaforo per corsia

| Corsia | Stato | Motivo in una riga |
|---|---|---|
| **iOS (app owner)** | 🟡 **giallo** | I dati sono veri e l'auth è solida, ma tutto ciò che è tempo reale/rete si rompe in silenzio (`apps/app/src/native/app.tsx:90`, `apps/app/app/(tabs)/ordini.tsx:27-29`) e **non esiste nessuna notifica** (`apps/app/package.json`, nessun `expo-notifications`). |
| **macOS (appliance)** | 🟡 **giallo** | Supervisione figli e bonifica orfani scritte bene; fragile solo lo spegnimento su unix (`apps/app/src-tauri/src/lib.rs:411-421`, `:451-455`) e il fatto che Cmd+Q non chiami mai `teardown_children`. |
| **Server** | 🔴 **rosso** | `/api/setup/*` è registrato senza alcun preHandler (`apps/server/src/index.ts:282` → `routes/setup.ts:125`): chiunque sia sul Wi-Fi del locale diventa owner. Tutto il resto della corsia è verde. |
| **DB / dati** | 🟡 **giallo** *(misura incompleta)* | Schema disciplinato e 19 migrazioni verdi da zero; ma `packages/db/seed-demo-storico.mjs:58-66` punta di default al Postgres dell'app installata e cancella conti e pagamenti veri, e non esiste nessuna route di storno/riapertura conto. |
| **Web / PWA** | ⚪ **non misurato** | Corsia non consegnata: nessun finding, nessuna copertura. Da rifare prima del secondo cliente. |
| **Rilascio** | 🔴 **rosso** | `CFBundleVersion` cablato a 1 (`apps/app/ios/Tako/Info.plist:37-38`), tutta la config iOS fuori da git (`apps/app/.gitignore:39-41`), nessun vincolo tag↔versione (`.github/workflows/release.yml:135-139`), e la firma macOS è "un colpo" solo sulla carta (135 Mach-O annidati). |

---

## 3. P0 — da chiudere PRIMA di vendere

| Titolo | File:riga | Cosa succede in pratica | Fix | Costo |
|---|---|---|---|---|
| **Takeover owner in 3 richieste dal Wi-Fi del locale** | `apps/server/src/routes/setup.ts:125` (+ `:34`, `:147`, `:169`); registrazione senza preHandler in `apps/server/src/index.ts:282` | Un cliente seduto (i QR puntano a `tako.local` sulla LAN, `routes/tables.ts:217`) chiama `GET /api/setup/status` → riceve `ownerEmail`; `POST /api/setup/local-password` → riscrive la password owner senza sessione; `POST /api/auth/login` → è dentro come titolare. Da lì: sconto 100% sui conti, incasso, CSV del commercialista, staff, prezzi. `/unpair` e `/heartbeat`, anch'essi anonimi, azzerano `local_owner_secret_hash` → il titolare resta **fuori dalla propria cassa a servizio iniziato**. Esposizione verificata: **solo LAN** (il tunnel è off di default e `middleware/remoteGate.ts:43` mette `/api/setup` in deny-list assoluta). Precondizione: appliance già accoppiata al cloud = la configurazione di vendita. | Gate **condizionale** in `setup.ts`: finché `ownerSnapshot()` è vuoto le route restano libere; appena esiste un owner, `/local-password`, `/unpair`, `/heartbeat` richiedono `requireRole('owner')` **e** la password locale corrente. Togliere `ownerEmail`/`ownerName` da `pairingState()` per richieste non autenticate. | **mezza giornata** |
| **Il seed della demo cancella conti e pagamenti veri** | `packages/db/seed-demo-storico.mjs:58-66` (default a `127.0.0.1:54317`, la porta di `packages/db/src/embedded.ts:135`) | Riga 61 cancella tutti gli ordini `pending`/`cancelled` **veri**; righe 63-65 cancellano `bills` e `bill_payments` "orfani", cioè — dato che l'app popola `orders.bill_id` **solo per l'asporto** (`routes/customer.ts:444`; `lib/billing.ts:160` non lo scrive mai per i tavoli) — **ogni conto da tavolo mai creato dall'app reale**. I conti del seed sopravvivono, spariscono solo i veri, restando ordini `paid` senza conto. Riga 34 prende `restaurants limit 1` senza filtro. Il kit di vendita prescrive esattamente questo comando (`docs/vendita/pitch-ristoratori.md:36`). | Gate in testa: rifiuta senza `TAKO_SEED_CONFIRM=1`, e abortisci se esiste anche un solo conto non marcato. Restringere le tre delete alle sole righe `__demo__`, mai a `status in (...)` né all'orfanità. Committarlo solo dopo il gate. | **mezz'ora** |

> Formalmente lo scettico ha declassato LDB-01 a P1 perché è uno script lanciato a mano, non codice in produzione. Lo tengo in P0 **operativo**: il giorno in cui lo lanci sul Mac di un pilota per "rifare la demo" hai distrutto lo storico di un cliente, e la procedura di vendita ti dice di farlo ogni mattina.

---

## 4. P1 — da chiudere prima del secondo cliente

| ID | Titolo | File:riga | Impatto pratico | Fix | Costo |
|---|---|---|---|---|---|
| SRV-02 | Una maiuscola nell'email mura l'appliance | insert `apps/server/src/routes/auth.ts:200` vs select `auth.ts:253`; stesso difetto `routes/staff.ts:34` | `Mario.Rossi@Gmail.com` viene salvata grezza, il login cerca `email.toLowerCase()` → 401 per sempre. `/register` è one-shot (`auth.ts:136-138`), sull'appliance non c'è reset password. Uscita non ovvia: `POST /api/setup/pair` col device code. Zero test lo coprono. | `z.string().trim().toLowerCase().email()` in `auth.ts:23` e `staff.ts:20` (già fatto giusto in `routes/cloud/auth.ts:39`), + migrazione `UPDATE users SET email = lower(email)` e unique su `lower(email)`. | mezz'ora + migrazione |
| SRV-03 | Nessuna riconciliazione cassa: `POST /bills/:id/payments` non dice quanto è il nuovo totale né se il conto si è chiuso | `apps/server/src/routes/bills.ts:210` (riscrive `total`), `:270` (risposta = solo la riga di pagamento); UI `apps/dashboard/public/staff/src/05-screens-sala-cassa.js:402,442` | `bill_payments` non è sommato da **nessuna** parte del prodotto: dashboard (`bills.ts:293`), stats (`stats.ts:34`) e CSV commercialista (`stats.ts:230`) leggono solo `bills.total`, che il server riscrive sotto lock al pagamento. Se un ordine viene annullato mentre la modale è aperta, incassi €30 e la giornata registra €18. Se ne arriva uno nuovo, il pagamento è parziale ma la UI toasta **"Conto T7 chiuso"** perché si fida del 201: il tavolo se ne va. Nota: il percorso AI fa la cosa giusta (`ai-actions.ts:1341-1343`), la route della cassa no. | Rileggere il bill dentro la tx e rispondere `{payment, bill:{total,status,paidTotal}}`; toast "chiuso" solo su `status==='closed'`. Esporre `collected = sum(bill_payments.amount)` in `/bills/summary/today` e nel CSV. | mezza giornata |
| SRV-04 = LDB-02 | Annullare un ordine **asporto** lascia un conto fantasma incassabile | `apps/server/src/routes/orders.ts:240` e `:334` (`if (current.tableId)`), stesso guard in `ai-actions.ts:1250` | **Trovato indipendentemente da due corsie** — conferma incrociata. L'asporto ha `tableId` null, `recomputeOpenBill` (`lib/billing.ts:63`) lavora solo per tavolo: il conto resta `open` col totale congelato. In Cassa resta un ticket "Asporto · X" che nessuno può eliminare (non esiste `DELETE /bills`); se lo incassi, `billTotalsFromOrders` (`billing.ts:112-119`) esclude l'ordine cancelled → `total` 0, resta una riga `bill_payments` da €X e l'incasso del giorno è più basso del cassetto. Si attiva da solo, senza concorrenza. | `recomputeBillById` (lock su `hashtext(billId)`, stessa chiave di `bills.ts:194`) chiamata nei tre punti quando `billId` è valorizzato e `tableId` è null. | mezza giornata |
| MAC-04 | La notarizzazione non è "un colpo": 135 Mach-O annidati che `--deep` provatamente non firma | `apps/app/src-tauri/Tako.entitlements:1-10`, `tauri.conf.json:35-42`, `scripts/deploy-desktop.sh:40` | Prova controllata: `codesign --force --deep --sign -` rifirma `Contents/MacOS/main` e **lascia intatto** un Mach-O sotto `Contents/Resources`. Nel bundle: 130 binari Developer ID EnterpriseDB, 1 Node.js Foundation, **3 adhoc linker-signed** (`whisper-server`, `sharp-darwin-arm64.node`, `libvips-cpp.42.dylib`) = rifiuto certo del notary. Il `node` imbarcato ha per giunta `get-task-allow`, entitlement vietato da Apple. **Correzione importante al finding originale:** le entitlements del padre non si applicano al figlio — il pericolo è l'inverso, cioè rifirmare `node` con `Tako.entitlements` strappandogli `allow-jit`/`disable-library-validation` → V8 non parte, il watchdog lo rispawna in loop e l'app resta appesa all'avvio. | Step di firma **inside-out** in CI: `find` dei Mach-O → `codesign --options runtime --timestamp --entitlements node.entitlements` dal più profondo all'esterno, poi il bundle, poi `notarytool submit --wait` + `stapler`. `node.entitlements` = le 5 chiavi di nodejs.org **meno** `get-task-allow`. Smettere di usare `--deep`. | **giorni** |
| L-IOS-01 | La rete viene sondata una volta sola: nessun `AppState`, nessun `NetInfo`, nessun re-probe | `apps/app/src/native/app.tsx:67-90`; consumatori `live.tsx:86`, `app/(tabs)/ordini.tsx:95` | Il caso vero (repro dell'agente corretta dallo scettico) è il **cambio rete ad app viva**: esci dal locale o cade il Wi-Fi → `base` resta `http://tako.local:4317`, `net` resta `'lan'`, il badge dice "In sala", i pulsanti restano abilitati e l'avanzamento ordine si perde in silenzio mostrando comunque lo stato nuovo (`ordini.tsx:49-59` ottimistico + `catch` di `load` che conserva il valore). Unico rimedio: `altro.tsx:21` "Ricontrolla la rete". | `AppState.addEventListener('change')` + `NetInfo.addEventListener` dentro `NativeAppProvider` che chiamano `recheck()`; `recheck()` anche in `Screen.refresh()`. | mezza giornata |
| L-IOS-03 | Un errore di rete su Ordini viene disegnato come "Nessun ordine in corso" | `apps/app/app/(tabs)/ordini.tsx:27-29`, `:66-67` | La bugia peggiore durante un servizio: il ristoratore smette di controllare perché l'app gli ha garantito che non c'è nulla. Repro vera: app aperta su Oggi, il telefono perde il Wi-Fi, tocca Ordini per la prima volta → tab lazy con `orders===null`, load fallisce, empty state sotto badge verde. Oppure appliance viva ma 500/429: `/health` (`apps/server/src/index.ts:258`) non tocca il DB, quindi il probe resta verde. La gemella `oggi.tsx:29,40-41,52-53` fa già la cosa giusta con `failed`. | Copiare il pattern di `oggi.tsx`: stato `failed` distinto, empty state "Ordini non disponibili"; try/catch su `more()`; nel catch di `advance()` ripristinare la riga. | mezz'ora |
| L-IOS-05 | L'app dello Store non riceve **nessuna** notifica | `apps/app/package.json` (no `expo-notifications`), entitlements del target vuoto (no `aps-environment`), `apps/server/src/lib/push.ts:29` (solo `web-push`), `apps/dashboard/owner-src/lib/push.ts:41-51` | Il push del prodotto è Web Push VAPID, che esiste solo nella PWA installata in home screen. Il takeover nativo (`apps/app/app/index.tsx:138-144`) è definitivo: da lì niente service worker, niente Push API. E anche il ripiego WebView è muto (`pushState()` in WKWebView torna `needs-install`): dentro l'app scaricata dallo Store il ristoratore vedrebbe l'invito a installare la PWA. Ribalta la decisione D5 di `docs/PIANO-APP-RISTORATORI.md:335-359`. | O `expo-notifications` + `aps-environment` + secondo trasporto in `pushDispatch()` (colonna `expo_token` in `push_subscriptions`) — **giorni**; oppure togliere le notifiche dalle promesse della 1.0 e dirlo in `(tabs)/altro.tsx`, registrandolo come decisione che supera D5 — **mezz'ora**. | mezz'ora **o** giorni |
| L-IOS-06 | L'app nativa non impara mai l'endpoint del tunnel: fuori dal locale è morta | `apps/app/app/index.tsx:245-248` (unica scrittura di `cfg.remote`, dal ponte WebView), `apps/app/src/endpoint.ts:151` | Con una sessione nativa la WebView non monta più → `cfg.remote` resta null per sempre → fuori dalla LAN `resolveEndpoint` fallisce e compare "Nessuna risposta da tako.local". Il pezzo di vendita "controlli il locale da casa" **non funziona sull'app nativa**. | Dopo l'enroll e a ogni `recheck()`: `GET /api/system/info` (pubblica, `apps/server/src/routes/system.ts:17`) e `saveConfig({remote: data.remoteUrl})`. | mezza giornata |
| L-IOS-07 | `CFBundleVersion` cablato a 1 e nessun bump: il prossimo upload viene rifiutato | `apps/app/ios/Tako/Info.plist:37-38`, `:21-22`; `apps/app/scripts/ios-release.sh:102-108` | La 1.0.0(1) è già VALID su App Store Connect. Il prossimo `--upload` ricostruisce la stessa coppia → ITMS-4238 dopo aver bruciato l'intero archive. Ogni fix di review costa una modifica manuale a un file **non in git**. | `$(MARKETING_VERSION)`/`$(CURRENT_PROJECT_VERSION)` nel plist + `agvtool next-version -all` in testa allo script, stampando versione e build prima dell'archive. | mezz'ora |
| L-IOS-08 | Tutta la config iOS è fuori da git: la build si riproduce solo sul Mac di Manuel | `apps/app/.gitignore:39-41`; non tracciati `ios/Tako/Info.plist`, `PrivacyInfo.xcprivacy`, `project.pbxproj` (team `VG36RXW5CX`), `Podfile.properties.json` | `git ls-files apps/app/ios` → 0. Un `expo prebuild --clean` o un clone su un altro Mac produce un binario **silenziosamente diverso** da quello passato in review: `ITSAppUsesNonExemptEncryption`, `UIUserInterfaceStyle`, orientamenti, privacy manifest, `EXPO_USE_PRECOMPILED_MODULES=false`. | Versionare `apps/app/ios` (escludendo `build/`, `Pods/`, `xcuserdata/`) — più sicuro ora che la 1.0 è in review. In alternativa portare tutto in `app.json → ios.infoPlist`. | mezza giornata |

---

## 5. P2 / P3 — debito accettabile, elencato

**macOS**
- **MAC-01 (P2, era P0)** — Su unix lo spegnimento è solo `SIGTERM` al gruppo (`lib.rs:411-421`) e poi `join()` **senza timeout** (`:451-455`), mentre `apps/server/src/bootstrap.ts:65-68` registra un handler `SIGTERM` che **non esce** (verificato empiricamente: il processo sopravvive al primo SIGTERM). *Corollario nuovo e forse più importante del finding originale:* su macOS **Cmd+Q non emette `RunEvent::ExitRequested`** (percorso `terminate:` → `applicationWillTerminate` → `RunEvent::Exit`), quindi `teardown_children` **non gira mai** sul gesto normale di chiusura → node + Postgres orfani a ogni Cmd+Q, e la pulizia è sempre delegata a `reclaimOrphanServer`/`healStaleLock`. Fix 3 righe: `process.exit(0)` nel cleanup + deadline unix uguale a quella Windows con `kill(-pid, SIGKILL)`.
- **MAC-03 (P2)** — Nessuno confronta il tag con `tauri.conf.json:4` (`.github/workflows/release.yml:135-139`): un tag sbagliato = dialogo di aggiornamento **perpetuo** su ogni appliance, con teardown dei figli a ogni giro. Fix: 3 righe di guardia in CI. Anche `Cargo.toml` (0.1.0) e `apps/app/package.json` (1.0.0) sono incoerenti.
- **MAC-06 (P2, non verificato)** — Update macOS senza rollback: se il `rename` finale fallisce, `tmp_backup_dir` è un `TempDir` che viene cancellato al drop → **Tako sparisce dal Mac**, e `lib.rs:501-505` chiama `handle.restart()` su un bundle che potrebbe non esistere.
- **MAC-07 (P2, non verificato)** — `cp "$f.sig" … || true` (`release.yml:90-95`): se la firma mac manca, `make-latest-json.mjs` salta la piattaforma e la release passa **verde**. Oggi manca già del tutto `darwin-x86_64`.
- **MAC-08 (P2, non verificato)** — `spawn_update_check` chiamato una sola volta (`lib.rs:605`) su un'appliance progettata per non spegnersi mai: i fix sui soldi arrivano solo il giorno in cui qualcuno riavvia il Mac.
- **MAC-09 (P2, non verificato)** — Il firewall macOS chiede di autorizzare **"node"**, non "Tako"; se il ristoratore rifiuta, localhost funziona ma **tutti i QR sui tavoli muoiono in silenzio**.
- **MAC-10 (P2, non verificato)** — `install-usb-mac.sh:57-62`: `osascript quit` + `sleep 1` + `rsync --delete` sopra i binari **mentre Postgres è vivo**.
- **MAC-11 (P3, già noto)** — `mdfind "kMDItemFSName == 'Tako.app'"` → 4 righe: mancano i `.metadata_never_index` in `apps/app/ios/build/` e in DerivedData. Viola la regola assoluta "una sola app".
- **MAC-12 (P3, non verificato)** — `tauri-plugin-http` con scope `http://**` + `csp: null` (`capabilities/default.json:8-18`) per **zero funzionalità**: lo splash usa la `fetch` del browser. Da rimuovere.
- **MAC-05 declassato a P3** — resta solo il pezzo vero: il `catch` di `packages/db/src/embedded.ts:119-121` non rimuove la dir `pgdata-<ts>` **parziale**, che poi occupa uno slot di rotazione ed è indistinguibile da un backup sano.

**Server**
- **SRV-05 (P2)** — `PATCH /api/insights/menu/:itemId/cost` (`routes/insights.ts:280`) e `GET /api/insights/menu` (`:73`) sono `requireAuth`: chiunque abbia sbloccato il tablet col PIN a 4 cifre legge e **riscrive** food cost e margini di tutto il menu, senza audit log. Incoerente con `/insights/menu/ai` che è `requireRole('owner')` (`:85`).
- **SRV-06 (P2, già noto)** — Handler socket senza throttle (`socket/handlers.ts:74,86,92`): il guard su `rooms.size` non protegge il ri-join alla stessa room, ogni emit fa JWT verify + 2 query sul pool `max=10` (`packages/db/src/client.ts:15`) condiviso con le INSERT ordine.
- **SRV-07 (P3)** — L'idempotenza in `routes/customer.ts:330` non è scoped al tavolo: con una chiave indovinata leggi l'ordine di un altro tavolo e il tuo non viene mai creato. La gemella `:562` filtra correttamente.
- **SRV-08 (P3)** — `PATCH /menus/items/:itemId/availability` (`routes/menu.ts:193`) è l'unica route senza zod: body `{}` → il DB non cambia ma l'emit manda `available: undefined` alla room pubblica e **il piatto sparisce da tutti i telefoni in sala** mentre la dashboard lo mostra disponibile. È il gesto più usato del servizio.

**iOS**
- **L-IOS-02 (P2, era P1)** — Il badge "In sala" (`Screen.tsx:29-35`) guarda `net`, non il socket; `live.tsx:78` calcola `connected` che **nessuna schermata consuma** (codice morto). Alla riconnessione i reloaders si auto-riparano (`live.tsx:97-103`), quindi il danno è limitato al caso server irraggiungibile.
- **L-IOS-09 (P2)** — 9 dei 12 eventi socket (`live.tsx:56-74`) non hanno alcun handler: **chiamata cameriere** e **alert scorte** arrivano e vengono buttati. Funzioni che vendiamo e che sull'app nativa non esistono.
- **L-IOS-10 (P2)** — Token owner a 30 giorni in `AsyncStorage` in chiaro (`session.ts:33,51-53`), incluso nei backup non cifrati, mentre `expo-secure-store` è dichiarato in `app.json:43` e **mai importato** — ne paghiamo solo una `NSFaceIDUsageDescription` boilerplate **in inglese** in un'app tutta italiana (segnalazione classica 5.1.1).
- **L-IOS-11 (P2)** — ATS ha solo `NSAllowsLocalNetworking` (`app.json:21-24`), che **non copre gli IP RFC 1918** scritti a mano — cioè esattamente il fallback che `docs/setup-rete-ristorante.md:238` insegna al ristoratore.
- **L-IOS-12 (P2)** — `if (!fontsLoaded) return null` senza ramo d'errore (`app/_layout.tsx:13-22`): un fallimento del caricamento font = **schermo bianco permanente**, che per un revisore Apple è il caso 2.1.
- **L-IOS-04 declassato a P3** — Nessuna validazione della busta in `api.ts:57,63`: un 200 non-JSON diventa `data: null` e Oggi resta in scheletro infinito. Reale ma il percorso d'innesco è stretto (serve un telefono già arruolato con host manuale stantio): impatto = solo diagnosticabilità.

---

## 6. Findings scartati dalla verifica avversariale

Sezione onesta: questi erano stati presentati come gravi e **non reggono**, o non reggono come raccontati.

| ID | Presentato come | Perché è caduto |
|---|---|---|
| **MAC-02** | P1 — "dopo ogni auto-update l'app perde l'identità di firma e il ristoratore deve riconcedere i permessi" | **Smontato sull'impatto.** Il meccanismo è vero (l'artefatto CI scaricato *oggi* da `updates.takoitalia.com` non ha `_CodeSignature`), ma la premessa è falsa: una firma ad-hoc ha designated requirement **solo il cdhash** (`codesign -d -r- /Applications/Tako.app` → `designated => cdhash H"c9db30d3…"`), che cambia a ogni build. Il csreq salvato in TCC per il microfono ha `cdhash fef83ea4…`, che **già oggi** non combacia con l'app installata: il prompt si ripresenta a ogni `deploy-desktop.sh`, l'auto-update non introduce nessuna regressione. Resta solo un'imprecisione in `RILASCIO.md:25`. → **P3, documentazione.** |
| **MAC-05** | P1 — "il backup blocca l'avvio, occupa 6× il DB e una copia interrotta scalza l'ultimo backup buono" | **Smontato su 3 fronti.** (a) `cpSync` misurato: **439 ms** su pgdata reale da 66 MB — e il messaggio "solo al primo avvio" esce dopo ~6 s (`standalone-dist/index.html:29`), irraggiungibile. (b) Il 6× è già scritto in `docs/tako-gap-100-2026-07-13.md:255-270`, con escape documentati (`TAKO_DB_BACKUP=0`) ed è **limitato** dalla rotazione, non cresce nel tempo. (c) La rotazione ordina **discendente** e cancella la coda (`embedded.ts:112-118`): la dir parziale non scalza il backup buono, elimina il più vecchio. → **P3, resta solo la dir parziale non rimossa.** |
| **MAC-01 (repro)** | P0 — "Cmd+Q nei primi secondi appende l'app per sempre" | Il meccanismo regge, **la riproduzione no**: su macOS Cmd+Q passa da `terminate:` → `applicationWillTerminate` → `RunEvent::Exit`, e `lib.rs:614` filtra solo `ExitRequested` → `teardown_children` **non viene chiamato**, il processo esce subito. Il percorso che appende davvero è la chiusura della finestra, e lì la finestra **si chiude** (niente "rotella che gira"): resta un processo fantasma che tiene il socket single-instance. → **P2, con corollario nuovo più grave (orfani a ogni Cmd+Q).** |
| **L-IOS-01 / L-IOS-03 (repro)** | "aprire l'app da freddo con appliance spenta" | Falso: `app/index.tsx:157-171` risolve **prima** di navigare e su `found === null` porta a `ConnectScreen` (`_layout.tsx:40` redirige fuori dalle tab). Le repro vere sono altre (cambio rete ad app viva, o appliance viva con 500/429) — i difetti restano, il racconto era sbagliato. |
| **L-IOS-05 (una frase)** | "è il contrario della promessa di vendita" | `docs/vendita/pitch-ristoratori.md` **non contiene** "notifica"/"avvisa": non c'è una promessa scritta da contraddire. La promessa è nel piano di prodotto (F3.2), non nel pitch. |
| **MAC-04 (causa)** | "servono `allow-jit` e `disable-library-validation` in `Tako.entitlements` o il figlio muore" | **Girata al contrario.** Le entitlements di un figlio vengono dalla *sua* firma, non dal padre (`lib.rs:296` è un processo separato), e il `node` imbarcato le ha già tutte. Il pericolo vero è l'inverso: rifirmare `node` **con** `Tako.entitlements` gliele strappa. La conseguenza descritta è giusta, la causa no. |
| **SRV-01 (novità)** | "nuovo" | **Già noto**: è `X7` in `docs/PIANO-REVISIONE-FULLSTACK.md:254`, con gli stessi file:riga. È nuova la **catena completa in 3 richieste** (`/status` regala l'email; `emailVerified: true` scritto dal pairing disarma il gate di `auth.ts:283`) e la chiusura della domanda aperta a riga 976: `/heartbeat` e `/unpair` **non** hanno gate interni. |

---

## 7. Ordine di lavoro consigliato — lunedì mattina, in sequenza

**Blocco 1 — i due che decidono se puoi vendere (mattina)**

1. **`seed-demo-storico.mjs`: gate + delete filtrate** (`packages/db/seed-demo-storico.mjs:58-66`) — 30 min.
   *Verifier:* su un DB effimero con 3 conti veri e 3 `__demo__`, lanciare senza `TAKO_SEED_CONFIRM` → exit ≠ 0 e `select count(*) from bills` invariato; con la variabile → spariscono solo i 3 marcati.
2. **Chiudere `/api/setup/*`** (`apps/server/src/routes/setup.ts:125,147,169`; togliere `ownerEmail` da `pairingState()` in `lib/cloud-client.ts:191`) — mezza giornata.
   *Verifier:* due test in `tests/`: (a) DB vuoto → il primo setup completa ancora senza cookie; (b) con owner esistente, `curl` senza cookie su `/local-password`, `/unpair`, `/heartbeat` → 401/403 e `GET /status` senza cookie non contiene `ownerEmail`. Poi ripetere a mano la catena in 3 passi e verificare che il passo 2 fallisca.

**Blocco 2 — i soldi (pomeriggio lunedì / martedì)**

3. **Asporto annullato** (`routes/orders.ts:240,334` + `ai-actions.ts:1250`, nuova `recomputeBillById`) — mezza giornata.
   *Verifier:* test d'integrazione: ordine asporto €24 → `PATCH /cancel` → `GET /bills/open` non lo mostra più (o lo mostra a 0) e `summary/today` è coerente. Aggiungere il caso a `tests/correctness.test.ts`.
4. **Riconciliazione cassa** (`routes/bills.ts:210,270` + `05-screens-sala-cassa.js:402,442` + `collected` in `bills.ts:293` e `stats.ts:230`) — mezza giornata.
   *Verifier:* test che paga con un ordine annullato in mezzo → la risposta contiene `bill.total` aggiornato e `status`; UI: il toast "chiuso" non compare su pagamento parziale. E `sum(bill_payments) == summary.collected` su tutta la giornata di simulazione.
5. **Email lowercase** (`auth.ts:23`, `staff.ts:20`, migrazione + unique su `lower(email)`) — 30 min + migrazione.
   *Verifier:* test register/login con `Mario@Test.it` → login OK con entrambe le grafie; migrazione applicata da zero su DB effimero (le 19 migrazioni devono restare verdi).

**Blocco 3 — rilascio, prima di ritoccare qualunque binario (martedì)**

6. **Guardia tag ↔ `tauri.conf.json`** (`.github/workflows/release.yml`, primo step) — 30 min.
   *Verifier:* CI su un tag deliberatamente sbagliato → job rosso **prima** di produrre artefatti.
7. **Bump automatico iOS** (`Info.plist:37-38` → `$(CURRENT_PROJECT_VERSION)`, `agvtool` in `ios-release.sh`) — 30 min.
   *Verifier:* due `--upload` consecutivi (o due dry-run) devono stampare build 2 e 3, non 1 e 1.
8. **Versionare `apps/app/ios`** (`.gitignore:39-41`) — mezza giornata.
   *Verifier:* `git ls-files apps/app/ios | wc -l` > 0; clone pulito in un'altra cartella + `xcodebuild archive` che completa senza `expo prebuild`.
9. **Rimuovere il `|| true` sul `.sig`** e aggiungere `--require darwin-aarch64,windows-x86_64` a `make-latest-json.mjs` — 30 min.
   *Verifier:* rinominare il `.sig` in `dist/` → lo script esce ≠ 0.

**Blocco 4 — app iOS, verso il secondo cliente (mercoledì/giovedì)**

10. **`AppState` + `NetInfo` in `NativeAppProvider`** (`app.tsx:67-90`) + **`failed` in `ordini.tsx:27-29`** + **badge legato a `live.connected`** (`Screen.tsx:29-35`) — mezza giornata insieme.
    *Verifier:* sul device: aprire l'app in sala, spegnere il Wi-Fi → entro pochi secondi il badge diventa "Offline" e Ordini dice "non disponibili", non "nessun ordine"; riaccendere → si ripara da solo senza toccare "Ricontrolla la rete". Typecheck verde.
11. **Apprendimento dell'endpoint remoto** (`GET /api/system/info` → `saveConfig({remote})`) — mezza giornata.
    *Verifier:* arruolare via QR, passare a 4G, riaprire → l'app si collega senza ConnectScreen.
12. **Decisione su L-IOS-05 (notifiche).** Se la 1.0 esce senza push: mezz'ora per la nota in `(tabs)/altro.tsx` + `docs/vendita`, **e va salvata come decisione** perché supera D5 di `docs/PIANO-APP-RISTORATORI.md:335-359`. Se invece si fa il push nativo: giorni, e allora va pianificato, non infilato.

**Blocco 5 — firma e notarizzazione macOS: pianificare, non improvvisare**

13. **MAC-04** non è un task da fine giornata: sono **giorni** di release engineering su 135 Mach-O, con 3 binari adhoc che fanno fallire il notary di sicuro e il fallimento che arriva **dopo** l'upload.
    *Verifier di gate, da scrivere prima di iniziare:* `codesign --verify --deep --strict --verbose=2 Tako.app` + `spctl -a -vvv -t install` + `notarytool submit --wait` verde su una macchina pulita che non ha mai visto Tako.

**Prima di dichiarare chiusa la revisione:** far girare la corsia **web/PWA**, che non ha consegnato nulla, e completare la corsia DB oltre LDB-02 (in particolare: **non esiste nessuna route di storno o riapertura conto** — un errore di cassa oggi non è correggibile da nessuna interfaccia).