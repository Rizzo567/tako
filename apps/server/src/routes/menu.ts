import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, menus, menuSections, menuItems, itemVariants, orderItems } from '@tako/db'
import { eq, and, asc, isNotNull } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { io } from '../index.js'
import OpenAI from 'openai'

const getAI = () => {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set')
  return new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
}

// Ownership guard helpers (anti-IDOR): verificano che la risorsa appartenga al
// ristorante dell'utente autenticato prima di mutarla by-id.
async function ownsMenu(menuId: string, restaurantId: string) {
  const [row] = await db.select({ id: menus.id }).from(menus)
    .where(and(eq(menus.id, menuId), eq(menus.restaurantId, restaurantId))).limit(1)
  return !!row
}
async function ownsSection(sectionId: string, restaurantId: string) {
  const [row] = await db.select({ id: menuSections.id }).from(menuSections)
    .innerJoin(menus, eq(menuSections.menuId, menus.id))
    .where(and(eq(menuSections.id, sectionId), eq(menus.restaurantId, restaurantId))).limit(1)
  return !!row
}
async function ownsItem(itemId: string, restaurantId: string) {
  const [row] = await db.select({ id: menuItems.id }).from(menuItems)
    .where(and(eq(menuItems.id, itemId), eq(menuItems.restaurantId, restaurantId))).limit(1)
  return !!row
}

