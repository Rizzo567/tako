import type { Server, Socket } from 'socket.io'
import { db, sessions, users } from '@tako/db'
import { eq, gt, and } from 'drizzle-orm'

async function verifyStaffToken(token: string): Promise<{ restaurantId: string } | null> {
  const [session] = await db
    .select({ restaurantId: users.restaurantId })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1)
  if (!session?.restaurantId) return null
  return { restaurantId: session.restaurantId }
}

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    // Staff: join restaurant room — token must match the restaurantId being joined
    socket.on('join:restaurant', async (restaurantId: string, token: string) => {
      if (typeof restaurantId !== 'string' || typeof token !== 'string') return
      const staff = await verifyStaffToken(token)
      if (!staff || staff.restaurantId !== restaurantId) return
      socket.join(`restaurant:${restaurantId}`)
    })

    // Customer: join table room for order tracking (unauthenticated by design — customer scanned QR)
    socket.on('join:table', (tableId: string) => {
      if (typeof tableId !== 'string' || tableId.length > 100) return
      socket.join(`table:${tableId}`)
    })

    socket.on('disconnect', () => {})
  })
}
