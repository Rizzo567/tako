import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, restaurants } from '@tako/db'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { buildEscposReceipt, sendToPrinter } from '../lib/printer.js'

export async function printRoutes(fastify: FastifyInstance) {
  fastify.post('/order', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({
      tableNumber: z.string(),
      items: z.array(z.object({
        name: z.string(),
        quantity: z.number().int(),
        notes: z.string().optional(),
      })),
      orderId: z.string().optional(),
    })

    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const [restaurant] = await db.select({ settings: restaurants.settings, name: restaurants.name })
      .from(restaurants)
      .where(eq(restaurants.id, req.user!.restaurantId))
      .limit(1)

    if (!restaurant) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Restaurant not found' } })

    const settings = restaurant.settings as any
    const ip: string | undefined = settings?.printerIp
    const port: number = settings?.printerPort ?? 9100

    if (!ip) return reply.code(400).send({ error: { code: 'NO_PRINTER', message: 'Stampante non configurata nelle impostazioni' } })

    const now = new Date().toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    const lines = [
      '================================',
      `COMANDA - Tavolo ${body.data.tableNumber}`,
      now,
      '================================',
      '',
      ...body.data.items.flatMap(item => [
        `${item.quantity}x ${item.name}`,
        ...(item.notes ? [`  >> ${item.notes}`] : []),
      ]),
      '',
      '================================',
    ]

    try {
      await sendToPrinter(ip, port, buildEscposReceipt(lines))
      return { data: { success: true } }
    } catch (err: any) {
      return reply.code(502).send({ error: { code: 'PRINTER_ERROR', message: err.message ?? 'Errore stampante' } })
    }
  })

  // Stampa di prova (dalle Impostazioni)
  fastify.post('/test', { preHandler: requireAuth }, async (req, reply) => {
    const [restaurant] = await db.select({ settings: restaurants.settings, name: restaurants.name })
      .from(restaurants).where(eq(restaurants.id, req.user!.restaurantId)).limit(1)
    if (!restaurant) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Restaurant not found' } })
    const settings = restaurant.settings as any
    const ip: string | undefined = settings?.printerIp
    const port: number = settings?.printerPort ?? 9100
    if (!ip) return reply.code(400).send({ error: { code: 'NO_PRINTER', message: 'Stampante non configurata nelle impostazioni' } })
    const lines = [
      '================================',
      'TAKO - STAMPA DI PROVA',
      restaurant.name,
      new Date().toLocaleString('it-IT'),
      '================================',
      '',
      'Se leggi questo, la stampante',
      'e collegata correttamente.',
      '',
      '================================',
    ]
    try {
      await sendToPrinter(ip, port, buildEscposReceipt(lines))
      return { data: { success: true } }
    } catch (err: any) {
      return reply.code(502).send({ error: { code: 'PRINTER_ERROR', message: err.message ?? 'Errore stampante' } })
    }
  })
}
