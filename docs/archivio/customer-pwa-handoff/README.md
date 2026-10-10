# Handoff: Tako — PWA Cliente (ordine al tavolo) — v2, SOSTITUZIONE UI

## ⚠️ Obiettivo di questo handoff
Nel codebase esiste **già un'interfaccia cliente funzionante con backend collegato**. Questo bundle è la **nuova UI che la sostituisce integralmente**:
1. **Sostituisci** l'interfaccia cliente esistente (viste, componenti, stili) con quella descritta qui.
2. **Mantieni il backend esistente** (endpoint, Socket.io, modelli dati). Dove la nuova UI introduce funzioni che il backend non copre ancora (vedi "Delta backend" sotto), **adatta il backend**, non la UI.
3. Riusa gli store/le utility già presenti dove compatibili; i contratti attesi dalla nuova UI sono documentati sotto.

### Delta backend richiesto dalla nuova UI
- **Multilingua menù/UI** (`it|en|es|de`): la UI seleziona la lingua da uno sheet dedicato (pulsante "Language" nell'header). Le stringhe UI sono client-side, ma **nomi/descrizioni piatti tradotti** dovrebbero arrivare dal menù API (aggiungi campi `name_i18n`/`desc_i18n` o endpoint `?lang=`). **Importante**: gli ordini inviati al backend/dashboard restano con i nomi canonici italiani.
- Nessun altro cambiamento di contratto: ordini, waiter-call, tracking e chat AI usano gli endpoint già esistenti (tabella sotto).

## Overview
Interfaccia cliente di **Tako**, il sistema operativo del ristorante. Il cliente scansiona il QR del tavolo, apre la web app sul telefono (nessuna app da scaricare), sfoglia il menù, ordina, traccia l'ordine in tempo reale, chiama il cameriere, paga, e può chattare con un assistente AI. **Mobile-first puro, verticale, una mano sola.**

Direzione: **minimal ma ultra-animato**. Pochissimo cromo, molto bianco, gerarchia tipografica forte, palette ristretta (neutri caldi + 1 colore brand configurabile a runtime). Il movimento è la personalità del prodotto: tutto entra/esce/reagisce con motion fisico.

---

## About the Design Files
I file in questo bundle (`Tako App.html` + i `tako-*.jsx`) sono **riferimenti di design realizzati in HTML/React puro con Babel in-browser** — prototipi che mostrano look e comportamento previsti, **non codice di produzione da copiare**. L'animazione è ottenuta a mano (CSS keyframes + Web Animations API + transizioni), perché il prototipo non aveva una toolchain.

Il compito è **ricreare questi design nell'app reale**, nel suo ambiente già stabilito:
**Next.js 15 · React 19 · TypeScript · Tailwind CSS · Zustand · Socket.io-client · Lucide React · react-hot-toast**, aggiungendo **Framer Motion (`motion/react`)** per il motion.

Usa i pattern, i componenti e le convenzioni già presenti nel codebase. Dove il prototipo usa stili inline, traducili in classi Tailwind + CSS variables. Dove usa store fatti a mano, usa gli **store Zustand reali** (contratti sotto). Dove simula `/api` e Socket.io, **collega gli endpoint e gli eventi reali** (contratti sotto).

---

## Fidelity
**High-fidelity.** Colori, tipografia, spaziature, raggi, ombre e interazioni sono finali. Ricrea la UI fedelmente usando le librerie del codebase. Le animazioni sono parte integrante del design: vanno riprodotte (specifiche dettagliate più sotto).

---

## Tech mapping (prototipo → produzione)

| Nel prototipo | In produzione |
|---|---|
| Store fatti a mano (`makeStore` + `useSyncExternalStore`) | **Zustand** stores `cart` e `session` (+ uno `order` per il tracking) con `persist` |
| `fetch`/dati mock | **axios** istanza `baseURL: '/api'`, `withCredentials: true` |
| `setInterval` che avanza lo stato ordine | **Socket.io** evento `order:updated` |
| Animazioni CSS/WAAPI a mano | **Framer Motion** (`motion/react`): `motion.*`, `AnimatePresence`, `layout`, `whileTap`, `useSpring`/`useMotionValue` |
| `Icon` con path SVG inline | **lucide-react** (mapping icone sotto) |
| `toast()` custom | **react-hot-toast** |
| Bottom sheet custom con swipe | Sheet con `AnimatePresence` + drag (`drag="y"`, `dragConstraints`, `onDragEnd` con soglia) — oppure vaul/radix se già in uso |
| `Intl.NumberFormat` | identico: `Intl.NumberFormat('it-IT', { style:'currency', currency:'EUR' })` |

**Lingua UI: italiano.** Tutte le stringhe del prototipo sono finali e vanno mantenute.

---

## Design Tokens

Definiti come CSS variables su `:root`. Il **colore brand è dinamico** (per-ristorante): impostalo a runtime via CSS variable `--brand`, **mai hardcodato**. `--on-brand` si calcola dalla luminanza del brand (testo bianco se scuro, ink se chiaro).

```css
:root {
  /* Brand (override a runtime per ristorante) */
  --brand:       #ED7159;   /* default */
  --brand-deep:  mix(brand, #140C0A, 20%);   /* hover/pressed, calcolato */
  --brand-tint:  mix(brand, #fff, 82%);       /* pill nav, badge wash, calcolato */
  --brand-wash:  mix(brand, #fff, 90%);       /* sfondi soft, calcolato */
  --on-brand:    luminance(brand) > 0.62 ? #2A1F1A : #FFFFFF;

  /* Superfici — neutri caldi */
  --surface: #FBF8F4;   /* base pagina */
  --raised:  #FFFFFF;   /* card, header, sheet */
  --sunken:  #F4EEE7;   /* input, stepper, chip neutri */
  --hairline:#ECE3D9;   /* divisori, bordi 1px */

  /* Testo */
  --ink:   #2A1F1A;     /* primario */
  --ink-2: #6B5A50;     /* secondario */
  --ink-3: #9A8B82;     /* terziario / placeholder */

  /* Stati */
  --ok:     #4FA882;    /* successo: Pronto, online, conferme */
  --warn:   #E0A23C;
  --danger: #DC4C3E;

  /* Raggi */
  --r-input: 12px;
  --r-card:  18px;
  --r-sheet: 26px;
  --r-pill:  999px;

  /* Ombre soft a livelli */
  --sh-1: 0 1px 2px rgba(42,31,26,.05), 0 2px 6px rgba(42,31,26,.04);
  --sh-2: 0 2px 8px rgba(42,31,26,.06), 0 8px 24px rgba(42,31,26,.07);
  --sh-3: 0 8px 24px rgba(42,31,26,.10), 0 20px 50px rgba(42,31,26,.14);
  --sh-sheet: 0 -10px 40px rgba(42,31,26,.16);
}
```

### Layout / contenitore
- Mobile-first, colonna centrata `max-width: 440px` (≈ `max-w-lg`), che riempie il viewport su mobile.
- Su desktop appare come "telefono": angoli arrotondati 30px + ombra; altezza `min(100%, 920px)`.
- **Safe-area aware**: `env(safe-area-inset-top/bottom)` su header e bottom nav.
- Touch target ≥ 44px.
- Installabile come PWA standalone (`apple-mobile-web-app-capable`, `theme-color`, `viewport-fit=cover`).

### Tipografia
- **DM Sans** (400/500/600/700) — display + body.
- **DM Serif Display** (400) — titoli chiave e **tutti i numeri grandi** (prezzi, totali, stato ordine, nome sezione menù). Classe `.serif`.
- Numeri tabulari (`font-variant-numeric: tabular-nums`) su prezzi/quantità per evitare jitter durante i count-up.
- Scala usata: titoli sezione 27px, hero stato 28px, nome piatto 16px, body 14–14.5px, didascalie 12.5–13px, label uppercase 11px (letter-spacing .06em).

---

## Screens / Views

Single-page con stack di viste. **Routing interno** (no URL change necessario, ma è ok mapparlo): `splash` → `menu` (default) → `tracking` | `chat`. **Carrello** e **chiamata cameriere** sono **bottom sheet overlay** sopra qualsiasi vista.

Struttura app shell:
- **Header "glass"** (in alto, niente barra piena): **3 pulsanti icona 3D centrati** (gap 36px), ciascuno con label 10.5px/700 sotto:
  1. **Cameriere** (sinistra, `assets/nav/m-bell.png`, 42px, idle wiggle 3.6s loop) → apre sheet chiamata cameriere;
  2. **Carrello** (centro, `assets/nav/m-bag.png`, 42px, **statico**, badge count in alto a dx) → apre carrello;
  3. **Language** (destra, `assets/nav/m-lang.png`, 42px con `scale(1.5)` dal centro — box identico agli altri, icona visivamente più grande, **statica**) → apre sheet lingua. **La label è sempre "Language", in ogni lingua.**
  Ogni pulsante ha un'animazione WAAPI al click (ring / hop / wiggle, ~850ms); per Language componi lo scale nei keyframes (`scale(1.5) rotate(…)`) così l'icona non torna piccola durante l'animazione. L'header collassa (max-height→0, translateY -84px) quando si scrolla giù (`compact`).
- **`<main>`**: vista attiva (transizione su cambio vista).
- **Bottom nav sticky** (in basso, glass blur 22px): `Menù` / `Ordine` (dot verde se ordine attivo) / `Assistente` (solo se `session.aiEnabled`), con **icone 3D PNG** (`assets/nav/m-menu.png`, `m-order.png`, `assets/tako-phone.png`), 32px (28px in compact), **statiche** (nessun loop idle); pillola `--brand-tint` che scorre dietro la voce attiva; allo scroll giù la nav si compatta (icone più piccole, label nascoste).

### 0. Sheet lingua (bottom sheet)
- **Scopo**: cambiare lingua di UI e menù (`it|en|es|de`).
- **Layout**: titolo "Lingua/Language/Idioma/Sprache" + sub; 4 righe-bottone (badge quadrato 34px col codice "IT/EN/ES/DE", nome lingua, check a destra sulla corrente). Riga attiva: sfondo `--brand-tint`, bordo `--brand`.
- **Comportamento nel prototipo**: imposta `?lang=` e ricarica. **In produzione**: cambia lingua senza reload (i18n client + rifetch menù), persisti la scelta nella sessione.

### 1. Splash / Landing (`/`)
- **Scopo**: prima schermata; istruzione a scansionare il QR.
- **Layout**: colonna centrata. Mascotte `tako-hello.png` (200px) con bob idle + 2 pulse-ring dietro; wordmark **"Tako"** in DM Serif Display 58px; sottotitolo; un **QR finto** (griglia 21×21, 3 finder pattern + moduli pseudo-casuali) 134px su card bianca; CTA full-width **"Simula la scansione"** (icona arrow-right) → entra in `menu`; caption `Demo · Trattoria da Mauro · Tavolo 7`.
- **Motion**: logo reveal (mascotte `pop-in` scala 0.5→1.08→1; testo + QR + CTA `rise-fade` staggerati con delay .15/.28/.42/.54s). **Bolle ambient** che salgono sul background (decorative, off in reduced-motion).
- In produzione il reale flusso è: scan QR → `GET /api/customer/table/{token}` risolve ristorante/tavolo/sessione → entra in `menu`.

### 2. Menu (vista default)
- **Scopo**: sfogliare e aggiungere piatti.
- **Layout**:
  - **Tab sezioni** sticky in alto, orizzontali scrollabili (Antipasti, Primi, Pizze, Dolci, Bevande). Indicatore a **pillola scura (`--ink`) scorrevole** dietro la tab attiva. Pulsante **filtro allergeni** in coda alla striscia (mostra count attivo, diventa brand quando attivo).
  - **Scroll-spy**: la tab attiva segue lo scroll; tap su tab → smooth scroll alla sezione.
  - **Lista piatti**: card `--raised`, radius `--r-card`, ombra `--sh-1`. Riga: a sinistra nome (16/700) + 1 tag, descrizione (clamp 2 righe, `--ink-2`), prezzo (15/700) + dots allergeni (emoji); a destra **tile immagine 86px** (placeholder monogram con gradiente derivato dal nome — in produzione sostituire con foto reale) e un **"+" coral** in basso a destra. Item **esaurito**: card opacità .58, overlay scuro "Esaurito", non tappabile.
- **Filtro allergeni**: bottom sheet con i 12 allergeni (toggle). Esclude (nasconde) i piatti che contengono un allergene selezionato; banner riassuntivo in cima alla lista.
- **Barra "Vedi carrello"** flottante (in basso, sopra la nav): appare con spring quando il carrello ha item; mostra **conteggio** (badge che fa pop a ogni cambio) + label + **totale in count-up**. Tap → **pennellata diagonale brand** (`cart-paint-sweep`, clip-path .72s) colora barra + riquadro, e il carrello si apre a **370ms** (mentre la pennellata è ancora in corsa).
- **Motion**: ingresso righe `item-in` (opacity 0→1, y 20→0, scale .95→1, 0.55s spring) con **stagger** (`delay ≈ sezione*0.05 + i*0.06`). Tap card → scale 0.97. Indicatore tab → spring su `transform`+`width`.

### 3. Modal piatto (bottom sheet)
- **Scopo**: configurare e aggiungere un piatto.
- **Layout**: hero immagine 188px (radius 20) con eventuali tag in overlay; nome 23/700; descrizione; sezione **Allergeni** (pill con emoji + label); **selettore varianti** (es. "Da 4 / Da 8 +€4,00", "Normale / Maxi +€3,00", "0,33 L / 0,5 L +€2,00") con **prezzo modificato live**; **note testuali** ("senza cipolla…"); barra sticky in basso con **stepper quantità** (lg) + CTA full **"Aggiungi · €(prezzo×qty)"**.
- **Shared-element**: la foto del piatto cresce nel modal (in Framer Motion usa `layoutId` condiviso tra tile lista e hero modal).
- **Add → fly-to-cart**: alla conferma, una pallina (colore = gradiente del piatto) **vola in arco** dalla foto all'icona carrello, che poi **rimbalza**; toast di conferma; sheet si chiude. (Framer: animare un `motion.div` `position:fixed` lungo keyframes x/y/scale, ~640ms `cubic-bezier(.5,0,.35,1)`; cart bounce scale 1→1.32→1 spring.)

### 4. Carrello (bottom sheet)
- **Scopo**: rivedere e confermare l'ordine.
- **Layout**: titolo "Il tuo ordine" + `Tavolo N`; lista righe (tile 52px, nome, nota in corsivo, prezzo unitario, **stepper quantità** con min 0 = rimuovi); textarea **note a livello ordine**; barra sticky con **Totale** (DM Serif 26, count-up) + CTA **"Conferma ordine"**.
- **Stato vuoto**: mascotte `tako-hugplate.png` (float idle) + "Il carrello è vuoto" + "Torna al menù".
- **Swipe-down per chiudere** (grabber in alto; drag y; soglia ~120px o velocità).
- **Conferma** → **burst di coriandoli a tutto schermo** (~26 particelle nei colori brand che esplodono verso l'alto dal basso-centro e ricadono roteando, 1.05–1.55s, `cubic-bezier(.22,.9,.35,1)`, off in reduced-motion) → `POST /api/customer/orders` (items, notes, idempotencyKey) → svuota carrello → passa a `tracking` → toast → richiede permesso notifiche.

### 5. Tracking ordine (real-time)
- **Scopo**: seguire lo stato in tempo reale.
- **Layout**:
  - **Card stato corrente** colorata (coral in corso, `--ok` se "pronto", `--ink` se "servito"); icona (clock che ruota in corso / check), `ORDINE #ID`, label stato (DM Serif 28), descrizione. Confetti su "pronto"/"servito".
  - **Stepper verticale 5 step**: `Ricevuto → Confermato → In cucina → Pronto → Servito`. Step completati: nodo brand + check (pop). Step corrente: nodo brand + ring `--brand-tint` + dot pulsante. Step futuri: numerati, ring hairline, opacità .5. Connettore tra nodi che si **riempie** (brand) sui completati.
  - **Riepilogo**: righe (qty in pill, nome, nota, subtotale) + nota ordine + **Totale** (count-up).
  - CTA **"Aggiungi altro"** → torna a `menu`.
- **Real-time**: `socket.emit('join:table', { tableId })`; su `order:updated` ({orderId, status, itemId?}) → aggiorna lo store → la card ri-anima (key=status) e lo stepper avanza. Quando `status === 'pronto'` → **notifica browser** (`Notification`, se permesso) + toast persistente.
- **Stato vuoto** (nessun ordine): mascotte `tako-cloche.png` + "Nessun ordine attivo" + "Vai al menù".

### 6. Chiamata cameriere (bottom sheet)
- **Scopo**: richiamare il personale.
- **Layout**: titolo "Chiama il cameriere" + `Tavolo N`; 3 opzioni a riga (icona in tile brand-tint + label + sub + chevron): **"Ho bisogno di aiuto"** (help), **"Vorrei il conto"** (receipt), **"Acqua, per favore"** (droplet).
- **Invio** → `POST /api/customer/waiter-call` ({ type: 'help'|'bill'|'water' }) → lo sheet passa allo **stato conferma**: check verde animato + confetti + "Fatto!" + dettaglio; auto-chiude dopo ~2.1s.

### 7. Assistente AI (chat — solo se `session.aiEnabled`)
- **Scopo**: consigli, ordini e azioni in linguaggio naturale.
- **Layout**: sub-header "Assistente" + avatar `tako-chef.png` con **dot online verde** + "online · risponde subito"; lista messaggi (bolle utente a destra brand, assistente a sinistra `--raised`); **typing indicator** a 3 punti animati; **chip suggerimenti** iniziali ("Cosa mi consigli?", "Avete piatti senza glutine?", "Ordina una margherita e due birre", "A che punto è il mio ordine?"); composer fisso in basso (input pill + send, send attivo solo con testo).
- **Action cards** dentro la chat (l'AI esegue davvero l'azione, anima l'apparizione con pop):
  - `cart_add` — card bordo `--ok`, icona bag, righe `qty× nome … prezzo`, totale. (Aggiunge al carrello.)
  - `order_placed` — card piena `--ok` + confetti + bottone "Traccia ordine" → vista tracking. (Invia l'ordine.)
  - `waiter_called` — card bordo brand + campanella + "Il cameriere è stato avvisato".
- **Reale**: `POST /api/customer/ai-chat` ({ message, history[] }) → `{ message, actions[] }`. Le `actions` ritornate dal server pilotano le action card e gli effetti collaterali (add carrello / place order / waiter call). Nel prototipo c'è un rule-engine fittizio: in produzione sostituiscilo con la chiamata reale.

---

## Interactions & Behavior — specifiche motion

Libreria: **Framer Motion** (`motion/react`). Rispetta sempre `prefers-reduced-motion` → disattiva animazioni decorative (loop, bolle, fly-to-cart, count-up), tieni solo i fade essenziali. **Anima solo `transform`/`opacity` (60fps), mai layout/reflow.**

Curve usate nel prototipo (riferimento):
- spring "bouncy": `cubic-bezier(.34,1.56,.64,1)` → in Framer `{ type:'spring', stiffness:480, damping:24 }`
- out morbido: `cubic-bezier(.22,1,.36,1)` → `{ type:'tween', ease:[.22,1,.36,1] }`

| Elemento | Animazione | Specifica |
|---|---|---|
| Tap su bottoni/card | press scale | `whileTap={{ scale: .94 }}` (card .97), spring stiffness 400 / damping 17 |
| Cambio vista | enter | opacity 0→1 + y 14→0, 340ms ease-out |
| Bottom sheet | enter/exit | da `y:'101%'` → `0`, spring stiffness 380 / damping 34; backdrop opacity 0→.42 (blur 2px). Drag `drag="y"`, `dragConstraints={{top:0}}`, chiudi se `offset.y>120 \|\| velocity.y>550` |
| Riga lista menù | stagger in | `item-in`: opacity 0→1, y 20→0, scale .95→1, 0.55s spring; `staggerChildren: .06` |
| Indicatore tab / pillola nav | slide | spring su `x` (e `width` per le tab), stiffness 500 / damping 35; ideale `layout`/`layoutId` |
| Badge carrello | pop a ogni cambio | scale 1→1.5→1, 0.45s spring (key=count) |
| Totali (carrello/tracking) | count-up | tween di un `motimeValue` da valore precedente a nuovo, ~520ms easeOutCubic, formattato in EUR |
| Add piatto | fly-to-cart + bounce | pallina fixed lungo arco foto→cart, ~640ms `cubic-bezier(.5,0,.35,1)`; cart scale 1→1.32→1 spring |
| Stato ordine cambia | re-pop card + step | card key=status (rise-fade spring); check nodo `check-pop` scala 0→1.25→1; connettore `background` transition .5s |
| Typing indicator | 3 dots | y 0→-5→0, opacity .35→1, 1.3s loop, ritardo .18s/.36s tra i punti |
| Bolla chat | enter | `item-in` 0.42s spring |
| Action card | enter | `pop-in`/`pop-soft` scala 0.5→1.06→1, 0.45s spring |
| Conferma cameriere | success | check pop + confetti; auto-dismiss 2100ms |
| Mascotte idle | bob/float | loop decorativo (off in reduced-motion) |

---

## State Management (Zustand)

### `useCartStore` — persist key `tako-cart`
```ts
type CartItem = {
  key: string;            // `${menuItemId}::${variantId??'-'}::${notes_norm}`
  menuItemId: string;
  variantId?: string | null;
  name: string;           // include " · <variante>" se la variante ha delta
  quantity: number;
  unitPrice: number;      // price base + delta variante
  notes?: string;
};
// state: items: CartItem[]; orderNotes?: string
// actions: add(item), remove(key), updateQty(key, q) (q<=0 ⇒ remove), clear()
// selectors: total = Σ unitPrice*quantity ; count = Σ quantity
```
Merge per `key`: stesso piatto+variante+nota ⇒ somma quantità.

### `useSessionStore` — persist key `tako-session`
```ts
// restaurantId, restaurantName, tableId, tableNumber, sessionId,
// aiEnabled: boolean, primaryColor: string (→ CSS var --brand), logoUrl?, orderId?
```

### `useOrderStore` — persist key `tako-order` (per il tracking)
```ts
// orderId: string|null, status: OrderStatus|null,
// items: CartItem[], notes: string, placedAt: number|null
type OrderStatus = 'ricevuto'|'confermato'|'in_cucina'|'pronto'|'servito';
```
Al place order: snapshot del carrello → order, `status:'ricevuto'`, svuota carrello. Su `order:updated` aggiorna `status`.

---

## API (axios — `baseURL: '/api'`, `withCredentials: true`)

| Endpoint | Metodo | Scopo |
|---|---|---|
| `/customer/table/{token}` | GET | Risolve QR → restaurant, table, sessionId |
| `/customer/restaurant/{id}/menu` | GET | Menù pubblico (sezioni + item + varianti) |
| `/customer/orders` | POST | Invia ordine (`items`, `notes`, `idempotencyKey`) |
| `/customer/orders/{orderId}` | GET | Dettaglio ordine |
| `/customer/waiter-call` | POST | Chiama cameriere (`type: 'help'|'bill'|'water'`) |
| `/customer/ai-chat` | POST | Chat AI (`message`, `history[]`) → `{ message, actions[] }` |

### Socket.io
- `socket.emit('join:table', { tableId })` (client → server)
- `socket.on('order:updated', ({ orderId, status, itemId? }) => …)` (server → client)

---

## Menu data model (per ricostruire i mock)
```ts
type Variant = { id: string; name: string; delta: number };  // delta in €
type MenuItem = {
  id: string; name: string; desc: string; price: number;
  allergens: AllergenId[]; tags: string[];   // 'Vegetariano'|'Consigliato'|'Piccante'|'Novità'|'Da condividere'
  available: boolean; variants?: Variant[];
};
type MenuSection = { id: string; name: string; items: MenuItem[] };
```
Allergeni (14 EU; nel prototipo usati 12) — id + emoji per i badge:
`glutine 🌾 · latte 🥛 · uova 🥚 · pesce 🐟 · molluschi 🦪 · arachidi 🥜 · soia 🫛 · noci (frutta a guscio) 🌰 · sedano 🥬 · senape 🌭 · sesamo ⚪ · lupini 🫘`.
Il filtro nasconde gli item che contengono un allergene selezionato.

**Currency:** `new Intl.NumberFormat('it-IT', { style:'currency', currency:'EUR' })` ovunque.

---

## Icone (lucide-react)
`x · plus · minus · check · chevron-left · chevron-right · chevron-down · arrow-right · arrow-left · search · filter · shopping-bag · bell · send · droplet · receipt · help-circle · clock · refresh-cw · info · sparkles · soup/utensils (Menù) · trash-2 · pencil (note)`.

---

## Assets
PNG trasparenti (brand Tako) — inclusi nella cartella `assets/`:
- `assets/nav/m-bell.png` — icona 3D campanella (header, Cameriere)
- `assets/nav/m-bag.png` — icona 3D shopping bag (header, Carrello)
- `assets/nav/m-lang.png` — icona 3D mappamondo "HI!" (header, Language)
- `assets/nav/m-menu.png` — icona 3D nav Menù
- `assets/nav/m-order.png` — icona 3D nav Ordine
- `assets/tako-phone.png` — icona 3D nav Assistente + empty state tracking
- `assets/tako-hello.png` — mascotte splash
- `assets/tako-assistant.png` — avatar assistente AI
- `assets/tako-pasta.png` — empty state carrello

Le **tile immagine dei piatti** nel prototipo sono placeholder monogram (gradiente derivato dal nome): in produzione sostituire con le **foto reali** dei piatti dal menù.

---

## Files (in questo bundle, come riferimento di codice)
- `Tako App.html` — root: token CSS, keyframes, font, scaling contenitore, mount.
- `tako-data.jsx` — menu mock, allergeni, currency locale-aware (`?lang=`), store (cart/session/order), simulazione order:updated.
- `tako-i18n.jsx` — traduzioni UI + menù (`it|en|es|de`), helper `tr/trName/trDesc/…`. **Solo il display è tradotto: i dati ordine restano in italiano canonico.**
- `tako-kit.jsx` — primitive: Icon, IconBtn, Btn, Qty (stepper), Sheet (bottom sheet + swipe), Toaster/toast, Confetti, **`confettiBurst()`** (esplosione coriandoli WAAPI), AllergenDot, Tag, hook motion (`useMountTransition`, `useReducedMotion`, `useCountUp`), `flyToCart`, `Bubbles`.
- `tako-menu.jsx` — MenuView (tab + scroll-spy + filtro + barra carrello con pennellata), ItemSheet, FilterSheet, CartSheet, Dish.
- `tako-screens.jsx` — TrackingView, WaiterSheet, ChatView + ActionCard + rule-engine fittizio.
- `tako-app.jsx` — Splash, Header glass (Cameriere/Carrello/Language), **LanguageSheet**, BottomNav, App shell (routing viste, overlay, theme dinamico, notifiche), mount.
- `tweaks-panel.jsx` — pannello demo (non necessario in produzione).
- `tweaks-panel.jsx` — pannello demo (non necessario in produzione).

> Apri `Tako App.html` in un browser per vedere il prototipo dal vivo (le animazioni girano col tab in primo piano).
