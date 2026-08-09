// Regressioni per i fix della review-carico 2026-07-15 (docs/review-carico-2026-07-15.md):
//  P1 #2 — il bump portata non deve toccare un ordine paid/cancelled (409)
//  P1 #3 — probe GET /customer/orders/by-key/:key per gli invii dall'esito incerto
//  P1 #1 (transazione) è coperto indirettamente: il flusso ordine resta identico.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { seedTestEnv, getTableCookie, jsonHeaders, SERVER, DB_URL, type TestEnv } from './helpers'

let env: TestEnv
let close: () => Promise<void>
const staff = () => jsonHeaders(`tako_session=${env.staffToken}`)

beforeAll(async () => {
  ;({ env, close } = await seedTestEnv())
})
afterAll(async () => close())

async function placeCustomerOrder(cookie: string, key: string) {
  const res = await fetch(`${SERVER}/api/customer/orders`, {
    method: 'POST',
    headers: jsonHeaders(cookie),
    body: JSON.stringify({
      restaurantId: env.restaurantId,
      items: [{ menuItemId: env.menuItemId, quantity: 2 }],
      idempotencyKey: key,
    }),
  })
  expect(res.status).toBe(201)
  return (await res.json()).data
}

describe('bump portata su ordine pagato (P1 resurrezione)', () => {
  it('PATCH items/status su ordine paid risponde 409 e non tocca lo stato', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const order = await placeCustomerOrder(cookie, randomUUID())

    // L'ordine diventa 'paid' come farebbe la cascade di chiusura conto
    // (la PATCH /status vieta il paid manuale di proposito → set diretto in DB).
    const sql = postgres(DB_URL)
    await sql`update orders set status = 'paid' where id = ${order.id}`
    await sql.end()

    // Il tap in cucina arriva DOPO: non deve resuscitare l'ordine
    const bump = await fetch(`${SERVER}/api/orders/${order.id}/items/${order.items[0].id}/status`, {
      method: 'PATCH',
      headers: staff(),
      body: JSON.stringify({ status: 'served' }),
    })
    expect(bump.status).toBe(409)

    const check = await fetch(`${SERVER}/api/customer/orders/${order.id}`, { headers: jsonHeaders(cookie) })
    expect((await check.json()).data.status).toBe('paid')
  })
})

describe('probe by-key per invii incerti (P1 doppio addebito)', () => {
  it('chiave atterrata → 200 con lo stesso ordine; chiave mai vista → 404', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const key = randomUUID()
    const order = await placeCustomerOrder(cookie, key)

    const hit = await fetch(`${SERVER}/api/customer/orders/by-key/${key}`, { headers: jsonHeaders(cookie) })
    expect(hit.status).toBe(200)
    const found = (await hit.json()).data
    expect(found.id).toBe(order.id)
    expect(found.items).toHaveLength(1)

    const miss = await fetch(`${SERVER}/api/customer/orders/by-key/${randomUUID()}`, { headers: jsonHeaders(cookie) })
    expect(miss.status).toBe(404)
  })

  it('la chiave di un ALTRO tavolo non è leggibile (anti-IDOR)', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const key = randomUUID()
    await placeCustomerOrder(cookie, key)

    // Sessione takeaway = scope diverso: la chiave del tavolo non deve risolvere
    const other = await fetch(`${SERVER}/api/customer/orders/by-key/${key}`, { headers: jsonHeaders() })
    expect([401, 404]).toContain(other.status)
  })
})

