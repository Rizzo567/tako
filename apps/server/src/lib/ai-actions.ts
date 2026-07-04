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
import { round2, restaurantTimezone, dayKeyInTz, dayStartInTz, coverUnit, recomputeOpenBill, BILLABLE_STATUSES } from './billing.js'

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
  description: string
  parameters: Record<string, any>   // JSON schema per il function-calling
  label: (args: any) => string      // etichetta umana (conferma owner)
  execute: (ctx: ActionContext, args: any) => Promise<ActionResult>
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
  const dateStr = (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : dayKeyInTz(new Date(), tz)
  const dayStart = dayStartInTz(dateStr, tz)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
  const q = (customerName ?? '').toString().toLowerCase().trim()
  const rows = await db.select().from(reservations).where(and(
    eq(reservations.restaurantId, restaurantId),
    gte(reservations.startsAt, dayStart), lt(reservations.startsAt, dayEnd),
    ne(reservations.status, 'cancelled'),
  ))
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
      // menu del ristorante (primo attivo, altrimenti il primo)
      const menusRows = await db.select().from(menus).where(eq(menus.restaurantId, ctx.restaurantId)).orderBy(asc(menus.position))
      const menu = menusRows.find(m => m.active) ?? menusRows[0]
      if (!menu) return { ok: false, summary: 'Nessun menu configurato. Crea prima un menu dalla dashboard.' }
      const sections = await db.select().from(menuSections).where(eq(menuSections.menuId, menu.id)).orderBy(asc(menuSections.position))
      const wanted = (args?.sectionName ?? '').toString().toLowerCase().trim()
      let section = wanted ? sections.find(s => s.name.toLowerCase().includes(wanted)) : sections[0]
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
      io.to(`restaurant:${ctx.restaurantId}`).emit('menu:updated', { itemId: item.id, item })
      return { ok: true, data: { id: item.id, name: item.name, price: item.price, section: section.name }, summary: `Creato "${item.name}" a €${item.price} in "${section.name}".` }
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
      return { ok: true, data: { id: section.id, name: newName }, summary: `Sezione "${section.name}" rinominata in "${newName}".` }
    },
  },

  // ── OWNER · TAVOLI ─────────────────────────────────────────────────────────
  {
    name: 'create_table',
    scope: ['owner'],
    kind: 'mutation',
    description: 'Crea un nuovo tavolo con numero e posti (es. tavolo 12 da 4). Opzionale: nome della sala.',
    parameters: {
      type: 'object',
      properties: {
        number: { type: 'string', description: 'Numero/nome del tavolo (es. "12")' },
        seats: { type: 'integer', minimum: 1, maximum: 40, description: 'Posti (default 4)' },
        roomName: { type: 'string', description: 'Sala in cui metterlo (opzionale)' },
      },
      required: ['number'],
    },
    label: (a) => `Crea tavolo ${a?.number ?? '?'}${a?.seats ? ` (${a.seats} posti)` : ''}${a?.roomName ? ` in "${a.roomName}"` : ''}`,
    execute: async (ctx, args) => {
      const number = (args?.number ?? '').toString().trim()
      if (!number) return { ok: false, summary: 'Numero del tavolo mancante.' }
      const existing = await resolveTable(ctx.restaurantId, number)
      if (existing) return { ok: false, summary: `Esiste già un tavolo "${number}".` }
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
      // stessa creazione della POST /tables: qrToken nuovo, ownership dal contesto
      const qrToken = nanoid(24)
      const [table] = await db.insert(tables).values({ restaurantId: ctx.restaurantId, qrToken, number, seats, roomId: room.id }).returning()
      if (!table) return { ok: false, summary: 'Creazione non riuscita.' }
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
        const clash = await resolveTable(ctx.restaurantId, nn)
        if (clash && clash.id !== t.id) return { ok: false, summary: `Esiste già un tavolo "${nn}".` }
        set['number'] = nn; changes.push(`numero ${t.number} → ${nn}`)
      }
      if (args?.seats != null) {
        const seats = Math.min(Math.max(parseInt(String(args.seats), 10) || t.seats, 1), 40)
        set['seats'] = seats; changes.push(`posti → ${seats}`)
      }
      if (!changes.length) return { ok: false, summary: 'Nessuna modifica indicata: specifica nuovo numero o posti.' }
      await db.update(tables).set(set).where(and(eq(tables.id, t.id), eq(tables.restaurantId, ctx.restaurantId)))
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
      const partySize = Math.min(Math.max(parseInt(String(args?.partySize ?? 0), 10) || 0, 1), 60)
      const whenStr = (args?.when ?? '').toString().trim()
      if (!name || !whenStr) return { ok: false, summary: 'Servono nome cliente, persone e data/ora.' }
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
      // stessi vincoli della PATCH /bills: cap 30% per non-owner, mai totale negativo
      const cap = ctx.role === 'owner' ? bill.subtotal : round2(bill.subtotal * 0.30)
      const discount = Math.min(round2(raw), cap, bill.subtotal)
      const coverCharge = round2((bill.covers ?? 1) * (await coverUnit(ctx.restaurantId)))
      const total = round2(bill.subtotal - discount + (bill.tip ?? 0) + coverCharge)
      await db.update(bills).set({ discount, discountNote: args?.note ? String(args.note).slice(0, 500) : bill.discountNote, total }).where(eq(bills.id, bill.id))
      return { ok: true, data: { billId: bill.id, discount, total }, summary: `Sconto €${discount} applicato al tavolo ${table.number}: nuovo totale €${total}.` }
    },
  },
  {
    name: 'close_bill',
    scope: ['owner'],
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
      // Stessa transazione della POST /bills/:id/payments: lock per-conto, ri-check,
      // pagamento del residuo, chiusura + cascade tavolo→cleaning e ordini→paid.
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${bill.id}))`)
        const [locked] = await tx.select().from(bills).where(eq(bills.id, bill.id)).limit(1)
        if (!locked || locked.status !== 'open') return { conflict: true as const }
        const prev = await tx.select().from(billPayments).where(eq(billPayments.billId, bill.id))
        const paidSoFar = round2(prev.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0))
        const residuo = round2(Math.max(locked.total - paidSoFar, 0))
        if (residuo <= 0) return { conflict: true as const }
        await tx.insert(billPayments).values({ billId: bill.id, amount: residuo, method, status: 'completed' })
        await tx.update(bills).set({ status: 'closed', closedAt: new Date() }).where(eq(bills.id, bill.id))
        const paidOrderIds: string[] = []
        if (locked.tableId) {
          await tx.update(tables).set({ status: 'cleaning', openedAt: null }).where(eq(tables.id, locked.tableId))
          const activeOrders = await tx.select({ id: orders.id }).from(orders).where(and(
            eq(orders.tableId, locked.tableId), inArray(orders.status, [...BILLABLE_STATUSES]),
          ))
          const paidAt = new Date()
          for (const o of activeOrders) {
            await tx.update(orders).set({ status: 'paid', paidAt }).where(eq(orders.id, o.id))
            paidOrderIds.push(o.id)
          }
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
      if (!type || !Number.isFinite(quantity) || quantity <= 0) return { ok: false, summary: 'Tipo o quantità non validi.' }
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
      const verb = type === 'load' ? 'caricati' : type === 'waste' ? 'segnati come spreco' : 'scaricati'
      return { ok: true, data: { id: item.id, quantity: updated.quantity }, summary: `${quantity}${item.unit} di "${item.name}" ${verb}: ora ${updated.quantity}${item.unit}.` }
    },
  },

  // ── OWNER · TURNI ──────────────────────────────────────────────────────────
  {
    name: 'clock_in_staff',
    scope: ['owner'],
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
    kind: 'mutation',
    description: 'Aggiunge un membro dello staff: nome, ruolo (dipendente/chef/cassiere), PIN a 4 cifre per il tablet (opzionale).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        role: { type: 'string', enum: ['dipendente', 'chef', 'cassiere'] },
        pin: { type: 'string', description: '4 cifre (opzionale)' },
        phone: { type: 'string' },
      },
      required: ['name', 'role'],
    },
    label: (a) => `Aggiungi ${a?.name ?? '?'} come ${a?.role ?? '?'}`,
    execute: async (ctx, args) => {
      const name = (args?.name ?? '').toString().trim()
      const role = ['dipendente', 'chef', 'cassiere'].includes(args?.role) ? args.role : null
      if (!name || name.length < 2 || !role) return { ok: false, summary: 'Servono nome (min 2 caratteri) e ruolo valido.' }
      if (args?.pin && !/^\d{4}$/.test(String(args.pin))) return { ok: false, summary: 'Il PIN deve essere di 4 cifre.' }
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
    kind: 'mutation',
    description: 'Disattiva (o riattiva) un membro dello staff. Disattivare revoca subito i suoi accessi.',
    parameters: {
      type: 'object',
      properties: { staffName: { type: 'string' }, active: { type: 'boolean', description: 'false=disattiva, true=riattiva' } },
      required: ['staffName', 'active'],
    },
    label: (a) => `${a?.active ? 'Riattiva' : 'Disattiva'} ${a?.staffName ?? '?'}`,
    execute: async (ctx, args) => {
      const active = args?.active === true
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
      io.to(`restaurant:${ctx.restaurantId}`).emit('menu:updated', { itemId: match.id })
      return { ok: true, data: { id: v!.id }, summary: `Variante "${variantName}" aggiunta a "${match.name}"${mod ? ` (${mod > 0 ? '+' : ''}€${round2(mod)})` : ''}.` }
    },
  },
]

const BY_NAME = new Map(ACTIONS.map(a => [a.name, a]))

export function getAction(name: string): ActionDef | undefined { return BY_NAME.get(name) }

export function actionsForScope(scope: ActionScope, allow?: string[]): ActionDef[] {
  return ACTIONS.filter(a => a.scope.includes(scope) && (!allow || allow.includes(a.name)))
}

// Tool schema in formato OpenAI/Groq function-calling per lo scope indicato.
export function toolSchemas(scope: ActionScope, allow?: string[]): any[] {
  return actionsForScope(scope, allow).map(a => ({
    type: 'function',
    function: { name: a.name, description: a.description, parameters: a.parameters },
  }))
}

// Esegue un'azione con guardie di scope/kind. `allowMutation` deve essere true SOLO
// dopo conferma umana esplicita (endpoint /execute dell'owner).
export async function executeAction(
  name: string, args: any, ctx: ActionContext, scope: ActionScope, opts?: { allowMutation?: boolean },
): Promise<ActionResult> {
  const def = BY_NAME.get(name)
  if (!def) return { ok: false, summary: `Azione sconosciuta: ${name}` }
  if (!def.scope.includes(scope)) return { ok: false, summary: 'Azione non consentita per questo ruolo.' }
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
  _openaiClient = new OpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1' })
  return _openaiClient
}

export async function runAssistant(opts: {
  scope: ActionScope
  ctx: ActionContext
  systemPrompt: string
  history: { role: 'user' | 'assistant'; content: string }[]
  userMessage: string
  allow?: string[]
  model?: string
}): Promise<AssistantTurn> {
  const openai = await groqClient()
  const tools = toolSchemas(opts.scope, opts.allow)
  let model = opts.model ?? 'llama-3.3-70b-versatile'
  // Fallback su rate-limit: le quote Groq sono PER MODELLO. Se il 70b esaurisce
  // i token del giorno (TPD), il copilot non deve morire: ripiega sull'8b-instant
  // (quota separata, più capiente) per il resto del turno.
  const FALLBACK_MODEL = 'llama-3.1-8b-instant'
  const create = async (params: any) => {
    try {
      return await openai.chat.completions.create(params)
    } catch (e: any) {
      if (e?.status === 429 && params.model !== FALLBACK_MODEL) {
        model = FALLBACK_MODEL
        return await openai.chat.completions.create({ ...params, model: FALLBACK_MODEL })
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

  for (let iter = 0; iter < 4; iter++) {
    const resp = await create({
      model, messages, tools: tools.length ? tools : undefined,
      tool_choice: tools.length ? 'auto' : undefined,
      temperature: 0.4, max_tokens: 500,
    })
    const msg = resp.choices?.[0]?.message
    const toolCalls = msg?.tool_calls
    if (!toolCalls || !toolCalls.length) {
      return { message: (msg?.content ?? '').trim() || 'Fatto.', actions, pending }
    }
    // registra il turno assistant con le tool_calls
    messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: toolCalls })
    for (const tc of toolCalls) {
      let args: any = {}
      try { args = JSON.parse(tc.function?.arguments || '{}') } catch { args = {} }
      const def = BY_NAME.get(tc.function?.name ?? '')
      let content = ''
      if (!def || !def.scope.includes(opts.scope)) {
        content = 'Azione non disponibile.'
      } else if (def.kind === 'mutation') {
        // MAI eseguita in chat: proposta in attesa di conferma umana.
        // Dedup: il modello tende a richiamare lo stesso tool a ogni iterazione
        // (il tool risponde "in attesa") → senza dedup l'owner vedrebbe N card identiche.
        const key = def.name + JSON.stringify(args ?? {})
        if (!pending.some(p => p.name + JSON.stringify(p.args ?? {}) === key)) {
          pending.push({ name: def.name, args, label: def.label(args) })
        }
        content = `Proposta registrata: "${def.label(args)}". In attesa di conferma esplicita dell'owner. NON richiamare di nuovo questo strumento: rispondi all'utente che la proposta è pronta da confermare.`
      } else {
        const res = await executeAction(def.name, args, opts.ctx, opts.scope)
        if (res.clientAction) actions.push(res.clientAction)
        content = res.summary
      }
      messages.push({ role: 'tool', tool_call_id: tc.id, content })
    }
  }
  // safety net: chiusura senza altri tool
  const final = await create({ model, messages, temperature: 0.4, max_tokens: 400 })
  return { message: (final.choices?.[0]?.message?.content ?? '').trim() || 'Fatto.', actions, pending }
}
