import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { db, users, sessions, restaurants } from '@tako/db'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { SESSION_COOKIE, authCookieOptions, STAFF_SESSION_MAX_AGE } from '../lib/cookies.js'

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

// In-memory brute force tracker (per IP)
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minuti

function checkBruteForce(ip: string): boolean {
  const now = Date.now()
  const record = loginAttempts.get(ip)
  if (!record) return true
  if (now - record.firstAttempt > LOCKOUT_MS) { loginAttempts.delete(ip); return true }
  return record.count < MAX_ATTEMPTS
}

function recordFailedLogin(ip: string) {
  const now = Date.now()
  const record = loginAttempts.get(ip)
  if (!record || now - record.firstAttempt > LOCKOUT_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now })
  } else {
    record.count++
  }
}

export async function authRoutes(fastify: FastifyInstance) {
  // Rate limit su auth: 10 req/min per IP
  fastify.register(async (instance) => {
    instance.addHook('onRequest', async (req, reply) => {
      const ip = req.ip
      if (!checkBruteForce(ip)) {
        return reply.code(429).send({ error: { code: 'BRUTE_FORCE', message: 'Troppi tentativi. Riprova tra 15 minuti.' } })
      }
    })
  })

  // Register new restaurant + owner
  fastify.post('/register', async (req, reply) => {
    const body = registerSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const { restaurantName, restaurantSlug, name, email, password } = body.data

    try {
      // Check slug unique
      const existing = await db.select().from(restaurants).where(eq(restaurants.slug, restaurantSlug)).limit(1)
      if (existing.length) return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Slug già in uso. Scegli un altro.' } })

      // Check email unique
      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1)
      if (existingUser.length) return reply.code(409).send({ error: { code: 'EMAIL_TAKEN', message: 'Email già registrata.' } })

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

      reply.setCookie(SESSION_COOKIE, token, authCookieOptions(STAFF_SESSION_MAX_AGE))
      return reply.code(201).send({
        data: {
          token,
          user: { id: user!.id, name: user!.name, email: user!.email, role: user!.role },
          restaurant: { id: restaurant!.id, name: restaurant!.name, slug: restaurant!.slug },
        },
      })
    } catch (err: any) {
      fastify.log.error({ err }, 'Registration error')
      // Postgres unique violation
      if (err?.code === '23505') {
        if (err.constraint?.includes('slug')) return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Slug già in uso. Scegli un altro.' } })
        if (err.constraint?.includes('email')) return reply.code(409).send({ error: { code: 'EMAIL_TAKEN', message: 'Email già registrata.' } })
      }
      return reply.code(500).send({ error: { code: 'SERVER_ERROR', message: 'Errore interno. Riprova tra qualche secondo.' } })
    }
  })

  // Login
  fastify.post('/login', async (req, reply) => {
    const body = loginSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const [user] = await db.select().from(users).where(eq(users.email, body.data.email)).limit(1)
    if (!user?.passwordHash) {
      recordFailedLogin(req.ip)
      return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } })
    }

    const valid = await bcrypt.compare(body.data.password, user.passwordHash)
    if (!valid) {
      recordFailedLogin(req.ip)
      return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } })
    }

    const token = nanoid(64)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await db.insert(sessions).values({ userId: user.id, token, expiresAt })

    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, user.restaurantId!)).limit(1)

    reply.setCookie(SESSION_COOKIE, token, authCookieOptions(STAFF_SESSION_MAX_AGE))
    return { data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role }, restaurant } }
  })

  // PIN login (for shared tablets)
  fastify.post('/pin-login', async (req, reply) => {
    const pinLoginSchema = z.object({
      restaurantId: z.string().uuid(),
      pin: z.string().length(4).regex(/^\d{4}$/),
    })
    const body = pinLoginSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    const { restaurantId, pin } = body.data

    const candidates = await db.select().from(users).where(and(eq(users.restaurantId, restaurantId), eq(users.active, true)))
    let user = null
    for (const candidate of candidates) {
      if (!candidate.pin) continue
      // Solo PIN hashati con bcrypt: niente più fallback plaintext legacy.
      const match = candidate.pin.startsWith('$2') && await bcrypt.compare(pin, candidate.pin)
      if (match) { user = candidate; break }
    }
    if (!user) return reply.code(401).send({ error: { code: 'INVALID_PIN', message: 'Invalid PIN' } })

    const token = nanoid(32)
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000) // 12h for PIN sessions
    await db.insert(sessions).values({ userId: user.id, token, expiresAt })

    reply.setCookie(SESSION_COOKIE, token, authCookieOptions(12 * 60 * 60))
    return { data: { token, user: { id: user.id, name: user.name, role: user.role } } }
  })

  // Get current user
  fastify.get('/me', { preHandler: requireAuth }, async (req) => {
    return { data: req.user }
  })

  // Logout
  fastify.post('/logout', { preHandler: requireAuth }, async (req, reply) => {
    const token = req.cookies?.[SESSION_COOKIE] ?? req.headers.authorization?.replace('Bearer ', '')
    if (token) await db.delete(sessions).where(eq(sessions.token, token))
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return { data: { success: true } }
  })
}
