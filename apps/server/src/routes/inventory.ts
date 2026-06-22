import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, inventoryItems, inventoryMovements } from '@tako/db'
import { eq, and, lte, sql } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { io } from '../index.js'

export async function inventoryRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireAuth }, async (req) => {
    const items = await db.select().from(inventoryItems).where(eq(inventoryItems.restaurantId, req.user!.restaurantId))
    return { data: items }
  })

  fastify.get('/alerts', { preHandler: requireAuth }, async (req) => {
    const alerts = await db.select().from(inventoryItems).where(and(
      eq(inventoryItems.restaurantId, req.user!.restaurantId),
      lte(inventoryItems.quantity, inventoryItems.minQuantity),
    ))
    return { data: alerts }
  })

  fastify.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      unit: z.string().min(1),
      quantity: z.number().default(0),
      minQuantity: z.number().default(0),
      costPerUnit: z.number().optional(),
      supplier: z.string().optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    const [item] = await db.insert(inventoryItems).values({ restaurantId: req.user!.restaurantId, ...body.data }).returning()
    return reply.code(201).send({ data: item })
  })

  fastify.post('/:itemId/movements', { preHandler: requireAuth }, async (req, reply) => {
    const { itemId } = req.params as { itemId: string }
    const schema = z.object({
      // 'adjustment' è una rettifica con SEGNO (può essere negativa); load/unload/waste
      // usano un valore positivo (il segno lo decide il tipo).
      type: z.enum(['load', 'unload', 'adjustment', 'waste']),
      quantity: z.number().min(-100_000).max(100_000),
      note: z.string().max(500).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const { type, quantity } = body.data
    if (quantity === 0) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'La quantità non può essere zero' } })
    if (type !== 'adjustment' && quantity <= 0) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Quantità deve essere positiva' } })

    // Verify the item belongs to this restaurant
    const [existing] = await db.select().from(inventoryItems).where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.restaurantId, req.user!.restaurantId))).limit(1)
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Item not found' } })

    const delta = type === 'load' ? Math.abs(quantity)
      : type === 'adjustment' ? quantity            // con segno
      : -Math.abs(quantity)                          // unload / waste

    // Movimento + aggiornamento stock in un'unica transazione (niente ledger
    // orfano). Lo stock non scende mai sotto zero (GREATEST a livello DB, atomico).
    const { movement, item } = await db.transaction(async (tx) => {
      const [movement] = await tx.insert(inventoryMovements).values({ itemId, userId: req.user!.id, type, quantity, note: body.data.note }).returning()
      const [item] = await tx.update(inventoryItems).set({
        quantity: sql`GREATEST(0, ${inventoryItems.quantity} + ${delta})`,
        updatedAt: new Date(),
      }).where(eq(inventoryItems.id, itemId)).returning()
      return { movement, item }
    })

    if (item && item.quantity <= item.minQuantity) {
      io.to(`restaurant:${req.user!.restaurantId}`).emit('inventory:alert', { itemId, name: item.name, quantity: item.quantity })
    }

    return reply.code(201).send({ data: movement })
  })
}
