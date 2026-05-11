import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createConnection } from 'net'
import { db, restaurants } from '@tako/db'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'

function escposReceipt(lines: string[]): Buffer {
  const ESC = 0x1b
  const GS = 0x1d
  const LF = 0x0a

  const chunks: Buffer[] = []

  // Init
  chunks.push(Buffer.from([ESC, 0x40]))
  // Bold on
  chunks.push(Buffer.from([ESC, 0x45, 0x01]))
  // Center
  chunks.push(Buffer.from([ESC, 0x61, 0x01]))

  for (const line of lines) {
    chunks.push(Buffer.from(line + '\n', 'latin1'))
  }

  // Feed + cut
  chunks.push(Buffer.from([LF, LF, LF, GS, 0x56, 0x41, 0x03]))

  return Buffer.concat(chunks)
}

function sendToPrinter(ip: string, port: number, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = createConnection({ host: ip, port }, () => {
      client.write(data, (err) => {
        if (err) return reject(err)
        client.end()
        resolve()
      })
    })
    client.setTimeout(5000)
    client.on('timeout', () => { client.destroy(); reject(new Error('Printer timeout')) })
    client.on('error', reject)
  })
}

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
      await sendToPrinter(ip, port, escposReceipt(lines))
      return { data: { success: true } }
    } catch (err: any) {
      return reply.code(502).send({ error: { code: 'PRINTER_ERROR', message: err.message ?? 'Errore stampante' } })
    }
  })
}
