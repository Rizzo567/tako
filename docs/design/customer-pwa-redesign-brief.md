# Tako Customer PWA — Design Brief & Implementation Prompt

> Versione 2 (rivista, dettaglio massimo). Documento di specifica, non codice.
> Destinatario: chi implementerà la redesign (dev front-end + design).
> Scope: `apps/web` (customer PWA, Next.js 15, porta 3002). Nessuna modifica al codice in questo documento.

---

## 0. Design Read

Reading this as: **PWA consumer mobile-first** che il cliente apre scansionando il QR al tavolo, senza installare nulla, con linguaggio **premium-soft caldo e accogliente**, leaning verso **Tailwind + token CSS semantici + brand-color per-ristorante override + micro-motion fluida**, modalità chiara.

Questa superficie è **molto più "in-scope" della taste-skill** rispetto alla dashboard: è consumer-facing, l'estetica conta sulla prima impressione, e ogni frizione costa un ordine. Ma resta **product UI transazionale** (menu, carrello, tracking, chat), non landing page: niente hero marketing, niente scroll-telling. La taste-skill qui guida colore/tipografia/contrasto/motion/AI-tells e la cura materica, non la struttura narrativa.

**Contesto d'uso reale:** cliente seduto al ristorante, telefono in mano, spesso luce variabile, una mano sola, vuole capire il menu e ordinare in <60s. La UI deve essere **veloce, leggibile, rassicurante, bella**: è il primo contatto digitale col ristorante e ne è la firma.

**Vincolo brand:** ogni ristorante ha un `primaryColor` proprio iniettato come `--brand` (vedi `CustomerApp.tsx`). Il sistema deve essere **brandable**: coral è il default Tako, ma i token devono derivare da `--brand` così la PWA prende il colore del locale. Questo è un requisito architetturale centrale di questo brief.

**Stato attuale (audit):** `max-w-lg` centrato, sfondo cream `#FFF8F3`, accento coral, font Nunito+Quicksand, card neo-brutaliste (`border-2 border-ink/10`, hard-shadow `4px 4px 0`), bottom-bar carrello fissa, viste `menu | tracking | chat`, sheet chiamata cameriere, AI chat. Base solida ma "playful/cartoon": va portata a **premium-soft** mantenendo il calore.

---

## 1. Dials (configurazione)

| Dial | Valore | Motivazione |
|---|---|---|
| `DESIGN_VARIANCE` | **5** | Più espressiva della dashboard (è consumer) ma resta una UI ordinata: il prodotto è il cibo, non il layout. Varianza nelle foto piatto e nei momenti di transizione. |
| `MOTION_INTENSITY` | **6** | Consumer premium: transizioni di vista, add-to-cart soddisfacente, sheet con spring, tracking "vivo". La motion qui è parte dell'esperienza, non decorazione. |
| `VISUAL_DENSITY` | **3** | Mobile, una mano, lettura veloce. Arioso, gerarchia forte, target grandi. |

Traduzione della richiesta "3D dinamico animato premium da 50k": non WebGL pesante su mobile (kills battery/FPS), ma **transizioni fluide, profondità a layer, feedback tattile gratificante, brand-color vivo, foto piatto valorizzate**. Premium su mobile = velocità percepita + materia, non poligoni.

---

## 2. Sistema cromatico (Premium Soft, brandable)

### 2.1 Principio
Base neutra calda + **accento = `--brand` del ristorante** (default coral Tako). Un solo accento, derivato dal brand. Il neutro non cambia tra ristoranti; cambia solo l'accento e i suoi derivati.

### 2.2 Token semantici (in `globals.css`)

```
--brand            var(--brand-raw, #ED7159)   iniettato runtime da CustomerApp
--brand-hover      color-mix(in srgb, var(--brand) 88%, black)
--brand-pressed    color-mix(in srgb, var(--brand) 78%, black)
--brand-tint       color-mix(in srgb, var(--brand) 10%, white)   sfondi soft, badge
--brand-ring       color-mix(in srgb, var(--brand) 32%, transparent)
--on-brand         #FFFFFF   (verificare contrasto: vedi 2.4)

--surface-base     #FBF8F4   sfondo app
--surface-raised   #FFFFFF   card, sheet, bottom-bar
--surface-sunken   #F4EEE7   input, chip non attivi, tracce

--border-subtle    rgba(42,31,26,0.08)
--border-default   rgba(42,31,26,0.14)

--text-primary     #2A1F1A
--text-secondary   #6B5A50   (AA su surface)
--text-tertiary    #9A8B82   (solo ≥14px)
--on-brand         #FFFFFF

--status-success   #4FA882
--status-warning   #E0A23C
--status-danger    #DC4C3E
```

