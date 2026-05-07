import type { FastifyInstance } from 'fastify'
import { db, orders, orderItems, menuItems, bills } from '@tako/db'
import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'

export async function statsRoutes(fastify: FastifyInstance) {
  fastify.get('/dashboard', { preHandler: requireAuth }, async (req) => {
    const { from, to } = req.query as { from?: string; to?: string }
    const startDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const endDate = to ? new Date(to) : new Date()

    const restaurantId = req.user!.restaurantId

    // Revenue in period
    const closedBills = await db.select().from(bills).where(and(
      eq(bills.restaurantId, restaurantId),
      eq(bills.status, 'closed'),
      gte(bills.closedAt!, startDate),
      lte(bills.closedAt!, endDate),
    ))

    const revenue = closedBills.reduce((s, b) => s + b.total, 0)
    const avgTicket = closedBills.length ? revenue / closedBills.length : 0
    const totalCovers = closedBills.reduce((s, b) => s + (b.covers ?? 1), 0)

    // Today
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayBills = closedBills.filter(b => b.closedAt && b.closedAt >= today)
    const todayRevenue = todayBills.reduce((s, b) => s + b.total, 0)

    // Top items by quantity
    const servedOrders = await db.select().from(orders).where(and(
      eq(orders.restaurantId, restaurantId),
      eq(orders.status, 'served'),
      gte(orders.createdAt, startDate),
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

    // Daily revenue breakdown (last 7 days)
    const dailyRevenue: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().split('T')[0]!
      dailyRevenue[key] = 0
    }
    closedBills.forEach(b => {
      if (!b.closedAt) return
      const key = b.closedAt.toISOString().split('T')[0]!
      if (key in dailyRevenue) dailyRevenue[key]! += b.total
    })

    // Pending orders count
    const pendingOrders = await db.select().from(orders).where(and(
      eq(orders.restaurantId, restaurantId),
      eq(orders.status, 'pending'),
    ))

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
      },
    }
  })
}
