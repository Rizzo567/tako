# Tako Dashboard — Design Brief & Implementation Prompt

> Versione 2 (rivista, dettaglio massimo). Documento di specifica, non codice.
> Destinatario: chi implementerà la redesign (dev front-end + design).
> Scope: `apps/dashboard` (staff app, Next.js 15, porta 3000). Nessuna modifica al codice in questo documento.

---

## 0. Design Read

Reading this as: **product UI per staff di ristorante** (non landing page), per un'utenza operativa che lavora veloce su tablet e desktop in sala/cucina/cassa, con linguaggio **premium-soft caldo**, leaning verso **Tailwind + token CSS semantici + tipografia premium**, modalità chiara dominante.

Conseguenza importante: questo è **fuori dallo scope "landing page" della taste-skill**. Si applicano le sue discipline trasversali (colore, tipografia, contrasto, motion, AI-tells) ma NON i pattern da marketing (hero, bento narrativo, logo wall, scroll-telling). Le dashboard vogliono densità, leggibilità, gerarchia, zero attrito.

**Problema dichiarato dall'utente:** "i colori della dashboard sono troppo scuri". Causa reale identificata in audit: la **Sidebar** usa `bg-ink` (`#2A1F1A`, espresso scuro) con testo cream. Tutto il resto è già chiaro (sfondo cream `#FFF8F3`). La percezione di "scuro" nasce dallo slab laterale fisso a tutta altezza che domina ogni schermata.

**Direzione scelta:** `Premium soft`. Il tema esiste già nel codice (`[data-theme="premium"]` in `globals.css`) ma non è attivato globalmente e non copre la sidebar né alcune pagine. Questo brief lo promuove a **default**, lo estende e lo rifinisce.

---

## 1. Dials (configurazione)

| Dial | Valore | Motivazione |
|---|---|---|
| `DESIGN_VARIANCE` | **3** | Product UI: gerarchia prevedibile, griglie regolari, niente asimmetrie artistiche. La varianza vive nei dati, non nel layout. |
| `MOTION_INTENSITY` | **4** | Micro-interazioni fluide e feedback tattile. Niente scroll-hijack. Animazioni funzionali (stato, transizioni, arrivo ordini), non decorative. |
| `VISUAL_DENSITY` | **5** | Cockpit moderato. Tablet in sala = leggibile a distanza; desktop cassa/KDS = denso ma respirato. |

La richiesta dell'utente di "siti 3D dinamici animati premium da 50k" si traduce qui non in WebGL gratuito, ma in **profondità materica e movimento intenzionale**: elevazione a layer, parallax micro su hover, transizioni di stato con spring physics, numeri che contano (count-up), skeleton che respira. Premium = restraint, non fuochi d'artificio.

---

## 2. Sistema cromatico (Premium Soft — chiaro)

### 2.1 Principio
Una base neutra calda (cream/sand/ink desaturato) + **un solo accento** (coral). Lo scuro `ink` smette di essere superficie e torna a essere **solo testo e bordi**. Nessuna superficie scura permanente, eccetto due eccezioni motivate (vedi 2.4).

### 2.2 Token semantici (da definire in `globals.css` come default `:root`)

Migrazione da token "grezzi" (coral/ink/cream) a **token semantici**. Questo è il cuore tecnico della redesign: si dipinge per ruolo, non per colore.

```
--surface-base        #FBF8F4   sfondo app (era cream, leggermente più neutro)
--surface-raised      #FFFFFF   card, header, pannelli
--surface-sunken      #F4EEE7   input, well, tracce, zone "incassate"
--surface-nav         #FFFFFF   SIDEBAR (era #2A1F1A) ← cambio chiave
--surface-nav-active  #FFF1EC   item attivo sidebar (coral tint)

--border-subtle       rgba(42,31,26,0.08)   divisori, bordi card premium
--border-default      rgba(42,31,26,0.14)   input, contorni
--border-strong       rgba(42,31,26,0.22)   enfasi

--text-primary        #2A1F1A   (ink)
--text-secondary      #6B5A50   (ink-soft schiarito, AA su surface)
--text-tertiary       #9A8B82   placeholder/meta, usare solo ≥14px
--text-on-accent      #FFFFFF

--accent              #ED7159   (coral)
--accent-hover        #E25C42
--accent-pressed      #D9533A
--accent-tint         #FFF1EC   sfondi soft, badge, hover nav
--accent-ring         rgba(237,113,89,0.32)  focus ring

--status-success      #4FA882   (mint scurito per AA su testo)
--status-warning      #E0A23C   (sun scurito)
--status-info         #5B93B0   (sky scurito)
--status-danger       #DC4C3E
```

