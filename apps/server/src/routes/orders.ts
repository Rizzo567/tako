import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, orders, orderItems, orderStatusHistory, menuItems, tables } from '@tako/db'
import { eq, and, inArray, desc, gte } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { io } from '../index.js'
import { recomputeOpenBill, round2, ensureOpenBill } from '../lib/billing.js'
import type { OrderStatus } from '@tako/types'

// Transizioni di stato ordine consentite. Impedisce di "resuscitare" ordini
// pagati/annullati o di mandarli indietro in modo incoerente.
// Si può sempre AVANZARE nel flusso (lo staff può saltare passaggi: es. "Segna
// servito" da confermato, "Bump · Pronto" da attesa) e annullare se non pagato.
// Indietro o resuscitare un ordine pagato/annullato resta vietato.
const ALLOWED_TRANSITIONS: Record<string, OrderStatus[]> = {
  pending: ['confirmed', 'preparing', 'ready', 'served', 'cancelled'],
  confirmed: ['preparing', 'ready', 'served', 'cancelled'],
  preparing: ['ready', 'served', 'cancelled'],
  ready: ['served', 'cancelled'],
  // served→paid NON è una transizione manuale: portare 'paid' qui escluderebbe
  // l'ordine da BILLABLE_STATUSES senza registrare alcun pagamento (frode). Il
  // passaggio a 'paid' avviene solo nel flusso pagamenti (bills.ts /payments).
  served: [],
  paid: [],
  cancelled: [],
}

