// ─────────────────────────────── Tako — MOTORE AZIONI AI ───────────────────────────────
// Un unico registro di "tool" che l'AI (Groq function-calling) può invocare, condiviso
// da due personalità con permessi diversi:
//   • assistente CLIENTE  (scope 'customer') — agisce solo sul proprio tavolo/carrello
//   • copilot OWNER        (scope 'owner')    — opera su menu/statistiche/tavoli
//
// Principi di sicurezza (allineati alle route esistenti):
//   1. Ogni azione è SCOPED per restaurantId (e per tableId lato cliente): l'AI non può
//      mai toccare un altro tenant o un altro tavolo.
//   2. I prezzi/verità vengono SEMPRE dal DB, mai dal modello (add_to_cart risolve i piatti
//      per nome sul DB e restituisce prezzi autoritativi; il checkout li ricalcola comunque).
//   3. Le azioni sono classificate per "kind":
//        - 'read'     → sola lettura, esecuzione immediata
//        - 'action'   → effetto collaterale sicuro e reversibile (es. chiama cameriere)
//        - 'client'   → il server RISOLVE/valida, ma l'effetto lo applica il client (carrello PWA)
//        - 'mutation' → cambia dati persistenti: MAI eseguita durante la chat. Viene proposta
//                       e richiede conferma esplicita umana (endpoint /execute separato).
//   4. Le azioni distruttive (delete piatto/sezione) sono esposte SOLO come 'mutation':
//      passano sempre dalla card di conferma dell'owner, mai eseguite dal modello da solo.
//
// Riuso: nessuna logica duplicata di dominio "libera" — le mutation rispecchiano la stessa
// validazione delle route (ownership per restaurantId, emit socket identici).

import { db, restaurants, menus, menuSections, menuItems, itemVariants, orders, orderItems, tables, rooms, bills, billPayments, reservations, inventoryItems, inventoryMovements, staffShifts, users, sessions } from '@tako/db'
import { eq, and, asc, desc, gte, lt, lte, ne, inArray, isNull, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import bcrypt from 'bcryptjs'
import { io } from '../index.js'
import { round2, restaurantTimezone, dayKeyInTz, dayStartInTz, coverUnit, billTotalsFromOrders, recomputeOpenBill, BILLABLE_STATUSES } from './billing.js'

export type ActionScope = 'customer' | 'owner'
export type ActionKind = 'read' | 'action' | 'client' | 'mutation'

export interface ActionContext {
  restaurantId: string
  tableId?: string | null
  tableNumber?: string | null
  role?: string
}

export interface ActionResult {
  ok: boolean
  summary: string            // testo per il modello + eventuale UI
  clientAction?: any         // per kind 'client'/'action': op che il client applica
  data?: any
}

export interface ActionDef {
  name: string
  scope: ActionScope[]
  kind: ActionKind
  // Ruoli staff ammessi a ESEGUIRE l'azione (default: qualunque staff autenticato,
  // come le route REST protette da requireAuth). Va valorizzato SOLO sulle azioni che
  // le route REST restringono davvero — gestione staff (owner), sconti/incasso
  // (owner/cassiere), impostazioni ristorante (owner), turni altrui (owner/cassiere) —
  // altrimenti un dipendente col copilot ottiene privilegi che via HTTP non ha.
  roles?: string[]
  description: string
  parameters: Record<string, any>   // JSON schema per il function-calling
  label: (args: any) => string      // etichetta umana (conferma owner)
  execute: (ctx: ActionContext, args: any) => Promise<ActionResult>
  // Azione INTERNA: eseguibile via executeAction ma MAI offerta all'LLM (che
  // inventerebbe i parametri). Es. set_dish_image: l'URL viene dal file caricato, non
  // dal modello → la pilotiamo noi in modo deterministico (WhatsApp/copilot).
  hidden?: boolean
}

const ORDER_STATUS_IT: Record<string, string> = {
  pending: 'in attesa', confirmed: 'confermato', preparing: 'in preparazione',
  ready: 'pronto', served: 'servito', paid: 'pagato', cancelled: 'annullato',
}

// Risolve un piatto per nome sul DB, scoped al ristorante. Match esatto → prefisso →
// contiene. Ritorna undefined se ambiguo/assente. `onlyAvailable` per l'ordine cliente.
async function resolveItem(restaurantId: string, name: string, onlyAvailable: boolean) {
  const q = (name ?? '').toString().toLowerCase().trim()
  if (!q) return undefined
  const where = onlyAvailable
    ? and(eq(menuItems.restaurantId, restaurantId), eq(menuItems.available, true))
    : eq(menuItems.restaurantId, restaurantId)
  const items = (await db.select().from(menuItems).where(where))
    .sort((a, b) => a.name.localeCompare(b.name)) // ordine deterministico
  // Per ogni tier: risolvi SOLO se il match è univoco. Più candidati → ambiguo →
  // undefined (l'AI dirà "non trovato/specifica meglio" invece di agire a caso).
  const tiers = [
    (i: typeof items[number]) => i.name.toLowerCase() === q,
    (i: typeof items[number]) => i.name.toLowerCase().startsWith(q),
    (i: typeof items[number]) => i.name.toLowerCase().includes(q),
    (i: typeof items[number]) => q.includes(i.name.toLowerCase()),
  ]
  for (const pred of tiers) {
    const hits = items.filter(pred)
    if (hits.length === 1) return hits[0]
    if (hits.length > 1) return undefined // ambiguo: non indovinare
  }
  return undefined
}

// Risolve una sezione per nome tra i menu del ristorante (ownership: section →
// menu → restaurantId). Stessa politica di resolveItem: match univoco o niente.
// Ritorna sempre l'elenco sezioni, così il chiamante può elencarle se ambiguo.
async function resolveSection(restaurantId: string, name: string) {
  const menusRows = await db.select({ id: menus.id }).from(menus).where(eq(menus.restaurantId, restaurantId))
  const menuIds = menusRows.map(m => m.id)
  if (!menuIds.length) return { section: undefined, sections: [] as { id: string; name: string }[] }
  const sections = (await db.select().from(menuSections).where(inArray(menuSections.menuId, menuIds)))
    .sort((a, b) => a.name.localeCompare(b.name))
  const q = (name ?? '').toString().toLowerCase().trim()
  if (!q) return { section: undefined, sections }
  const tiers = [
    (s: typeof sections[number]) => s.name.toLowerCase() === q,
    (s: typeof sections[number]) => s.name.toLowerCase().startsWith(q),
    (s: typeof sections[number]) => s.name.toLowerCase().includes(q),
  ]
  for (const pred of tiers) {
    const hits = sections.filter(pred)
    if (hits.length === 1) return { section: hits[0], sections }
    if (hits.length > 1) return { section: undefined, sections } // ambiguo: elenca, non indovinare
  }
  return { section: undefined, sections }
}

// Risolve un TAVOLO per numero (es. "12"), scoped al ristorante, solo attivi.
async function resolveTable(restaurantId: string, number: string) {
  const num = (number ?? '').toString().trim()
  if (!num) return undefined
  const [t] = await db.select().from(tables)
    .where(and(eq(tables.restaurantId, restaurantId), eq(tables.number, num), eq(tables.active, true)))
    .limit(1)
  return t
}

// Prossimo numero di tavolo LIBERO, scoped al ristorante. L'owner non deve indicare
// il numero: se non lo dice, l'assistente lo assegna da solo. Regola: il PIÙ PICCOLO
// intero positivo non ancora usato (riempie i buchi, "in sequenza"), NON max+1 — così
// un tavolo con numero anomalo (es. un "324" da typo) non spinge i nuovi a 325. I
// numeri non numerici (nomi tavolo) sono ignorati. Considera anche gli inattivi come
// occupati, per non "resuscitare" il numero di un tavolo eliminato.
async function nextTableNumber(restaurantId: string): Promise<string> {
  const rows = await db.select({ number: tables.number }).from(tables)
    .where(eq(tables.restaurantId, restaurantId))
  const used = new Set<number>()
  for (const r of rows) {
    const n = parseInt(String(r.number), 10)
    if (Number.isFinite(n) && n > 0) used.add(n)
  }
  let n = 1
  while (used.has(n)) n++
  return String(n)
}

// Notifica le dashboard aperte che i tavoli sono cambiati → refetch live (Sala/Gestione
// Tavoli ascoltano 'table:updated' e rifanno GET /tables/rooms). Le mutation via copilot
// o WhatsApp NON passano dalle route HTTP, quindi senza questo il tavolo comparirebbe
// solo dopo un reload manuale.
function emitTablesChanged(restaurantId: string, tableId?: string): void {
  try { io.to(`restaurant:${restaurantId}`).emit('table:updated', { tableId: tableId ?? null }) } catch { /* socket best-effort */ }
}

// Coercizione booleana robusta per i flag che arrivano dall'LLM (true/"true"/1/"sì").
// Serve dove label ed execute DEVONO concordare (es. set_staff_active).
function flagTrue(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true' || v === 'si' || v === 'sì'
}

// Notifica un cambiamento del menu a: dashboard owner (room restaurant → loadAll) E menu
// pubblico dei clienti (room menu → refetch). Serve per create/delete/rename/variant, che
// altrimenti non comparirebbero live né in dashboard né sul menu QR dei clienti.
function emitMenuChanged(restaurantId: string): void {
  try {
    io.to(`restaurant:${restaurantId}`).emit('menu:updated', {})
    io.to(`menu:${restaurantId}`).emit('menu:updated', {})
  } catch { /* socket best-effort */ }
}

// Menu attivo del ristorante, creandone uno di default se non esiste ancora. Permette di
// costruire il menu da zero via chat ("crea la sezione Antipasti") senza dover prima
// aprire la dashboard.
async function ensureMenu(restaurantId: string) {
  const rows = await db.select().from(menus).where(eq(menus.restaurantId, restaurantId)).orderBy(asc(menus.position))
  const existing = rows.find(m => m.active) ?? rows[0]
  if (existing) return existing
  const [created] = await db.insert(menus).values({ restaurantId, name: 'Menu' }).returning()
  return created!
}

// Risolve un MEMBRO dello staff per nome (attivi), match univoco o niente.
async function resolveStaff(restaurantId: string, name: string, includeInactive = false) {
  const q = (name ?? '').toString().toLowerCase().trim()
  if (!q) return { user: undefined, all: [] as { id: string; name: string }[] }
  const where = includeInactive
    ? eq(users.restaurantId, restaurantId)
    : and(eq(users.restaurantId, restaurantId), eq(users.active, true))
  const all = (await db.select().from(users).where(where)).sort((a, b) => a.name.localeCompare(b.name))
  const tiers = [
    (u: typeof all[number]) => u.name.toLowerCase() === q,
    (u: typeof all[number]) => u.name.toLowerCase().startsWith(q),
    (u: typeof all[number]) => u.name.toLowerCase().includes(q),
  ]
  for (const pred of tiers) {
    const hits = all.filter(pred)
    if (hits.length === 1) return { user: hits[0], all }
    if (hits.length > 1) return { user: undefined, all }
  }
  return { user: undefined, all }
}

// Risolve un INGREDIENTE d'inventario per nome, match univoco o niente.
async function resolveInventory(restaurantId: string, name: string) {
  const q = (name ?? '').toString().toLowerCase().trim()
  if (!q) return undefined
  const all = (await db.select().from(inventoryItems).where(eq(inventoryItems.restaurantId, restaurantId)))
    .sort((a, b) => a.name.localeCompare(b.name))
  const tiers = [
    (i: typeof all[number]) => i.name.toLowerCase() === q,
    (i: typeof all[number]) => i.name.toLowerCase().startsWith(q),
    (i: typeof all[number]) => i.name.toLowerCase().includes(q),
  ]
  for (const pred of tiers) {
    const hits = all.filter(pred)
    if (hits.length === 1) return hits[0]
    if (hits.length > 1) return undefined
  }
  return undefined
}

// Risolve una PRENOTAZIONE per nome cliente in una data (default oggi), non cancellata.
async function resolveReservation(restaurantId: string, customerName: string, date?: string) {
  const tz = await restaurantTimezone(restaurantId)
  const hasDate = !!(date && /^\d{4}-\d{2}-\d{2}$/.test(date))
  const dateStr = hasDate ? date! : dayKeyInTz(new Date(), tz)
  const q = (customerName ?? '').toString().toLowerCase().trim()
  // Nome vuoto → nessun match: con `includes('')` OGNI prenotazione matcherebbe e,
  // se il giorno ne ha una sola, un cancel_reservation senza nome la cancellerebbe.
  if (!q) return { resv: undefined, hits: [], dateStr }
  // Con data → finestra di quel giorno. SENZA data (il modello spesso non la fornisce)
  // → NON limitare a oggi: cerca da inizio giornata di oggi IN AVANTI (prenotazioni
  // future comprese), altrimenti una prenotazione di domani risulterebbe inesistente.
  const conds = [eq(reservations.restaurantId, restaurantId), ne(reservations.status, 'cancelled')]
  if (hasDate) {
    const dayStart = dayStartInTz(dateStr, tz)
    conds.push(gte(reservations.startsAt, dayStart), lt(reservations.startsAt, new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)))
  } else {
    conds.push(gte(reservations.startsAt, dayStartInTz(dayKeyInTz(new Date(), tz), tz)))
  }
  const rows = await db.select().from(reservations).where(and(...conds)).orderBy(asc(reservations.startsAt))
  const hits = rows.filter(r => r.customerName.toLowerCase().includes(q))
  if (hits.length === 1) return { resv: hits[0], hits, dateStr }
  return { resv: undefined, hits, dateStr }
}

// Conto APERTO del tavolo indicato per numero (per sconto/incasso).
async function openBillForTable(restaurantId: string, tableNumber: string) {
  const t = await resolveTable(restaurantId, tableNumber)
  if (!t) return { table: undefined, bill: undefined }
  const [bill] = await db.select().from(bills)
    .where(and(eq(bills.restaurantId, restaurantId), eq(bills.tableId, t.id), eq(bills.status, 'open')))
    .orderBy(desc(bills.createdAt)).limit(1)
  return { table: t, bill }
}

