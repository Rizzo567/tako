import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, orders, orderItems, orderStatusHistory, menuItems, tables } from '@tako/db'
import { eq, and, inArray, desc, gte } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { io } from '../index.js'
import type { OrderStatus } from '@tako/types'

export async function orderRoutes(fastify: FastifyInstance) {
  // Get active orders for restaurant
  fastify.get('/active', { preHandler: requireAuth }, async (req) => {
    const activeOrders = await db
      .select()
      .from(orders)
      .where(and(
        eq(orders.restaurantId, req.user!.restaurantId),
        inArray(orders.status, ['pending', 'confirmed', 'preparing', 'ready']),
      ))
      .orderBy(desc(orders.createdAt))

    const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, activeOrders.map(o => o.id)))
    return { data: activeOrders.map(o => ({ ...o, items: items.filter(i => i.orderId === o.id) })) }
  })

  // Get orders by table
  fastify.get('/table/:tableId', { preHandler: requireAuth }, async (req) => {
    const { tableId } = req.params as { tableId: string }
    const tableOrders = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tableId, tableId), eq(orders.restaurantId, req.user!.restaurantId)))
      .orderBy(desc(orders.createdAt))

    const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, tableOrders.map(o => o.id)))
    return { data: tableOrders.map(o => ({ ...o, items: items.filter(i => i.orderId === o.id) })) }
  })

  // Get order history (today)
  fastify.get('/history', { preHandler: requireAuth }, async (req) => {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const hist = await db
      .select()
      .from(orders)
      .where(and(eq(orders.restaurantId, req.user!.restaurantId), gte(orders.createdAt, startOfDay)))
      .orderBy(desc(orders.createdAt))

    return { data: hist }
  })

  // Update order status
  fastify.patch('/:orderId/status', { preHandler: requireAuth }, async (req, reply) => {
    const { orderId } = req.params as { orderId: string }
    const { status } = req.body as { status: OrderStatus }

    const [current] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!current) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Order not found' } })

    const updateData: any = { status, updatedAt: new Date() }
    if (status === 'served') updateData.servedAt = new Date()
    if (status === 'paid') updateData.paidAt = new Date()

    const [updated] = await db.update(orders).set(updateData).where(eq(orders.id, orderId)).returning()

    await db.insert(orderStatusHistory).values({
      orderId,
      fromStatus: current.status,
      toStatus: status,
      changedBy: req.user!.id,
    })

    // Broadcast to all connected clients in this restaurant
    io.to(`restaurant:${req.user!.restaurantId}`).emit('order:updated', { orderId, status })

    // Notify customer if at table
    if (current.tableId) {
      io.to(`table:${current.tableId}`).emit('order:updated', { orderId, status })
    }

    return { data: updated }
  })

  // Update single order item status (for KDS bump)
  fastify.patch('/:orderId/items/:itemId/status', { preHandler: requireAuth }, async (req, reply) => {
    const { orderId, itemId } = req.params as { orderId: string; itemId: string }
    const { status } = req.body as { status: 'pending' | 'preparing' | 'ready' | 'served' }

    const [item] = await db.update(orderItems).set({ status }).where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId))).returning()
    if (!item) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Item not found' } })

    io.to(`restaurant:${req.user!.restaurantId}`).emit('order:updated', { orderId, itemId, status })
    return { data: item }
  })

  // Cancel order
  fastify.patch('/:orderId/cancel', { preHandler: requireAuth }, async (req, reply) => {
    const { orderId } = req.params as { orderId: string }
    const [updated] = await db.update(orders).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(orders.id, orderId)).returning()
    if (!updated) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Order not found' } })
    io.to(`restaurant:${req.user!.restaurantId}`).emit('order:updated', { orderId, status: 'cancelled' })
    return { data: updated }
  })
}
