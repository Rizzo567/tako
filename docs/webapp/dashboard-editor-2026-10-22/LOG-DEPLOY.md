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
