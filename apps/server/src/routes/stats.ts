import type { FastifyInstance } from 'fastify'
import { db, restaurants } from '@tako/db'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { periodTotals, readDashboardStats } from '../lib/read-queries.js'
import { round2, restaurantTimezone, dayKeyInTz, dayStartInTz, dayEndInTz } from '../lib/billing.js'

// periodTotals (la stessa funzione per /dashboard e /export) e la lettura di
// /dashboard vivono in lib/read-queries.ts, condivise con la read-edge.

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
  fastify.get('/dashboard', { preHandler: requireAuth }, async (req, reply) => {
    const r = await readDashboardStats(req.user!.restaurantId, req.query)
    return reply.code(r.status).send(r.body)
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
