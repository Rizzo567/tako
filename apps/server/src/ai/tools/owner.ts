import {
  db, menuItems, menuSections, menus, orders, orderItems,
  inventoryItems, users,
} from '@tako/db'
import { and, eq, gte, ne, desc, asc, sql, inArray } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { io } from '../../index.js'
import type { ToolDef, ToolContext } from '../registry.js'

const euro = (n: number) => Math.round(n * 100) / 100
function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export const ownerTools: ToolDef[] = [
  // ---- STATISTICHE (letture, nessuna conferma) ----
  {
    name: 'revenue_today',
    scope: 'owner',
    description: "Incasso di oggi, numero di coperti/ordini e ticket medio.",
    inputSchema: { type: 'object', properties: {} },
    handler: async (_input, ctx: ToolContext) => {
      const rows = await db.select().from(orders)
        .where(and(eq(orders.restaurantId, ctx.restaurantId), gte(orders.createdAt, startOfToday()), ne(orders.status, 'cancelled')))
      const revenue = euro(rows.reduce((s, o) => s + o.total, 0))
      const count = rows.length
      return { revenue, orders: count, avgTicket: count ? euro(revenue / count) : 0 }
    },
  },
  {
    name: 'top_items',
    scope: 'owner',
    description: 'I piatti più venduti (per quantità) in un periodo. days: default 7.',
    inputSchema: {
      type: 'object',
      properties: { days: { type: 'integer', description: 'Giorni indietro (default 7)' } },
    },
    handler: async (input, ctx) => {
      const days = (input['days'] as number) ?? 7
      const since = new Date(Date.now() - days * 86400000)
      const rows = await db
        .select({ name: orderItems.name, qty: sql<number>`sum(${orderItems.quantity})`.as('qty') })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(and(eq(orders.restaurantId, ctx.restaurantId), gte(orders.createdAt, since), ne(orders.status, 'cancelled')))
        .groupBy(orderItems.name)
        .orderBy(desc(sql`qty`))
        .limit(10)
      return { days, items: rows.map((r) => ({ name: r.name, quantity: Number(r.qty) })) }
    },
  },

  // ---- ORDINI ----
  {
    name: 'list_active_orders',
    scope: 'staff',
    description: 'Ordini attivi adesso (non serviti, non pagati, non annullati) con tavolo e totale.',
    inputSchema: { type: 'object', properties: {} },
    handler: async (_input, ctx) => {
      const rows = await db.select().from(orders)
        .where(and(eq(orders.restaurantId, ctx.restaurantId), inArray(orders.status, ['pending', 'confirmed', 'preparing', 'ready'])))
        .orderBy(asc(orders.createdAt))
      return { count: rows.length, orders: rows.map((o) => ({ id: o.id, table: o.tableNumber, status: o.status, total: o.total })) }
    },
  },
  {
    name: 'cancel_order',
    scope: 'staff',
    description: 'Annulla un ordine. Richiede conferma: chiama con confirm=false per anteprima, poi confirm=true.',
    requiresConfirmation: true,
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      required: ['orderId'],
    },
    handler: async (input, ctx) => {
      const [order] = await db.select().from(orders)
        .where(and(eq(orders.id, input['orderId'] as string), eq(orders.restaurantId, ctx.restaurantId))).limit(1)
      if (!order) return { ok: false, reason: 'not_found' }
      if (input['confirm'] !== true) return { ok: false, needsConfirmation: true, preview: { table: order.tableNumber, total: order.total, status: order.status } }
      await db.update(orders).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(orders.id, order.id))
      io.to(`restaurant:${ctx.restaurantId}`).emit('order:updated', { orderId: order.id, status: 'cancelled' })
      return { ok: true, orderId: order.id }
    },
  },

  // ---- MENU ----
  {
    name: 'list_menu',
    scope: 'staff',
    description: 'Elenca le sezioni del menu con i piatti (nome, prezzo, disponibile).',
    inputSchema: { type: 'object', properties: {} },
    handler: async (_input, ctx) => {
      const secs = await db.select().from(menuSections)
        .innerJoin(menus, eq(menus.id, menuSections.menuId))
        .where(eq(menus.restaurantId, ctx.restaurantId)).orderBy(asc(menuSections.position))
      const items = await db.select().from(menuItems)
        .where(eq(menuItems.restaurantId, ctx.restaurantId)).orderBy(asc(menuItems.position))
      return {
        sections: secs.map((s) => ({
          id: s.menu_sections.id,
          name: s.menu_sections.name,
          items: items.filter((i) => i.sectionId === s.menu_sections.id).map((i) => ({ id: i.id, name: i.name, price: i.price, available: i.available })),
        })),
      }
    },
  },
  {
    name: 'create_menu_item',
    scope: 'owner',
    description: "Crea un nuovo piatto. Indica nome, prezzo e la sezione (nome). Richiede conferma (confirm=false per anteprima, poi confirm=true).",
    requiresConfirmation: true,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        price: { type: 'number' },
        sectionName: { type: 'string', description: 'Nome della sezione in cui inserirlo' },
        description: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      required: ['name', 'price', 'sectionName'],
    },
    handler: async (input, ctx) => {
      const sectionName = (input['sectionName'] as string).toLowerCase()
      const secs = await db.select().from(menuSections)
        .innerJoin(menus, eq(menus.id, menuSections.menuId))
        .where(eq(menus.restaurantId, ctx.restaurantId))
      const sec = secs.find((s) => s.menu_sections.name.toLowerCase().includes(sectionName))
      if (!sec) return { ok: false, reason: 'section_not_found', available: secs.map((s) => s.menu_sections.name) }
      const price = euro(input['price'] as number)
      if (input['confirm'] !== true) {
        return { ok: false, needsConfirmation: true, preview: { name: input['name'], price, section: sec.menu_sections.name } }
      }
      const [item] = await db.insert(menuItems).values({
        sectionId: sec.menu_sections.id,
        restaurantId: ctx.restaurantId,
        name: input['name'] as string,
        description: (input['description'] as string) ?? null,
        price,
        available: true,
      }).returning()
      return { ok: true, id: item!.id, name: item!.name, price }
    },
  },
  {
    name: 'update_item_price',
    scope: 'owner',
    description: 'Cambia il prezzo di un piatto (per nome). Richiede conferma (confirm=false anteprima, poi confirm=true).',
    requiresConfirmation: true,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        price: { type: 'number' },
        confirm: { type: 'boolean' },
      },
      required: ['name', 'price'],
    },
    handler: async (input, ctx) => {
      const items = await db.select().from(menuItems).where(eq(menuItems.restaurantId, ctx.restaurantId))
      const it = items.find((i) => i.name.toLowerCase().includes((input['name'] as string).toLowerCase()))
      if (!it) return { ok: false, reason: 'not_found' }
      const price = euro(input['price'] as number)
      if (input['confirm'] !== true) return { ok: false, needsConfirmation: true, preview: { name: it.name, from: it.price, to: price } }
      await db.update(menuItems).set({ price, updatedAt: new Date() }).where(eq(menuItems.id, it.id))
      return { ok: true, name: it.name, price }
    },
  },
  {
    name: 'set_item_availability',
    scope: 'staff',
    description: 'Mette un piatto "86" (esaurito) o lo rende di nuovo disponibile. available=false per esaurito. Richiede conferma.',
    requiresConfirmation: true,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        available: { type: 'boolean' },
        confirm: { type: 'boolean' },
      },
      required: ['name', 'available'],
    },
    handler: async (input, ctx) => {
      const items = await db.select().from(menuItems).where(eq(menuItems.restaurantId, ctx.restaurantId))
      const it = items.find((i) => i.name.toLowerCase().includes((input['name'] as string).toLowerCase()))
      if (!it) return { ok: false, reason: 'not_found' }
      const available = Boolean(input['available'])
      if (input['confirm'] !== true) return { ok: false, needsConfirmation: true, preview: { name: it.name, available } }
      await db.update(menuItems).set({ available, updatedAt: new Date() }).where(eq(menuItems.id, it.id))
      return { ok: true, name: it.name, available }
    },
  },

  // ---- MAGAZZINO ----
  {
    name: 'low_stock',
    scope: 'staff',
    description: 'Articoli di magazzino sotto la soglia minima.',
    inputSchema: { type: 'object', properties: {} },
    handler: async (_input, ctx) => {
      const rows = await db.select().from(inventoryItems)
        .where(and(eq(inventoryItems.restaurantId, ctx.restaurantId), eq(inventoryItems.active, true)))
      const low = rows.filter((r) => r.quantity <= r.minQuantity)
      return { count: low.length, items: low.map((r) => ({ name: r.name, quantity: r.quantity, min: r.minQuantity, unit: r.unit })) }
    },
  },

  // ---- STAFF ----
  {
    name: 'list_staff',
    scope: 'owner',
    description: 'Elenca il personale del ristorante (nome, ruolo, attivo).',
    inputSchema: { type: 'object', properties: {} },
    handler: async (_input, ctx) => {
      const rows = await db.select().from(users).where(eq(users.restaurantId, ctx.restaurantId))
      return { staff: rows.map((u) => ({ name: u.name, role: u.role, active: u.active })) }
    },
  },
  {
    name: 'add_staff',
    scope: 'owner',
    description: "Aggiunge un membro dello staff. role: owner|dipendente|chef|cassiere. Richiede conferma.",
    requiresConfirmation: true,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        role: { type: 'string', enum: ['owner', 'dipendente', 'chef', 'cassiere'] },
        pin: { type: 'string', description: 'PIN a 4 cifre (opzionale)' },
        confirm: { type: 'boolean' },
      },
      required: ['name', 'email', 'role'],
    },
    handler: async (input, ctx) => {
      const role = input['role'] as 'owner' | 'dipendente' | 'chef' | 'cassiere'
      if (input['confirm'] !== true) return { ok: false, needsConfirmation: true, preview: { name: input['name'], email: input['email'], role } }
      const pin = input['pin'] as string | undefined
      const [u] = await db.insert(users).values({
        restaurantId: ctx.restaurantId,
        name: input['name'] as string,
        email: input['email'] as string,
        role,
        pin: pin ? await bcrypt.hash(pin, 10) : null,
      }).returning()
      return { ok: true, id: u!.id, name: u!.name, role: u!.role }
    },
  },
]
