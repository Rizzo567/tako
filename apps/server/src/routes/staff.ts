import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db, users } from '@tako/db'
import { eq, and } from 'drizzle-orm'
import { requireAuth, requireRole } from '../middleware/auth.js'

export async function staffRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireAuth }, async (req) => {
    const staff = await db.select({
      id: users.id, name: users.name, email: users.email, role: users.role,
      active: users.active, lastLoginAt: users.lastLoginAt, avatarUrl: users.avatarUrl,
    }).from(users).where(eq(users.restaurantId, req.user!.restaurantId))
    return { data: staff }
  })

  fastify.post('/', { preHandler: requireRole('owner', 'manager') }, async (req, reply) => {
    const schema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      role: z.enum(['manager', 'waiter', 'chef', 'cashier']),
      pin: z.string().length(4).optional(),
      password: z.string().min(6).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const passwordHash = body.data.password ? await bcrypt.hash(body.data.password, 12) : undefined
    const pinHash = body.data.pin ? await bcrypt.hash(body.data.pin, 10) : undefined
    const [user] = await db.insert(users).values({
      restaurantId: req.user!.restaurantId,
      name: body.data.name,
      email: body.data.email,
      role: body.data.role,
      pin: pinHash,
      passwordHash,
    }).returning()

    return reply.code(201).send({ data: { id: user!.id, name: user!.name, email: user!.email, role: user!.role } })
  })

  fastify.patch('/:userId', { preHandler: requireRole('owner', 'manager') }, async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const schema = z.object({
      name: z.string().optional(),
      role: z.enum(['manager', 'waiter', 'chef', 'cashier']).optional(),
      pin: z.string().length(4).optional(),
      active: z.boolean().optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const [user] = await db.update(users).set(body.data).where(and(eq(users.id, userId), eq(users.restaurantId, req.user!.restaurantId))).returning()
    if (!user) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } })
    return { data: user }
  })

  fastify.delete('/:userId', { preHandler: requireRole('owner', 'manager') }, async (req, reply) => {
    const { userId } = req.params as { userId: string }
    if (userId === req.user!.id) return reply.code(400).send({ error: { code: 'SELF_DELETE', message: 'Cannot delete yourself' } })
    await db.update(users).set({ active: false }).where(and(eq(users.id, userId), eq(users.restaurantId, req.user!.restaurantId)))
    return { data: { success: true } }
  })
}
