import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import QRCode from 'qrcode'
import { db, tables, rooms } from '@tako/db'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { io } from '../index.js'

const CLIENT_BASE_URL = process.env['CLIENT_BASE_URL'] ?? 'http://localhost:3002'

export async function tableRoutes(fastify: FastifyInstance) {
  // Get all rooms with tables
  fastify.get('/rooms', { preHandler: requireAuth }, async (req) => {
    const allRooms = await db.select().from(rooms).where(eq(rooms.restaurantId, req.user!.restaurantId))
    const allTables = await db.select().from(tables).where(eq(tables.restaurantId, req.user!.restaurantId))
    return { data: allRooms.map(r => ({ ...r, tables: allTables.filter(t => t.roomId === r.id) })) }
  })

  // Get all tables flat
  fastify.get('/', { preHandler: requireAuth }, async (req) => {
    const all = await db.select().from(tables).where(eq(tables.restaurantId, req.user!.restaurantId))
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

    const qrToken = nanoid(24)
    const [table] = await db.insert(tables).values({ restaurantId: req.user!.restaurantId, qrToken, ...body.data }).returning()
    return reply.code(201).send({ data: table })
  })

  // Update table status
  fastify.patch('/:tableId/status', { preHandler: requireAuth }, async (req, reply) => {
    const { tableId } = req.params as { tableId: string }
    const { status } = req.body as { status: 'free' | 'occupied' | 'waiting' | 'cleaning' | 'reserved' }

    const [table] = await db.update(tables).set({
      status,
      openedAt: status === 'occupied' ? new Date() : status === 'free' ? null : undefined,
    }).where(and(eq(tables.id, tableId), eq(tables.restaurantId, req.user!.restaurantId))).returning()

    if (!table) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Table not found' } })

    io.to(`restaurant:${req.user!.restaurantId}`).emit('table:updated', { tableId, status })
    return { data: table }
  })

  // Get QR code as base64 PNG
  fastify.get('/:tableId/qr', { preHandler: requireAuth }, async (req, reply) => {
    const { tableId } = req.params as { tableId: string }
    const [table] = await db.select().from(tables).where(and(eq(tables.id, tableId), eq(tables.restaurantId, req.user!.restaurantId))).limit(1)
    if (!table) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Table not found' } })

    const url = `${CLIENT_BASE_URL}/r/${req.user!.restaurantId}/t/${table.qrToken}`
    const qrDataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2, color: { dark: '#2A1F1A', light: '#FFF8F3' } })
    return { data: { qrDataUrl, url, tableNumber: table.number } }
  })

  // Refresh QR token (invalidates old)
  fastify.post('/:tableId/qr/refresh', { preHandler: requireAuth }, async (req, reply) => {
    const { tableId } = req.params as { tableId: string }
    const newToken = nanoid(24)
    const [table] = await db.update(tables).set({ qrToken: newToken }).where(and(eq(tables.id, tableId), eq(tables.restaurantId, req.user!.restaurantId))).returning()
    if (!table) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Table not found' } })
    return { data: { qrToken: newToken } }
  })

  // Delete table
  fastify.delete('/:tableId', { preHandler: requireAuth }, async (req, reply) => {
    const { tableId } = req.params as { tableId: string }
    await db.delete(tables).where(and(eq(tables.id, tableId), eq(tables.restaurantId, req.user!.restaurantId)))
    return { data: { success: true } }
  })
}
