import Fastify from 'fastify'
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
import { printRoutes } from './routes/print.js'
import { systemRoutes } from './routes/system.js'
import { startMdns } from './lib/mdns.js'

const PORT = Number(process.env['PORT'] ?? 3001)
const JWT_SECRET = process.env['JWT_SECRET']
if (!JWT_SECRET) throw new Error('JWT_SECRET env variable is required')
// Lo stesso segreto firma sessioni staff, JWT tavolo e cookie firmati: un valore
// debole permette il forging. In produzione esigi ≥32 caratteri.
if (process.env['NODE_ENV'] === 'production' && JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET deve essere lungo almeno 32 caratteri in produzione')
}

const fastify = Fastify({ logger: { level: 'error' } })

// Security headers. Da quando il server serve anche la dashboard staff (stessa
// origine), la CSP deve permettere alla SPA di girare: script self + inline/eval
// (Babel-in-browser), stili inline, immagini data/blob, connessioni ws per il
// realtime. Threat model locale (LAN, stessa origine). Le risposte API restano JSON.
await fastify.register(helmet, {
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'http:', 'https:'],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
})

// CORS — Tako è un'appliance locale: il server È l'origine di tutti i client
// (dashboard same-origin, tablet/telefoni in LAN via tako.local o IP). Riflette
// l'origine con credenziali; la portata resta limitata dalla rete locale/firewall.
await fastify.register(cors, { origin: true, credentials: true })

await fastify.register(jwt, { secret: JWT_SECRET })
await fastify.register(cookie, { secret: JWT_SECRET })
await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })

const UPLOADS_DIR = resolve(process.env['UPLOADS_DIR'] ?? './uploads')
mkdirSync(UPLOADS_DIR, { recursive: true })
await fastify.register(fastifyStatic, { root: UPLOADS_DIR, prefix: '/uploads/', decorateReply: false })

// Dashboard staff statica servita DALLO STESSO server. Same-origin: /api, /socket.io
// e /uploads sono sullo stesso host → niente reverse-proxy/rewrite Next. Nel bundle
// desktop STAFF_DIR punta alle risorse impacchettate; in dev al sorgente dashboard.
const currentDir = dirname(fileURLToPath(import.meta.url))
const STAFF_DIR = process.env['STAFF_DIR']
  ? resolve(process.env['STAFF_DIR'])
  : resolve(currentDir, '../../dashboard/public/staff')
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
  allowList: rlAllowList,
  errorResponseBuilder: () => ({
    error: { code: 'RATE_LIMIT', message: 'Troppe richieste. Riprova tra un minuto.' },
  }),
})

// Health check
fastify.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

// Routes
await fastify.register(authRoutes, { prefix: '/api/auth' })
await fastify.register(restaurantRoutes, { prefix: '/api/restaurants' })
await fastify.register(menuRoutes, { prefix: '/api/menus' })
await fastify.register(tableRoutes, { prefix: '/api/tables' })
await fastify.register(orderRoutes, { prefix: '/api/orders' })
await fastify.register(billRoutes, { prefix: '/api/bills' })
await fastify.register(inventoryRoutes, { prefix: '/api/inventory' })
await fastify.register(statsRoutes, { prefix: '/api/stats' })
await fastify.register(customerRoutes, { prefix: '/api/customer' })
await fastify.register(uploadRoutes, { prefix: '/api/uploads' })
await fastify.register(staffRoutes, { prefix: '/api/staff' })
await fastify.register(insightsRoutes, { prefix: '/api/insights' })
await fastify.register(printRoutes, { prefix: '/api/print' })
await fastify.register(systemRoutes, { prefix: '/api/system' })

// Attach Socket.io to Fastify's underlying HTTP server AFTER ready()
await fastify.ready()

export const io = new SocketServer(fastify.server, {
  cors: { origin: true, methods: ['GET', 'POST'], credentials: true },
  pingTimeout: 60000,
})
setupSocketHandlers(io)

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`Tako server running on http://0.0.0.0:${PORT}`)
  // Annuncia tako.local sulla LAN (best-effort): i dispositivi si collegano senza IP.
  startMdns()
} catch (err) {
  console.error(err)
  process.exit(1)
}
