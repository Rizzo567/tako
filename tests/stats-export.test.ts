// F4.4 — Export CSV degli incassi.
//
// Lo Stop del piano è una sola frase e non ammette sfumature: «i totali del CSV
// coincidono con quelli di GET /api/stats/dashboard sullo stesso intervallo, AL
// CENTESIMO». Un CSV che non torna con la schermata da cui è stato esportato è
// peggio di nessun CSV: il commercialista lo apre, i conti non tornano, e il
// ristoratore smette di fidarsi anche dei numeri giusti.
//
// Qui si semina uno storico vero (conti chiusi in giorni diversi, con mance, sconti
// e coperti), si chiedono le due viste sullo stesso intervallo e si confrontano.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'
import { seedTestEnv, jsonHeaders, SERVER, DB_URL, type TestEnv } from './helpers.js'

let env: TestEnv
let close: () => Promise<void>
let sql: ReturnType<typeof postgres>
let phone: string

/** Giorni indietro rispetto a oggi in cui semineremo i conti chiusi. */
const DAYS_AGO = [0, 1, 3, 5]

beforeAll(async () => {
  const s = await seedTestEnv()
  env = s.env
  close = s.close
  sql = postgres(DB_URL)

  const codeRes = await fetch(`${SERVER}/api/auth/device/enroll-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.staffToken}` },
    body: '{}',
  })
  const { code } = (await codeRes.json()).data as { code: string }
  const res = await fetch(`${SERVER}/api/auth/device/enroll`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ code, deviceName: 'Telefono stats', platform: 'iOS' }),
  })
  phone = ((await res.json()).data as { token: string }).token

  // Conti chiusi a mezzogiorno (locale) dei giorni scelti: mezzogiorno e non
  // mezzanotte perché il confine di giornata lo decide il fuso del ristorante, e un
  // conto chiuso alle 00:30 finirebbe nel bucket del giorno prima o dopo a seconda
  // del fuso del processo — un test che passa o fallisce secondo l'ora legale.
  let i = 0
  for (const ago of DAYS_AGO) {
    i++
    const subtotal = 100 * i
    const discount = 5 * i
    const tip = 3 * i
    const total = subtotal - discount + tip
    await sql`
      insert into bills (restaurant_id, table_id, subtotal, discount, tip, total, covers, status, closed_at)
      values (${env.restaurantId}, ${env.tableId}, ${subtotal}, ${discount}, ${tip}, ${total}, ${2 * i}, 'closed',
              (now() - (${ago} || ' days')::interval)::date + interval '12 hours')`
  }
  // Un conto ANCORA APERTO: non deve entrare in nessuno dei due conteggi.
  await sql`
    insert into bills (restaurant_id, table_id, subtotal, discount, tip, total, covers, status)
    values (${env.restaurantId}, ${env.tableId}, 999, 0, 0, 999, 4, 'open')`
})

afterAll(async () => {
  await sql.end()
  await close?.()
})

const bearer = () => ({ Authorization: `Bearer ${phone}` })

function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const TO = dayKey(new Date())
const FROM = dayKey(new Date(Date.now() - 6 * 86400_000))

/** Numero italiano ("1.234,56" non esiste qui: solo la virgola decimale) → number. */
const num = (s: string) => Number(s.replace(',', '.'))

interface Csv {
  raw: string
  rows: string[][]
  /** Prima riga la cui prima cella è `label`. */
  row: (label: string) => string[] | undefined
}

async function fetchCsv(query: string): Promise<{ status: number; headers: Headers; csv: Csv }> {
  const res = await fetch(`${SERVER}/api/stats/export${query}`, { headers: bearer() })
  const text = await res.text()
  // Nessuna rimozione del BOM: `res.text()` lo ha già mangiato (lo impone la
  // specifica fetch). Che ci sia sul filo si verifica a parte, sui byte.
  const raw = text
  const rows = raw.split('\r\n').map((l) => {
    // Split su ';' rispettando le celle quotate (i nomi dei piatti sono testo libero).
    const out: string[] = []
    let cur = ''
    let quoted = false
    for (let i = 0; i < l.length; i++) {
      const c = l[i]!
      if (quoted) {
        if (c === '"' && l[i + 1] === '"') { cur += '"'; i++ }
        else if (c === '"') quoted = false
        else cur += c
      } else if (c === '"') quoted = true
      else if (c === ';') { out.push(cur); cur = '' }
      else cur += c
    }
    out.push(cur)
    return out
  })
  return {
    status: res.status,
    headers: res.headers,
    csv: { raw, rows, row: (label) => rows.find((r) => r[0] === label) },
  }
}

async function dashboard(from: string, to: string) {
  const res = await fetch(`${SERVER}/api/stats/dashboard?from=${from}&to=${to}`, { headers: bearer() })
  expect(res.status).toBe(200)
  return (await res.json()).data as {
    revenue: number; avgTicket: number; totalCovers: number; billsCount: number
    topItems: { name: string; qty: number; revenue: number }[]
  }
}

