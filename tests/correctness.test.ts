import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { seedTestEnv, getTableCookie, jsonHeaders, SERVER, type TestEnv } from './helpers'

let env: TestEnv
let close: () => Promise<void>

beforeAll(async () => { const s = await seedTestEnv(); env = s.env; close = s.close })
afterAll(async () => { await close?.() })

const staff = () => jsonHeaders(`tako_session=${env.staffToken}`)

async function order(cookie: string, items: any[], idem?: string) {
  return fetch(`${SERVER}/api/customer/orders`, {
    method: 'POST', headers: jsonHeaders(cookie),
    body: JSON.stringify({ restaurantId: env.restaurantId, tableId: env.tableId, tableNumber: env.tableNumber, type: 'table', items, idempotencyKey: idem ?? `t-${randomUUID()}` }),
  })
}

describe('Soldi: varianti e prezzi', () => {
  it('il modificatore di prezzo della variante è incluso nel totale', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const res = await order(cookie, [{ menuItemId: env.menuItemId, variantId: env.variantId, quantity: 2 }])
    expect(res.status).toBe(201)
    const body = await res.json()
    // (prezzo base + modificatore) * 2
    expect(body.data.total).toBe((env.itemPrice + env.variantModifier) * 2)
    expect(body.data.items[0].unitPrice).toBe(env.itemPrice + env.variantModifier)
  })

  it('una variante inesistente o di un altro piatto → 409', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const res = await order(cookie, [{ menuItemId: env.menuItemId, variantId: randomUUID(), quantity: 1 }])
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('VARIANT_INVALID')
  })
})

describe('Integrità stati ordine', () => {
  it('transizione non valida (cancelled → preparing) → 409', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const o = (await (await order(cookie, [{ menuItemId: env.menuItemId, quantity: 1 }])).json()).data
    // pending → cancelled (consentita)
    const c = await fetch(`${SERVER}/api/orders/${o.id}/status`, { method: 'PATCH', headers: staff(), body: JSON.stringify({ status: 'cancelled' }) })
    expect(c.status).toBe(200)
    // cancelled → preparing (vietata)
    const bad = await fetch(`${SERVER}/api/orders/${o.id}/status`, { method: 'PATCH', headers: staff(), body: JSON.stringify({ status: 'preparing' }) })
    expect(bad.status).toBe(409)
    expect((await bad.json()).error.code).toBe('INVALID_TRANSITION')
  })

  it('un ordine pagato non può essere annullato → 409', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const o = (await (await order(cookie, [{ menuItemId: env.menuItemId, quantity: 1 }])).json()).data
    // Transizioni manuali consentite fino a 'served'.
    for (const s of ['preparing', 'served']) {
      const r = await fetch(`${SERVER}/api/orders/${o.id}/status`, { method: 'PATCH', headers: staff(), body: JSON.stringify({ status: s }) })
      expect(r.status).toBe(200)
    }
    // 'paid' NON è una transizione manuale (anti-frode): si raggiunge solo dal flusso
    // pagamenti. Chiudere il conto fa il cascade degli ordini fatturabili → paid.
    const bill = (await (await fetch(`${SERVER}/api/bills`, { method: 'POST', headers: staff(), body: JSON.stringify({ tableId: env.tableId }) })).json()).data
    const pay = await fetch(`${SERVER}/api/bills/${bill.id}/payments`, { method: 'POST', headers: staff(), body: JSON.stringify({ amount: bill.total, method: 'cash' }) })
    expect(pay.status).toBe(201)
    // Ora l'ordine è 'paid' (cascade alla chiusura): non annullabile.
    const cancel = await fetch(`${SERVER}/api/orders/${o.id}/cancel`, { method: 'PATCH', headers: staff(), body: '{}' })
    expect(cancel.status).toBe(409)
  })
})

describe('Conti: pagamenti e importi', () => {
  it('sconto negativo nella creazione conto → 400', async () => {
    const res = await fetch(`${SERVER}/api/bills`, { method: 'POST', headers: staff(), body: JSON.stringify({ tableId: env.tableId, discount: -5 }) })
    expect(res.status).toBe(400)
  })

  it('creare due conti per lo stesso tavolo ritorna lo stesso conto (no duplicati)', async () => {
    const cookie = await getTableCookie(env.qrToken)
    await order(cookie, [{ menuItemId: env.menuItemId, quantity: 1 }]) // auto-crea il conto aperto
    const a = await (await fetch(`${SERVER}/api/bills`, { method: 'POST', headers: staff(), body: JSON.stringify({ tableId: env.tableId }) })).json()
    const b = await (await fetch(`${SERVER}/api/bills`, { method: 'POST', headers: staff(), body: JSON.stringify({ tableId: env.tableId }) })).json()
    expect(a.data.id).toBe(b.data.id)
  })

  it('pagare un conto già chiuso → 409 (no doppio incasso)', async () => {
    const cookie = await getTableCookie(env.qrToken)
    await order(cookie, [{ menuItemId: env.menuItemId, quantity: 1 }])
    const bill = (await (await fetch(`${SERVER}/api/bills`, { method: 'POST', headers: staff(), body: JSON.stringify({ tableId: env.tableId }) })).json()).data
    const pay1 = await fetch(`${SERVER}/api/bills/${bill.id}/payments`, { method: 'POST', headers: staff(), body: JSON.stringify({ amount: bill.total, method: 'cash' }) })
    expect(pay1.status).toBe(201)
    const pay2 = await fetch(`${SERVER}/api/bills/${bill.id}/payments`, { method: 'POST', headers: staff(), body: JSON.stringify({ amount: 1, method: 'cash' }) })
    expect(pay2.status).toBe(409)
  })
})

describe('Sicurezza: IDOR tracking ordine', () => {
  it('GET /customer/orders/:id senza sessione tavolo → 401', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const o = (await (await order(cookie, [{ menuItemId: env.menuItemId, quantity: 1 }])).json()).data
    const res = await fetch(`${SERVER}/api/customer/orders/${o.id}`) // niente cookie
    expect(res.status).toBe(401)
  })

  it('con sessione tavolo legge il proprio ordine (200) ma non un id altrui (404)', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const o = (await (await order(cookie, [{ menuItemId: env.menuItemId, quantity: 1 }])).json()).data
    const mine = await fetch(`${SERVER}/api/customer/orders/${o.id}`, { headers: { Cookie: cookie } })
    expect(mine.status).toBe(200)
    const other = await fetch(`${SERVER}/api/customer/orders/${randomUUID()}`, { headers: { Cookie: cookie } })
    expect(other.status).toBe(404)
  })
})