export async function orderRoutes(fastify: FastifyInstance) {
  // Get active orders for restaurant
  fastify.get('/active', { preHandler: requireAuth }, async (req) => {
    const activeOrders = await db
      .select()
      .from(orders)
      .where(and(
        eq(orders.restaurantId, req.user!.restaurantId),
        inArray(orders.status, ['pending', 'confirmed', 'preparing', 'ready']),
      ))
      .orderBy(desc(orders.createdAt))

    const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, activeOrders.map(o => o.id)))
    return { data: activeOrders.map(o => ({ ...o, items: items.filter(i => i.orderId === o.id) })) }
  })

  // Get orders by table
  fastify.get('/table/:tableId', { preHandler: requireAuth }, async (req) => {
    const { tableId } = req.params as { tableId: string }
    const tableOrders = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tableId, tableId), eq(orders.restaurantId, req.user!.restaurantId)))
      .orderBy(desc(orders.createdAt))

    const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, tableOrders.map(o => o.id)))
    return { data: tableOrders.map(o => ({ ...o, items: items.filter(i => i.orderId === o.id) })) }
  })

  // Get order history (today)
  fastify.get('/history', { preHandler: requireAuth }, async (req) => {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const hist = await db
      .select()
      .from(orders)
      .where(and(eq(orders.restaurantId, req.user!.restaurantId), gte(orders.createdAt, startOfDay)))
      .orderBy(desc(orders.createdAt))

    return { data: hist }
  })

  // Create order (staff — comanda). Prezzi sempre dal DB, mai dal client.
  fastify.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({
      tableId: z.string().uuid().optional(),
      // La SPA cassa invia tableNumber come Number → coerce a stringa (evita 400).
      tableNumber: z.coerce.string().optional(),
      type: z.enum(['table', 'takeaway']).default('table'),
      items: z.array(z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().positive().max(20),
        notes: z.string().max(500).optional(),
      })).min(1),
      notes: z.string().max(1000).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    const restaurantId = req.user!.restaurantId

    const ids = body.data.items.map(i => i.menuItemId)
    const dbItems = await db.select().from(menuItems).where(and(eq(menuItems.restaurantId, restaurantId), inArray(menuItems.id, ids)))
    const missing = body.data.items.filter(i => !dbItems.find(d => d.id === i.menuItemId))
    if (missing.length) return reply.code(409).send({ error: { code: 'ITEM_UNAVAILABLE', message: 'Alcuni piatti non esistono.' } })

    let total = 0
    const resolved = body.data.items.map(oi => {
      const d = dbItems.find(x => x.id === oi.menuItemId)!
      const unitPrice = round2(d.price)
      total = round2(total + unitPrice * oi.quantity)
      return { ...oi, name: d.name, unitPrice, kitchenStation: d.kitchenStation }
    })

    let tableNumber = body.data.tableNumber ?? null
    if (body.data.tableId) {
      const [t] = await db.select().from(tables).where(and(eq(tables.id, body.data.tableId), eq(tables.restaurantId, restaurantId))).limit(1)
      if (!t) return reply.code(404).send({ error: { code: 'TABLE_NOT_FOUND', message: 'Tavolo non trovato.' } })
      tableNumber = t.number
    }

    const [order] = await db.insert(orders).values({
      restaurantId, tableId: body.data.tableId, tableNumber, type: body.data.type,
      status: 'pending', total, notes: body.data.notes,
      idempotencyKey: `staff-${restaurantId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }).returning()
    if (!order) return reply.code(500).send({ error: { code: 'DB', message: 'Creazione ordine fallita.' } })

    const insertedItems = await db.insert(orderItems).values(
      resolved.map(i => ({ orderId: order.id, menuItemId: i.menuItemId, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, notes: i.notes, kitchenStation: i.kitchenStation ?? null, status: 'pending' as const }))
    ).returning()

    const payload = { ...order, items: insertedItems }
    io.to(`restaurant:${restaurantId}`).emit('order:new', payload)

    if (body.data.tableId) {
      await db.update(tables).set({ status: 'occupied', openedAt: new Date() }).where(eq(tables.id, body.data.tableId))
      io.to(`restaurant:${restaurantId}`).emit('table:updated', { tableId: body.data.tableId, status: 'occupied' })
      await ensureOpenBill(restaurantId, body.data.tableId)
    }

    return reply.code(201).send({ data: payload })
  })

  // Update order status
  fastify.patch('/:orderId/status', { preHandler: requireAuth }, async (req, reply) => {
    const { orderId } = req.params as { orderId: string }
    const bodySchema = z.object({ status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'served', 'paid', 'cancelled']) })
    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    const { status } = parsed.data as { status: OrderStatus }

    const [current] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.restaurantId, req.user!.restaurantId))).limit(1)
    if (!current) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Ordine non trovato' } })

    // Guardia transizioni: niente salti incoerenti o ordini pagati/annullati riaperti.
    if (status !== current.status && !(ALLOWED_TRANSITIONS[current.status] ?? []).includes(status)) {
      return reply.code(409).send({ error: { code: 'INVALID_TRANSITION', message: `Transizione ${current.status} → ${status} non consentita.` } })
    }

    const updateData: Partial<typeof current> & { updatedAt: Date; servedAt?: Date; paidAt?: Date } = { status, updatedAt: new Date() }
    if (status === 'served') updateData.servedAt = new Date()
    if (status === 'paid') updateData.paidAt = new Date()

    // Guardia di concorrenza: aggiorna SOLO se lo stato è ancora quello letto. Due
    // PATCH concorrenti che leggono lo stesso stato non passano entrambe: la seconda
    // trova rowcount 0 → 409 (niente doppia transizione/incasso).
    const [updated] = await db.update(orders).set(updateData)
      .where(and(eq(orders.id, orderId), eq(orders.restaurantId, req.user!.restaurantId), eq(orders.status, current.status)))
      .returning()
    if (!updated) return reply.code(409).send({ error: { code: 'INVALID_TRANSITION', message: 'Lo stato dell\'ordine è cambiato, riprova.' } })

    await db.insert(orderStatusHistory).values({
      orderId,
      fromStatus: current.status,
      toStatus: status,
      changedBy: req.user!.id,
    })

    // Annullamento via /status: il conto deve scendere come nella route /cancel.
    if (status === 'cancelled' && current.tableId) {
      await recomputeOpenBill(req.user!.restaurantId, current.tableId)
    }

    // Broadcast to all connected clients in this restaurant
    io.to(`restaurant:${req.user!.restaurantId}`).emit('order:updated', { orderId, status })

    // Notify customer if at table
    if (current.tableId) {
      io.to(`table:${current.tableId}`).emit('order:updated', { orderId, status })
    }

    return { data: updated }
  })

  // Update single order item status (for KDS bump)
  fastify.patch('/:orderId/items/:itemId/status', { preHandler: requireAuth }, async (req, reply) => {
    const { orderId, itemId } = req.params as { orderId: string; itemId: string }
    const bodySchema = z.object({ status: z.enum(['pending', 'preparing', 'ready', 'served']) })
    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    const { status } = parsed.data

    // Verify the order belongs to this restaurant before updating its items
    const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.restaurantId, req.user!.restaurantId))).limit(1)
    if (!order) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Ordine non trovato' } })
    // Il bump di una portata non deve "resuscitare" un ordine pagato/annullato
    // riscrivendone lo stato derivato (frode/incoerenza).
    if (order.status === 'paid' || order.status === 'cancelled') {
      return reply.code(409).send({ error: { code: 'INVALID_TRANSITION', message: `Ordine ${order.status}: non modificabile.` } })
    }

    const [item] = await db.update(orderItems).set({ status }).where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId))).returning()
    if (!item) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Voce non trovata' } })

    // Derive order-level status from all items
    const allItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))

    let derivedStatus: string
    if (allItems.every(i => i.status === 'served')) derivedStatus = 'served'
    else if (allItems.every(i => i.status === 'ready' || i.status === 'served')) derivedStatus = 'ready'
    else if (allItems.some(i => i.status === 'preparing' || i.status === 'ready')) derivedStatus = 'preparing'
    else derivedStatus = 'pending'

    await db.update(orders).set({ status: derivedStatus as any, updatedAt: new Date() }).where(eq(orders.id, orderId))

    io.to(`restaurant:${req.user!.restaurantId}`).emit('order:updated', { orderId, itemId, itemStatus: status, status: derivedStatus })
    // Anche al tavolo del cliente: il tracking riflette lo stato derivato quando
    // la cucina avanza le singole portate (non solo sul cambio stato globale).
    if (order.tableId) {
      io.to(`table:${order.tableId}`).emit('order:updated', { orderId, status: derivedStatus })
    }
    return { data: { item, orderStatus: derivedStatus } }
  })

  // Cancel order
  fastify.patch('/:orderId/cancel', { preHandler: requireAuth }, async (req, reply) => {
    const { orderId } = req.params as { orderId: string }
    const [current] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.restaurantId, req.user!.restaurantId))).limit(1)
    if (!current) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Ordine non trovato' } })
    // Non si annulla un ordine già pagato (falserebbe incassi/served).
    if (current.status === 'paid') return reply.code(409).send({ error: { code: 'INVALID_TRANSITION', message: 'Un ordine pagato non può essere annullato.' } })
    if (current.status === 'cancelled') return { data: current }

    const [updated] = await db.update(orders).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(orders.id, orderId), eq(orders.restaurantId, req.user!.restaurantId))).returning()
    // Il conto deve scendere: ricalcola il bill aperto del tavolo escludendo l'annullato.
    if (updated!.tableId) await recomputeOpenBill(req.user!.restaurantId, updated!.tableId)
    io.to(`restaurant:${req.user!.restaurantId}`).emit('order:updated', { orderId, status: 'cancelled' })
    // Avvisa anche il cliente al tavolo: il tracking riflette l'annullamento.
    if (updated!.tableId) io.to(`table:${updated!.tableId}`).emit('order:updated', { orderId, status: 'cancelled' })
    return { data: updated }
  })
}