describe('F4.4 — i totali del CSV coincidono con /stats/dashboard', () => {
  it('incasso, conti, coperti e ticket medio: identici al centesimo', async () => {
    const d = await dashboard(FROM, TO)
    const { status, csv } = await fetchCsv(`?from=${FROM}&to=${TO}`)
    expect(status).toBe(200)

    const totale = csv.row('Totale')!
    // Colonne: Giorno;Conti;Coperti;Incasso;Mance;Sconti;Incasso netto mance;Ticket medio
    expect(num(totale[1]!)).toBe(d.billsCount)
    expect(num(totale[2]!)).toBe(d.totalCovers)
    expect(num(totale[3]!)).toBeCloseTo(d.revenue, 2)
    expect(num(totale[7]!)).toBeCloseTo(d.avgTicket, 2)

    // …e non sono zero per caso: lo storico seminato c'è davvero.
    expect(d.billsCount).toBe(DAYS_AGO.length)
    expect(d.revenue).toBeGreaterThan(0)
  })

  it('la somma dei giorni fa il totale (nessun conto perso o contato due volte)', async () => {
    const { csv } = await fetchCsv(`?from=${FROM}&to=${TO}`)
    const header = csv.rows.findIndex((r) => r[0] === 'Giorno')
    const totalIdx = csv.rows.findIndex((r) => r[0] === 'Totale')
    const dayRows = csv.rows.slice(header + 1, totalIdx)

    // Una riga per OGNI giorno del periodo, anche quelli chiusi: un buco in mezzo a
    // un mese si legge come un errore dell'export, non come un lunedì di riposo.
    expect(dayRows).toHaveLength(7)
    expect(dayRows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r[0]!))).toBe(true)

    const sum = (col: number) => dayRows.reduce((s, r) => s + num(r[col]!), 0)
    const totale = csv.row('Totale')!
    expect(sum(1)).toBe(num(totale[1]!))              // conti
    expect(sum(2)).toBe(num(totale[2]!))              // coperti
    expect(sum(3)).toBeCloseTo(num(totale[3]!), 2)    // incasso
    expect(sum(4)).toBeCloseTo(num(totale[4]!), 2)    // mance
    expect(sum(5)).toBeCloseTo(num(totale[5]!), 2)    // sconti
  })

  it('l\'incasso netto mance è l\'incasso meno le mance, e le mance non sono zero', async () => {
    const { csv } = await fetchCsv(`?from=${FROM}&to=${TO}`)
    const t = csv.row('Totale')!
    expect(num(t[4]!)).toBeGreaterThan(0)
    expect(num(t[6]!)).toBeCloseTo(num(t[3]!) - num(t[4]!), 2)
  })

  it('i conti APERTI non entrano nell\'export', async () => {
    const { csv } = await fetchCsv(`?from=${FROM}&to=${TO}`)
    // Il conto aperto vale 999: se fosse contato, l'incasso lo direbbe.
    expect(num(csv.row('Totale')![3]!)).toBeLessThan(999)
  })

  it('un periodo di un giorno solo torna con /dashboard su quel giorno', async () => {
    const today = dayKey(new Date())
    const d = await dashboard(today, today)
    const { csv } = await fetchCsv(`?from=${today}&to=${today}`)
    const t = csv.row('Totale')!
    expect(num(t[3]!)).toBeCloseTo(d.revenue, 2)
    expect(num(t[1]!)).toBe(d.billsCount)
    // E il giorno unico è anche l'unica riga giorno.
    const header = csv.rows.findIndex((r) => r[0] === 'Giorno')
    const totalIdx = csv.rows.findIndex((r) => r[0] === 'Totale')
    expect(totalIdx - header - 1).toBe(1)
  })

  it('intestazione, tipo e nome del file sono quelli che si aprono in Excel', async () => {
    const { headers, csv } = await fetchCsv(`?from=${FROM}&to=${TO}`)
    expect(headers.get('content-type')).toContain('text/csv')
    expect(headers.get('content-disposition')).toContain(`tako-incassi-${FROM}_${TO}.csv`)
    // BOM UTF-8 in testa: senza, Excel su Windows storpia gli accenti. Si controlla
    // sui BYTE e non su `res.text()`: la specifica fetch impone al decoder di
    // MANGIARSI il BOM, quindi dal testo decodificato non si vede mai — e un test
    // scritto su `text()` direbbe "manca" anche quando c'è.
    const res = await fetch(`${SERVER}/api/stats/export?from=${FROM}&to=${TO}`, { headers: bearer() })
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xEF, 0xBB, 0xBF])
    expect(csv.rows[0]![0]).toBe('Tako — export incassi')
    expect(csv.row('Dal')![1]).toBe(FROM)
    expect(csv.row('Al')![1]).toBe(TO)
  })

  it('il tetto di 365 giorni è un rifiuto esplicito, non un troncamento silenzioso', async () => {
    const to = dayKey(new Date())
    const from = dayKey(new Date(Date.now() - 400 * 86400_000))
    const res = await fetch(`${SERVER}/api/stats/export?from=${from}&to=${to}`, { headers: bearer() })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('RANGE_TOO_LONG')

    // Esattamente 365 giorni invece passa.
    const ok = await fetch(`${SERVER}/api/stats/export?from=${dayKey(new Date(Date.now() - 364 * 86400_000))}&to=${to}`, { headers: bearer() })
    expect(ok.status).toBe(200)
  })

  it('date malformate e periodo rovesciato sono 400', async () => {
    expect((await fetch(`${SERVER}/api/stats/export?from=ieri&to=oggi`, { headers: bearer() })).status).toBe(400)
    expect((await fetch(`${SERVER}/api/stats/export?from=${TO}&to=${FROM}`, { headers: bearer() })).status).toBe(400)
  })

  it('senza autenticazione non si esporta niente', async () => {
    expect((await fetch(`${SERVER}/api/stats/export`)).status).toBe(401)
  })

  it('l\'export vede solo il PROPRIO ristorante', async () => {
    const other = await seedTestEnv()
    try {
      const res = await fetch(`${SERVER}/api/stats/export?from=${FROM}&to=${TO}`, {
        headers: { Authorization: `Bearer ${other.env.staffToken}` },
      })
      const text = await res.text()
      const totale = text.split('\r\n').find((l) => l.startsWith('Totale'))!.split(';')
      expect(num(totale[3]!)).toBe(0)   // nessun incasso: è un ristorante appena nato
      expect(num(totale[1]!)).toBe(0)
    } finally {
      await other.close()
    }
  })
})
