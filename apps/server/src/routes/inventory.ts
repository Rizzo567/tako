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
      type: z.enum(['load', 'unload', 'adjustment', 'waste']),
      quantity: z.number().positive().max(100_000),
      note: z.string().max(500).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    // Verify the item belongs to this restaurant
    const [existing] = await db.select().from(inventoryItems).where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.restaurantId, req.user!.restaurantId))).limit(1)
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Item not found' } })

    const delta = body.data.type === 'load' ? body.data.quantity : -Math.abs(body.data.quantity)

    const [movement] = await db.insert(inventoryMovements).values({ itemId, userId: req.user!.id, ...body.data }).returning()

    const [item] = await db.update(inventoryItems).set({
      quantity: sql`${inventoryItems.quantity} + ${delta}`,
      updatedAt: new Date(),
    }).where(eq(inventoryItems.id, itemId)).returning()

    if (item && item.quantity <= item.minQuantity) {
      io.to(`restaurant:${req.user!.restaurantId}`).emit('inventory:alert', { itemId, name: item.name, quantity: item.quantity })
    }

    return reply.code(201).send({ data: movement })
  })
}
