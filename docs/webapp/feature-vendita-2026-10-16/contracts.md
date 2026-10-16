# Contratti tra le feature vendita (16/10/2026)

Ogni agente scrive solo nella propria sezione. Le firme qui sotto sono quelle presenti nel ramo che le possiede.

## F3+F4 — Prezzo promo e scarsità (ramo `codex/feat-promo-scarsita`)

Nessuna migrazione: i campi stanno **nel documento del piatto** (`menu_workspaces.draft/published`), quindi i preset di F2, che copiano il piatto in modo generico, li portano con sé.

### 1. Campi del piatto (`menu-workspace-contract.ts`, additivi e facoltativi)

```ts
promo?:    { price: number /* > 0 */, until: 'YYYY-MM-DD' | null }            // until = ultimo giorno incluso
scarcity?: { lastPortions: boolean, onlyToday: 'YYYY-MM-DD' | null }          // onlyToday = giornata in cui vale
```

- Un documento senza i campi resta identico (nessuna chiave aggiunta). `promo: null` / `scarcity: null` / scarcity vuota vengono tolti al parse.
- Lo schema toglie `lastPortions` quando `available === false` (bot, dashboard, pubblicazione).
- Promo valida solo se `0 < promo.price < price`; con un `priceDisplay` a testo la promo non si mostra (il testo del titolare vince).
- **Attenzione bundle vecchi (UNKNOWNS B3):** uno schema senza questi campi li cancella al primo salvataggio. Ordine di deploy: schema prima, poi bot/dashboard.

### 2. Giornata e scadenze: `apps/server/src/lib/menu-sales.ts`

```ts
export function businessDate(timezone?: string | null, now?: Date): string     // 'YYYY-MM-DD', cambia alle 06:00 locali, ripiego Europe/Rome
export function salesTimezone(value: unknown): string
export function resolveSalesItem<T>(item: T, today: string): T                  // toglie promo/etichette scadute o non valide
export function scheduleExpired(schedule, today: string): boolean               // data di fine passata (piatto del giorno)
export function stampOnlyToday(workspace, menuId: string, today: string): Workspace  // per F2, vedi sotto
export function resolveUntil(phrase: string, today: string): string | null      // «fino a domenica», «fino al 20/10»…
export const SALES_LABELS / salesLabel(key, language)                           // Promo, Ultime porzioni, Solo oggi in 12 lingue
```

- `businessDate(tz, now)` è la stessa regola di `operationalDay(tz, now).date` di F1 (`menu-operational-day.ts`). Dopo il merge si può far puntare una all'altra con una riga; i test di entrambe restano validi.
- **Risoluzione in lettura**, nessun job: `publicWorkspace(workspace, now, { ignoreSchedules, timezone })` (pagina pubblica, read-edge e PDF) applica promo, «Solo oggi» e date di fine **anche con `ignoreSchedules`** (fix del piatto del giorno sul percorso del Worker). Le fasce orarie restano ignorate come prima.
- `readPublishedCatalog` passa `restaurants.settings.timezone`; il PDF lo riceve dalla rotta (`renderWorkspacePdf(…, runtimeAssets, { timezone, now })`, settimo parametro facoltativo).

### 3. Per F2 (preset)

- I campi viaggiano nel piatto: nessuna azione per salvare/copiare un preset.
- **Quando un preset va online** (automatico alle 06:00 o «metti online»), chiamare `stampOnlyToday(workspace, menuId, businessDate(tz, now))` sul workspace prima di pubblicare: «Solo oggi» dentro un preset vale per il giorno in cui il preset è online. Senza questa riga l'etichetta salvata nel preset risulterebbe già scaduta.
- Una promo con `until` passato dentro un preset resta nel documento ma non si vede (si risolve in lettura).

### 4. Proiezione pubblica (`packages/types` → `PublicItem`)

```ts
promoPrice?: number      // solo se valida adesso; il prezzo pieno resta in price
lastPortions?: true
onlyToday?: true
```

Il menu pubblico (`WorkspaceMenuRenderer`) mostra prezzo pieno barrato + promo ed etichette sobrie; traduzioni statiche in `apps/web/src/lib/menu-sales-copy.ts` (copia di `SALES_LABELS`, parità verificata da `tests/menu-sales.test.ts`).

### 5. Bot titolare (agganci di una riga, logica in `apps/server/src/lib/twilio-menu-sales.ts`)

```ts
export type SalesAction = { kind: 'promo', id, price: number | null /* null = togli */, until: string | null }
                        | { kind: 'scarcity', id, label: 'lastPortions' | 'onlyToday', value: boolean }
export function parseSalesText(raw: string): SalesIntent | null
export function salesTurn(text, workspace, refs, today): { reply } | { actions } | { choose } | null
export function salesActionProblem(actions, workspace): string | null   // promo non valida → testo, nessuna scrittura
```

- `MenuAction` (twilio-menu-ai.ts) include `SalesAction`; agganci in `describeAction`, `actionKey`, `effectiveMenuActions`, `applyActions`, `validateMenuPlan` (azioni modello `set_promo`, `remove_promo`, `set_last_portions`, `set_only_today`).
- `routes/twilio-menu.ts`, `menuTurn`: le frasi promo/scarsità sono riconosciute **prima** di `capabilityFromText`/`parseIntent` (altrimenti «togli la promo…» diventerebbe «nascondi»), solo se non c'è un comando semplice o una foto in attesa. Il controllo `salesActionProblem` sta subito prima di `effectiveMenuActions` e vale per tutti i percorsi (frase, scelta tra omonimi, modello). Regola delle 3 modifiche invariata.
- Copy: chiavi nuove `salesLine`, `salesCopy` e due voci in `capabilities` (`promo`, `scarcity`); una riga aggiunta in `copy.help`. **Per F1:** se F1 riscrive `copy.help`, conservare la riga «*Promo*: …».
- Se F1 aggiunge un ramo «menu intero» in `menuTurn`, il riconoscimento promo/scarsità richiede `parseSalesText(text)`: un menu intero non lo attiva (servono «promo», «offerta», «porzioni» o «solo oggi» in una frase di un solo piatto).

### 6. Esaurito operativo: `apps/server/src/lib/menu-sales-store.ts`

`clearLastPortionsOnSoldOut(restaurantId, itemId)` è chiamata da `PATCH /api/menus/items/:id/availability` con `available=false`: toglie «Ultime porzioni» in bozza e pubblicato **senza cambiare revisione** (un editor aperto non va in conflitto). Best effort: l'esaurito resta valido anche se la pulizia fallisce.
