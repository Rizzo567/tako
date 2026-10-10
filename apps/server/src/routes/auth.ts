import { webOrigin } from '../lib/web-runtime.js'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { createHmac, randomBytes } from 'node:crypto'
import { db, users, sessions, restaurants, menus, deviceEnrollCodes } from '@tako/db'
import { eq, and, sql, gt, desc, inArray } from 'drizzle-orm'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { SESSION_COOKIE, authCookieOptions, STAFF_SESSION_MAX_AGE } from '../lib/cookies.js'
import { qrWithOctopus } from '../lib/qr-octopus.js'

const loginSchema = z.object({
  email: z.string().trim().email().transform(value => value.toLowerCase()),
  password: z.string().min(6),
})

const registerSchema = z.object({
  restaurantName: z.string().min(2),
  restaurantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  email: z.string().trim().email().transform(value => value.toLowerCase()),
  password: z.string().min(8),
  // Campo storico del form di registrazione: accettato e ignorato.
  newsletter: z.boolean().optional(),
})

// In-memory brute force tracker (per IP)
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minuti
const MAX_TRACKED = 5000 // bound memoria: evita crescita illimitata della mappa

// La chiave è ip+email: un dito storto su una mail non blocca tutto lo staff
// dietro lo stesso IP (NAT del ristorante), e si limita comunque il credential stuffing.
function bruteKey(ip: string, email: string) { return `${ip}::${email.toLowerCase()}` }

function checkBruteForce(key: string, maxAttempts: number = MAX_ATTEMPTS): boolean {
  const now = Date.now()
  const record = loginAttempts.get(key)
  if (!record) return true
  if (now - record.firstAttempt > LOCKOUT_MS) { loginAttempts.delete(key); return true }
  return record.count < maxAttempts
}

// Cap per-IP indipendente dall'email su /login: il contatore ip+email blocca il
// brute-force su un singolo account, ma non ferma il password spraying (5 password
// su N email diverse dallo stesso IP). Soglia alta per non bloccare lo staff dietro
// NAT del ristorante (più utenti, stesso IP).
const LOGIN_IP_MAX_ATTEMPTS = 30

function recordFailedLogin(key: string) {
  const now = Date.now()
  // Pulizia opportunistica delle voci scadute quando la mappa cresce troppo.
  if (loginAttempts.size > MAX_TRACKED) {
    for (const [k, v] of loginAttempts) if (now - v.firstAttempt > LOCKOUT_MS) loginAttempts.delete(k)
  }
  const record = loginAttempts.get(key)
  if (!record || now - record.firstAttempt > LOCKOUT_MS) {
    loginAttempts.set(key, { count: 1, firstAttempt: now })
  } else {
    record.count++
  }
}

// ─────────────── Codice di collegamento telefono (schermata «Dispositivi») ───────────────
// L'owner genera dalla dashboard un codice monouso (32 byte random, TTL 5 minuti).
// Nel DB c'è solo l'HMAC del codice, con prefisso di dominio: lo stesso JWT_SECRET
// firma anche i JWT del tavolo e due usi diversi non devono produrre lo stesso digest.
const ENROLL_CODE_TTL_MS = 5 * 60 * 1000

function hashEnrollCode(code: string): string {
  const secret = process.env['JWT_SECRET'] ?? ''
  return createHmac('sha256', secret).update(`device-enroll:${code}`).digest('hex')
}

