import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, staffShifts, users } from '@tako/db'
import { eq, and, isNull, gte, lt, desc, sql } from 'drizzle-orm'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { io } from '../index.js'

// Chi può gestire i turni ALTRUI (crea/modifica/cancella manuale, clock-in/out di
// un altro membro). Un dipendente/chef può solo fare clock-in/out del PROPRIO turno.
const MANAGER_ROLES = ['owner', 'cassiere'] as const
const requireManager = requireRole(...MANAGER_ROLES)

// Confini della settimana ISO (lun 00:00 → lun successivo) per la vista di default.
function weekBounds(now = new Date()): { from: Date; to: Date } {
  const d = new Date(now)
  const dow = (d.getDay() + 6) % 7 // 0 = lunedì
  const from = new Date(d)
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - dow)
  const to = new Date(from)
  to.setDate(to.getDate() + 7)
  return { from, to }
}

// Righe turno arricchite col nome/ruolo del membro (join su users, stesso tenant).
const SHIFT_COLS = {
  id: staffShifts.id,
  userId: staffShifts.userId,
  startsAt: staffShifts.startsAt,
  endsAt: staffShifts.endsAt,
  role: staffShifts.role,
  notes: staffShifts.notes,
  createdAt: staffShifts.createdAt,
  userName: users.name,
  userRole: users.role,
  userAvatarUrl: users.avatarUrl,
}

