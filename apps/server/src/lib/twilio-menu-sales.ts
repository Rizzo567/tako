// Bot titolare — F3 «prezzo promo» e F4 «scarsità» (16/10/2026). Logica isolata qui: nei file twilio-menu-* ci sono solo agganci di una riga.
// Frasi gestite SENZA modello (Groq esaurito, e devono funzionare comunque):
//   «carbonara in promo a 9 fino a domenica», «togli la promo dalla carbonara»,
//   «carbonara ultime porzioni», «tiramisù solo per oggi», «togli ultime porzioni».
// Le frasi composte («… e …») restano al modello con le azioni set_promo/remove_promo/set_last_portions/set_only_today.
import type { MenuRef } from './twilio-menu-ai.js'
import { plainText, findDishes } from './twilio-menu-nlu.js'
import { salesCopy, salesLine, fill, copy } from './twilio-menu-copy.js'
import { businessDate, resolveUntil, untilLabel, validPromoPrice } from './menu-sales.js'

export type SalesLabelKey = 'lastPortions' | 'onlyToday'
export type SalesAction = { kind: 'promo', id: string, price: number | null, until: string | null } | { kind: 'scarcity', id: string, label: SalesLabelKey, value: boolean }
export type SalesTemplate = { kind: 'promo', price: number | null, until: string | null } | { kind: 'scarcity', label: SalesLabelKey, value: boolean }
type Item = { id: string, name: string, price: number, available?: boolean, priceDisplay?: string | null, promo?: { price: number, until?: string | null } | null, scarcity?: { lastPortions?: boolean, onlyToday?: string | null } | null }
type Doc = { menus: { sections: { items: Item[] }[] }[] }

const euro = (n: number) => n.toFixed(2).replace('.', ',') + ' €'
const itemsOf = (w: Doc) => new Map<string, Item>(w.menus.flatMap(m => m.sections.flatMap(s => s.items.map(i => [i.id, i] as [string, Item]))))
export const isSalesAction = (a: { kind: string }): a is SalesAction => a.kind === 'promo' || a.kind === 'scarcity'
export const salesActionKey = (a: SalesAction) => a.kind === 'promo' ? `${a.id}:promo:` : `${a.id}:scarcity:${a.label}`

