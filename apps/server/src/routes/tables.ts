import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { db, tables, rooms, bills, orders } from '@tako/db'
import { eq, and, inArray } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { io } from '../index.js'
import { stableTableUrl, lanTableUrl } from '../lib/network.js'
import { getApplianceId } from '../lib/cloud-client.js'
import { qrWithOctopus } from '../lib/qr-octopus.js'
import { BILLABLE_STATUSES } from '../lib/billing.js'

export async function tableRoutes(fastify: FastifyInstance) {
  // Get all rooms with tables
  fastify.get('/rooms', { preHandler: requireAuth }, async (req) => {
    const allRooms = await db.select().from(rooms).where(and(eq(rooms.restaurantId, req.user!.restaurantId), eq(rooms.active, true)))
    const allTables = await db.select().from(tables).where(and(eq(tables.restaurantId, req.user!.restaurantId), eq(tables.active, true)))
    return { data: allRooms.map(r => ({ ...r, tables: allTables.filter(t => t.roomId === r.id) })) }
  })

  // Get all tables flat
  fastify.get('/', { preHandler: requireAuth }, async (req) => {
    const all = await db.select().from(tables).where(and(eq(tables.restaurantId, req.user!.restaurantId), eq(tables.active, true)))
    return { data: all }
  })

  // Create room
  fastify.post('/rooms', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({ name: z.string().min(1) })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    const [room] = await db.insert(rooms).values({ restaurantId: req.user!.restaurantId, name: body.data.name }).returning()
    return reply.code(201).send({ data: room })
  })

  // Create table
  fastify.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({
      number: z.string().min(1),
      seats: z.number().default(4),
      roomId: z.string().uuid().optional(),
      shape: z.enum(['round', 'square', 'rectangle']).default('square'),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    // Anti cross-tenant: una room indicata deve appartenere al ristorante dell'utente.
    if (body.data.roomId) {
      const [room] = await db.select({ id: rooms.id }).from(rooms)
        .where(and(eq(rooms.id, body.data.roomId), eq(rooms.restaurantId, req.user!.restaurantId))).limit(1)
      if (!room) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Sala non trovata' } })
    }

    const qrToken = nanoid(24)
    const [table] = await db.insert(tables).values({ restaurantId: req.user!.restaurantId, qrToken, ...body.data }).returning()
    // Notifica gli altri dispositivi (Sala/Gestione Tavoli fanno refetch su 'table:updated').
    io.to(`restaurant:${req.user!.restaurantId}`).emit('table:updated', { tableId: table?.id ?? null })
    return reply.code(201).send({ data: table })
  })

  // Update table (number, seats, roomId, shape)
  fastify.patch('/:tableId', { preHandler: requireAuth }, async (req, reply) => {
    const { tableId } = req.params as { tableId: string }
    const schema = z.object({
      number: z.string().min(1).optional(),
      seats: z.number().int().min(1).optional(),
      roomId: z.string().uuid().nullable().optional(),
      shape: z.enum(['round', 'square', 'rectangle']).optional(),
      posX: z.number().min(0).max(100).nullable().optional(),   // posizione mappa sala (%); null = tolto dalla pianta (vassoio)
      posY: z.number().min(0).max(100).nullable().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })

    // Anti cross-tenant: una room indicata (non-null) deve appartenere al ristorante.
    // roomId === null (scollegamento) e undefined (campo non toccato) restano consentiti.
    if (parsed.data.roomId) {
      const [room] = await db.select({ id: rooms.id }).from(rooms)
        .where(and(eq(rooms.id, parsed.data.roomId), eq(rooms.restaurantId, req.user!.restaurantId))).limit(1)
      if (!room) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Sala non trovata' } })
    }

    const updates: Record<string, unknown> = {}
    if (parsed.data.number !== undefined) updates['number'] = parsed.data.number
    if (parsed.data.seats !== undefined) updates['seats'] = parsed.data.seats
    if (parsed.data.roomId !== undefined) updates['roomId'] = parsed.data.roomId
    if (parsed.data.shape !== undefined) updates['shape'] = parsed.data.shape
    if (parsed.data.posX !== undefined) updates['posX'] = parsed.data.posX
    if (parsed.data.posY !== undefined) updates['posY'] = parsed.data.posY

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'No fields to update' } })
    }

    const [table] = await db.update(tables).set(updates).where(and(eq(tables.id, tableId), eq(tables.restaurantId, req.user!.restaurantId))).returning()
    if (!table) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tavolo non trovato' } })
    // B2: la mappa sala deve aggiornarsi live su tutti i device staff quando cambia
    // la posizione di un tavolo (drag&drop).
    if (parsed.data.posX !== undefined || parsed.data.posY !== undefined) {
      io.to(`restaurant:${req.user!.restaurantId}`).emit('table:updated', { tableId, posX: table.posX, posY: table.posY })
    }
    return { data: table }
  })

  // Update table status
  fastify.patch('/:tableId/status', { preHandler: requireAuth }, async (req, reply) => {
    const { tableId } = req.params as { tableId: string }
    const bodySchema = z.object({ status: z.enum(['free', 'occupied', 'waiting', 'cleaning', 'reserved']) })
    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    const { status } = parsed.data

    // M7: non liberare/ripulire un tavolo che ha ancora un conto aperto o ordini
    // fatturabili — prima si incassa o si annulla (altrimenti si perde traccia del conto).
    if (status === 'free' || status === 'cleaning') {
      const [openBill] = await db.select({ id: bills.id }).from(bills)
        .where(and(eq(bills.restaurantId, req.user!.restaurantId), eq(bills.tableId, tableId), eq(bills.status, 'open'))).limit(1)
      let blocked = !!openBill
      if (!blocked) {
        const [ord] = await db.select({ id: orders.id }).from(orders)
          .where(and(eq(orders.restaurantId, req.user!.restaurantId), eq(orders.tableId, tableId), inArray(orders.status, [...BILLABLE_STATUSES]))).limit(1)
        blocked = !!ord
      }
      if (blocked) return reply.code(409).send({ error: { code: 'TABLE_HAS_OPEN_BILL', message: 'Il tavolo ha un conto aperto: incassa o annulla prima di liberarlo.' } })
    }

    const [table] = await db.update(tables).set({
      status,
      openedAt: status === 'occupied' ? new Date() : status === 'free' ? null : undefined,
    }).where(and(eq(tables.id, tableId), eq(tables.restaurantId, req.user!.restaurantId))).returning()

    if (!table) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tavolo non trovato' } })

    io.to(`restaurant:${req.user!.restaurantId}`).emit('table:updated', { tableId, status })
    return { data: table }
  })

  // Risolvi una chiamata cameriere: lo staff la segna come gestita e l'evento
  // waiter:resolved sincronizza TUTTI i device staff (il badge sparisce ovunque).
  // Le chiamate non sono persistite: è una pura sincronizzazione real-time.
  fastify.post('/:tableId/waiter-resolve', { preHandler: requireAuth }, async (req, reply) => {
    const { tableId } = req.params as { tableId: string }
    // SECURITY: il tavolo deve appartenere al ristorante dello staff.
    const [table] = await db.select().from(tables).where(and(eq(tables.id, tableId), eq(tables.restaurantId, req.user!.restaurantId))).limit(1)
    if (!table) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tavolo non trovato' } })
    io.to(`restaurant:${req.user!.restaurantId}`).emit('waiter:resolved', { tableId })
    return { data: { success: true } }
  })

  // Get QR code as base64 PNG
  fastify.get('/:tableId/qr', { preHandler: requireAuth }, async (req, reply) => {
    const { tableId } = req.params as { tableId: string }
    const [table] = await db.select().from(tables).where(and(eq(tables.id, tableId), eq(tables.restaurantId, req.user!.restaurantId))).limit(1)
    if (!table) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tavolo non trovato' } })

    // URL STABILE (mai l'IP): se l'appliance è accoppiata, punta al resolver cloud
    // /t/<applianceId>/... che reindirizza all'IP LAN corrente. `lanUrl` è il QR di BACKUP
    // mDNS (tako.local) per l'accesso offline-first col cloud giù. Vedi lib/network.ts.
    // Il rendering resta qrWithOctopus (mascotte al centro, error correction H).
    const url = stableTableUrl(getApplianceId(), req.user!.restaurantId, table.qrToken)
    const lanUrl = lanTableUrl(req.user!.restaurantId, table.qrToken)
    const qrDataUrl = await qrWithOctopus(url, 400)
    return { data: { qrDataUrl, url, lanUrl, tableNumber: table.number } }
  })

  // Refresh QR token (invalidates old)
  fastify.post('/:tableId/qr/refresh', { preHandler: requireAuth }, async (req, reply) => {
    const { tableId } = req.params as { tableId: string }
    const newToken = nanoid(24)
    const [table] = await db.update(tables).set({ qrToken: newToken }).where(and(eq(tables.id, tableId), eq(tables.restaurantId, req.user!.restaurantId))).returning()
    if (!table) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tavolo non trovato' } })
    return { data: { qrToken: newToken } }
  })

  // Delete table (soft delete — preserves order/bill history)
  fastify.delete('/:tableId', { preHandler: requireAuth }, async (req, reply) => {
    const { tableId } = req.params as { tableId: string }
    const [table] = await db.update(tables)
      .set({ active: false })
      .where(and(eq(tables.id, tableId), eq(tables.restaurantId, req.user!.restaurantId)))
      .returning()
    if (!table) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tavolo non trovato' } })
    return { data: { success: true } }
  })
}