// ─────────────────────────────── REGISTRO AZIONI ───────────────────────────────
const ACTIONS: ActionDef[] = [
  // ── CLIENTE ────────────────────────────────────────────────────────────────
  {
    name: 'search_menu',
    scope: ['customer', 'owner'],
    kind: 'read',
    description: 'Cerca piatti nel menu del ristorante per nome, ingrediente o categoria. Usalo per consigliare o verificare disponibilità/prezzi.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Testo da cercare (es. "pesce", "senza glutine", "margherita")' } }, required: ['query'] },
    label: (a) => `Cerca "${a?.query ?? ''}"`,
    execute: async (ctx, args) => {
      const q = (args?.query ?? '').toString().toLowerCase().trim()
      const items = await db.select().from(menuItems)
        .where(and(eq(menuItems.restaurantId, ctx.restaurantId), eq(menuItems.available, true)))
      const matches = (q
        ? items.filter(i => i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q)
            || (i.tags ?? []).some(t => t.toLowerCase().includes(q)) || (i.allergens ?? []).some(t => t.toLowerCase().includes(q)))
        : items).slice(0, 8)
      const top = matches.map(i => ({ id: i.id, name: i.name, price: i.price, description: i.description ?? undefined, allergens: i.allergens ?? [] }))
      return { ok: true, data: top, summary: top.length ? top.map(t => `${t.name} (€${t.price})`).join('; ') : 'Nessun piatto corrispondente.' }
    },
  },
  {
    name: 'add_to_cart',
    scope: ['customer'],
    kind: 'client',
    description: 'Prepara l\'aggiunta di uno o più piatti al carrello del cliente. Il server risolve i piatti sul menu reale; il cliente poi conferma l\'ordine dal carrello.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array', description: 'Piatti da aggiungere',
          items: { type: 'object', properties: { name: { type: 'string' }, quantity: { type: 'integer', minimum: 1, maximum: 20 } }, required: ['name'] },
        },
      },
      required: ['items'],
    },
    label: (a) => `Aggiungi al carrello (${(a?.items ?? []).length} voci)`,
    execute: async (ctx, args) => {
      const reqItems = Array.isArray(args?.items) ? args.items.slice(0, 15) : []
      const resolved: any[] = []
      const missing: string[] = []
      for (const it of reqItems) {
        const qty = Math.min(Math.max(parseInt(String(it?.quantity ?? 1), 10) || 1, 1), 20)
        const match = await resolveItem(ctx.restaurantId, it?.name, true)
        if (!match) { missing.push(String(it?.name ?? '?')); continue }
        // prezzo AUTORITATIVO dal DB (mai dal modello); il checkout lo ricalcola comunque.
        resolved.push({ menuItemId: match.id, name: match.name, unitPrice: match.price, quantity: qty })
      }
      if (!resolved.length) return { ok: false, summary: `Non ho trovato a menu: ${missing.join(', ') || 'niente'}.` }
      return {
        ok: true,
        clientAction: { type: 'add_to_cart', items: resolved },
        summary: `Aggiungo: ${resolved.map(r => `${r.quantity}× ${r.name}`).join(', ')}${missing.length ? ` (non trovati: ${missing.join(', ')})` : ''}. Il cliente conferma dal carrello.`,
      }
    },
  },
  {
    name: 'call_waiter',
    scope: ['customer'],
    kind: 'action',
    description: 'Chiama un cameriere al tavolo del cliente. Motivo: help (aiuto), bill (il conto), water (acqua/pane).',
    parameters: { type: 'object', properties: { reason: { type: 'string', enum: ['help', 'bill', 'water'] } }, required: ['reason'] },
    label: (a) => `Chiama cameriere (${a?.reason ?? 'help'})`,
    execute: async (ctx, args) => {
      if (!ctx.tableId) return { ok: false, summary: 'La chiamata al cameriere è disponibile solo con una sessione al tavolo.' }
      const reason = ['help', 'bill', 'water'].includes(args?.reason) ? args.reason : 'help'
      io.to(`restaurant:${ctx.restaurantId}`).emit('waiter:called', { tableId: ctx.tableId, tableNumber: ctx.tableNumber, type: reason })
      return { ok: true, clientAction: { type: 'waiter_called', reason }, summary: 'Ho avvisato il cameriere, arriva subito.' }
    },
  },
  {
    name: 'order_status',
    scope: ['customer'],
    kind: 'read',
    description: 'Riporta lo stato dell\'ultimo ordine del tavolo del cliente.',
    parameters: { type: 'object', properties: {} },
    label: () => 'Stato ordine',
    execute: async (ctx) => {
      if (!ctx.tableId) return { ok: false, summary: 'Nessun tavolo attivo per tracciare un ordine.' }
      const [o] = await db.select().from(orders)
        .where(and(eq(orders.restaurantId, ctx.restaurantId), eq(orders.tableId, ctx.tableId)))
        .orderBy(desc(orders.createdAt)).limit(1)
      if (!o) return { ok: true, summary: 'Non risultano ordini per questo tavolo.' }
      return { ok: true, data: { id: o.id, status: o.status }, summary: `Il tuo ultimo ordine è "${ORDER_STATUS_IT[o.status] ?? o.status}".` }
    },
  },

  // ── OWNER ──────────────────────────────────────────────────────────────────
  {
    name: 'get_today_revenue',
    scope: ['owner'],
    kind: 'read',
    description: 'Incasso, mance, numero conti e ticket medio di OGGI (fuso del ristorante).',
    parameters: { type: 'object', properties: {} },
    label: () => 'Incasso di oggi',
    execute: async (ctx) => {
      const tz = await restaurantTimezone(ctx.restaurantId)
      const start = dayStartInTz(dayKeyInTz(new Date(), tz), tz)
      const closed = await db.select().from(bills)
        .where(and(eq(bills.restaurantId, ctx.restaurantId), eq(bills.status, 'closed'), gte(bills.closedAt!, start)))
      const revenue = round2(closed.reduce((s, b) => s + b.total, 0))
      const tips = round2(closed.reduce((s, b) => s + (b.tip ?? 0), 0))
      const avg = closed.length ? round2(revenue / closed.length) : 0
      return {
        ok: true,
        data: { revenue, tips, billsCount: closed.length, avgTicket: avg },
        summary: `Oggi: incasso €${revenue}, ${closed.length} conti, mance €${tips}, ticket medio €${avg}.`,
      }
    },
  },
  {
    name: 'get_stats',
    scope: ['owner'],
    kind: 'read',
    description: 'Statistiche degli ultimi N giorni: incasso, conti chiusi, ordini attivi ora, conti aperti ora.',
    parameters: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 90, description: 'Giorni (default 7)' } } },
    label: (a) => `Statistiche ${a?.days ?? 7}gg`,
    execute: async (ctx, args) => {
      const days = Math.min(Math.max(parseInt(String(args?.days ?? 7), 10) || 7, 1), 90)
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      const closed = await db.select().from(bills)
        .where(and(eq(bills.restaurantId, ctx.restaurantId), eq(bills.status, 'closed'), gte(bills.closedAt!, since)))
      const revenue = round2(closed.reduce((s, b) => s + b.total, 0))
      const active = await db.select({ id: orders.id }).from(orders)
        .where(and(eq(orders.restaurantId, ctx.restaurantId), inArray(orders.status, ['pending', 'confirmed', 'preparing', 'ready'])))
      const openBills = await db.select({ id: bills.id }).from(bills)
        .where(and(eq(bills.restaurantId, ctx.restaurantId), eq(bills.status, 'open')))
      return {
        ok: true,
        data: { days, revenue, billsClosed: closed.length, activeOrders: active.length, openBills: openBills.length },
        summary: `Ultimi ${days} giorni: incasso €${revenue} su ${closed.length} conti. Ora: ${active.length} ordini attivi, ${openBills.length} conti aperti.`,
      }
    },
  },
  {
    name: 'table_status',
    scope: ['owner'],
    kind: 'read',
    description: 'Panoramica dei tavoli per stato (liberi/occupati/…) e numero conti aperti.',
    parameters: { type: 'object', properties: {} },
    label: () => 'Stato tavoli',
    execute: async (ctx) => {
      const ts = await db.select({ status: tables.status }).from(tables)
        .where(and(eq(tables.restaurantId, ctx.restaurantId), eq(tables.active, true)))
      const counts: Record<string, number> = {}
      for (const t of ts) counts[t.status] = (counts[t.status] ?? 0) + 1
      const openBills = await db.select({ id: bills.id }).from(bills)
        .where(and(eq(bills.restaurantId, ctx.restaurantId), eq(bills.status, 'open')))
      const it: Record<string, string> = { free: 'liberi', occupied: 'occupati', waiting: 'in attesa', cleaning: 'in pulizia', reserved: 'prenotati' }
      const parts = Object.entries(counts).map(([k, v]) => `${v} ${it[k] ?? k}`)
      return { ok: true, data: { counts, openBills: openBills.length }, summary: `Tavoli: ${parts.join(', ') || 'nessuno'}. Conti aperti: ${openBills.length}.` }
    },
  },
  {
    name: 'set_item_availability',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Segna un piatto come ESAURITO (available=false) o di nuovo DISPONIBILE (available=true).',
    parameters: {
      type: 'object',
      properties: { itemName: { type: 'string', description: 'Nome del piatto' }, available: { type: 'boolean', description: 'true=disponibile, false=esaurito' } },
      required: ['itemName', 'available'],
    },
    label: (a) => `${a?.available ? 'Rendi disponibile' : 'Segna esaurito'}: "${a?.itemName ?? ''}"`,
    execute: async (ctx, args) => {
      const match = await resolveItem(ctx.restaurantId, args?.itemName, false)
      if (!match) return { ok: false, summary: `Piatto "${args?.itemName ?? ''}" non trovato nel menu.` }
      const available = args?.available === true
      const [item] = await db.update(menuItems).set({ available, updatedAt: new Date() })
        .where(and(eq(menuItems.id, match.id), eq(menuItems.restaurantId, ctx.restaurantId))).returning()
      if (!item) return { ok: false, summary: 'Aggiornamento non riuscito.' }
      // stessi emit della route menu.ts (dashboard + room pubblica menu)
      io.to(`restaurant:${ctx.restaurantId}`).emit('menu:item_availability', { itemId: item.id, available })
      io.to(`menu:${ctx.restaurantId}`).emit('menu:item_availability', { itemId: item.id, available })
      return { ok: true, data: { id: item.id, name: item.name, available }, summary: `"${item.name}" ora è ${available ? 'disponibile' : 'esaurito'}.` }
    },
  },
  {
    name: 'create_menu_item',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Crea un nuovo piatto nel menu. Se la sezione non esiste viene creata.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        price: { type: 'number', minimum: 0 },
        sectionName: { type: 'string', description: 'Sezione del menu (es. "Primi"). Opzionale.' },
        description: { type: 'string' },
      },
      required: ['name', 'price'],
    },
    label: (a) => `Crea piatto "${a?.name ?? ''}" a €${a?.price ?? '?'}`,
    execute: async (ctx, args) => {
      const name = (args?.name ?? '').toString().trim()
      const price = Number(args?.price)
      if (!name || !Number.isFinite(price) || price < 0) return { ok: false, summary: 'Nome o prezzo non valido.' }
      // menu del ristorante (attivo; creato al volo se non esiste ancora)
      const menu = await ensureMenu(ctx.restaurantId)
      const sections = await db.select().from(menuSections).where(eq(menuSections.menuId, menu.id)).orderBy(asc(menuSections.position))
      const wanted = (args?.sectionName ?? '').toString().toLowerCase().trim()
      // Stessa politica di resolveSection: esatto → prefisso → contiene, e SOLO se
      // il match è univoco (prima si prendeva il primo `.includes()` → piatto nella
      // sezione sbagliata con nomi simili, es. "Pizze" vs "Pizze speciali").
      let section = sections[0]
      if (wanted) {
        section = undefined as typeof section
        for (const pred of [
          (s: typeof sections[number]) => s.name.toLowerCase() === wanted,
          (s: typeof sections[number]) => s.name.toLowerCase().startsWith(wanted),
          (s: typeof sections[number]) => s.name.toLowerCase().includes(wanted),
        ]) {
          const hits = sections.filter(pred)
          if (hits.length === 1) { section = hits[0]; break }
          if (hits.length > 1) {
            return { ok: false, summary: `Più sezioni corrispondono a "${args?.sectionName}": ${hits.map(s => `"${s.name}"`).join(', ')}. Specifica quale.` }
          }
        }
      }
      if (!section) {
        const [created] = await db.insert(menuSections).values({ menuId: menu.id, name: (args?.sectionName ?? 'Varie').toString().slice(0, 60), position: sections.length }).returning()
        section = created
      }
      if (!section) return { ok: false, summary: 'Impossibile determinare la sezione.' }
      const [item] = await db.insert(menuItems).values({
        sectionId: section.id, restaurantId: ctx.restaurantId, name: name.slice(0, 120), price,
        description: args?.description ? String(args.description).slice(0, 500) : undefined,
      }).returning()
      if (!item) return { ok: false, summary: 'Creazione non riuscita.' }
      emitMenuChanged(ctx.restaurantId)
      return { ok: true, data: { id: item.id, name: item.name, price: item.price, section: section.name }, summary: `Creato "${item.name}" a €${item.price} in "${section.name}".` }
    },
  },
  {
    name: 'create_menu_section',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Crea una nuova sezione/categoria del menu (es. "Antipasti", "Primi", "Dolci").',
    parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    label: (a) => `Crea sezione menu "${a?.name ?? '?'}"`,
    execute: async (ctx, args) => {
      const name = (args?.name ?? '').toString().trim()
      if (!name) return { ok: false, summary: 'Nome sezione mancante.' }
      const menu = await ensureMenu(ctx.restaurantId)
      const sections = await db.select().from(menuSections).where(eq(menuSections.menuId, menu.id))
      if (sections.some(s => s.name.toLowerCase() === name.toLowerCase())) return { ok: false, summary: `La sezione "${name}" esiste già.` }
      const [section] = await db.insert(menuSections).values({ menuId: menu.id, name: name.slice(0, 60), position: sections.length }).returning()
      emitMenuChanged(ctx.restaurantId)
      return { ok: true, data: { id: section!.id, name: section!.name }, summary: `Sezione "${section!.name}" creata.` }
    },
  },
  {
    // INTERNA (hidden): l'URL viene dal file caricato (WhatsApp/copilot), non dal modello.
    name: 'set_dish_image',
    scope: ['owner'],
    kind: 'mutation',
    hidden: true,
    description: 'Assegna una foto già caricata a un piatto del menu.',
    parameters: { type: 'object', properties: { itemName: { type: 'string' }, imageUrl: { type: 'string' } }, required: ['itemName', 'imageUrl'] },
    label: (a) => `Foto → "${a?.itemName ?? '?'}"`,
    execute: async (ctx, args) => {
      const url = String(args?.imageUrl ?? '').trim()
      if (!url.startsWith('/uploads/')) return { ok: false, summary: 'Immagine non valida.' }
      const match = await resolveItem(ctx.restaurantId, args?.itemName, false)
      if (!match) return { ok: false, summary: `Piatto "${args?.itemName ?? ''}" non trovato (o nome ambiguo: specifica meglio).` }
      const [item] = await db.update(menuItems).set({ imageUrl: url, updatedAt: new Date() })
        .where(and(eq(menuItems.id, match.id), eq(menuItems.restaurantId, ctx.restaurantId))).returning()
      if (!item) return { ok: false, summary: 'Assegnazione non riuscita.' }
      emitMenuChanged(ctx.restaurantId)
      return { ok: true, data: { id: item.id, imageUrl: url }, summary: `Foto assegnata a "${item.name}".` }
    },
  },
  {
    // kind 'read' → esegue subito e mostra il testo generato (una mutation chiederebbe
    // conferma "alla cieca"). Genera + salva la descrizione. Sempre attiva.
    name: 'generate_dish_description',
    scope: ['owner'],
    kind: 'read',
    description: 'Genera con l\'AI una descrizione appetitosa per un piatto del menu e la salva.',
    parameters: { type: 'object', properties: { itemName: { type: 'string' }, style: { type: 'string', description: 'tono opzionale (es. "elegante", "informale", "gourmet")' } }, required: ['itemName'] },
    label: (a) => `Descrizione AI per "${a?.itemName ?? '?'}"`,
    execute: async (ctx, args) => {
      const match = await resolveItem(ctx.restaurantId, args?.itemName, false)
      if (!match) return { ok: false, summary: `Piatto "${args?.itemName ?? ''}" non trovato (o nome ambiguo).` }
      let desc: string
      try {
        desc = await groqComplete(
          'Sei un copywriter di menù per ristoranti italiani. Scrivi UNA sola descrizione breve (max 200 caratteri), appetitosa e concreta (ingredienti/preparazione), in italiano. NIENTE virgolette, niente ripetere il nome del piatto all\'inizio, niente prezzo. Solo la descrizione.',
          `Piatto: "${match.name}"${args?.style ? ` — tono: ${args.style}` : ''}.`,
          160,
        )
      } catch { return { ok: false, summary: 'Generazione AI non disponibile in questo momento, riprova tra poco.' } }
      desc = desc.replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 300)
      const [item] = await db.update(menuItems).set({ description: desc, updatedAt: new Date() })
        .where(and(eq(menuItems.id, match.id), eq(menuItems.restaurantId, ctx.restaurantId))).returning()
      if (!item) return { ok: false, summary: 'Salvataggio descrizione non riuscito.' }
      emitMenuChanged(ctx.restaurantId)
      return { ok: true, data: { id: item.id, description: desc }, summary: `Descrizione di "${item.name}" aggiornata: ${desc}` }
    },
  },
  {
    name: 'update_menu_item',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Modifica un piatto esistente: prezzo e/o nome e/o descrizione. Indica solo i campi da cambiare.',
    parameters: {
      type: 'object',
      properties: {
        itemName: { type: 'string', description: 'Nome attuale del piatto da modificare' },
        price: { type: 'number', minimum: 0, description: 'Nuovo prezzo in euro (opzionale)' },
        name: { type: 'string', description: 'Nuovo nome (opzionale)' },
        description: { type: 'string', description: 'Nuova descrizione (opzionale)' },
      },
      required: ['itemName'],
    },
    label: (a) => {
      const parts: string[] = []
      if (a?.price != null) parts.push(`prezzo €${a.price}`)
      if (a?.name) parts.push(`nome "${a.name}"`)
      if (a?.description) parts.push('descrizione')
      return `Modifica "${a?.itemName ?? ''}"${parts.length ? ` → ${parts.join(', ')}` : ''}`
    },
    execute: async (ctx, args) => {
      const match = await resolveItem(ctx.restaurantId, args?.itemName, false)
      if (!match) return { ok: false, summary: `Piatto "${args?.itemName ?? ''}" non trovato nel menu (o nome ambiguo: specifica meglio).` }
      const set: Record<string, any> = {}
      const changes: string[] = []
      if (args?.price != null) {
        const price = Number(args.price)
        if (!Number.isFinite(price) || price < 0) return { ok: false, summary: 'Prezzo non valido.' }
        set['price'] = price; changes.push(`prezzo €${match.price} → €${price}`)
      }
      if (args?.name != null && String(args.name).trim()) {
        set['name'] = String(args.name).trim().slice(0, 120); changes.push(`nome "${match.name}" → "${set['name']}"`)
      }
      if (args?.description != null && String(args.description).trim()) {
        set['description'] = String(args.description).trim().slice(0, 500); changes.push('descrizione aggiornata')
      }
      if (!changes.length) return { ok: false, summary: 'Nessuna modifica indicata: specifica prezzo, nome o descrizione.' }
      const [item] = await db.update(menuItems).set({ ...set, updatedAt: new Date() })
        .where(and(eq(menuItems.id, match.id), eq(menuItems.restaurantId, ctx.restaurantId))).returning()
      if (!item) return { ok: false, summary: 'Aggiornamento non riuscito.' }
      // stessi emit della PATCH /items/:id: riga completa alla dashboard, campi
      // pubblici (MAI costPrice) alla room menu pubblica.
      io.to(`restaurant:${ctx.restaurantId}`).emit('menu:updated', { itemId: item.id, item })
      io.to(`menu:${ctx.restaurantId}`).emit('menu:updated', { itemId: item.id, item: {
        id: item.id, sectionId: item.sectionId, name: item.name, description: item.description,
        price: item.price, imageUrl: item.imageUrl, allergens: item.allergens, tags: item.tags, available: item.available,
      } })
      return { ok: true, data: { id: item.id, name: item.name, price: item.price }, summary: `Aggiornato "${item.name}": ${changes.join(', ')}.` }
    },
  },
  {
    name: 'delete_menu_item',
    scope: ['owner'],
    kind: 'mutation',
    description: 'ELIMINA definitivamente un piatto dal menu (non solo esaurito: lo rimuove). Per segnare esaurito usa set_item_availability.',
    parameters: {
      type: 'object',
      properties: { itemName: { type: 'string', description: 'Nome del piatto da eliminare' } },
      required: ['itemName'],
    },
    label: (a) => `Elimina piatto "${a?.itemName ?? ''}"`,
    execute: async (ctx, args) => {
      const match = await resolveItem(ctx.restaurantId, args?.itemName, false)
      if (!match) return { ok: false, summary: `Piatto "${args?.itemName ?? ''}" non trovato nel menu (o nome ambiguo: specifica meglio).` }
      // stessa sequenza della DELETE /items/:id: prima si scollega lo storico
      // ordini (orderItems.menuItemId → null), poi si cancella il piatto.
      await db.update(orderItems).set({ menuItemId: null }).where(eq(orderItems.menuItemId, match.id))
      await db.delete(menuItems).where(and(eq(menuItems.id, match.id), eq(menuItems.restaurantId, ctx.restaurantId)))
      emitMenuChanged(ctx.restaurantId)
      return { ok: true, data: { id: match.id, name: match.name }, summary: `Piatto "${match.name}" eliminato.` }
    },
  },
  {
    name: 'delete_menu_section',
    scope: ['owner'],
    kind: 'mutation',
    description: 'ELIMINA definitivamente una sezione del menu e tutti i suoi piatti (es. "Antipasti"). Azione irreversibile.',
    parameters: {
      type: 'object',
      properties: { sectionName: { type: 'string', description: 'Nome della sezione da eliminare' } },
      required: ['sectionName'],
    },
    label: (a) => `Elimina sezione "${a?.sectionName ?? ''}" (con i suoi piatti)`,
    execute: async (ctx, args) => {
      const { section, sections } = await resolveSection(ctx.restaurantId, args?.sectionName)
      if (!section) {
        const list = sections.map(s => `"${s.name}"`).join(', ')
        return { ok: false, summary: `Sezione "${args?.sectionName ?? ''}" non trovata o ambigua. Sezioni presenti: ${list || 'nessuna'}.` }
      }
      // stessa sequenza della DELETE /sections/:id: scollega gli ordini dai
      // piatti della sezione, poi cancella la sezione (i piatti cascano).
      const items = await db.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.sectionId, section.id))
      for (const it of items) {
        await db.update(orderItems).set({ menuItemId: null }).where(eq(orderItems.menuItemId, it.id))
      }
      await db.delete(menuSections).where(eq(menuSections.id, section.id))
      emitMenuChanged(ctx.restaurantId)
      return { ok: true, data: { id: section.id, name: section.name, itemsRemoved: items.length }, summary: `Sezione "${section.name}" eliminata (${items.length} piatti rimossi).` }
    },
  },
  {
    name: 'rename_menu_section',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Rinomina una sezione del menu (es. "Antipasti" → "Per iniziare").',
    parameters: {
      type: 'object',
      properties: {
        sectionName: { type: 'string', description: 'Nome attuale della sezione' },
        newName: { type: 'string', description: 'Nuovo nome' },
      },
      required: ['sectionName', 'newName'],
    },
    label: (a) => `Rinomina sezione "${a?.sectionName ?? ''}" → "${a?.newName ?? ''}"`,
    execute: async (ctx, args) => {
      const newName = (args?.newName ?? '').toString().trim().slice(0, 60)
      if (!newName) return { ok: false, summary: 'Nuovo nome non valido.' }
      const { section, sections } = await resolveSection(ctx.restaurantId, args?.sectionName)
      if (!section) {
        const list = sections.map(s => `"${s.name}"`).join(', ')
        return { ok: false, summary: `Sezione "${args?.sectionName ?? ''}" non trovata o ambigua. Sezioni presenti: ${list || 'nessuna'}.` }
      }
      await db.update(menuSections).set({ name: newName }).where(eq(menuSections.id, section.id))
      emitMenuChanged(ctx.restaurantId)
      return { ok: true, data: { id: section.id, name: newName }, summary: `Sezione "${section.name}" rinominata in "${newName}".` }
    },
  },

  // ── OWNER · TAVOLI ─────────────────────────────────────────────────────────
  {
    name: 'create_table',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Crea un nuovo tavolo con posti (es. tavolo da 4). Numero e sala opzionali: se il numero non è indicato viene assegnato automaticamente (prossimo libero).',
    parameters: {
      type: 'object',
      properties: {
        number: { type: 'string', description: 'Numero/nome del tavolo (es. "12"). OPZIONALE: se omesso viene assegnato il prossimo libero.' },
        seats: { type: 'integer', minimum: 1, maximum: 40, description: 'Posti (default 4)' },
        roomName: { type: 'string', description: 'Sala in cui metterlo (opzionale)' },
      },
      required: [],
    },
    label: (a) => `Crea tavolo ${a?.number ?? '(auto)'}${a?.seats ? ` (${a.seats} posti)` : ''}${a?.roomName ? ` in "${a.roomName}"` : ''}`,
    execute: async (ctx, args) => {
      // Numero OPZIONALE: se l'owner non lo indica, assegna il prossimo libero.
      let number = (args?.number ?? '').toString().trim()
      if (!number) number = await nextTableNumber(ctx.restaurantId)
      // Il vincolo UNIQUE(restaurantId, number) include gli inattivi: cerchiamo QUALSIASI
      // tavolo con quel numero, non solo gli attivi. Se attivo → conflitto; se soft-deleted
      // → lo RIATTIVIAMO (un insert fallirebbe con unique violation, "bruciando" il numero).
      const [anyExisting] = await db.select().from(tables)
        .where(and(eq(tables.restaurantId, ctx.restaurantId), eq(tables.number, number))).limit(1)
      if (anyExisting?.active) return { ok: false, summary: `Esiste già un tavolo "${number}".` }
      const seats = Math.min(Math.max(parseInt(String(args?.seats ?? 4), 10) || 4, 1), 40)
      // SEMPRE una sala: la UI (Gestione Tavoli / Sala Live) mostra i tavoli
      // raggruppati per sala — un tavolo con roomId null sarebbe INVISIBILE.
      // Se l'utente indica la sala la risolviamo per nome; altrimenti la prima
      // attiva; se non esistono sale ne creiamo una di default.
      const allRooms = await db.select().from(rooms)
        .where(and(eq(rooms.restaurantId, ctx.restaurantId), eq(rooms.active, true)))
      let room = allRooms[0]
      if (args?.roomName) {
        const wanted = String(args.roomName).toLowerCase().trim()
        const found = allRooms.find(r => r.name.toLowerCase() === wanted) ?? allRooms.find(r => r.name.toLowerCase().includes(wanted))
        if (!found) return { ok: false, summary: `Sala "${args.roomName}" non trovata. Sale: ${allRooms.map(r => `"${r.name}"`).join(', ') || 'nessuna'}.` }
        room = found
      }
      if (!room) {
        const [created] = await db.insert(rooms).values({ restaurantId: ctx.restaurantId, name: 'Sala principale' }).returning()
        room = created
      }
      if (!room) return { ok: false, summary: 'Impossibile determinare la sala.' }
      // qrToken nuovo, ownership dal contesto. Se esisteva un tavolo soft-deleted con
      // questo numero, lo riattiviamo (reuse della riga) invece di inserire.
      const qrToken = nanoid(24)
      const [table] = anyExisting
        ? await db.update(tables).set({ active: true, seats, roomId: room.id, qrToken, status: 'free', openedAt: null })
            .where(eq(tables.id, anyExisting.id)).returning()
        : await db.insert(tables).values({ restaurantId: ctx.restaurantId, qrToken, number, seats, roomId: room.id }).returning()
      if (!table) return { ok: false, summary: 'Creazione non riuscita.' }
      emitTablesChanged(ctx.restaurantId, table.id)
      return { ok: true, data: { id: table.id, number: table.number, seats: table.seats, room: room.name }, summary: `Tavolo ${table.number} creato (${table.seats} posti) in "${room.name}". QR generato.` }
    },
  },
  {
    name: 'delete_table',
    scope: ['owner'],
    kind: 'mutation',
    description: 'ELIMINA un tavolo per numero (soft delete: lo storico ordini/conti resta). Invalida il QR.',
    parameters: {
      type: 'object',
      properties: { number: { type: 'string', description: 'Numero del tavolo da eliminare' } },
      required: ['number'],
    },
    label: (a) => `Elimina tavolo ${a?.number ?? '?'}`,
    execute: async (ctx, args) => {
      const t = await resolveTable(ctx.restaurantId, args?.number)
      if (!t) return { ok: false, summary: `Tavolo "${args?.number ?? ''}" non trovato.` }
      // non eliminare un tavolo con conto aperto (coerente con la logica cassa)
      const [openBill] = await db.select({ id: bills.id }).from(bills)
        .where(and(eq(bills.restaurantId, ctx.restaurantId), eq(bills.tableId, t.id), eq(bills.status, 'open'))).limit(1)
      if (openBill) return { ok: false, summary: `Il tavolo ${t.number} ha un conto aperto: incassa o annulla prima di eliminarlo.` }
      await db.update(tables).set({ active: false }).where(and(eq(tables.id, t.id), eq(tables.restaurantId, ctx.restaurantId)))
      emitTablesChanged(ctx.restaurantId, t.id)
      return { ok: true, data: { id: t.id, number: t.number }, summary: `Tavolo ${t.number} eliminato.` }
    },
  },
  {
    name: 'update_table',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Modifica un tavolo esistente: nuovo numero/nome e/o numero di posti.',
    parameters: {
      type: 'object',
      properties: {
        number: { type: 'string', description: 'Numero attuale del tavolo' },
        newNumber: { type: 'string', description: 'Nuovo numero/nome (opzionale)' },
        seats: { type: 'integer', minimum: 1, maximum: 40, description: 'Nuovi posti (opzionale)' },
      },
      required: ['number'],
    },
    label: (a) => {
      const parts: string[] = []
      if (a?.newNumber) parts.push(`numero → ${a.newNumber}`)
      if (a?.seats != null) parts.push(`${a.seats} posti`)
      return `Modifica tavolo ${a?.number ?? '?'}${parts.length ? ` (${parts.join(', ')})` : ''}`
    },
    execute: async (ctx, args) => {
      const t = await resolveTable(ctx.restaurantId, args?.number)
      if (!t) return { ok: false, summary: `Tavolo "${args?.number ?? ''}" non trovato.` }
      const set: Record<string, unknown> = {}
      const changes: string[] = []
      if (args?.newNumber != null && String(args.newNumber).trim()) {
        const nn = String(args.newNumber).trim()
        // UNIQUE(restaurantId, number) include gli inattivi → controlla QUALSIASI tavolo,
        // non solo gli attivi (altrimenti l'update crasherebbe con unique violation).
        const [clash] = await db.select({ id: tables.id, active: tables.active }).from(tables)
          .where(and(eq(tables.restaurantId, ctx.restaurantId), eq(tables.number, nn))).limit(1)
        if (clash && clash.id !== t.id) {
          return { ok: false, summary: clash.active ? `Esiste già un tavolo "${nn}".` : `Il numero "${nn}" è già usato da un tavolo eliminato: scegline un altro.` }
        }
        set['number'] = nn; changes.push(`numero ${t.number} → ${nn}`)
      }
      if (args?.seats != null) {
        const seats = Math.min(Math.max(parseInt(String(args.seats), 10) || t.seats, 1), 40)
        set['seats'] = seats; changes.push(`posti → ${seats}`)
      }
      if (!changes.length) return { ok: false, summary: 'Nessuna modifica indicata: specifica nuovo numero o posti.' }
      await db.update(tables).set(set).where(and(eq(tables.id, t.id), eq(tables.restaurantId, ctx.restaurantId)))
      emitTablesChanged(ctx.restaurantId, t.id)
      return { ok: true, data: { id: t.id }, summary: `Tavolo ${t.number} aggiornato: ${changes.join(', ')}.` }
    },
  },

  // ── OWNER · LETTURE OPERATIVE ──────────────────────────────────────────────
  {
    name: 'todays_reservations',
    scope: ['owner'],
    kind: 'read',
    description: 'Prenotazioni di oggi (o di una data specifica YYYY-MM-DD): ora, nome, persone, tavolo, stato.',
    parameters: { type: 'object', properties: { date: { type: 'string', description: 'Data YYYY-MM-DD (default oggi)' } } },
    label: (a) => `Prenotazioni ${a?.date ?? 'di oggi'}`,
    execute: async (ctx, args) => {
      const tz = await restaurantTimezone(ctx.restaurantId)
      const dateStr = (args?.date && /^\d{4}-\d{2}-\d{2}$/.test(String(args.date))) ? String(args.date) : dayKeyInTz(new Date(), tz)
      const dayStart = dayStartInTz(dateStr, tz)
      if (isNaN(dayStart.getTime())) return { ok: false, summary: 'Data non valida.' }
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
      const rows = await db.select().from(reservations)
        .where(and(eq(reservations.restaurantId, ctx.restaurantId), gte(reservations.startsAt, dayStart), lt(reservations.startsAt, dayEnd)))
        .orderBy(asc(reservations.startsAt))
      const allTables = await db.select({ id: tables.id, number: tables.number }).from(tables).where(eq(tables.restaurantId, ctx.restaurantId))
      const numByTable = new Map(allTables.map(t => [t.id, t.number]))
      const fmt = rows.map(r => {
        const hh = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(r.startsAt)
        return `${hh} ${r.customerName} x${r.partySize}${r.tableId ? ` (tav ${numByTable.get(r.tableId) ?? '?'})` : ''} [${r.status}]`
      })
      return { ok: true, data: rows.map(r => ({ id: r.id, at: r.startsAt, name: r.customerName, partySize: r.partySize, status: r.status, table: r.tableId ? numByTable.get(r.tableId) : null })), summary: rows.length ? `${rows.length} prenotazioni il ${dateStr}: ${fmt.join('; ')}` : `Nessuna prenotazione il ${dateStr}.` }
    },
  },
  {
    name: 'low_stock',
    scope: ['owner'],
    kind: 'read',
    description: 'Scorte basse in inventario: ingredienti con quantità sotto la soglia minima.',
    parameters: { type: 'object', properties: {} },
    label: () => 'Scorte basse',
    execute: async (ctx) => {
      const alerts = await db.select().from(inventoryItems).where(and(
        eq(inventoryItems.restaurantId, ctx.restaurantId),
        lte(inventoryItems.quantity, inventoryItems.minQuantity),
      ))
      const fmt = alerts.map(a => `${a.name}: ${a.quantity}${a.unit} (min ${a.minQuantity})`)
      return { ok: true, data: alerts.map(a => ({ name: a.name, quantity: a.quantity, unit: a.unit, min: a.minQuantity })), summary: alerts.length ? `${alerts.length} scorte basse: ${fmt.join('; ')}.` : 'Nessuna scorta sotto soglia.' }
    },
  },
  {
    name: 'open_bills',
    scope: ['owner'],
    kind: 'read',
    description: 'Conti APERTI adesso: tavolo, totale, da quanto tempo.',
    parameters: { type: 'object', properties: {} },
    label: () => 'Conti aperti',
    execute: async (ctx) => {
      const open = await db.select().from(bills)
        .where(and(eq(bills.restaurantId, ctx.restaurantId), eq(bills.status, 'open'))).orderBy(desc(bills.createdAt))
      const allTables = await db.select({ id: tables.id, number: tables.number }).from(tables).where(eq(tables.restaurantId, ctx.restaurantId))
      const numByTable = new Map(allTables.map(t => [t.id, t.number]))
      const fmt = open.map(b => `${b.tableId ? `tav ${numByTable.get(b.tableId) ?? '?'}` : 'asporto'}: €${b.total}`)
      return { ok: true, data: open.map(b => ({ id: b.id, table: b.tableId ? numByTable.get(b.tableId) : null, total: b.total })), summary: open.length ? `${open.length} conti aperti — ${fmt.join('; ')}.` : 'Nessun conto aperto.' }
    },
  },
  {
    name: 'staff_on_shift',
    scope: ['owner'],
    kind: 'read',
    description: 'Chi è in turno ADESSO (turni aperti, non ancora chiusi).',
    parameters: { type: 'object', properties: {} },
    label: () => 'In turno ora',
    execute: async (ctx) => {
      const rows = await db.select({ name: users.name, role: staffShifts.role, startsAt: staffShifts.startsAt })
        .from(staffShifts)
        .innerJoin(users, eq(staffShifts.userId, users.id))
        .where(and(eq(staffShifts.restaurantId, ctx.restaurantId), isNull(staffShifts.endsAt)))
        .orderBy(desc(staffShifts.startsAt))
      const tz = await restaurantTimezone(ctx.restaurantId)
      const fmt = rows.map(r => `${r.name}${r.role ? ` (${r.role})` : ''} dalle ${new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(r.startsAt)}`)
      return { ok: true, data: rows, summary: rows.length ? `In turno ora: ${fmt.join('; ')}.` : 'Nessuno in turno al momento.' }
    },
  },
  {
    name: 'revenue_for_date',
    scope: ['owner'],
    kind: 'read',
    description: 'Incasso di una DATA specifica (YYYY-MM-DD): totale, numero conti, ticket medio.',
    parameters: {
      type: 'object',
      properties: { date: { type: 'string', description: 'Data YYYY-MM-DD (es. 2026-07-01)' } },
      required: ['date'],
    },
    label: (a) => `Incasso del ${a?.date ?? '?'}`,
    execute: async (ctx, args) => {
      const dateStr = String(args?.date ?? '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { ok: false, summary: 'Data non valida: usa il formato YYYY-MM-DD.' }
      const tz = await restaurantTimezone(ctx.restaurantId)
      const dayStart = dayStartInTz(dateStr, tz)
      if (isNaN(dayStart.getTime())) return { ok: false, summary: 'Data non valida.' }
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
      const closed = await db.select().from(bills).where(and(
        eq(bills.restaurantId, ctx.restaurantId), eq(bills.status, 'closed'),
        gte(bills.closedAt!, dayStart), lt(bills.closedAt!, dayEnd),
      ))
      const revenue = round2(closed.reduce((s, b) => s + b.total, 0))
      const avg = closed.length ? round2(revenue / closed.length) : 0
      return { ok: true, data: { date: dateStr, revenue, billsCount: closed.length, avgTicket: avg }, summary: `Il ${dateStr}: incasso €${revenue}, ${closed.length} conti, ticket medio €${avg}.` }
    },
  },

  // ── OWNER · PRENOTAZIONI ───────────────────────────────────────────────────
  {
    name: 'create_reservation',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Crea una prenotazione: nome cliente, persone, data e ora (es. "2026-07-04 20:00"), telefono e tavolo opzionali.',
    parameters: {
      type: 'object',
      properties: {
        customerName: { type: 'string' },
        partySize: { type: 'integer', minimum: 1, maximum: 60 },
        when: { type: 'string', description: 'Data e ora "YYYY-MM-DD HH:mm" (24h, ora locale del ristorante)' },
        customerPhone: { type: 'string', description: 'Telefono (opzionale)' },
        tableNumber: { type: 'string', description: 'Tavolo (opzionale)' },
        notes: { type: 'string' },
      },
      required: ['customerName', 'partySize', 'when'],
    },
    label: (a) => `Prenota ${a?.customerName ?? '?'} x${a?.partySize ?? '?'} ${a?.when ?? ''}${a?.tableNumber ? ` (tav ${a.tableNumber})` : ''}`,
    execute: async (ctx, args) => {
      const name = (args?.customerName ?? '').toString().trim()
      const rawParty = parseInt(String(args?.partySize ?? 0), 10)
      const whenStr = (args?.when ?? '').toString().trim()
      // partySize DEVE essere fornito (prima veniva silenziosamente forzato a 1)
      if (!name || !whenStr || !Number.isFinite(rawParty) || rawParty < 1) return { ok: false, summary: 'Servono nome cliente, persone e data/ora.' }
      const partySize = Math.min(rawParty, 60)
      // "YYYY-MM-DD HH:mm" interpretato nel fuso del RISTORANTE (non del server):
      // costruiamo l'istante dal giorno-inizio-tz + ore/minuti.
      const m = whenStr.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})/)
      if (!m) return { ok: false, summary: 'Data/ora non valida: usa "YYYY-MM-DD HH:mm" (es. 2026-07-04 20:00).' }
      const tz = await restaurantTimezone(ctx.restaurantId)
      const dayStart = dayStartInTz(m[1]!, tz)
      if (isNaN(dayStart.getTime())) return { ok: false, summary: 'Data non valida.' }
      const startsAt = new Date(dayStart.getTime() + (parseInt(m[2]!, 10) * 60 + parseInt(m[3]!, 10)) * 60_000)
      if (startsAt.getTime() < Date.now() - 60_000) return { ok: false, summary: 'La data/ora è nel passato.' }
      const durationMin = 90
      let tableId: string | null = null
      if (args?.tableNumber) {
        const t = await resolveTable(ctx.restaurantId, String(args.tableNumber))
        if (!t) return { ok: false, summary: `Tavolo "${args.tableNumber}" non trovato.` }
        tableId = t.id
      }
      const values = {
        restaurantId: ctx.restaurantId, tableId, customerName: name.slice(0, 120),
        customerPhone: (args?.customerPhone ? String(args.customerPhone) : 'n/d').slice(0, 40),
        partySize, startsAt, durationMin, status: 'confirmed' as const,
        notes: args?.notes ? String(args.notes).slice(0, 500) : null,
      }
      // Con tavolo: anti-overbooking sotto advisory lock (stessa logica della route).
      if (tableId) {
        const res = await db.transaction(async (tx) => {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'resv:' + ctx.restaurantId + ':' + tableId}))`)
          const others = await tx.select().from(reservations).where(and(
            eq(reservations.restaurantId, ctx.restaurantId), eq(reservations.tableId, tableId),
            ne(reservations.status, 'cancelled'),
          ))
          const newStart = startsAt.getTime(), newEnd = newStart + durationMin * 60_000
          for (const r of others) {
            const exStart = new Date(r.startsAt).getTime(), exEnd = exStart + r.durationMin * 60_000
            if (newStart < exEnd && exStart < newEnd) return { clash: true as const }
          }
          const [row] = await tx.insert(reservations).values(values).returning()
          return { row: row! }
        })
        if ('clash' in res) return { ok: false, summary: 'Il tavolo è già prenotato in quella fascia oraria.' }
        io.to(`restaurant:${ctx.restaurantId}`).emit('reservation:changed', { id: res.row.id })
        const hh = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(startsAt)
        return { ok: true, data: { id: res.row.id }, summary: `Prenotazione: ${name} x${partySize} il ${m[1]} alle ${hh} (tav ${args.tableNumber}).` }
      }
      const [row] = await db.insert(reservations).values(values).returning()
      io.to(`restaurant:${ctx.restaurantId}`).emit('reservation:changed', { id: row!.id })
      const hh = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(startsAt)
      return { ok: true, data: { id: row!.id }, summary: `Prenotazione: ${name} x${partySize} il ${m[1]} alle ${hh} (senza tavolo assegnato).` }
    },
  },
  {
    name: 'cancel_reservation',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Annulla la prenotazione di un cliente (per nome; data opzionale, default oggi).',
    parameters: {
      type: 'object',
      properties: {
        customerName: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD (default oggi)' },
      },
      required: ['customerName'],
    },
    label: (a) => `Annulla prenotazione di ${a?.customerName ?? '?'}${a?.date ? ` (${a.date})` : ''}`,
    execute: async (ctx, args) => {
      const { resv, hits, dateStr } = await resolveReservation(ctx.restaurantId, args?.customerName, args?.date)
      if (!resv) {
        const list = hits.map(h => `${h.customerName} x${h.partySize}`).join('; ')
        return { ok: false, summary: hits.length ? `Più prenotazioni corrispondono il ${dateStr}: ${list}. Specifica meglio.` : `Nessuna prenotazione di "${args?.customerName}" il ${dateStr}.` }
      }
      await db.update(reservations).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(reservations.id, resv.id))
      io.to(`restaurant:${ctx.restaurantId}`).emit('reservation:changed', { id: resv.id })
      return { ok: true, data: { id: resv.id }, summary: `Prenotazione di ${resv.customerName} (x${resv.partySize}) annullata.` }
    },
  },
  {
    name: 'set_reservation_status',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Cambia lo stato di una prenotazione: confirmed (confermata), seated (accomodati), no_show (non presentati).',
    parameters: {
      type: 'object',
      properties: {
        customerName: { type: 'string' },
        status: { type: 'string', enum: ['confirmed', 'seated', 'no_show'] },
        date: { type: 'string', description: 'YYYY-MM-DD (default oggi)' },
      },
      required: ['customerName', 'status'],
    },
    label: (a) => `Prenotazione ${a?.customerName ?? '?'} → ${a?.status ?? '?'}`,
    execute: async (ctx, args) => {
      const status = ['confirmed', 'seated', 'no_show'].includes(args?.status) ? args.status : null
      if (!status) return { ok: false, summary: 'Stato non valido.' }
      const { resv, hits, dateStr } = await resolveReservation(ctx.restaurantId, args?.customerName, args?.date)
      if (!resv) {
        const list = hits.map(h => `${h.customerName} x${h.partySize}`).join('; ')
        return { ok: false, summary: hits.length ? `Più prenotazioni corrispondono il ${dateStr}: ${list}.` : `Nessuna prenotazione di "${args?.customerName}" il ${dateStr}.` }
      }
      await db.update(reservations).set({ status, updatedAt: new Date() }).where(eq(reservations.id, resv.id))
      io.to(`restaurant:${ctx.restaurantId}`).emit('reservation:changed', { id: resv.id })
      const it: Record<string, string> = { confirmed: 'confermata', seated: 'accomodati', no_show: 'non presentati' }
      return { ok: true, data: { id: resv.id, status }, summary: `Prenotazione di ${resv.customerName}: ${it[status] ?? status}.` }
    },
  },

  // ── OWNER · ORDINI ─────────────────────────────────────────────────────────
  {
    name: 'active_orders',
    scope: ['owner'],
    kind: 'read',
    description: 'Ordini ATTIVI adesso (in attesa/confermati/in preparazione/pronti), con tavolo e numero piatti.',
    parameters: { type: 'object', properties: {} },
    label: () => 'Ordini attivi',
    execute: async (ctx) => {
      const active = await db.select().from(orders).where(and(
        eq(orders.restaurantId, ctx.restaurantId),
        inArray(orders.status, ['pending', 'confirmed', 'preparing', 'ready']),
      )).orderBy(desc(orders.createdAt))
      const allTables = await db.select({ id: tables.id, number: tables.number }).from(tables).where(eq(tables.restaurantId, ctx.restaurantId))
      const numByTable = new Map(allTables.map(t => [t.id, t.number]))
      const items = await db.select({ orderId: orderItems.orderId }).from(orderItems)
        .where(inArray(orderItems.orderId, active.length ? active.map(o => o.id) : ['00000000-0000-0000-0000-000000000000']))
      const countByOrder = new Map<string, number>()
      for (const it of items) countByOrder.set(it.orderId, (countByOrder.get(it.orderId) ?? 0) + 1)
      const fmt = active.map(o => `${o.tableId ? `tav ${numByTable.get(o.tableId) ?? '?'}` : 'asporto'}: ${countByOrder.get(o.id) ?? 0} piatti [${ORDER_STATUS_IT[o.status] ?? o.status}]`)
      return { ok: true, data: active.map(o => ({ id: o.id, table: o.tableId ? numByTable.get(o.tableId) : null, status: o.status })), summary: active.length ? `${active.length} ordini attivi — ${fmt.join('; ')}.` : 'Nessun ordine attivo.' }
    },
  },
  {
    name: 'cancel_order',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Annulla l\'ordine attivo di un tavolo (l\'ultimo, se più di uno). Un ordine già pagato non si può annullare.',
    parameters: {
      type: 'object',
      properties: { tableNumber: { type: 'string', description: 'Numero del tavolo' } },
      required: ['tableNumber'],
    },
    label: (a) => `Annulla ordine del tavolo ${a?.tableNumber ?? '?'}`,
    execute: async (ctx, args) => {
      const t = await resolveTable(ctx.restaurantId, args?.tableNumber)
      if (!t) return { ok: false, summary: `Tavolo "${args?.tableNumber ?? ''}" non trovato.` }
      const [current] = await db.select().from(orders).where(and(
        eq(orders.restaurantId, ctx.restaurantId), eq(orders.tableId, t.id),
        inArray(orders.status, ['pending', 'confirmed', 'preparing', 'ready', 'served']),
      )).orderBy(desc(orders.createdAt)).limit(1)
      if (!current) return { ok: false, summary: `Nessun ordine attivo sul tavolo ${t.number}.` }
      // stessa transizione della route PATCH /orders/:id/cancel
      const [updated] = await db.update(orders).set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(orders.id, current.id), eq(orders.restaurantId, ctx.restaurantId))).returning()
      if (updated!.tableId) await recomputeOpenBill(ctx.restaurantId, updated!.tableId)
      io.to(`restaurant:${ctx.restaurantId}`).emit('order:updated', { orderId: current.id, status: 'cancelled' })
      if (updated!.tableId) io.to(`table:${updated!.tableId}`).emit('order:updated', { orderId: current.id, status: 'cancelled' })
      return { ok: true, data: { id: current.id }, summary: `Ordine del tavolo ${t.number} annullato (il conto è stato ricalcolato).` }
    },
  },

  // ── OWNER · CASSA ──────────────────────────────────────────────────────────
  {
    name: 'apply_bill_discount',
    scope: ['owner'],
    roles: ['owner', 'cassiere'],   // parità con PATCH /api/bills (sconto = vettore frode)
    kind: 'mutation',
    description: 'Applica uno SCONTO in euro al conto aperto di un tavolo (il totale viene ricalcolato).',
    parameters: {
      type: 'object',
      properties: {
        tableNumber: { type: 'string' },
        discount: { type: 'number', minimum: 0, description: 'Sconto in euro' },
        note: { type: 'string', description: 'Motivo (opzionale)' },
      },
      required: ['tableNumber', 'discount'],
    },
    label: (a) => `Sconto €${a?.discount ?? '?'} al tavolo ${a?.tableNumber ?? '?'}`,
    execute: async (ctx, args) => {
      const { table, bill } = await openBillForTable(ctx.restaurantId, args?.tableNumber)
      if (!table) return { ok: false, summary: `Tavolo "${args?.tableNumber ?? ''}" non trovato.` }
      if (!bill) return { ok: false, summary: `Il tavolo ${table.number} non ha un conto aperto.` }
      const raw = Number(args?.discount)
      if (!Number.isFinite(raw) || raw < 0) return { ok: false, summary: 'Sconto non valido.' }
      // Stessa transazione della PATCH /bills / close_bill: advisory lock + subtotale
      // RICALCOLATO dagli ordini reali sotto lock. Prima ci si fidava di bill.subtotal
      // (stale, senza lock) → un ordine arrivato in parallelo veniva cancellato dal total.
      const unit = await coverUnit(ctx.restaurantId)
      const lockKey = bill.tableId ? `${ctx.restaurantId}:${bill.tableId}` : bill.id
      const res = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`)
        const [locked] = await tx.select().from(bills).where(eq(bills.id, bill.id)).limit(1)
        if (!locked || locked.status !== 'open') return { conflict: true as const }
        const base = await billTotalsFromOrders(tx, { ...locked, discount: 0 }, unit)
        // vincoli PATCH /bills: cap 30% per non-owner, mai oltre il subtotale
        const cap = ctx.role === 'owner' ? base.subtotal : round2(base.subtotal * 0.30)
        const discount = Math.min(round2(raw), cap, base.subtotal)
        const t = await billTotalsFromOrders(tx, { ...locked, discount }, unit)
        await tx.update(bills).set({
          subtotal: t.subtotal, discount,
          discountNote: args?.note ? String(args.note).slice(0, 500) : locked.discountNote,
          total: t.total,
        }).where(eq(bills.id, bill.id))
        return { conflict: false as const, discount, total: t.total }
      })
      if (res.conflict) return { ok: false, summary: `Il tavolo ${table.number} non ha (più) un conto aperto.` }
      return { ok: true, data: { billId: bill.id, discount: res.discount, total: res.total }, summary: `Sconto €${res.discount} applicato al tavolo ${table.number}: nuovo totale €${res.total}.` }
    },
  },
  {
    name: 'close_bill',
    scope: ['owner'],
    roles: ['owner', 'cassiere'],   // incasso/chiusura conto: prerogativa cassa/owner
    kind: 'mutation',
    description: 'INCASSA e chiude il conto aperto di un tavolo: registra il pagamento del residuo (contanti/carta/digitale), libera il tavolo in pulizia.',
    parameters: {
      type: 'object',
      properties: {
        tableNumber: { type: 'string' },
        method: { type: 'string', enum: ['cash', 'card', 'digital'], description: 'cash=contanti, card=carta' },
      },
      required: ['tableNumber', 'method'],
    },
    label: (a) => `Incassa tavolo ${a?.tableNumber ?? '?'} (${a?.method === 'cash' ? 'contanti' : a?.method === 'card' ? 'carta' : a?.method ?? '?'})`,
    execute: async (ctx, args) => {
      const method = ['cash', 'card', 'digital'].includes(args?.method) ? args.method : null
      if (!method) return { ok: false, summary: 'Metodo di pagamento non valido (contanti/carta/digitale).' }
      const { table, bill } = await openBillForTable(ctx.restaurantId, args?.tableNumber)
      if (!table) return { ok: false, summary: `Tavolo "${args?.tableNumber ?? ''}" non trovato.` }
      if (!bill) return { ok: false, summary: `Il tavolo ${table.number} non ha un conto aperto.` }
      // Stessa transazione della POST /bills/:id/payments: lock sulla chiave di
      // ensureOpenBill (ristorante:tavolo), ricalcolo del totale dagli ordini reali
      // sotto il lock (non fidarsi di locked.total: un ordine appena inserito potrebbe
      // non esservi riflesso → residuo sottostimato → cascade che regala cibo), poi
      // pagamento del residuo, chiusura + cascade tavolo→cleaning e ordini→paid.
      const unit = await coverUnit(ctx.restaurantId)
      const lockKey = bill.tableId ? `${ctx.restaurantId}:${bill.tableId}` : bill.id
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`)
        const [locked] = await tx.select().from(bills).where(eq(bills.id, bill.id)).limit(1)
        if (!locked || locked.status !== 'open') return { conflict: true as const }
        const t = await billTotalsFromOrders(tx, locked, unit)
        await tx.update(bills).set({ subtotal: t.subtotal, discount: t.discount, total: t.total }).where(eq(bills.id, bill.id))
        const prev = await tx.select().from(billPayments).where(eq(billPayments.billId, bill.id))
        const paidSoFar = round2(prev.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0))
        const residuo = round2(Math.max(t.total - paidSoFar, 0))
        if (residuo <= 0) return { conflict: true as const }
        await tx.insert(billPayments).values({ billId: bill.id, amount: residuo, method, status: 'completed' })
        await tx.update(bills).set({ status: 'closed', closedAt: new Date() }).where(eq(bills.id, bill.id))
        if (locked.tableId) {
          await tx.update(tables).set({ status: 'cleaning', openedAt: null }).where(eq(tables.id, locked.tableId))
        }
        // Marca 'paid' ESATTAMENTE gli ordini sommati nel totale saldato (t.orderIds),
        // non una ri-selezione: un ordine committato dopo il calcolo non è coperto dal
        // residuo → non va marcato paid (resta billable su un nuovo conto).
        const paidOrderIds: string[] = []
        const paidAt = new Date()
        for (const oid of t.orderIds) {
          await tx.update(orders).set({ status: 'paid', paidAt }).where(eq(orders.id, oid))
          paidOrderIds.push(oid)
        }
        return { conflict: false as const, residuo, tableId: locked.tableId, paidOrderIds }
      })
      if (result.conflict) return { ok: false, summary: 'Il conto non è (più) aperto o è già saldato.' }
      // emit post-commit, come la route
      if (result.tableId) io.to(`restaurant:${ctx.restaurantId}`).emit('table:updated', { tableId: result.tableId, status: 'cleaning' })
      for (const orderId of result.paidOrderIds) {
        io.to(`restaurant:${ctx.restaurantId}`).emit('order:updated', { orderId, status: 'paid' })
        if (result.tableId) io.to(`table:${result.tableId}`).emit('order:updated', { orderId, status: 'paid' })
      }
      const mIt: Record<string, string> = { cash: 'contanti', card: 'carta', digital: 'digitale' }
      return { ok: true, data: { billId: bill.id, amount: result.residuo }, summary: `Incassati €${result.residuo} (${mIt[method]}) dal tavolo ${table.number}. Conto chiuso, tavolo in pulizia.` }
    },
  },

  // ── OWNER · INVENTARIO ─────────────────────────────────────────────────────
  {
    name: 'create_inventory_item',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Crea un ingrediente in inventario: nome, unità (kg/l/pz…), quantità iniziale e soglia minima.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        unit: { type: 'string', description: 'kg, l, pz…' },
        quantity: { type: 'number', minimum: 0 },
        minQuantity: { type: 'number', minimum: 0, description: 'Soglia sotto cui scatta l\'avviso scorte' },
      },
      required: ['name', 'unit'],
    },
    label: (a) => `Crea ingrediente "${a?.name ?? '?'}" (${a?.quantity ?? 0} ${a?.unit ?? ''})`,
    execute: async (ctx, args) => {
      const name = (args?.name ?? '').toString().trim()
      const unit = (args?.unit ?? '').toString().trim()
      if (!name || !unit) return { ok: false, summary: 'Servono nome e unità di misura.' }
      const existing = await resolveInventory(ctx.restaurantId, name)
      if (existing && existing.name.toLowerCase() === name.toLowerCase()) return { ok: false, summary: `"${existing.name}" esiste già in inventario.` }
      const [item] = await db.insert(inventoryItems).values({
        restaurantId: ctx.restaurantId, name: name.slice(0, 120), unit: unit.slice(0, 20),
        quantity: Math.max(Number(args?.quantity) || 0, 0), minQuantity: Math.max(Number(args?.minQuantity) || 0, 0),
      }).returning()
      return { ok: true, data: { id: item!.id, name: item!.name }, summary: `Ingrediente "${item!.name}" creato: ${item!.quantity}${item!.unit} (soglia ${item!.minQuantity}).` }
    },
  },
  {
    name: 'adjust_stock',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Registra un movimento d\'inventario per un ingrediente: load (carico/arrivo merce), unload (scarico), waste (spreco).',
    parameters: {
      type: 'object',
      properties: {
        itemName: { type: 'string' },
        type: { type: 'string', enum: ['load', 'unload', 'waste'], description: 'load=arrivo merce, unload=scarico, waste=spreco' },
        quantity: { type: 'number', minimum: 0.001 },
        note: { type: 'string' },
      },
      required: ['itemName', 'type', 'quantity'],
    },
    label: (a) => `${a?.type === 'load' ? 'Carico' : a?.type === 'waste' ? 'Spreco' : 'Scarico'} ${a?.quantity ?? '?'} di "${a?.itemName ?? '?'}"`,
    execute: async (ctx, args) => {
      const type = ['load', 'unload', 'waste'].includes(args?.type) ? args.type : null
      const quantity = Number(args?.quantity)
      // stesso cap della route movements (evita quantità confabulate enormi)
      if (!type || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100_000) return { ok: false, summary: 'Tipo o quantità non validi.' }
      const item = await resolveInventory(ctx.restaurantId, args?.itemName)
      if (!item) return { ok: false, summary: `Ingrediente "${args?.itemName ?? ''}" non trovato in inventario (o nome ambiguo).` }
      const delta = type === 'load' ? Math.abs(quantity) : -Math.abs(quantity)
      // stessa transazione della route movements: ledger + stock atomici, mai sotto zero
      const { updated } = await db.transaction(async (tx) => {
        await tx.insert(inventoryMovements).values({ itemId: item.id, type, quantity, note: args?.note ? String(args.note).slice(0, 500) : undefined })
        const [updated] = await tx.update(inventoryItems).set({
          quantity: sql`GREATEST(0, ${inventoryItems.quantity} + ${delta})`,
          updatedAt: new Date(),
        }).where(and(eq(inventoryItems.id, item.id), eq(inventoryItems.restaurantId, ctx.restaurantId))).returning()
        return { updated: updated! }
      })
      // come la route: se sotto la soglia, avvisa la dashboard (badge scorte + toast)
      const minQ = (item as any).minQuantity
      if (minQ != null && Number(updated.quantity) <= Number(minQ)) {
        io.to(`restaurant:${ctx.restaurantId}`).emit('inventory:alert', { itemId: item.id, name: item.name, quantity: updated.quantity })
      }
      const verb = type === 'load' ? 'caricati' : type === 'waste' ? 'segnati come spreco' : 'scaricati'
      return { ok: true, data: { id: item.id, quantity: updated.quantity }, summary: `${quantity}${item.unit} di "${item.name}" ${verb}: ora ${updated.quantity}${item.unit}.` }
    },
  },

  // ── OWNER · TURNI ──────────────────────────────────────────────────────────
  {
    name: 'clock_in_staff',
    scope: ['owner'],
    roles: ['owner', 'cassiere'],   // turno di ALTRI membri: parità con requireManager
    kind: 'mutation',
    description: 'Fa iniziare il turno a un membro dello staff (per nome), adesso.',
    parameters: {
      type: 'object',
      properties: { staffName: { type: 'string' }, role: { type: 'string', description: 'Mansione nel turno (opzionale, es. cameriere)' } },
      required: ['staffName'],
    },
    label: (a) => `Inizio turno: ${a?.staffName ?? '?'}${a?.role ? ` (${a.role})` : ''}`,
    execute: async (ctx, args) => {
      const { user, all } = await resolveStaff(ctx.restaurantId, args?.staffName)
      if (!user) return { ok: false, summary: all.length ? `Nome ambiguo o non trovato. Staff: ${all.map(u => u.name).join(', ')}.` : 'Nessun membro dello staff trovato.' }
      const [open] = await db.select({ id: staffShifts.id }).from(staffShifts)
        .where(and(eq(staffShifts.restaurantId, ctx.restaurantId), eq(staffShifts.userId, user.id), isNull(staffShifts.endsAt))).limit(1)
      if (open) return { ok: false, summary: `${user.name} ha già un turno aperto.` }
      await db.insert(staffShifts).values({ restaurantId: ctx.restaurantId, userId: user.id, startsAt: new Date(), role: args?.role ? String(args.role).slice(0, 40) : user.role })
      return { ok: true, data: { userId: user.id }, summary: `Turno iniziato per ${user.name}.` }
    },
  },
  {
    name: 'clock_out_staff',
    scope: ['owner'],
    roles: ['owner', 'cassiere'],   // turno di ALTRI membri: parità con requireManager
    kind: 'mutation',
    description: 'Chiude il turno aperto di un membro dello staff (per nome), adesso.',
    parameters: { type: 'object', properties: { staffName: { type: 'string' } }, required: ['staffName'] },
    label: (a) => `Fine turno: ${a?.staffName ?? '?'}`,
    execute: async (ctx, args) => {
      const { user, all } = await resolveStaff(ctx.restaurantId, args?.staffName)
      if (!user) return { ok: false, summary: all.length ? `Nome ambiguo o non trovato. Staff: ${all.map(u => u.name).join(', ')}.` : 'Nessun membro dello staff trovato.' }
      const [open] = await db.select().from(staffShifts)
        .where(and(eq(staffShifts.restaurantId, ctx.restaurantId), eq(staffShifts.userId, user.id), isNull(staffShifts.endsAt)))
        .orderBy(desc(staffShifts.startsAt)).limit(1)
      if (!open) return { ok: false, summary: `${user.name} non ha un turno aperto.` }
      await db.update(staffShifts).set({ endsAt: new Date() }).where(eq(staffShifts.id, open.id))
      return { ok: true, data: { userId: user.id }, summary: `Turno chiuso per ${user.name}.` }
    },
  },

  // ── OWNER · STAFF ──────────────────────────────────────────────────────────
  {
    name: 'list_staff',
    scope: ['owner'],
    kind: 'read',
    description: 'Elenco dei membri dello staff con ruolo e stato (attivo/disattivato).',
    parameters: { type: 'object', properties: {} },
    label: () => 'Elenco staff',
    execute: async (ctx) => {
      const staff = await db.select({ id: users.id, name: users.name, role: users.role, active: users.active })
        .from(users).where(eq(users.restaurantId, ctx.restaurantId)).orderBy(asc(users.name))
      const fmt = staff.map(s => `${s.name} (${s.role}${s.active ? '' : ', disattivato'})`)
      return { ok: true, data: staff, summary: staff.length ? `${staff.length} membri: ${fmt.join('; ')}.` : 'Nessun membro.' }
    },
  },
  {
    name: 'create_staff',
    scope: ['owner'],
    roles: ['owner'],   // parità con POST /api/staff (requireRole('owner'))
    kind: 'mutation',
    description: 'Aggiunge un membro dello staff: nome, ruolo (cameriere/dipendente/chef/cassiere), PIN a 4 cifre per il tablet (opzionale).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        role: { type: 'string', enum: ['cameriere', 'dipendente', 'chef', 'cassiere'] },
        pin: { type: 'string', description: '4 cifre (opzionale)' },
        phone: { type: 'string' },
      },
      required: ['name', 'role'],
    },
    label: (a) => `Aggiungi ${a?.name ?? '?'} come ${a?.role ?? '?'}`,
    execute: async (ctx, args) => {
      const name = (args?.name ?? '').toString().trim()
      // "cameriere"/"sala" sono il modo naturale di dirlo: il DB usa 'dipendente'
      // (stessa mappa ROLE_UI2DB della dashboard). Normalizziamo qui.
      const ROLE_SYNONYMS: Record<string, string> = { cameriere: 'dipendente', sala: 'dipendente', cuoco: 'chef' }
      const rawRole = (args?.role ?? '').toString().toLowerCase().trim()
      const normalized = ROLE_SYNONYMS[rawRole] ?? rawRole
      const role = ['dipendente', 'chef', 'cassiere'].includes(normalized) ? normalized : null
      if (!name || name.length < 2 || !role) return { ok: false, summary: 'Servono nome (min 2 caratteri) e ruolo valido.' }
      if (args?.pin && !/^\d{4}$/.test(String(args.pin))) return { ok: false, summary: 'Il PIN deve essere di 4 cifre.' }
      // anti-duplicato: senza questo ogni riproposta creava un membro fantasma omonimo
      const existingStaff = await db.select({ name: users.name }).from(users)
        .where(and(eq(users.restaurantId, ctx.restaurantId), eq(users.active, true)))
      if (existingStaff.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        return { ok: false, summary: `Esiste già un membro "${name}". Per un omonimo aggiungi un dettaglio al nome.` }
      }
      // email tecnica auto-generata (la tabella la richiede unica; il login del
      // dipendente avviene via PIN sul tablet)
      const email = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')}+${nanoid(6).toLowerCase()}@tako.local`
      const pinHash = args?.pin ? await bcrypt.hash(String(args.pin), 10) : undefined
      const [user] = await db.insert(users).values({
        restaurantId: ctx.restaurantId, name: name.slice(0, 120), email, role,
        pin: pinHash, phone: args?.phone ? String(args.phone).slice(0, 40) : undefined,
      }).returning()
      return { ok: true, data: { id: user!.id, name: user!.name, role: user!.role }, summary: `${user!.name} aggiunto come ${role}${args?.pin ? ' (PIN impostato per il tablet)' : ''}.` }
    },
  },
  {
    name: 'set_staff_active',
    scope: ['owner'],
    roles: ['owner'],   // parità con PATCH/DELETE /api/staff (requireRole('owner'))
    kind: 'mutation',
    description: 'Disattiva (o riattiva) un membro dello staff. Disattivare revoca subito i suoi accessi.',
    parameters: {
      type: 'object',
      properties: { staffName: { type: 'string' }, active: { type: 'boolean', description: 'false=disattiva, true=riattiva' } },
      required: ['staffName', 'active'],
    },
    label: (a) => `${flagTrue(a?.active) ? 'Riattiva' : 'Disattiva'} ${a?.staffName ?? '?'}`,
    execute: async (ctx, args) => {
      // COERENZA label↔execute: l'LLM può mandare true/"true"/1. Con `=== true` la label
      // diceva "Riattiva" ma l'execute DISATTIVAVA (+ revoca sessioni). Stessa coercizione.
      const active = flagTrue(args?.active)
      const { user, all } = await resolveStaff(ctx.restaurantId, args?.staffName, true)
      if (!user) return { ok: false, summary: all.length ? `Nome ambiguo o non trovato. Staff: ${all.map(u => u.name).join(', ')}.` : 'Nessun membro trovato.' }
      if (user.role === 'owner') return { ok: false, summary: 'Non puoi disattivare l\'owner.' }
      await db.update(users).set({ active }).where(and(eq(users.id, user.id), eq(users.restaurantId, ctx.restaurantId)))
      // revoca immediata come staff.ts: le sessioni residue non autenticano più
      if (!active) await db.delete(sessions).where(eq(sessions.userId, user.id))
      return { ok: true, data: { id: user.id, active }, summary: `${user.name} ${active ? 'riattivato' : 'disattivato (accessi revocati)'}.` }
    },
  },

  // ── OWNER · SALE / STATO TAVOLO / QR ───────────────────────────────────────
  {
    name: 'create_room',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Crea una nuova sala (es. "Terrazza").',
    parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    label: (a) => `Crea sala "${a?.name ?? '?'}"`,
    execute: async (ctx, args) => {
      const name = (args?.name ?? '').toString().trim()
      if (!name) return { ok: false, summary: 'Nome sala mancante.' }
      const existing = await db.select().from(rooms).where(and(eq(rooms.restaurantId, ctx.restaurantId), eq(rooms.active, true)))
      if (existing.some(r => r.name.toLowerCase() === name.toLowerCase())) return { ok: false, summary: `La sala "${name}" esiste già.` }
      const [room] = await db.insert(rooms).values({ restaurantId: ctx.restaurantId, name: name.slice(0, 60) }).returning()
      emitTablesChanged(ctx.restaurantId)
      return { ok: true, data: { id: room!.id, name: room!.name }, summary: `Sala "${room!.name}" creata.` }
    },
  },
  {
    name: 'set_table_status',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Cambia lo stato di un tavolo: free (libero), occupied (occupato), cleaning (in pulizia). Un tavolo con conto aperto non si può liberare.',
    parameters: {
      type: 'object',
      properties: {
        tableNumber: { type: 'string' },
        status: { type: 'string', enum: ['free', 'occupied', 'cleaning'] },
      },
      required: ['tableNumber', 'status'],
    },
    label: (a) => `Tavolo ${a?.tableNumber ?? '?'} → ${a?.status === 'free' ? 'libero' : a?.status === 'occupied' ? 'occupato' : 'in pulizia'}`,
    execute: async (ctx, args) => {
      const status = ['free', 'occupied', 'cleaning'].includes(args?.status) ? args.status : null
      if (!status) return { ok: false, summary: 'Stato non valido.' }
      const t = await resolveTable(ctx.restaurantId, args?.tableNumber)
      if (!t) return { ok: false, summary: `Tavolo "${args?.tableNumber ?? ''}" non trovato.` }
      // M7 come la route: non liberare un tavolo con conto/ordini fatturabili
      if (status === 'free' || status === 'cleaning') {
        const [openBill] = await db.select({ id: bills.id }).from(bills)
          .where(and(eq(bills.restaurantId, ctx.restaurantId), eq(bills.tableId, t.id), eq(bills.status, 'open'))).limit(1)
        let blocked = !!openBill
        if (!blocked) {
          const [ord] = await db.select({ id: orders.id }).from(orders)
            .where(and(eq(orders.restaurantId, ctx.restaurantId), eq(orders.tableId, t.id), inArray(orders.status, [...BILLABLE_STATUSES]))).limit(1)
          blocked = !!ord
        }
        if (blocked) return { ok: false, summary: `Il tavolo ${t.number} ha un conto aperto: incassa o annulla prima di liberarlo.` }
      }
      await db.update(tables).set({
        status,
        openedAt: status === 'occupied' ? new Date() : status === 'free' ? null : undefined,
      }).where(and(eq(tables.id, t.id), eq(tables.restaurantId, ctx.restaurantId)))
      io.to(`restaurant:${ctx.restaurantId}`).emit('table:updated', { tableId: t.id, status })
      const it: Record<string, string> = { free: 'libero', occupied: 'occupato', cleaning: 'in pulizia' }
      return { ok: true, data: { id: t.id, status }, summary: `Tavolo ${t.number} ora è ${it[status]}.` }
    },
  },
  {
    name: 'refresh_table_qr',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Rigenera il QR di un tavolo (il QR stampato precedente smette di funzionare).',
    parameters: { type: 'object', properties: { tableNumber: { type: 'string' } }, required: ['tableNumber'] },
    label: (a) => `Rigenera QR del tavolo ${a?.tableNumber ?? '?'}`,
    execute: async (ctx, args) => {
      const t = await resolveTable(ctx.restaurantId, args?.tableNumber)
      if (!t) return { ok: false, summary: `Tavolo "${args?.tableNumber ?? ''}" non trovato.` }
      const newToken = nanoid(24)
      await db.update(tables).set({ qrToken: newToken }).where(and(eq(tables.id, t.id), eq(tables.restaurantId, ctx.restaurantId)))
      return { ok: true, data: { id: t.id }, summary: `QR del tavolo ${t.number} rigenerato: ristampa e sostituisci quello sul tavolo.` }
    },
  },

  // ── OWNER · ANALISI & IMPOSTAZIONI ─────────────────────────────────────────
  {
    name: 'menu_performance',
    scope: ['owner'],
    kind: 'read',
    description: 'Rendimento del menu negli ultimi N giorni: piatti più/meno venduti con margine (prezzo vs food cost).',
    parameters: { type: 'object', properties: { days: { type: 'integer', minimum: 7, maximum: 365, description: 'Giorni (default 30)' } } },
    label: (a) => `Analisi menu ${a?.days ?? 30}gg`,
    execute: async (ctx, args) => {
      const days = Math.min(Math.max(parseInt(String(args?.days ?? 30), 10) || 30, 7), 365)
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      // vendite per piatto (ordini non annullati del periodo)
      const sold = await db.select({ menuItemId: orderItems.menuItemId, qty: sql<number>`sum(${orderItems.quantity})::int` })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(and(eq(orders.restaurantId, ctx.restaurantId), gte(orders.createdAt, since), ne(orders.status, 'cancelled')))
        .groupBy(orderItems.menuItemId)
      const items = await db.select().from(menuItems).where(eq(menuItems.restaurantId, ctx.restaurantId))
      const byId = new Map(items.map(i => [i.id, i]))
      const rows = sold.filter(s => s.menuItemId && byId.has(s.menuItemId)).map(s => {
        const i = byId.get(s.menuItemId!)!
        const cost = Number(i.costPrice ?? 0)
        const marginPct = i.price > 0 ? Math.round((1 - cost / i.price) * 100) : null
        return { name: i.name, qty: s.qty, price: i.price, marginPct }
      }).sort((a, b) => b.qty - a.qty)
      if (!rows.length) return { ok: true, data: [], summary: `Nessuna vendita negli ultimi ${days} giorni.` }
      const top = rows.slice(0, 5).map(r => `${r.name} x${r.qty}${r.marginPct != null ? ` (margine ${r.marginPct}%)` : ''}`)
      const flop = rows.slice(-3).reverse().map(r => `${r.name} x${r.qty}`)
      return { ok: true, data: rows, summary: `Ultimi ${days}gg — Più venduti: ${top.join('; ')}. Meno venduti: ${flop.join('; ')}.` }
    },
  },
  {
    name: 'set_food_cost',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Imposta il food cost (costo ingredienti in euro) di un piatto, per calcolarne il margine.',
    parameters: {
      type: 'object',
      properties: { itemName: { type: 'string' }, cost: { type: 'number', minimum: 0 } },
      required: ['itemName', 'cost'],
    },
    label: (a) => `Food cost di "${a?.itemName ?? '?'}" → €${a?.cost ?? '?'}`,
    execute: async (ctx, args) => {
      const cost = Number(args?.cost)
      if (!Number.isFinite(cost) || cost < 0) return { ok: false, summary: 'Costo non valido.' }
      const match = await resolveItem(ctx.restaurantId, args?.itemName, false)
      if (!match) return { ok: false, summary: `Piatto "${args?.itemName ?? ''}" non trovato (o ambiguo).` }
      await db.update(menuItems).set({ costPrice: cost, updatedAt: new Date() })
        .where(and(eq(menuItems.id, match.id), eq(menuItems.restaurantId, ctx.restaurantId)))
      const marginPct = match.price > 0 ? Math.round((1 - cost / match.price) * 100) : null
      return { ok: true, data: { id: match.id, cost }, summary: `Food cost di "${match.name}": €${cost}${marginPct != null ? ` → margine ${marginPct}%` : ''}.` }
    },
  },
  {
    name: 'set_cover_charge',
    scope: ['owner'],
    roles: ['owner'],   // impostazione ristorante: parità con PATCH /api/restaurants/me
    kind: 'mutation',
    description: 'Imposta il coperto per persona in euro (0 = disattivato).',
    parameters: { type: 'object', properties: { amount: { type: 'number', minimum: 0, maximum: 20 } }, required: ['amount'] },
    label: (a) => `Coperto → €${a?.amount ?? '?'}`,
    execute: async (ctx, args) => {
      const amount = Number(args?.amount)
      if (!Number.isFinite(amount) || amount < 0 || amount > 20) return { ok: false, summary: 'Importo non valido (0-20€).' }
      // merge nei settings come PATCH /restaurants/me (mai replace del jsonb intero)
      const [current] = await db.select({ settings: restaurants.settings }).from(restaurants).where(eq(restaurants.id, ctx.restaurantId)).limit(1)
      const settings = { ...(current?.settings ?? {}), coverCharge: round2(amount), coverChargeEnabled: amount > 0 }
      await db.update(restaurants).set({ settings, updatedAt: new Date() }).where(eq(restaurants.id, ctx.restaurantId))
      return { ok: true, data: { coverCharge: amount }, summary: amount > 0 ? `Coperto impostato a €${round2(amount)} a persona.` : 'Coperto disattivato.' }
    },
  },
  {
    name: 'add_dish_variant',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Aggiunge una variante a un piatto (es. "Piccante" +1€). priceModifier può essere 0 o negativo.',
    parameters: {
      type: 'object',
      properties: {
        itemName: { type: 'string' },
        variantName: { type: 'string' },
        priceModifier: { type: 'number', description: 'Differenza di prezzo in euro (default 0)' },
      },
      required: ['itemName', 'variantName'],
    },
    label: (a) => `Variante "${a?.variantName ?? '?'}" a "${a?.itemName ?? '?'}"${a?.priceModifier ? ` (${a.priceModifier > 0 ? '+' : ''}€${a.priceModifier})` : ''}`,
    execute: async (ctx, args) => {
      const variantName = (args?.variantName ?? '').toString().trim()
      if (!variantName) return { ok: false, summary: 'Nome variante mancante.' }
      const match = await resolveItem(ctx.restaurantId, args?.itemName, false)
      if (!match) return { ok: false, summary: `Piatto "${args?.itemName ?? ''}" non trovato (o ambiguo).` }
      const mod = Number(args?.priceModifier) || 0
      const [v] = await db.insert(itemVariants).values({ itemId: match.id, name: variantName.slice(0, 80), priceModifier: round2(mod) }).returning()
      emitMenuChanged(ctx.restaurantId)
      return { ok: true, data: { id: v!.id }, summary: `Variante "${variantName}" aggiunta a "${match.name}"${mod ? ` (${mod > 0 ? '+' : ''}€${round2(mod)})` : ''}.` }
    },
  },
]

