// Letture autenticate condivise tra le route Fastify (servizio operativo) e la
// read-edge leggera (lib/edge-read-handler.ts). UNA sola implementazione: la route
// e la read-edge chiamano queste funzioni con lo stesso utente e la stessa query,
// quindi le due risposte non possono divergere. Nessun side effect qui dentro:
// niente socket, niente scritture — solo SELECT.
import { z } from 'zod'
import { db, orders, orderItems, rooms, tables, waiterCalls, reservations, restaurants, bills, tableSessions } from '@tako/db'
import { eq, and, inArray, isNull, desc, gte, lte, lt, asc } from 'drizzle-orm'
import { round2, restaurantTimezone, dayKeyInTz, dayStartInTz, dayEndInTz } from './billing.js'
import { nextCalendarDay } from './reservation-capacity.js'
import { isAgencyUser } from './agency-access.js'

/** Risposta di una lettura: codice HTTP e corpo JSON, identici sui due percorsi. */
export type ReadResult = { status: number; body: unknown }
const ok = (body: unknown): ReadResult => ({ status: 200, body })

// ─────────────────────────────── Ordini ───────────────────────────────
// Paginazione a CURSORE per /active e /history (piano F2.3). È ADDITIVA: senza
// parametri le due route rispondono esattamente come prima (tutti i risultati, più
// recenti prima), quindi la dashboard staff non cambia di una riga. Il cursore è
// `createdAt` — le liste sono già ordinate per quello — e non un offset: con ordini
// che arrivano mentre si scorre, un OFFSET salterebbe o duplicherebbe righe.
const MAX_PAGE = 200

export function pageParams(query: unknown): { limit: number | null; before: Date | null } {
  const q = (query ?? {}) as { limit?: string; before?: string }
  const rawLimit = q.limit !== undefined ? Number(q.limit) : NaN
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_PAGE) : null
  const beforeDate = q.before ? new Date(q.before) : null
  const before = beforeDate && !isNaN(beforeDate.getTime()) ? beforeDate : null
  return { limit, before }
}

/** GET /api/orders/active */
export async function readActiveOrders(restaurantId: string, query: unknown): Promise<ReadResult> {
  const { limit, before } = pageParams(query)
  const where = and(
    eq(orders.restaurantId, restaurantId),
    inArray(orders.status, ['pending', 'confirmed', 'preparing', 'ready']),
    ...(before ? [lt(orders.createdAt, before)] : []),
  )
  const base = db.select().from(orders).where(where).orderBy(desc(orders.createdAt))
  const activeOrders = limit ? await base.limit(limit) : await base

  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, activeOrders.map(o => o.id)))
  // `nextBefore` è il cursore per la pagina successiva: null quando non c'è altro.
  const nextBefore = limit && activeOrders.length === limit
    ? activeOrders[activeOrders.length - 1]!.createdAt.toISOString()
    : null
  return ok({
    data: activeOrders.map(o => ({ ...o, items: items.filter(i => i.orderId === o.id) })),
    ...(limit ? { meta: { nextBefore } } : {}),
  })
}

// ─────────────────────────────── Tavoli ───────────────────────────────
/** GET /api/tables/rooms — sale attive con i loro tavoli attivi. */
export async function readRooms(restaurantId: string): Promise<ReadResult> {
  const allRooms = await db.select().from(rooms).where(and(eq(rooms.restaurantId, restaurantId), eq(rooms.active, true)))
  const allTables = await db.select().from(tables).where(and(eq(tables.restaurantId, restaurantId), eq(tables.active, true)))
  return ok({ data: allRooms.map(r => ({ ...r, tables: allTables.filter(t => t.roomId === r.id) })) })
}

/** GET /api/tables/waiter-calls — chiamate cameriere (aperte salvo ?open=0), scoped al ristorante. */
export async function readWaiterCalls(restaurantId: string, query: unknown): Promise<ReadResult> {
  const q = (query ?? {}) as { open?: string }
  const onlyOpen = q.open !== '0'
  const rows = await db.select()
    .from(waiterCalls)
    .where(and(
      eq(waiterCalls.restaurantId, restaurantId),
      ...(onlyOpen ? [isNull(waiterCalls.resolvedAt)] : []),
    ))
    .orderBy(desc(waiterCalls.createdAt))
    .limit(100)
  return ok({ data: rows })
}

// ──────────────────────────── Prenotazioni ────────────────────────────
/** arricchisce la prenotazione col numero tavolo (per la UI) */
export function withTableNumber(r: typeof reservations.$inferSelect, numByTable: Map<string, string>) {
  return { ...r, tableNumber: r.tableId ? (numByTable.get(r.tableId) ?? null) : null }
}

