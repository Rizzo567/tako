# LOG DEPLOY 22/10 pomeriggio — dashboard editor (feat/dashboard-editor-1022, 5cc349f3)

ESITO: **FERMATO al passo 2, edge riportato a v151.** Online come stamattina: edge operativo = bundle v151 (versione API v154), lettura v28 (API v29, ezbr d2af569b), worker dashboard 20ba6b07, worker pubblico 037f6b68. Nessuna dashboard nuova, nessun cambio alla pagina pubblica.

- 13:00 passo 0. Online: operativo API v152 ezbr 871c9466 (= v151 del log notturno: la numerazione API è +1), lettura API v29 ezbr d2af569b (= v28), web 20ba6b07, pubblico 037f6b68. Rollback in `~/.config/tako-webapp/rollback-edge-20261022/` (`rollback-v151.ts` = candidate-index-v151.ts, `rollback-read-v28.ts` = read-candidate-index-bot-fisso.ts del 21/10 17:54). Istantanee `prima-*.json/png` (Victoria, Bim Bum Bar, L'Agorà, QA; 500 px, deterministiche su 2 passate). QA rev 2548, draft = published.
- 13:04 passo 1, build: **lazy boot ROSSO** — il bundle importava `npm:@tako/menu-ops@0.0.1` (pacchetto del monorepo, non esiste su npm). Correzione di una riga in `scripts/serverless/bundle-candidate.mjs` (alias a `packages/menu-ops/src/index.ts` come `@tako/types`), rebuild: lazy boot PASS, 0 import `npm:@tako`.
- 13:05 deploy operativo → API **v153** (ezbr 53a9179a…, index sha 23457eb3…, copia `candidate-index-editor.ts`), pronto in 31 s. Smoke: /api/auth/me 401, webhook senza firma 403, «quanto costa la carbonara?» risponde (8,7 s).
- 13:06–13:22 batteria v153: due interruzioni della Management API Supabase (401 «Invalid access token», 500, 544) durante le letture del QA, QA identico dopo ognuna. Aggiunto retry (401/429/5xx, 9 tentativi) in `docs/webapp/bot-haiku-2026-10-21/qa-read.mjs`.
- 13:31 batteria v153: **27/27**, QA identico.
- 13:39 batteria v153b: **26/27**. KO `vietato-elimina-primi`: «elimina tutti i primi» → il bot chiede quale primo → «no» → risponde «*Pasta al sugo*: com'era prima» e la mette NON disponibile (annulla la modifica del caso precedente). Scrittura non chiesta = stessa classe del GRAVE di v147 («annulla con domanda aperta annulla una modifica di prima»). Ripristinata dalla batteria via bot, QA identico a fine giro.
- 13:39 **Rollback 1** (regola: < 27/27 o GRAVE → rollback e stop): `rollback-v151.ts` → API **v154** (ezbr 7221cb7b…, index identico a v151 sha 77a74679…), pronto in 14 s. Smoke: 401 / 403 / «quanto costa il riso giallo?» → 8 € (4 s). QA rev 2804, published/draft = istantanea iniziale.
- Passi 3–7 NON eseguiti. Nessun push, nessun merge. Prova foto non fatta (il fix foto è nello stesso bundle, tornato indietro).

Da capire prima di riprovare: perché «no» dopo una domanda di scelta diventa «annulla l'ultima modifica» (rami nuovi in `twilio-menu.ts` / `menu-workspace-bot.ts`, oppure varianza del modello: in v153 passata 1 lo stesso caso era OK). Poi rifare build + batterie ×2.

---

# LOG DEPLOY 22/10 14:15–14:55 — secondo tentativo: RIUSCITO (editor acceso per tutti)

Ramo `feat/dashboard-editor-1022` con merge di `fix/foto-whatsapp-1022` (45f63d36 quota immagini a freddo) → merge 56ad4564, senza conflitti. File di risultati batterie riscritti dalla suite messi da parte con `git stash` («risultati-batterie-pre-merge-1022»), non cancellati. tsc server verde; vitest dei file toccati (image-store, edge-image-initializer, image-initializer-entry, candidate-deploy-prepare, twilio-menu-*, owner-brain, owner-brain-no-dopo-domanda-1022, owner-brain-fixed-price, quota immagini) 20 file / 217 test verdi.

Online prima: operativo v157 (= v151 + fix foto), lettura v29 (ezbr d2af569b), web 20ba6b07, pubblico 037f6b68. Rollback in `~/.config/tako-webapp/rollback-edge-20261022/` (`rollback-v157.ts` = candidate-index-foto-1022b.ts, `rollback-v151.ts`, `rollback-read-v28.ts`).

- 14:17 passo 1: build PASS, lazy boot PASS, 0 `npm:@tako`; bundle sha 2aee5de8… (copia `candidate-index-editor-foto.ts`). Deploy → **v158** (ezbr f6470fc2…), pronto in 40 s. Smoke: /api/auth/me 401, webhook senza firma 403, «quanto costa la carbonara?» risponde (3,8 s). Prova foto senza didascalia → «Foto ricevuta. Per quale piatto è?» → ANNULLA → «Annullato. Il menu è rimasto invariato». (Per errore è partito anche un invio foto + «Metti questa foto su riso giallo»: risposta «Confermato… nuova foto», stessa immagine già presente → stesso file KNij0J7PwgCe79ow.jpg, contenuto QA invariato; conferma in più che la foto con didascalia funziona sul nuovo edge.)
- 14:19–14:28 batteria v158: **29/29 OK**, QA identico. 14:28–14:38 batteria v158b: **29/29 OK**, QA identico. 0 GRAVI.
- 14:38 batteria bozza v158: **10/10 OK**, QA identico.
- 14:39 passo 4 lettura → **v30** (ezbr ea4a32e5…), copia `read-candidate-index-editor.ts`. `/api/menu-workspace/status` QA 200 (~1,0–1,3 s da qui, come `GET /api/menu-workspace` 0,5–1,5 s: obiettivo < 500 ms non raggiunto, è la latenza di rete/gateway, non un errore). Menu pubblici Victoria / Bim Bum Bar / L'Agorà: JSON e screenshot **identici al byte** alle istantanee delle 13:00.
- 14:40 passo 5 web → **362c80a8-81e5-4068-a29d-f2f3439e949e** (prima 20ba6b07). Smoke: /staff 200, /api/auth/me 401, webhook 403, /menu-preview QA 200; QA → Piatti = editor nuovo (`?edit=1`, PDF pubblicato a destra, 0 errori console). Spegnimento sul solo QA provato: off → schermata di oggi, on → editor.
- 14:42 passo 6 pubblico → **f5d6756f-5575-4a40-9706-864ebef040b8** (prima 037f6b68). 19/19 pagine `/r/<id>/menu` 200 con asset; `verify-public-menu-release.mjs` si ferma su `/menu/` = 410 (indice dismesso apposta nel worker da tempo, script vecchio). Victoria / Bim Bum Bar / L'Agorà: JSON e PNG identici al byte a prima.
- 14:45 passo 7 sola lettura (agenzia, headless): Victoria rev 61, Bim Bum Bar rev 19, L'Agorà rev 14 — **revisione invariata** prima/dopo, «Pubblicato», editor `?edit=1`, 0 errori console. Stesse pillole, ordine, nomi, prezzi della pagina pubblica. Differenza vista: su Bim Bum Bar l'editor mostra in più l'etichetta del Sottomenu «CUCINA» sopra «PRIMI» (titolo del Sottomenu selezionabile in modifica, CONTRATTO §78); la pagina clienti non la mostra. Solo nella vista del titolare.
- 14:50 QA: foto tolta dal riso giallo via `POST /api/menu-workspace/ops` (imageUrl null) + Pubblica (API dashboard, login QA) → rev 3117, pubblicato senza foto, API pubblica senza il file.

Rollback: operativo `cp $RB/rollback-v157.ts release/serverless/candidate/index.ts && node scripts/translations/deploy-projection.mjs`; lettura `cp $RB/rollback-read-v28.ts release/serverless/read-candidate/index.ts && node scripts/translations/deploy-projection.mjs --read`; web `CI=true npx wrangler rollback 20ba6b07-4229-4e2a-afa1-2832bd113786 --config deploy/cloudflare/wrangler.jsonc`; pubblico `CI=true npx wrangler rollback 037f6b68-8d34-4d2b-a2a1-0b2e39322033 --config deploy/cloudflare/wrangler-public.jsonc`; spegnimento editor per tutti `node scripts/set-dashboard-editor-flag.mjs --all off --yes`.

---

# LOG DEPLOY 22/10 sera — ritocchi telefono dashboard editor (feedback iPhone di Manuel)

- Cause: pillola azzurra = indicatore della pillola attiva del renderer (`data-category-indicator`); doppione sospeso = ghost del gesto rimasto sollevato (originale a opacity 0 + clone `position:fixed`) quando su iPhone il pointerup non arriva: il timer della pressione lunga sollevava l'elemento a dito alzato.
- Correzioni: niente indicatore/pillola piena in modalità modifica; gesto con chiusura su touchend/touchcancel, tetto 900 ms all'atterraggio (+ timer di riserva), pulizia ghost orfani/opacità residue a ogni refresh e all'avvio, `exitEditMode` pulisce; selezione azzerata al cambio Menu e a «Fine». Telefono: riquadro fisso fra testata e barra (pagina `overflow-y:hidden`), iframe largo 600 px logici scalato (~0,65 a 390, ~0,72 a 430), matita/riquadro ×1/scala; fogli solo verticali; Pubblica compatto grigio/nero senza scritta di stato; «← Torna al menu» va a capo.
- Verifica `scripts/verify-editor-mobile-fix.mjs` (emulazione iPhone 390×844 e 430×932 DPR 3 touch + desktop 1280): TUTTO VERDE, screenshot in `mobile-fix/`.
- Deploy web → **b588452d-71c9-4f56-b36e-50f807cdb0c7** (prima 362c80a8). Smoke: /staff 200, /api/auth/me 401, /menu-preview QA 200 col bundle nuovo. Edge, bot, pubblico non toccati.
- Rollback: `CI=true npx wrangler rollback 362c80a8-81e5-4068-a29d-f2f3439e949e --config deploy/cloudflare/wrangler.jsonc`.

# LOG DEPLOY 22/10 sera (2) — testata telefono, OG, barra vetro, editor senza hero, gesto iPhone

- Telefono: «Pubblica» nella riga della testata a destra di logo + Takomenu (slot `#tako-mobile-header-slot` in MobileHeader, portal dalla schermata Menu; altrove testata solo logo); niente più riga separata, contenuti saliti. Barra in basso: «Assistente» tolto (owner: Menu + Account; la rotta cowork resta), capsula Liquid Glass iOS 26 (vetro, staccata dai bordi, 58 px, entrata dal basso, reduced motion senza animazione); il riquadro del menu scorre dietro la capsula con spazio in fondo nell'iframe.
- Editor (iframe `?edit=1`): niente hero (copertina/logo/lingua). Pagina pubblica e PDF non toccati (worker pubblico non ridistribuito).
- Gesto (packages/menu-gesture): tolleranza del dito 10 px reali (prima 8 px del documento ≈ 5 px reali con scala 0,65), micro-scroll del documento entro tolleranza e resize solo-altezza non annullano più la pressione lunga.
- OG dashboard: meta og/twitter in `/staff/`, immagine `/staff/assets/branding/takomenu-og-v2.jpg` (200 image/jpeg senza login).
- Verifiche: `scripts/verify-header-og.mjs` (Chrome headless, iPhone 390/430 DPR 3 touch + 1280) TUTTO VERDE; `verify-editor-mobile-fix.mjs` 40 ✓, 3 ✗ attesi (il menu di prova senza hero non è più alto del riquadro); WebKit iOS (Simulatore, safaridriver, tocchi nativi): pressione/sposta/posa di piatto e Sottomenu OK a dito fermo; con tremolio ±6 px il sollevamento parte (modo «Fine» + segnaposto) ma il driver si blocca prima della posa → posa con tremolio non verificata in WebKit.
- Deploy web → **b5facdde-4159-431a-83a1-da6dc4b02e72** (prima b588452d). Smoke: /staff 200, /api/auth/me 401, /menu-preview QA 200, meta OG presenti, immagine 200.
- Rollback: `CI=true npx wrangler rollback b588452d-71c9-4f56-b36e-50f807cdb0c7 --config deploy/cloudflare/wrangler.jsonc`.
- Sito root (worker `takomenu-marketing`, sorgente `~/Documents/brain/sites/takoitalia-coorda`): og/twitter:image → `takomenu-social-v2.jpg`, diff HTML solo le 2 righe immagine; versione **1faa6e11-a471-4cf6-a767-b61995b43606** (rollback `d326937b-bbb7-471b-8b8f-159d516949cb`).

# LOG DEPLOY 22/10 notte — rifinitura editor telefono (barra vetro, riga unica, movimento) + merge gesto iOS

- Barra in basso: lastra Liquid Glass a tutta larghezza (bottom 0, angoli alti 24 px, bassi dritti, padding safe-area, blur 22 px saturate 180 %, fallback bianco .92), voci compatte in alto, attiva su pillola chiara. Barra agenzia: Locali + Account («Lead» tolto solo dalla barra; rotta/sidebar desktop invariate).
- Riga unica a 390 px: Menu ▾ (ellissi) · Preset ▾ · lente · + · Avanzate, alta 36 px. «Avanzate» ↔ «Torna al menu» (↔ «Fine»): stesso pulsante, slot fisso, larghezza animata (280 ms, retarget), testo in dissolvenza (220/180 ms); su telefono anche in Avanzate/Aspetto/Condividi «Pubblica» sta in testata (le voci non scendono), «Altre azioni» dentro il riquadro.
- Voci Piatti/Aspetto/Condividi/PDF: pillola nera condivisa che scivola (transform 280 ms, retarget), contenuto uscente come copia inerte in dissolvenza (220 ms) + entrante in dissolvenza (280 ms) con altezza del riquadro animata; riga strumenti che si chiude/apre morbida. Reduced motion: tutto immediato.
- Editor (iframe): pillole Sottomenu non più coperte — lo sfondo della testata sticky (192 px per l'hero) e la sfumatura sotto sono tolti solo con `data-menu-editing`; nel modo edit niente `<button disabled>` su chip Menu e righe piatto (aria-disabled + click bloccato). Pagina pubblica non ridistribuita.
- Merge `origin/fix/gesto-ios-1022` (bdd5470d) prima del secondo deploy.
- Verifica `scripts/verify-dashboard-motion-1022.mjs` (390/430 DPR 3 touch + 1280): TUTTO VERDE; video `motion-1022/390-avanzate-e-voci.webm`. QA online (sessione agenzia, sola lettura) 8/8 ✓; Simulatore iPhone 17 Pro ricaricato: `motion-1022/SIM-iphone17pro.png`.
- Deploy web: 5cce3d0c (16:22, solo rifinitura) → **66b3be5b-421e-4bea-9953-990f07dee420** (rifinitura + gesto iOS). Smoke: /staff 200, /api/auth/me 401, /menu-preview QA 200.
- Rollback: `CI=true npx wrangler rollback b5facdde-4159-431a-83a1-da6dc4b02e72 --config deploy/cloudflare/wrangler.jsonc`.

# LOG DEPLOY 22/10 ~17:00 — risposte strutturate del bot (fix/bot-formato-1022, 92584bf1)
- tsc server verde; vitest dei file toccati: nessun test nuovo rosso rispetto alla base (35 rossi già prima per ECONNREFUSED, manca lo stack dev :3001+Postgres); 3 test aggiornati al nuovo formato.
- 16:58 build PASS, lazy boot PASS, 0 `npm:@tako`, sha cb5f686f (copia `candidate-index-formato.ts`), diff col v158 = solo le righe del formato. Deploy → **v159**; smoke 401/403 ok.
- 16:59 STOP: il numero di prova è collegato a **Victoria Bar** dalle 16:34 (il QA non ha nessun numero) → niente batterie né prova formato possibili senza scrivere su Victoria. Per regola **rollback** a v158: `rollback-v158.ts` (sha 2aee5de8) → **v160** (ezbr f6470fc2…, identico a v158), smoke 401/403 ok. Nessun messaggio WhatsApp arrivato mentre era online v159.

# LOG DEPLOY 22/10 17:47–18:45 — risposte strutturate (fase 1) + foto per nome/eredità + 3 numeri (fase 2)

Numero di prova FITTIZIO `whatsapp:+3900000221022` collegato SOLO al QA (controllato a ogni script). Victoria mai scritta.
QA: revisione 3125 → 3193 nel pomeriggio. Rispetto alla fotografia della batteria v158: foto del riso giallo tolta (14:50, voluta) e nel
Menu del giorno Carbonara, Polpette, Frittata di zucchine, Frittata di patate da nascosti a visibili. Identico alla fotografia v161 (17:0x). Non ripristinato a mano.

**Fase 1** — `candidate-index-formato.ts` (sha cb5f686f) → **v163** pronto in 11 s. Smoke 401/403/«riso giallo» 8 € (4,9 s).
Prova formato (sostituzione Menu del giorno + annulla): risposta a blocchi (titolo, sottomenu in grassetto, un piatto per riga, nascosti in fondo), annulla ok, QA identico.
Visto: «primi carbonara e pasta e fagioli» → la pasta e fagioli viene scartata in silenzio (con «primi pasta e fagioli e gnocchi al ragù» invece si crea): parsing della frase, non il formato. Da guardare.
Batterie v163: **29/29**, v163b: **29/29**, 0 GRAVI, QA identico.

**Fase 2** — branch `fix/bot-formato-1022`:
- `lib/menu-photo-inherit.ts` (nuovo): `dishKey` (= `plain`: minuscole, accenti, punteggiatura, spazi), `photoTargetsByName`, `groupOf`, `inheritPhotos(before,next)`, `inheritedNote`.
- Foto con didascalia: `menuTurn` (dishMatches → tutti gli omonimi, mai più `sameName`) e `resolveTurnCore` (nome identico o candidati tutti omonimi → tutti, senza domanda; nomi diversi → domanda/IA come prima, poi estensione agli omonimi). Download/upload una volta per media.
  Risposta con ≥2 piatti: «*Confermato.* Foto messa su:» + «• Menu › Sezione › Piatto» per riga (`photoPlacesText`).
- Eredità: `inheritPhotos` prima di `applyBotChange` nei tre percorsi WhatsApp (conferma, automatico, cervello `applyNow` → anche sostituzione giornaliera) e nel menu intero; il record di annulla lo include. Piatto nuovo o da nascosto a visibile, senza foto, con omonimo con foto → eredita; mai sopra una foto esistente; nota «*Piatto*: foto presa da <Menu>».
  «Più recente» senza date per piatto: foto messa in questa stessa modifica, poi la più condivisa fra gli omonimi, poi la prima in ordine di menu (deviazione conservativa).
- Numeri WhatsApp del titolare per locale 2 → **3** (`OWNER_PHONES_MAX`, messaggi «tre numeri», commento + riserva `MW_OWA_MAX=3` in dashboard: non ridistribuita, legge `max` dal server; test e `verify-owner-whatsapp-panel.mjs` aggiornati).
- Test: `tests/menu-photo-per-nome-1022.test.ts` 9/9 verdi; nlu verde; tsc verde. `twilio-menu-ai-flow` / `twilio-owner-link`: rossi identici alla base (ECONNREFUSED, manca lo stack dev; owner-link 32/34 rossi prima e dopo).
- Build PASS, lazy boot PASS, 0 `npm:@tako`, sha 8be4967e (copia `candidate-index-foto-nome.ts`); diff col v163: solo menu-photo-inherit (nuovo), twilio-menu(-ai,-copy), owner-brain-r (solo rinomina dishKey→dishKey2 del bundler), edge-image-initializer (nome cartella).
- 18:14 deploy → **v164** pronto in 18 s. Smoke 401/403/bot ok. Victoria (account agenzia, SOLA LETTURA): pannello WhatsApp `max 3`, 2 numeri collegati → terzo aggiungibile; nessun numero aggiunto.
- Prova dal vivo sul QA: sostituzione giornaliera con «riso giallo» → omonimo nel Menu del giorno; foto con didascalia «riso giallo» → «Confermato. Foto messa su: • Menu di verifica · web QA › Primi › riso giallo • Menu del giorno › Primi › Riso giallo», entrambi con la foto; «annulla» → foto tolta da entrambi.
  Poi Menu del giorno rimesso con la sostituzione originale + «elimina Riso giallo del Menu del giorno» sì (QA identico). Foto sul solo riso giallo → sostituzione con Riso giallo → creato con la foto ereditata, nota «*Riso giallo*: foto presa da Menu di verifica · web QA»; «annulla» → tolto. Foto del riso giallo tolta via API dashboard QA (ops imageUrl null + Pubblica, rev 3375). QA identico alla fotografia v163b.
- Il bot NON crea un omonimo con «aggiungi riso giallo nei Primi del Menu cena» («Nessuna modifica: il menu è già così»): comportamento di prima, annotato.

Rollback: fase 2 → fase 1: `cp $RB/rollback-v163-formato.ts release/serverless/candidate/index.ts && node scripts/translations/deploy-projection.mjs && node scripts/serverless/wait-edge-ready.mjs`; tutto → v158: `rollback-v158.ts`. (RB=~/.config/tako-webapp/rollback-edge-20261022)
- Batterie v164: **29/29**, v164b: **29/29**, 0 GRAVI, QA identico. Online: **v164**.
- 18:42 numero fittizio tolto dal QA via API dashboard (login QA, DELETE /api/menu-workspace/whatsapp/owner): `tako_whatsapp_links` senza righe per quel numero, QA senza numeri.
- Nota: la richiesta urgente «3 numeri subito» era già coperta: v164 (che contiene OWNER_PHONES_MAX=3) è online dalle 18:14:29, Victoria `max 3` verificato in lettura alle ~18:15. Nessun mini-deploy separato.
