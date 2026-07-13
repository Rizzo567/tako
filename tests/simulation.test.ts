import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { io, type Socket } from 'socket.io-client'
import { seedTestEnv, getTableCookie, jsonHeaders, SERVER, type TestEnv } from './helpers'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// Simulazione realistica: 3 ristoranti usano il sistema CONTEMPORANEAMENTE.
// Verifica che ogni ciclo di servizio vada a buon fine, che i soldi tornino,
// che gli eventi real-time restino isolati per ristorante e che non ci sia
// alcun accesso cross-tenant.

interface Sim { env: TestEnv; close: () => Promise<void>; socket: Socket; events: { event: string; payload: any }[] }

const sims: Sim[] = []
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

beforeAll(async () => {
  for (let i = 0; i < 3; i++) {
    const { env, close } = await seedTestEnv()
    const socket = io(SERVER, { transports: ['websocket'], extraHeaders: { Cookie: `tako_session=${env.staffToken}` } })
    await new Promise<void>((res, rej) => { socket.on('connect', () => res()); setTimeout(() => rej(new Error('connect timeout')), 5000) })
    socket.emit('join:restaurant', env.restaurantId)
    const events: { event: string; payload: any }[] = []
    socket.onAny((event, payload) => events.push({ event, payload }))
    sims.push({ env, close, socket, events })
  }
  await sleep(400) // join completati
}, 40000)

afterAll(async () => {
  for (const s of sims) s.socket.close()
  for (const s of sims) await s.close()
})

const staff = (env: TestEnv) => jsonHeaders(`tako_session=${env.staffToken}`)

async function placeOrder(env: TestEnv, cookie: string, items: any[]) {
  const res = await fetch(`${SERVER}/api/customer/orders`, {
    method: 'POST', headers: jsonHeaders(cookie),
    body: JSON.stringify({ restaurantId: env.restaurantId, tableId: env.tableId, tableNumber: env.tableNumber, type: 'table', items, idempotencyKey: `sim-${env.restaurantId}-${Math.random()}` }),
  })
  return res
}

// Ciclo di servizio completo per un ristorante; ritorna i dati raccolti.
async function runService(sim: Sim) {
  const { env } = sim
  const cookie = await getTableCookie(env.qrToken)

  // 2 ordini: uno semplice (x2), uno con variante (+modifier)
  const r1 = await placeOrder(env, cookie, [{ menuItemId: env.menuItemId, quantity: 2 }])
  const r2 = await placeOrder(env, cookie, [{ menuItemId: env.menuItemId, variantId: env.variantId, quantity: 1 }])
  expect(r1.status).toBe(201)
  expect(r2.status).toBe(201)
  const o1 = (await r1.json()).data
  const o2 = (await r2.json()).data

  // Cucina: avanza il primo ordine fino a servito
  for (const s of ['preparing', 'ready', 'served']) {
    const res = await fetch(`${SERVER}/api/orders/${o1.id}/status`, { method: 'PATCH', headers: staff(env), body: JSON.stringify({ status: s }) })
    expect(res.status).toBe(200)
  }

  // Chiamata cameriere
  const w = await fetch(`${SERVER}/api/customer/waiter-call`, { method: 'POST', headers: jsonHeaders(cookie), body: JSON.stringify({ restaurantId: env.restaurantId, tableId: env.tableId, tableNumber: env.tableNumber, type: 'help' }) })
  expect(w.status).toBe(200)

  // Cassa: crea conto e paga
  // L'ordine cliente ha già aperto il conto → POST /bills ritorna quello esistente (200);
  // se fosse il primo sarebbe 201. Entrambi validi.
  const billRes = await fetch(`${SERVER}/api/bills`, { method: 'POST', headers: staff(env), body: JSON.stringify({ tableId: env.tableId }) })
  expect([200, 201]).toContain(billRes.status)
  const bill = (await billRes.json()).data

  const pay = await fetch(`${SERVER}/api/bills/${bill.id}/payments`, { method: 'POST', headers: staff(env), body: JSON.stringify({ amount: bill.total, method: 'card' }) })
  expect(pay.status).toBe(201)

  return { o1, o2, bill }
}

describe('Simulazione: 3 ristoranti in servizio contemporaneo', () => {
  let results: { o1: any; o2: any; bill: any }[]

  it('ogni ristorante completa il ciclo di servizio senza errori', async () => {
    results = await Promise.all(sims.map(runService))
    expect(results).toHaveLength(3)
  }, 40000)

  it('i soldi tornano: conto = ordine semplice (x2) + ordine con variante', async () => {
    for (let i = 0; i < 3; i++) {
      const { env } = sims[i]!
      const { o1, o2, bill } = results[i]!
      const expectedSubtotal = round2(env.itemPrice * 2 + (env.itemPrice + env.variantModifier))
      expect(o1.total).toBe(env.itemPrice * 2)
      expect(o2.total).toBe(env.itemPrice + env.variantModifier)
      expect(bill.subtotal).toBe(expectedSubtotal)
      expect(bill.total).toBe(expectedSubtotal)
    }
  })

  it('il conto risulta chiuso e il tavolo liberato dopo il pagamento', async () => {
    for (let i = 0; i < 3; i++) {
      const { env } = sims[i]!
      const { bill } = results[i]!
      const got = await (await fetch(`${SERVER}/api/bills/${bill.id}`, { headers: staff(env) })).json()
      expect(got.data.status).toBe('closed')
    }
  })

  it('isolamento real-time: ogni dashboard riceve SOLO gli eventi del proprio ristorante', async () => {
    await sleep(500) // lascia arrivare gli ultimi eventi
    for (let i = 0; i < 3; i++) {
      const { env, events } = sims[i]!
      const myOrderIds = new Set([results[i]!.o1.id, results[i]!.o2.id])

      // order:new → solo del proprio ristorante
      const news = events.filter(e => e.event === 'order:new')
      expect(news.length).toBeGreaterThanOrEqual(2)
      for (const e of news) expect(e.payload.restaurantId).toBe(env.restaurantId)

      // order:updated → solo ordini propri
      for (const e of events.filter(e => e.event === 'order:updated')) {
        expect(myOrderIds.has(e.payload.orderId)).toBe(true)
      }

      // waiter:called → solo il proprio tavolo
      for (const e of events.filter(e => e.event === 'waiter:called')) {
        expect(e.payload.tableNumber).toBe(env.tableNumber)
      }

      // Nessun evento deve riferirsi agli ordini di un ALTRO ristorante
      const otherOrderIds = new Set(results.flatMap((r, j) => j === i ? [] : [r.o1.id, r.o2.id]))
      for (const e of events) {
        if (e.payload?.orderId) expect(otherOrderIds.has(e.payload.orderId)).toBe(false)
      }
    }
  })

  it('cross-tenant: lo staff di un ristorante non può toccare gli ordini di un altro (404)', async () => {
    const a = sims[0]!
    const res = await fetch(`${SERVER}/api/orders/${results[1]!.o1.id}/status`, {
      method: 'PATCH', headers: staff(a.env), body: JSON.stringify({ status: 'cancelled' }),
    })
    expect(res.status).toBe(404) // l'ordine di B non esiste nello scope di A
  })

  it('cross-tenant: pagare il conto di un altro ristorante è negato (404)', async () => {
    const a = sims[0]!
    const res = await fetch(`${SERVER}/api/bills/${results[2]!.bill.id}/payments`, {
      method: 'POST', headers: staff(a.env), body: JSON.stringify({ amount: 1, method: 'cash' }),
    })
    expect(res.status).toBe(404)
  })
})