/** GET /api/reservations — lista per giorno. ?date=YYYY-MM-DD (default: oggi nel fuso del ristorante). */
export async function readReservationsForDay(restaurantId: string, query: unknown): Promise<ReadResult> {
  const q = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).safeParse(query)
  if (!q.success) return { status: 400, body: { error: { code: 'VALIDATION', message: q.error.message } } }
  const tz = await restaurantTimezone(restaurantId)
  const dateStr = q.data.date ?? dayKeyInTz(new Date(), tz)
  const dayStart = dayStartInTz(dateStr, tz)
  if (isNaN(dayStart.getTime())) return { status: 400, body: { error: { code: 'VALIDATION', message: 'Data non valida' } } }
  let dayEnd: Date
  try { dayEnd = dayStartInTz(nextCalendarDay(dateStr), tz) } catch { return { status: 400, body: { error: { code: 'VALIDATION', message: 'Data non valida' } } } }

  const rows = await db.select().from(reservations)
    .where(and(
      eq(reservations.restaurantId, restaurantId),
      gte(reservations.startsAt, dayStart),
      lt(reservations.startsAt, dayEnd),
    ))
    .orderBy(asc(reservations.startsAt))

  const allTables = await db.select({ id: tables.id, number: tables.number }).from(tables)
    .where(eq(tables.restaurantId, restaurantId))
  const numByTable = new Map(allTables.map(t => [t.id, t.number]))
  return ok({ data: rows.map(r => withTableNumber(r, numByTable)) })
}

// ──────────────────────────── Statistiche ────────────────────────────
// Parsa una data dalla query; se assente o non valida usa il fallback (niente
// "Invalid Date" che azzererebbe silenziosamente tutte le statistiche).
function parseDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback
  const d = new Date(value)
  return isNaN(d.getTime()) ? fallback : d
}