`color-mix` permette di derivare tinta/hover/pressed da QUALSIASI `--brand` ristorante senza ricalcolare a mano. Fallback statico coral se il browser non supporta (raro, ma metti il `--brand-raw`).

### 2.3 Uso
- L'accento (`--brand`) è l'unico colore azionabile: CTA "Aggiungi", "Ordina", badge prezzo attivo, vista attiva nella nav.
- Status (success/warning/danger) solo per stati ordine/feedback, mai come azione.
- Niente AI-purple, niente glow neon, niente gradiente arcobaleno.

### 2.4 Contrasto su brand variabile (regola critica)
Poiché `--brand` è arbitrario (un ristorante può avere giallo chiaro), **non dare per scontato testo bianco leggibile sul brand**. Implementa una scelta automatica del colore testo:
- Calcola la luminanza di `--brand`; se chiara → testo `--text-primary` sul bottone, se scura → bianco.
- In pratica: definisci `--on-brand` calcolato (o due classi e scegli a runtime in CustomerApp dove già si legge `primaryColor`).
- **Button Contrast Check obbligatorio** anche con brand giallo/lime/ciano chiari.

---

## 3. Tipografia

### 3.1 Stack
Allineamento alla dashboard per coerenza di marca, ma su mobile la leggibilità vince: **DM Sans** come UI/body, **DM Serif Display** per i momenti "premium" (nome ristorante in header, prezzo grande, titolo categoria). Carica via `next/font` (già il pattern). Pesi minimi necessari (perf mobile).

| Ruolo | Font | Uso |
|---|---|---|
| Nome ristorante / titolo categoria / prezzo hero | DM Serif Display | momenti di calore editoriale |
| Nome piatto, descrizione, UI, prezzo riga | DM Sans 400-600 | tutto il resto |
| Prezzi / quantità / totali | DM Sans `tabular-nums` | carrello, totale bottom-bar |

Abbandona Nunito/Quicksand `font-black` diffuso. Gerarchia con peso+colore+size, non tutto in 900.

### 3.2 Scala mobile
```
display   1.5rem  DM Serif         nome ristorante header, totale
title     1.125rem DM Sans 600     nome piatto, titolo categoria sticky
body      0.9375rem DM Sans 400    descrizione piatto
price     1rem DM Sans 600 tnum    prezzo
meta      0.75rem DM Sans 500      allergeni, tempo, hint (su secondary)
```

---

## 4. Forma, elevazione, spaziatura

### 4.1 Shape Lock
```
--r-input   12px
--r-card    18px     (un filo più morbido della dashboard: consumer, accogliente)
--r-sheet   24px     (top corners delle bottom sheet)
--r-pill    999px    bottoni, chip categoria, badge, quantità stepper
--r-photo   16px     foto piatto
```

### 4.2 Elevazione (morbida, tinta)
Via le hard-shadow `4px 4px 0`. Entra:
```
--elev-1  0 1px 3px rgba(42,31,26,.06), 0 1px 2px rgba(42,31,26,.04)   item-card
--elev-2  0 4px 16px rgba(42,31,26,.08)                                sheet, bottom-bar, card attiva
--elev-3  0 -6px 24px rgba(42,31,26,.10)                               bottom-bar/sheet (ombra verso l'alto)
--elev-brand  0 6px 20px var(--brand-ring)                            CTA primaria
```
Bottom-bar e sheet proiettano ombra **verso l'alto** (`--elev-3`): galleggiano sul contenuto, segnale premium.

### 4.3 Layout
- `max-w-lg mx-auto` confermato (mobile-first, leggibile anche su tablet/desktop centrato).
- Padding contenuto `px-4`, `py-5`. Safe-area: `safe-bottom` già presente, mantieni su bottom-bar e sheet.
- Spazio per la bottom-bar: `padding-bottom` del contenuto = altezza bar + safe-area, così l'ultimo piatto non resta coperto.

---

## 5. Viste & flusso (interventi per schermata)

### 5.1 Boot / loading
Già curato (logo card + pulse). Premium-soft: card logo `--elev-2`, raggio `--r-card`, shimmer al posto del solo pulse, micro fade-in del nome ristorante in DM Serif. Skeleton del menu (categorie + 3 card piatto shaped) invece di spinner se il fetch menu tarda.

### 5.2 Header
- `surface-raised` con `backdrop-blur` + `bg-white/85` quando si scrolla (sticky, profondità).
- Nome ristorante in DM Serif `display`, logo a sinistra, numero tavolo come chip `brand-tint`.
- Azioni (chiama cameriere, vista) come icone pill target ≥44px.