// --- Testo → intenzione ---
const words: Record<string, number> = { uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16, diciassette: 17, diciotto: 18, diciannove: 19, venti: 20, venticinque: 25, trenta: 30 }
const NUM = `(\\d+(?:[.,]\\d{1,2})?|${Object.keys(words).join('|')})(?: e (mezzo|cinquanta|\\d{2}))?`
const amount = (value: string, cents?: string) => { const base = /^\d/.test(value) ? Number(value.replace(',', '.')) : words[value]; if (base === undefined || !Number.isFinite(base)) return null; const extra = !cents ? 0 : cents === 'mezzo' || cents === 'cinquanta' ? 0.5 : Number(cents) / 100; const n = Math.round((base + extra) * 100) / 100; return n > 0 && n <= 100000 ? n : null }
const UNTIL = '(?: ((?:fino|sino|entro|per tutt[oa]|valid[ao] fino)\\b.*))?'
const OF = '(?:dalla|dal|dallo|dall|dai|dagli|dalle|da|alla|al|allo|all|ai|agli|alle|a|sulla|sul|sull|sui|sulle|su|della|del|dell|dello|dei|delle|di|per la|per il|per i|per le|per)'
const PROMO = '(?:promo|promozione|offerta)'
const LAST = '(?:le )?ultim[ei] porzion[ei]'
const TODAY = 'solo (?:per )?oggi'
const OFF = '(?:togli|toglila|toglilo|rimuovi|leva|elimina|cancella|annulla|ferma|termina|chiudi|stop|basta|niente)'
const SET = '(?:metti|mettiamo|segna|aggiungi|fai|facciamo|imposta)'
export type SalesIntent = { kind: 'promo', target: string, price: number, untilText: string | null } | { kind: 'promoOff', target: string | null, all?: boolean } | { kind: 'scarcity', target: string | null, label: SalesLabelKey, value: boolean }
const clean = (s: string | undefined) => (s ?? '').replace(/^(?:il|lo|la|i|gli|le|l|un|una|uno)\s+/, '').trim()
/** Riconosce solo frasi di un piatto; null se non è una richiesta promo/scarsità (o se è composta). */
export function parseSalesText(raw: string): SalesIntent | null {
  const t = plainText(raw).replace(/(?<!\d)[,.]|[,.](?!\d)/g, ' ').replace(/\s+/g, ' ').trim()
  if (!/(promo|offerta|porzion|solo (per )?oggi)/.test(t) || /\?$/.test(raw.trim()) || /^(cosa|che|quali|quanto|quando|come)\b/.test(t)) return null
  let m: RegExpMatchArray | null
  // «togli tutte le promo»: tutte quelle attive (la regola delle 3 modifiche resta nel bot).
  if (new RegExp(`^${OFF} (?:tutte|tutti) (?:le |i )?(?:${PROMO}|promozioni|offerte)$`).test(t)) return { kind: 'promoOff', target: null, all: true }
  // «carbonara in promo a 10 solo oggi»: la promo vale fino a oggi.
  const todayOnly = new RegExp(` ${TODAY}$`).test(t) && /\b(promo|promozione|offerta)\b/.test(t)
  if (todayOnly) { const base = parseSalesText(raw.replace(/\s*,?\s*solo\s+(?:per\s+)?oggi\s*[.!]*\s*$/i, '')); if (base?.kind === 'promo' && !base.untilText) return { ...base, untilText: 'oggi' } }
  const promo = (target: string, value: string, cents: string | undefined, until: string | undefined): SalesIntent | null => { const price = amount(value, cents); return price === null || !clean(target) ? null : { kind: 'promo', target: clean(target), price, untilText: until?.trim() || null } }
  if ((m = t.match(new RegExp(`^(?:${SET} )?(.+?) in ${PROMO}(?: a| per| da)? ${NUM}(?: euro| eur)?${UNTIL}$`)))) return promo(m[1]!, m[2]!, m[3], m[4])
  if ((m = t.match(new RegExp(`^${SET} in ${PROMO} (.+?) (?:a |per |da )?${NUM}(?: euro| eur)?${UNTIL}$`)))) return promo(m[1]!, m[2]!, m[3], m[4])
  if ((m = t.match(new RegExp(`^${PROMO} (?:${OF} )?(.+?) (?:a |per |da )?${NUM}(?: euro| eur)?${UNTIL}$`)))) return promo(m[1]!, m[2]!, m[3], m[4])
  if ((m = t.match(new RegExp(`^(?:${OFF}|fine) (?:la |il |l |le )?${PROMO}(?: ${OF})?(?: (.+))?$`)))) return { kind: 'promoOff', target: clean(m[1]) || null }
  if ((m = t.match(new RegExp(`^(?:${OFF} )?(.+?) (?:non (?:e |sono )?piu in ${PROMO}|senza ${PROMO}|fuori ${PROMO}|(?:torna|tornano|rimetti|riporta) a prezzo pieno|a prezzo pieno)$`))) && clean(m[1])) return { kind: 'promoOff', target: clean(m[1]) }
  for (const [label, phrase] of [['lastPortions', LAST], ['onlyToday', TODAY]] as [SalesLabelKey, string][]) {
    if ((m = t.match(new RegExp(`^${OFF} (?:l etichetta |la scritta )?${phrase}(?: ${OF})?(?: (.+))?$`)))) return { kind: 'scarcity', target: clean(m[1]) || null, label, value: false }
    if ((m = t.match(new RegExp(`^(.+?) (?:non (?:e |sono )?piu ${phrase}|senza ${phrase})$`))) && clean(m[1])) return { kind: 'scarcity', target: clean(m[1]), label, value: false }
    if ((m = t.match(new RegExp(`^(?:${SET} )?(?:l etichetta |la scritta )?${phrase} (?:${OF} )?(.+)$`))) && clean(m[1])) return { kind: 'scarcity', target: clean(m[1]), label, value: true }
    if ((m = t.match(new RegExp(`^(?:${SET} )?(.+?) (?:e |sono |c e |ci sono |ha |hanno |con |come )?${phrase}$`))) && clean(m[1])) return { kind: 'scarcity', target: clean(m[1]), label, value: true }
  }
  return null
}

export type SalesTurn = { reply: string } | { actions: SalesAction[] } | { choose: { template: SalesTemplate, options: MenuRef[] } }
const shown = (target: string) => target.slice(0, 60)
/** Turno deterministico: intenzione → piatto → azione (oppure domanda/risposta). null = non è una frase promo/scarsità. */
export function salesTurn(text: string, workspace: Doc, refs: MenuRef[], today: string): SalesTurn | null {
  const intent = parseSalesText(text)
  if (!intent) return null
  // «Offerta pranzo a 11»: «offerta» fa parte del nome di un piatto esistente, non è una promo.
  const said = ' ' + plainText(text) + ' '
  if (refs.some(r => /\b(promo|promozione|offerta|offerte)\b/.test(plainText(r.name)) && said.includes(' ' + plainText(r.name) + ' '))) return null
  let template: SalesTemplate
  if (intent.kind === 'promo') {
    const until = intent.untilText ? resolveUntil(intent.untilText, today) : null
    if (intent.untilText && !until) return { reply: salesCopy.untilUnclear }
    template = { kind: 'promo', price: intent.price, until }
  } else if (intent.kind === 'promoOff') template = { kind: 'promo', price: null, until: null }
  else template = { kind: 'scarcity', label: intent.label, value: intent.value }
  let options: MenuRef[]
  if (intent.target) {
    options = findDishes(intent.target, refs)
    if (!options.length) return { reply: fill(copy.notFoundNamed, { nome: shown(intent.target) }) }
    // Togliere un'etichetta: tra più omonimi conta solo chi ce l'ha davvero.
    if (options.length > 1 && (intent.kind === 'promoOff' || (intent.kind === 'scarcity' && !intent.value))) { const items = itemsOf(workspace), owned = options.filter(r => { const i = items.get(r.id); return intent.kind === 'promoOff' ? !!i?.promo : !!i?.scarcity?.[(intent as { label: SalesLabelKey }).label] }); if (owned.length) options = owned }
  } else {
    // «togli ultime porzioni» / «togli la promo» senza piatto: il piatto (o i piatti) che hanno l'etichetta adesso.
    const items = itemsOf(workspace), label = intent.kind === 'promoOff' ? 'promo' : (intent as { label: SalesLabelKey }).label
    options = refs.filter(r => { const i = items.get(r.id); return label === 'promo' ? !!i?.promo : label === 'lastPortions' ? !!i?.scarcity?.lastPortions : i?.scarcity?.onlyToday === today })
    if (!options.length) return { reply: salesCopy.noneWithLabel[label] }
  }
  if (intent.kind === 'promoOff' && intent.all) return { actions: options.map(r => ({ ...template, id: r.id }) as SalesAction) }
  if (options.length > 1) return { choose: { template, options: options.slice(0, 8) } }
  return { actions: [{ ...template, id: options[0]!.id } as SalesAction] }
}

