// F2.6 — I numeri di "Oggi".
//
// La schermata Oggi non calcola nulla: mostra ciò che rispondono
// GET /api/bills/summary/today e GET /api/stats/dashboard. Quindi il test verifica
// le due cose che possono davvero andare storte:
//
//   1. COERENZA AL CENTESIMO fra ciò che l'app mostra e i conti realmente chiusi,
//      inclusa la regola "la mancia NON è ricavo" (è pass-through allo staff).
//   2. IL CONFINE DI MEZZANOTTE è quello del RISTORANTE (settings.timezone), non
//      quello del server né quello del telefono. Un conto chiuso alle 23:30 di ieri
//      a Roma non deve comparire nell'incasso di oggi — e uno chiuso alle 00:30 sì.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'
import { seedTestEnv, SERVER, DB_URL, type TestEnv } from './helpers.js'

let env: TestEnv
let close: () => Promise<void>
let sql: ReturnType<typeof postgres>

const bearer = () => ({ Authorization: `Bearer ${env.staffToken}` })

interface Summary { revenue: number; tips: number; billsCount: number; avgTicket: number }

beforeAll(async () => {
  ;({ env, close } = await seedTestEnv())
  sql = postgres(DB_URL)
})
afterAll(async () => { await sql.end(); await close() })

async function summary(): Promise<Summary> {
  const res = await fetch(`${SERVER}/api/bills/summary/today`, { headers: bearer() })
  expect(res.status).toBe(200)
  return (await res.json()).data as Summary
}

/** Inserisce un conto CHIUSO con importi espliciti e un istante di chiusura preciso. */
async function closedBill(opts: { total: number; tip: number; closedAt: Date }) {
  const [row] = await sql`
    insert into bills (restaurant_id, table_id, table_number, covers, subtotal, discount, tip, total, status, closed_at)
    values (${env.restaurantId}, ${env.tableId}, ${env.tableNumber}, 2,
            ${opts.total - opts.tip}, 0, ${opts.tip}, ${opts.total}, 'closed', ${opts.closedAt})
    returning id`
  return row!['id'] as string
}

/** Mezzanotte di OGGI nel fuso indicato, come istante assoluto (stessa logica di lib/billing). */
function dayStartInTz(tz: string): Date {
  const now = new Date()
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const guess = new Date(`${key}T00:00:00Z`)
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(guess)) map[p.type] = p.value
  const asUtc = Date.UTC(+map['year']!, +map['month']! - 1, +map['day']!, +map['hour']!, +map['minute']!, +map['second']!)
  return new Date(guess.getTime() - (asUtc - guess.getTime()))
}

describe('incassi del giorno (F2.6)', () => {
  it('due conti chiusi con mancia: i numeri combaciano al centesimo, e la mancia NON è ricavo', async () => {
    const base = await summary()

    // 42,50 di cui 2,50 di mancia · 30,00 di cui 5,00 di mancia.
    await closedBill({ total: 42.5, tip: 2.5, closedAt: new Date() })
    await closedBill({ total: 30, tip: 5, closedAt: new Date() })

    const after = await summary()

    // Ricavo = total − mancia, sommato: (42,50−2,50) + (30,00−5,00) = 65,00
    expect(after.revenue - base.revenue).toBeCloseTo(65, 2)
    expect(after.tips - base.tips).toBeCloseTo(7.5, 2)
    expect(after.billsCount - base.billsCount).toBe(2)

    // Ticket medio = ricavo / numero conti, calcolato dal server sugli STESSI conti.
    expect(after.avgTicket).toBeCloseTo(Number((after.revenue / after.billsCount).toFixed(2)), 2)

    // Nessun arrotondamento perso per strada: il totale è esatto al centesimo.
    const rows = await sql`
      select coalesce(sum(total - coalesce(tip, 0)), 0)::float8 as revenue,
             coalesce(sum(tip), 0)::float8 as tips,
             count(*)::int as n
      from bills
      where restaurant_id = ${env.restaurantId} and status = 'closed'
        and closed_at >= ${dayStartInTz('Europe/Rome')}`
    expect(after.revenue).toBeCloseTo(rows[0]!['revenue'] as number, 2)
    expect(after.tips).toBeCloseTo(rows[0]!['tips'] as number, 2)
    expect(after.billsCount).toBe(rows[0]!['n'])
  })

  it('il confine di mezzanotte è quello del ristorante (Europe/Rome), non del server', async () => {
    // Fuso esplicito sul ristorante: è il valore che legge restaurantTimezone().
    await sql`update restaurants set settings = coalesce(settings, '{}'::jsonb) || '{"timezone":"Europe/Rome"}'::jsonb where id = ${env.restaurantId}`

    const midnight = dayStartInTz('Europe/Rome')
    const before = await summary()

    // Un minuto PRIMA della mezzanotte romana → è di ieri: non deve contare.
    await closedBill({ total: 99.99, tip: 0, closedAt: new Date(midnight.getTime() - 60_000) })
    const afterYesterday = await summary()
    expect(afterYesterday.revenue).toBeCloseTo(before.revenue, 2)
    expect(afterYesterday.billsCount).toBe(before.billsCount)

    // Un minuto DOPO la mezzanotte romana → è di oggi: deve contare.
    // (Se "adesso" a Roma è prima dell'01:00 questo istante è comunque nel passato
    //  rispetto a mezzanotte+1min solo di pochi minuti: resta dentro la giornata.)
    await closedBill({ total: 10, tip: 0, closedAt: new Date(midnight.getTime() + 60_000) })
    const afterToday = await summary()
    expect(afterToday.revenue - before.revenue).toBeCloseTo(10, 2)
    expect(afterToday.billsCount - before.billsCount).toBe(1)
  })

  it('summary/today e stats/dashboard concordano sul numero di conti di oggi', async () => {
    const s = await summary()
    const res = await fetch(`${SERVER}/api/stats/dashboard`, { headers: bearer() })
    const d = (await res.json()).data as { todayRevenue: number; pendingOrdersCount: number }

    // stats.todayRevenue include la mancia (è il TOTALE incassato), summary.revenue no:
    // la differenza deve essere ESATTAMENTE la somma delle mance di oggi. Se un giorno
    // le due viste divergessero per altro, questo test lo direbbe subito.
    expect(d.todayRevenue - s.revenue).toBeCloseTo(s.tips, 2)
    expect(typeof d.pendingOrdersCount).toBe('number')
  })
})