### 2.3 Regole d'uso
- **Color Consistency Lock:** coral è l'UNICO accento azionabile. Nessun bottone blu/verde/viola come CTA. Verde/giallo/blu solo come **status semantici** (success/warning/info), mai come azione primaria.
- **Niente AI-purple, niente glow al neon.** Elevazione = ombre tinte, non bagliori.
- **Contrasto:** `--text-secondary` su `--surface-base` deve passare WCAG AA (4.5:1). `#6B5A50` su `#FBF8F4` ≈ 5.2:1 ✓. Il vecchio `text-ink/60` su cream NON sempre passava: va sostituito dai token.
- **Sun e mint originali (`#F5C065`, `#7FC4A8`) NON vanno usati come testo** (contrasto insufficiente): solo come fill di badge con testo `ink`, oppure nelle varianti scurite sopra per testo/icone.

### 2.4 Eccezioni scure motivate (Page Theme: deroga consentita)
1. **KDS (`/dashboard/kds`)** resta su superficie scura (`bg-ink`). Motivazione reale: display cucina, ambiente luminoso/vapori, serve massimo contrasto e leggibilità a distanza, riduce affaticamento su schermo always-on. Va però **raffinato** (vedi §7 KDS), non lasciato grezzo.
2. **Overlay/scrim modali** (`bg-ink/60`) restano: è lo standard per dialog. Corretto.

Tutto il resto: chiaro.

---

## 3. Tipografia

### 3.1 Stack
Il tema premium usa già **DM Serif Display** (display) + **DM Sans** (body). Si conferma e si formalizza.

| Ruolo | Font | Uso |
|---|---|---|
| Display / titoli pagina, numeri-hero | `DM Serif Display` | `page-title`, KPI grandi, totali cassa. Eleganza editoriale calda. |
| UI / body / label / tabelle | `DM Sans` | tutto il resto. Peso 400-600. |
| Numeri tabellari / monetari | `DM Sans` con `font-variant-numeric: tabular-nums` | colonne prezzi, KDS timer, statistiche. Allineamento colonne perfetto. |

Nota: si **abbandona Nunito/Quicksand come default** (erano lo stack "playful"). Restano disponibili se in futuro si vuole tornare al tema giocoso, ma il default diventa premium.

### 3.2 Scala (desktop; mobile scala -1 step)
```
display-xl   clamp(2rem, 4vw, 2.75rem)  / DM Serif / leading-[1.05] / titoli pagina principali
display-lg   1.75rem  / DM Serif / KPI numerici hero
title        1.25rem  / DM Sans 600 / titoli card/sezione
body         0.9375rem (15px) / DM Sans 400 / testo
label        0.8125rem (13px) / DM Sans 600 / letter-spacing .01em / label form, header tabella
meta         0.75rem  / DM Sans 500 / timestamp, contatori, hint (solo su --text-secondary, mai tertiary <14px)
```
- **Niente `font-black` ovunque.** Era un tell del tema vecchio. Gerarchia con peso 400/500/600 + colore + dimensione, non con tutto in 900.
- Italic del DM Serif: se usato su parole con discendenti (`g j p q y`), `leading-[1.1]` minimo + `pb-1`. Audit titoli prima di shippare.

---

## 4. Forma, elevazione, spaziatura

### 4.1 Shape Consistency Lock
Una sola scala di raggi, applicata ovunque:
```
--r-input   10px
--r-card    16px
--r-modal   20px
--r-pill     999px   (bottoni, badge, chip, toggle)
```
Regola documentata: **bottoni e chip = pill; card/pannelli = 16px; input = 10px; modali = 20px.** Niente card squadrate su pagina con bottoni pill o viceversa.

### 4.2 Elevazione (ombre tinte, mai nero puro)
Si abbandonano le **hard-shadow neo-brutaliste** (`4px 4px 0 ink`) in favore di ombre morbide tinte (il tema premium lo fa già):
```
--elev-1   0 1px 3px rgba(42,31,26,.05), 0 1px 2px rgba(42,31,26,.04)   card a riposo
--elev-2   0 2px 12px rgba(42,31,26,.06), 0 1px 3px rgba(42,31,26,.04)  card hover / dropdown
--elev-3   0 8px 28px rgba(42,31,26,.10), 0 2px 8px rgba(42,31,26,.05)  modali, popover
--elev-accent  0 4px 16px rgba(237,113,89,.28)   solo CTA coral primaria
```
Bordo + ombra leggera insieme = "carta premium". Mai bordo `2px solid ink` (troppo grafico/cartoon).