export async function authRoutes(fastify: FastifyInstance) {
  // Il controllo brute-force è applicato direttamente in /login (per ip+email),
  // dove l'email è disponibile. Vedi checkBruteForce/recordFailedLogin sopra.

  // Register new restaurant + owner. Rate-limit dedicato più stretto: ferma
  // l'amplificazione bcrypt e la creazione anonima ripetuta di tenant.
  fastify.post('/register', { config: { rateLimit: { max: 3, timeWindow: 3600000 } } }, async (req, reply) => {
    // Provisioning guard: l'endpoint è anonimo, quindi la creazione di tenant è chiusa
    // per configurazione. 1) gate esplicito via env (TAKO_DISABLE_REGISTRATION=1)
    if (process.env['TAKO_DISABLE_REGISTRATION'] === '1') {
      return reply.code(403).send({ error: { code: 'REGISTRATION_DISABLED', message: 'Registrazione non disponibile.' } })
    }
    // 2) senza TAKO_MULTI_TENANT=1 si chiude da sola dopo il primo tenant
    if (process.env['TAKO_MULTI_TENANT'] !== '1') {
      const countRows = await db.select({ count: sql<number>`count(*)::int` }).from(restaurants)
      if ((countRows[0]?.count ?? 0) > 0) return reply.code(403).send({ error: { code: 'ALREADY_PROVISIONED', message: 'Appliance già configurata.' } })
    }

    const body = registerSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const { restaurantName, restaurantSlug, name, email, password } = body.data

    try {
      // Check slug unique
      const existing = await db.select().from(restaurants).where(eq(restaurants.slug, restaurantSlug)).limit(1)
      if (existing.length) return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Slug già in uso. Scegli un altro.' } })

      // Check email unique
      const existingUser = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1)
      if (existingUser.length) return reply.code(409).send({ error: { code: 'EMAIL_TAKEN', message: 'Email già registrata.' } })

      const passwordHash = await bcrypt.hash(password, 12)

      const token = nanoid(64)
      // Sessione DB allineata alla maxAge del cookie (7g): evita un token server-side
      // valido 30g mentre il cookie scade a 7g (finestra di replay).
      const expiresAt = new Date(Date.now() + STAFF_SESSION_MAX_AGE * 1000)

      // Registrazione atomica: restaurant + menu day-1 + owner + sessione in UNA
      // transazione. Senza, un errore a metà lascerebbe un ristorante orfano; con
      // l'auto-chiusura (count>0 → ALREADY_PROVISIONED) il servizio si bloccherebbe
      // (registrazione disabilitata ma nessun owner per il login).
      const { restaurant, user } = await db.transaction(async (tx) => {
        const [restaurant] = await tx.insert(restaurants).values({
          name: restaurantName,
          slug: restaurantSlug,
          plan: 'free',
        }).returning()

        // Menu day-1: crea subito un menu di default così la SPA (loadMenu) trova un
        // menu esistente al primo accesso e le azioni menu non vanno su /menus/undefined/...
        // Campi presi da POST /api/menus (menu.ts): restaurantId + name; type ha default 'main'.
        await tx.insert(menus).values({
          restaurantId: restaurant!.id,
          name: 'Menu',
          type: 'main',
        })

        const [user] = await tx.insert(users).values({
          restaurantId: restaurant!.id,
          name,
          email,
          passwordHash,
          role: 'owner',
        }).returning()

        await tx.insert(sessions).values({ userId: user!.id, token, expiresAt })

        return { restaurant, user }
      })

      reply.setCookie(SESSION_COOKIE, token, authCookieOptions(STAFF_SESSION_MAX_AGE))
      return reply.code(201).send({
        data: {
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

    // Brute-force per (ip, email): blocca dopo 5 tentativi falliti in 15 min.
    // In più un cap per-IP (ip aggregato su tutte le email) ferma il password
    // spraying da un singolo IP senza bloccare lo staff legittimo dietro NAT.
    const key = bruteKey(req.ip, body.data.email)
    const ipKey = `login-ip::${req.ip}`
    if (!checkBruteForce(key) || !checkBruteForce(ipKey, LOGIN_IP_MAX_ATTEMPTS)) {
      return reply.code(429).send({ error: { code: 'BRUTE_FORCE', message: 'Troppi tentativi. Riprova tra 15 minuti.' } })
    }

    // Legacy imports can retain mixed casing. Reject ambiguous legacy identities
    // rather than picking one tenant arbitrarily if duplicates differ only by case.
    const candidates = await db.select().from(users)
      .where(and(sql`lower(${users.email}) = ${body.data.email}`, eq(users.active, true))).limit(2)
    const user = candidates.length === 1 ? candidates[0] : undefined
    // Un utente è autenticabile se ha una password locale classica (staff/owner storico)
    // OPPURE, per l'owner sincronizzato dal cloud, una credenziale owner LOCALE dedicata
    // (local_owner_secret_hash) impostata al pairing per l'accesso OFFLINE (SEC-001).
    // Il login offline non richiede mai il password_hash cloud (che non è sul box).
    if (!user || (!user.passwordHash && !user.localOwnerSecretHash)) {
      recordFailedLogin(key)
      recordFailedLogin(ipKey)
      return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } })
    }

    // Confronto contro entrambe le credenziali disponibili. L'owner cloud-synced può
    // avere SOLO local_owner_secret_hash (nessun passwordHash classico).
    const matchClassic = user.passwordHash ? await bcrypt.compare(body.data.password, user.passwordHash) : false
    const matchLocalOwner = user.localOwnerSecretHash ? await bcrypt.compare(body.data.password, user.localOwnerSecretHash) : false
    const valid = matchClassic || matchLocalOwner
    if (!valid) {
      recordFailedLogin(key)
      recordFailedLogin(ipKey)
      return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } })
    }

    // Login riuscito: azzera il contatore per questa coppia. NON azzeriamo ipKey:
    // l'IP aggrega email diverse dietro NAT, quindi lasciamo scadere la finestra
    // naturalmente (15 min) anziché ricaricare il budget di uno spraying in corso.
    loginAttempts.delete(key)

    const token = nanoid(64)
    // Sessione DB allineata alla maxAge del cookie (7g), vedi /register.
    const expiresAt = new Date(Date.now() + STAFF_SESSION_MAX_AGE * 1000)
    await db.insert(sessions).values({ userId: user.id, token, expiresAt })

    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, user.restaurantId!)).limit(1)

    reply.setCookie(SESSION_COOKIE, token, authCookieOptions(STAFF_SESSION_MAX_AGE))
    return { data: { user: { id: user.id, name: user.name, email: user.email, role: user.role }, restaurant } }
  })

  // Reinvio email di verifica: la webapp non delega più la verifica al control-plane.
  // Risposta SEMPRE generica (anti-enumeration), rate-limit stretto.
  fastify.post('/resend-verification', { config: { rateLimit: { max: 3, timeWindow: 3600000 } } }, async () => {
    return { data: { message: 'Se l\'indirizzo è registrato, riceverai un\'email a breve.' } }
  })

  // Get current user
  fastify.get('/me', { preHandler: requireAuth }, async (req) => {
    return { data: req.user }
  })

  // ─── POST /device/enroll-code — l'owner genera il QR per collegare un telefono ───
  // requireRole('owner'): non è un'azione da cameriere. Il codice in CHIARO esce da qui
  // una volta sola (dentro il QR mostrato sullo schermo dell'owner); a riposo c'è l'HMAC.
  fastify.post('/device/enroll-code', { preHandler: requireRole('owner') }, async (req, reply) => {
    const code = randomBytes(32).toString('base64url')
    const codeHash = hashEnrollCode(code)
    const expiresAt = new Date(Date.now() + ENROLL_CODE_TTL_MS)

    await db.insert(deviceEnrollCodes).values({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      codeHash,
      expiresAt,
    })

    // Pulizia opportunistica: i codici scaduti non servono più a nulla e la tabella
    // non deve crescere per sempre (un QR generato e mai usato è la norma, non l'eccezione).
    try {
      await db.delete(deviceEnrollCodes).where(sql`${deviceEnrollCodes.expiresAt} < now() - interval '1 day'`)
    } catch { /* best-effort */ }

    // Codice nel FRAGMENT: non viene mai inviato al server né finisce nei log di accesso.
    const enrollUrl = `${webOrigin()}/owner/#enroll=${code}`
    let qrDataUrl: string | null = null
    try {
      qrDataUrl = await qrWithOctopus(enrollUrl, 360)
    } catch (err) {
      // Il QR è una comodità: se il rendering fallisce restano URL e codice, che
      // l'owner può digitare a mano (ripiego previsto dall'Exit del piano F2.1).
      req.log.warn({ err }, 'device enroll: QR non generato')
    }

    return reply.send({
      data: { code, enrollUrl, qrDataUrl, expiresInSeconds: Math.floor(ENROLL_CODE_TTL_MS / 1000) },
    })
  })

  // ─── GET /devices — i telefoni arruolati del ristorante ───────────────────────────
  // Owner-only e scoped al ristorante (anti cross-tenant come ogni altra route). Non
  // espone MAI il token: solo ciò che serve a riconoscere quale telefono revocare.
  fastify.get('/devices', { preHandler: requireRole('owner') }, async (req) => {
    const staff = await db.select({ id: users.id, name: users.name })
      .from(users).where(eq(users.restaurantId, req.user!.restaurantId))
    const staffIds = staff.map(s => s.id)
    if (!staffIds.length) return { data: [] }
    const rows = await db.select({
      id: sessions.id,
      userId: sessions.userId,
      deviceName: sessions.deviceName,
      devicePlatform: sessions.devicePlatform,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      expiresAt: sessions.expiresAt,
    }).from(sessions)
      .where(and(inArray(sessions.userId, staffIds), eq(sessions.kind, 'mobile'), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.createdAt))
    const nameOf = new Map(staff.map(s => [s.id, s.name]))
    return { data: rows.map(r => ({ ...r, userName: nameOf.get(r.userId) ?? null })) }
  })

  // ─── DELETE /devices/:id — revoca immediata di un telefono ────────────────────────
  // La revoca è efficace ovunque e subito: requireAuth interroga `sessions` a ogni
  // richiesta, e il socket si rivalida entro 60 s (socket/handlers.ts).
  fastify.delete('/devices/:id', { preHandler: requireRole('owner') }, async (req, reply) => {
    const { id } = req.params as { id: string }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Dispositivo non trovato' } })
    }
    const staff = await db.select({ id: users.id }).from(users).where(eq(users.restaurantId, req.user!.restaurantId))
    const staffIds = staff.map(s => s.id)
    if (!staffIds.length) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Dispositivo non trovato' } })
    const [deleted] = await db.delete(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.kind, 'mobile'), inArray(sessions.userId, staffIds)))
      .returning({ id: sessions.id })
    if (!deleted) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Dispositivo non trovato' } })
    return { data: { success: true } }
  })

  // Logout
  fastify.post('/logout', { preHandler: requireAuth }, async (req, reply) => {
    const token = req.cookies?.[SESSION_COOKIE] ?? req.headers.authorization?.replace('Bearer ', '')
    if (token) await db.delete(sessions).where(eq(sessions.token, token))
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return { data: { success: true } }
  })
}
