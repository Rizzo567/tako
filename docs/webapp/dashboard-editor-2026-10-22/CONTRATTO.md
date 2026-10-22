# CONTRATTO — dashboard «Piatti» = menu vero modificabile (22/10)

Fonte: `brain/output/takomenu-dashboard-editor-2026-10-22/PIANO.md` + ADDENDUM 22/10 (vincolante) + `CONTRATTO-GESTO.md`.
Questo file congela le interfacce fra i tre perimetri. Chi ha bisogno di cambiarle lo scrive in `implementation-notes.md` e avvisa l'orchestratore: non si cambiano da soli.

Perimetri (mai due sottoagenti sugli stessi file):
- **A1 server-bozza**: `packages/menu-ops/**`, `apps/server/src/lib/menu-workspace-store.ts`, `menu-workspace-contract.ts`, `menu-workspace-read.ts`, `routes/menu-workspace.ts`, `edge-read-handler.ts`, `deploy/cloudflare/worker.mjs`, `agency-overview.ts`, `routes/agency.ts`, settings/flag, PDF lato server, `tests/menu-workspace-ops.test.ts`, `scripts/set-dashboard-editor-flag.mjs`.
- **A2 bot**: `apps/server/src/lib/menu-workspace-bot.ts` (nuovo), `twilio-menu.ts` (solo punti di scrittura/confronto revisione), `twilio-menu-ai.ts`, `twilio-menu-fullmenu.ts`, `twilio-menu-copy.ts`, `menu-day-presets.ts`, `menu-text-translations.ts`, `tests/bot-partial-publish.test.ts`.
- **B web**: `apps/web/**`, `apps/web-static/**`, `scripts/verify-menu-editor-identical.mjs`, `tests/web/menu-edit-*.test.mjs`.
- **C SPA**: `apps/dashboard/public/staff/**`, `scripts/build-staff-web.mjs`, `tests/staff/menu-editor-*.test.mjs`, `scripts/verify-menu-editor-dashboard.mjs`, `scripts/verify-menu-editor-concurrency.mjs`.
- **Gesto** (altro agente, altro worktree): `packages/menu-gesture/**` — qui NON si scrive mai. Stub con la stessa firma in `apps/web/src/components/menu-edit/gesture-stub.ts` finché il modulo non è mergiato.

Condiviso, già scritto dall'orchestratore: `packages/menu-ops/src/types.ts`, `apps/server/src/lib/menu-workspace-pending.ts`, export di `lockWorkspace`/`writePublication`/`verifyOwnership`/`writeWorkspace` dallo store.

## 1. Operazioni (`packages/menu-ops`)

Tipi in `packages/menu-ops/src/types.ts` (Op, At, Kind, OpResult, FIELD_WHITELIST, ReorderDrop, GROUP). Funzioni esportate da `packages/menu-ops/src/index.ts`:

```ts
applyOps(w: Workspace, ops: Op[]): { workspace: Workspace; results: OpResult[] }   // pura, non muta l'input
dropToOps(w: Workspace, drop: ReorderDrop): Op[]                                   // rilascio del gesto → op
manualOrderSnapshot(w, { menuOrder: string[]; sectionOrder: Record<menuId, string[]> }): Op[]  // reorder + manualOrder:true
```
Regole: profondità sezioni ≤ 2; una sezione con figlie non diventa figlia; `create` con id esistente = `EXISTS` ma considerata riuscita se i campi coincidono; `move`/`reorder` con ancora mancante = in fondo; spostare un Sottomenu porta con sé le sue Sezioni figlie (subito dopo, stesso ordine); campi fuori whitelist → `FIELD`. Le traduzioni non si toccano.
`Workspace` è tipizzato in modo strutturale minimo dentro menu-ops (nessun import da apps/server); il server rivalida con `workspaceSchema.parse` dopo `applyOps`.

Mappa gesto → op (`dropToOps`): `dish` → item `move` (toParentId = sectionId del gruppo `items:<sectionId>`); `section` → section `move` con toParentId = root del gruppo `children:<rootId>`; `submenu` → `reorder` delle sezioni del Menu (radici nel nuovo ordine, ciascuna seguita dalle sue figlie); `menu` → `reorder` menus. `toIndex` = indice nel gruppo di arrivo contando i fratelli SENZA l'elemento trascinato.

## 2. Ordine manuale (ADDENDUM 1)

