# Contratti tra le feature vendita (16/10/2026)

Ogni agente scrive solo nella propria sezione. Le firme qui sotto sono quelle presenti nel ramo che le possiede.

## F1 — Menu intero da messaggio o vocale (ramo `codex/feat-menu-da-messaggio`)

F1 possiede l'innesto «menu intero» nel bot titolare (`twilio-menu-*`, `routes/twilio-menu.ts`) e il riuso del parser dell'onboarding. Espone tre punti di aggancio per la Feature 2. Ognuno è uno **stub** nel ramo F1: la Feature 2 sostituisce solo l'implementazione, mai la firma.

### 1. Traduzioni dei testi nuovi: `apps/server/src/lib/menu-translation-queue.ts`

```ts
export async function enqueueNewTextTranslations(restaurantId: string, texts: string[]): Promise<void>
export type TranslationEnqueue = (restaurantId: string, texts: string[]) => Promise<void>
export function setTranslationEnqueue(next: TranslationEnqueue): () => void   // aggancio/test
```

- **Chi la chiama:** il bot, dopo una pubblicazione o un salvataggio in preset del menu intero. La chiama fuori dal percorso critico (`void …catch()`): la pubblicazione non aspetta e non fallisce per le traduzioni.
- **Cosa riceve:** solo testi italiani **nuovi**: nomi di piatti creati, nomi di categorie create, descrizioni nuove o cambiate. Non riceve mai i piatti già presenti, che conservano `id`, nome e `translations`. La lista è deduplicata e senza stringhe vuote.
- **Cosa deve garantire F2:** accoda e basta, senza chiamare il modello in linea. Usa la cache per testo e non ritraduce mai un testo già tradotto. Traduce in tutte le lingue del locale. Finché le traduzioni non ci sono, il menu pubblico mostra l'italiano (già così oggi, `publicMenuProjection`).
- **Stub F1:** scrive solo un log `menu_translation_enqueue_stub` con il numero di testi.

### 2. Destinazione «preset `<menu>` `<giorno>`»: `apps/server/src/lib/menu-preset-target.ts`

```ts
export type PresetDestination = { kind: 'preset', menuId: string, weekday: number | null, name: string }
// weekday: 0 = domenica … 6 = sabato (come MenuWorkspaceSchedule); null = preset con nome libero
export interface MenuPresetTarget {
  enabled(tx, restaurantId: string, menuId: string): Promise<boolean>
  save(tx, input: { restaurantId: string, actorId: string, destination: PresetDestination,
                    sections: Workspace['menus'][number]['sections'] }): Promise<{ label: string }>
}
export let menuPresetTarget: MenuPresetTarget          // stub: enabled → false, save → errore
export function setMenuPresetTarget(next: MenuPresetTarget): () => void
```

- **`enabled`:** dice se quel menu (Pranzo, Cena, Menu…) usa i preset. Il bot propone «nel preset di un giorno» **solo** quando almeno un menu risponde `true`: niente opzioni che il locale non ha.
- **Quando viene chiamata `save`:** solo dopo l'OK scritto del titolare. Il flusso è quello della F1: riconoscimento, riepilogo completo, correzioni, OK.
- **Cosa contiene `sections`:** il contenuto completo del menu nel formato del documento, costruito da `buildMenuContent` (`menu-replace.ts`). I piatti con lo stesso nome del menu attuale riusano `id` e traduzioni, quelli nuovi hanno `id` nuovi. I piatti del menu attuale non detti dal titolare compaiono come `hidden: true`. Quando il preset va online, F2 può filtrarli o tenerli nascosti.
- **Cosa non fa:** `save` non pubblica nulla. Se il preset è quello online oggi, F2 decide come ripubblicarlo. La regola del prompt è: dopo l'OK, la modifica del preset di oggi aggiorna anche il pubblico.
- **`label`:** è il testo mostrato in chat dopo «Ho salvato il menu nel …», per esempio `preset *Lunedì* del Pranzo`.
- **Come si arriva qui:** frasi come «menu di lunedì: …», «pranzo di martedì», «menu di domani». «Domani» usa la giornata operativa: `operationalDay(tz, now, 1)`.
- **Senza preset attivi:** il bot lo dice e propone solo «al posto del menu attuale».

### 3. Comandi chat dei preset (opzionale): stesso file

```ts
export type PresetChatCommand = (tx, ctx: { tenant: string, actor: string, phone: string }, text: string) => Promise<string | null>
export let presetChatCommand: PresetChatCommand        // stub: () => null
export function setPresetChatCommand(next: PresetChatCommand): () => void
```

Il bot lo chiama **prima** del riconoscimento del menu intero e prima delle modifiche singole: `routes/twilio-menu.ts`, `menuTurn`, dopo il controllo «modifiche in attesa nella dashboard». Una stringa diventa la risposta; `null` lascia proseguire il flusso di sempre. Serve per «metti online il menu di martedì», «attiva / disattiva automatico» e «cosa c'è lunedì a pranzo?». Per «menu di lunedì: …» **non** serve: è già instradato dalla F1 verso `menuPresetTarget.save`.

### 4. Giornata operativa: `apps/server/src/lib/menu-operational-day.ts` (posseduto da F1, riusabile)

```ts
export function operationalDay(timezone: unknown, now?: Date, offsetDays?: number): { zone: string, date: string, weekday: number }
export function validTimezone(timezone: unknown): string   // ripiego 'Europe/Rome'
export const operationalDayStartHour = 6
```

La giornata cambia alle 06:00 nel fuso del locale (`restaurants.settings.timezone`, ripiego `Europe/Rome`). F2 (job 06:00), F3 (fine promo) e F4 («Solo oggi») possono importarla invece di riscriverla.

### 5. Dati e stati che F1 lascia nel DB (nessuna migrazione)

- `tako_whatsapp_proposals.command` con `kind: 'fullmenu'` e `stage: 'doubt' | 'where' | 'confirm' | 'replay'`, scadenza 30 minuti, una riga per telefono. Sostituisce qualsiasi proposta aperta. `storedActions` la ignora.
- `menu_workspace_versions`: prima della pubblicazione F1 scrive una copia etichettata `WhatsApp: copia prima del menu intero #<menuId>`: è un workspace completo e valido, ripristinabile anche dalla dashboard. Seguono `WhatsApp: menu intero (bozza)` e `WhatsApp: menu intero pubblicato`. «Ripristina il menu di prima» cerca l'ultima copia ed etichetta il ripristino `WhatsApp: menu di prima ripristinato #<menuId>`. Chi aggiunge altre etichette `WhatsApp: …` non deve usare questi due prefissi.

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
