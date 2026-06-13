import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import fastifyStatic from '@fastify/static'
import { resolve } from 'path'
import { mkdirSync } from 'fs'
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
import { aiRoutes } from './routes/ai.js'

const PORT = Number(process.env['PORT'] ?? 3001)
const JWT_SECRET = process.env['JWT_SECRET']
if (!JWT_SECRET) throw new Error('JWT_SECRET env variable is required')

const fastify = Fastify({ logger: { level: 'error' } })

// Security headers. CSP su misura per un'API: nessuna sorgente di default, solo
// immagini self+data (per /uploads). Niente upgrade-insecure-requests (romperebbe
// l'http locale). CORP cross-origin così le app Next (origine diversa) caricano le
// immagini di /uploads.
await fastify.register(helmet, {
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      imgSrc: ["'self'", 'data:'],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
})

// CORS — solo origini note
await fastify.register(cors, {
  origin: [
    'http://localhost:3000',
    'http://localhost:3002',
    process.env['DASHBOARD_URL'] ?? 'http://localhost:3000',
    process.env['CLIENT_BASE_URL'] ?? 'http://localhost:3002',
  ],
  credentials: true,
})

await fastify.register(jwt, { secret: JWT_SECRET })
await fastify.register(cookie, { secret: JWT_SECRET })
await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })

const UPLOADS_DIR = resolve(process.env['UPLOADS_DIR'] ?? './uploads')
mkdirSync(UPLOADS_DIR, { recursive: true })
await fastify.register(fastifyStatic, { root: UPLOADS_DIR, prefix: '/uploads/', decorateReply: false })

// Rate limiting globale
await fastify.register(rateLimit, {
  global: true,
  max: 100,          // max 100 req per finestra
  timeWindow: 60000, // 1 minuto
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
await fastify.register(aiRoutes, { prefix: '/api/ai' })

// Attach Socket.io to Fastify's underlying HTTP server AFTER ready()
await fastify.ready()

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3002',
  process.env['DASHBOARD_URL'] ?? 'http://localhost:3000',
  process.env['CLIENT_BASE_URL'] ?? 'http://localhost:3002',
]

export const io = new SocketServer(fastify.server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  pingTimeout: 60000,
})
setupSocketHandlers(io)

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`Tako server running on http://0.0.0.0:${PORT}`)
} catch (err) {
  console.error(err)
  process.exit(1)
}
