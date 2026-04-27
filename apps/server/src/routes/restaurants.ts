import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, restaurants } from '@tako/db'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'

export async function restaurantRoutes(fastify: FastifyInstance) {
  fastify.get('/me', { preHandler: requireAuth }, async (req, reply) => {
    const [r] = await db.select().from(restaurants).where(eq(restaurants.id, req.user!.restaurantId)).limit(1)
    if (!r) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Restaurant not found' } })
    return { data: r }
  })

  fastify.patch('/me', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({
      name: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      primaryColor: z.string().optional(),
      settings: z.object({
        currency: z.string().optional(),
        timezone: z.string().optional(),
        vatRate: z.number().optional(),
        languages: z.array(z.string()).optional(),
        defaultLanguage: z.string().optional(),
        tableServiceEnabled: z.boolean().optional(),
        takeawayEnabled: z.boolean().optional(),
        payAtTableEnabled: z.boolean().optional(),
        aiEnabled: z.boolean().optional(),
      }).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const [updated] = await db.update(restaurants).set({ ...body.data, updatedAt: new Date() }).where(eq(restaurants.id, req.user!.restaurantId)).returning()
    return { data: updated }
  })
}
