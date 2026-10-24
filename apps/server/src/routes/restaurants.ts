import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, restaurants } from '@tako/db'
import { eq, sql } from 'drizzle-orm'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { readRestaurantMe } from '../lib/read-queries.js'

/**
 * Chiavi di `restaurants.settings` scritte da ALTRE route (PDF salvati, interruttori del bot, prova/rimozione agenzia).
 * PATCH /me non le gestisce: restano quelle già nel database, lette sotto lock, salvo che il client le mandi esplicitamente.
 */
export const SYSTEM_SETTINGS_KEYS = [
  'pdfDocuments', 'botEngine', 'botBrain',
  'takomenuTrial', 'trialLeadId', 'trialActivatedAt', 'trialActivatedBy',
  'takomenuRemoved', 'takomenuRemovedAt', 'takomenuRemovedBy', 'takomenuRemovedLeadId', 'takomenuRemovedPreviousActive',
] as const

/** Merge superficiale delle impostazioni: le chiavi di sistema non mandate dal client vengono dal valore corrente (letto con FOR UPDATE). */
export function mergeRestaurantSettings(current: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const base = current && typeof current === 'object' && !Array.isArray(current) ? current as Record<string, unknown> : {}
  const next: Record<string, unknown> = { ...base, ...patch }
  for (const key of SYSTEM_SETTINGS_KEYS) {
    if (Object.hasOwn(patch, key)) continue
    if (Object.hasOwn(base, key)) next[key] = base[key]
    else delete next[key]
  }
  return next
}

export async function restaurantRoutes(fastify: FastifyInstance) {
  fastify.get('/me', { preHandler: requireAuth }, async (req, reply) => {
    const r = await readRestaurantMe(req.user!.restaurantId)
    return reply.code(r.status).send(r.body)
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
      // Accetta URL assoluti O path relativo /uploads/ (coerente con imageUrl dei piatti):
      // l'upload logo restituisce /uploads/... e va servito same-origin anche sulla PWA cliente.
      logoUrl: z.string().refine((v) => v.startsWith('/uploads/') || /^https?:\/\//.test(v), 'URL logo non valido').optional().nullable(),
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
        aiPhotoProCode: z.string().max(500).optional(),
        menuEngineeringEnabled: z.boolean().optional(),
        qrMode: z.enum(['lan', 'cloud']).optional(),
        customerOrderingEnabled: z.boolean().optional(),
      }).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    // settings è un blob jsonb unico: fai MERGE coi valori esistenti, altrimenti
    // aggiornare una sola chiave (es. printerIp) cancellerebbe tutte le altre
    // (vatRate, languages, timezone…). 21/10: lettura e scrittura nella stessa transazione
    // con la riga bloccata (FOR UPDATE), così un salvataggio con dati vecchi non riscrive
    // pdfDocuments/botEngine/botBrain… salvati nel frattempo da altre route.
    const { settings, ...rest } = body.data
    const restaurantId = req.user!.restaurantId
    const updated = await db.transaction(async (tx) => {
      const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() }
      if (settings) {
        const rows = await tx.execute(sql`SELECT settings FROM restaurants WHERE id=${restaurantId} FOR UPDATE`)
        updateData.settings = mergeRestaurantSettings((rows[0] as { settings?: unknown } | undefined)?.settings, settings)
      }
      const [row] = await tx.update(restaurants).set(updateData).where(eq(restaurants.id, restaurantId)).returning()
      return row
    })
    return { data: updated }
  })
}