### 5.3 MenuView (cuore dell'esperienza)
- **Categorie:** chip pill sticky in alto, scroll orizzontale snap, attiva = `bg-brand text-on-brand`, inattiva = `surface-sunken text-secondary`. Niente decorative dots.
- **Card piatto:** `item-card` ridefinita: `surface-raised`, `border 1px subtle`, `--r-card`, `--elev-1`. Layout: foto a sinistra `--r-photo` `object-cover` aspect 1:1 (o full-width sopra per piatti hero), nome DM Sans 600, descrizione `body` `--text-secondary` (max 2 righe, `line-clamp-2`), prezzo `tabular-nums`, badge allergeni/veg come chip mini.
- **Foto piatto = asset primario.** Se manca foto: placeholder elegante (iniziale piatto su `brand-tint`, NON icona generica). Mai card testo-only spoglia. (Le foto reali vengono dall'upload ristoratore già supportato.)
- **Add to cart:** tap card apre sheet dettaglio (varianti/note) OPPURE quick-add `+` se piatto senza varianti. Il `+` fa: micro-scale bump + il prodotto "vola" verso la bottom-bar (Motion `layoutId`/transform) + contatore carrello fa spring bump. Feedback gratificante = conversione.
- **Filtro allergeni:** già presente; renderlo chip pill toggle in una sheet filtro, stato attivo `brand`.

### 5.4 CartView (sheet)
- Bottom sheet `--r-sheet` top corners, `--elev-2`, drag-to-dismiss, scrim `ink/55`.
- Righe prodotto con stepper quantità pill (`- N +`), prezzo riga `tabular-nums`, swipe-to-remove o tasto rimuovi.
- Totale in DM Serif `display`, `tabular-nums`.
- CTA "Ordina" full-width pill `bg-brand`, `--elev-brand`, sticky in fondo alla sheet. Stati: idle / loading (spinner inline + label "Invio...") / success (check + transizione a tracking).
- Empty cart: composizione bella (illustrazione semplice o icona piatto su brand-tint + "Il carrello è vuoto, scegli qualcosa di buono"), non riga vuota.

### 5.5 OrderTracking (il momento "vivo")
- Timeline stati ordine (ricevuto → in preparazione → pronto → servito) come **stepper verticale** con nodo attivo che pulsa in `--brand`, connettori che si riempiono.
- Stato corrente in card `--elev-2`, tempo stimato `tabular-nums`.
- Aggiornamenti realtime (socket): cambio stato entra con spring + flash `brand-tint`. Comunica "sta succedendo ora".
- Pulsante "Chiama cameriere" e "Conto" sempre accessibili.

### 5.6 Sheet chiamata cameriere
- Bottom sheet con 3 azioni grandi (Aiuto / Conto / Acqua), ognuna card pill target grande, icona + label.
- Conferma: toast premium (già react-hot-toast). Mantieni l'emoji 🔔 SOLO qui (vibe social-native consentita per conferma giocosa; altrove emoji off per premium).

### 5.7 AiChat
- Bolle messaggio: utente `bg-brand text-on-brand` allineate a destra `--r-card`; AI `surface-raised border-subtle` a sinistra. `tabular-nums` per prezzi citati.
- Input pill in basso `--elev-2`, invio brand. Typing indicator a 3 dot pulsanti (qui i dot SONO stato semantico, ok).
- Empty: suggerimenti rapidi come chip ("Cosa mi consigli?", "Avete piatti vegani?").

---

## 6. Motion & dimensionalità (layer premium, mobile-safe)

Tutto gated da `prefers-reduced-motion`. Libreria Motion (`motion/react`). Animare solo `transform`/`opacity` (FPS mobile).

1. **View transition** (menu↔tracking↔chat): cross-fade + slide 240ms `cubic-bezier(.16,1,.3,1)`.
2. **Add-to-cart:** bump scale + elemento che vola in bottom-bar (`layoutId`), contatore spring (`stiffness 300, damping 22`).
3. **Bottom sheet:** entra con spring dal basso, drag-to-dismiss con resistenza, scrim fade.
4. **Tracking realtime:** nodo attivo pulse soft, cambio stato spring + flash.
5. **Card press:** `active:scale(.98)` tattile su tutto il cliccabile.
6. **Sticky header:** blur/ombra appaiono al primo scroll (IntersectionObserver, NON `window.scroll` listener).
7. **Skeleton shimmer** invece di pulse.
8. **Dimensionalità no-WebGL:** profondità a layer (sheet sopra contenuto sfocato leggermente, `--elev-3` verso l'alto). Niente parallax puntatore (è touch). Eventuale micro-tilt 3D sulla card piatto hero al press, sottile.

**Motion claimed = motion shown:** MOTION 6 deve vedersi (view transition + add-to-cart + sheet spring minimo). Se non implementabile bene, scendi a 3 e spedisci pulito; mai motion rotta.

Perf: lazy-load AiChat e OrderTracking (non above-the-fold all'apertura su menu). Foto piatto `next/image` con sizing corretto, LCP < 2.5s sul menu.

---

## 7. PWA, performance, accessibilità (gate finale)

- [ ] **Brandable:** ogni token accento deriva da `--brand`; testato con brand chiaro (giallo) e scuro (navy) — contrasto AA su CTA in entrambi.
- [ ] **Contrasto AA** su testo/CTA/form, anche con brand custom (logica `--on-brand` per luminanza).
- [ ] **Target touch ≥44px** ovunque (una mano, mobile).
- [ ] **Stato ordine mai solo-colore** (label + icona).
- [ ] **Zero em-dash** in tutta la UI e nei testi.
- [ ] **Zero hard-shadow neo-brutaliste** residue.
- [ ] **Un solo accento** (brand), una scala raggi, un tema (chiaro).
- [ ] **Reduced-motion** testato. **Safe-area** su bottom-bar/sheet (notch/home-bar iOS).
- [ ] **Viewport stable:** `min-h-[100dvh]` mai `h-screen` (barra Safari mobile).
- [ ] **`tabular-nums`** su tutti i prezzi/quantità/totali.
- [ ] **Skeleton/empty/error** per ogni vista (menu, cart, tracking, chat).
- [ ] **Foto piatto** valorizzate, placeholder elegante quando assenti, mai card testo-spoglia.
- [ ] **Emoji** solo nella conferma cameriere; off altrove (registro premium).
- [ ] **`themeColor`/manifest** allineati al brand quando possibile.
- [ ] Core Web Vitals: LCP<2.5s (menu), INP<200ms (add-to-cart), CLS<0.1 (riserva spazio foto/font).

---

## 8. Strategia di implementazione (per il dev)

1. **Token brandable:** riscrivi `:root` in `apps/web/src/app/globals.css` con token semantici derivati da `--brand` via `color-mix` (§2.2). Aggiungi logica `--on-brand` per luminanza in `CustomerApp` dove già si setta `--brand`.
2. **Componenti:** ridefinisci `.btn-coral`(→`.btn-brand`), `.item-card`, `.card`, `.input`, `.badge*`, `.bottom-bar`, `.skeleton` sui nuovi token (§4-5). Mantieni i nomi classe dove possibile per non toccare i `.tsx`.
3. **Font:** porta DM Sans + DM Serif in `layout.tsx` (sostituendo Nunito/Quicksand).
4. **Per-vista:** rifinisci MenuView → CartView → OrderTracking → AiChat (§5), partendo dal menu (massimo impatto).
5. **Motion:** aggiungi il layer Motion incrementale (§6), un effetto alla volta con reduced-motion. Priorità: view transition + add-to-cart.
6. **QA:** checklist §7 su device reale, brand chiaro e scuro, reduced-motion, offline (PWA locale).

70% del valore: token brandable + ridefinizione componenti + MenuView (passi 1-2-4). Basso rischio, no logica toccata.

---

## 9. Riepilogo prompt (versione condensata per esecuzione)

> Redesign `apps/web` (PWA cliente) in direzione **premium-soft chiaro e brandable**. Deriva tutti i token accento da `--brand` (colore del ristorante, già iniettato) via `color-mix`, con logica `--on-brand` per garantire contrasto AA del testo CTA su qualsiasi brand. Sostituisci i token grezzi con semantici (`surface-*`, `text-*`, `border-*`, `brand-*`, `status-*`). Abbandona hard-shadow neo-brutaliste e `font-black` per ombre morbide tinte, una scala raggi più morbida (card 18 / sheet 24 / pill / photo 16), tipografia DM Serif (momenti premium) + DM Sans (UI) con tabular-nums sui prezzi. Valorizza le foto piatto come asset primario con placeholder elegante. Rifinisci le viste: MenuView (categorie chip sticky, card piatto premium, add-to-cart gratificante che vola nel carrello), CartView (bottom sheet drag-dismiss, stepper, totale DM Serif), OrderTracking (stepper verticale vivo con realtime spring+flash), AiChat (bolle brand/surface, chip suggerimenti). Motion layer mobile-safe gated da reduced-motion: view transition, add-to-cart fly + spring counter, sheet spring, tracking realtime, sticky header blur via IntersectionObserver (mai window.scroll). Solo transform/opacity, LCP<2.5s, lazy-load chat/tracking. QA: AA con brand variabile, target ≥44px, stato non solo-colore, safe-area, zero em-dash, emoji solo nella conferma cameriere.
