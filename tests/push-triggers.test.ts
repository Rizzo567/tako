// F3.2 — I tre trigger: ordine nuovo, chiamata cameriere, scorta sotto soglia.
//
// COME SI OSSERVA UNA PUSH SENZA UN PUSH SERVICE. Il server gira in un altro
// processo: non si può spiare `pushDispatch` con un mock. Si usa invece il suo
// effetto collaterale a DATABASE: la subscription punta a `https://push.invalid/…`
// (TLD che non risolve mai, per specifica RFC 2606), quindi ogni invio fallisce e
// `push_subscriptions.fail_count` aumenta di ESATTAMENTE UNO per push tentata.
// Contare i fallimenti è più forte di contare le chiamate a un mock: dimostra che
// il codice di produzione è arrivato davvero fino alla rete.
//
// I quattro assert del piano:
//   1. una push per evento, per tutti e tre gli eventi
//   2. nessuna push verso una sessione scaduta/revocata
//   3. la push parte DOPO la risposta (misurato sul percorso critico dell'ordine)
//   4. niente eccezioni: gli endpoint irraggiungibili non rompono nessuna route
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'
import { seedTestEnv, getTableCookie, jsonHeaders, SERVER, DB_URL, type TestEnv } from './helpers.js'

let env: TestEnv
let close: () => Promise<void>
let sql: ReturnType<typeof postgres>
let tableCookie: string
let liveEndpoint: string
let deadEndpoint: string

const authHeaders = (token: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` })
const KEYS = { p256dh: 'BJxKEp_uzHM7dGWQpUE9UY7BqLIzy0lMBl4Nq0Q3jCk8fkD5nnPKX7Zc4Q9uCzWuKtVGiTk4V6f5AlL9nCiT_Bw', auth: 'k8JV6sjdbhAi9pi_hoDMPQ' }

async function failCount(endpoint: string): Promise<number> {
  const rows = await sql`select fail_count from push_subscriptions where endpoint = ${endpoint}`
  return rows.length ? Number(rows[0]!['fail_count']) : -1
}

/**
 * Aspetta che il contatore raggiunga `expected`. La push parte DOPO la risposta
 * (setImmediate): al ritorno della fetch non è ancora successo niente, ed è
 * esattamente ciò che deve essere.
 */
async function waitFail(endpoint: string, expected: number, timeoutMs = 15_000): Promise<number> {
  const deadline = Date.now() + timeoutMs
  let last = -1
  while (Date.now() < deadline) {
    last = await failCount(endpoint)
    if (last >= expected) return last
    await new Promise((r) => setTimeout(r, 100))
  }
  return last
}

beforeAll(async () => {
  const s = await seedTestEnv()
  env = s.env
  close = s.close
  sql = postgres(DB_URL)
  tableCookie = await getTableCookie(env.qrToken)

  // Telefono ARRUOLATO e iscritto: è il destinatario legittimo.
  const codeRes = await fetch(`${SERVER}/api/auth/device/enroll-code`, { method: 'POST', headers: authHeaders(env.staffToken), body: '{}' })
  const { data: { code } } = await codeRes.json()
  const enrolled = await fetch(`${SERVER}/api/auth/device/enroll`, {
    method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ code, deviceName: 'iPhone trigger', platform: 'iOS' }),
  })
  const { data: phone } = await enrolled.json()
  liveEndpoint = `https://push.invalid/live-${randomUUID()}`
  const sub = await fetch(`${SERVER}/api/push/subscribe`, {
    method: 'POST', headers: authHeaders(phone.token), body: JSON.stringify({ endpoint: liveEndpoint, keys: KEYS }),
  })
  expect(sub.status).toBe(201)

  // Telefono con la sessione GIÀ SCADUTA: non deve ricevere nulla, mai.
  const [dead] = await sql`
    insert into sessions (user_id, token, expires_at, kind, device_name)
    values (${env.userId}, ${'test_dead_' + randomUUID().replace(/-/g, '')}, now() - interval '1 hour', 'mobile', 'iPhone scaduto') returning id`
  deadEndpoint = `https://push.invalid/dead-${randomUUID()}`
  await sql`
    insert into push_subscriptions (restaurant_id, session_id, endpoint, p256dh, auth)
    values (${env.restaurantId}, ${dead!['id']}, ${deadEndpoint}, ${KEYS.p256dh}, ${KEYS.auth})`

  // Precondizione: senza internet il fast-fail è corretto ma questo file non può
  // verificare niente. Meglio dirlo forte che diventare verde per il motivo sbagliato.
  const conn = await (await fetch(`${SERVER}/api/system/connectivity`)).json()
  expect(conn.data.online, 'questo test richiede internet: senza, il fast-fail di isOnline() impedisce ogni invio').toBe(true)
})

afterAll(async () => {
  await sql`delete from push_subscriptions where restaurant_id = ${env.restaurantId}`
  await sql`delete from sessions where user_id = ${env.userId}`
  await sql.end()
  await close()
})