const BY_NAME = new Map(ACTIONS.map(a => [a.name, a]))

export function getAction(name: string): ActionDef | undefined { return BY_NAME.get(name) }

export function actionsForScope(scope: ActionScope, allow?: string[]): ActionDef[] {
  return ACTIONS.filter(a => a.scope.includes(scope) && !a.hidden && (!allow || allow.includes(a.name)))
}

// Tool schema in formato OpenAI/Groq function-calling per lo scope indicato.
export function toolSchemas(scope: ActionScope, allow?: string[]): any[] {
  return actionsForScope(scope, allow).map(a => ({
    type: 'function',
    function: { name: a.name, description: a.description, parameters: a.parameters },
  }))
}

// ─────────────────── Sottoinsieme di tool per messaggio (latenza + rate limit) ───────────────────
// Inviare TUTTI i ~40 tool-schema ad ogni turno costa ~5k token/richiesta: sul tier
// Groq free il 70b (100k token/giorno) muore in ~20 messaggi, e l'8b con 40 tool
// sbaglia il function-call ("Failed to call a function"). Selezioniamo solo i tool
// pertinenti al messaggio (per keyword) + un piccolo CORE di letture sempre presenti:
// meno token → il 70b dura molto di più E l'8b (poche funzioni) produce tool-call validi.
const TOOL_CATEGORIES: Record<string, string[]> = {
  menu: ['search_menu', 'set_item_availability', 'create_menu_item', 'create_menu_section', 'update_menu_item', 'delete_menu_item', 'delete_menu_section', 'rename_menu_section', 'generate_dish_description', 'menu_performance', 'set_food_cost', 'add_dish_variant'],
  tables: ['table_status', 'create_table', 'delete_table', 'update_table', 'create_room', 'set_table_status', 'refresh_table_qr', 'set_cover_charge'],
  bills: ['open_bills', 'apply_bill_discount', 'close_bill', 'set_cover_charge'],
  orders: ['order_status', 'active_orders', 'cancel_order', 'add_to_cart', 'call_waiter'],
  reservations: ['todays_reservations', 'create_reservation', 'cancel_reservation', 'set_reservation_status'],
  inventory: ['low_stock', 'create_inventory_item', 'adjust_stock'],
  staff: ['staff_on_shift', 'clock_in_staff', 'clock_out_staff', 'list_staff', 'create_staff', 'set_staff_active'],
  stats: ['get_today_revenue', 'get_stats', 'revenue_for_date', 'menu_performance'],
}
const CORE_TOOLS = ['get_today_revenue', 'get_stats', 'table_status']
const CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/menu|piatt|carbonar|pizz|prim[oi]|second[oi]|dolc|antipast|bevand|esaurit|disponibil|sezion|variant|food ?cost|prezz|cost[oa]\b|quanto viene|c'è (?:la|il|l')/, 'menu'],
  [/tavol|sala|sale|pianta|\bqr\b|copert/, 'tables'],
  [/cont[oi]|cassa|scontrin|sconto|chiud|incass|paga|pagat|saldo/, 'bills'],
  [/ordin|comand|cameriere/, 'orders'],
  [/prenotaz|prenot/, 'reservations'],
  [/scort|inventar|magazzin|ingredient|carico|scarico|spreco|stock/, 'inventory'],
  [/staff|turn|dipendent|personale/, 'staff'],
  [/incass|statistic|rendiment|vend\w*|fatturat|andament|quant[oi]|meglio|peggio|guadagn/, 'stats'],
]

