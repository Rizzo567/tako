import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, reservations, tables } from '@tako/db'
import { eq, and, gte, lt, ne, asc } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { io } from '../index.js'

const STATUSES = ['requested', 'confirmed', 'seated', 'no_show', 'cancelled'] as const

/* durata di una prenotazione in millisecondi */
const durMs = (min: number) => min * 60_000

/**
 * Anti-overbooking: verifica che nessun'altra prenotazione NON annullata sullo
 * stesso tavolo si sovrapponga alla finestra [startsAt, startsAt+durationMin).
 * Ritorna la prenotazione in conflitto se esiste, altrimenti null.
 * `excludeId` esclude la prenotazione stessa (utile in update/assegnazione).
 */
async function findOverlap(
  restaurantId: string,
  tableId: string,
  startsAt: Date,
  durationMin: number,
  excludeId?: string,
) {
  const newStart = startsAt.getTime()
  const newEnd = newStart + durMs(durationMin)
  const conds = [
    eq(reservations.restaurantId, restaurantId),
    eq(reservations.tableId, tableId),
    ne(reservations.status, 'cancelled'),
  ]
  if (excludeId) conds.push(ne(reservations.id, excludeId))
  const rows = await db.select().from(reservations).where(and(...conds))
  for (const r of rows) {
    const exStart = new Date(r.startsAt).getTime()
    const exEnd = exStart + durMs(r.durationMin)
    // sovrapposizione se inizia prima che l'altra finisca e finisce dopo che l'altra inizia
    if (newStart < exEnd && exStart < newEnd) return r
  }
  return null
}

/** verifica che il tavolo (se indicato) appartenga al ristorante; ritorna false se non trovato */
async function tableBelongs(restaurantId: string, tableId: string) {
  const [t] = await db.select({ id: tables.id }).from(tables)
    .where(and(eq(tables.id, tableId), eq(tables.restaurantId, restaurantId))).limit(1)
  return !!t
}

/** arricchisce la prenotazione col numero tavolo (per la UI) */
function withTableNumber(r: typeof reservations.$inferSelect, numByTable: Map<string, string>) {
  return { ...r, tableNumber: r.tableId ? (numByTable.get(r.tableId) ?? null) : null }
}