export async function shiftRoutes(fastify: FastifyInstance) {
  // ── Lista turni per finestra temporale (default: settimana corrente) ──
  fastify.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    })
    const parsed = schema.safeParse(req.query)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    const wb = weekBounds()
    const from = parsed.data.from ?? wb.from
    const to = parsed.data.to ?? wb.to

    const rows = await db.select(SHIFT_COLS).from(staffShifts)
      .innerJoin(users, eq(staffShifts.userId, users.id))
      .where(and(
        eq(staffShifts.restaurantId, req.user!.restaurantId),
        gte(staffShifts.startsAt, from),
        lt(staffShifts.startsAt, to),
      ))
      .orderBy(desc(staffShifts.startsAt))
    return { data: rows }
  })

  // ── Chi è in turno adesso (turni aperti: endsAt IS NULL) ──
  fastify.get('/active', { preHandler: requireAuth }, async (req) => {
    const rows = await db.select(SHIFT_COLS).from(staffShifts)
      .innerJoin(users, eq(staffShifts.userId, users.id))
      .where(and(
        eq(staffShifts.restaurantId, req.user!.restaurantId),
        isNull(staffShifts.endsAt),
      ))
      .orderBy(desc(staffShifts.startsAt))
    return { data: rows }
  })

  // ── Clock-in: apre un turno per userId (default: se stesso) ──
  fastify.post('/clock-in', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({
      userId: z.string().uuid().optional(),
      role: z.string().min(1).optional(),
      notes: z.string().optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    const targetId = body.data.userId ?? req.user!.id

    // Un non-manager può fare clock-in solo del proprio turno.
    if (targetId !== req.user!.id && !MANAGER_ROLES.includes(req.user!.role as any)) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Non puoi gestire i turni di altri membri' } })
    }

    // Anti cross-tenant: il membro deve appartenere al ristorante.
    const [member] = await db.select({ id: users.id, role: users.role }).from(users)
      .where(and(eq(users.id, targetId), eq(users.restaurantId, req.user!.restaurantId))).limit(1)
    if (!member) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Membro non trovato' } })

    // Check "turno aperto" + insert atomici sotto advisory lock (ristorante,membro):
    // due clock-in concorrenti dello stesso membro non possono creare due turni aperti.
    const shift = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'shift:' + req.user!.restaurantId + ':' + targetId}))`)
      const [open] = await tx.select({ id: staffShifts.id }).from(staffShifts)
        .where(and(eq(staffShifts.restaurantId, req.user!.restaurantId), eq(staffShifts.userId, targetId), isNull(staffShifts.endsAt)))
        .limit(1)
      if (open) return null
      const [s] = await tx.insert(staffShifts).values({
        restaurantId: req.user!.restaurantId,
        userId: targetId,
        startsAt: new Date(),
        endsAt: null,
        role: body.data.role ?? member.role,
        notes: body.data.notes,
      }).returning()
      return s!
    })
    if (!shift) return reply.code(409).send({ error: { code: 'ALREADY_CLOCKED_IN', message: 'Il membro è già in turno' } })
    io.to(`restaurant:${req.user!.restaurantId}`).emit('shift:updated', { userId: targetId, action: 'clock-in' })
    return reply.code(201).send({ data: shift })
  })

  // ── Clock-out: chiude il turno aperto di userId (default: se stesso) ──
  fastify.post('/clock-out', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({ userId: z.string().uuid().optional() })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    const targetId = body.data.userId ?? req.user!.id

    if (targetId !== req.user!.id && !MANAGER_ROLES.includes(req.user!.role as any)) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Non puoi gestire i turni di altri membri' } })
    }

    const [open] = await db.select({ id: staffShifts.id }).from(staffShifts)
      .where(and(eq(staffShifts.restaurantId, req.user!.restaurantId), eq(staffShifts.userId, targetId), isNull(staffShifts.endsAt)))
      .orderBy(desc(staffShifts.startsAt)).limit(1)
    if (!open) return reply.code(404).send({ error: { code: 'NOT_CLOCKED_IN', message: 'Nessun turno aperto per questo membro' } })

    const [shift] = await db.update(staffShifts).set({ endsAt: new Date() })
      .where(and(eq(staffShifts.id, open.id), eq(staffShifts.restaurantId, req.user!.restaurantId))).returning()
    io.to(`restaurant:${req.user!.restaurantId}`).emit('shift:updated', { userId: targetId, action: 'clock-out' })
    return { data: shift }
  })

  // ── Crea turno manuale (solo manager) ──
  fastify.post('/', { preHandler: requireManager }, async (req, reply) => {
    const schema = z.object({
      userId: z.string().uuid(),
      startsAt: z.coerce.date(),
      endsAt: z.coerce.date().nullable().optional(),
      role: z.string().min(1).optional(),
      notes: z.string().optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    if (body.data.endsAt && body.data.endsAt <= body.data.startsAt) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'La fine deve essere successiva all\'inizio' } })
    }

    // Anti cross-tenant: il membro deve appartenere al ristorante.
    const [member] = await db.select({ id: users.id, role: users.role }).from(users)
      .where(and(eq(users.id, body.data.userId), eq(users.restaurantId, req.user!.restaurantId))).limit(1)
    if (!member) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Membro non trovato' } })

    const isOpen = !body.data.endsAt // turno senza fine = "in corso"
    // Se si crea un turno APERTO, sotto lock verifica che non ce ne sia già uno
    // aperto per lo stesso membro (coerente col clock-in, evita doppio turno aperto).
    const shift = await db.transaction(async (tx) => {
      if (isOpen) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'shift:' + req.user!.restaurantId + ':' + body.data.userId}))`)
        const [open] = await tx.select({ id: staffShifts.id }).from(staffShifts)
          .where(and(eq(staffShifts.restaurantId, req.user!.restaurantId), eq(staffShifts.userId, body.data.userId), isNull(staffShifts.endsAt)))
          .limit(1)
        if (open) return null
      }
      const [s] = await tx.insert(staffShifts).values({
        restaurantId: req.user!.restaurantId,
        userId: body.data.userId,
        startsAt: body.data.startsAt,
        endsAt: body.data.endsAt ?? null,
        role: body.data.role ?? member.role,
        notes: body.data.notes,
      }).returning()
      return s!
    })
    if (!shift) return reply.code(409).send({ error: { code: 'ALREADY_CLOCKED_IN', message: 'Il membro ha già un turno aperto' } })
    io.to(`restaurant:${req.user!.restaurantId}`).emit('shift:updated', { userId: body.data.userId, action: 'create' })
    return reply.code(201).send({ data: shift })
  })

  // ── Modifica turno manuale (solo manager) ──
  fastify.patch('/:shiftId', { preHandler: requireManager }, async (req, reply) => {
    const { shiftId } = req.params as { shiftId: string }
    const schema = z.object({
      startsAt: z.coerce.date().optional(),
      endsAt: z.coerce.date().nullable().optional(),
      role: z.string().min(1).nullable().optional(),
      notes: z.string().nullable().optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const [existing] = await db.select().from(staffShifts)
      .where(and(eq(staffShifts.id, shiftId), eq(staffShifts.restaurantId, req.user!.restaurantId))).limit(1)
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Turno non trovato' } })

    const nextStart = body.data.startsAt ?? existing.startsAt
    const nextEnd = body.data.endsAt !== undefined ? body.data.endsAt : existing.endsAt
    if (nextEnd && nextEnd <= nextStart) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'La fine deve essere successiva all\'inizio' } })
    }

    const updates: Record<string, unknown> = {}
    if (body.data.startsAt !== undefined) updates['startsAt'] = body.data.startsAt
    if (body.data.endsAt !== undefined) updates['endsAt'] = body.data.endsAt
    if (body.data.role !== undefined) updates['role'] = body.data.role
    if (body.data.notes !== undefined) updates['notes'] = body.data.notes
    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Nessun campo da aggiornare' } })
    }

    const [shift] = await db.update(staffShifts).set(updates)
      .where(and(eq(staffShifts.id, shiftId), eq(staffShifts.restaurantId, req.user!.restaurantId))).returning()
    io.to(`restaurant:${req.user!.restaurantId}`).emit('shift:updated', { userId: shift!.userId, action: 'update' })
    return { data: shift }
  })

  // ── Cancella turno (solo manager) ──
  fastify.delete('/:shiftId', { preHandler: requireManager }, async (req, reply) => {
    const { shiftId } = req.params as { shiftId: string }
    const [shift] = await db.delete(staffShifts)
      .where(and(eq(staffShifts.id, shiftId), eq(staffShifts.restaurantId, req.user!.restaurantId))).returning()
    if (!shift) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Turno non trovato' } })
    io.to(`restaurant:${req.user!.restaurantId}`).emit('shift:updated', { userId: shift.userId, action: 'delete' })
    return { data: { success: true } }
  })
}
