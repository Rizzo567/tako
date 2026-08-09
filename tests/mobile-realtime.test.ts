// F2.3 — Realtime dell'app owner.
//
// La differenza con tests/realtime.test.ts (che copre la dashboard) è il CANALE di
// autenticazione: il telefono non ha cookie, quindi entra nella room passando il token
// come SECONDO ARGOMENTO di `join:restaurant` (socket/handlers.ts). Qui si verifica
// che quella via funzioni davvero e che la revoca la chiuda.
//
// Due asserzioni, entrambe richieste dal piano:
//   1. un ordine creato altrove arriva al telefono entro 2 s;
//   2. un token REVOCATO smette di ricevere eventi dopo la rivalidazione dei 60 s.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { io, type Socket } from 'socket.io-client'
import postgres from 'postgres'
import { seedTestEnv, getTableCookie, jsonHeaders, waitForEvent, SERVER, DB_URL, type TestEnv } from './helpers.js'

let env: TestEnv
let close: () => Promise<void>
let sql: ReturnType<typeof postgres>
const sockets: Socket[] = []

beforeAll(async () => {
  const s = await seedTestEnv()
  env = s.env
  close = s.close
  sql = postgres(DB_URL)
})

afterAll(async () => {
  for (const s of sockets) s.close()
  await sql.end()
  await close?.()
})

/** Arruola un telefono e restituisce il suo Bearer (lo stesso flusso dell'app). */
async function enrollPhone(): Promise<{ token: string; deviceId: string }> {
  const codeRes = await fetch(`${SERVER}/api/auth/device/enroll-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.staffToken}` },
    body: '{}',
  })
  const { code } = (await codeRes.json()).data as { code: string }
  const res = await fetch(`${SERVER}/api/auth/device/enroll`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ code, deviceName: 'Telefono di prova', platform: 'iOS' }),
  })
  expect(res.status).toBe(201)
  return (await res.json()).data as { token: string; deviceId: string }
}

/**
 * Socket del TELEFONO: nessun cookie nell'handshake, token in query (come fa il
 * browser dal tunnel) e token come argomento di join:restaurant.
 */
async function phoneSocket(token: string): Promise<Socket> {
  const socket = io(SERVER, { transports: ['websocket'], query: { token } })
  sockets.push(socket)
  await new Promise<void>((res, rej) => {
    socket.on('connect', () => res())
    socket.on('connect_error', rej)
    setTimeout(() => rej(new Error('socket connect timeout')), 5000)
  })
  socket.emit('join:restaurant', env.restaurantId, token)
  await new Promise((r) => setTimeout(r, 400))
  return socket
}

async function placeCustomerOrder(cookie: string) {
  const res = await fetch(`${SERVER}/api/customer/orders`, {
    method: 'POST',
    headers: jsonHeaders(cookie),
    body: JSON.stringify({
      restaurantId: env.restaurantId,
      tableId: env.tableId,
      tableNumber: env.tableNumber,
      type: 'table',
      items: [{ menuItemId: env.menuItemId, quantity: 1 }],
      idempotencyKey: `mob-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    }),
  })
  expect([200, 201]).toContain(res.status)
  return res.json()
}

describe('realtime del telefono (F2.3)', () => {
  it('riceve order:new entro 2 s con auth via argomento token', async () => {
    const { token } = await enrollPhone()
    const socket = await phoneSocket(token)

    const cookie = await getTableCookie(env.qrToken)
    const wait = waitForEvent(socket, 'order:new', 2000)
    await placeCustomerOrder(cookie)
    const payload = await wait

    expect(payload).toBeTruthy()
    expect(payload.restaurantId).toBe(env.restaurantId)
    expect(payload.items?.[0]?.menuItemId).toBe(env.menuItemId)
    socket.close()
  })

  it('un token REVOCATO non riceve più eventi dopo la rivalidazione', async () => {
    const { token, deviceId } = await enrollPhone()
    const socket = await phoneSocket(token)
    const cookie = await getTableCookie(env.qrToken)

    // Prima della revoca: gli eventi arrivano.
    const before = waitForEvent(socket, 'order:new', 3000)
    await placeCustomerOrder(cookie)
    await expect(before).resolves.toBeTruthy()

    // Revoca dalla dashboard: DELETE /api/auth/devices/:id cancella la riga sessions.
    const del = await fetch(`${SERVER}/api/auth/devices/${deviceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${env.staffToken}` },
    })
    expect(del.status).toBe(200)

    // Il socket rivalida la sessione ogni 60 s: entro quella finestra esce dalla room
    // e viene chiuso. Attendiamo l'evento 'disconnect' invece di dormire a vuoto.
    const disconnected = await new Promise<boolean>((resolve) => {
      if (socket.disconnected) return resolve(true)
      const timer = setTimeout(() => resolve(socket.disconnected), 75_000)
      socket.on('disconnect', () => { clearTimeout(timer); resolve(true) })
    })
    expect(disconnected).toBe(true)

    // Difesa in profondità: anche riaprendo un socket con lo STESSO token revocato,
    // il join non viene concesso e nessun evento arriva.
    const zombie = io(SERVER, { transports: ['websocket'], query: { token }, reconnection: false })
    sockets.push(zombie)
    await new Promise<void>((res) => { zombie.on('connect', () => res()); setTimeout(res, 4000) })
    zombie.emit('join:restaurant', env.restaurantId, token)
    await new Promise((r) => setTimeout(r, 400))

    let received = false
    zombie.on('order:new', () => { received = true })
    await placeCustomerOrder(cookie)
    await new Promise((r) => setTimeout(r, 1500))
    expect(received).toBe(false)

    zombie.close()
    socket.close()
  }, 120_000)

  it('la paginazione di /orders/active è additiva e coerente', async () => {
    const headers = { Authorization: `Bearer ${env.staffToken}` }

    // Senza parametri: comportamento invariato (nessun meta, tutti i risultati).
    const plain = await (await fetch(`${SERVER}/api/orders/active`, { headers })).json()
    expect(Array.isArray(plain.data)).toBe(true)
    expect(plain.meta).toBeUndefined()

    // Con ?limit=1: al massimo una riga e il cursore per la pagina successiva.
    const first = await (await fetch(`${SERVER}/api/orders/active?limit=1`, { headers })).json()
    expect(first.data.length).toBeLessThanOrEqual(1)
    expect(first.meta).toBeDefined()

    if (first.meta.nextBefore) {
      const second = await (await fetch(
        `${SERVER}/api/orders/active?limit=1&before=${encodeURIComponent(first.meta.nextBefore)}`,
        { headers },
      )).json()
      // La pagina successiva non ripete la riga già vista: il cursore è su createdAt.
      const firstId = first.data[0]?.id
      for (const o of second.data) expect(o.id).not.toBe(firstId)
    }

    // `limit` spazzatura non deve rompere nulla: si torna al comportamento pieno.
    const junk = await (await fetch(`${SERVER}/api/orders/active?limit=pippo`, { headers })).json()
    expect(Array.isArray(junk.data)).toBe(true)
  })
})