describe('trigger push (F3.2)', () => {
  it('un ordine dello staff genera UNA push', async () => {
    const before = await failCount(liveEndpoint)
    const res = await fetch(`${SERVER}/api/orders`, {
      method: 'POST',
      headers: authHeaders(env.staffToken),
      body: JSON.stringify({ tableId: env.tableId, items: [{ menuItemId: env.menuItemId, quantity: 1 }] }),
    })
    expect(res.status).toBe(201)
    expect(await waitFail(liveEndpoint, before + 1)).toBe(before + 1)
  })

  it('un ordine del cliente genera UNA push', async () => {
    const before = await failCount(liveEndpoint)
    const res = await fetch(`${SERVER}/api/customer/orders`, {
      method: 'POST',
      headers: jsonHeaders(tableCookie),
      body: JSON.stringify({
        restaurantId: env.restaurantId,
        tableId: env.tableId,
        tableNumber: env.tableNumber,
        type: 'table',
        items: [{ menuItemId: env.menuItemId, quantity: 2 }],
        idempotencyKey: `push-${randomUUID()}`,
      }),
    })
    expect(res.status).toBe(201)
    expect(await waitFail(liveEndpoint, before + 1)).toBe(before + 1)
  })

  it('una chiamata dal tavolo genera UNA push', async () => {
    const before = await failCount(liveEndpoint)
    const res = await fetch(`${SERVER}/api/customer/waiter-call`, {
      method: 'POST',
      headers: jsonHeaders(tableCookie),
      body: JSON.stringify({ restaurantId: env.restaurantId, tableId: env.tableId, tableNumber: env.tableNumber, type: 'bill' }),
    })
    expect(res.status).toBe(200)
    expect(await waitFail(liveEndpoint, before + 1)).toBe(before + 1)
  })

  it('una scorta che scende sotto la soglia genera UNA push — e solo allora', async () => {
    const [item] = await sql`
      insert into inventory_items (restaurant_id, name, unit, quantity, min_quantity)
      values (${env.restaurantId}, 'Farina Test', 'kg', 10, 2) returning id`
    const itemId = item!['id'] as string

    // Scarico che NON sfonda la soglia: nessuna push. Il rumore è il modo più
    // veloce di far disattivare le notifiche a un ristoratore.
    const before = await failCount(liveEndpoint)
    const sopra = await fetch(`${SERVER}/api/inventory/${itemId}/movements`, {
      method: 'POST', headers: authHeaders(env.staffToken), body: JSON.stringify({ type: 'unload', quantity: 1 }),
    })
    expect(sopra.status).toBe(201)
    await new Promise((r) => setTimeout(r, 1200))
    expect(await failCount(liveEndpoint)).toBe(before)

    // Scarico che la sfonda: una push.
    const sotto = await fetch(`${SERVER}/api/inventory/${itemId}/movements`, {
      method: 'POST', headers: authHeaders(env.staffToken), body: JSON.stringify({ type: 'unload', quantity: 8 }),
    })
    expect(sotto.status).toBe(201)
    expect(await waitFail(liveEndpoint, before + 1)).toBe(before + 1)

    await sql`delete from inventory_movements where item_id = ${itemId}`
    await sql`delete from inventory_items where id = ${itemId}`
  })

  it('una sessione scaduta non riceve MAI niente', async () => {
    // Quattro eventi sono già passati sopra: se il filtro sulle sessioni non ci
    // fosse, questo contatore sarebbe a quattro.
    expect(await failCount(deadEndpoint)).toBe(0)
  })

  it('la push non rallenta la creazione di un ordine cliente', async () => {
    const order = async () => {
      const t0 = performance.now()
      const res = await fetch(`${SERVER}/api/customer/orders`, {
        method: 'POST',
        headers: jsonHeaders(tableCookie),
        body: JSON.stringify({
          restaurantId: env.restaurantId, tableId: env.tableId, tableNumber: env.tableNumber, type: 'table',
          items: [{ menuItemId: env.menuItemId, quantity: 1 }],
          idempotencyKey: `perf-${randomUUID()}`,
        }),
      })
      expect(res.status).toBe(201)
      return performance.now() - t0
    }
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!

    // CON subscription attiva (ogni ordine tenta una push che fallisce in DNS).
    const conPush: number[] = []
    for (let i = 0; i < 8; i++) conPush.push(await order())

    // SENZA nessuna subscription: è la baseline del percorso critico.
    await sql`delete from push_subscriptions where restaurant_id = ${env.restaurantId}`
    const senzaPush: number[] = []
    for (let i = 0; i < 8; i++) senzaPush.push(await order())

    const dCon = median(conPush)
    const dSenza = median(senzaPush)
    console.log(`  POST /api/customer/orders — mediana con push ${dCon.toFixed(1)} ms · senza push ${dSenza.toFixed(1)} ms`)
    // Il budget è generoso di proposito: la misura serve a scoprire un invio fatto
    // PRIMA della risposta (che costerebbe il timeout DNS, centinaia di ms), non a
    // inseguire il rumore di una macchina condivisa.
    expect(dCon - dSenza).toBeLessThan(50)
  })
})
