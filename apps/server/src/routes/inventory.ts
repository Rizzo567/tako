import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, inventoryItems, inventoryMovements } from '@tako/db'
import { eq, and, lte, sql } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { io } from '../index.js'
import OpenAI from 'openai'

function getAI() {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set')
  return new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
}

export async function inventoryRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: requireAuth }, async (req) => {
    const items = await db.select().from(inventoryItems).where(eq(inventoryItems.restaurantId, req.user!.restaurantId))
    return { data: items }
  })

  fastify.get('/alerts', { preHandler: requireAuth }, async (req) => {
    const alerts = await db.select().from(inventoryItems).where(and(
      eq(inventoryItems.restaurantId, req.user!.restaurantId),
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
      costPerUnit: z.number().optional(),
      supplier: z.string().optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    const [item] = await db.insert(inventoryItems).values({ restaurantId: req.user!.restaurantId, ...body.data }).returning()
    return reply.code(201).send({ data: item })
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
