# DEPLOY-FOTO-1022 — foto WhatsApp senza codec WASM (branch `fix/foto-whatsapp-1022`)

Scritto il 22/10/2026 mattina, **nulla eseguito**. Deploy SOLO di notte (avvio a freddo ~70 s), lo decide Manuel.

## Causa (misurata)
Log edge (Management API, sola lettura): 21/10 12:42:30 e 22/10 08:08:43 / 08:09:21 la funzione muore con
**`CPU Time exceeded`** ~1,2–1,5 s dopo `image_install_complete`, cioè dentro il codec ImageMagick WASM
(compilazione 15 MB + `downscale` + seconda ricodifica). La foto di Fede è JPEG progressivo 1080×1920 = 2,07 MP, appena
sopra il tetto di 2 MP: due passate WASM. In locale (Node) la sola riduzione costa ~220 ms CPU; sull'edge, sommata
all'avvio della richiesta, sfora i 2 s di CPU → 546 `WORKER_RESOURCE_LIMIT`, nessuna risposta, nessuna riga errori.

## Fix
- `image-store.ts` `passthroughImage`: JPEG ≤ 3 MB, lato ≤ 2560, ≤ 4,2 MP (PNG/WebP ≤ 2 MP) → salvata senza ricodifica,
  metadati tolti in JS (0,3 ms). Rotazione EXIF, CMYK, WebP con EXIF/XMP, byte dopo l'EOI, foto più grandi → codec come prima.
  Attivo solo con `saveImageBuffer(..., {passthrough:true})` = canale WhatsApp; dashboard invariata.
- `twilio-menu.ts` `prepareUpload`: prova prima il passthrough; ogni guasto non dovuto alla foto → `tako_whatsapp_errors`
  kind `photo_failed` (oltre alla risposta già prevista); `attachPhoto` non è più un `catch(()=>null)` muto.

## Passi (notte)
```bash
cd /Users/manuel/Projects/Tako/Tako-foto-fix
ln -sf ../Tako-live-edge/.env.web .env.web                       # come in Tako-bot-anthropic (serve a deploy-projection)
RB=~/.config/tako-webapp/rollback-edge-20261021
node scripts/serverless/check-active.mjs --local                 # attiva deve essere v151 (commit 72dcad41); se no: STOP
taskpolicy -b node scripts/serverless/build-operational-candidate.mjs        # {"build":"PASS",...,"deployed":false}
taskpolicy -b node scripts/serverless/verify-candidate-lazy-boot.mjs | head -c 200   # "passed":true
node scripts/serverless/bundle-sections-diff.mjs $RB/candidate-index-v151.ts
#   atteso: onlyOnline=[] onlyLocal=[] changedApp = image-store.ts, twilio-menu.ts (+ edge-image-initializer.ts: solo il nome
#   della cartella temporanea di build, verificato 22/10). Altro → STOP.
cp $RB/candidate-index-v151.ts $RB/rollback-v151.ts             # copia di rollback (già presente come candidate-index-v151.ts)
cp release/serverless/candidate/index.ts $RB/candidate-index-foto-1022.ts
node scripts/translations/deploy-projection.mjs                  # {"projectionDeploy":"PASS"}
node scripts/serverless/wait-edge-ready.mjs                      # ready:true (attendere fino a ~70 s)
```

## Verifica dal vivo (QA, numero collegato SOLO al QA)
```bash
S=/private/tmp/claude-501/-Users-manuel-Documents-brain/0ac2f7ea-0f82-477c-b933-6aec24f124d5/scratchpad
node $S/foto-probe.mjs        # con didascalia «Metti questa foto su riso giallo»
#   atteso: HTTP 200, risposta «Confermato… Riso giallo: nuova foto», «dopo» con image /uploads/26050ecd…/xxxxxxxxxxxxxxxx.jpg
node $S/foto-probe.mjs solo   # senza didascalia → HTTP 200 «Per quale piatto è?»; poi rispondere ANNULLA (via probe/bot QA)
```
Poi togliere la foto dal riso giallo del QA dal bot QA («togli la foto dal riso giallo») o dalla dashboard QA — **mai SQL**.
Controllo log: nessun `CPU Time exceeded` nella finestra della prova; `tako_whatsapp_errors` senza nuove righe `photo_failed`.

## Rollback
```bash
cp $RB/candidate-index-v151.ts release/serverless/candidate/index.ts && node scripts/translations/deploy-projection.mjs && node scripts/serverless/wait-edge-ready.mjs
```

