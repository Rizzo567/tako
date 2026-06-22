import type { Server, Socket } from 'socket.io'
import { db, sessions, users } from '@tako/db'
import { eq, gt, and } from 'drizzle-orm'
import { SESSION_COOKIE } from '../lib/cookies.js'

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

// Estrae un cookie dall'header handshake del socket (cookie-auth staff).
function cookieFromHandshake(socket: Socket, name: string): string | null {
  const raw = socket.handshake.headers.cookie
  if (!raw) return null
  for (const part of raw.split(';')) {
    const i = part.indexOf('=')
    if (i === -1) continue
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return null
}

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    // Staff: join restaurant room. Auth via cookie HttpOnly (tako_session) inviato
    // nell'handshake — reload-safe; il token passato come argomento resta come
    // fallback (es. cookie cross-site bloccati). In entrambi i casi il token deve
    // corrispondere al restaurantId richiesto.
    socket.on('join:restaurant', async (restaurantId: string, token?: string) => {
      if (typeof restaurantId !== 'string') return
      const authToken = cookieFromHandshake(socket, SESSION_COOKIE) ?? (typeof token === 'string' ? token : null)
      if (!authToken) return
      const staff = await verifyStaffToken(authToken)
      if (!staff || staff.restaurantId !== restaurantId) return
      socket.join(`restaurant:${restaurantId}`)
    })

    // Customer: join table room for order tracking (unauthenticated by design — customer scanned QR)
    socket.on('join:table', (tableId: string) => {
      if (typeof tableId !== 'string' || tableId.length > 100) return
      socket.join(`table:${tableId}`)
    })

    // Customer: join the PUBLIC menu room of a restaurant. Riceve solo eventi menu
    // (disponibilità/prezzi), MAI eventi staff (ordini, conti, cameriere): quelli
    // restano nella room privata restaurant:{id}. Non autenticato by design.
    socket.on('join:menu', (restaurantId: string) => {
      if (typeof restaurantId !== 'string' || restaurantId.length > 100) return
      socket.join(`menu:${restaurantId}`)
    })

    socket.on('disconnect', () => {})
  })
}