### 4.3 Spaziatura
- Base 4px. Gutter card desktop `24px` (`gap-6`), mobile `16px`.
- Padding contenuto pagina: `px-6 py-6` desktop, `px-4 py-5` mobile.
- Container max `max-w-[1400px] mx-auto` per pagine larghe (statistiche, insights).
- Header sticky 56px (`h-14`) confermato; portarlo a `surface-raised` con `border-subtle` e leggero blur (`backdrop-blur` + `bg-white/80`) per profondità premium quando si scrolla.

---

## 5. Sidebar (intervento #1, risolve "troppo scuro")

### Prima → Dopo
- **Superficie:** `bg-ink #2A1F1A` → `--surface-nav #FFFFFF` con `border-right: 1px solid --border-subtle`.
- **Logo "Tako":** da `text-cream` → `text-primary`; badge "PRO" resta coral pill.
- **Nome ristorante:** `text-cream/60` → `--text-secondary`.
- **Link a riposo:** `text-cream/70` → `--text-secondary`, peso 500.
- **Link hover:** `bg-accent-tint` + `--accent-pressed` testo.
- **Link attivo:** non più fill coral pieno con hard-shadow. Diventa: `bg-accent-tint`, testo `--accent-pressed`, **barra coral 3px a sinistra** (il premium theme lo fa già: `border-left: 3px solid coral`). Più sobrio, più leggibile, più premium.
- **Sezione utente (footer sidebar):** avatar coral resta; testo da cream a primary/secondary; divisori `border-subtle`.
- **Badge conteggio ordini:** resta coral pill `text-white`. È l'unico punto "pieno coral" della nav: attira l'occhio sul dato che conta.

### Profondità premium (motion layer)
- Item attivo: la barra coral 3px **anima in** con `layoutId` (Motion) quando cambi pagina: scorre verticalmente da un item all'altro invece di apparire secca. Reduced-motion → appare statica.
- Hover item: micro `translateX(2px)` + tint fade 150ms. Tattile, non saltellante.

---

## 6. Componenti (ridefinizione `globals.css`)

Mantieni le **stesse classi** (`.btn-coral`, `.card`, `.input`, `.badge`, `.sidebar-link`, `.table-status-*`, `.page-header`) così non tocchi i `.tsx`: cambi solo la loro definizione. Questo è il vantaggio architetturale chiave: **redesign quasi interamente dentro `globals.css`**.

### 6.1 Bottoni
- `.btn-coral` (primario): pill, `bg-accent`, `text-on-accent`, peso 600, `--elev-accent`. Hover `--accent-hover` + `translateY(-1px)`. Active `scale(.98)` + `--accent-pressed`. Niente più `box-shadow: 0 4px 0` (hard shadow): è il tell neo-brutalista da rimuovere.
- `.btn-outline` (secondario): pill, `bg-surface-raised`, `border 1.5px --border-default`, testo primary peso 500. Hover `bg-surface-sunken`.
- `.btn-ghost`: pill, testo secondary, hover `bg-surface-sunken`.
- `.btn-danger`: pill, `bg-status-danger`, text white.
- **Button Contrast Check:** ogni CTA testo/bg ≥ AA. **CTA Wrap ban:** label primarie max 2-3 parole, una riga su desktop.

### 6.2 Card
- `.card`: `bg-surface-raised`, `border 1px --border-subtle`, `--r-card`, `--elev-1`. Hover (se cliccabile) → `--elev-2` + `translateY(-2px)` 180ms.
- `.card-flat`: come card ma senza ombra, solo bordo. Per griglie dense.
- `.card-coral` → rinomina concettuale `.card-accent`: `bg-accent-tint`, `border 1px accent/30`. Usare con parsimonia (1 enfasi per vista).
- **Materiality rule:** card SOLO dove l'elevazione comunica gerarchia reale. In tabelle/liste dense, usa `divide-y border-subtle`, non una card per riga.

