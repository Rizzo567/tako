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
