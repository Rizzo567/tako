import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, inventoryItems, inventoryMovements } from '@tako/db'
import { eq, and, lte } from 'drizzle-orm'
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
      quantity: z.number(),
      note: z.string().optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const [movement] = await db.insert(inventoryMovements).values({ itemId, userId: req.user!.id, ...body.data }).returning()

    const delta = ['load'].includes(body.data.type) ? body.data.quantity : -Math.abs(body.data.quantity)
    const [updated] = await db.update(inventoryItems).set({
      quantity: db.$count(inventoryItems, eq(inventoryItems.id, itemId)),
      updatedAt: new Date(),
    }).where(eq(inventoryItems.id, itemId)).returning()

    // Raw SQL increment
    await db.execute(
      `UPDATE inventory_items SET quantity = quantity + ${delta}, updated_at = NOW() WHERE id = '${itemId}'` as any
    )

    // Check alert
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, itemId)).limit(1)
    if (item && item.quantity <= item.minQuantity) {
      io.to(`restaurant:${req.user!.restaurantId}`).emit('inventory:alert', { itemId, name: item.name, quantity: item.quantity })
    }

    return reply.code(201).send({ data: movement })
  })
}
