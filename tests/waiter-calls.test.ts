// F2.5 — Chiamate cameriere PERSISTITE.
//
// Prima della migrazione 0017 una chiamata era solo un emit socket: chi apriva
// l'app dopo non la vedeva mai. Il telefono del ristoratore è per definizione un
// dispositivo che si collega in ritardo, quindi qui si verifica che la chiamata
// sopravviva alla sua stessa notifica.
//
// Tre casi (piano F2.5):
//   1. chiamata creata → compare in GET /api/tables/waiter-calls?open=1
//   2. risolta → sparisce dall'elenco e l'evento waiter:resolved viene emesso
//   3. chiamata di un ALTRO ristorante → mai visibile (anti cross-tenant)
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { io, type Socket } from 'socket.io-client'
import { seedTestEnv, getTableCookie, jsonHeaders, waitForEvent, SERVER, type TestEnv } from './helpers.js'

let env: TestEnv
let close: () => Promise<void>
// POST senza corpo: con Content-Type: application/json e body vuoto Fastify
// risponde 400 prima ancora di entrare nella route. Solo il cookie, quindi.
const staffCookie = () => ({ Cookie: `tako_session=${env.staffToken}` })

interface CallRow { id: string; tableId: string; tableNumber: string | null; type: string; resolvedAt: string | null }

beforeAll(async () => {
  ;({ env, close } = await seedTestEnv())
})
afterAll(async () => close())

async function callWaiter(cookie: string, type: 'help' | 'bill' | 'water' = 'help', target = env) {
  const res = await fetch(`${SERVER}/api/customer/waiter-call`, {
    method: 'POST',
    headers: jsonHeaders(cookie),
    body: JSON.stringify({
      restaurantId: target.restaurantId,
      tableId: target.tableId,
      tableNumber: target.tableNumber,
      type,
    }),
  })
  expect(res.status).toBe(200)
}

async function openCalls(token = env.staffToken): Promise<CallRow[]> {
  const res = await fetch(`${SERVER}/api/tables/waiter-calls?open=1`, {
    headers: { Cookie: `tako_session=${token}` },
  })
  expect(res.status).toBe(200)
  return (await res.json()).data as CallRow[]
}

describe('chiamate cameriere persistite (F2.5)', () => {
  it('una chiamata fatta ADESSO è ancora lì quando l\'app si apre dopo', async () => {
    const cookie = await getTableCookie(env.qrToken)
    await callWaiter(cookie, 'bill')

    // Nessun socket in ascolto: è esattamente lo scenario "app chiusa".
    const calls = await openCalls()
    const mine = calls.find((c) => c.tableId === env.tableId)
    expect(mine, 'la chiamata deve essere persistita, non solo emessa').toBeTruthy()
    expect(mine!.type).toBe('bill')
    expect(mine!.resolvedAt).toBeNull()
    expect(mine!.tableNumber).toBe(env.tableNumber)
  })

  it('cinque tocchi sul pulsante producono UNA chiamata aperta', async () => {
    const cookie = await getTableCookie(env.qrToken)
    for (let i = 0; i < 5; i++) await callWaiter(cookie, 'water')

    const mine = (await openCalls()).filter((c) => c.tableId === env.tableId)
    expect(mine.length).toBe(1)
    // L'ultimo motivo vince: il cliente ha cambiato richiesta, non ne ha fatte cinque.
    expect(mine[0]!.type).toBe('water')
  })

  it('risolta: sparisce dall\'elenco e l\'evento waiter:resolved viene emesso', async () => {
    const cookie = await getTableCookie(env.qrToken)
    await callWaiter(cookie, 'help')
    expect((await openCalls()).some((c) => c.tableId === env.tableId)).toBe(true)

    const socket: Socket = io(SERVER, {
      transports: ['websocket'],
      extraHeaders: { Cookie: `tako_session=${env.staffToken}` },
    })
    await new Promise<void>((res, rej) => {
      socket.on('connect', () => res())
      socket.on('connect_error', rej)
      setTimeout(() => rej(new Error('socket connect timeout')), 5000)
    })
    socket.emit('join:restaurant', env.restaurantId, env.staffToken)
    await new Promise((r) => setTimeout(r, 400))

    try {
      const evP = waitForEvent(socket, 'waiter:resolved', 4000)
      const res = await fetch(`${SERVER}/api/tables/${env.tableId}/waiter-resolve`, { method: 'POST', headers: staffCookie() })
      expect(res.status).toBe(200)
      const payload = await evP
      expect(payload.tableId).toBe(env.tableId)

      expect((await openCalls()).some((c) => c.tableId === env.tableId)).toBe(false)

      // Risolvere due volte non è un errore: l'operazione è idempotente.
      const again = await fetch(`${SERVER}/api/tables/${env.tableId}/waiter-resolve`, { method: 'POST', headers: staffCookie() })
      expect(again.status).toBe(200)
    } finally {
      socket.close()
    }
  })

  it('la chiamata di un altro ristorante non è MAI visibile (anti cross-tenant)', async () => {
    const other = await seedTestEnv()
    try {
      const otherCookie = await getTableCookie(other.env.qrToken)
      await callWaiter(otherCookie, 'help', other.env)

      // L'owner dell'altro ristorante la vede…
      const theirs = await openCalls(other.env.staffToken)
      expect(theirs.some((c) => c.tableId === other.env.tableId)).toBe(true)

      // …il nostro no.
      const ours = await openCalls()
      expect(ours.some((c) => c.tableId === other.env.tableId)).toBe(false)

      // E non può nemmeno risolverla: il tavolo non è suo.
      const res = await fetch(`${SERVER}/api/tables/${other.env.tableId}/waiter-resolve`, { method: 'POST', headers: staffCookie() })
      expect(res.status).toBe(404)
    } finally {
      await other.close()
    }
  })
})
