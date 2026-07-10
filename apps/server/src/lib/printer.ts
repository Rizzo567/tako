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

// Una stampante di rete sta SEMPRE su un IP LAN privato. Limitare il target a
// quei range (e rifiutare loopback/link-local) impedisce di usare printerIp come
// SSRF/port-knock verso host interni arbitrari.
function isPrivateLanIPv4(ip: string): boolean {
  const m = ip.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const o = m.slice(1).map(Number)
  if (o.some(n => n > 255)) return false
  const [a, b] = o as [number, number, number, number]
  if (a === 10) return true                       // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true          // 192.168.0.0/16
  return false
}

// Porte raw-printing ESC/POS standard. Limitare il target a queste impedisce di
// usare printerPort come port-knock/probe verso servizi interni (22, 5432, 6379…).
const ALLOWED_PRINTER_PORTS = new Set([9100, 9101, 9102, 9103])

export function sendToPrinter(ip: string, port: number, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isPrivateLanIPv4(ip)) {
      return reject(new Error('Printer IP must be a private LAN address'))
    }
    if (!ALLOWED_PRINTER_PORTS.has(port)) {
      return reject(new Error('Printer port must be a raw-printing port (9100-9103)'))
    }
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
