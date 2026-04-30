import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { db, restaurants, menus, menuSections, menuItems, itemVariants, tables, orders, orderItems } from '@tako/db'
import { eq, and, asc } from 'drizzle-orm'
import { io } from '../index.js'
import type { PublicRestaurant, PublicMenu } from '@tako/types'

export async function customerRoutes(fastify: FastifyInstance) {
  // Resolve table by QR token → return restaurant + table info
  fastify.get('/table/:token', async (req, reply) => {
    const { token } = req.params as { token: string }

    const [table] = await db.select().from(tables).where(eq(tables.qrToken, token)).limit(1)
    if (!table) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Table not found' } })

    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, table.restaurantId)).limit(1)
    if (!restaurant) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Restaurant not found' } })

    const settings = restaurant.settings as any ?? {}

    const pub: PublicRestaurant = {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      logoUrl: restaurant.logoUrl ?? undefined,
      primaryColor: restaurant.primaryColor ?? '#ED7159',
      defaultLanguage: settings.defaultLanguage ?? 'it',
      languages: settings.languages ?? ['it'],
      aiEnabled: settings.aiEnabled ?? false,
    }

    return {
      data: {
        restaurant: pub,
        table: { id: table.id, number: table.number, seats: table.seats, restaurantId: table.restaurantId },
      },
    }
  })

  // Get public menu for restaurant
  fastify.get('/restaurant/:restaurantId/menu', async (req, reply) => {
    const { restaurantId } = req.params as { restaurantId: string }

    const allMenus = await db.select().from(menus).where(and(eq(menus.restaurantId, restaurantId), eq(menus.active, true))).orderBy(asc(menus.position))
    if (!allMenus.length) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'No active menu' } })

    const mainMenu = allMenus[0]!
    const sections = await db.select().from(menuSections).where(and(eq(menuSections.menuId, mainMenu.id), eq(menuSections.active, true))).orderBy(asc(menuSections.position))
    const items = await db.select().from(menuItems).where(and(eq(menuItems.restaurantId, restaurantId), eq(menuItems.available, true))).orderBy(asc(menuItems.position))
    const variants = await db.select().from(itemVariants)

    const pub: PublicMenu = {
      id: mainMenu.id,
      name: mainMenu.name,
      sections: sections.map(s => ({
        id: s.id,
        name: s.name,
        items: items
          .filter(i => i.sectionId === s.id)
          .map(i => ({
            id: i.id,
            name: i.name,
            description: i.description ?? undefined,
            price: i.price,
            imageUrl: i.imageUrl ?? undefined,
            allergens: i.allergens ?? [],
            tags: i.tags ?? [],
            available: i.available,
            variants: variants.filter(v => v.itemId === i.id).map(v => ({ id: v.id, name: v.name, priceModifier: v.priceModifier })),
          })),
      })),
    }

    return { data: pub }
  })

  // Submit order from customer
  fastify.post('/orders', async (req, reply) => {
    const schema = z.object({
      restaurantId: z.string().uuid(),
      tableId: z.string().uuid().optional(),
      tableNumber: z.string().optional(),
      type: z.enum(['table', 'takeaway']).default('table'),
      items: z.array(z.object({
        menuItemId: z.string().uuid(),
        variantId: z.string().uuid().optional(),
        quantity: z.number().int().positive(),
        notes: z.string().optional(),
      })),
      notes: z.string().optional(),
      idempotencyKey: z.string(),
    })

    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    // Idempotency check
    const [existing] = await db.select().from(orders).where(eq(orders.idempotencyKey, body.data.idempotencyKey)).limit(1)
    if (existing) return { data: existing }

    // SECURITY: verifica che il ristorante esista e sia attivo
    const [restaurant] = await db.select().from(restaurants).where(and(eq(restaurants.id, body.data.restaurantId), eq(restaurants.active, true))).limit(1)
    if (!restaurant) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Ristorante non trovato' } })

    // SECURITY: verifica che il tavolo appartenga al ristorante (previene ordini cross-ristorante)
    if (body.data.tableId) {
      const [table] = await db.select().from(tables).where(and(eq(tables.id, body.data.tableId), eq(tables.restaurantId, body.data.restaurantId))).limit(1)
      if (!table) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Tavolo non valido' } })
    }

    // SECURITY: prezzi sempre dal DB, mai dal client — previene price tampering
    const dbItems = await db.select().from(menuItems).where(and(eq(menuItems.restaurantId, body.data.restaurantId), eq(menuItems.available, true)))

    let total = 0
    const resolvedItems = body.data.items.map(orderItem => {
      const dbItem = dbItems.find(i => i.id === orderItem.menuItemId)
      // SECURITY: item deve esistere e appartenere a questo ristorante
      if (!dbItem) throw new Error(`Item non trovato o non disponibile`)
      // SECURITY: quantità massima per voce (anti-spam)
      if (orderItem.quantity > 20) throw new Error(`Quantità massima 20 per voce`)
      const price = dbItem.price // prezzo SEMPRE dal DB
      total += price * orderItem.quantity
      return { ...orderItem, name: dbItem.name, unitPrice: price, kitchenStation: dbItem.kitchenStation }
    })

    // SECURITY: max 15 voci per ordine
    if (body.data.items.length > 15) return reply.code(400).send({ error: { code: 'TOO_MANY_ITEMS', message: 'Massimo 15 voci per ordine' } })

    const [order] = await db.insert(orders).values({
      restaurantId: body.data.restaurantId,
      tableId: body.data.tableId,
      tableNumber: body.data.tableNumber,
      type: body.data.type,
      status: 'pending',
      total,
      notes: body.data.notes,
      idempotencyKey: body.data.idempotencyKey,
    }).returning()

    const insertedItems = await db.insert(orderItems).values(
      resolvedItems.map(i => ({
        orderId: order!.id,
        menuItemId: i.menuItemId,
        variantId: i.variantId,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        notes: i.notes,
        kitchenStation: i.kitchenStation ?? null,
        status: 'pending' as const,
      }))
    ).returning()

    const payload = { ...order, items: insertedItems }

    // Emit to restaurant room (staff devices)
    io.to(`restaurant:${body.data.restaurantId}`).emit('order:new', payload)

    // Update table status
    if (body.data.tableId) {
      await db.update(tables).set({ status: 'occupied', openedAt: new Date() }).where(eq(tables.id, body.data.tableId))
      io.to(`restaurant:${body.data.restaurantId}`).emit('table:updated', { tableId: body.data.tableId, status: 'occupied' })
    }

    return reply.code(201).send({ data: payload })
  })

  // Get order status (for customer tracking)
  fastify.get('/orders/:orderId', async (req, reply) => {
    const { orderId } = req.params as { orderId: string }
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Order not found' } })
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
    return { data: { ...order, items } }
  })

  // Call waiter
  fastify.post('/waiter-call', async (req, reply) => {
    const { restaurantId, tableId, tableNumber, type } = req.body as {
      restaurantId: string; tableId: string; tableNumber: string; type: 'help' | 'bill' | 'water'
    }
    io.to(`restaurant:${restaurantId}`).emit('waiter:called', { tableId, tableNumber, type })
    return { data: { success: true } }
  })

  // AI chat
  fastify.post('/ai-chat', async (req, reply) => {
    const { restaurantId, message, history } = req.body as { restaurantId: string; message: string; history: Array<{ role: 'user' | 'assistant'; content: string }> }

    const OPENAI_KEY = process.env['OPENAI_API_KEY']
    if (!OPENAI_KEY) return reply.code(503).send({ error: { code: 'AI_UNAVAILABLE', message: 'AI not configured' } })

    // Build menu context
    const sections = await db.select().from(menuSections).innerJoin(menus, eq(menus.id, menuSections.menuId)).where(eq(menus.restaurantId, restaurantId))
    const items = await db.select().from(menuItems).where(and(eq(menuItems.restaurantId, restaurantId), eq(menuItems.available, true)))

    const menuContext = items.map(i => `${i.name}: €${i.price}${i.description ? ` — ${i.description}` : ''}${i.allergens?.length ? ` [Allergeni: ${i.allergens.join(', ')}]` : ''}${i.tags?.length ? ` [${i.tags.join(', ')}]` : ''}`).join('\n')

    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1)

    const systemPrompt = `Sei Tako, l'assistente AI del ristorante "${restaurant?.name ?? 'questo ristorante'}". Sei gentile, disponibile e conosci il menu alla perfezione.

MENU DISPONIBILE:
${menuContext}

Rispondi sempre in italiano a meno che il cliente non scriva in un'altra lingua. Sii conciso (max 3 righe). Se non sai rispondere a qualcosa, suggerisci di chiedere al cameriere.`

    const { OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: OPENAI_KEY })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6),
        { role: 'user', content: message },
      ],
      max_tokens: 300,
      temperature: 0.7,
    })

    const reply_text = response.choices[0]?.message?.content ?? 'Non ho capito, puoi ripetere?'
    return { data: { message: reply_text } }
  })
}
