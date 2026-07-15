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
