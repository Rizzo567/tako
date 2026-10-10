import Fastify, { type FastifyServerOptions } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import fastifyStatic from '@fastify/static'
import { resolve, dirname } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { Server as SocketServer } from 'socket.io'
import { setupSocketHandlers } from './socket/handlers.js'
import { authRoutes } from './routes/auth.js'
import { restaurantRoutes } from './routes/restaurants.js'
import { webLocationRoutes } from './routes/web-locations.js'
import { menuWorkspaceRoutes } from './routes/menu-workspace.js'
import { webAccountRoutes } from './routes/web-accounts.js'
import { menuRoutes } from './routes/menu.js'
import { tableRoutes } from './routes/tables.js'
import { orderRoutes } from './routes/orders.js'
import { billRoutes } from './routes/bills.js'
import { inventoryRoutes } from './routes/inventory.js'
import { statsRoutes } from './routes/stats.js'
import { customerRoutes } from './routes/customer.js'
import { uploadRoutes } from './routes/uploads.js'
import { staffRoutes } from './routes/staff.js'
import { insightsRoutes } from './routes/insights.js'
import { systemRoutes } from './routes/system.js'
import { reservationRoutes } from './routes/reservations.js'
import { shiftRoutes } from './routes/shifts.js'
import { menuI18nRoutes } from './routes/menu-i18n.js'
import { aiOwnerRoutes } from './routes/ai-owner.js'
import { startConnectivityMonitor, onConnectivityChange } from './lib/connectivity.js'
import { isCloudMode } from './cloud/config.js'
import { startCloudServer } from './cloud/server.js'
import { remoteStorageEnabled } from './lib/remote-image-store.js'
import { remoteImageRoutes } from './routes/remote-images.js'
import { isWebMode, validateWebRuntime, webOrigin, webBoundary, webServerHost, webSocketOrigin } from './lib/web-runtime.js'

// Socket.io condiviso con le route (import { io } from '../index.js'). Assegnato
// dentro startServer(); live binding ESM → le route lo vedono valorizzato a runtime.
export let io: SocketServer

// Avvio del server (chiamata da bootstrap.ts e cloud/entry.ts).
export async function startServer(): Promise<void> {
  // TAKO_MODE=cloud: control-plane identità del sito (route cloud, CORS allowlist,
  // rate-limit Redis). Ogni altro avvio è la webapp ospitata (TAKO_MODE=web).
  if (isCloudMode()) {
    await startCloudServer()
    return
  }

  if (!isWebMode()) throw new Error('TAKO_MODE=web is required: the local appliance runtime has been removed')
  validateWebRuntime()
  const publicOrigin = webOrigin()
  const PORT = Number(process.env['PORT'] ?? 3001)
  const JWT_SECRET = process.env['JWT_SECRET']
  if (!JWT_SECRET) throw new Error('JWT_SECRET env variable is required')
  // Lo stesso segreto firma sessioni staff, JWT tavolo e cookie firmati: un valore
  // debole permette il forging. In produzione esigi ≥32 caratteri.
  if (process.env['NODE_ENV'] === 'production' && JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET deve essere lungo almeno 32 caratteri in produzione')
  }

  const fastifyOptions: FastifyServerOptions = {
    logger: { level: 'error' },
    ...(process.env['TRUST_PROXY'] ? { trustProxy: process.env['TRUST_PROXY'].split(',').map(value => value.trim()).filter(Boolean) } : {}),
  }
  const fastify = Fastify(fastifyOptions)

  // Error handler globale: logga l'errore completo server-side e sanifica i 5xx
  // (gli errori Postgres/Drizzle non incapsulati trapelerebbero nomi colonne,
  // constraint e dettagli di query). I 4xx legittimi (jwt 401, multipart 413,
  // validazioni) portano statusCode<500 e message benigni → restano invariati.
  fastify.setErrorHandler((error, request, reply) => {
    const e = error as { statusCode?: number; code?: string; message?: string }
    const status = e.statusCode ?? 500
    request.log.error({ err: error }, 'unhandled route error')
    if (status < 500) {
      return reply.code(status).send({ error: { code: e.code ?? 'BAD_REQUEST', message: e.message } })
    }
    return reply.code(500).send({ error: { code: 'INTERNAL', message: 'Errore interno' } })
  })

  // CORS e Socket.io: solo l'origine pubblica della webapp (o richieste senza Origin).
  const resolveCorsOrigin = (origin?: string): boolean => !origin || origin === publicOrigin

// Security headers. La dashboard staff è precompilata (niente Babel/eval in pagina):
// script solo same-origin, realtime solo verso l'origine pubblica.
await fastify.register(helmet, {
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", webSocketOrigin()],
      frameSrc: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
})

await fastify.register(cors, { origin: (origin, cb) => cb(null, resolveCorsOrigin(origin)), credentials: true })

await fastify.register(jwt, { secret: JWT_SECRET })
await fastify.register(cookie, { secret: JWT_SECRET })
await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })

const UPLOADS_DIR = resolve(process.env['UPLOADS_DIR'] ?? './uploads')
mkdirSync(UPLOADS_DIR, { recursive: true })
if (remoteStorageEnabled()) await fastify.register(remoteImageRoutes)
else await fastify.register(fastifyStatic, { root: UPLOADS_DIR, prefix: '/uploads/', decorateReply: false })