// ─────────────────────────── Il periodo, calcolato UNA VOLTA ───────────────────────────
// `/dashboard` e `/export` devono dare gli STESSI numeri sullo stesso intervallo — è
// lo Stop di F4.4, e un CSV che non torna con la schermata da cui è stato esportato
// è peggio di nessun CSV. L'unico modo di garantirlo è che sia la stessa funzione:
// due implementazioni "uguali" divergono al primo arrotondamento cambiato.
export async function periodTotals(restaurantId: string, startDate: Date, endDate: Date) {
  const closedBills = await db.select().from(bills).where(and(
    eq(bills.restaurantId, restaurantId),
    eq(bills.status, 'closed'),
    gte(bills.closedAt!, startDate),
    lte(bills.closedAt!, endDate),
  ))

  // NOTA sul significato di `revenue`: qui è la somma di `bills.total`, MANCE
  // INCLUSE. È la definizione storica di /dashboard, e /export la eredita perché
  // deve coincidere con essa. `GET /api/bills/summary/today` invece la mancia la
  // toglie (è pass-through allo staff). Le due viste NON concordano, e non è questo
  // il task che lo risolve: l'export espone perciò anche `tips` e l'incasso netto,
  // così nel CSV il numero non è mai ambiguo.
  const revenue = round2(closedBills.reduce((s, b) => s + b.total, 0))
  const tips = round2(closedBills.reduce((s, b) => s + (b.tip ?? 0), 0))
  const discounts = round2(closedBills.reduce((s, b) => s + (b.discount ?? 0), 0))
  const avgTicket = closedBills.length ? round2(revenue / closedBills.length) : 0
  const totalCovers = closedBills.reduce((s, b) => s + (b.covers ?? 1), 0)

  // Piatti più venduti: stessa finestra del fatturato, ordini serviti o pagati.
  const servedOrders = await db.select().from(orders).where(and(
    eq(orders.restaurantId, restaurantId),
    inArray(orders.status, ['served', 'paid']),
    gte(orders.createdAt, startDate),
    lte(orders.createdAt, endDate),
  ))

  const allOrderItems = servedOrders.length
    ? await db
        .select({ name: orderItems.name, qty: orderItems.quantity, unitPrice: orderItems.unitPrice })
        .from(orderItems)
        .where(inArray(orderItems.orderId, servedOrders.map(o => o.id)))
    : []

  const itemCounts = new Map<string, { qty: number; revenue: number }>()
  for (const item of allOrderItems) {
    const existing = itemCounts.get(item.name) ?? { qty: 0, revenue: 0 }
    itemCounts.set(item.name, {
      qty: existing.qty + item.qty,
      revenue: existing.revenue + (item.qty * item.unitPrice),
    })
  }
  const topItems = [...itemCounts.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .map(([name, data]) => ({ name, ...data }))

  return { closedBills, revenue, tips, discounts, avgTicket, totalCovers, billsCount: closedBills.length, topItems }
}

/** GET /api/stats/dashboard */
export async function readDashboardStats(restaurantId: string, query: unknown): Promise<ReadResult> {
  // "La giornata" nel fuso del ristorante (setting timezone, default Europe/Rome):
  // le date 'YYYY-MM-DD' di from/to sono inizio/fine giornata LOCALE, non UTC né
  // ora-server, così i bucket e "oggi" combaciano con bills.ts.
  const tz = await restaurantTimezone(restaurantId)
  const { from, to } = (query ?? {}) as { from?: string; to?: string }
  const isDay = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
  const startDate = isDay(from) ? dayStartInTz(from!, tz) : parseDate(from, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  const endDate = isDay(to) ? dayEndInTz(to!, tz) : parseDate(to, new Date())

  // Revenue in period — la stessa funzione che alimenta /export (vedi periodTotals).
  const { closedBills, revenue, avgTicket, totalCovers, topItems: allTopItems } = await periodTotals(restaurantId, startDate, endDate)

  // Today (mezzanotte nel fuso del ristorante)
  const today = dayStartInTz(dayKeyInTz(new Date(), tz), tz)
  const todayBills = closedBills.filter(b => b.closedAt && b.closedAt >= today)
  const todayRevenue = todayBills.reduce((s, b) => s + b.total, 0)

  const topItems = allTopItems.slice(0, 10)

  // Daily revenue breakdown (last 7 days) — chiavi giorno nel fuso del ristorante
  const dailyRevenue: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = dayKeyInTz(d, tz)
    dailyRevenue[key] = 0
  }
  closedBills.forEach(b => {
    if (!b.closedAt) return
    const key = dayKeyInTz(b.closedAt, tz)
    if (key in dailyRevenue) dailyRevenue[key]! += b.total
  })

  // Pending orders count
  const pendingOrders = await db.select().from(orders).where(and(
    eq(orders.restaurantId, restaurantId),
    eq(orders.status, 'pending'),
  ))

  // Session analytics
  const periodSessions = await db
    .select()
    .from(tableSessions)
    .where(and(
      eq(tableSessions.restaurantId, restaurantId),
      gte(tableSessions.scannedAt, startDate),
      lte(tableSessions.scannedAt, endDate),
    ))

  const totalScans = periodSessions.length
  const convertedSessions = periodSessions.filter(s => s.firstOrderAt !== null)
  const conversionRate = totalScans > 0 ? Math.round((convertedSessions.length / totalScans) * 100) : 0

  const timings = convertedSessions
    .map(s => s.timeToFirstOrderSec)
    .filter((t): t is number => t !== null && t > 0 && t < 3600)
  const avgTimeToFirstOrderSec = timings.length
    ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length)
    : null

  // Scans per hour (0-23) for peak hour chart. L'ora va calcolata nel fuso del
  // ristorante (non quello del processo): su cloud UTC `getHours()` sfaserebbe il
  // grafico delle ore di punta.
  const scansPerHour: number[] = Array(24).fill(0)
  const hourFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz })
  for (const s of periodSessions) {
    const hour = Number(hourFmt.format(s.scannedAt)) % 24
    scansPerHour[hour]!++
  }

  return ok({
    data: {
      revenue,
      todayRevenue,
      avgTicket,
      totalCovers,
      billsCount: closedBills.length,
      pendingOrdersCount: pendingOrders.length,
      dailyRevenue: Object.entries(dailyRevenue).map(([date, amount]) => ({ date, amount })),
      topItems,
      sessions: {
        totalScans,
        conversionRate,
        avgTimeToFirstOrderSec,
        scansPerHour: scansPerHour.map((count, hour) => ({ hour, count })),
      },
    },
  })
}

// ──────────────────────────── Ristorante e agenzia ────────────────────────────
/** GET /api/restaurants/me */
export async function readRestaurantMe(restaurantId: string): Promise<ReadResult> {
  const [r] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1)
  if (!r) return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Restaurant not found' } } }
  return ok({ data: r })
}

/** GET /api/agency/me — nessuna query: solo la lista esplicita degli UUID agenzia. */
export function readAgencyMe(userId: string, env: NodeJS.ProcessEnv = process.env): ReadResult {
  return ok({ data: { agency: isAgencyUser(userId, env) } })
}