### 6.3 Form
- `.input`: `bg-surface-raised`, `border 1.5px --border-default`, `--r-input`, focus → `border-accent` + ring `0 0 0 3px --accent-ring`. Placeholder `--text-tertiary` ma SOLO con label sopra (mai placeholder-as-label).
- `.label`: sopra l'input sempre, `--text-secondary`, peso 600, `gap-2`.
- Error: testo `--status-danger` sotto l'input. `.input-error` → `border-status-danger` + `bg-danger/5`.
- **Form Contrast Check:** label, placeholder, focus ring, helper, error tutti AA sul loro sfondo.

### 6.4 Badge & status tavoli
- `.badge-success/warning/error`: fill tint + testo nella variante scurita (mint/sun/sky/danger scuriti) per AA.
- `.table-status-*`: mappa su token status. `free` = `surface-sunken` + text-secondary; `occupied` = warning tint; `waiting` = accent tint + accent-pressed; `cleaning` = info tint; `reserved` = success tint. **Niente solo-colore per lo stato:** aggiungi sempre label testuale o icona (accessibilità daltonici).

### 6.5 Skeleton
- `.skeleton`: `bg-surface-sunken` con shimmer (gradiente che scorre, non solo pulse opacity). Deve **matchare la forma** del contenuto finale (card-shaped, riga-shaped), non un blob generico.

---

## 7. Note per pagina

| Pagina | Intervento principale |
|---|---|
| `/dashboard` (home) | KPI in `display-lg` DM Serif con **count-up** all'arrivo dati. Barra progresso da `bg-ink/10` → `surface-sunken` con fill accent. Griglia card `md:grid-cols-2 lg:grid-cols-4`, gap-6. |
| `/dashboard/ordini` | Lista ordini: niente card per riga, usa gruppi con `divide-subtle`. Nuovo ordine entra con `layout` + fade-slide dall'alto (Motion). Badge stato = token. Timer relativo in `tabular-nums`. |
| `/dashboard/kds` | **Resta scuro** ma raffinato: superficie `#211915` (ink un filo più caldo/morbido), card colonna `#2E241F`, bordi `white/8`, testo `#F3EDE7`. Stati con accenti saturi su scuro (mint/sun/coral brillanti). Timer grande tabular-nums, colore vira a danger oltre soglia. Bump button = pill grandi, target touch ≥44px. |
| `/dashboard/cassa` | Totali in DM Serif `display-lg`, tabular-nums. Tastierino/azioni pill, target ≥44px (uso touch veloce). Modale pagamento `--elev-3`, scrim `ink/60`. |
| `/dashboard/sala` + `/sala/tavoli` + `/sala/qr` | Tavoli come tile in griglia, stato via token + label. Tile = `--r-card`, hover `--elev-2`. QR su `surface-raised` con bordo subtle. |
| `/dashboard/statistiche` | Grafici a barre: barre con `--accent` + gradiente verticale leggero, tooltip `surface-raised` `--elev-3` (NON `bg-ink text-cream`, troppo scuro). Tabular-nums ovunque. |
| `/dashboard/insights` | **Fix AI-tell:** la label `'—'` (em-dash) per `unknown` (riga ~16) va sostituita con `'n/d'`. Em-dash bandito. Card matrice menu su `surface-raised`, righe `divide-subtle`. |
| `/dashboard/menu` | Drag&drop: ghost card con `--elev-3` durante drag, slot target con `accent-tint` dashed. Card piatto con foto: aspect-ratio fisso, `object-cover`, `--r-card`. Varianti come chip pill. |
| `/dashboard/staff` | Card membro, badge ruolo via token status. Avatar iniziale coral. |
| `/dashboard/impostazioni` | Sezioni in card con `divide-subtle`. Toggle pill. Switch tema (se mantenuto) qui. |
| `/dashboard/inventario` | Tabella densa: `tabular-nums`, `divide-subtle`, niente bordo su ogni cella. Soglie scorta con status warning/danger. |
| `(auth)/login` + `/register` | Card centrata `--elev-2` su `surface-base`, logo Tako, input premium, CTA coral pill. Niente sidebar scura qui (già fuori dal layout dashboard). |

---

## 8. Motion & dimensionalità (il layer "premium animato")

Tutto gated da `prefers-reduced-motion` (obbligatorio sopra MOTION 3). Libreria: **Motion (`motion/react`)** per UI; niente GSAP/Three qui (non serve scroll-telling in una dashboard).

