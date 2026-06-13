import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { db, restaurants, menus, menuSections, menuItems, itemVariants, tables, orders, orderItems, bills, tableSessions } from '@tako/db'
import { eq, and, asc, inArray, isNull, desc } from 'drizzle-orm'
import { io } from '../index.js'
import type { PublicRestaurant, PublicMenu } from '@tako/types'
import { autoPrintOrder } from '../lib/printer.js'
import { registry, runAgentTurn, customerSystem, aiConfigured } from '../ai/index.js'
import { TABLE_COOKIE, authCookieOptions, TABLE_SESSION_MAX_AGE } from '../lib/cookies.js'

interface TableSession { restaurantId: string; tableId: string; sessionId: string | null }

export async function customerRoutes(fastify: FastifyInstance) {
  // Verifica il JWT del tavolo (cookie HttpOnly emesso al resolve del QR) e lega
  // l'azione al tavolo scansionato. Se il body porta restaurantId/tableId, devono
  // combaciare col JWT (anti-spoofing).
  async function requireTableSession(req: any, reply: any) {
    const token = req.cookies?.[TABLE_COOKIE]
    if (!token) return reply.code(401).send({ error: { code: 'NO_TABLE_SESSION', message: 'Scansiona di nuovo il QR del tavolo.' } })
    let payload: TableSession
    try {
      payload = fastify.jwt.verify(token) as TableSession
    } catch {
      return reply.code(401).send({ error: { code: 'INVALID_TABLE_SESSION', message: 'Sessione tavolo scaduta. Riscansiona il QR.' } })
    }
    const body = (req.body ?? {}) as { restaurantId?: string; tableId?: string }
    if ((body.restaurantId && body.restaurantId !== payload.restaurantId) ||
        (body.tableId && body.tableId !== payload.tableId)) {
      return reply.code(403).send({ error: { code: 'TABLE_MISMATCH', message: 'Azione non consentita per questo tavolo.' } })
    }
    req.tableSession = payload
  }

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

    // Record QR scan session (fire and forget — don't block response)
    const [session] = await db.insert(tableSessions).values({
      restaurantId: table.restaurantId,
      tableId: table.id,
      tableNumber: table.number,
    }).returning({ id: tableSessions.id })

    // JWT legato al tavolo → cookie HttpOnly: lega le azioni cliente a questo tavolo.
    const tableJwt = fastify.jwt.sign(
      { restaurantId: table.restaurantId, tableId: table.id, sessionId: session?.id ?? null },
      { expiresIn: '4h' },
    )
    reply.setCookie(TABLE_COOKIE, tableJwt, authCookieOptions(TABLE_SESSION_MAX_AGE, '/api/customer'))

    return {
      data: {
        restaurant: pub,
        table: { id: table.id, number: table.number, seats: table.seats, restaurantId: table.restaurantId },
        sessionId: session?.id ?? null,
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
  fastify.post('/orders', { preHandler: requireTableSession }, async (req, reply) => {
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

    // Auto-print comanda (fire-and-forget — non blocca risposta al cliente)
    autoPrintOrder({
      restaurantId: body.data.restaurantId,
      tableNumber: body.data.tableNumber,
      items: insertedItems.map(i => ({ name: i.name, quantity: i.quantity, notes: i.notes ?? undefined })),
    }).catch(() => {}) // errore stampante non deve rompere l'ordine

    // Emit to restaurant room (staff devices)
    io.to(`restaurant:${body.data.restaurantId}`).emit('order:new', payload)

    // Update table status
    if (body.data.tableId) {
      await db.update(tables).set({ status: 'occupied', openedAt: new Date() }).where(eq(tables.id, body.data.tableId))
      io.to(`restaurant:${body.data.restaurantId}`).emit('table:updated', { tableId: body.data.tableId, status: 'occupied' })
    }

    // Lazy bill creation / update
    if (body.data.tableId) {
      const restaurantId = body.data.restaurantId
      const tableId = body.data.tableId

      // Cerca bill aperto per questo tavolo
      const [existingBill] = await db
        .select()
        .from(bills)
        .where(and(eq(bills.restaurantId, restaurantId), eq(bills.tableId, tableId), eq(bills.status, 'open')))
        .limit(1)

      // Calcola subtotale sommando tutti gli ordini attivi sul tavolo
      const activeOrders = await db
        .select()
        .from(orders)
        .where(and(
          eq(orders.restaurantId, restaurantId),
          eq(orders.tableId, tableId),
          inArray(orders.status, ['pending', 'confirmed', 'preparing', 'ready', 'served'])
        ))
      const subtotal = activeOrders.reduce((sum, o) => sum + o.total, 0)

      if (existingBill) {
        // Aggiorna subtotale e totale
        await db.update(bills)
          .set({ subtotal, total: subtotal - (existingBill.discount ?? 0) + (existingBill.tip ?? 0) })
          .where(eq(bills.id, existingBill.id))
      } else {
        // Crea nuovo bill
        await db.insert(bills).values({
          restaurantId,
          tableId,
          subtotal,
          total: subtotal,
          status: 'open',
        })
      }
    }

    // Mark first order on session (only if not already recorded)
    if (body.data.tableId) {
      const [session] = await db
        .select()
        .from(tableSessions)
        .where(and(
          eq(tableSessions.tableId, body.data.tableId),
          eq(tableSessions.restaurantId, body.data.restaurantId),
          isNull(tableSessions.firstOrderAt),
        ))
        .orderBy(desc(tableSessions.scannedAt))
        .limit(1)

      if (session) {
        const elapsedSec = Math.round((Date.now() - session.scannedAt.getTime()) / 1000)
        await db
          .update(tableSessions)
          .set({ firstOrderAt: new Date(), timeToFirstOrderSec: elapsedSec })
          .where(eq(tableSessions.id, session.id))
      }
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
  fastify.post('/waiter-call', { config: { rateLimit: { max: 6, timeWindow: 60000 } }, preHandler: requireTableSession }, async (req, reply) => {
    const schema = z.object({
      restaurantId: z.string().uuid(),
      tableId: z.string().uuid(),
      tableNumber: z.string().max(20),
      type: z.enum(['help', 'bill', 'water']),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    const { restaurantId, tableId, tableNumber, type } = body.data
    io.to(`restaurant:${restaurantId}`).emit('waiter:called', { tableId, tableNumber, type })
    return { data: { success: true } }
  })

  // AI chat — agentic assistant. Bound to this table/session: it can search the
  // menu, fill the cart, place the order, check status and call the waiter.
  fastify.post('/ai-chat', { config: { rateLimit: { max: 15, timeWindow: 60000 } }, preHandler: requireTableSession }, async (req, reply) => {
    const aiChatSchema = z.object({
      restaurantId: z.string().uuid(),
      message: z.string().min(1).max(500),
      tableId: z.string().uuid().optional(),
      tableNumber: z.string().max(20).optional(),
      sessionId: z.string().uuid().optional(),
      history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      })).max(12).default([]),
    })
    const parsed = aiChatSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    const { restaurantId, message, tableId, tableNumber, sessionId, history } = parsed.data

    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1)

    // Preferred path: agentic assistant (Claude). Falls back to read-only Groq
    // Q&A when ANTHROPIC_API_KEY is absent.
    if (aiConfigured()) {
      try {
        const result = await runAgentTurn({
          scope: 'customer',
          system: customerSystem({ restaurantName: restaurant?.name ?? 'questo ristorante', tableNumber: tableNumber ?? null }),
          history,
          message,
          ctx: { restaurantId, tableId: tableId ?? null, tableNumber: tableNumber ?? null, sessionId: sessionId ?? null },
          registry,
        })
        return { data: { message: result.message, actions: result.actions } }
      } catch (err) {
        req.log.error(err)
        return reply.code(500).send({ error: { code: 'AI_ERROR', message: 'Errore assistente.' } })
      }
    }

    const GROQ_KEY = process.env['GROQ_API_KEY']
    if (!GROQ_KEY) return reply.code(503).send({ error: { code: 'AI_UNAVAILABLE', message: 'AI not configured' } })

    // Fallback: menu-aware Q&A only (no actions).
    const items = await db.select().from(menuItems).where(and(eq(menuItems.restaurantId, restaurantId), eq(menuItems.available, true)))
    const menuContext = items.map(i => `${i.name}: €${i.price}${i.description ? ` — ${i.description}` : ''}${i.allergens?.length ? ` [Allergeni: ${i.allergens.join(', ')}]` : ''}`).join('\n')
    const systemPrompt = `Sei Tako, l'assistente del ristorante "${restaurant?.name ?? 'questo ristorante'}". Conosci il menu:\n${menuContext}\nRispondi in italiano, max 3 righe. Se non sai, suggerisci il cameriere.`
    const { OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: GROQ_KEY, baseURL: 'https://api.groq.com/openai/v1' })
    const response = await openai.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: systemPrompt }, ...history.slice(-6).map(h => ({ role: h.role, content: h.content })), { role: 'user', content: message }],
      max_tokens: 300, temperature: 0.7,
    })
    return { data: { message: response.choices[0]?.message?.content ?? 'Non ho capito, puoi ripetere?', actions: [] } }
  })
}