export async function reservationRoutes(fastify: FastifyInstance) {
  // Lista prenotazioni per giorno. ?date=YYYY-MM-DD (default: oggi, ora locale del server).
  fastify.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const q = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).safeParse(req.query)
    if (!q.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: q.error.message } })
    const dateStr = q.data.date ?? new Date().toLocaleDateString('en-CA') // en-CA → YYYY-MM-DD
    const dayStart = new Date(`${dateStr}T00:00:00`)
    if (isNaN(dayStart.getTime())) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Data non valida' } })
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

    const rows = await db.select().from(reservations)
      .where(and(
        eq(reservations.restaurantId, req.user!.restaurantId),
        gte(reservations.startsAt, dayStart),
        lt(reservations.startsAt, dayEnd),
      ))
      .orderBy(asc(reservations.startsAt))

    const allTables = await db.select({ id: tables.id, number: tables.number }).from(tables)
      .where(eq(tables.restaurantId, req.user!.restaurantId))
    const numByTable = new Map(allTables.map(t => [t.id, t.number]))
    return { data: rows.map(r => withTableNumber(r, numByTable)) }
  })

  // Crea prenotazione.
  fastify.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({
      customerName: z.string().min(1),
      customerPhone: z.string().min(1),
      partySize: z.number().int().min(1),
      startsAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
      durationMin: z.number().int().min(15).max(600).optional(),
      tableId: z.string().uuid().nullable().optional(),
      notes: z.string().optional(),
      status: z.enum(STATUSES).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const startsAt = new Date(body.data.startsAt)
    if (isNaN(startsAt.getTime())) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'startsAt non valido' } })
    const durationMin = body.data.durationMin ?? 90

    if (body.data.tableId) {
      if (!(await tableBelongs(req.user!.restaurantId, body.data.tableId)))
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tavolo non trovato' } })
      const clash = await findOverlap(req.user!.restaurantId, body.data.tableId, startsAt, durationMin)
      if (clash) return reply.code(409).send({ error: { code: 'RESERVATION_OVERLAP', message: 'Il tavolo è già prenotato in quella fascia oraria.' } })
    }

    const [row] = await db.insert(reservations).values({
      restaurantId: req.user!.restaurantId,
      tableId: body.data.tableId ?? null,
      customerName: body.data.customerName,
      customerPhone: body.data.customerPhone,
      partySize: body.data.partySize,
      startsAt,
      durationMin,
      status: body.data.status ?? 'requested',
      notes: body.data.notes ?? null,
    }).returning()

    io.to(`restaurant:${req.user!.restaurantId}`).emit('reservation:changed', { id: row!.id })
    return reply.code(201).send({ data: row })
  })

  // Modifica prenotazione (dati anagrafici + orario/durata/tavolo/note).
  fastify.patch('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const schema = z.object({
      customerName: z.string().min(1).optional(),
      customerPhone: z.string().min(1).optional(),
      partySize: z.number().int().min(1).optional(),
      startsAt: z.string().min(1).optional(),
      durationMin: z.number().int().min(15).max(600).optional(),
      tableId: z.string().uuid().nullable().optional(),
      notes: z.string().nullable().optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })

    const [existing] = await db.select().from(reservations)
      .where(and(eq(reservations.id, id), eq(reservations.restaurantId, req.user!.restaurantId))).limit(1)
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Prenotazione non trovata' } })

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.customerName !== undefined) updates['customerName'] = parsed.data.customerName
    if (parsed.data.customerPhone !== undefined) updates['customerPhone'] = parsed.data.customerPhone
    if (parsed.data.partySize !== undefined) updates['partySize'] = parsed.data.partySize
    if (parsed.data.notes !== undefined) updates['notes'] = parsed.data.notes

    let startsAt = new Date(existing.startsAt)
    if (parsed.data.startsAt !== undefined) {
      const d = new Date(parsed.data.startsAt)
      if (isNaN(d.getTime())) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'startsAt non valido' } })
      startsAt = d
      updates['startsAt'] = d
    }
    const durationMin = parsed.data.durationMin ?? existing.durationMin
    if (parsed.data.durationMin !== undefined) updates['durationMin'] = parsed.data.durationMin

    // tableId: undefined = non toccato; null = scollega; uuid = assegna (con controlli).
    let tableId = existing.tableId
    if (parsed.data.tableId !== undefined) {
      if (parsed.data.tableId && !(await tableBelongs(req.user!.restaurantId, parsed.data.tableId)))
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tavolo non trovato' } })
      tableId = parsed.data.tableId
      updates['tableId'] = parsed.data.tableId
    }

    // Anti-overbooking se la prenotazione ha (o riceve) un tavolo e cambia tavolo/orario/durata.
    if (tableId) {
      const clash = await findOverlap(req.user!.restaurantId, tableId, startsAt, durationMin, id)
      if (clash) return reply.code(409).send({ error: { code: 'RESERVATION_OVERLAP', message: 'Il tavolo è già prenotato in quella fascia oraria.' } })
    }

    const [row] = await db.update(reservations).set(updates)
      .where(and(eq(reservations.id, id), eq(reservations.restaurantId, req.user!.restaurantId))).returning()
    io.to(`restaurant:${req.user!.restaurantId}`).emit('reservation:changed', { id })
    return { data: row }
  })

  // Cambia stato: confirmed | seated | no_show | cancelled (o requested).
  fastify.patch('/:id/status', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = z.object({ status: z.enum(STATUSES) }).safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    const [row] = await db.update(reservations).set({ status: parsed.data.status, updatedAt: new Date() })
      .where(and(eq(reservations.id, id), eq(reservations.restaurantId, req.user!.restaurantId))).returning()
    if (!row) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Prenotazione non trovata' } })
    io.to(`restaurant:${req.user!.restaurantId}`).emit('reservation:changed', { id })
    return { data: row }
  })

  // Assegna (o scollega) un tavolo. body.tableId = uuid | null.
  fastify.patch('/:id/table', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = z.object({ tableId: z.string().uuid().nullable() }).safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })

    const [existing] = await db.select().from(reservations)
      .where(and(eq(reservations.id, id), eq(reservations.restaurantId, req.user!.restaurantId))).limit(1)
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Prenotazione non trovata' } })

    if (parsed.data.tableId) {
      if (!(await tableBelongs(req.user!.restaurantId, parsed.data.tableId)))
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tavolo non trovato' } })
      const clash = await findOverlap(req.user!.restaurantId, parsed.data.tableId, new Date(existing.startsAt), existing.durationMin, id)
      if (clash) return reply.code(409).send({ error: { code: 'RESERVATION_OVERLAP', message: 'Il tavolo è già prenotato in quella fascia oraria.' } })
    }

    const [row] = await db.update(reservations).set({ tableId: parsed.data.tableId, updatedAt: new Date() })
      .where(and(eq(reservations.id, id), eq(reservations.restaurantId, req.user!.restaurantId))).returning()
    io.to(`restaurant:${req.user!.restaurantId}`).emit('reservation:changed', { id })
    return { data: row }
  })

  // Elimina definitivamente una prenotazione.
  fastify.delete('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const [row] = await db.delete(reservations)
      .where(and(eq(reservations.id, id), eq(reservations.restaurantId, req.user!.restaurantId))).returning()
    if (!row) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Prenotazione non trovata' } })
    io.to(`restaurant:${req.user!.restaurantId}`).emit('reservation:changed', { id })
    return { data: { success: true } }
  })
}
