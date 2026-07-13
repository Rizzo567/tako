import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, inventoryItems, inventoryMovements } from '@tako/db'
import { eq, and, lte, sql, desc, inArray, gte } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { io } from '../index.js'
import OpenAI from 'openai'

function getAI() {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set')
  return new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
}

export async function inventoryRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireAuth }, async (req) => {
    // Solo articoli ATTIVI: gli archiviati (soft-delete) spariscono dalla lista ma conservano lo storico.
    const items = await db.select().from(inventoryItems).where(and(
      eq(inventoryItems.restaurantId, req.user!.restaurantId),
      eq(inventoryItems.active, true),
    ))
    return { data: items }
  })

  fastify.get('/alerts', { preHandler: requireAuth }, async (req) => {
    const alerts = await db.select().from(inventoryItems).where(and(
      eq(inventoryItems.restaurantId, req.user!.restaurantId),
      eq(inventoryItems.active, true),
      lte(inventoryItems.quantity, inventoryItems.minQuantity),
    ))
    return { data: alerts }
  })

  fastify.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      unit: z.string().min(1),
      quantity: z.number().default(0),
      minQuantity: z.number().default(0),
      parLevel: z.number().optional(),
      costPerUnit: z.number().optional(),
      supplier: z.string().optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    const [item] = await db.insert(inventoryItems).values({ restaurantId: req.user!.restaurantId, ...body.data }).returning()
    return reply.code(201).send({ data: item })
  })

  // Modifica metadati articolo (NON la giacenza: quella passa dai movimenti/ledger).
  fastify.patch('/:itemId', { preHandler: requireAuth }, async (req, reply) => {
    const { itemId } = req.params as { itemId: string }
    const schema = z.object({
      name: z.string().min(1).optional(),
      unit: z.string().min(1).optional(),
      minQuantity: z.number().min(0).optional(),
      parLevel: z.number().min(0).nullable().optional(),
      costPerUnit: z.number().min(0).nullable().optional(),
      supplier: z.string().nullable().optional(),
      active: z.boolean().optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    const [existing] = await db.select().from(inventoryItems).where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.restaurantId, req.user!.restaurantId))).limit(1)
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Item not found' } })
    const [item] = await db.update(inventoryItems).set({ ...body.data, updatedAt: new Date() }).where(eq(inventoryItems.id, itemId)).returning()
    return { data: item }
  })

  // Archivia (soft delete): conserva lo storico movimenti. active=false → sparisce dalle liste attive.
  fastify.delete('/:itemId', { preHandler: requireAuth }, async (req, reply) => {
    const { itemId } = req.params as { itemId: string }
    const [existing] = await db.select().from(inventoryItems).where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.restaurantId, req.user!.restaurantId))).limit(1)
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Item not found' } })
    await db.update(inventoryItems).set({ active: false, updatedAt: new Date() }).where(eq(inventoryItems.id, itemId))
    return { data: { success: true } }
  })

  // Storico movimenti di un articolo (ledger: carichi/scarichi/rettifiche/sprechi).
  fastify.get('/:itemId/movements', { preHandler: requireAuth }, async (req, reply) => {
    const { itemId } = req.params as { itemId: string }
    const [existing] = await db.select().from(inventoryItems).where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.restaurantId, req.user!.restaurantId))).limit(1)
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Item not found' } })
    const moves = await db.select().from(inventoryMovements).where(eq(inventoryMovements.itemId, itemId)).orderBy(desc(inventoryMovements.createdAt)).limit(100)
    return { data: moves }
  })

  // Cruscotto inventario: valorizzazione, conteggi, consumo e giorni-alla-rottura di stock.
  fastify.get('/stats', { preHandler: requireAuth }, async (req) => {
    const items = await db.select().from(inventoryItems).where(and(eq(inventoryItems.restaurantId, req.user!.restaurantId), eq(inventoryItems.active, true)))
    const ids = items.map(i => i.id)
    // Consumo (scarichi + sprechi) degli ultimi 30 giorni per articolo.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const usageRows = ids.length
      ? await db.select({ itemId: inventoryMovements.itemId, used: sql<number>`sum(abs(${inventoryMovements.quantity}))` })
          .from(inventoryMovements)
          .where(and(inArray(inventoryMovements.itemId, ids), inArray(inventoryMovements.type, ['unload', 'waste']), gte(inventoryMovements.createdAt, since)))
          .groupBy(inventoryMovements.itemId)
      : []
    const usedById = new Map(usageRows.map(r => [r.itemId, Number(r.used) || 0]))
    let totalValue = 0, lowCount = 0, outCount = 0
    const perItem = items.map(i => {
      const cost = i.costPerUnit != null ? Number(i.costPerUnit) : 0
      const value = cost * i.quantity
      totalValue += value
      if (i.quantity <= 0) outCount++
      else if (i.quantity <= i.minQuantity) lowCount++
      const used30 = usedById.get(i.id) ?? 0
      const perDay = used30 / 30
      const daysLeft = perDay > 0 ? Math.round((i.quantity / perDay) * 10) / 10 : null
      return { id: i.id, name: i.name, unit: i.unit, quantity: i.quantity, minQuantity: i.minQuantity, value: Math.round(value * 100) / 100, used30, perDay: Math.round(perDay * 100) / 100, daysLeft }
    })
    return { data: { totalValue: Math.round(totalValue * 100) / 100, itemCount: items.length, lowCount, outCount, perItem } }
  })

  // Lista di RIORDINO: articoli sotto scorta minima → quantità suggerita per tornare al par
  // (o minQuantity*2 se il par non è impostato), raggruppati per fornitore, con costo stimato.
  fastify.get('/reorder', { preHandler: requireAuth }, async (req) => {
    const items = await db.select().from(inventoryItems).where(and(
      eq(inventoryItems.restaurantId, req.user!.restaurantId),
      eq(inventoryItems.active, true),
      lte(inventoryItems.quantity, inventoryItems.minQuantity),
    ))
    const bySupplier: Record<string, any[]> = {}
    let totalCost = 0
    for (const i of items) {
      const target = i.parLevel != null && i.parLevel > 0 ? i.parLevel : Math.max(i.minQuantity * 2, i.minQuantity + 1)
      const suggested = Math.max(0, Math.round((target - i.quantity) * 100) / 100)
      const cost = i.costPerUnit != null ? Number(i.costPerUnit) * suggested : null
      if (cost != null) totalCost += cost
      const sup = i.supplier?.trim() || 'Senza fornitore'
      ;(bySupplier[sup] ??= []).push({ id: i.id, name: i.name, unit: i.unit, quantity: i.quantity, minQuantity: i.minQuantity, target, suggested, costPerUnit: i.costPerUnit != null ? Number(i.costPerUnit) : null, estCost: cost != null ? Math.round(cost * 100) / 100 : null })
    }
    const suppliers = Object.entries(bySupplier).map(([supplier, list]) => ({ supplier, items: list }))
    return { data: { suppliers, itemCount: items.length, estTotalCost: Math.round(totalCost * 100) / 100 } }
  })

  fastify.post('/:itemId/movements', { preHandler: requireAuth }, async (req, reply) => {
    const { itemId } = req.params as { itemId: string }
    const schema = z.object({
      // 'adjustment' è una rettifica con SEGNO (può essere negativa); load/unload/waste
      // usano un valore positivo (il segno lo decide il tipo).
      type: z.enum(['load', 'unload', 'adjustment', 'waste']),
      quantity: z.number().min(-100_000).max(100_000),
      note: z.string().max(500).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const { type, quantity } = body.data
    if (quantity === 0) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'La quantità non può essere zero' } })
    if (type !== 'adjustment' && quantity <= 0) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Quantità deve essere positiva' } })

    // Verify the item belongs to this restaurant
    const [existing] = await db.select().from(inventoryItems).where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.restaurantId, req.user!.restaurantId))).limit(1)
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Item not found' } })

    const delta = type === 'load' ? Math.abs(quantity)
      : type === 'adjustment' ? quantity            // con segno
      : -Math.abs(quantity)                          // unload / waste

    // Movimento + aggiornamento stock in un'unica transazione (niente ledger
    // orfano). Lo stock non scende mai sotto zero (GREATEST a livello DB, atomico).
    const { movement, item } = await db.transaction(async (tx) => {
      const [movement] = await tx.insert(inventoryMovements).values({ itemId, userId: req.user!.id, type, quantity, note: body.data.note }).returning()
      const [item] = await tx.update(inventoryItems).set({
        quantity: sql`GREATEST(0, ${inventoryItems.quantity} + ${delta})`,
        updatedAt: new Date(),
      }).where(eq(inventoryItems.id, itemId)).returning()
      return { movement, item }
    })

    if (item && item.quantity <= item.minQuantity) {
      io.to(`restaurant:${req.user!.restaurantId}`).emit('inventory:alert', { itemId, name: item.name, quantity: item.quantity })
    }

    return reply.code(201).send({ data: movement })
  })

  // Parse lista ingredienti da testo con AI (Groq) → anteprima (nessuna scrittura)
  fastify.post('/import-text', { config: { rateLimit: { max: 10, timeWindow: 60000 } }, preHandler: requireAuth }, async (req, reply) => {
    // Cap di lunghezza (50k): copre un inventario reale ma evita payload enormi
    // verso Groq (saturazione context + costi amplificati).
    const parsedBody = z.object({ text: z.string().trim().min(1).max(50000) }).safeParse(req.body)
    if (!parsedBody.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'text required (max 50000 caratteri)' } })
    const { text } = parsedBody.data
    let completion: any
    try {
      const openai = getAI()
      completion = await openai.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Sei un parser di inventario per ristoranti. Estrai gli ingredienti/articoli di magazzino dal testo grezzo e restituisci JSON valido con questa forma esatta:
{
  "items": [
    { "name": "Nome ingrediente", "unit": "kg", "quantity": 10, "minQuantity": 2, "costPerUnit": 3.5, "supplier": "Fornitore" }
  ]
}
Regole:
- unit: unità di misura sensata (kg, g, l, ml, pz, bot, conf). Default "pz" se assente.
- quantity: giacenza attuale (numero). Se assente metti 0.
- minQuantity: scorta minima (numero). Se assente metti 0.
- costPerUnit: costo unitario numerico (es. 3.5). Ometti se non presente.
- supplier: fornitore. Ometti se non presente.
- Un articolo per riga/voce. Niente testo fuori dal JSON.`,
          },
          { role: 'user', content: text },
        ],
      })
    } catch {
      return reply.code(503).send({ error: { code: 'AI_UNAVAILABLE', message: 'Servizio AI non disponibile (GROQ_API_KEY).' } })
    }
    let parsed: any
    try { parsed = JSON.parse(completion.choices[0]?.message?.content ?? '{}') } catch { return reply.code(422).send({ error: { code: 'PARSE_ERROR', message: 'AI non ha restituito JSON valido' } }) }
    if (!Array.isArray(parsed?.items)) return reply.code(422).send({ error: { code: 'PARSE_ERROR', message: 'Struttura non riconosciuta' } })
    return { data: parsed }
  })

  // Conferma import: crea in blocco gli articoli dall'anteprima
  fastify.post('/import-confirm', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({
      items: z.array(z.object({
        name: z.string().min(1),
        unit: z.string().min(1).default('pz'),
        quantity: z.number().default(0),
        minQuantity: z.number().default(0),
        parLevel: z.number().nullable().optional(),
        costPerUnit: z.number().nullable().optional(),
        supplier: z.string().nullable().optional(),
      })).min(1),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    let created = 0
    for (const it of body.data.items) {
      await db.insert(inventoryItems).values({ restaurantId: req.user!.restaurantId, ...it })
      created++
    }
    return reply.code(201).send({ data: { created } })
  })
}
