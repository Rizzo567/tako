# GOAL — Pagina demo (Tako Demo) mobile: no crash + interfacce animate

Branch: `feat/site-auth-20260625` (worktree `~/Projects/Tako-site-auth`).
Ultimo commit: **a101b49** (video mp4). NON mergiato su `main` → il LIVE non ha nulla di questo.

## ✅ FATTO (crash risolto, confermato su iPhone reale di Manuel: `loads=1`)
- **Causa crash**: pagina demo (React+Babel) annidava lo Showcase → dashboard + 2 app
  iframe, ognuno di nuovo React *dev* + Babel = 4 contesti annidati → memoria iOS
  sfondata → grigio + reload loop già al load.
- **Fix**:
  - `Tako Showcase.html`: iframe con `data-src`; `window.__takoMobile` ROBUSTO —
    default STATICO, carica gli iframe live SOLO su desktop certo (`pointer:fine` +
    `hover:hover` + `innerWidth>=1000`); un telefono non può soddisfarlo. Su mobile
    sostituisce gli iframe con media statici/animati. Stesso flag guida `mobile-stage`.
  - `Tako Demo.html`: React *dev* → *production* (metà memoria); hero mobile **+15px**
    (`.sim-wrap` height `calc(100vh - 185px)`); contatore reload + pannello `?debug`
    (in `tako-trial.jsx`, mostra iw/coarse/fine/hover/__takoMobile/loads).
  - **Animazione**: WebP animata PROVATA e SCARTATA (teneva tutti i frame in RAM ~100MB
    → ricrashava). Passato a **VIDEO mp4 H.264** (streaming = memoria bassa): swap crea
    `<video autoplay muted loop playsinline>` da `assets/showcase-{dash,app-it,app-en}.mp4`.
    Video generati con **AVFoundation/AVAssetWriter in Swift** (`/tmp/mkvideo.swift`,
    niente ffmpeg). Server di test con supporto **Range 206** (necessario a iOS per i video).

## 🔴 APERTO — prossimo passo (dove ci siamo fermati)
Manuel: «sul Mac non arrivano le notifiche degli ordini e delle chiamate ai camerieri».
Giusto: il video attuale del Mac è una dissolvenza tra 2 stati "pieni", NON mostra
l'ARRIVO di ordini/chiamate (il bello del demo live).

**Soluzione in corso (non ancora eseguita):** registratore Swift **WKWebView**
`/tmp/recweb.swift` (SCRITTO, non compilato/testato) che:
1. carica la vera `Tako Dashboard.html?sync` in una WKWebView (1280×800, desktop → toast),
2. inietta via `evaluateJavaScript` gli eventi del relay a tempo:
   `window.postMessage({source:'tako-sync',type:'new-order',order:{tavolo:N,items:[{name,qty}]}},'*')`
   e `{type:'waiter-call',call:{tavolo:N,motivo:'...'}}` (vedi `dashboard/app.jsx:96-127`),
3. cattura i frame in continuo (takeSnapshot) → **mp4** con AVAssetWriter → si vedono
   ordini e chiamate ARRIVARE con la notifica toast + card `isNew`.

**TODO prossima sessione:**
- [ ] `swiftc -O /tmp/recweb.swift -o /tmp/recweb` e lanciarlo:
      `/tmp/recweb "http://localhost:8080/Tako%20Dashboard.html?sync" /tmp/dash2.mp4 1280 800 14 12 dash`
      (serve il server statico :8080 attivo — vedi sotto). Verificare che i toast/ordini
      si vedano (WKWebView offscreen potrebbe dare snapshot vuoti → se sì, `cfg.afterScreenUpdates=true`).
- [ ] Sostituire `landing/assets/showcase-dash.mp4` col nuovo.
- [ ] (opzionale) Video telefoni: cliente che ordina (App.html?sync mostra menù→ordine).
      Per ora i 2 video app sono dissolvenze tra 2 frame (ok ma statiche).
- [ ] Ricaricare tunnel, far testare a Manuel (animazione + stabilità).
- [ ] Prima della produzione: rimuovere il pannello `?debug` (in `tako-trial.jsx`).
- [ ] **Produzione**: merge `feat/site-auth-20260625` → `main` (SOLO Manuel) → deploy Cloudflare Pages.

## Ambiente di test (EFFIMERO — va riavviato)
- Server statico no-store + Range: `python3 /tmp/nostore_server.py` (serve `~/Projects/Tako-site-auth/landing` su :8080).
- Tunnel: `~/.local/bin/cloudflared tunnel --url http://localhost:8080` → URL usa-e-getta.
- URL sessione (probabilmente morto): `https://kept-holidays-gateway-hunting.trycloudflare.com/Tako%20Demo.html`
- Screenshot/verifica: Chrome headless `/Applications/Google Chrome.app/...`, con `perl -e 'alarm N; exec @ARGV'` come timeout (macOS non ha `timeout`), `--autoplay-policy=no-user-gesture-required` per i video.

## Note tecniche utili
- macOS: no ffmpeg/cv2/imageio; SÌ Pillow 11.3 (webp anim), Swift 6.3 (AVFoundation), `/usr/bin/avconvert`.
- Encoder frame→mp4: `/tmp/mkvideo.swift` (compilato `/tmp/mkvideo`). Registratore live: `/tmp/recweb.swift`.
- Frame sorgente catturati in `/tmp/fr` (dash), `/tmp/app` (c,d=IT; e,f=EN).
