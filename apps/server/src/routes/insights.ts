import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, orders, orderItems, menuItems } from '@tako/db'
import { eq, and, gte, inArray, sql } from 'drizzle-orm'
import { requireAuth, requireRole } from '../middleware/auth.js'
import OpenAI from 'openai'

const getOpenAI = () => {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set')
  return new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
}

// ── Types ────────────────────────────────────────────────────────────────────

export type MenuItemMetrics = {
  menuItemId: string
  name: string
  totalQty: number
  totalRevenue: number
  avgPrice: number
  revenueShare: number      // % of total restaurant revenue in period
  velocityPerDay: number    // avg orders per day
  costPrice: number | null
  marginPercent: number | null
  isFeatured: boolean
  quadrant: 'star' | 'plowhorse' | 'puzzle' | 'dog' | 'unknown'
}

export type AiSuggestion = {
  menuItemId: string
  itemName: string
  type: 'increase_price' | 'decrease_price' | 'feature' | 'reposition' | 'remove' | 'bundle' | 'cost_check'
  action: string
  reason: string
  estimatedMonthlyImpact: string
}

// ── Menu Engineering Quadrant logic ──────────────────────────────────────────
// Boston Matrix for restaurants:
// Star    = high volume + high margin
// Plowhorse = high volume + low margin
// Puzzle  = low volume + high margin
// Dog     = low volume + low margin

function assignQuadrant(
  item: { totalQty: number; marginPercent: number | null },
  medianQty: number,
  medianMargin: number,
): MenuItemMetrics['quadrant'] {
  if (item.marginPercent === null) return 'unknown'
  const highVol = item.totalQty >= medianQty
  const highMargin = item.marginPercent >= medianMargin
  if (highVol && highMargin) return 'star'
  if (highVol && !highMargin) return 'plowhorse'
  if (!highVol && highMargin) return 'puzzle'
  return 'dog'
}

