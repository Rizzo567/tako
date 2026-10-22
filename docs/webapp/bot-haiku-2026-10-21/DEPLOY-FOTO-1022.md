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
