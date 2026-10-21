import { registerEdgeUploadAdmission } from './lib/edge-upload-admission.js'
import Fastify, { type FastifyServerOptions } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import { optionalDurableStore } from './lib/durable-rate-store.js'
import type { Server as SocketServer } from 'socket.io'
import { isWebMode, validateWebRuntime, webOrigin, webBoundary, webServerHost, webSocketOrigin } from './lib/web-runtime.js'

// Socket.io condiviso con le route (import { io } from '../index.js'). Assegnato
// dentro startServer(); live binding ESM → le route lo vedono valorizzato a runtime.
export let io: SocketServer

export type AppBuildOptions = { runtime?: 'node' | 'edge-spike' | 'edge-candidate' }
export const EDGE_SPIKE_CAPABILITIES = Object.freeze({ experimental: true, productionReady: false, supported: ['GET /health'], unsupported: ['authentication', 'restaurant/location/menu APIs', 'operational writes', 'realtime', 'uploads/QR/PDF', 'static files'] })

/** Build without a listener or realtime side effects. edge-spike is deliberately
 * health-only until the full provider parity gate passes; it cannot run in production. */
export async function createApp(options: AppBuildOptions = {}) {
  const edge = options.runtime === 'edge-spike' || options.runtime === 'edge-candidate'
  const candidate = options.runtime === 'edge-candidate'
  if (candidate && process.env['TAKO_EXECUTION_RUNTIME'] !== 'edge') throw new Error('Edge candidate requires TAKO_EXECUTION_RUNTIME=edge')
  if (edge && process.env['NODE_ENV'] === 'production') throw new Error('Experimental edge-spike cannot run in production')
  if (!isWebMode()) throw new Error('TAKO_MODE=web is required: the local appliance runtime has been removed')
  if (!edge) validateWebRuntime()
  const publicOrigin = webOrigin()
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
  if (!edge && process.env['TAKO_DURABLE_IMAGE_QUOTA'] === '1') {
    const { initializeNodeImageQuota } = await import('./lib/node-image-quota-initializer.js')
    const images = await initializeNodeImageQuota()
    if (images) fastify.addHook('onClose', async () => { await images.close() })
  }

  // Error handler globale: logga l'errore completo server-side e sanifica i 5xx
  // (gli errori Postgres/Drizzle non incapsulati trapelerebbero nomi colonne,
  // constraint e dettagli di query). I 4xx legittimi (jwt 401, multipart 413,
  // validazioni) portano statusCode<500 e message benigni → restano invariati.
  fastify.setErrorHandler((error, request, reply) => {
    const e = error as { statusCode?: number; code?: string; message?: string }
    const status = e.statusCode ?? 500
    request.log.error({ err: error }, 'unhandled route error')
    if (status === 503 && e.code === 'RATE_STORE_UNAVAILABLE') {
      return reply.code(503).send({ error: { code: e.code, message: 'Servizio temporaneamente non disponibile' } })
    }
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

// Edge serves the same immutable Storage images without loading codecs or local files.
if (edge) {
  const { remoteStorageEnabled } = await import('./lib/remote-image-store.js')
  if (remoteStorageEnabled()) {
    const { remoteImageRoutes } = await import('./routes/remote-images.js')
    await fastify.register(remoteImageRoutes)
  }
}

if (!edge) {
  const { resolve, dirname } = await import('node:path')
  const { mkdirSync, existsSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const { default: fastifyStatic } = await import('@fastify/static')
  const { remoteStorageEnabled } = await import('./lib/remote-image-store.js')
  const { remoteImageRoutes } = await import('./routes/remote-images.js')
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

}

// Rate limiting globale. In dev il loopback (test, dashboard locale, /health) è
// esentato: il limite per-IP serve contro abusi esterni, non contro la macchina
// stessa. In produzione resta attivo per tutti.
const durableRateStore = optionalDurableStore()
const rlAllowList = durableRateStore || process.env['NODE_ENV'] === 'production' ? [] : ['127.0.0.1', '::1']
await fastify.register(rateLimit, {
  ...(durableRateStore ? { store: durableRateStore } : {}),
  skipOnError: false,
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
if(candidate)registerEdgeUploadAdmission(fastify)

// Health check
fastify.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

if (!edge || candidate) {
// Operational candidate is still forbidden in production until hosted gates pass.
// Routes
await fastify.register((await import('./routes/twilio-menu.js')).twilioMenuRoutes, { prefix: '/api' })
await fastify.register((await import('./routes/auth.js')).authRoutes, { prefix: '/api/auth' })
await fastify.register((await import('./routes/restaurants.js')).restaurantRoutes, { prefix: '/api/restaurants' })
await fastify.register((await import('./routes/menu.js')).menuRoutes, { prefix: '/api/menus' })
await fastify.register((await import('./routes/menu-workspace.js')).menuWorkspaceRoutes, { prefix: '/api/menu-workspace' })
// Link fisso dei documenti PDF (21/10): pubblico, sempre dal menu pubblicato del momento.
await fastify.register((await import('./routes/menu-workspace.js')).publicMenuPdfRoutes, { prefix: '/api/public' })
await fastify.register((await import('./routes/menu-day-presets.js')).menuDayPresetRoutes, { prefix: '/api/menu-workspace/day-presets' })
await fastify.register((await import('./routes/menu-day-presets.js')).menuDayPresetCronRoutes, { prefix: '/api/day-presets-cron' })
await fastify.register((await import('./routes/brand-from-site.js')).brandFromSiteRoutes, { prefix: '/api/menu-workspace' })
await fastify.register((await import('./routes/web-accounts.js')).webAccountRoutes, { prefix: '/api/web-accounts' })
await fastify.register((await import('./routes/web-locations.js')).webLocationRoutes, { prefix: '/api/web-locations' })
await fastify.register((await import('./routes/agency.js')).agencyRoutes, { prefix: '/api/agency' })
await fastify.register((await import('./routes/agency-leads.js')).agencyLeadRoutes, { prefix: '/api/agency/leads' })
await fastify.register((await import('./routes/onboarding.js')).onboardingRoutes, { prefix: '/api' })
await fastify.register((await import('./routes/tables.js')).tableRoutes, { prefix: '/api/tables' })
await fastify.register((await import('./routes/orders.js')).orderRoutes, { prefix: '/api/orders' })
await fastify.register((await import('./routes/bills.js')).billRoutes, { prefix: '/api/bills' })
await fastify.register((await import('./routes/inventory.js')).inventoryRoutes, { prefix: '/api/inventory' })
await fastify.register((await import('./routes/stats.js')).statsRoutes, { prefix: '/api/stats' })
await fastify.register((await import('./routes/customer.js')).customerRoutes, { prefix: '/api/customer' })
await fastify.register((await import('./routes/uploads.js')).uploadRoutes, { prefix: '/api/uploads' })
await fastify.register((await import('./routes/staff.js')).staffRoutes, { prefix: '/api/staff' })
await fastify.register((await import('./routes/insights.js')).insightsRoutes, { prefix: '/api/insights' })
await fastify.register((await import('./routes/system.js')).systemRoutes, { prefix: '/api/system' })
await fastify.register((await import('./routes/reservations.js')).reservationRoutes, { prefix: '/api/reservations' })
await fastify.register((await import('./routes/shifts.js')).shiftRoutes, { prefix: '/api/shifts' })
await fastify.register((await import('./routes/menu-i18n.js')).menuI18nRoutes, { prefix: '/api/customer' })
await fastify.register((await import('./routes/ai-owner.js')).aiOwnerRoutes, { prefix: '/api/ai/owner' })

}
await fastify.ready()
return fastify
}

/** Node listener preserves the existing hosted/local web runtime. */
export async function startServer(): Promise<void> {
  const { isCloudMode } = await import('./cloud/config.js')
  if (isCloudMode()) { const { startCloudServer } = await import('./cloud/server.js'); await startCloudServer(); return }
  const fastify = await createApp()
  const publicOrigin = webOrigin()
  const PORT = Number(process.env['PORT'] ?? 3001)
  const resolveCorsOrigin = (origin?: string): boolean => !origin || origin === publicOrigin
  const { Server: SocketServer } = await import('socket.io')
  const { setupSocketHandlers } = await import('./socket/handlers.js')
  const { startConnectivityMonitor, onConnectivityChange } = await import('./lib/connectivity.js')
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
