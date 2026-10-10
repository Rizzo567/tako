import { db, reservations, tables, restaurants } from '@tako/db'
import { and, eq, ne, sql } from 'drizzle-orm'

export type ReservationExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]
export type CapacityInput = { restaurantId: string; tableId?: string | null; startsAt: Date; durationMin: number; partySize: number; excludeId?: string; status?: string }

/** All reservation writes take this lock BEFORE any table lock. */
export async function lockReservationCapacity(tx: ReservationExecutor, restaurantId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'resv-capacity:' + restaurantId}))`)
}

export async function checkReservationCapacity(tx: ReservationExecutor, input: CapacityInput): Promise<{ code: string; message: string } | null> {
  if (['cancelled', 'no_show'].includes(input.status ?? 'requested')) return null
  const seating = await tx.select({ id: tables.id, seats: tables.seats }).from(tables)
    .where(and(eq(tables.restaurantId, input.restaurantId), eq(tables.active, true)))
  if (input.tableId) {
    const table = seating.find((row) => row.id === input.tableId)
    if (!table) return { code: 'TABLE_NOT_AVAILABLE', message: 'Tavolo non disponibile.' }
    if (input.partySize > table.seats) return { code: 'TABLE_CAPACITY', message: 'Il gruppo supera i posti del tavolo.' }
  }
  const [restaurant] = await tx.select({ settings: restaurants.settings }).from(restaurants).where(eq(restaurants.id, input.restaurantId)).limit(1)
  const configured = Number((restaurant?.settings as Record<string, unknown> | undefined)?.reservationCapacity)
  const seatCount = seating.reduce((sum, table) => sum + table.seats, 0)
  const limit = Number.isInteger(configured) && configured > 0 ? Math.min(configured, seatCount) : seatCount
  if (!limit || input.partySize > limit) return { code: 'RESERVATION_CAPACITY', message: 'Posti disponibili insufficienti.' }
  const start = input.startsAt.getTime(), end = start + input.durationMin * 60000
  const current = await tx.select().from(reservations).where(and(eq(reservations.restaurantId, input.restaurantId), ne(reservations.status, 'cancelled'), ne(reservations.status, 'no_show')))
  // Sweep intersections, rather than summing all bookings which touch the range:
  // two disjoint bookings inside a long requested interval do not coexist.
  const events: [number, number][] = [[start, input.partySize], [end, -input.partySize]]
  for (const row of current) {
    if (row.id === input.excludeId) continue
    const from = Math.max(start, row.startsAt.getTime()), until = Math.min(end, row.startsAt.getTime() + row.durationMin * 60000)
    if (from < until) events.push([from, row.partySize], [until, -row.partySize])
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]) // departures before arrivals
  let occupants = 0
  for (const [, delta] of events) { occupants += delta; if (occupants > limit) return { code: 'RESERVATION_CAPACITY', message: 'La fascia oraria ha esaurito i posti disponibili.' } }
  return null
}

export function nextCalendarDay(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) throw new Error('Invalid calendar date')
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (date.toISOString().slice(0, 10) !== day) throw new Error('Invalid calendar date')
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

/** Strict local clock conversion. Reject DST gaps and ambiguous repeated times. */
export function reservationLocalInstant(day: string, time: string, timezone: string): Date {
  nextCalendarDay(day)
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Invalid local time')
  const nominal = Date.parse(`${day}T${time}:00Z`)
  const format = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const matches: Date[] = []
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const candidate = new Date(nominal + offset * 60000)
    const parts = Object.fromEntries(format.formatToParts(candidate).map((part) => [part.type, part.value]))
    if (`${parts.year}-${parts.month}-${parts.day}` === day && `${parts.hour}:${parts.minute}` === time) matches.push(candidate)
  }
  if (matches.length !== 1) throw new Error(matches.length ? 'Ambiguous local time: explicit offset required' : 'Nonexistent local time')
  return matches[0]!
}