- Campo `design.manualOrder?: boolean` (facoltativo, nessun default: documenti senza restano identici).
- `manualOrder === true` → pagina pubblica, anteprima e editor: Menu nell'ordine del documento (niente `orderDayMenus`), pillole = Sottomenu veri (`categoryGroups`, nomi veri, niente accorpamento né ordinamento a lista fissa). Assente/false = comportamento di oggi, byte per byte.
- Migrazione **pigra, senza SQL**: un locale passa all'ordine manuale solo quando il ristoratore riordina qualcosa. All'entrata nella modalità tremolio con documento non manuale, l'iframe calcola l'ordine che vede in quel momento (ordine pillole calcolato + ordine Menu all'ora attuale) e manda `manualOrderSnapshot(...)` come op **provvisorie**: la SPA le applica solo in locale; le invia al server insieme al primo rilascio reale; se si esce con «Fine» senza alcun rilascio, la SPA torna al documento di prima (nessuna modifica pendente).

## 3. API server

| Metodo | Percorso | Corpo → risposta |
|---|---|---|
| POST | `/api/menu-workspace/ops` | `{ops: Op[] (1..50), clientId: string, seq: number}` → `{revision, publishedRevision, pending, results}`. Scrive solo la bozza, sotto lock di riga, senza `expectedRevision`. Ammesso su PROVA. Versione «Bozza dashboard» al massimo ogni 30 min. Documento finale invalido → 422 e nessuna scrittura. Op rifiutate → 200 con `results[i].ok=false` (le altre applicate). |
| GET | `/api/menu-workspace/status` (edge di LETTURA) | `{revision, publishedRevision, pending, lastLabel, lastAt}` |
| POST | `/api/menu-workspace/publish` | invariato `{expectedRevision}`; 409 → corpo `{error, currentRevision}` |
| POST | `/api/menu-workspace/discard` | `{expectedRevision}` → bozza = pubblicato, versione «Bozza scartata»; risposta come GET workspace |
| PUT | `/api/menu-workspace` | invariato |

`pending` = `draft IS DISTINCT FROM published` (SQL, jsonb semantico); helper JS `pendingOf(row)` in `apps/server/src/lib/menu-workspace-pending.ts`. Mai più `revision !== published_revision` per dire «modifiche non pubblicate».
Il GET `/api/menu-workspace` (e `/presentation` se serve) aggiunge `pending` e `dashboardEditor` (flag del locale) alla risposta, senza togliere campi.

Flag: `restaurants.settings.dashboardEditor === true` (default spento). Script `scripts/set-dashboard-editor-flag.mjs <restaurantId> on|off --yes` (mai eseguito dagli agenti su locali veri).

## 4. Messaggi iframe ↔ SPA (`/menu-preview/<menuId>?edit=1`, same-origin, `v:1`, origine e `event.source` verificati)

SPA → iframe:
- `tako-menu-edit-state` `{v:1, document, menuId, selection: {kind,id}|null, flash: string[], disabled: boolean, editing: boolean}` — a ogni cambio.
- `tako-menu-edit-exit` `{v:1}` — bottone «Fine» della SPA → l'iframe chiama `exitEditMode()`.

iframe → SPA:
- `tako-menu-edit-ready` `{v:1}`
- `tako-menu-edit-select` `{v:1, kind, id} | {v:1, kind:null}` (tocco breve / tastiera / Esc / clic fuori)
- `tako-menu-edit-open` `{v:1, kind, id}` (matita)
- `tako-menu-edit-ops` `{v:1, ops: Op[], provisional?: boolean, seq: number}` (rilascio del gesto, o snapshot ordine manuale provvisorio)
- `tako-menu-edit-mode` `{v:1, editing: boolean}` (entrata/uscita tremolio; la SPA mostra/nasconde «Fine»)
- `tako-menu-edit-menu` `{v:1, menuId}` (il ristoratore cambia Menu dal selettore nell'iframe)
- `tako-menu-edit-error` `{v:1, code}`

Kind nei messaggi = `'menu'|'section'|'item'` (lessico del modello). Nell'iframe il gesto parla `menu|submenu|section|dish`; la conversione è solo nell'iframe (`dropToOps`).

## 5. Data-attribute nel renderer in modo `editing` (contratto gesto)

Solo con `editing` attivo (mai nella pagina pubblica):
- chip Menu: `data-edit-id=<menuId> data-edit-kind=menu data-edit-group=menus`; contenitore `data-edit-group-id=menus data-edit-axis=x` (o `grid` se va a capo)
- pillole Sottomenu: `data-edit-id=<rootSectionId> data-edit-kind=submenu data-edit-group=pills:<menuId>`; contenitore `data-edit-group-id=pills:<menuId> data-edit-axis=x`
- Sezione figlia: `data-edit-id=<sectionId> data-edit-kind=section data-edit-group=children:<rootId>`; contenitore `data-edit-group-id=children:<rootId> data-edit-axis=y`
- Piatto: `data-edit-id=<itemId> data-edit-kind=dish data-edit-group=items:<sectionId>`; contenitore `data-edit-group-id=items:<sectionId> data-edit-axis=y` (presente anche se vuoto, con area di rilascio visibile in modalità tremolio)
- titolo di un Sottomenu (h2 della radice nella pagina) è selezionabile (matita) con `data-edit-select=section:<id>` ma si trascina dalla pillola.
- stato: `data-edit-state="hidden|unavailable|inactive|scheduled-off"` + classe di attenuazione ed etichetta.

## 6. Bot (A2)

`applyBotChange(tenant, actor, label, {expectedPublishedRevision, actions?, idSeed, replaceMenu?})` in `menu-workspace-bot.ts`, regole D5 del piano. Il bot legge il catalogo dal **pubblicato**, proposte/undo agganciati a `published_revision`, `dashboardPending` non più usato per bloccare. La bozza non si perde mai e non si pubblica mai al posto del bot.
