import { db, tables, rooms, reservations } from '@tako/db'
import { and, eq, ne } from 'drizzle-orm'
import type { ReservationExecutor } from './reservation-capacity.js'

export function overlapsReservation(start: Date, duration: number, row: { startsAt: Date | string; durationMin: number; status: string }) {
  if (row.status === 'cancelled') return false
  return start.getTime() < new Date(row.startsAt).getTime() + row.durationMin * 60000 && new Date(row.startsAt).getTime() < start.getTime() + duration * 60000
}

/** Called under the restaurant capacity lock, shared with every booking writer. */
export async function selectedReservationTableError(tx: ReservationExecutor, restaurantId: string, tableId: string, startsAt: Date, partySize: number, durationMin = 90) {
  const [table] = await tx.select({ id: tables.id, seats: tables.seats, roomId: tables.roomId }).from(tables).where(and(eq(tables.id, tableId), eq(tables.restaurantId, restaurantId), eq(tables.active, true))).limit(1)
  if (!table) return { code: 'TABLE_NOT_AVAILABLE', message: 'Tavolo non disponibile.' }
  if (table.roomId) {
    const [room] = await tx.select({ id: rooms.id }).from(rooms).where(and(eq(rooms.id, table.roomId), eq(rooms.restaurantId, restaurantId), eq(rooms.active, true))).limit(1)
    if (!room) return { code: 'TABLE_NOT_AVAILABLE', message: 'Sala non disponibile.' }
  }
  if (partySize > table.seats) return { code: 'TABLE_CAPACITY', message: 'Il gruppo supera i posti del tavolo.' }
  const bookings = await tx.select({ startsAt: reservations.startsAt, durationMin: reservations.durationMin, status: reservations.status }).from(reservations).where(and(eq(reservations.restaurantId, restaurantId), eq(reservations.tableId, tableId), ne(reservations.status, 'cancelled')))
  if (bookings.some(row => overlapsReservation(startsAt, durationMin, row))) return { code: 'RESERVATION_OVERLAP', message: 'Il tavolo è già prenotato in quella fascia oraria. Scegli un altro tavolo.' }
  return null
}

export async function publicReservationRooms(restaurantId: string, startsAt: Date, partySize: number, durationMin = 90, executor: ReservationExecutor = db) {
  const [roomRows, tableRows, bookings] = await Promise.all([
    executor.select({ id: rooms.id, name: rooms.name }).from(rooms).where(and(eq(rooms.restaurantId, restaurantId), eq(rooms.active, true))).orderBy(rooms.position),
    executor.select({ id: tables.id, roomId: tables.roomId, number: tables.number, seats: tables.seats, shape: tables.shape, posX: tables.posX, posY: tables.posY }).from(tables).where(and(eq(tables.restaurantId, restaurantId), eq(tables.active, true))),
    executor.select({ tableId: reservations.tableId, startsAt: reservations.startsAt, durationMin: reservations.durationMin, status: reservations.status }).from(reservations).where(and(eq(reservations.restaurantId, restaurantId), ne(reservations.status, 'cancelled'))),
  ])
  const busy = new Set(bookings.filter(row => overlapsReservation(startsAt, durationMin, row)).map(row => row.tableId))
  const project = (row: typeof tableRows[number]) => ({ id: row.id, number: row.number, seats: row.seats, shape: row.shape, posX: row.posX, posY: row.posY, available: row.seats >= partySize && !busy.has(row.id) })
  const result = roomRows.map(room => ({ ...room, tables: tableRows.filter(table => table.roomId === room.id).map(project) }))
  const unassigned = tableRows.filter(table => table.roomId === null)
  if (unassigned.length) result.push({ id: 'unassigned', name: 'Sala', tables: unassigned.map(project) })
  return result
}
