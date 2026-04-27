import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { db, users, sessions, restaurants } from '@tako/db'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const registerSchema = z.object({
  restaurantName: z.string().min(2),
  restaurantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})

export async function authRoutes(fastify: FastifyInstance) {
  // Register new restaurant + owner
  fastify.post('/register', async (req, reply) => {
    const body = registerSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const { restaurantName, restaurantSlug, name, email, password } = body.data

    // Check slug unique
    const existing = await db.select().from(restaurants).where(eq(restaurants.slug, restaurantSlug)).limit(1)
    if (existing.length) return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Slug already taken' } })

    const passwordHash = await bcrypt.hash(password, 12)

    const [restaurant] = await db.insert(restaurants).values({
      name: restaurantName,
      slug: restaurantSlug,
      plan: 'free',
    }).returning()

    const [user] = await db.insert(users).values({
      restaurantId: restaurant!.id,
      name,
      email,
      passwordHash,
      role: 'owner',
    }).returning()

    const token = nanoid(64)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await db.insert(sessions).values({ userId: user!.id, token, expiresAt })

    return reply.code(201).send({
      data: {
        token,
        user: { id: user!.id, name: user!.name, email: user!.email, role: user!.role },
        restaurant: { id: restaurant!.id, name: restaurant!.name, slug: restaurant!.slug },
      },
    })
  })

  // Login
  fastify.post('/login', async (req, reply) => {
    const body = loginSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const [user] = await db.select().from(users).where(eq(users.email, body.data.email)).limit(1)
    if (!user?.passwordHash) return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } })

    const valid = await bcrypt.compare(body.data.password, user.passwordHash)
    if (!valid) return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } })

    const token = nanoid(64)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await db.insert(sessions).values({ userId: user.id, token, expiresAt })

    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, user.restaurantId!)).limit(1)

    return { data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role }, restaurant } }
  })

  // PIN login (for shared tablets)
  fastify.post('/pin-login', async (req, reply) => {
    const { restaurantId, pin } = req.body as { restaurantId: string; pin: string }
    if (!restaurantId || !pin) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'restaurantId and pin required' } })

    const [user] = await db.select().from(users).where(and(eq(users.restaurantId, restaurantId), eq(users.pin, pin))).limit(1)
    if (!user) return reply.code(401).send({ error: { code: 'INVALID_PIN', message: 'Invalid PIN' } })

    const token = nanoid(32)
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000) // 12h for PIN sessions
    await db.insert(sessions).values({ userId: user.id, token, expiresAt })

    return { data: { token, user: { id: user.id, name: user.name, role: user.role } } }
  })

  // Get current user
  fastify.get('/me', { preHandler: requireAuth }, async (req) => {
    return { data: req.user }
  })

  // Logout
  fastify.post('/logout', { preHandler: requireAuth }, async (req) => {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (token) await db.delete(sessions).where(eq(sessions.token, token))
    return { data: { success: true } }
  })
}
