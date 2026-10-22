# A1 server-bozza — note (22/10)

## Fatto
- `packages/menu-ops` (@tako/menu-ops): `applyOps`, `applyOp`, `dropToOps`, `manualOrderSnapshot`, `cloneDocument`. TS puro, zero dipendenze,
  bundle esbuild es2020 provato in `node:vm` (21/21 vettori). Copia profonda a mano (niente `structuredClone`: in `node:vm` non c'è).
  `types.ts` esteso solo in modo additivo: `WsItem/WsSection/WsMenu/WsDocument`, `ManualOrderView`.
- Dipendenza `@tako/menu-ops: workspace:*` in `apps/server/package.json`, `pnpm-lock.yaml` aggiornato a mano e verificato con
  `pnpm install --frozen-lockfile --lockfile-only` su copia isolata; `COPY packages/menu-ops` aggiunto ai due Dockerfile (render, web) —
  senza, il `--frozen-lockfile` dei build Docker fallirebbe. Symlink locale `apps/server/node_modules/@tako/menu-ops` (come pnpm). Nessun install.
- Schema: `design.manualOrder: z.boolean().optional()` (nessun default). Lettura pubblica: `publicWorkspace` clona l'intero design e sia
  `routes/customer.ts` sia l'edge di lettura passano `design: published.design` → il campo arriva al renderer senza modifiche.
  PDF lato server: segue già l'ordine del documento (Menu = ordine di `w.menus` / ordine dato; Sezioni = ordine di `m.sections`), nessuna
  regola a macro-categorie → nessuna modifica necessaria.
- Store: `applyDraftOps(tenant, actor, ops, clientId)` sotto `lockWorkspace` → `workspaceSchema.parse(bozza)` → `applyOps` →
  `workspaceSchema.safeParse` (invalido → `WorkspaceInvalid` → 422, nessuna scrittura) → `verifyOwnership` → UPDATE draft + revision+1 e,
  nella stessa istruzione, riga «Bozza dashboard» solo se non ce n'è una negli ultimi 30 min. `discardDraft(tenant, actor, expectedRevision)`.
- Rotte: `POST /ops`, `GET /status`, `POST /discard`, publish/discard 409 con `currentRevision`, GET con `pending` e `dashboardEditor`.
  `/status` anche sull'edge di lettura (`AUTHENTICATED_READ_PATHS` + lista `readPath` di `worker.mjs`), corpo condiviso in `menu-workspace-read.ts`.
- Agenzia: `pending` in SQL nella query; `summarizeAgencyRestaurant` usa `row.pending` se booleano, altrimenti la regola di prima.
- T9: flag esposto in GET `/api/menu-workspace` (`dashboardEditor`), anche sull'edge di lettura. Scelto qui perché `/api/auth/bootstrap`
  dà al `menu_editor` solo `{id,name}` del locale (niente settings) e `/api/restaurants/me` non è per tutti i ruoli del menu: la SPA legge il
  workspace comunque quando apre Piatti. Script `scripts/set-dashboard-editor-flag.mjs <id> on|off --yes` (senza `--yes` = prova, solo lettura;
  connessione = `.env.web` come `apply-web-migrations.mjs`, oppure `TAKO_FLAG_DATABASE_URL`). Eseguito solo con `--help`/argomenti errati e sul DB isolato dei test.

## Scelte (opzione conservativa, da confermare se serve)
1. `create` con id esistente: stesso livello + campi (e genitore, se dato) coincidenti → `{ok:true}`; altrimenti `{ok:false, code:'EXISTS'}`.
2. `remove` di un Sottomenu porta via le sue Sezioni figlie e i loro Piatti (nessuna figlia orfana; l'eliminazione passa dalla conferma della matita).
3. Posizione delle sezioni: un Sottomenu si sposta/crea come blocco (radice + figlie); `afterId` di un Sottomenu = dopo il suo blocco; ancora =
   figlia di un altro Sottomenu → si usa il blocco di quel Sottomenu. Sezione figlia «in fondo» = dopo l'ultima figlia del suo Sottomenu.
4. `create` richiede `name` non vuoto (→ `FIELD`); i valori di partenza sono gli stessi default dello schema zod (dopo il parse il documento non cambia).
5. `set` con valore `undefined` toglie il campo. Valori fuori schema (es. prezzo negativo, nome vuoto) → l'intera chiamata 422 (contratto).
6. Op che non cambiano nulla (rifiutate o ripetute): nessuna scrittura, la revisione non sale (meno ricariche fra schede).
7. Coalescenza: si controlla l'ultima riga con etichetta «Bozza dashboard» (non l'ultima riga qualsiasi). La riga contiene il documento DOPO l'op, come le altre versioni.
8. «Bozza scartata»: la versione salva la bozza scartata (revisione vecchia), così si recupera dalle Versioni; se non c'è nulla da scartare, nessuna scrittura.
   Locale mai pubblicato → 409 `NOT_PUBLISHED`.
9. Risposte additive (non tolgono campi): `/ops` restituisce anche `seq` (eco); `/status` dà i campi in testa e anche in `data`; publish risponde come prima.
   `clientId` validato (1–100 caratteri) ma non salvato. `lastLabel/lastAt` = ultima riga di storico.
10. Validazione zod delle op: id 1–100 caratteri (non uuid: gli id veri li controlla `workspaceSchema` sul documento finale), `reorder.ids` ≤ 2000.

## Verifiche (giro finale, esito reale)
- `npx vitest run packages/menu-ops --no-cache` → 3 file, 33 test verdi (property: 2500 sequenze + 2000 idempotenza + 2000 ancora mancante + 2×2000 commutatività).
- `npx vitest run tests/menu-workspace-ops.test.ts --no-cache` → 13/13 verdi (Postgres embedded isolato, rotte vere via inject; solo l'auth sostituita).
- Suite vicina (`packages/menu-ops tests/menu-workspace-*.test.ts tests/edge-read-*.test.ts tests/agency-*.test.ts tests/trial-publish-block.test.ts`):
  141/143; 2 rossi in `tests/menu-workspace-presentation.test.ts` (fuori perimetro A1): il test si aspetta `languages:['it']` ma la rotta GET usa
  già `commonMenuLanguages` (12 lingue) sulla base 17324ef7 → rosso preesistente; ora vede anche i campi additivi `pending`/`dashboardEditor`.
  Correzione suggerita: aggiornare le attese (`pending:true` col mock senza `published`, `dashboardEditor:false`, 12 lingue).
- `pnpm --filter @tako/server exec tsc --noEmit` verde; `tsc -p packages/menu-ops` verde.

## S4 (DB locale embedded, documento sintetico)
Documento: 260 piatti, 20 Sottomenu, 12 lingue, **464 KB** (più grande dei 388 KB richiesti). 40 ripetizioni, un `set` per volta.
- CPU `workspaceSchema.parse` + `applyOps` + `workspaceSchema.parse` + `JSON.stringify`: **p50 5,5 ms, p95 8,0 ms** (soglia p95 < 300 ms) ✔
- `applyDraftOps` completo (transazione, lock, parse, verifyOwnership, UPDATE jsonb + controllo versione) a parete: **p50 12,9 ms, p95 14,0 ms**.
Misura locale su M-series; l'edge Supabase va rimisurato sul QA (K4).

## Aperto
- Copertura dei rami ≥ 95%: non misurata (manca `@vitest/coverage-v8`, niente install). I test coprono ogni op e ogni codice d'errore.
- `tests/menu-workspace-presentation.test.ts` da aggiornare (vedi sopra) da chi ne ha il perimetro.
- Misure S4 sull'edge vero (QA) al deploy.
