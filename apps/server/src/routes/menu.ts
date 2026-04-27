import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, menus, menuSections, menuItems, itemVariants } from '@tako/db'
import { eq, and, asc } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { io } from '../index.js'

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

    const [section] = await db.insert(menuSections).values({ menuId, ...body.data }).returning()
    return reply.code(201).send({ data: section })
  })

  // Update section
  fastify.patch('/sections/:sectionId', { preHandler: requireAuth }, async (req, reply) => {
    const { sectionId } = req.params as { sectionId: string }
    const [section] = await db.update(menuSections).set(req.body as any).where(eq(menuSections.id, sectionId)).returning()
    if (!section) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Section not found' } })
    return { data: section }
  })

  // Create item
  fastify.post('/sections/:sectionId/items', { preHandler: requireAuth }, async (req, reply) => {
    const { sectionId } = req.params as { sectionId: string }
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      price: z.number().positive(),
      allergens: z.array(z.string()).default([]),
      tags: z.array(z.string()).default([]),
      imageUrl: z.string().url().optional(),
      kitchenStation: z.string().optional(),
      prepTimeMinutes: z.number().default(10),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const [item] = await db.insert(menuItems).values({ sectionId, restaurantId: req.user!.restaurantId, ...body.data }).returning()
    return reply.code(201).send({ data: item })
  })

  // Update item
  fastify.patch('/items/:itemId', { preHandler: requireAuth }, async (req, reply) => {
    const { itemId } = req.params as { itemId: string }
    const [item] = await db.update(menuItems).set({ ...(req.body as any), updatedAt: new Date() }).where(eq(menuItems.id, itemId)).returning()
    if (!item) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Item not found' } })

    // Broadcast menu change to all customers of this restaurant
    io.to(`restaurant:${req.user!.restaurantId}`).emit('menu:updated', { itemId, item })
    return { data: item }
  })

  // Toggle item availability (quick endpoint)
  fastify.patch('/items/:itemId/availability', { preHandler: requireAuth }, async (req, reply) => {
    const { itemId } = req.params as { itemId: string }
    const { available } = req.body as { available: boolean }
    const [item] = await db.update(menuItems).set({ available, updatedAt: new Date() }).where(eq(menuItems.id, itemId)).returning()
    if (!item) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Item not found' } })
    io.to(`restaurant:${req.user!.restaurantId}`).emit('menu:item_availability', { itemId, available })
    return { data: item }
  })

  // Delete item
  fastify.delete('/items/:itemId', { preHandler: requireAuth }, async (req, reply) => {
    const { itemId } = req.params as { itemId: string }
    await db.delete(menuItems).where(eq(menuItems.id, itemId))
    return { data: { success: true } }
  })

  // Add variant to item
  fastify.post('/items/:itemId/variants', { preHandler: requireAuth }, async (req, reply) => {
    const { itemId } = req.params as { itemId: string }
    const schema = z.object({ name: z.string().min(1), priceModifier: z.number().default(0) })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    const [variant] = await db.insert(itemVariants).values({ itemId, ...body.data }).returning()
    return reply.code(201).send({ data: variant })
  })
}
