# GOAL — Pagina demo (Tako Demo) mobile: zero crash, zero reload loop

**Stato: RISOLTO nel codice (branch `feat/site-auth-20260625`, commit 31b531f). Da validare da Manuel su iPhone reale via tunnel, poi merge→main per la produzione.**

## Problema
Su mobile (iOS Safari), aprendo `https://www.takoitalia.com/Tako%20Demo`, la pagina
diventa grigia e si ricarica in loop infinito già al caricamento: si vede il Mac, ma
prima ancora che l'interfaccia dentro il Mac finisca di caricare, la scheda si ricarica.

## Causa radice
La pagina demo (React + Babel-standalone) incorpora `Tako Showcase.html`, che carica
**3 iframe live** (dashboard + 2 app), ognuno di nuovo React *development* +
Babel-standalone a runtime. Totale = **4 contesti React/Babel annidati** su una scheda.
Su iOS il limite di memoria per-tab viene sfondato → WebKit uccide e ricarica la scheda
→ ricrash → **loop**. (Nessun reload da JS: gli unici `location.reload()` sono in
handler di login; nessun service worker; nessun meta-refresh.)

Confondenti scoperti strada facendo:
1. Il **live non ha il fix** (è su branch, non su `main`/Cloudflare Pages) → Manuel
   vedeva sempre la versione vecchia.
2. Il tunnel `deploy-mobile` usa **browser-sync**, il cui live-reload può ricaricare da
   solo sul tunnel → confondeva il test. Sostituito con tunnel **statico puro**.
3. Primo tentativo di rilevamento mobile con `Math.min(innerWidth,innerHeight)<=900`:
   **bug**, i desktop hanno viewport alto ~900px → venivano trattati come mobile.
   Corretto: discrimina per **larghezza** (`innerWidth<=820`) e **puntatore coarse**.

## Fix
Preserva IDENTICO il design (Mac + dashboard + telefoni + hold→reveal), ma su mobile
sostituisce gli iframe live con **screenshot statici** → zero contesti annidati.
- `Tako Showcase.html`: gli iframe usano `data-src`; `window.__takoMobile` (robusto:
  `?mobile` OR pointer coarse OR `innerWidth<=820`, con fallback "statico" in caso di
  errore) decide. Se mobile → sostituisce ogni iframe con `<img>` (assets/showcase-dash,
  showcase-app-it, showcase-app-en). Se desktop → carica gli iframe dal `data-src`.
  Stesso flag guida anche la classe di layout `mobile-stage`.
- `tako-trial.jsx`: rimosso il tentativo provvisorio (hero mobile a 1 solo iPhone, che
  snaturava la sezione); torna a incorporare lo Showcase (ora leggero su mobile).
- Screenshot generati con Chrome headless dalle pagine reali (dashboard + app IT/EN).

## Verifica (Chrome headless, server statico :8080)
- [x] Showcase 390px (senza `&mobile`): `<body>` ha `mobile-stage`, **0 iframe**, **3 img**.
- [x] Showcase 1440px desktop: **niente** `mobile-stage`, iframe live caricati.
- [x] Reload-probe: la pagina demo a 390px si carica **1 volta** in 9s → nessun loop JS.
- [x] Tunnel statico serve il fix, **nessuna** iniezione browser-sync.
- [ ] Validazione su iPhone reale di Manuel (via tunnel statico).
- [ ] (produzione) merge `feat/site-auth-20260625` → `main` → deploy Cloudflare Pages.

## Note di certezza
Il crash di memoria iOS non è riproducibile su Chrome desktop; la certezza deriva dal
fatto che su mobile **non viene più caricato alcun contesto React/Babel annidato** (solo
immagini statiche), quindi non c'è nulla che possa saturare la memoria, e il reload-probe
esclude un loop lato codice. Manca solo la conferma sul device fisico.
