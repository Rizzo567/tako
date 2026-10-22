# B web — vista di modifica nell'iframe, ordine manuale, verifica «identico» (22/10)

Perimetro: `apps/web/**`, `scripts/verify-menu-editor-identical.mjs`, `tests/web/menu-edit-*.test.mjs`.
Metodo (correzione di Manuel): costruzione con solo typecheck, poi un giro finale di verifica.

## Cosa c'è
- **Ordine manuale (ADDENDUM 1)** — `WorkspaceMenuRenderer`: con `design.manualOrder===true` Menu nell'ordine del documento (niente `orderDayMenus`) e pillole = Sottomenu veri (`manualCategoryGroups` = `categoryGroups`, nomi veri, niente accorpamento né lista fissa). Senza il campo: markup identico byte per byte al renderer di prima (test `menu-edit-renderer.test.mjs` confronta con `git show 315c05e1:…`).
- **`projectMenuForEdit(doc, menuId)`** in `menu-preview-calendar.ts`: tiene nascosti/esauriti/disattivati/fuori orario con `edit:{hidden,unavailable,inactive,scheduledOff}`; lingua originale; Sezione figlia eredita disattivato/fuori orario dal Sottomenu; `empty` come la proiezione pubblica (Menu in arrivo); restituisce anche `menus` (barra con tutti i Menu e il loro stato).
- **Modo `editing` del renderer**: solo `data-edit-*` (CONTRATTO §5), `tabIndex`, attenuazione (opacità .45; esauriti restano .58 come per i clienti) ed etichetta Sobrio («Nascosto · rendilo visibile dalla matita», «Esaurito», «Fuori orario»; versione corta su pillole e chip). Contenitori `children:<root>` e `items:<sezione>` sempre presenti (anche vuoti). Selettore lingua bloccato con `locked` (aria-disabled, nessun cambio visivo; `disabled` avrebbe dimezzato l'opacità → non identico).
- **Layer** `apps/web/src/components/menu-edit/`: `MenuEditLayer.tsx` (pigro, solo da `MenuPreview` con `?edit=1`), `selection.ts`, `protocol.ts` (CONTRATTO §4, origine + `event.source` + `v:1`), `edit.css` (token Sobrio), `gesture.ts` (unico import del motore), `gesture-stub.ts`.
  Selezione: un elemento, riquadro 2 px #0a0a0a + alone, matita a pillola in alto a destra (44 px su `pointer:coarse`), aria-label «Modifica piatto «X»» / sottomenu / sezione / menu. Deselezione: Esc o pointerdown fuori (anche fuori dalla colonna sugli schermi larghi). Tastiera: Tab seleziona al fuoco, Invio = matita.
  Tremolio: `onModeChange(true)` → `tako-menu-edit-mode`, attributo `data-edit-jiggle` (aree vuote visibili), e se il documento non è manuale `manualOrderSnapshot(doc, currentOrderView(doc, ora))` inviata come op `provisional:true` e applicata subito in locale. `onDrop` → `dropToOps` → applicata in locale (ottimistica) + `tako-menu-edit-ops {seq}`. Documento rimandato dalla SPA = verità (sostituisce il locale). `flash` → `data-edit-flash` (2 × `fast`, ridotto: evidenza statica `data`). Riaggancio `refresh()` a ogni ri-render (MutationObserver, uno per frame: cambio pagina fra pillole, cambio Menu, documento nuovo).
- `MenuPreview.tsx`: ramo `?edit=1` (`MenuEditPreview`), `editRendererProps()` e `MenuEditSurface` esportati (stesso codice usato dalla verifica «identico»). La query si legge in `MenuPreview` (le rotte di `apps/web-static` tolgono già la query: nessuna modifica a `routes.mjs`/`main.tsx`).
- Sfondo del documento: `applyDocumentTheme` spostata in `apps/web/src/lib/menu-document-theme.ts` e usata anche dalla vista di modifica (prima l'anteprima mostrava il crema di default fuori dalla colonna di 512 px a 1280: non identico).
- `next.config.ts`: `experimental.externalDir` (il layer importa `packages/menu-ops` per percorso relativo; nessun `pnpm install`).

## Passaggio al modulo gesto vero
Copiare il file in `packages/menu-gesture/src/index.ts`, poi in `apps/web/src/components/menu-edit/gesture.ts` sostituire SOLO
`export { createMenuGesture } from './gesture-stub'`
con
`export { createMenuGesture } from '../../../../../packages/menu-gesture/src/index'`
(i tipi restano quelli del contratto in `gesture-stub.ts`). Note sul contratto: `brain/output/takomenu-dashboard-editor-2026-10-22/CONTRATTO-GESTO-NOTE.md`.

## Deviazioni (opzione conservativa)
1. Pillole con `data-edit-axis="grid"` (non `x` come in CONTRATTO §5): la barra delle pillole va a capo (`flex-wrap`). Barra dei Menu = `x`.
2. Prezzo fisso: i piatti dentro i blocchi per opzione (vista ripetuta, id `formula~…`) sono selezionabili per piatto (`data-edit-select="item:<id>"`) ma NON trascinabili; le righe opzione non sono selezionabili. Le Sezioni non coperte da opzioni sono normali.
3. Titolo del Sottomenu = `data-edit-select` (selezione/matita), si trascina dalla pillola (come da contratto). Una pagina con più radici accorpate (documento non manuale) mostra più titoli selezionabili.
4. Vista di modifica con ordine del documento anomalo (figlia prima della sua radice nell'array): in editing la figlia va nel contenitore della radice → ordine diverso dalla pagina pubblica solo in quel caso (non nei dati reali misurati).
5. `verify-public-menu-release.mjs` non eseguibile in locale: verifica un sito HTTPS già distribuito; `wrangler dev` del worker pubblico non parte in locale (`Incorrect type for map entry 'TWILIO_WEBHOOK_PATH'`, export non-handler in `deploy/cloudflare/worker.mjs`, fuori perimetro). Si esegue dopo il deploy notturno: `node scripts/verify-public-menu-release.mjs https://takoitalia.com docs/webapp/portfolio-rollout/public-manifest.json`.
6. Il bot (`apps/server/src/lib/owner-brain-sections.ts`, perimetro A) nomina i Sottomenu con le macro-pillole anche per i locali in ordine manuale: da allineare lato server se serve.
7. Il server pubblico deve far passare `design.manualOrder` nel DTO pubblico (oggi passa `workspace.design` intero: ok).

## Giro finale (22/10 ~11:15)
- `pnpm --filter @tako/web exec tsc --noEmit`: verde.
- `node --test tests/web/*.test.mjs`: 289 test, 267 ok, 22 rossi. Tutti i 22 sono rossi anche sulla base `315c05e1` (stessa suite su copia `git archive`: 26 rossi, superinsieme) — nessuna regressione; i 20 test nuovi (`menu-edit-layer`, `menu-edit-renderer`) verdi.
- `node scripts/verify-menu-editor-identical.mjs`: 24 confronti (3 fixture × 390/430/1280 × ogni pillola) = **0 pixel diversi** tutti, senza riscatti; 47/47 controlli del layer verdi (390 touch e 1280 mouse). Chrome con `--disable-gpu` (rasterizzazione software, deterministica: con la GPU è comparso 1 px di antialias non ripetibile sul bordo di un badge).
- Build pubblica (`build-public-menu-release.mjs`): hash cambiati come atteso (renderer, DigitalMenu, CSS); `MenuEditLayer` è un chunk separato non precaricato dalla pagina pubblica; nessun `menu-ops`/`tako-menu-edit` nei chunk di DigitalMenu.
- Hash del bundle pubblico (`release/public-menus/assets`, prima → dopo): `WorkspaceMenuRenderer-BoAqVec3.js` (db67579b…) → `WorkspaceMenuRenderer-B9I7Y1W9.js` (ddea2807…); `DigitalMenu-Blj7IFpy.js` (8a9460e7…) → `DigitalMenu-DrvB137y.js` (ee4af1ad…); `index-D7OwVaoj.css` → `index-CxfMbUCJ.css`; `index-DwyQ-S3D.js` → `index-CnDwHJPy.js`; nuovi `menu-document-theme-*.js`, `MenuEditLayer-*.js/.css`. Elenco completo prima/dopo: sha256 di ogni file salvati durante la build (diff: 22 file cambiati/aggiunti, tutti chunk di `apps/web`). Deploy del worker pubblico: notturno, già approvato (ADDENDUM 1).
- Screenshot: `docs/webapp/dashboard-editor-2026-10-22/shots/identico-*.png` (pubblica/modifica, prima pillola), `layer-*.png`, esiti in `shots/identical.json`.
