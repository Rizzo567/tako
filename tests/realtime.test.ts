import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { io, type Socket } from 'socket.io-client'
import { randomUUID } from 'node:crypto'
import { seedTestEnv, getTableCookie, jsonHeaders, waitForEvent, SERVER, type TestEnv } from './helpers'

let env: TestEnv
let close: () => Promise<void>

beforeAll(async () => {
  const s = await seedTestEnv()
  env = s.env
  close = s.close
})
afterAll(async () => { await close?.() })

// Connette un socket "dashboard" autenticato col cookie staff nell'handshake e
// lo fa entrare nella room del ristorante.
async function dashboardSocket(): Promise<Socket> {
  const socket = io(SERVER, {
    transports: ['websocket'],
    extraHeaders: { Cookie: `tako_session=${env.staffToken}` },
  })
  await new Promise<void>((res, rej) => {
    socket.on('connect', () => res())
    socket.on('connect_error', rej)
    setTimeout(() => rej(new Error('socket connect timeout')), 5000)
  })
  socket.emit('join:restaurant', env.restaurantId)
  await new Promise(r => setTimeout(r, 400)) // lascia completare il join
  return socket
}

// Connette un socket "cliente" col cookie JWT tavolo (tako_table) nell'handshake e
// lo fa entrare nella room del proprio tavolo. `join:table` è vincolato al JWT
// (scoped a tableId/restaurantId): senza cookie il join viene ignorato, quindi il
// cookie va passato negli extraHeaders come per il socket dashboard.
async function customerTableSocket(cookie: string): Promise<Socket> {
  const socket = io(SERVER, {
    transports: ['websocket'],
    extraHeaders: { Cookie: cookie },
  })
  await new Promise<void>((res, rej) => {
    socket.on('connect', () => res())
    socket.on('connect_error', rej)
    setTimeout(() => rej(new Error('customer connect timeout')), 5000)
  })
  socket.emit('join:table', env.tableId)
  await new Promise(r => setTimeout(r, 400)) // lascia completare il join
  return socket
}

