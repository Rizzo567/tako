import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, restaurants } from '@tako/db'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import {
  sendToPrinter,
  buildComanda,
  buildScontrino,
  buildTestTicket,
} from '../lib/escpos.js'

// Config stampante letta dai settings del ristorante (owner-only, già validati altrove).
// L'IP è vincolato a LAN privata + porte 9100-9103 dentro `sendToPrinter` (guardia SSRF).
interface PrinterConfig {
  ip: string
  port: number
  cols: number
}

function readPrinterConfig(settings: any): PrinterConfig | null {
  const ip: string | undefined = settings?.printerIp
  if (!ip) return null
  const port: number = settings?.printerPort ?? 9100
  // Larghezza carta: 42 col = 80mm (default), 32 col = 58mm.
  const cols: number = settings?.printerWidth === 32 ? 32 : 42
  return { ip, port, cols }
}

export async function printRoutes(fastify: FastifyInstance) {
  // ── COMANDA CUCINA ─────────────────────────────────────────────────────────
  fastify.post('/order', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({
      tableNumber: z.string().optional(),
      orderType: z.enum(['table', 'takeaway']).optional(),
      customerName: z.string().optional(),
      items: z.array(z.object({
        name: z.string(),
        quantity: z.number().int().positive(),
        notes: z.string().optional(),
        variant: z.string().optional(),
        station: z.string().optional(),
      })).min(1),
      orderId: z.string().optional(),
    })

    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const [restaurant] = await db.select({ settings: restaurants.settings, name: restaurants.name })
      .from(restaurants)
      .where(eq(restaurants.id, req.user!.restaurantId))
      .limit(1)

    if (!restaurant) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Restaurant not found' } })

    const cfg = readPrinterConfig(restaurant.settings)
    if (!cfg) return reply.code(400).send({ error: { code: 'NO_PRINTER', message: 'Stampante non configurata nelle impostazioni' } })

    const data = buildComanda({
      tableNumber: body.data.tableNumber,
      orderType: body.data.orderType,
      customerName: body.data.customerName,
      items: body.data.items,
      cols: cfg.cols,
    })

    try {
      await sendToPrinter(cfg.ip, cfg.port, data)
      return { data: { success: true } }
    } catch (err: any) {
      // Non riflettere la stringa d'errore di rete al client (info-leak su IP/host interni).
      req.log.error({ err }, 'printer error')
      return reply.code(502).send({ error: { code: 'PRINTER_ERROR', message: 'Errore stampante' } })
    }
  })

  // ── SCONTRINO / NOTA CONTO (cortesia, non fiscale) ──────────────────────────
  fastify.post('/bill', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({
      tableNumber: z.string().optional(),
      covers: z.number().int().positive().optional(),
      items: z.array(z.object({
        name: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
      })).min(1),
      subtotal: z.number().nonnegative(),
      coverCharge: z.number().nonnegative().optional(),
      discount: z.number().nonnegative().optional(),
      discountNote: z.string().optional(),
      tip: z.number().nonnegative().optional(),
      total: z.number().nonnegative(),
      paymentMethod: z.enum(['cash', 'card', 'digital', 'split']).optional(),
      openDrawer: z.boolean().optional(),
    })

    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const [restaurant] = await db.select({ settings: restaurants.settings, name: restaurants.name })
      .from(restaurants)
      .where(eq(restaurants.id, req.user!.restaurantId))
      .limit(1)

    if (!restaurant) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Restaurant not found' } })

    const cfg = readPrinterConfig(restaurant.settings)
    if (!cfg) return reply.code(400).send({ error: { code: 'NO_PRINTER', message: 'Stampante non configurata nelle impostazioni' } })

    const s = restaurant.settings as any
    const data = buildScontrino({
      restaurantName: restaurant.name,
      address: typeof s?.address === 'string' ? s.address : undefined,
      phone: typeof s?.phone === 'string' ? s.phone : undefined,
      vatNumber: typeof s?.vatNumber === 'string' ? s.vatNumber : undefined,
      ...body.data,
      cols: cfg.cols,
    })

    try {
      await sendToPrinter(cfg.ip, cfg.port, data)
      return { data: { success: true } }
    } catch (err: any) {
      req.log.error({ err }, 'printer error')
      return reply.code(502).send({ error: { code: 'PRINTER_ERROR', message: 'Errore stampante' } })
    }
  })

  // ── STAMPA DI PROVA (dalle Impostazioni) ────────────────────────────────────
  fastify.post('/test', { preHandler: requireAuth }, async (req, reply) => {
    const [restaurant] = await db.select({ settings: restaurants.settings, name: restaurants.name })
      .from(restaurants).where(eq(restaurants.id, req.user!.restaurantId)).limit(1)
    if (!restaurant) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Restaurant not found' } })

    const cfg = readPrinterConfig(restaurant.settings)
    if (!cfg) return reply.code(400).send({ error: { code: 'NO_PRINTER', message: 'Stampante non configurata nelle impostazioni' } })

    try {
      await sendToPrinter(cfg.ip, cfg.port, buildTestTicket(restaurant.name, cfg.cols))
      return { data: { success: true } }
    } catch (err: any) {
      // Non riflettere la stringa d'errore di rete al client (info-leak su IP/host interni).
      req.log.error({ err }, 'printer error')
      return reply.code(502).send({ error: { code: 'PRINTER_ERROR', message: 'Errore stampante' } })
    }
  })
}
