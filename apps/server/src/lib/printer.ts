import { createConnection } from 'net'
import { db, restaurants } from '@tako/db'
import { eq } from 'drizzle-orm'

export function buildEscposReceipt(lines: string[]): Buffer {
  const ESC = 0x1b
  const GS = 0x1d
  const LF = 0x0a

  const chunks: Buffer[] = []
  chunks.push(Buffer.from([ESC, 0x40]))       // init
  chunks.push(Buffer.from([ESC, 0x45, 0x01])) // bold on
  chunks.push(Buffer.from([ESC, 0x61, 0x01])) // center

  for (const line of lines) {
    chunks.push(Buffer.from(line + '\n', 'latin1'))
  }

  chunks.push(Buffer.from([LF, LF, LF, GS, 0x56, 0x41, 0x03])) // feed + cut
  return Buffer.concat(chunks)
}

export function sendToPrinter(ip: string, port: number, data: Buffer): Promise<void> {
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

export interface PrintOrderParams {
  restaurantId: string
  tableNumber?: string
  items: { name: string; quantity: number; notes?: string }[]
}

export async function autoPrintOrder(params: PrintOrderParams): Promise<void> {
  const [restaurant] = await db
    .select({ settings: restaurants.settings })
    .from(restaurants)
    .where(eq(restaurants.id, params.restaurantId))
    .limit(1)

  const settings = restaurant?.settings as any
  const ip: string | undefined = settings?.printerIp
  if (!ip) return // no printer configured — silent skip

  const port: number = settings?.printerPort ?? 9100
  const now = new Date().toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })

  const lines = [
    '================================',
    `COMANDA${params.tableNumber ? ` - Tavolo ${params.tableNumber}` : ' - ASPORTO'}`,
    now,
    '================================',
    '',
    ...params.items.flatMap(item => [
      `${item.quantity}x ${item.name}`,
      ...(item.notes ? [`  >> ${item.notes}`] : []),
    ]),
    '',
    '================================',
  ]

  await sendToPrinter(ip, port, buildEscposReceipt(lines))
}
