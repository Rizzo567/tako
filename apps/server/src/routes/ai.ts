import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, restaurants } from '@tako/db'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { registry, runAgentTurn, ownerSystem, aiConfigured } from '../ai/index.js'

// Owner/staff Copilot. Authenticated; scoped to the caller's restaurant.
export async function aiRoutes(fastify: FastifyInstance) {
  fastify.post('/chat', { preHandler: requireAuth }, async (req, reply) => {
    if (!aiConfigured()) {
      return reply.code(503).send({ error: { code: 'AI_UNAVAILABLE', message: 'Assistente AI non configurato (manca ANTHROPIC_API_KEY).' } })
    }
    const schema = z.object({
      message: z.string().min(1).max(1000),
      history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      })).max(20).default([]),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })

    const user = req.user!
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, user.restaurantId)).limit(1)

    // owner role gets the full toolset; other staff get the staff subset.
    const scope = user.role === 'owner' ? 'owner' : 'staff'
    const today = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

    try {
      const result = await runAgentTurn({
        scope,
        system: ownerSystem({ restaurantName: restaurant?.name ?? 'il ristorante', userName: user.name, today }),
        history: parsed.data.history,
        message: parsed.data.message,
        ctx: { restaurantId: user.restaurantId, userId: user.id, role: user.role },
        registry,
      })
      return { data: result }
    } catch (err) {
      req.log.error(err)
      return reply.code(500).send({ error: { code: 'AI_ERROR', message: 'Errore assistente.' } })
    }
  })
}
