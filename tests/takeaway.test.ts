import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { seedTestEnv, jsonHeaders, SERVER, DB_URL, type TestEnv } from './helpers'

let env: TestEnv
let close: () => Promise<void>

beforeAll(async () => {
  const s = await seedTestEnv()
  env = s.env
  close = s.close
  // Abilita l'asporto per questo ristorante (default off).
  const sql = postgres(DB_URL, { max: 1 })
  await sql`update restaurants set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{takeawayEnabled}', 'true') where id = ${env.restaurantId}`
  await sql.end()
})
afterAll(async () => { await close?.() })

const staff = () => jsonHeaders(`tako_session=${env.staffToken}`)

async function takeawayCookie(): Promise<string> {
  const res = await fetch(`${SERVER}/api/customer/takeaway/${env.restaurantId}/session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  })
  const sc = res.headers.get('set-cookie') ?? ''
  const cookie = sc.split(';')[0]
  if (!cookie.startsWith('tako_table=')) throw new Error('no takeaway cookie (status ' + res.status + ')')
  return cookie
}

async function orderTakeaway(cookie: string) {
  return fetch(`${SERVER}/api/customer/orders`, {
    method: 'POST', headers: jsonHeaders(cookie),
    body: JSON.stringify({
      restaurantId: env.restaurantId, type: 'takeaway',
      items: [{ menuItemId: env.menuItemId, quantity: 1 }],
      idempotencyKey: `tk-${randomUUID()}`, customerName: 'Mario',
    }),
  })
}

describe('Asporto: conto + incasso al banco', () => {
  it('ordine asporto genera un conto; pagarlo porta l\'ordine a paid', async () => {
    const cookie = await takeawayCookie()
    const o = (await (await orderTakeaway(cookie)).json()).data
    expect(o.type).toBe('takeaway')
    expect(o.billId).toBeTruthy()

    // Il conto asporto compare tra gli aperti, etichettato takeaway.
    const open = (await (await fetch(`${SERVER}/api/bills/open`, { headers: staff() })).json()).data
    const bill = open.find((b: any) => b.id === o.billId)
    expect(bill).toBeTruthy()
    expect(bill.takeaway).toBe(true)

    // Pagamento al banco → 201, poi l'ordine è paid.
    const pay = await fetch(`${SERVER}/api/bills/${o.billId}/payments`, {
      method: 'POST', headers: staff(), body: JSON.stringify({ amount: bill.total, method: 'cash' }),
    })
    expect(pay.status).toBe(201)

    const got = (await (await fetch(`${SERVER}/api/customer/orders/${o.id}`, { headers: { Cookie: cookie } })).json()).data
    expect(got.status).toBe('paid')
  })

  it('IDOR: una sessione asporto non legge gli ordini di un\'altra → 404', async () => {
    const cookieA = await takeawayCookie()
    const oA = (await (await orderTakeaway(cookieA)).json()).data
    const cookieB = await takeawayCookie()
    const res = await fetch(`${SERVER}/api/customer/orders/${oA.id}`, { headers: { Cookie: cookieB } })
    expect(res.status).toBe(404)
  })
})
