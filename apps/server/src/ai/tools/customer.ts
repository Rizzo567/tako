import { db, menuItems, menuSections, menus, orders, orderItems, restaurants, tableSessions } from '@tako/db'
import { and, eq, asc, desc, isNull, ilike, or } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { io } from '../../index.js'
import type { ToolDef, ToolContext } from '../registry.js'

// Load available menu items for a restaurant (priced from DB — never the client).
async function loadItems(restaurantId: string) {
  return db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.restaurantId, restaurantId), eq(menuItems.available, true)))
    .orderBy(asc(menuItems.position))
}

function fmtItem(i: typeof menuItems.$inferSelect) {
  return {
    id: i.id,
    name: i.name,
    price: i.price,
    description: i.description ?? undefined,
    allergens: i.allergens ?? [],
    tags: i.tags ?? [],
  }
}

export const customerTools: ToolDef[] = [
  {
    name: 'search_menu',
    scope: 'customer',
    description:
      'Cerca piatti nel menu del ristorante per nome, tag o parola chiave (es. "vegano", "pizza", "senza glutine"). Lascia query vuota per avere tutto il menu.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Parola chiave da cercare (opzionale)' },
        excludeAllergens: {
          type: 'array',
          items: { type: 'string' },
          description: 'Allergeni da escludere (es. ["glutine","latte"])',
        },
      },
    },
    handler: async (input, ctx: ToolContext) => {
      const q = (input['query'] as string | undefined)?.toLowerCase().trim()
      const exclude = (input['excludeAllergens'] as string[] | undefined)?.map((a) => a.toLowerCase()) ?? []
      let items = await loadItems(ctx.restaurantId)
      if (q) {
        items = items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.description ?? '').toLowerCase().includes(q) ||
            (i.tags ?? []).some((t) => t.toLowerCase().includes(q)),
        )
      }
      if (exclude.length) {
        items = items.filter((i) => !(i.allergens ?? []).some((a) => exclude.includes(a.toLowerCase())))
      }
      return { count: items.length, items: items.slice(0, 20).map(fmtItem) }
    },
  },
  {
    name: 'get_item',
    scope: 'customer',
    description: 'Dettagli completi di un piatto: descrizione, prezzo, allergeni, tag. Passa il nome del piatto.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Nome del piatto' } },
      required: ['name'],
    },
    handler: async (input, ctx) => {
      const name = (input['name'] as string).toLowerCase()
      const items = await loadItems(ctx.restaurantId)
      const found = items.find((i) => i.name.toLowerCase().includes(name))
      if (!found) return { found: false }
      return { found: true, item: fmtItem(found) }
    },
  },
  {
    name: 'recommend_dishes',
    scope: 'customer',
    description: 'Consiglia piatti del menu in base a una richiesta (es. "qualcosa di leggero", "il più ordinato", "un primo").',
    inputSchema: {
      type: 'object',
      properties: { preference: { type: 'string', description: 'Cosa cerca il cliente' } },
    },
    handler: async (_input, ctx) => {
      const items = await loadItems(ctx.restaurantId)
      const featured = items.filter((i) => i.featured)
      const pool = (featured.length ? featured : items).slice(0, 6)
      return { items: pool.map(fmtItem) }
    },
  },
  {
    name: 'add_to_cart',
    scope: 'customer',
    description:
      'Aggiunge piatti al carrello del cliente e ne mostra il riepilogo. Usa i nomi esatti dei piatti. NON invia l\'ordine.',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              quantity: { type: 'integer' },
              notes: { type: 'string' },
            },
            required: ['name', 'quantity'],
          },
        },
      },
      required: ['items'],
    },
    handler: async (input, ctx) => {
      const reqItems = (input['items'] as { name: string; quantity: number; notes?: string }[]) ?? []
      const menu = await loadItems(ctx.restaurantId)
      const lines: { menuItemId: string; name: string; quantity: number; unitPrice: number; notes?: string }[] = []
      const notFound: string[] = []
      for (const r of reqItems) {
        const m = menu.find((i) => i.name.toLowerCase() === r.name.toLowerCase()) ??
          menu.find((i) => i.name.toLowerCase().includes(r.name.toLowerCase()))
        if (!m) { notFound.push(r.name); continue }
        lines.push({ menuItemId: m.id, name: m.name, quantity: Math.max(1, r.quantity), unitPrice: m.price, notes: r.notes })
      }
      const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
      ctx.emit({ type: 'cart_add', lines })
      return { added: lines, notFound, total: Math.round(total * 100) / 100 }
    },
  },
  {
    name: 'place_order',
    scope: 'customer',
    description:
      'Invia l\'ordine in cucina. Chiama PRIMA con confirm=false per ottenere il riepilogo da mostrare al cliente; dopo il "sì" del cliente, richiama con confirm=true.',
    requiresConfirmation: true,
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              quantity: { type: 'integer' },
              notes: { type: 'string' },
            },
            required: ['name', 'quantity'],
          },
        },
        notes: { type: 'string', description: 'Note generali per la cucina' },
        confirm: { type: 'boolean', description: 'true solo dopo conferma esplicita del cliente' },
      },
      required: ['items'],
    },
    handler: async (input, ctx) => {
      const reqItems = (input['items'] as { name: string; quantity: number; notes?: string }[]) ?? []
      const menu = await loadItems(ctx.restaurantId)
      const lines: { menuItemId: string; name: string; quantity: number; unitPrice: number; notes?: string; kitchenStation: string | null }[] = []
      const notFound: string[] = []
      for (const r of reqItems) {
        const m = menu.find((i) => i.name.toLowerCase() === r.name.toLowerCase()) ??
          menu.find((i) => i.name.toLowerCase().includes(r.name.toLowerCase()))
        if (!m) { notFound.push(r.name); continue }
        lines.push({ menuItemId: m.id, name: m.name, quantity: Math.max(1, r.quantity), unitPrice: m.price, notes: r.notes, kitchenStation: m.kitchenStation })
      }
      const total = Math.round(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0) * 100) / 100
      if (notFound.length) return { ok: false, reason: 'items_not_found', notFound }
      if (!lines.length) return { ok: false, reason: 'empty' }

      if (input['confirm'] !== true) {
        return { ok: false, needsConfirmation: true, preview: { items: lines.map((l) => ({ name: l.name, quantity: l.quantity, unitPrice: l.unitPrice })), total } }
      }

      const [order] = await db.insert(orders).values({
        restaurantId: ctx.restaurantId,
        tableId: ctx.tableId ?? null,
        tableNumber: ctx.tableNumber ?? null,
        type: 'table',
        status: 'pending',
        total,
        notes: (input['notes'] as string) ?? null,
        idempotencyKey: nanoid(),
      }).returning()

      await db.insert(orderItems).values(
        lines.map((l) => ({
          orderId: order!.id,
          menuItemId: l.menuItemId,
          name: l.name,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          notes: l.notes ?? null,
          kitchenStation: l.kitchenStation,
          status: 'pending' as const,
        })),
      )

      // Notify staff/kitchen in real-time (same room convention as the rest of the app).
      io.to(`restaurant:${ctx.restaurantId}`).emit('order:new', {
        id: order!.id,
        tableId: order!.tableId,
        tableNumber: order!.tableNumber,
        type: 'table',
        status: 'pending',
        total,
        items: lines.map((l) => ({ name: l.name, quantity: l.quantity, unitPrice: l.unitPrice })),
        createdAt: order!.createdAt,
      })

      // Mark time-to-first-order on the active table session, if any.
      if (ctx.tableId) {
        const [s] = await db.select().from(tableSessions)
          .where(and(eq(tableSessions.tableId, ctx.tableId), isNull(tableSessions.firstOrderAt)))
          .orderBy(desc(tableSessions.scannedAt)).limit(1)
        if (s) {
          await db.update(tableSessions)
            .set({ firstOrderAt: new Date(), timeToFirstOrderSec: Math.round((Date.now() - s.scannedAt.getTime()) / 1000) })
            .where(eq(tableSessions.id, s.id))
        }
      }

      ctx.emit({ type: 'order_placed', orderId: order!.id, total })
      return { ok: true, orderId: order!.id, total }
    },
  },
  {
    name: 'order_status',
    scope: 'customer',
    description: 'Stato dell\'ultimo ordine del tavolo (ricevuto, in preparazione, pronto, servito).',
    inputSchema: { type: 'object', properties: {} },
    handler: async (_input, ctx) => {
      if (!ctx.tableId) return { found: false }
      const [order] = await db.select().from(orders)
        .where(and(eq(orders.restaurantId, ctx.restaurantId), eq(orders.tableId, ctx.tableId)))
        .orderBy(desc(orders.createdAt)).limit(1)
      if (!order) return { found: false }
      const labels: Record<string, string> = {
        pending: 'ricevuto', confirmed: 'confermato', preparing: 'in preparazione',
        ready: 'pronto', served: 'servito', paid: 'pagato', cancelled: 'annullato',
      }
      return { found: true, status: order.status, label: labels[order.status] ?? order.status, total: order.total }
    },
  },
  {
    name: 'call_waiter',
    scope: 'customer',
    description: 'Chiama il cameriere al tavolo. type: "help" (aiuto), "bill" (conto), "water" (acqua).',
    inputSchema: {
      type: 'object',
      properties: { type: { type: 'string', enum: ['help', 'bill', 'water'] } },
      required: ['type'],
    },
    handler: async (input, ctx) => {
      const type = (input['type'] as string) ?? 'help'
      io.to(`restaurant:${ctx.restaurantId}`).emit('waiter:called', {
        tableId: ctx.tableId, tableNumber: ctx.tableNumber, type,
      })
      ctx.emit({ type: 'waiter_called', call: type })
      return { ok: true }
    },
  },
]

// Silence unused-import noise (kept for future menu-section scoped tools).
void menuSections; void menus; void restaurants; void or; void ilike