// Ritorna i nomi dei tool pertinenti, o null se il messaggio non matcha nessuna
// categoria (→ chiamante usa TUTTI i tool, caso raro e correttezza-first).
function pickToolNames(message: string): Set<string> | null {
  const m = (message || '').toLowerCase()
  // SOLO i tool delle categorie che matchano: aggiungere sempre il CORE (es.
  // table_status) confondeva i modelli piccoli ("quanto ho fatto oggi?" → stato
  // tavoli invece dell'incasso). Le categorie contengono già le letture giuste.
  const names = new Set<string>()
  for (const [re, cat] of CATEGORY_KEYWORDS) {
    if (re.test(m)) for (const n of TOOL_CATEGORIES[cat]!) names.add(n)
  }
  return names.size ? names : null
}

// Il messaggio matcha una categoria di tool? (segnale forte che SERVE chiamare un
// tool: usato per tool_choice 'required' alla prima iterazione — i modelli piccoli
// altrimenti "rispondono a voce" inventando i dati invece di leggere dal DB).
export function hasToolHint(message: string): boolean {
  return pickToolNames(message) !== null
}

// toolSchemas ristretto ai tool pertinenti al messaggio (fallback: tutti).
export function toolSchemasFor(scope: ActionScope, message: string, allow?: string[]): any[] {
  const defs = actionsForScope(scope, allow)
  const names = pickToolNames(message)
  const sel = names ? defs.filter(d => names.has(d.name)) : defs
  const use = sel.length ? sel : defs
  return use.map(a => ({
    type: 'function',
    function: { name: a.name, description: a.description, parameters: a.parameters },
  }))
}