/** Validazione unica (frasi, scelta tra omonimi, modello): promo > 0 e < prezzo pieno, altrimenti NON si applica nulla e il bot lo dice. */
export function salesActionProblem(actions: { kind: string }[], workspace: Doc): string | null {
  const items = itemsOf(workspace)
  for (const a of actions) {
    if (a.kind !== 'promo') continue
    const p = a as Extract<SalesAction, { kind: 'promo' }>, item = items.get(p.id)
    if (!item || p.price === null) continue
    if (!validPromoPrice(p.price, item.price)) return fill(salesCopy.promoInvalid, { piatto: item.name.replace(/[*_~]/g, ''), pieno: euro(item.price), promo: euro(p.price) })
    if (item.priceDisplay?.trim()) return fill(salesCopy.promoPriceText, { piatto: item.name.replace(/[*_~]/g, ''), testo: item.priceDisplay.trim().slice(0, 60) })
  }
  return null
}

/** Cambia davvero qualcosa? (regola delle 3 modifiche: si contano solo i cambi effettivi). */
export function salesActionChanged(a: SalesAction, item: Item, today = businessDate()): boolean {
  if (a.kind === 'promo') return a.price === null ? !!item.promo : item.promo?.price !== a.price || (item.promo?.until ?? null) !== a.until
  if (a.label === 'lastPortions') return !!item.scarcity?.lastPortions !== a.value
  return a.value ? item.scarcity?.onlyToday !== today : !!item.scarcity?.onlyToday
}

export function applySalesAction(item: Item, a: SalesAction, today: string) {
  if (a.kind === 'promo') { if (a.price === null) delete item.promo; else item.promo = { price: a.price, until: a.until }; return }
  const scarcity = { lastPortions: !!item.scarcity?.lastPortions, onlyToday: item.scarcity?.onlyToday ?? null }
  if (a.label === 'lastPortions') scarcity.lastPortions = a.value; else scarcity.onlyToday = a.value ? today : null
  if (scarcity.lastPortions || scarcity.onlyToday) item.scarcity = scarcity; else delete item.scarcity
}

export function describeSalesAction(a: SalesAction, piatto: string, fullPrice: number): string {
  if (a.kind === 'promo') return a.price === null ? fill(salesLine.promoOff, { piatto, pieno: euro(fullPrice) }) : fill(salesLine.promo, { piatto, promo: euro(a.price), pieno: euro(fullPrice), fino: a.until ? fill(salesLine.until, { giorno: untilLabel(a.until) }) : salesLine.noEnd })
  return fill(a.label === 'lastPortions' ? (a.value ? salesLine.lastOn : salesLine.lastOff) : (a.value ? salesLine.todayOn : salesLine.todayOff), { piatto })
}

/** Azioni del modello (solo frasi composte). Prezzi come in set_price; «until» è il testo detto («domenica»), mai una data inventata. */
export const salesLlmActions = ['set_promo', 'remove_promo', 'set_last_portions', 'set_only_today']
export function salesFromLlm(a: { action?: unknown, item_id?: unknown, price?: unknown, until?: unknown, value?: unknown }, message: string, today = businessDate()): SalesAction | null {
  const id = String(a.item_id)
  if (a.action === 'remove_promo') return { kind: 'promo', id, price: null, until: null }
  if (a.action === 'set_promo') {
    const n = typeof a.price === 'string' ? Number(a.price.replace(',', '.').replace(/[€\s]/g, '')) : a.price
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > 100000) return null
    let until: string | null = null
    if (typeof a.until === 'string' && a.until.trim()) { if (!plainText(message).includes(plainText(a.until).split(' ').at(-1) ?? '\u0000')) return null; until = resolveUntil(a.until, today); if (!until) return null }
    return { kind: 'promo', id, price: Math.round(n * 100) / 100, until }
  }
  if ((a.action === 'set_last_portions' || a.action === 'set_only_today') && typeof a.value === 'boolean') return { kind: 'scarcity', id, label: a.action === 'set_last_portions' ? 'lastPortions' : 'onlyToday', value: a.value }
  return null
}
