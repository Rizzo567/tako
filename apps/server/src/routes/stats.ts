import type { FastifyInstance } from 'fastify'
import { db, orders, orderItems, bills, restaurants, tableSessions } from '@tako/db'
import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { round2, restaurantTimezone, dayKeyInTz, dayStartInTz, dayEndInTz } from '../lib/billing.js'

// Parsa una data dalla query; se assente o non valida usa il fallback (niente
// "Invalid Date" che azzererebbe silenziosamente tutte le statistiche).
function parseDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback
  const d = new Date(value)
  return isNaN(d.getTime()) ? fallback : d
}

// ─────────────────────────── Il periodo, calcolato UNA VOLTA ───────────────────────────
// `/dashboard` e `/export` devono dare gli STESSI numeri sullo stesso intervallo — è
// lo Stop di F4.4, e un CSV che non torna con la schermata da cui è stato esportato
// è peggio di nessun CSV. L'unico modo di garantirlo è che sia la stessa funzione:
// due implementazioni "uguali" divergono al primo arrotondamento cambiato.
async function periodTotals(restaurantId: string, startDate: Date, endDate: Date) {
  const closedBills = await db.select().from(bills).where(and(
    eq(bills.restaurantId, restaurantId),
    eq(bills.status, 'closed'),
    gte(bills.closedAt!, startDate),
    lte(bills.closedAt!, endDate),
  ))

  // NOTA sul significato di `revenue`: qui è la somma di `bills.total`, MANCE
  // INCLUSE. È la definizione storica di /dashboard, e /export la eredita perché
  // deve coincidere con essa. `GET /api/bills/summary/today` invece la mancia la
  // toglie (è pass-through allo staff). Le due viste NON concordano, e non è questo
  // il task che lo risolve: l'export espone perciò anche `tips` e l'incasso netto,
  // così nel CSV il numero non è mai ambiguo.
  const revenue = round2(closedBills.reduce((s, b) => s + b.total, 0))
  const tips = round2(closedBills.reduce((s, b) => s + (b.tip ?? 0), 0))
  const discounts = round2(closedBills.reduce((s, b) => s + (b.discount ?? 0), 0))
  const avgTicket = closedBills.length ? round2(revenue / closedBills.length) : 0
  const totalCovers = closedBills.reduce((s, b) => s + (b.covers ?? 1), 0)

  // Piatti più venduti: stessa finestra del fatturato, ordini serviti o pagati.
  const servedOrders = await db.select().from(orders).where(and(
    eq(orders.restaurantId, restaurantId),
    inArray(orders.status, ['served', 'paid']),
    gte(orders.createdAt, startDate),
    lte(orders.createdAt, endDate),
  ))

  const allOrderItems = servedOrders.length
    ? await db
        .select({ name: orderItems.name, qty: orderItems.quantity, unitPrice: orderItems.unitPrice })
        .from(orderItems)
        .where(inArray(orderItems.orderId, servedOrders.map(o => o.id)))
    : []

  const itemCounts = new Map<string, { qty: number; revenue: number }>()
  for (const item of allOrderItems) {
    const existing = itemCounts.get(item.name) ?? { qty: 0, revenue: 0 }
    itemCounts.set(item.name, {
      qty: existing.qty + item.qty,
      revenue: existing.revenue + (item.qty * item.unitPrice),
    })
  }
  const topItems = [...itemCounts.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .map(([name, data]) => ({ name, ...data }))

  return { closedBills, revenue, tips, discounts, avgTicket, totalCovers, billsCount: closedBills.length, topItems }
}

// ─────────────────────────────── CSV ───────────────────────────────
// Convenzione italiana: separatore `;` e virgola decimale — è ciò che Excel/Numbers
// in locale IT si aspettano. Con il punto decimale un foglio italiano legge "45.72"
// come quarantacinquemilasettecentoventidue.
const SEP = ';'

function csvCell(v: string | number | null | undefined): string {
  if (v == null) return ''
  if (typeof v === 'number') return (Math.round(v * 100) / 100).toFixed(2).replace('.', ',')
  const s = String(v)
  // Le virgolette si raddoppiano; si quota qualunque cella con separatore, virgolette
  // o a capo dentro — i nomi dei piatti sono testo libero scritto da un umano.
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const csvRow = (cells: (string | number | null | undefined)[]) => cells.map(csvCell).join(SEP)

export async function statsRoutes(fastify: FastifyInstance) {
  fastify.get('/dashboard', { preHandler: requireAuth }, async (req) => {
    const restaurantId = req.user!.restaurantId
    // "La giornata" nel fuso del ristorante (setting timezone, default Europe/Rome):
    // le date 'YYYY-MM-DD' di from/to sono inizio/fine giornata LOCALE, non UTC né
    // ora-server, così i bucket e "oggi" combaciano con bills.ts.
    const tz = await restaurantTimezone(restaurantId)
    const { from, to } = req.query as { from?: string; to?: string }
    const isDay = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
    const startDate = isDay(from) ? dayStartInTz(from!, tz) : parseDate(from, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    const endDate = isDay(to) ? dayEndInTz(to!, tz) : parseDate(to, new Date())

    // Revenue in period — la stessa funzione che alimenta /export (vedi periodTotals).
    const { closedBills, revenue, avgTicket, totalCovers, topItems: allTopItems } = await periodTotals(restaurantId, startDate, endDate)

    // Today (mezzanotte nel fuso del ristorante)
    const today = dayStartInTz(dayKeyInTz(new Date(), tz), tz)
    const todayBills = closedBills.filter(b => b.closedAt && b.closedAt >= today)
    const todayRevenue = todayBills.reduce((s, b) => s + b.total, 0)

    const topItems = allTopItems.slice(0, 10)

    // Daily revenue breakdown (last 7 days) — chiavi giorno nel fuso del ristorante
    const dailyRevenue: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const key = dayKeyInTz(d, tz)
      dailyRevenue[key] = 0
    }
    closedBills.forEach(b => {
      if (!b.closedAt) return
      const key = dayKeyInTz(b.closedAt, tz)
      if (key in dailyRevenue) dailyRevenue[key]! += b.total
    })

    // Pending orders count
    const pendingOrders = await db.select().from(orders).where(and(
      eq(orders.restaurantId, restaurantId),
      eq(orders.status, 'pending'),
    ))

    // Session analytics
    const periodSessions = await db
      .select()
      .from(tableSessions)
      .where(and(
        eq(tableSessions.restaurantId, restaurantId),
        gte(tableSessions.scannedAt, startDate),
        lte(tableSessions.scannedAt, endDate),
      ))

    const totalScans = periodSessions.length
    const convertedSessions = periodSessions.filter(s => s.firstOrderAt !== null)
    const conversionRate = totalScans > 0 ? Math.round((convertedSessions.length / totalScans) * 100) : 0

    const timings = convertedSessions
      .map(s => s.timeToFirstOrderSec)
      .filter((t): t is number => t !== null && t > 0 && t < 3600)
    const avgTimeToFirstOrderSec = timings.length
      ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length)
      : null

    // Scans per hour (0-23) for peak hour chart. L'ora va calcolata nel fuso del
    // ristorante (non quello del processo): su cloud UTC `getHours()` sfaserebbe il
    // grafico delle ore di punta.
    const scansPerHour: number[] = Array(24).fill(0)
    const hourFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz })
    for (const s of periodSessions) {
      const hour = Number(hourFmt.format(s.scannedAt)) % 24
      scansPerHour[hour]!++
    }

    return {
      data: {
        revenue,
        todayRevenue,
        avgTicket,
        totalCovers,
        billsCount: closedBills.length,
        pendingOrdersCount: pendingOrders.length,
        dailyRevenue: Object.entries(dailyRevenue).map(([date, amount]) => ({ date, amount })),
        topItems,
        sessions: {
          totalScans,
          conversionRate,
          avgTimeToFirstOrderSec,
          scansPerHour: scansPerHour.map((count, hour) => ({ hour, count })),
        },
      },
    }
  })

  // GET /stats/export?from=YYYY-MM-DD&to=YYYY-MM-DD → text/csv
  //
  // L'export che il ristoratore manda al commercialista dal telefono (Web Share API
  // lato client). Tre scelte che vale la pena scrivere:
  //
  //  • i numeri vengono da `periodTotals`, la STESSA funzione di /dashboard: il CSV
  //    non può divergere dalla schermata da cui è stato esportato;
  //  • tetto di 365 giorni, come `insights.ts`. Ma dove insights TRONCA in silenzio,
  //    qui si risponde 400: un export troncato senza dirlo è un export sbagliato, e
  //    chi lo apre non ha modo di accorgersene;
  //  • rate-limit per RISTORANTE, non per IP: dietro il tunnel ogni richiesta arriva
  //    da 127.0.0.1, e questa rotta scansiona fino a un anno di conti.
  fastify.get('/export', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: 60000, keyGenerator: (req: { user?: { restaurantId?: string }; ip: string }) => req.user?.restaurantId ?? req.ip } },
  }, async (req, reply) => {
    const restaurantId = req.user!.restaurantId
    const tz = await restaurantTimezone(restaurantId)
    const { from, to } = req.query as { from?: string; to?: string }
    const isDay = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
    if ((from && !isDay(from)) || (to && !isDay(to))) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'from/to devono essere date YYYY-MM-DD' } })
    }

    const toKey = to ?? dayKeyInTz(new Date(), tz)
    const fromKey = from ?? dayKeyInTz(new Date(Date.now() - 29 * 86400_000), tz)
    const startDate = dayStartInTz(fromKey, tz)
    const endDate = dayEndInTz(toKey, tz)
    if (startDate > endDate) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'L\'inizio del periodo viene dopo la fine.' } })
    }
    const days = Math.round((endDate.getTime() - startDate.getTime()) / 86400_000)
    if (days > 365) {
      return reply.code(400).send({ error: { code: 'RANGE_TOO_LONG', message: 'Il periodo non può superare 365 giorni.' } })
    }

    const t = await periodTotals(restaurantId, startDate, endDate)
    const [rest] = await db.select({ name: restaurants.name }).from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1)

    // Un bucket per ogni giorno del periodo, anche quelli chiusi: una riga mancante
    // in mezzo a un mese si legge come un errore dell'export, non come un lunedì.
    const perDay = new Map<string, { bills: number; covers: number; revenue: number; tips: number; discounts: number }>()
    for (let d = new Date(startDate); d <= endDate; d = new Date(d.getTime() + 86400_000)) {
      perDay.set(dayKeyInTz(d, tz), { bills: 0, covers: 0, revenue: 0, tips: 0, discounts: 0 })
    }
    for (const b of t.closedBills) {
      if (!b.closedAt) continue
      const row = perDay.get(dayKeyInTz(b.closedAt, tz))
      if (!row) continue
      row.bills++
      row.covers += b.covers ?? 1
      row.revenue += b.total
      row.tips += b.tip ?? 0
      row.discounts += b.discount ?? 0
    }

    const lines: string[] = []
    lines.push(csvRow(['Tako — export incassi']))
    lines.push(csvRow(['Ristorante', rest?.name ?? '']))
    lines.push(csvRow(['Dal', fromKey]))
    lines.push(csvRow(['Al', toKey]))
    lines.push(csvRow(['Fuso orario', tz]))
    lines.push(csvRow(['Generato il', new Date().toISOString()]))
    lines.push('')
    lines.push(csvRow(['Giorno', 'Conti', 'Coperti', 'Incasso', 'Mance', 'Sconti', 'Incasso netto mance', 'Ticket medio']))
    for (const [day, r] of perDay) {
      lines.push(csvRow([day, r.bills, r.covers, r.revenue, r.tips, r.discounts, r.revenue - r.tips, r.bills ? r.revenue / r.bills : 0]))
    }
    lines.push(csvRow(['Totale', t.billsCount, t.totalCovers, t.revenue, t.tips, t.discounts, round2(t.revenue - t.tips), t.avgTicket]))
    lines.push('')
    lines.push(csvRow(['Piatto', 'Quantità', 'Ricavo']))
    for (const i of t.topItems) lines.push(csvRow([i.name, i.qty, i.revenue]))

    // BOM UTF-8 (scritto come escape, non come carattere invisibile: un editor che
    // "ripulisce" il file lo toglierebbe senza che nessun test se ne accorga a occhio).
    // Senza, Excel su Windows apre "Brûlée" come "BrÃ»lÃ©e".
    const csv = '\uFEFF' + lines.join('\r\n') + '\r\n'
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="tako-incassi-${fromKey}_${toKey}.csv"`)
      .send(csv)
  })
}