// Dashboard staff statica servita DALLO STESSO server. Same-origin: /api, /socket.io
// e /uploads sono sullo stesso host. STAFF_DIR punta alla build precompilata
// (start-webapp / Render); in sua assenza si ripiega sul sorgente dashboard.
const currentDir = dirname(fileURLToPath(import.meta.url))
const staffCandidates = [
  process.env['STAFF_DIR'],
  resolve(currentDir, '../../dashboard/public/staff'),
].filter((p): p is string => !!p).map((p) => resolve(p))
const STAFF_DIR = staffCandidates.find((p) => existsSync(p)) ?? staffCandidates[staffCandidates.length - 1]!
if (existsSync(STAFF_DIR)) {
  await fastify.register(fastifyStatic, { root: STAFF_DIR, prefix: '/staff/', decorateReply: false })
  // La root manda alla dashboard (la stessa UX del Next shell, ora senza Next).
  fastify.get('/', async (_req, reply) => reply.redirect('/staff/index.html'))
  console.log(`Dashboard staff servita da ${STAFF_DIR} su /staff/`)
} else {
  console.warn(`STAFF_DIR non trovato (${STAFF_DIR}); dashboard statica non servita.`)
}

// Rate limiting globale. In dev il loopback (test, dashboard locale, /health) è
// esentato: il limite per-IP serve contro abusi esterni, non contro la macchina
// stessa. In produzione resta attivo per tutti.
const rlAllowList = process.env['NODE_ENV'] === 'production' ? [] : ['127.0.0.1', '::1']
await fastify.register(rateLimit, {
  global: true,
  max: 100,          // max 100 req per finestra
  timeWindow: 60000, // 1 minuto
  keyGenerator: (req) => req.ip,
  allowList: (req) => rlAllowList.includes(req.ip),
  // @fastify/rate-limit fa `throw errorResponseBuilder(...)`: il valore restituito deve
  // essere un ERRORE con statusCode, altrimenti il nostro error handler globale non trova
  // `statusCode`, lo classifica come 5xx e risponde 500 invece di 429. Bug pre-esistente
  // mai visibile in dev (il loopback era esente) e riemerso col tunnel, dove il limite si
  // raggiunge davvero. `code`/`message` producono l'envelope { error: { code, message } }.
  errorResponseBuilder: (_req, ctx) => {
    const err = new Error('Troppe richieste. Riprova tra un minuto.') as Error & { statusCode: number; code: string }
    err.statusCode = ctx.statusCode ?? 429
    err.code = 'RATE_LIMIT'
    return err
  },
})

// Confine del servizio web: le funzioni della vecchia appliance locale rispondono con
// un 404 esplicito e le scritture da origini estranee sono rifiutate (lib/web-runtime.ts).
fastify.addHook('onRequest', webBoundary(publicOrigin))

// Health check
fastify.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

// Routes
await fastify.register(authRoutes, { prefix: '/api/auth' })
await fastify.register(restaurantRoutes, { prefix: '/api/restaurants' })
await fastify.register(menuRoutes, { prefix: '/api/menus' })
await fastify.register(menuWorkspaceRoutes, { prefix: '/api/menu-workspace' })
await fastify.register((await import('./routes/brand-from-site.js')).brandFromSiteRoutes, { prefix: '/api/menu-workspace' })
await fastify.register(webAccountRoutes, { prefix: '/api/web-accounts' })
await fastify.register(webLocationRoutes, { prefix: '/api/web-locations' })
await fastify.register(tableRoutes, { prefix: '/api/tables' })
await fastify.register(orderRoutes, { prefix: '/api/orders' })
await fastify.register(billRoutes, { prefix: '/api/bills' })
await fastify.register(inventoryRoutes, { prefix: '/api/inventory' })
await fastify.register(statsRoutes, { prefix: '/api/stats' })
await fastify.register(customerRoutes, { prefix: '/api/customer' })
await fastify.register(uploadRoutes, { prefix: '/api/uploads' })
await fastify.register(staffRoutes, { prefix: '/api/staff' })
await fastify.register(insightsRoutes, { prefix: '/api/insights' })
await fastify.register(systemRoutes, { prefix: '/api/system' })
await fastify.register(reservationRoutes, { prefix: '/api/reservations' })
await fastify.register(shiftRoutes, { prefix: '/api/shifts' })
await fastify.register(menuI18nRoutes, { prefix: '/api/customer' })
await fastify.register(aiOwnerRoutes, { prefix: '/api/ai/owner' })

// Attach Socket.io to Fastify's underlying HTTP server AFTER ready()
await fastify.ready()

  io = new SocketServer(fastify.server, {
    cors: {
      origin: (origin, cb) => cb(null, resolveCorsOrigin(origin ?? undefined)),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    // Socket.io si attacca al server HTTP sotto Fastify e non passa dagli hook onRequest:
    // l'handshake accetta solo l'origine pubblica della webapp.
    allowRequest: (request, cb) => cb(null, request.headers.origin === publicOrigin),
  })
  setupSocketHandlers(io, fastify)
  try {
    const serverHost = webServerHost()
    await fastify.listen({ port: PORT, host: serverHost })
    console.log(`Tako server running on http://${serverHost}:${PORT}`)
    // Monitor connettività internet: stato online/offline → badge dashboard/PWA + fast-fail
    // delle funzioni internet.
    startConnectivityMonitor()
    onConnectivityChange((online) => { try { io?.emit('connectivity', { online }) } catch { /* noop */ } })
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
