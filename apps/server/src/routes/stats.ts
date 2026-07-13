import type { FastifyInstance } from 'fastify'
import { db, orders, orderItems, bills, tableSessions } from '@tako/db'
import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { round2, restaurantTimezone, dayKeyInTz, dayStartInTz, dayEndInTz } from '../lib/billing.js'

// Parsa una data dalla query; se assente o non valida usa il fallback (niente
// "Invalid Date" che azzererebbe silenziosamente tutte le statistiche).
function parseDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback
  const d = new Date(value)
  return isNaN(d.getTime()) ? fallback : d
}

export async function statsRoutes(fastify: FastifyInstance) {
  fastify.get('/dashboard', { preHandler: requireAuth }, async (req) => {
    const restaurantId = req.user!.restaurantId
    // "La giornata" nel fuso del ristorante (setting timezone, default Europe/Rome):
    // le date 'YYYY-MM-DD' di from/to sono inizio/fine giornata LOCALE, non UTC né
    // ora-server, così i bucket e "oggi" combaciano con bills.ts.
    const tz = await restaurantTimezone(restaurantId)
    const { from, to } = req.query as { from?: string; to?: string }
    const isDay = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
    const startDate = isDay(from) ? dayStartInTz(from!, tz) : parseDate(from, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    const endDate = isDay(to) ? dayEndInTz(to!, tz) : parseDate(to, new Date())

    // Revenue in period
    const closedBills = await db.select().from(bills).where(and(
      eq(bills.restaurantId, restaurantId),
      eq(bills.status, 'closed'),
      gte(bills.closedAt!, startDate),
      lte(bills.closedAt!, endDate),
    ))

    const revenue = round2(closedBills.reduce((s, b) => s + b.total, 0))
    const avgTicket = closedBills.length ? round2(revenue / closedBills.length) : 0
    const totalCovers = closedBills.reduce((s, b) => s + (b.covers ?? 1), 0)

    // Today (mezzanotte nel fuso del ristorante)
    const today = dayStartInTz(dayKeyInTz(new Date(), tz), tz)
    const todayBills = closedBills.filter(b => b.closedAt && b.closedAt >= today)
    const todayRevenue = todayBills.reduce((s, b) => s + b.total, 0)

    // Top items by quantity
    const servedOrders = await db.select().from(orders).where(and(
      eq(orders.restaurantId, restaurantId),
      inArray(orders.status, ['served', 'paid']),
      gte(orders.createdAt, startDate),
      lte(orders.createdAt, endDate), // stessa finestra del fatturato
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
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data }))

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

    return {
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
    }
  })
}