1. **Page transition:** contenuto `main` fa fade+`translateY(8px)` 220ms `cubic-bezier(.16,1,.3,1)` al cambio rotta.
2. **Sidebar active indicator:** `layoutId` shared (vedi §5).
3. **Count-up KPI:** numeri animano 0→valore 600ms ease-out al primo render dati.
4. **Card hover lift:** `translateY(-2px)` + `--elev-1`→`--elev-2`, 180ms. Solo card azionabili.
5. **Realtime arrival:** nuovo ordine/chiamata entra con spring (`stiffness 260, damping 24`) + flash `accent-tint` 1s che svanisce. Comunica "è arrivato ora".
6. **Skeleton shimmer:** gradiente che scorre (`animation-timeline` o keyframe transform), non opacity pulse.
7. **Tactile feedback:** ogni bottone `active:scale(.98)`.
8. **Dimensionalità (no WebGL):** profondità con layer di ombre, leggerissimo parallax (≤4px) su hover delle KPI card seguendo il puntatore via `useMotionValue`/`useTransform` (MAI `useState` su movimento puntatore). Premium tilt, sottile.

Performance: animare solo `transform`/`opacity`. `will-change` solo su elementi che animano davvero. Reduced-motion → tutto statico/istantaneo.

---

## 9. Accessibilità & qualità (gate finale)

- [ ] Contrasto AA su tutti i testi/CTA/form (token calcolati per questo).
- [ ] Stato mai veicolato dal solo colore (label/icona sempre).
- [ ] Focus ring visibile (`--accent-ring`) su tutti gli interattivi, keyboard nav.
- [ ] Target touch ≥44px su KDS/cassa/sala (uso tablet).
- [ ] Zero em-dash (`—`/`–`) in tutta la UI. Fix riga insights confermato.
- [ ] Zero hard-shadow neo-brutaliste residue.
- [ ] Una sola scala raggi, un solo accento, un solo tema per pagina (deroga KDS documentata).
- [ ] Reduced-motion testato. Dark KDS testato. Mobile collapse esplicito (sidebar off-canvas già presente).
- [ ] `tabular-nums` su tutti i numeri in colonna.
- [ ] Skeleton/empty/error stati presenti per ogni vista con fetch.

---

## 10. Strategia di implementazione (per il dev)

Ordine consigliato, rischio crescente:
1. **Token:** riscrivi `:root` in `globals.css` con i token semantici (§2.2). Promuovi `premium` a default (rimuovi il gate `[data-theme="premium"]` o impostalo sempre attivo sull'`html`).
2. **Componenti:** ridefinisci le classi `@layer components` sui nuovi token (§6). Non toccare i `.tsx`: le classi restano le stesse.
3. **Sidebar:** unico componente `.tsx` da toccare a mano per i colori testo (`text-cream*` → token). (§5)
4. **Font:** conferma DM Serif/DM Sans come default in `layout.tsx`.
5. **Motion:** aggiungi il layer Motion incrementale (§8), un effetto alla volta, ognuno con reduced-motion.
6. **Per-pagina:** fix mirati (§7), partendo da insights em-dash e KDS refinement.
7. **QA:** checklist §9 in entrambe le modalità.

Il 70% del valore arriva dai passi 1-3 (token + classi + sidebar), a basso rischio, senza toccare la logica.

---

## 11. Riepilogo prompt (versione condensata per esecuzione)

> Redesign `apps/dashboard` in direzione **premium-soft chiaro**. Causa "troppo scuro" = sidebar `bg-ink`: portala a superficie bianca con item attivo a tint coral + barra 3px. Sostituisci token grezzi (coral/ink/cream) con token semantici (`surface-*`, `text-*`, `border-*`, `accent-*`, `status-*`) calcolati per WCAG AA. Promuovi il tema `premium` esistente a default. Abbandona hard-shadow neo-brutaliste e `font-black` diffuso in favore di ombre morbide tinte, una sola scala raggi (input 10 / card 16 / modale 20 / pill), tipografia DM Serif + DM Sans con tabular-nums sui numeri. Un solo accento (coral) per azioni, gli altri colori solo come status semantici con label. KDS resta scuro ma raffinato (eccezione documentata). Aggiungi un motion layer funzionale gated da reduced-motion: page transition, indicatore sidebar con layoutId, count-up KPI, card lift su hover, arrivo realtime con spring+flash, micro-parallax 3D sulle KPI via motion values. Fix AI-tell: em-dash `'—'` in insights → `'n/d'`. Implementa quasi tutto dentro `globals.css` (token + classi) senza toccare i `.tsx`, eccetto la Sidebar. QA: AA, focus ring, target ≥44px touch, stato non solo-colore, reduced-motion, mobile.