// Riconosce il 400 "tool_use_failed" di Groq (llama emette un function-call malformato).
export function isGroqToolUseFailure(e: any): boolean {
  // All'handshake Groq risponde 400; ma se il guasto emerge MID-STREAM l'SDK solleva
  // un APIError con status undefined → non vincolare lo status, basta il pattern.
  if (e?.status !== undefined && e?.status !== 400) return false
  return /tool(_| )use|tool call|function call|failed to call a function|validation failed|did not match schema/i.test(JSON.stringify(e?.error ?? e?.message ?? ''))
}

// Esegue un'azione con guardie di scope/kind. `allowMutation` deve essere true SOLO
// dopo conferma umana esplicita (endpoint /execute dell'owner).
export async function executeAction(
  name: string, args: any, ctx: ActionContext, scope: ActionScope, opts?: { allowMutation?: boolean },
): Promise<ActionResult> {
  const def = BY_NAME.get(name)
  if (!def) return { ok: false, summary: `Azione sconosciuta: ${name}` }
  if (!def.scope.includes(scope)) return { ok: false, summary: 'Azione non consentita per questo ruolo.' }
  // Autorizzazione per-RUOLO: il copilot owner è esposto a qualsiasi staff autenticato
  // (requireAuth), ma le azioni sensibili (staff, sconti, incasso, impostazioni, turni
  // altrui) devono rispettare gli stessi ruoli delle route REST. Senza questo gate un
  // dipendente poteva chiamare /ai/owner/execute e creare account o azzerare conti.
  if (def.roles && !def.roles.includes(ctx.role ?? '')) {
    return { ok: false, summary: 'Questa azione richiede un ruolo autorizzato (owner/cassa). Non puoi eseguirla.' }
  }
  if (def.kind === 'mutation' && !opts?.allowMutation) {
    return { ok: false, summary: 'Questa azione modifica dati e richiede conferma esplicita.' }
  }
  return def.execute(ctx, args ?? {})
}