describe('stats dashboard: finestra default include gli ordini appena creati (fix timestamptz)', () => {
  it('un ordine paid di adesso compare nei topItems senza from/to', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const order = await placeCustomerOrder(cookie, randomUUID())
    const sql = postgres(DB_URL)
    await sql`update orders set status = 'paid' where id = ${order.id}`
    await sql.end()

    // SENZA from/to: prima del fix la colonna naive + bind UTC di Drizzle
    // spostavano la finestra di -2h e l'ordine appena creato spariva.
    const res = await fetch(`${SERVER}/api/stats/dashboard`, { headers: staff() })
    const d = (await res.json()).data
    const mine = d.topItems.find((t: any) => t.name === 'Piatto Test')
    expect(mine, 'topItems deve includere ordini delle ultime 2 ore').toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// F2.4 — Cassa dal telefono (P0: tocca i soldi).
//
// L'app owner incassa con le STESSE route della dashboard. Il rischio non è la UI,
// è la concorrenza: due dita, due dispositivi, la stessa rete lenta. Qui si verifica
// che l'esito sia identico a quello di un incasso fatto dalla cassa fissa.
describe('cassa mobile: incasso concorrente (P0 doppio addebito)', () => {
  // Apre un conto con un ordine reale sopra, così il totale non è zero.
  async function openBillWithOrder() {
    const cookie = await getTableCookie(env.qrToken)
    await placeCustomerOrder(cookie, randomUUID())
    // L'ordine cliente apre già il conto del tavolo (ensureOpenBill). Lo si rilegge.
    const res = await fetch(`${SERVER}/api/bills/open`, { headers: staff() })
    const bills = (await res.json()).data as { id: string; tableId: string | null; total: number }[]
    const bill = bills.find((b) => b.tableId === env.tableId)
    expect(bill, 'il conto del tavolo deve esistere').toBeTruthy()
    return bill!
  }

  it('due POST /payments simultanei: uno chiude, l\'altro 409 BILL_NOT_OPEN', async () => {
    const bill = await openBillWithOrder()

    // Il totale viene dal SERVER, mai calcolato dal client: è la regola di F2.4.
    const detail = await (await fetch(`${SERVER}/api/bills/${bill.id}`, { headers: staff() })).json()
    const amount = detail.data.total as number
    expect(amount).toBeGreaterThan(0)

    const pay = () => fetch(`${SERVER}/api/bills/${bill.id}/payments`, {
      method: 'POST',
      headers: staff(),
      body: JSON.stringify({ amount, method: 'cash' }),
    })
    const [a, b] = await Promise.all([pay(), pay()])
    const codes = [a.status, b.status].sort()
    expect(codes).toEqual([201, 409])

    const loser = a.status === 409 ? a : b
    expect((await loser.json()).error.code).toBe('BILL_NOT_OPEN')

    // Un solo pagamento registrato: nessun doppio addebito.
    const after = await (await fetch(`${SERVER}/api/bills/${bill.id}`, { headers: staff() })).json()
    expect(after.data.status).toBe('closed')
    expect(after.data.payments.length).toBe(1)
  })

  it('20 esecuzioni consecutive: mai due pagamenti sullo stesso conto', async () => {
    for (let i = 0; i < 20; i++) {
      const bill = await openBillWithOrder()
      const detail = await (await fetch(`${SERVER}/api/bills/${bill.id}`, { headers: staff() })).json()
      const amount = detail.data.total as number

      const pay = () => fetch(`${SERVER}/api/bills/${bill.id}/payments`, {
        method: 'POST',
        headers: staff(),
        body: JSON.stringify({ amount, method: i % 2 ? 'card' : 'cash' }),
      })
      const results = await Promise.all([pay(), pay(), pay()])
      const ok = results.filter((r) => r.status === 201)
      expect(ok.length, `giro ${i + 1}: esattamente un pagamento accettato`).toBe(1)

      const after = await (await fetch(`${SERVER}/api/bills/${bill.id}`, { headers: staff() })).json()
      expect(after.data.payments.length, `giro ${i + 1}: un solo pagamento sul conto`).toBe(1)
      expect(after.data.status).toBe('closed')

      // Il tavolo torna libero per il giro successivo (la chiusura lo mette in 'cleaning').
      await fetch(`${SERVER}/api/tables/${env.tableId}/status`, {
        method: 'PATCH', headers: staff(), body: JSON.stringify({ status: 'free' }),
      })
    }
  }, 120_000)

  it('liberare un tavolo con conto aperto → 409 TABLE_HAS_OPEN_BILL', async () => {
    const bill = await openBillWithOrder()

    const res = await fetch(`${SERVER}/api/tables/${env.tableId}/status`, {
      method: 'PATCH', headers: staff(), body: JSON.stringify({ status: 'free' }),
    })
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('TABLE_HAS_OPEN_BILL')

    // Incassato il conto, il tavolo si libera senza discussioni.
    const detail = await (await fetch(`${SERVER}/api/bills/${bill.id}`, { headers: staff() })).json()
    await fetch(`${SERVER}/api/bills/${bill.id}/payments`, {
      method: 'POST', headers: staff(), body: JSON.stringify({ amount: detail.data.total, method: 'cash' }),
    })
    const free = await fetch(`${SERVER}/api/tables/${env.tableId}/status`, {
      method: 'PATCH', headers: staff(), body: JSON.stringify({ status: 'free' }),
    })
    expect(free.status).toBe(200)
  })

  it('lo sconto è applicato dal SERVER e il totale ricalcolato sotto lock', async () => {
    const bill = await openBillWithOrder()
    const before = await (await fetch(`${SERVER}/api/bills/${bill.id}`, { headers: staff() })).json()

    const patched = await fetch(`${SERVER}/api/bills/${bill.id}`, {
      method: 'PATCH', headers: staff(), body: JSON.stringify({ discount: 3, tip: 2 }),
    })
    expect(patched.status).toBe(200)
    const after = (await patched.json()).data

    // Il client non calcola nulla: si limita a mostrare questi numeri.
    expect(after.discount).toBe(3)
    expect(after.tip).toBe(2)
    expect(after.total).toBeCloseTo(after.subtotal - 3 + 2, 2)
    expect(after.total).not.toBe(before.data.total)

    // Pulizia: chiudi il conto e libera il tavolo.
    await fetch(`${SERVER}/api/bills/${bill.id}/payments`, {
      method: 'POST', headers: staff(), body: JSON.stringify({ amount: after.total, method: 'cash' }),
    })
    await fetch(`${SERVER}/api/tables/${env.tableId}/status`, {
      method: 'PATCH', headers: staff(), body: JSON.stringify({ status: 'free' }),
    })
  })
})
