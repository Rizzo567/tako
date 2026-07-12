import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, restaurants } from '@tako/db'
import { eq } from 'drizzle-orm'
import { requireAuth, requireRole } from '../middleware/auth.js'

export async function restaurantRoutes(fastify: FastifyInstance) {
  fastify.get('/me', { preHandler: requireAuth }, async (req, reply) => {
    const [r] = await db.select().from(restaurants).where(eq(restaurants.id, req.user!.restaurantId)).limit(1)
    if (!r) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Restaurant not found' } })
    return { data: r }
  })

  // Solo l'owner può riscrivere le impostazioni del ristorante: contengono campi
  // sensibili (printerIp/printerPort → connessione TCP arbitraria/SSRF in LAN,
  // vatRate, coverCharge, autoConfirm, payAtTableEnabled). GET /me resta requireAuth.
  fastify.patch('/me', { preHandler: requireRole('owner') }, async (req, reply) => {
    const schema = z.object({
      name: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      primaryColor: z.string().optional(),
      logoUrl: z.string().url().optional().nullable(),
      settings: z.object({
        currency: z.string().optional(),
        timezone: z.string().optional(),
        vatRate: z.number().optional(),
        languages: z.array(z.string()).optional(),
        defaultLanguage: z.string().optional(),
        tableServiceEnabled: z.boolean().optional(),
        takeawayEnabled: z.boolean().optional(),
        payAtTableEnabled: z.boolean().optional(),
        aiEnabled: z.boolean().optional(),
        printerIp: z.string().optional(),
        // solo porte raw-printing ESC/POS: evita port-probe verso servizi interni
        printerPort: z.number().int().min(9100).max(9103).optional(),
        // preferenze operative (prima solo localStorage) — ora persistite
        coverCharge: z.number().min(0).optional(),        // coperto €
        coverChargeEnabled: z.boolean().optional(),
        suggestedTips: z.boolean().optional(),
        orderSounds: z.boolean().optional(),
        autoConfirm: z.boolean().optional(),              // conferma automatica ordini
        autoPrint: z.boolean().optional(),
        kdsWarnMinutes: z.number().int().min(0).optional(),
        kdsLateMinutes: z.number().int().min(0).optional(),
        kdsCompact: z.boolean().optional(),
        reservationsEnabled: z.boolean().optional(),
        showOnboarding: z.boolean().optional(),
        // Feature flag configurabili (default OFF salvo aiContent/menuEngineering)
        loyaltyEnabled: z.boolean().optional(),
        reviewRequestEnabled: z.boolean().optional(),
        reviewUrl: z.string().max(500).optional(),
        autoStockDeductEnabled: z.boolean().optional(),
        dailyBriefingEnabled: z.boolean().optional(),
        dailyBriefingHour: z.number().int().min(0).max(23).optional(),
        aiContentEnabled: z.boolean().optional(),
        aiPhotoEnabled: z.boolean().optional(),
        menuEngineeringEnabled: z.boolean().optional(),
      }).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    // settings è un blob jsonb unico: fai MERGE coi valori esistenti, altrimenti
    // aggiornare una sola chiave (es. printerIp) cancellerebbe tutte le altre
    // (vatRate, languages, timezone…).
    const { settings, ...rest } = body.data
    const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() }
    if (settings) {
      const [current] = await db.select({ settings: restaurants.settings }).from(restaurants).where(eq(restaurants.id, req.user!.restaurantId)).limit(1)
      updateData.settings = { ...(current?.settings ?? {}), ...settings }
    }

    const [updated] = await db.update(restaurants).set(updateData).where(eq(restaurants.id, req.user!.restaurantId)).returning()
    return { data: updated }
  })
}