// ─────────────────────────── Loop Groq con tool-calling ───────────────────────────
// Ritorna: message finale, azioni già eseguite/da applicare lato client, e le mutation
// PROPOSTE (non eseguite) in attesa di conferma umana.
export interface AssistantTurn {
  message: string
  actions: any[]                                   // clientAction già prodotte (add_to_cart, waiter_called…)
  pending: { name: string; args: any; label: string }[]  // mutation proposte, da confermare
}

let _openaiClient: any = null
async function groqClient() {
  const key = process.env['GROQ_API_KEY']
  if (!key) throw Object.assign(new Error('GROQ_API_KEY not set'), { code: 'AI_UNAVAILABLE' })
  if (_openaiClient) return _openaiClient
  const { default: OpenAI } = await import('openai')
  // maxRetries: 0 — il retry automatico dell'SDK su 429 aspetta secondi (backoff)
  // prima di riprovare LO STESSO modello: la chat sembrava morta (>10s). Meglio
  // fallire SUBITO e ripiegare immediatamente sull'altro modello (openStream/create).
  _openaiClient = new OpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1', maxRetries: 0, timeout: 30000 })
  return _openaiClient
}

// Completamento one-shot (no tool loop): per generazione contenuti (descrizioni piatti,
// traduzioni). Prova un modello capace, ripiega sull'8b veloce. Ritorna il testo pulito.
async function groqComplete(system: string, user: string, maxTokens = 220): Promise<string> {
  const openai = await groqClient()
  let lastErr: any
  for (const model of ['openai/gpt-oss-120b', 'llama-3.1-8b-instant']) {
    try {
      const r = await openai.chat.completions.create({
        model, temperature: 0.7, max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      })
      const txt = r.choices?.[0]?.message?.content
      if (txt && txt.trim()) return txt.trim()
    } catch (e) { lastErr = e }
  }
  throw lastErr ?? new Error('AI vuota')
}

// PRE-GATE assegnazione FOTO: quando arriva un'immagine (WhatsApp media o upload copilot)
// il suo URL è passato in pendingImageUrl. L'immagine NON va all'LLM: risolviamo il piatto
// dal messaggio e assegniamo in modo deterministico (come per WhatsApp). Ritorna null se
// non c'è un'immagine → si prosegue col normale flusso LLM.
async function assignImageGate(opts: { ctx: ActionContext; userMessage: string; pendingImageUrl?: string }): Promise<AssistantTurn | null> {
  const url = opts.pendingImageUrl
  if (!url || !url.startsWith('/uploads/')) return null
  const match = await resolveItem(opts.ctx.restaurantId, opts.userMessage, false)
  if (!match) {
    return { message: '📷 Immagine ricevuta, ma non ho capito a quale piatto assegnarla. Riprova indicando il nome esatto del piatto insieme alla foto.', actions: [], pending: [] }
  }
  const res = await executeAction('set_dish_image', { itemName: match.name, imageUrl: url }, opts.ctx, 'owner', { allowMutation: true })
  return { message: res.ok ? `✅ ${res.summary}` : `⚠️ ${res.summary}`, actions: [], pending: [] }
}

export async function runAssistant(opts: {
  scope: ActionScope
  ctx: ActionContext
  systemPrompt: string
  history: { role: 'user' | 'assistant'; content: string }[]
  userMessage: string
  allow?: string[]
  model?: string
  pendingImageUrl?: string
}): Promise<AssistantTurn> {
  // PRE-GATE immagine: se è allegata una foto, assegnala al piatto (niente LLM).
  if (opts.scope === 'owner' && opts.pendingImageUrl) {
    const gate = await assignImageGate(opts)
    if (gate) return gate
  }
  // PRE-GATE deterministico (come nello streaming): "crea tavolo" senza LLM.
  if (opts.scope === 'owner' && isCreateTableFlow(opts.userMessage, opts.history)) {
    const gate = await createTableGate(opts)
    if (gate) return gate
  }
  const openai = await groqClient()
  const tools = toolSchemasFor(opts.scope, opts.userMessage, opts.allow)
  let model = opts.model ?? pickModel(opts.userMessage)
  // Fallback su rate-limit: le quote Groq sono PER MODELLO. Se il 70b esaurisce
  // i token del giorno (TPD), il copilot non deve morire: ripiega sull'8b-instant
  // (quota separata, più capiente) per il resto del turno.
  const FALLBACK_MODEL = 'llama-3.1-8b-instant'
  // I modelli llama su Groq ogni tanto emettono un tool-call malformato → l'API
  // risponde 400 "tool_use_failed". Senza retry il turno moriva in un 502 generico
  // ("Tako non disponibile"). Strategia: riprova una volta (temperature>0 → uscita
  // diversa), poi ripiega sul modello di riserva, e come ultima risorsa rispondi
  // SENZA tool (meglio una risposta senza azioni che un errore).
  const isToolUseFailure = (e: any) =>
    e?.status === 400 && /tool(_| )use|tool call|function call/i.test(JSON.stringify(e?.error ?? e?.message ?? ''))
  const create = async (params: any) => {
    try {
      return await openai.chat.completions.create(params)
    } catch (e: any) {
      if (e?.status === 429) {
        // catena di failover: prova subito i modelli successivi (quote separate)
        for (const nm of MODEL_CHAIN) {
          if (nm === params.model) continue
          try { model = nm; return await openai.chat.completions.create({ ...params, model: nm }) }
          catch (e2: any) { if (e2?.status !== 429) throw e2 }
        }
        throw e
      }
      // 413 "Request too large": il budget token-per-minuto del tier Groq non copre
      // la richiesta (succede sull'8b di riserva: TPM 6000 ≈ system + 37 tool schema
      // + history). Alleggerisci (system + ultimo scambio) e riprova una volta; se
      // non basta l'errore risale e la route lo mappa in un 429 leggibile.
      if (e?.status === 413 && Array.isArray(params.messages) && params.messages.length > 3) {
        const slim = [params.messages[0], ...params.messages.slice(-2)]
        return await openai.chat.completions.create({ ...params, messages: slim })
      }
      if (isToolUseFailure(e)) {
        try {
          return await openai.chat.completions.create(params) // retry: uscita non deterministica
        } catch (e2: any) {
          if (!isToolUseFailure(e2)) throw e2
          if (params.model !== FALLBACK_MODEL) {
            model = FALLBACK_MODEL
            try {
              return await openai.chat.completions.create({ ...params, model: FALLBACK_MODEL })
            } catch (e3: any) {
              if (!isToolUseFailure(e3)) throw e3
            }
          }
          // ultima risorsa: niente tool, almeno il copilot risponde
          const { tools: _t, tool_choice: _tc, ...rest } = params
          return await openai.chat.completions.create(rest)
        }
      }
      throw e
    }
  }
  const messages: any[] = [
    { role: 'system', content: opts.systemPrompt },
    ...opts.history.slice(-6).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: opts.userMessage },
  ]
  const actions: any[] = []
  const pending: { name: string; args: any; label: string }[] = []

  let badOutputRetried = false // un solo retry per output inutilizzabile
  for (let iter = 0; iter < 4; iter++) {
    const resp = await create({
      model, messages, tools: tools.length ? tools : undefined,
      // 'required' alla 1ª iterazione quando il messaggio matcha una categoria di
      // tool: i modelli piccoli altrimenti rispondono a voce inventando i dati.
      tool_choice: tools.length ? (iter === 0 && hasToolHint(opts.userMessage) ? 'required' : 'auto') : undefined,
      // 700: un max_tokens troppo basso TRONCA il JSON dei tool-call (args vuoti →
      // card "Crea tavolo ?" che poi fallisce all'esecuzione).
      temperature: 0.4, max_tokens: 700,
    })
    const msg = resp.choices?.[0]?.message
    let toolCalls = msg?.tool_calls
    if (!toolCalls || !toolCalls.length) {
      // pseudo-XML al posto del function-call (artefatto llama) → convertilo
      const rawContent = String(msg?.content ?? '').trim()
      const pseudo = rawContent.match(/^<(?:function[=\s]+)?([a-zA-Z_][a-zA-Z0-9_]{2,40})>?/)
      if (pseudo && pseudo[1] && BY_NAME.has(pseudo[1])) {
        toolCalls = [{ id: `pseudo_${iter}`, type: 'function', function: { name: pseudo[1], arguments: '{}' } } as any]
        msg.content = ''
      } else if (!badOutputRetried && rawContent && (
        // pseudo-tag ignoto o meta-parlato: risposta inutilizzabile → un retry
        // con modello più capace (come nel loop streaming)
        (pseudo && pseudo[1] && !BY_NAME.has(pseudo[1])) ||
        /\b(?:lo strumento|utilizzo lo strumento|posso (?:proporre|utilizzare)|devo utilizzare|uso lo strumento)\b/i.test(rawContent)
      )) {
        badOutputRetried = true
        const nm = ['openai/gpt-oss-120b', 'meta-llama/llama-4-scout-17b-16e-instruct'].find(m => m !== model)
        if (nm) model = nm
        iter--
        continue
      } else {
        return { message: rawContent || 'Fatto.', actions, pending }
      }
    }
    // registra il turno assistant con le tool_calls
    messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: toolCalls })
    // Come nel loop streaming: se l'iterazione produce SOLO mutation (proposte o
    // guardia), la risposta la compone il server (short-circuit, niente 2° giro LLM).
    let iterAsk: string | null = null
    const iterProposals: string[] = []
    let iterHadRead = false
    let lastReadSummary = ''
    for (const tc of toolCalls) {
      let args: any = {}
      try { args = JSON.parse(tc.function?.arguments || '{}') } catch { args = {} }
      const def = BY_NAME.get(tc.function?.name ?? '')
      let content = ''
      if (!def || !def.scope.includes(opts.scope)) {
        content = 'Azione non disponibile.'
      } else if (def.kind === 'mutation') {
        // MAI eseguita in chat: proposta in attesa di conferma umana.
        let askTable: string | null = null
        if (def.name === 'create_table') {
          // stessa guardia data-aware del loop streaming (vedi runAssistantStream)
          const allRooms = await db.select({ name: rooms.name }).from(rooms)
            .where(and(eq(rooms.restaurantId, opts.ctx.restaurantId), eq(rooms.active, true)))
          const roomNames = allRooms.map(r => r.name)
          const userText = [...opts.history.filter(h => h.role === 'user').slice(-3).map(h => h.content), opts.userMessage].join('\n')
          const missing = missingTableInfo(userText, roomNames)
          if (missing.length) {
            askTable = `DATI MANCANTI: chiedi all'utente ${missing.join(', ')}.`
            iterAsk = askTableQuestion(missing, roomNames)
          }
        }
        // Guardia anti-confabulazione per le ALTRE creazioni (prenotazioni, piatti…):
        // se l'LLM ha inventato campi obbligatori non presenti nel messaggio, chiedi.
        if (!askTable) {
          const userText = [...opts.history.filter(h => h.role === 'user').slice(-3).map(h => h.content), opts.userMessage].join('\n')
          const confMiss = confabulatedFields(def.name, args, userText)
          if (confMiss.length) {
            askTable = `DATI MANCANTI: chiedi all'utente ${confMiss.join(', ')}. NON inventare i valori.`
            iterAsk = askCreationQuestion(def.name, confMiss)
          }
        }
        if (askTable) {
          content = askTable
        } else {
          // Dedup: il modello tende a richiamare lo stesso tool a ogni iterazione
          // (il tool risponde "in attesa") → senza dedup l'owner vedrebbe N card identiche.
          const key = def.name + JSON.stringify(args ?? {})
          if (!pending.some(p => p.name + JSON.stringify(p.args ?? {}) === key)) {
            pending.push({ name: def.name, args, label: def.label(args) })
            iterProposals.push(def.label(args))
          }
          content = `Proposta registrata: "${def.label(args)}". In attesa di conferma esplicita dell'owner. NON richiamare di nuovo questo strumento: rispondi all'utente che la proposta è pronta da confermare.`
        }
      } else {
        const res = await executeAction(def.name, args, opts.ctx, opts.scope)
        if (res.clientAction) actions.push(res.clientAction)
        content = res.summary
        iterHadRead = true
        lastReadSummary = res.summary || ''
      }
      messages.push({ role: 'tool', tool_call_id: tc.id, content })
    }
    if (!iterHadRead && (iterAsk || iterProposals.length)) {
      const m = iterAsk
        ?? (iterProposals.length === 1
          ? `Proposta pronta: ${iterProposals[0]}. Confermala qui sotto.`
          : `Proposte pronte: ${iterProposals.join(' · ')}. Confermale qui sotto.`)
      return { message: m, actions, pending }
    }
    if (iter === 0 && iterHadRead && toolCalls.length === 1 && !iterAsk && !iterProposals.length
        && lastReadSummary && lastReadSummary.length >= 10 && lastReadSummary.length <= 400) {
      return { message: lastReadSummary, actions, pending }
    }
  }
  // safety net: chiusura senza altri tool
  const final = await create({ model, messages, temperature: 0.4, max_tokens: 400 })
  return { message: (final.choices?.[0]?.message?.content ?? '').trim() || 'Fatto.', actions, pending }
}