## Rischi aperti
- Foto oltre i limiti (WhatsApp HD 4096 px, foto da galleria > 3 MB, rotazione EXIF): ancora codec WASM → possono ancora
  sforare la CPU. Da misurare sull'edge; eventuale passo successivo: riduzione lato client/worker o rifiuto con messaggio.
- Un crash per risorse resta non catturabile: nessuna riga errori in quel caso (il 546 si vede solo nei log edge).
- Il guasto foto ora conta per l'avviso «≥3 errori in 10 minuti» a Manuel (max 1 all'ora).

## Esito deploy 22/10 13:45 (giorno, autorizzato da Manuel) — KO, rollback a v151
- 13:44 online API v154 ezbr 7221cb7b (= bundle v151). Build PASS, lazy boot PASS (sha 6dec8505…), diff sezioni: solo
  image-store.ts, twilio-menu.ts, edge-image-initializer.ts (nome cartella temp); alerts = solo tipo. Copia `candidate-index-foto-1022.ts`
  in `~/.config/tako-webapp/rollback-edge-20261022/`.
- 13:45 deploy → API **v155** ezbr 51ccee47, pronto in 13 s. Smoke: /api/auth/me 401, webhook senza firma 403, bot risponde (4,6 s).
- 13:46 foto-probe con didascalia: HTTP 200 ma «*Foto non pubblicata*: salvataggio immagini edge non ancora disponibile»;
  riso giallo QA resta senza foto; 2 righe `photo_failed` «salvataggio: EDGE_STORAGE_QUOTA_REQUIRED» (11:46:20 UTC).
- **Causa (bug del fix):** con il passthrough (`direct`) non si chiama più `configuredEdgeInitializer()`, che in
  `edge-image-initializer.ts:44` configura sia il codec sia la QUOTA durevole (`configureImageQuota`). Su edge a freddo
  `configuredEdgeQuota` resta undefined → `EDGE_STORAGE_QUOTA_REQUIRED`. Correzione: separare l'init della quota dal codec
  (o chiamare l'initializer/un init solo-quota anche nel ramo passthrough, senza compilare il WASM) + test che lo copra a freddo.
- 13:46 **rollback** `rollback-v151.ts` → API **v156** ezbr 7221cb7b (identico a v154), pronto in 15 s. Smoke 401/403/bot 8 € OK.
  QA invariato (nessuna foto scritta → niente da togliere). Batterie non eseguite.

## Esito deploy 22/10 13:56 (secondo tentativo, commit 45f63d36) — OK, online v157
- Fix: `initializeEdgeImageQuota` (edge-image-initializer.ts) = stessi controlli in sola lettura (seed + funzioni SQL) +
  `configureImageQuota`, senza codec/WASM; esportato dall'entry immagini (nessun import magick, nessun download WASM, errore
  non memorizzato) e registrato in candidate-entry con `configureImageQuotaInitializer`. `saveImageBuffer` sull'edge senza
  quota lo chiama prima del controllo quota (fallback: initializer completo; se fallisce resta EDGE_STORAGE_QUOTA_REQUIRED).
  Test edge a freddo (initializer completo e codec che esplodono) → foto salvata; senza il fix il test fallisce.
- Build PASS, lazy boot PASS (sha 4ac41fb1…), diff vs v151: image-store, twilio-menu, edge-image-initializer, fetch-bridge
  (= coda del bundle con l'entry: solo le due tappe `*_image_quota_initializer`). Copia `candidate-index-foto-1022b.ts`.
- deploy → **v157**, pronto in 19 s. Smoke: /api/auth/me 401, webhook senza firma 403, bot «riso giallo 8 €».
- foto-probe: HTTP 200 «Confermato… riso giallo: nuova foto», pubblicato `/uploads/26050ecd…/KNij0J7PwgCe79ow.jpg`
  → 200 image/jpeg 66 009 byte. `solo`: HTTP 200 «Per quale piatto è?» → ANNULLA ok.
- «togli la foto al riso giallo» → il bot NON sa togliere le foto («Le foto dei piatti non si tolgono da qui»): la foto
  resta sul riso giallo del QA (da togliere dalla dashboard QA; niente SQL). Possibile funzione bot da aggiungere.
- Batteria dal vivo ×2 (v157-foto-a / -b): 27/27 e 27/27, 0 GRAVI, QA identico. `tako_whatsapp_errors`: 0 righe nuove.
- Rollback pronto: `~/.config/tako-webapp/rollback-edge-20261022/rollback-v151.ts` (procedura sopra).