export async function menuRoutes(fastify: FastifyInstance) {
  // Get all menus for restaurant
  fastify.get('/', { preHandler: requireAuth }, async (req) => {
    const all = await db.select().from(menus).where(eq(menus.restaurantId, req.user!.restaurantId)).orderBy(asc(menus.position))
    return { data: all }
  })

  // Create menu
  fastify.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({ name: z.string().min(1), type: z.enum(['main', 'lunch', 'dinner', 'seasonal', 'event', 'drinks']).default('main') })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const [menu] = await db.insert(menus).values({ restaurantId: req.user!.restaurantId, ...body.data }).returning()
    return reply.code(201).send({ data: menu })
  })

  // Get full menu with sections + items
  fastify.get('/:menuId', { preHandler: requireAuth }, async (req, reply) => {
    const { menuId } = req.params as { menuId: string }
    const [menu] = await db.select().from(menus).where(and(eq(menus.id, menuId), eq(menus.restaurantId, req.user!.restaurantId))).limit(1)
    if (!menu) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Menu not found' } })

    const sections = await db.select().from(menuSections).where(eq(menuSections.menuId, menuId)).orderBy(asc(menuSections.position))
    const items = await db.select().from(menuItems).where(eq(menuItems.restaurantId, req.user!.restaurantId)).orderBy(asc(menuItems.position))
    const variants = await db.select().from(itemVariants)

    const sectionsWithItems = sections.map(s => ({
      ...s,
      items: items
        .filter(i => i.sectionId === s.id)
        .map(i => ({ ...i, variants: variants.filter(v => v.itemId === i.id) })),
    }))

    return { data: { ...menu, sections: sectionsWithItems } }
  })

  // Create section
  fastify.post('/:menuId/sections', { preHandler: requireAuth }, async (req, reply) => {
    const { menuId } = req.params as { menuId: string }
    const schema = z.object({ name: z.string().min(1), description: z.string().optional() })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    if (!(await ownsMenu(menuId, req.user!.restaurantId))) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Menu not found' } })

    const [section] = await db.insert(menuSections).values({ menuId, ...body.data }).returning()
    return reply.code(201).send({ data: section })
  })

  // Update section
  fastify.patch('/sections/:sectionId', { preHandler: requireAuth }, async (req, reply) => {
    const { sectionId } = req.params as { sectionId: string }
    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      active: z.boolean().optional(),
      position: z.number().int().min(0).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    if (!(await ownsSection(sectionId, req.user!.restaurantId))) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Section not found' } })
    const [section] = await db.update(menuSections).set(body.data).where(eq(menuSections.id, sectionId)).returning()
    if (!section) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Section not found' } })
    return { data: section }
  })

  // Delete section
  fastify.delete('/sections/:sectionId', { preHandler: requireAuth }, async (req, reply) => {
    const { sectionId } = req.params as { sectionId: string }
    if (!(await ownsSection(sectionId, req.user!.restaurantId))) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Section not found' } })
    const items = await db.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.sectionId, sectionId))
    if (items.length > 0) {
      const ids = items.map(i => i.id)
      for (const id of ids) {
        await db.update(orderItems).set({ menuItemId: null }).where(eq(orderItems.menuItemId, id))
      }
    }
    await db.delete(menuSections).where(eq(menuSections.id, sectionId))
    return { data: { success: true } }
  })

  // Create item
  fastify.post('/sections/:sectionId/items', { preHandler: requireAuth }, async (req, reply) => {
    const { sectionId } = req.params as { sectionId: string }
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      price: z.number().min(0),
      allergens: z.array(z.string()).default([]),
      tags: z.array(z.string()).default([]),
      imageUrl: z.string().min(1).refine((v) => v.startsWith('/uploads/') || /^https?:\/\//.test(v), 'URL immagine non valido').optional(),
      kitchenStation: z.string().optional(),
      prepTimeMinutes: z.number().default(10),
      costPrice: z.number().min(0).optional(), // food cost (per margine/analisi menu)
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    if (!(await ownsSection(sectionId, req.user!.restaurantId))) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Section not found' } })

    const [item] = await db.insert(menuItems).values({ sectionId, restaurantId: req.user!.restaurantId, ...body.data }).returning()
    return reply.code(201).send({ data: item })
  })

  // Update item
  fastify.patch('/items/:itemId', { preHandler: requireAuth }, async (req, reply) => {
    const { itemId } = req.params as { itemId: string }
    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      price: z.number().min(0).optional(),
      available: z.boolean().optional(),
      allergens: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      imageUrl: z.string().min(1).refine((v) => v.startsWith('/uploads/') || /^https?:\/\//.test(v), 'URL immagine non valido').optional(),
      kitchenStation: z.string().optional(),
      prepTimeMinutes: z.number().int().min(0).optional(),
      position: z.number().int().min(0).optional(),
      costPrice: z.number().min(0).optional(), // food cost editabile
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    const [item] = await db.update(menuItems)
      .set({ ...body.data, updatedAt: new Date() })
      .where(and(eq(menuItems.id, itemId), eq(menuItems.restaurantId, req.user!.restaurantId)))
      .returning()
    if (!item) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Item not found' } })

    // Broadcast menu change: dashboard staff (room privata) riceve la riga COMPLETA;
    // la room pubblica menu:{id} (anonima, joinabile da chiunque) riceve solo i campi
    // pubblici — MAI costPrice (food cost/margine) né altri campi interni.
    io.to(`restaurant:${req.user!.restaurantId}`).emit('menu:updated', { itemId, item })
    const publicItem = {
      id: item.id,
      sectionId: item.sectionId,
      name: item.name,
      description: item.description,
      price: item.price,
      imageUrl: item.imageUrl,
      allergens: item.allergens,
      tags: item.tags,
      available: item.available,
    }
    io.to(`menu:${req.user!.restaurantId}`).emit('menu:updated', { itemId, item: publicItem })
    return { data: item }
  })

  // Toggle item availability (quick endpoint)
  fastify.patch('/items/:itemId/availability', { preHandler: requireAuth }, async (req, reply) => {
    const { itemId } = req.params as { itemId: string }
    const { available } = req.body as { available: boolean }
    const [item] = await db.update(menuItems).set({ available, updatedAt: new Date() }).where(and(eq(menuItems.id, itemId), eq(menuItems.restaurantId, req.user!.restaurantId))).returning()
    if (!item) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Item not found' } })
    io.to(`restaurant:${req.user!.restaurantId}`).emit('menu:item_availability', { itemId, available })
    io.to(`menu:${req.user!.restaurantId}`).emit('menu:item_availability', { itemId, available })
    return { data: item }
  })

  // Delete item
  fastify.delete('/items/:itemId', { preHandler: requireAuth }, async (req, reply) => {
    const { itemId } = req.params as { itemId: string }
    if (!(await ownsItem(itemId, req.user!.restaurantId))) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Item not found' } })
    await db.update(orderItems).set({ menuItemId: null }).where(eq(orderItems.menuItemId, itemId))
    await db.delete(menuItems).where(eq(menuItems.id, itemId))
    return { data: { success: true } }
  })

  // Add variant to item
  fastify.post('/items/:itemId/variants', { preHandler: requireAuth }, async (req, reply) => {
    const { itemId } = req.params as { itemId: string }
    const schema = z.object({ name: z.string().min(1), priceModifier: z.number().default(0) })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    if (!(await ownsItem(itemId, req.user!.restaurantId))) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Item not found' } })
    const [variant] = await db.insert(itemVariants).values({ itemId, ...body.data }).returning()
    return reply.code(201).send({ data: variant })
  })

  // Delete variant
  fastify.delete('/items/:itemId/variants/:variantId', { preHandler: requireAuth }, async (req, reply) => {
    const { itemId, variantId } = req.params as { itemId: string; variantId: string }
    const [item] = await db.select({ id: menuItems.id }).from(menuItems).where(and(eq(menuItems.id, itemId), eq(menuItems.restaurantId, req.user!.restaurantId))).limit(1)
    if (!item) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Item not found' } })
    // Anti-IDOR: la variante deve appartenere all'item già verificato come di proprietà.
    // itemVariants non ha restaurantId, quindi senza questo vincolo la delete attraverserebbe
    // il confine tenant cancellando varianti di un altro ristorante by-id.
    const deleted = await db.delete(itemVariants)
      .where(and(eq(itemVariants.id, variantId), eq(itemVariants.itemId, itemId)))
      .returning()
    if (!deleted.length) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Variant not found' } })
    return { data: { success: true } }
  })

  // Parse raw menu text with AI → return preview (no DB write)
  fastify.post('/:menuId/import-text', { config: { rateLimit: { max: 10, timeWindow: 60000 } }, preHandler: requireAuth }, async (req, reply) => {
    const { menuId } = req.params as { menuId: string }
    // Cap di lunghezza: 50k caratteri coprono un menu reale ma evitano di saturare
    // la context window di Groq e amplificarne i costi con payload enormi.
    const parsedBody = z.object({ text: z.string().trim().min(1).max(50000) }).safeParse(req.body)
    if (!parsedBody.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'text required (max 50000 caratteri)' } })
    const { text } = parsedBody.data

    const [menu] = await db.select().from(menus).where(and(eq(menus.id, menuId), eq(menus.restaurantId, req.user!.restaurantId))).limit(1)
    if (!menu) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Menu not found' } })

    let completion: Awaited<ReturnType<ReturnType<typeof getAI>['chat']['completions']['create']>>
    try {
      const openai = getAI()
      completion = await openai.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Sei un parser di menu ristorante. Estrai la struttura dal testo grezzo e restituisci JSON valido con questa forma esatta:
{
  "sections": [
    {
      "name": "Nome sezione",
      "items": [
        {
          "name": "Nome piatto",
          "description": "descrizione opzionale",
          "price": 12.50,
          "allergens": ["glutine", "latte"]
        }
      ]
    }
  ]
}
Regole:
- price deve essere un numero (es. 8.5, non "8,50€")
- Se il prezzo non è presente metti 0
- allergens: array stringhe in italiano, solo quelli esplicitamente menzionati
- description: solo se presente nel testo
- Raggruppa i piatti per sezione naturale (Antipasti, Primi, Secondi, Dolci, Bevande, ecc.)
- Se non ci sono sezioni esplicite, crea una sezione "Menu"`,
          },
          { role: 'user', content: text },
        ],
      })
    } catch (err: any) {
      return reply.code(503).send({ error: { code: 'AI_UNAVAILABLE', message: 'Servizio AI non disponibile. Verifica la chiave OpenAI.' } })
    }

    const raw = completion.choices[0]?.message?.content ?? '{}'
    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch {
      return reply.code(422).send({ error: { code: 'PARSE_ERROR', message: 'AI non ha restituito JSON valido' } })
    }

    if (!Array.isArray(parsed?.sections)) {
      return reply.code(422).send({ error: { code: 'PARSE_ERROR', message: 'Struttura non riconosciuta' } })
    }

    return { data: parsed }
  })

  // Confirm import: bulk-create sections + items from parsed preview
  fastify.post('/:menuId/import-confirm', { preHandler: requireAuth }, async (req, reply) => {
    const { menuId } = req.params as { menuId: string }
    const bodySchema = z.object({
      sections: z.array(z.object({
        name: z.string().min(1),
        items: z.array(z.object({
          name: z.string().min(1),
          description: z.string().nullable().optional(),
          price: z.number().min(0),
          allergens: z.array(z.string()).nullable().optional(),
        })),
      })),
    })
    const body = bodySchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const [menu] = await db.select().from(menus).where(and(eq(menus.id, menuId), eq(menus.restaurantId, req.user!.restaurantId))).limit(1)
    if (!menu) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Menu not found' } })

    let totalSections = 0
    let totalItems = 0

    for (const [si, sec] of body.data.sections.entries()) {
      const [section] = await db.insert(menuSections).values({ menuId, name: sec.name, position: si }).returning()
      totalSections++

      for (const [ii, item] of sec.items.entries()) {
        await db.insert(menuItems).values({
          sectionId: section!.id,
          restaurantId: (req.user as any).restaurantId,
          name: item.name,
          description: item.description ?? undefined,
          price: item.price,
          allergens: item.allergens ?? [],
          position: ii,
        })
        totalItems++
      }
    }

    return { data: { sections: totalSections, items: totalItems } }
  })
}