// ─────────────────────── Routing modello (qualità + latenza) ───────────────────────
// MUTATION e richieste d'azione → gpt-oss-120b: nei test è l'unico che chiama i tool
// giusti con costanza (8b/70b "meta-parlano": descrivono lo strumento invece di
// usarlo) restando sotto il secondo. LETTURE semplici e chit-chat → 8b-instant
// (velocissimo; lo short-circuit sul summary fa il resto).
export function pickModel(msg: string): string {
  const m = (msg || '').toLowerCase()
  const MUT = /\b(segna|metti|mettiamo|togli|rimetti|crea|creiamo|aggiungi|elimin|cancell|modific|cambia|rinomin|imposta|annull|sconto|sconta|chiudi|incassa|rigenera|disattiv|riattiv|carico|scarico|spreco|prenota|prenotazion[ei]|blocca|libera|occupa|esaurit|finit[oa]|terminat)\w*\b/
  if (MUT.test(m)) return 'openai/gpt-oss-120b'
  return 'llama-3.1-8b-instant'
}

// CATENA di failover su 429: le quote Groq (RPM/TPM/TPD) sono PER MODELLO — quando
// uno satura si passa SUBITO al successivo (maxRetries=0, niente attese). Con 5
// modelli il budget per-minuto aggregato regge anche raffiche di messaggi.
const MODEL_CHAIN = [
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile',
]

// ESTRAZIONE dati tavolo da ciò che l'utente ha DAVVERO scritto (messaggio corrente
// + suoi ultimi turni). I modelli piccoli inventano i valori invece di chiedere e
// allucinano nomi di sala ("Sala A/B/C") → i valori li estraiamo NOI, le sale
// vengono dal DB. Copre anche le risposte "sciolte" alla nostra domanda: "12 e 3
// posti" → numero=12, posti=3.
// Numeri IN LETTERE → cifre ("tre posti" → "3 posti"): la dettatura vocale produce
// spesso numeri scritti in parole, e l'estrazione lavora su \d+. Ordine: prima i
// composti (venticinque) poi i semplici, per non spezzarli.
const NUMBER_WORDS: [RegExp, string][] = [
  [/\bventicinque\b/g, '25'], [/\bventiquattro\b/g, '24'], [/\bventitr[eé]\b/g, '23'], [/\bventidue\b/g, '22'], [/\bventuno\b/g, '21'],
  [/\bventi\b/g, '20'], [/\bdiciannove\b/g, '19'], [/\bdiciotto\b/g, '18'], [/\bdiciassette\b/g, '17'], [/\bsedici\b/g, '16'],
  [/\bquindici\b/g, '15'], [/\bquattordici\b/g, '14'], [/\btredici\b/g, '13'], [/\bdodici\b/g, '12'], [/\bundici\b/g, '11'],
  [/\bdieci\b/g, '10'], [/\bnove\b/g, '9'], [/\botto\b/g, '8'], [/\bsette\b/g, '7'], [/\bsei\b/g, '6'],
  // "un/uno/una" = 1 SOLO come quantità, non come articolo di "un tavolo" (altrimenti
  // "creiamo un tavolo" → numero tavolo fantasma "1"). Lookahead: non davanti a "tavol*".
  [/\bcinque\b/g, '5'], [/\bquattro\b/g, '4'], [/\btre\b/g, '3'], [/\bdue\b/g, '2'], [/\b(?:uno|un|una)\b(?!\s+tavol)/g, '1'],
]
export function normalizeNumberWords(text: string): string {
  let t = text
  for (const [re, digit] of NUMBER_WORDS) t = t.replace(re, digit)
  return t
}

export function extractTableInfo(userText: string, roomNames: string[]): { number: string | null; seats: number | null; roomName: string | null } {
  const m = normalizeNumberWords((userText || '').toLowerCase())
  // sala: nome REALE citato (match esatto o contenuto), o "sala X" da risolvere poi
  let roomName: string | null = null
  for (const r of roomNames) { if (r && m.includes(r.toLowerCase())) { roomName = r; break } }
  // posti: "3 posti", "posti 3" / "posti: 3" / "numero posti 3", "da 3", "per 3 (persone)"
  // la cifra può stare PRIMA o DOPO la parola "post*" (l'utente scrive in entrambi i modi).
  let seats: number | null = null
  const seatM = m.match(/(\d+)\s*post/) ?? m.match(/\bpost\w*\s*:?\s*(\d+)/) ?? m.match(/\bda\s+(\d+)\b/) ?? m.match(/\bper\s+(\d+)\s*(?:person|copert)/)
  if (seatM?.[1]) seats = parseInt(seatM[1], 10)
  // numero tavolo: "tavolo 12", "numero 12"; fallback = un numero NON usato per i posti
  let number: string | null = null
  const numM = m.match(/tavolo\s*(?:n[°.]?\s*)?(\d+)/) ?? m.match(/numero\s*(?:del\s+tavolo\s*)?(\d+)/)
  if (numM?.[1]) number = numM[1]
  if (!number) {
    const all = (m.match(/\d+/g) || [])
    const leftover = all.filter(n => seats === null || n !== String(seats))
    if (leftover.length === 1) number = leftover[0]!
    else if (leftover.length > 1 && seats !== null) number = leftover[0]!  // "12 e 3 posti" → 12
  }
  return { number, seats, roomName }
}

// Campi ancora mancanti per creare il tavolo (wrapper di extractTableInfo).
// NB: il numero del tavolo NON è più obbligatorio — se l'owner non lo indica viene
// assegnato in automatico (prossimo libero). Chiediamo solo posti e sala.
export function missingTableInfo(userText: string, roomNames: string[]): string[] {
  const x = extractTableInfo(userText, roomNames)
  const missing: string[] = []
  if (!x.seats) missing.push('numero di posti')
  if (!x.roomName && !/\bsala\s+\S+/.test((userText || '').toLowerCase())) missing.push('sala')
  return missing
}

// Il messaggio (o l'ultima domanda dell'assistente) riguarda la creazione tavolo?
// Usato dal PRE-GATE deterministico: l'intero flusso "crea tavolo" gira senza LLM.
// Intent STRETTO: "tavolo" deve seguire subito il verbo (max un articolo in mezzo) —
// "crea un ordine per il tavolo 12" NON deve scattare (l'oggetto è l'ordine).
export function isCreateTableFlow(userMessage: string, history: { role: string; content: string }[]): boolean {
  const m = (userMessage || '').toLowerCase()
  if (/\b(?:crea(?:re)?|creiamo|aggiung(?:i|iamo|ere)|metti(?:amo)?|mettere|inseri(?:sci|re)|fa(?:i|re)|nuov[oa])\s+(?:un[oa]?\s+|il\s+|la\s+|nuov[oa]\s+|altro\s+)?tavol/.test(m)) return true
  const lastAssistant = [...history].reverse().find(h => h.role === 'assistant')
  return !!lastAssistant && lastAssistant.content.startsWith('Per creare il tavolo mi serve ancora')
}

// Domanda deterministica per i dati mancanti del tavolo (short-circuit: la formula
// il server, senza un secondo giro LLM — vedi sotto).
export function askTableQuestion(missing: string[], roomNames: string[]): string {
  const dati = missing.length === 1 ? missing[0] : missing.slice(0, -1).join(', ') + ' e ' + missing[missing.length - 1]
  const sale = roomNames.length ? ` Le sale sono: ${roomNames.map(n => `"${n}"`).join(', ')}.` : ''
  return `Per creare il tavolo mi serve ancora: ${dati}.${sale}`
}

// ─────────────────────── GUARDIA ANTI-CONFABULAZIONE (creazioni) ───────────────────────
// I modelli piccoli INVENTANO i campi obbligatori delle creazioni: "crea una
// prenotazione" (senza dati) → propone nome/data/persone tutti inventati. Per le
// creazioni con campi semantici verifichiamo che il valore proposto dall'LLM sia
// EVIDENZIATO nel messaggio dell'utente; se non lo è, lo trattiamo come inventato e
// CHIEDIAMO invece di proporre. (create_table ha la sua guardia dedicata, vedi sopra.)
type ConfabKind = 'literal' | 'party' | 'datetime' | 'money'
const CONFAB_SPEC: Record<string, { field: string; kind: ConfabKind; label: string }[]> = {
  create_reservation: [
    { field: 'customerName', kind: 'literal', label: 'nome cliente' },
    { field: 'partySize', kind: 'party', label: 'numero di persone' },
    { field: 'when', kind: 'datetime', label: 'data e ora' },
  ],
  create_menu_item: [
    { field: 'name', kind: 'literal', label: 'nome del piatto' },
    { field: 'price', kind: 'money', label: 'prezzo' },
  ],
  add_dish_variant: [
    { field: 'name', kind: 'literal', label: 'nome della variante' },
    { field: 'price', kind: 'money', label: 'prezzo' },
  ],
  create_inventory_item: [
    { field: 'name', kind: 'literal', label: 'nome articolo' },
  ],
  create_staff: [
    { field: 'name', kind: 'literal', label: 'nome del membro dello staff' },
  ],
  create_room: [
    { field: 'name', kind: 'literal', label: 'nome della sala' },
  ],
  create_menu_section: [
    { field: 'name', kind: 'literal', label: 'nome della sezione' },
  ],
  // Distruttive/di modifica su un tavolo per numero: se l'LLM inventa un numero che per
  // caso esiste, agirebbe su un tavolo mai indicato. Il numero deve venire dall'utente.
  delete_table: [
    { field: 'number', kind: 'literal', label: 'numero del tavolo da eliminare' },
  ],
  update_table: [
    { field: 'number', kind: 'literal', label: 'numero del tavolo da modificare' },
  ],
}

// La stringa contiene un riferimento a data/ora? (accetta forme naturali italiane, non
// solo l'ISO che l'LLM produce: "domani alle 20", "sabato sera", "15/07 21:30", ecc.)
function textHasDatetime(t: string): boolean {
  const m = (t || '').toLowerCase()
  return /\b\d{1,2}[:.]\d{2}\b/.test(m)
    || /\b(?:alle|ore)\s+\d{1,2}\b/.test(m)
    || /\b\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?\b/.test(m)
    || /\d{4}-\d{2}-\d{2}/.test(m)
    || /\b(oggi|stasera|stanotte|domani|dopodomani|dopo\s?domani|weekend|stamattina|mezzogiorno)\b/.test(m)
    || /\b(luned|marted|mercoled|gioved|venerd|sabato|domenica)/.test(m)
}
// La stringa indica un numero di persone? (pattern specifici, per non scambiare un orario
// "alle 20" per il numero di coperti.)
function textHasParty(t: string): boolean {
  const m = normalizeNumberWords((t || '').toLowerCase())
  return /\b(?:per|siamo(?:\s+in)?|in|x)\s*\d+\b/.test(m)
    || /\b\d+\s*(?:person|copert|ospit|client|posti|adult|bambin)/.test(m)
    || /\btavolo\s+da\s+\d+\b/.test(m)
}
// La stringa contiene un prezzo/importo? ("12", "12,50", "€12", "12 euro")
function textHasMoney(t: string): boolean {
  const m = normalizeNumberWords((t || '').toLowerCase())
  return /\d+(?:[.,]\d{1,2})?\s*(?:€|eur|euro)\b/.test(m) || /(?:€|eur|euro)\s*\d/.test(m) || /\d+[.,]\d{1,2}\b/.test(m) || /\ba\s+\d+\b/.test(m)
}
// Il valore (una o più parole) compare nel testo dell'utente? (>=3 char per parola)
function textHasLiteral(val: unknown, t: string): boolean {
  const v = String(val ?? '').toLowerCase().trim()
  if (!v) return false
  const text = (t || '').toLowerCase()
  const words = v.split(/\s+/).filter(w => w.length >= 3)
  if (!words.length) return text.includes(v)
  return words.some(w => text.includes(w))
}

// Campi obbligatori (probabilmente) INVENTATI dall'LLM per un'azione di creazione, in
// forma di etichette da chiedere. [] se l'azione non è coperta o tutto è evidenziato.
export function confabulatedFields(name: string, args: any, userText: string): string[] {
  const spec = CONFAB_SPEC[name]
  if (!spec) return []
  const t = userText || ''
  const missing: string[] = []
  for (const s of spec) {
    const raw = args?.[s.field]
    const present = raw != null && String(raw).trim() !== ''
    let ok = false
    if (s.kind === 'literal') ok = present && textHasLiteral(raw, t)
    else if (s.kind === 'party') ok = textHasParty(t)
    else if (s.kind === 'datetime') ok = textHasDatetime(t)
    else if (s.kind === 'money') ok = textHasMoney(t)
    if (!ok) missing.push(s.label)
  }
  return missing
}

export function askCreationQuestion(name: string, missing: string[]): string {
  const OBJ: Record<string, string> = {
    create_reservation: 'la prenotazione', create_menu_item: 'il piatto', add_dish_variant: 'la variante',
    create_inventory_item: "l'articolo", create_staff: 'il membro dello staff', create_room: 'la sala',
  }
  const obj = OBJ[name] ?? 'la creazione'
  const dati = missing.length === 1 ? missing[0] : missing.slice(0, -1).join(', ') + ' e ' + missing[missing.length - 1]
  return `Per creare ${obj} mi serve ancora: ${dati}.`
}

