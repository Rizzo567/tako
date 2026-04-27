import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
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

const PORT = Number(process.env['PORT'] ?? 3001)
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'tako-super-secret-change-in-production'

const fastify = Fastify({ logger: false })

await fastify.register(cors, { origin: true })
await fastify.register(jwt, { secret: JWT_SECRET })
await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })

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

// Attach Socket.io to Fastify's underlying HTTP server AFTER ready()
await fastify.ready()

export const io = new SocketServer(fastify.server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
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