function median(nums: number[]): number {
  if (!nums.length) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function insightsRoutes(fastify: FastifyInstance) {

  // GET /insights/menu?days=30
  // Rate-limit di rotta (per-ristorante): l'aggregazione su fino a 365 giorni è
  // costosa; il globale per-IP non basta a evitarne l'abuso ripetuto.
  fastify.get('/menu', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: 60000, keyGenerator: (req: any) => req.user?.restaurantId ?? req.ip } },
  }, async (req, _reply) => {
    const { days: daysStr } = req.query as { days?: string }
    const days = Math.min(Math.max(parseInt(daysStr ?? '30', 10) || 30, 7), 365)
    const restaurantId = req.user!.restaurantId
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Aggregazione UNICA con JOIN orders↔order_items: niente materializzazione di
    // tutti gli orderId del periodo né IN-list gigante. Filtra direttamente sugli
    // ordini (usa orders_restaurant_created_at_idx + order_items_order_id_idx).
    const rawItems = await db
      .select({
        menuItemId: orderItems.menuItemId,
        name: orderItems.name,
        totalQty: sql<number>`SUM(${orderItems.quantity})::int`.as('total_qty'),
        totalRevenue: sql<number>`SUM(${orderItems.quantity} * ${orderItems.unitPrice})::float`.as('total_revenue'),
        avgPrice: sql<number>`AVG(${orderItems.unitPrice})::float`.as('avg_price'),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orders.restaurantId, restaurantId),
          inArray(orders.status, ['served', 'paid']),
          gte(orders.createdAt, since),
        ),
      )
      .groupBy(orderItems.menuItemId, orderItems.name)
      .orderBy(sql`SUM(${orderItems.quantity} * ${orderItems.unitPrice}) DESC`)

    if (!rawItems.length) {
      return { data: { items: [], periodDays: days, totalRevenue: 0 } }
    }

    // Fetch menu items for costPrice + featured
    const filteredItems = rawItems.filter(r => r.menuItemId != null) as (typeof rawItems[number] & { menuItemId: string })[]
    const itemIds = filteredItems.map(r => r.menuItemId)
    const dbItems = await db
      .select({
        id: menuItems.id,
        costPrice: menuItems.costPrice,
        featured: menuItems.featured,
      })
      .from(menuItems)
      .where(
        and(
          inArray(menuItems.id, itemIds),
          eq(menuItems.restaurantId, restaurantId),
        ),
      )
    const dbItemMap = new Map(dbItems.map(i => [i.id, i]))

    const totalRevenue = rawItems.reduce((s, i) => s + i.totalRevenue, 0)

    // Build metrics (without quadrant first)
    const metrics: Omit<MenuItemMetrics, 'quadrant'>[] = filteredItems.map(r => {
      const dbItem = dbItemMap.get(r.menuItemId)
      const costPrice = dbItem?.costPrice ?? null
      const marginPercent = costPrice != null && r.avgPrice > 0
        ? Math.round(((r.avgPrice - costPrice) / r.avgPrice) * 100)
        : null
      return {
        menuItemId: r.menuItemId,
        name: r.name,
        totalQty: r.totalQty,
        totalRevenue: Math.round(r.totalRevenue * 100) / 100,
        avgPrice: Math.round(r.avgPrice * 100) / 100,
        revenueShare: totalRevenue > 0 ? Math.round((r.totalRevenue / totalRevenue) * 1000) / 10 : 0,
        velocityPerDay: Math.round((r.totalQty / days) * 10) / 10,
        costPrice,
        marginPercent,
        isFeatured: dbItem?.featured ?? false,
      }
    })

    // Assign quadrants using medians
    const qtys = metrics.map(m => m.totalQty)
    const margins = metrics.filter(m => m.marginPercent !== null).map(m => m.marginPercent!)
    const medQty = median(qtys)
    const medMargin = margins.length ? median(margins) : 50

    const itemsWithQuadrant: MenuItemMetrics[] = metrics.map(m => ({
      ...m,
      quadrant: assignQuadrant(m, medQty, medMargin),
    }))

    return {
      data: {
        items: itemsWithQuadrant,
        periodDays: days,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        medianQty: Math.round(medQty * 10) / 10,
        medianMargin: medMargin,
      },
    }
  })

  // POST /insights/menu/ai — solo owner (Groq costoso, max_tokens alto) + rate-limit
  // per-ristorante. Le stringhe client-controlled hanno un cap di lunghezza: senza,
  // qualunque ruolo poteva pompare prompt enormi nel modello.
  fastify.post('/menu/ai', {
    preHandler: requireRole('owner'),
    config: { rateLimit: { max: 5, timeWindow: 60000, keyGenerator: (req: any) => req.user?.restaurantId ?? req.ip } },
  }, async (req, reply) => {
    const schema = z.object({
      items: z.array(z.object({
        menuItemId: z.string().max(64),
        name: z.string().max(120),
        totalQty: z.number(),
        totalRevenue: z.number(),
        avgPrice: z.number(),
        revenueShare: z.number(),
        velocityPerDay: z.number(),
        costPrice: z.number().nullable(),
        marginPercent: z.number().nullable(),
        isFeatured: z.boolean(),
        quadrant: z.enum(['star', 'plowhorse', 'puzzle', 'dog', 'unknown']),
      })).min(1).max(50),
      periodDays: z.number().default(30),
      totalRevenue: z.number(),
    })

    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const { items, periodDays, totalRevenue } = body.data

    const SYSTEM_PROMPT = `Sei un esperto di menu engineering per ristoranti.
Ricevi dati sulle performance dei piatti e produci suggerimenti concreti, data-driven, in italiano.

Regole:
- Massimo 5 suggerimenti, ordinati per impatto economico decrescente
- Ogni suggerimento deve essere specifico (cita il nome del piatto e i numeri)
- Tono diretto, da consulente — niente giri di parole
- Stima l'impatto mensile in euro quando possibile
- Quadranti: star=alto volume+alto margine, plowhorse=alto volume+basso margine, puzzle=basso volume+alto margine, dog=basso volume+basso margine

Output: JSON array di suggerimenti con questa struttura esatta:
[{
  "menuItemId": "uuid",
  "itemName": "nome piatto",
  "type": "increase_price|decrease_price|feature|reposition|remove|bundle|cost_check",
  "action": "Frase imperativa breve (es: Aumenta il prezzo a €X)",
  "reason": "Motivazione data-driven in 1-2 frasi",
  "estimatedMonthlyImpact": "es: +€120/mese"
}]`

    const dataForAI = items.slice(0, 20).map(i => ({
      id: i.menuItemId,
      nome: i.name,
      venduti_periodo: i.totalQty,
      ricavo_totale: `€${i.totalRevenue.toFixed(2)}`,
      prezzo_medio: `€${i.avgPrice.toFixed(2)}`,
      quota_ricavo: `${i.revenueShare}%`,
      vendite_giorno: i.velocityPerDay,
      costo_ingredienti: i.costPrice != null ? `€${i.costPrice.toFixed(2)}` : 'non impostato',
      margine_percent: i.marginPercent != null ? `${i.marginPercent}%` : 'sconosciuto',
      in_evidenza: i.isFeatured,
      quadrante: i.quadrant,
    }))

    const userMessage = `Periodo analisi: ${periodDays} giorni. Ricavo totale: €${totalRevenue.toFixed(2)}.

Dati piatti:
${JSON.stringify(dataForAI, null, 2)}

Produci i suggerimenti.`

    try {
      const openai = getOpenAI()
      const completion = await openai.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      })

      const raw = completion.choices[0]?.message?.content ?? '{}'
      let parsed: any
      try {
        parsed = JSON.parse(raw)
      } catch {
        return reply.code(502).send({ error: { code: 'AI_PARSE', message: 'Risposta AI non valida' } })
      }

      // Handle both {suggestions: [...]} and [...] responses
      const suggestions: AiSuggestion[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.suggestions) ? parsed.suggestions : []

      return { data: { suggestions: suggestions.slice(0, 5) } }
    } catch (err: any) {
      if (err.message?.includes('OPENAI_API_KEY')) {
        return reply.code(503).send({ error: { code: 'AI_UNAVAILABLE', message: 'GROQ_API_KEY non configurata' } })
      }
      fastify.log.error(err, 'insights AI error')
      return reply.code(502).send({ error: { code: 'AI_ERROR', message: 'Errore AI temporaneo' } })
    }
  })

  // PATCH /insights/menu/:itemId/cost — update cost price for a menu item
  fastify.patch('/menu/:itemId/cost', { preHandler: requireAuth }, async (req, reply) => {
    const { itemId } = req.params as { itemId: string }
    const schema = z.object({ costPrice: z.number().min(0).max(9999) })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const [item] = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(and(eq(menuItems.id, itemId), eq(menuItems.restaurantId, req.user!.restaurantId)))
      .limit(1)

    if (!item) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Piatto non trovato' } })

    await db
      .update(menuItems)
      .set({ costPrice: body.data.costPrice, updatedAt: new Date() })
      .where(eq(menuItems.id, itemId))

    return { data: { ok: true } }
  })
}
