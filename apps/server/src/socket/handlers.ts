import type { Server, Socket } from 'socket.io'
import type { FastifyInstance } from 'fastify'
import { db, sessions, users, tables, bills } from '@tako/db'
import { eq, gt, gte, and } from 'drizzle-orm'
import { SESSION_COOKIE, TABLE_COOKIE } from '../lib/cookies.js'

// Cap di room per-socket: un socket legittimo entra in al massimo 1-3 room
// (restaurant per lo staff, table+menu per il cliente). Il limite evita la crescita
// illimitata della Map in-memory dell'adapter via flood di join.
const MAX_ROOMS_PER_SOCKET = 20

async function verifyStaffToken(token: string): Promise<{ restaurantId: string } | null> {
  const [session] = await db
    .select({ restaurantId: users.restaurantId })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    // active=true: una sessione residua di un utente disattivato/licenziato viene
    // rifiutata subito (il loop di rivalidazione del socket chiude la connessione).
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()), eq(users.active, true)))
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

export function setupSocketHandlers(io: Server, fastify: FastifyInstance) {
  io.on('connection', (socket: Socket) => {
    // Staff: join restaurant room. Auth via cookie HttpOnly (tako_session) inviato
    // nell'handshake — reload-safe; il token passato come argomento resta come
    // fallback (es. cookie cross-site bloccati). In entrambi i casi il token deve
    // corrispondere al restaurantId richiesto.
    socket.on('join:restaurant', async (restaurantId: string, token?: string) => {
      if (typeof restaurantId !== 'string') return
      if (socket.rooms.size >= MAX_ROOMS_PER_SOCKET) return
      const authToken = cookieFromHandshake(socket, SESSION_COOKIE) ?? (typeof token === 'string' ? token : null)
      if (!authToken) return
      const staff = await verifyStaffToken(authToken)
      if (!staff || staff.restaurantId !== restaurantId) return
      socket.join(`restaurant:${restaurantId}`)
      // Rivalida periodicamente la sessione staff: dopo logout/scadenza la riga
      // sessions sparisce, quindi il socket va chiuso entro ~60s invece di continuare
      // a ricevere eventi live (order:new, inventory:alert, waiter:called...).
      socket.data.authToken = authToken
      if (!socket.data.revalidate) {
        socket.data.revalidate = setInterval(async () => {
          try {
            const ok = await verifyStaffToken(socket.data.authToken)
            if (!ok || ok.restaurantId !== restaurantId) {
              socket.leave(`restaurant:${restaurantId}`)
              socket.disconnect(true)
            }
          } catch { /* errore DB transitorio: ritenta al prossimo tick */ }
        }, 60_000)
      }
    })

    // Customer: join table room for order tracking. Vincolato al JWT del tavolo
    // (cookie tako_table, scoped a tableId/restaurantId): senza questa verifica
    // chiunque conoscesse un tableId poteva iscriversi alla room di QUALSIASI tavolo
    // (anche di un altro ristorante) e intercettare gli eventi order:updated.
    socket.on('join:table', async (tableId: string) => {
      if (typeof tableId !== 'string' || tableId.length > 100) return
      if (socket.rooms.size >= MAX_ROOMS_PER_SOCKET) return
      const token = cookieFromHandshake(socket, TABLE_COOKIE)
      if (!token) return
      let payload: { restaurantId?: string; tableId?: string; qrToken?: string; visitStart?: number }
      try {
        payload = fastify.jwt.verify(token) as { restaurantId?: string; tableId?: string; qrToken?: string; visitStart?: number }
      } catch {
        return
      }
      if (payload.tableId !== tableId) return // solo la propria room (le sessioni asporto non hanno tableId)
      // Difesa aggiuntiva: il qrToken del JWT deve combaciare con quello CORRENTE del
      // tavolo (copre la rotazione MANUALE via /qr/refresh).
      const [table] = await db.select({ qrToken: tables.qrToken, restaurantId: tables.restaurantId }).from(tables).where(eq(tables.id, tableId)).limit(1)
      if (!table || table.qrToken !== payload.qrToken) return
      // M6: revoca per-VISITA senza toccare il qrToken stampato. Se un conto del tavolo
      // è stato chiuso DOPO l'emissione di questo JWT (visitStart), la visita è finita
      // → il cliente precedente non deve più ricevere gli eventi order:updated.
      if (payload.visitStart) {
        const [closedSince] = await db.select({ id: bills.id }).from(bills)
          .where(and(
            eq(bills.restaurantId, table.restaurantId),
            eq(bills.tableId, tableId),
            eq(bills.status, 'closed'),
            gte(bills.closedAt!, new Date(payload.visitStart)),
          )).limit(1)
        if (closedSince) return
      }
      socket.join(`table:${tableId}`)
      // Rivalida periodicamente: (a) scadenza JWT (4h) e (b) M6 fine-visita (conto
      // chiuso dopo visitStart). In entrambi i casi il socket esce dalla room e viene
      // chiuso entro ~60s, così l'iscrizione non sopravvive al token né viene condivisa
      // col cliente successivo dello stesso tavolo (che riscansiona e ottiene un nuovo JWT).
      socket.data.tableToken = token
      socket.data.tableVisitStart = payload.visitStart
      socket.data.tableRestaurantId = table.restaurantId
      if (!socket.data.revalidate) {
        socket.data.revalidate = setInterval(async () => {
          try {
            fastify.jwt.verify(socket.data.tableToken)
            if (socket.data.tableVisitStart) {
              const [closedSince] = await db.select({ id: bills.id }).from(bills)
                .where(and(
                  eq(bills.restaurantId, socket.data.tableRestaurantId),
                  eq(bills.tableId, tableId),
                  eq(bills.status, 'closed'),
                  gte(bills.closedAt!, new Date(socket.data.tableVisitStart)),
                )).limit(1)
              if (closedSince) { socket.leave(`table:${tableId}`); socket.disconnect(true) }
            }
          } catch {
            socket.leave(`table:${tableId}`)
            socket.disconnect(true)
          }
        }, 60_000)
      }
    })

    // Customer: join the PUBLIC menu room of a restaurant. Riceve solo eventi menu
    // (disponibilità/prezzi), MAI eventi staff (ordini, conti, cameriere): quelli
    // restano nella room privata restaurant:{id}. Non autenticato by design.
    socket.on('join:menu', (restaurantId: string) => {
      if (typeof restaurantId !== 'string' || restaurantId.length > 100) return
      if (socket.rooms.size >= MAX_ROOMS_PER_SOCKET) return
      socket.join(`menu:${restaurantId}`)
    })

    socket.on('disconnect', () => {
      if (socket.data.revalidate) clearInterval(socket.data.revalidate)
    })
  })
}