// PRE-GATE "crea tavolo": l'INTERO flusso (domanda dati → proposta) gira senza LLM.
// Latenza ~50ms garantita e zero possibilità di valori inventati. Ritorna null solo
// se qualcosa non torna (→ si passa al normale giro LLM).
async function createTableGate(opts: {
  ctx: ActionContext
  history: { role: 'user' | 'assistant'; content: string }[]
  userMessage: string
}): Promise<AssistantTurn | null> {
  const def = BY_NAME.get('create_table')
  if (!def) return null
  const allRooms = await db.select({ name: rooms.name }).from(rooms)
    .where(and(eq(rooms.restaurantId, opts.ctx.restaurantId), eq(rooms.active, true)))
  const roomNames = allRooms.map(r => r.name)

  // Considera SOLO il flusso corrente: i turni utente DOPO l'ultima proposta
  // conclusa ("Proposta pronta: …") appartengono a questo tavolo; quelli prima
  // erano di un flusso già chiuso e inquinerebbero l'estrazione (es. ricreare
  // subito il tavolo precedente con i vecchi dati).
  let start = 0
  for (let i = opts.history.length - 1; i >= 0; i--) {
    const h = opts.history[i]!
    if (h.role === 'assistant' && h.content.startsWith('Proposta pronta:')) { start = i + 1; break }
  }
  const prevUserText = opts.history.slice(start).filter(h => h.role === 'user').slice(-4).map(h => h.content).join('\n')

  // PRIORITÀ AL MESSAGGIO CORRENTE: se l'utente corregge ("sala esterna" dopo aver
  // detto "interna" due turni fa), vince l'ultimo messaggio; i turni precedenti
  // riempiono solo i buchi.
  const cur = extractTableInfo(opts.userMessage, roomNames)
  const prev = extractTableInfo(prevUserText, roomNames)
  const x = {
    number: cur.number ?? prev.number,
    seats: cur.seats ?? prev.seats,
    roomName: cur.roomName ?? prev.roomName,
  }

  // Numeri "sciolti" in risposta alla NOSTRA domanda ("12 3" → tavolo 12, 3 posti):
  // li assegniamo ai SOLI campi che la domanda ha chiesto, nell'ordine della domanda
  // (prima "numero del tavolo", poi "numero di posti"). Così un "3" in risposta a "mi
  // serve il numero di posti" va sui POSTI e non sul numero del tavolo (il fallback
  // greedy di extractTableInfo lo aveva preso come numero → loop). Le keyword esplicite
  // nel messaggio corrente ("tavolo 12", "3 posti") vincono comunque.
  const lastAssistant = [...opts.history].reverse().find(h => h.role === 'assistant')
  const isFollowUp = !!lastAssistant && lastAssistant.content.startsWith('Per creare il tavolo mi serve ancora')
  if (isFollowUp) {
    const q = lastAssistant!.content
    const um = normalizeNumberWords((opts.userMessage || '').toLowerCase())
    const kwSeats = (um.match(/(\d+)\s*post/) ?? um.match(/\bpost\w*\s*:?\s*(\d+)/) ?? um.match(/\bda\s+(\d+)\b/) ?? um.match(/\bper\s+(\d+)\s*(?:person|copert)/))?.[1] ?? null
    const kwNumber = (um.match(/tavolo\s*(?:n[°.]?\s*)?(\d+)/) ?? um.match(/numero\s+del\s+tavolo[^\d]*(\d+)/))?.[1] ?? null
    const lone = (um.match(/\d+/g) || []).filter(n => n !== kwSeats && n !== kwNumber)
    const slots: ('number' | 'seats')[] = []
    if (q.includes('numero del tavolo')) slots.push('number')
    if (q.includes('numero di posti')) slots.push('seats')
    const pick: Record<string, string> = {}
    for (let i = 0; i < slots.length && i < lone.length; i++) pick[slots[i]!] = lone[i]!
    const num = kwNumber ?? pick['number'] ?? prev.number ?? null
    const seat = kwSeats ?? pick['seats'] ?? (prev.seats != null ? String(prev.seats) : null)
    x.number = num
    x.seats = seat != null ? parseInt(seat, 10) : null
  }

  // qui la sala deve essere UNA DI QUELLE REALI (se esistono sale)
  // NUMERO NON obbligatorio: se l'owner non lo dà, lo assegniamo noi (prossimo libero).
  // Così spariscono le domande ambigue ("3" = numero o posti?) — chiediamo solo posti+sala.
  const missing: string[] = []
  if (!x.seats) missing.push('numero di posti')
  if (!x.roomName && roomNames.length) missing.push('sala')
  if (missing.length) return { message: askTableQuestion(missing, roomNames), actions: [], pending: [] }
  const number = x.number ?? await nextTableNumber(opts.ctx.restaurantId)
  const args: any = { number, seats: x.seats }
  if (x.roomName) args.roomName = x.roomName
  const label = def.label(args)
  return { message: `Proposta pronta: ${label}. Confermala qui sotto.`, actions: [], pending: [{ name: 'create_table', args, label }] }
}

export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'reset' }

// ─────────────────────── Variante STREAMING del loop tool-calling ───────────────────────
// Identica a runAssistant nella logica (loop tool → mutation proposte → letture eseguite),
// ma la RISPOSTA finale è emessa token-per-token via `emit` (percezione istantanea).
// I token dell'iterazione finale (quella senza tool-call) vanno live; se un'iterazione
// intermedia emette testo E poi chiama un tool (raro con llama), si invia un 'reset' per
// scartare quel testo lato client. Ritorna comunque l'AssistantTurn completo.
export async function runAssistantStream(opts: {
  scope: ActionScope
  ctx: ActionContext
  systemPrompt: string
  history: { role: 'user' | 'assistant'; content: string }[]
  userMessage: string
  allow?: string[]
  model?: string
  pendingImageUrl?: string
}, emit: (ev: StreamEvent) => void): Promise<AssistantTurn> {
  // PRE-GATE immagine: foto allegata → assegnala al piatto senza LLM.
  if (opts.scope === 'owner' && opts.pendingImageUrl) {
    const gate = await assignImageGate(opts)
    if (gate) { emit({ type: 'token', text: gate.message }); return gate }
  }
  // PRE-GATE deterministico: il flusso "crea tavolo" non passa dall'LLM.
  if (opts.scope === 'owner' && isCreateTableFlow(opts.userMessage, opts.history)) {
    const gate = await createTableGate(opts)
    if (gate) { emit({ type: 'token', text: gate.message }); return gate }
  }
  const openai = await groqClient()
  // Solo i tool pertinenti al messaggio (meno token → 70b dura di più, 8b affidabile).
  const tools = toolSchemasFor(opts.scope, opts.userMessage, opts.allow)
  const FALLBACK_MODEL = 'llama-3.1-8b-instant'
  let model = opts.model ?? pickModel(opts.userMessage)

  // Apre lo stream con un timeout GENEROSO sull'handshake (create): impedisce hang
  // infiniti senza però abortire chiamate lente ma valide. Sul 429 (quota giornaliera
  // del 70b esaurita, tipico sul free tier) ripiega sull'8b; sul 400 tool_use_failed
  // riprova senza tool (almeno una risposta); sul 413 alleggerisce la history.
  const attemptStream = async (p: any): Promise<any> => {
    const ac = new AbortController()
    const to = setTimeout(() => ac.abort(new Error('groq-open-timeout')), 45000)
    try { return await openai.chat.completions.create({ ...p, stream: true }, { signal: ac.signal }) }
    finally { clearTimeout(to) }
  }
  const openStream = async (params: any): Promise<any> => {
    const tried = new Set<string>([params.model])
    let p: any = { ...params }
    let slimmed = false
    let noTools = false
    for (let i = 0; i < 8; i++) {
      try {
        return await attemptStream(p)
      } catch (e: any) {
        if (e?.status === 429) {
          // quota sul modello corrente → passa SUBITO al prossimo della catena
          const nm = MODEL_CHAIN.find(m => !tried.has(m))
          if (nm) { tried.add(nm); model = nm; p = { ...p, model: nm }; continue }
          throw e
        }
        if (e?.status === 413 && !slimmed && Array.isArray(p.messages) && p.messages.length > 3) {
          slimmed = true
          p = { ...p, messages: [p.messages[0], ...p.messages.slice(-2)] }
          continue
        }
        if (isGroqToolUseFailure(e) && !noTools) {
          // function-call sbagliato → riprova con un modello più capace non ancora
          // provato; esauriti quelli, rispondi senza tool (mai un errore secco)
          const nm = ['openai/gpt-oss-120b', 'meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.3-70b-versatile'].find(m => !tried.has(m))
          if (nm) { tried.add(nm); model = nm; p = { ...p, model: nm }; continue }
          noTools = true
          const { tools: _t, tool_choice: _tc, ...rest } = p
          p = rest
          continue
        }
        throw e
      }
    }
    throw new Error('groq: tentativi esauriti')
  }

  const messages: any[] = [
    { role: 'system', content: opts.systemPrompt },
    ...opts.history.slice(-6).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: opts.userMessage },
  ]
  const actions: any[] = []
  const pending: { name: string; args: any; label: string }[] = []

  let badOutputRetried = false // un solo retry per output inutilizzabile (pseudo-tag ignoto / meta-parlato)
  for (let iter = 0; iter < 4; iter++) {
    // Dopo la prima iterazione, il modello VELOCE (8b) risponde SENZA tool-schema:
    // la lettura è già stata eseguita, servono solo i token della risposta — e senza
    // gli schema si resta sotto il TPM stretto dell'8b (niente hang) ed è più rapido.
    // I modelli più grandi reggono il payload e tengono i tool su tutte le iterazioni.
    const useTools = tools.length > 0 && (iter === 0 || model !== 'llama-3.1-8b-instant')
    const stream = await openStream({
      model, messages,
      tools: useTools ? tools : undefined,
      tool_choice: useTools ? (iter === 0 && hasToolHint(opts.userMessage) ? 'required' : 'auto') : undefined,
      temperature: 0.4, max_tokens: 700,
    })
    let content = ''
    let emittedThisIter = false
    const tcAcc: any[] = []
    try {
      for await (const chunk of stream) {
        const delta = chunk?.choices?.[0]?.delta
        if (!delta) continue
        if (delta.content) { content += delta.content; emit({ type: 'token', text: delta.content }); emittedThisIter = true }
        if (Array.isArray(delta.tool_calls)) {
          for (const t of delta.tool_calls) {
            const idx = t.index ?? 0
            if (!tcAcc[idx]) tcAcc[idx] = { id: t.id, type: 'function', function: { name: '', arguments: '' } }
            if (t.id) tcAcc[idx].id = t.id
            if (t.function?.name) tcAcc[idx].function.name += t.function.name
            if (t.function?.arguments) tcAcc[idx].function.arguments += t.function.arguments
          }
        }
      }
    } catch (e: any) {
      // Groq può validare il tool-call a fine stream (es. l'8b passa `seats` come
      // stringa → "tool call validation failed"). In tal caso: scarta il parziale e
      // rispondi SENZA tool, così il copilot dà comunque una risposta a parole.
      if (!isGroqToolUseFailure(e)) throw e
      if (emittedThisIter) emit({ type: 'reset' })
      const s2 = await openStream({ model, messages, temperature: 0.4, max_tokens: 400 })
      let c = ''
      for await (const chunk of s2) { const d = chunk?.choices?.[0]?.delta; if (d?.content) { c += d.content; emit({ type: 'token', text: d.content }) } }
      if (!c.trim()) { emit({ type: 'token', text: 'Non riesco a farlo da qui: fallo dalla dashboard.' }); c = 'Non riesco a farlo da qui: fallo dalla dashboard.' }
      return { message: c.trim(), actions, pending }
    }
    const toolCalls = tcAcc.filter(Boolean)
    // Artefatto llama: a volte il modello scrive il tool come PSEUDO-XML nel testo
    // ("<table_status></table_status>") invece di un vero function-call → in chat
    // arriverebbe il tag grezzo. Riconoscilo e convertilo in tool-call reale.
    if (!toolCalls.length) {
      const pseudo = content.trim().match(/^<(?:function[=\s]+)?([a-zA-Z_][a-zA-Z0-9_]{2,40})>?/)
      if (pseudo && pseudo[1] && BY_NAME.has(pseudo[1])) {
        toolCalls.push({ id: `pseudo_${iter}`, type: 'function', function: { name: pseudo[1], arguments: '{}' } })
        if (emittedThisIter) { emit({ type: 'reset' }); emittedThisIter = false }
        content = ''
      } else if (!badOutputRetried && content.trim() && (
        // pseudo-tag di un tool INESISTENTE ("<brave_search>") o "meta-parlato":
        // il modello DESCRIVE lo strumento invece di chiamarlo. In entrambi i casi
        // la risposta è inutilizzabile → scarta e ripeti l'iterazione con un
        // modello più capace (una sola volta, poi si accetta ciò che arriva).
        (pseudo && pseudo[1] && !BY_NAME.has(pseudo[1])) ||
        /\b(?:lo strumento|utilizzo lo strumento|posso (?:proporre|utilizzare)|devo utilizzare|uso lo strumento)\b/i.test(content)
      )) {
        badOutputRetried = true
        const nm = ['openai/gpt-oss-120b', 'meta-llama/llama-4-scout-17b-16e-instruct'].find(m => m !== model)
        if (nm) model = nm
        if (emittedThisIter) emit({ type: 'reset' })
        iter--
        continue
      }
    }
    if (!toolCalls.length) {
      if (!content.trim()) { emit({ type: 'token', text: 'Fatto.' }); content = 'Fatto.' }
      return { message: content.trim(), actions, pending }
    }
    // L'iterazione ha chiamato tool: se aveva già emesso testo, scartalo lato client.
    if (emittedThisIter) emit({ type: 'reset' })
    messages.push({ role: 'assistant', content: content ?? '', tool_calls: toolCalls })
    // Traccia cosa produce QUESTA iterazione: se sono solo mutation (proposte o
    // guardia dati-mancanti) la risposta la componiamo NOI senza un secondo giro
    // LLM (short-circuit) → latenza dimezzata. Le letture invece hanno bisogno
    // del modello per sintetizzare i numeri.
    let iterAsk: string | null = null
    const iterProposals: string[] = []
    let iterHadRead = false
    let lastReadSummary = ''
    for (const tc of toolCalls) {
      let args: any = {}
      try { args = JSON.parse(tc.function?.arguments || '{}') } catch { args = {} }
      const def = BY_NAME.get(tc.function?.name ?? '')
      let out = ''
      if (!def || !def.scope.includes(opts.scope)) {
        out = 'Azione non disponibile.'
      } else if (def.kind === 'mutation') {
        let askTable: string | null = null
        if (def.name === 'create_table') {
          // sale REALI dal DB (mai dal modello) + campi davvero forniti dall'utente
          const allRooms = await db.select({ name: rooms.name }).from(rooms)
            .where(and(eq(rooms.restaurantId, opts.ctx.restaurantId), eq(rooms.active, true)))
          const roomNames = allRooms.map(r => r.name)
          const userText = [...opts.history.filter(h => h.role === 'user').slice(-3).map(h => h.content), opts.userMessage].join('\n')
          const missing = missingTableInfo(userText, roomNames)
          if (missing.length) {
            askTable = `DATI MANCANTI: chiedi all'utente ${missing.join(', ')}.`
            iterAsk = askTableQuestion(missing, roomNames)
          }
        }
        // Guardia anti-confabulazione per le ALTRE creazioni (prenotazioni, piatti…):
        // se l'LLM ha inventato campi obbligatori non presenti nel messaggio, chiedi.
        if (!askTable) {
          const userText = [...opts.history.filter(h => h.role === 'user').slice(-3).map(h => h.content), opts.userMessage].join('\n')
          const confMiss = confabulatedFields(def.name, args, userText)
          if (confMiss.length) {
            askTable = `DATI MANCANTI: chiedi all'utente ${confMiss.join(', ')}. NON inventare i valori.`
            iterAsk = askCreationQuestion(def.name, confMiss)
          }
        }
        if (askTable) {
          out = askTable // niente proposta: mancano dati (la domanda la manda il server)
        } else {
          const key = def.name + JSON.stringify(args ?? {})
          if (!pending.some(p => p.name + JSON.stringify(p.args ?? {}) === key)) {
            pending.push({ name: def.name, args, label: def.label(args) })
            iterProposals.push(def.label(args))
          }
          out = `Proposta registrata: "${def.label(args)}". In attesa di conferma esplicita dell'owner. NON richiamare di nuovo questo strumento: rispondi all'utente che la proposta è pronta da confermare.`
        }
      } else {
        const res = await executeAction(def.name, args, opts.ctx, opts.scope)
        if (res.clientAction) actions.push(res.clientAction)
        out = res.summary
        iterHadRead = true
        lastReadSummary = res.summary || ''
      }
      messages.push({ role: 'tool', tool_call_id: tc.id, content: out })
    }
    // SHORT-CIRCUIT: solo mutation in questa iterazione → risposta deterministica
    // immediata dal server (nessun secondo giro LLM).
    if (!iterHadRead && (iterAsk || iterProposals.length)) {
      const msg = iterAsk
        ?? (iterProposals.length === 1
          ? `Proposta pronta: ${iterProposals[0]}. Confermala qui sotto.`
          : `Proposte pronte: ${iterProposals.join(' · ')}. Confermale qui sotto.`)
      emit({ type: 'token', text: msg })
      return { message: msg, actions, pending }
    }
    // SHORT-CIRCUIT letture semplici: UNA sola lettura, summary leggibile e
    // AUTOSUFFICIENTE (20–400 char: sotto i 20 è quasi certamente un frammento
    // fuori contesto, es. il solo nome di una sala) → rispondi col summary del
    // tool (i numeri veri), senza il giro LLM di sintesi.
    if (iter === 0 && iterHadRead && toolCalls.length === 1 && !iterAsk && !iterProposals.length
        && lastReadSummary && lastReadSummary.length >= 10 && lastReadSummary.length <= 400) {
      emit({ type: 'token', text: lastReadSummary })
      return { message: lastReadSummary, actions, pending }
    }
  }
  // safety net: chiusura in streaming, senza altri tool
  const stream = await openStream({ model, messages, temperature: 0.4, max_tokens: 400 })
  let content = ''
  for await (const chunk of stream) {
    const d = chunk?.choices?.[0]?.delta
    if (d?.content) { content += d.content; emit({ type: 'token', text: d.content }) }
  }
  if (!content.trim()) { emit({ type: 'token', text: 'Fatto.' }); content = 'Fatto.' }
  return { message: content.trim(), actions, pending }
}