async function placeOrder(cookie: string, opts: Partial<{ quantity: number; idem: string }> = {}) {
  return fetch(`${SERVER}/api/customer/orders`, {
    method: 'POST',
    headers: jsonHeaders(cookie),
    body: JSON.stringify({
      restaurantId: env.restaurantId,
      tableId: env.tableId,
      tableNumber: env.tableNumber,
      type: 'table',
      items: [{ menuItemId: env.menuItemId, quantity: opts.quantity ?? 1 }],
      idempotencyKey: opts.idem ?? `test-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    }),
  })
}

describe('Real-time cliente → dashboard', () => {
  it('un ordine cliente arriva live nella room ristorante (order:new)', async () => {
    const socket = await dashboardSocket()
    try {
      const evP = waitForEvent(socket, 'order:new')
      const cookie = await getTableCookie(env.qrToken)
      const res = await placeOrder(cookie)
      expect(res.status).toBe(201)
      const payload = await evP
      expect(payload.restaurantId).toBe(env.restaurantId)
      expect(payload.items?.[0]?.menuItemId).toBe(env.menuItemId)
    } finally { socket.close() }
  })

  it('due ordini simultanei arrivano entrambi alla dashboard (order:new x2)', async () => {
    const socket = await dashboardSocket()
    const received: any[] = []
    socket.on('order:new', (p) => received.push(p))
    try {
      const cookie = await getTableCookie(env.qrToken)
      await Promise.all([
        placeOrder(cookie, { idem: `c1-${Date.now()}` }),
        placeOrder(cookie, { idem: `c2-${Date.now()}` }),
      ])
      // attende che arrivino entrambi
      await new Promise<void>((res, rej) => {
        const t = setInterval(() => { if (received.length >= 2) { clearInterval(t); res() } }, 100)
        setTimeout(() => { clearInterval(t); rej(new Error(`ricevuti ${received.length}/2 order:new`)) }, 7000)
      })
      expect(received.length).toBeGreaterThanOrEqual(2)
    } finally { socket.close() }
  })

  it('una chiamata cameriere arriva live (waiter:called)', async () => {
    const socket = await dashboardSocket()
    try {
      const evP = waitForEvent(socket, 'waiter:called')
      const cookie = await getTableCookie(env.qrToken)
      const res = await fetch(`${SERVER}/api/customer/waiter-call`, {
        method: 'POST', headers: jsonHeaders(cookie),
        body: JSON.stringify({ restaurantId: env.restaurantId, tableId: env.tableId, tableNumber: env.tableNumber, type: 'help' }),
      })
      expect(res.status).toBe(200)
      const payload = await evP
      expect(payload.tableNumber).toBe(env.tableNumber)
      expect(payload.type).toBe('help')
    } finally { socket.close() }
  })

  it('lo staff risolve una chiamata cameriere → waiter:resolved a tutti i device', async () => {
    const socket = await dashboardSocket()
    try {
      const evP = waitForEvent(socket, 'waiter:resolved')
      const res = await fetch(`${SERVER}/api/tables/${env.tableId}/waiter-resolve`, {
        method: 'POST', headers: jsonHeaders(`tako_session=${env.staffToken}`), body: '{}',
      })
      expect(res.status).toBe(200)
      const payload = await evP
      expect(payload.tableId).toBe(env.tableId)
    } finally { socket.close() }
  })

  it('un tavolo passa a occupied live (table:updated)', async () => {
    const socket = await dashboardSocket()
    try {
      const evP = waitForEvent(socket, 'table:updated')
      const cookie = await getTableCookie(env.qrToken)
      await placeOrder(cookie)
      const payload = await evP
      expect(payload.tableId).toBe(env.tableId)
      expect(payload.status).toBe('occupied')
    } finally { socket.close() }
  })
})

describe('Real-time dashboard → cliente', () => {
  it('un cambio di stato in cucina arriva live al tavolo del cliente (order:updated)', async () => {
    // 1) cliente entra nella room del tavolo (socket autenticato col cookie tavolo)
    const cookie = await getTableCookie(env.qrToken)
    const customer = await customerTableSocket(cookie)
    try {
      // 2) crea un ordine
      const order = (await (await placeOrder(cookie)).json()).data
      // 3) lo staff cambia stato → il cliente deve riceverlo
      const evP = waitForEvent(customer, 'order:updated')
      const res = await fetch(`${SERVER}/api/orders/${order.id}/status`, {
        method: 'PATCH', headers: jsonHeaders(`tako_session=${env.staffToken}`),
        body: JSON.stringify({ status: 'preparing' }),
      })
      expect(res.status).toBe(200)
      const payload = await evP
      expect(payload.orderId).toBe(order.id)
      expect(payload.status).toBe('preparing')
    } finally { customer.close() }
  })
})

describe('Real-time staff → dashboard (menu/cucina)', () => {
  it('lo stato di una singola portata avanza il tracking del cliente (order:updated al tavolo)', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const customer = await customerTableSocket(cookie)
    try {
      const order = (await (await placeOrder(cookie)).json()).data
      const itemId = order.items[0].id
      const evP = waitForEvent(customer, 'order:updated')
      const res = await fetch(`${SERVER}/api/orders/${order.id}/items/${itemId}/status`, {
        method: 'PATCH', headers: jsonHeaders(`tako_session=${env.staffToken}`),
        body: JSON.stringify({ status: 'ready' }),
      })
      expect(res.status).toBe(200)
      const payload = await evP
      expect(payload.orderId).toBe(order.id)
      expect(payload.status).toBe('ready') // tutte le portate ready → ordine ready
    } finally { customer.close() }
  })

  it('l\'annullamento di un ordine arriva live al tavolo del cliente', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const customer = await customerTableSocket(cookie)
    try {
      const order = (await (await placeOrder(cookie)).json()).data
      const evP = waitForEvent(customer, 'order:updated')
      const res = await fetch(`${SERVER}/api/orders/${order.id}/cancel`, {
        method: 'PATCH', headers: jsonHeaders(`tako_session=${env.staffToken}`), body: '{}',
      })
      expect(res.status).toBe(200)
      const payload = await evP
      expect(payload.orderId).toBe(order.id)
      expect(payload.status).toBe('cancelled')
    } finally { customer.close() }
  })

  it('segnare un piatto esaurito emette menu:item_availability alla dashboard', async () => {
    const socket = await dashboardSocket()
    try {
      const evP = waitForEvent(socket, 'menu:item_availability')
      const res = await fetch(`${SERVER}/api/menus/items/${env.menuItemId}/availability`, {
        method: 'PATCH', headers: jsonHeaders(`tako_session=${env.staffToken}`),
        body: JSON.stringify({ available: false }),
      })
      expect(res.status).toBe(200)
      const payload = await evP
      expect(payload.itemId).toBe(env.menuItemId)
      expect(payload.available).toBe(false)
      // ripristina
      await fetch(`${SERVER}/api/menus/items/${env.menuItemId}/availability`, {
        method: 'PATCH', headers: jsonHeaders(`tako_session=${env.staffToken}`),
        body: JSON.stringify({ available: true }),
      })
    } finally { socket.close() }
  })
})

describe('Real-time menu → cliente (room pubblica)', () => {
  it('il cliente nella room menu riceve l\'esaurito live, senza eventi staff', async () => {
    const customer = io(SERVER, { transports: ['websocket'] })
    await new Promise<void>((res, rej) => { customer.on('connect', () => res()); setTimeout(() => rej(new Error('connect timeout')), 5000) })
    customer.emit('join:menu', env.restaurantId)
    await new Promise(r => setTimeout(r, 400))
    // il cliente NON deve ricevere eventi staff (es. order:new)
    let staffLeak = false
    customer.on('order:new', () => { staffLeak = true })
    try {
      const evP = waitForEvent(customer, 'menu:item_availability')
      const res = await fetch(`${SERVER}/api/menus/items/${env.menuItemId}/availability`, {
        method: 'PATCH', headers: jsonHeaders(`tako_session=${env.staffToken}`),
        body: JSON.stringify({ available: false }),
      })
      expect(res.status).toBe(200)
      const payload = await evP
      expect(payload.itemId).toBe(env.menuItemId)
      expect(payload.available).toBe(false)
      // genera un evento staff e verifica che NON arrivi al cliente menu
      const cookie = await getTableCookie(env.qrToken)
      await fetch(`${SERVER}/api/menus/items/${env.menuItemId}/availability`, {
        method: 'PATCH', headers: jsonHeaders(`tako_session=${env.staffToken}`),
        body: JSON.stringify({ available: true }),
      })
      await placeOrder(cookie)
      await new Promise(r => setTimeout(r, 600))
      expect(staffLeak).toBe(false)
    } finally { customer.close() }
  })
})

describe('Affidabilità: reconnection + re-join room', () => {
  it('dopo una riconnessione il socket continua a ricevere gli eventi della room', async () => {
    const socket = io(SERVER, {
      transports: ['websocket'],
      extraHeaders: { Cookie: `tako_session=${env.staffToken}` },
    })
    // mima il client app: re-join ad OGNI connect (iniziale e riconnessione)
    socket.on('connect', () => socket.emit('join:restaurant', env.restaurantId))
    await new Promise<void>((res, rej) => { socket.on('connect', () => res()); setTimeout(() => rej(new Error('connect timeout')), 5000) })
    await new Promise(r => setTimeout(r, 300))
    try {
      // forza un drop e attendi la riconnessione automatica
      const reconnected = new Promise<void>((res) => socket.io.once('reconnect', () => res()))
      socket.io.engine.close()
      await reconnected
      await new Promise(r => setTimeout(r, 400)) // lascia ri-emettere il join

      const evP = waitForEvent(socket, 'order:new', 8000)
      const cookie = await getTableCookie(env.qrToken)
      await placeOrder(cookie)
      const payload = await evP
      expect(payload.restaurantId).toBe(env.restaurantId)
    } finally { socket.close() }
  })
})

describe('Sicurezza ordini', () => {
  it('senza cookie tavolo l\'ordine è respinto (401)', async () => {
    const res = await placeOrder('')
    expect(res.status).toBe(401)
  })

  it('idempotenza: stesso idempotencyKey non crea due ordini', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const idem = `idem-${Date.now()}`
    const a = await (await placeOrder(cookie, { idem })).json()
    const b = await (await placeOrder(cookie, { idem })).json()
    expect(a.data.id).toBe(b.data.id)
  })

  it('doppio-tap in gara (stesso idempotencyKey insieme) → nessun duplicato, nessun 500', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const idem = `race-${Date.now()}`
    const [a, b] = await Promise.all([placeOrder(cookie, { idem }), placeOrder(cookie, { idem })])
    expect([200, 201]).toContain(a.status)
    expect([200, 201]).toContain(b.status)
    const ja = await a.json(); const jb = await b.json()
    expect(ja.data.id).toBe(jb.data.id) // stesso ordine, non due
  })

  it('prezzo sempre dal DB: il totale riflette il prezzo del menu, non il client', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const res = await placeOrder(cookie, { quantity: 3 })
    const body = await res.json()
    expect(body.data.total).toBe(env.itemPrice * 3)
  })

  it('piatto esaurito tra menu e invio → 409 pulito, non 500', async () => {
    // staff segna esaurito
    await fetch(`${SERVER}/api/menus/items/${env.menuItemId}/availability`, {
      method: 'PATCH', headers: jsonHeaders(`tako_session=${env.staffToken}`),
      body: JSON.stringify({ available: false }),
    })
    try {
      const cookie = await getTableCookie(env.qrToken)
      const res = await placeOrder(cookie)
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error.code).toBe('ITEM_UNAVAILABLE')
    } finally {
      await fetch(`${SERVER}/api/menus/items/${env.menuItemId}/availability`, {
        method: 'PATCH', headers: jsonHeaders(`tako_session=${env.staffToken}`),
        body: JSON.stringify({ available: true }),
      })
    }
  })

  it('quantità oltre il massimo per voce → 400', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const res = await placeOrder(cookie, { quantity: 50 })
    expect(res.status).toBe(400)
  })
})

describe('Sicurezza cross-tenant', () => {
  it('ordine con un tavolo che non appartiene al ristorante → 403', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const res = await fetch(`${SERVER}/api/customer/orders`, {
      method: 'POST', headers: jsonHeaders(cookie),
      body: JSON.stringify({
        restaurantId: env.restaurantId,
        tableId: randomUUID(), // tavolo inesistente / di altri
        tableNumber: 'X',
        type: 'table',
        items: [{ menuItemId: env.menuItemId, quantity: 1 }],
        idempotencyKey: `xt-${Date.now()}`,
      }),
    })
    expect(res.status).toBe(403)
  })

  it('ordine con un piatto non del ristorante → 409 (item non disponibile)', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const res = await fetch(`${SERVER}/api/customer/orders`, {
      method: 'POST', headers: jsonHeaders(cookie),
      body: JSON.stringify({
        restaurantId: env.restaurantId,
        tableId: env.tableId,
        tableNumber: env.tableNumber,
        type: 'table',
        items: [{ menuItemId: randomUUID(), quantity: 1 }],
        idempotencyKey: `xi-${Date.now()}`,
      }),
    })
    expect(res.status).toBe(409)
  })

  it('chiamata cameriere con restaurantId diverso dal cookie tavolo → 403 (anti-spoofing)', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const res = await fetch(`${SERVER}/api/customer/waiter-call`, {
      method: 'POST', headers: jsonHeaders(cookie),
      body: JSON.stringify({ restaurantId: randomUUID(), tableId: env.tableId, tableNumber: env.tableNumber, type: 'help' }),
    })
    expect(res.status).toBe(403)
  })

  it('ordine senza voci → 400', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const res = await fetch(`${SERVER}/api/customer/orders`, {
      method: 'POST', headers: jsonHeaders(cookie),
      body: JSON.stringify({
        restaurantId: env.restaurantId, tableId: env.tableId, tableNumber: env.tableNumber,
        type: 'table', items: [], idempotencyKey: `empty-${Date.now()}`,
      }),
    })
    expect(res.status).toBe(400)
  })

  it('cambio stato ordine senza sessione staff → 401', async () => {
    const cookie = await getTableCookie(env.qrToken)
    const order = (await (await placeOrder(cookie)).json()).data
    const res = await fetch(`${SERVER}/api/orders/${order.id}/status`, {
      method: 'PATCH', headers: jsonHeaders(),
      body: JSON.stringify({ status: 'preparing' }),
    })
    expect(res.status).toBe(401)
  })
})
