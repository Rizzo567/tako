import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, bills, billPayments, orders, tables } from '@tako/db'
import { eq, and, inArray, gte, desc } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { io } from '../index.js'
import { round2, BILLABLE_STATUSES } from '../lib/billing.js'

export async function billRoutes(fastify: FastifyInstance) {
  // Get open bills
  fastify.get('/open', { preHandler: requireAuth }, async (req) => {
    const open = await db.select().from(bills).where(and(eq(bills.restaurantId, req.user!.restaurantId), eq(bills.status, 'open'))).orderBy(desc(bills.createdAt))
    return { data: open }
  })

  // Create bill for table
  fastify.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({
      tableId: z.string().uuid().optional(),
      tableNumber: z.string().optional(),
      covers: z.number().int().min(1).default(1),
      discount: z.number().min(0).default(0),       // niente sconti negativi
      discountNote: z.string().max(500).optional(),
      tip: z.number().min(0).default(0),            // niente mance negative
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    // Se arriva solo il NUMERO del tavolo (es. "Nuovo conto" dalla cassa), risolvi
    // il tableId reale: senza di esso il subtotale resterebbe a 0.
    if (!body.data.tableId && body.data.tableNumber) {
      const [t] = await db.select({ id: tables.id }).from(tables)
        .where(and(eq(tables.restaurantId, req.user!.restaurantId), eq(tables.number, body.data.tableNumber))).limit(1)
      if (!t) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tavolo non trovato' } })
      body.data.tableId = t.id
    }

    // Calculate subtotal from billable orders on this table
    let subtotal = 0
    if (body.data.tableId) {
      // Anti cross-tenant: il tavolo deve appartenere al ristorante dell'utente.
      const [table] = await db.select({ id: tables.id }).from(tables)
        .where(and(eq(tables.id, body.data.tableId), eq(tables.restaurantId, req.user!.restaurantId))).limit(1)
      if (!table) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Table not found' } })

      // Idempotenza: se esiste già un conto aperto per il tavolo, ritornalo
      // invece di crearne un secondo (evita conti fantasma sullo stesso tavolo).
      const [existing] = await db.select().from(bills).where(and(
        eq(bills.restaurantId, req.user!.restaurantId), eq(bills.tableId, body.data.tableId), eq(bills.status, 'open'),
      )).limit(1)
      if (existing) return reply.code(200).send({ data: existing })

      const tableOrders = await db.select({ total: orders.total }).from(orders).where(and(
        eq(orders.tableId, body.data.tableId),
        eq(orders.restaurantId, req.user!.restaurantId),
        inArray(orders.status, [...BILLABLE_STATUSES]),
      ))
      subtotal = round2(tableOrders.reduce((sum, o) => sum + o.total, 0))
    }

    // Lo sconto non può superare il subtotale (totale mai negativo).
    const discount = Math.min(body.data.discount ?? 0, subtotal)
    const total = round2(subtotal - discount + (body.data.tip ?? 0))

    const [bill] = await db.insert(bills).values({
      restaurantId: req.user!.restaurantId,
      ...body.data,
      discount,
      subtotal,
      total,
    }).returning()

    return reply.code(201).send({ data: bill })
  })

  // Aggiorna sconto / mancia di un conto aperto (ricalcola il totale)
  fastify.patch('/:billId', { preHandler: requireAuth }, async (req, reply) => {
    const { billId } = req.params as { billId: string }
    const schema = z.object({
      discount: z.number().min(0).optional(),
      discountNote: z.string().max(500).optional(),
      tip: z.number().min(0).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const [bill] = await db.select().from(bills)
      .where(and(eq(bills.id, billId), eq(bills.restaurantId, req.user!.restaurantId))).limit(1)
    if (!bill) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Bill not found' } })

    const discount = Math.min(body.data.discount ?? bill.discount ?? 0, bill.subtotal)
    const tip = body.data.tip ?? bill.tip ?? 0
    const total = round2(bill.subtotal - discount + tip)
    const [updated] = await db.update(bills)
      .set({ discount, tip, discountNote: body.data.discountNote ?? bill.discountNote, total })
      .where(eq(bills.id, billId)).returning()

    return { data: updated }
  })

  // Add payment to bill
  fastify.post('/:billId/payments', { preHandler: requireAuth }, async (req, reply) => {
    const { billId } = req.params as { billId: string }
    const schema = z.object({
      amount: z.number().positive(),
      method: z.enum(['cash', 'card', 'digital', 'split']),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    // Verify bill belongs to this restaurant before accepting payment
    const [bill] = await db.select().from(bills).where(and(eq(bills.id, billId), eq(bills.restaurantId, req.user!.restaurantId))).limit(1)
    if (!bill) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Bill not found' } })
    // Non accettare pagamenti su un conto già chiuso/annullato: ri-processarlo
    // ri-eseguirebbe la chiusura (tavolo→cleaning, ordini→served) e gonfierebbe i pagamenti.
    if (bill.status !== 'open') return reply.code(409).send({ error: { code: 'BILL_NOT_OPEN', message: 'Il conto non è aperto.' } })

    const [payment] = await db.insert(billPayments).values({ billId, ...body.data, status: 'completed' }).returning()

    // Check if bill is fully paid (confronto a centesimi: niente derive float)
    const allPayments = await db.select().from(billPayments).where(eq(billPayments.billId, billId))
    const paidTotal = round2(allPayments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0))

    if (paidTotal >= round2(bill.total)) {
      await db.update(bills).set({ status: 'closed', closedAt: new Date(), closedBy: req.user!.id }).where(eq(bills.id, billId))
      // Free the table
      if (bill.tableId) {
        await db.update(tables).set({ status: 'cleaning', openedAt: null }).where(eq(tables.id, bill.tableId))
        io.to(`restaurant:${req.user!.restaurantId}`).emit('table:updated', { tableId: bill.tableId, status: 'cleaning' })
      }
      // Auto-cascade: tutti gli ordini attivi del tavolo → served
      if (bill.tableId) {
        const activeOrders = await db
          .select({ id: orders.id })
          .from(orders)
          .where(and(
            eq(orders.tableId, bill.tableId),
            inArray(orders.status, ['pending', 'confirmed', 'preparing', 'ready'])
          ))

        if (activeOrders.length > 0) {
          const servedAt = new Date()
          for (const order of activeOrders) {
            await db.update(orders)
              .set({ status: 'served', servedAt })
              .where(eq(orders.id, order.id))
            io.to(`restaurant:${req.user!.restaurantId}`).emit('order:updated', { orderId: order.id, status: 'served' })
            if (bill.tableId) io.to(`table:${bill.tableId}`).emit('order:updated', { orderId: order.id, status: 'served' })
          }
        }
      }
    }

    return reply.code(201).send({ data: payment })
  })

  // Get bill with payments
  fastify.get('/:billId', { preHandler: requireAuth }, async (req, reply) => {
    const { billId } = req.params as { billId: string }
    const [bill] = await db.select().from(bills).where(and(eq(bills.id, billId), eq(bills.restaurantId, req.user!.restaurantId))).limit(1)
    if (!bill) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Bill not found' } })
    const payments = await db.select().from(billPayments).where(eq(billPayments.billId, billId))
    return { data: { ...bill, payments } }
  })

  // Today summary
  fastify.get('/summary/today', { preHandler: requireAuth }, async (req) => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const closed = await db.select().from(bills).where(and(eq(bills.restaurantId, req.user!.restaurantId), eq(bills.status, 'closed'), gte(bills.closedAt!, start)))
    const revenue = closed.reduce((s, b) => s + b.total, 0)
    const tips = closed.reduce((s, b) => s + (b.tip ?? 0), 0)
    return { data: { revenue, tips, billsCount: closed.length, avgTicket: closed.length ? revenue / closed.length : 0 } }
  })
}
