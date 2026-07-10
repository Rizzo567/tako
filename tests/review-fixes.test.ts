import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { io, type Socket } from 'socket.io-client'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { seedTestEnv, jsonHeaders, waitForEvent, SERVER, DB_URL, type TestEnv } from './helpers'

// Regressioni dalla revisione app 2026-07-09 (fix fascia critica+alta).
let env: TestEnv
let close: () => Promise<void>
let dipToken: string   // sessione di un DIPENDENTE (non owner) nello stesso ristorante

beforeAll(async () => {
  const s = await seedTestEnv()
  env = s.env
  close = s.close
  const sql = postgres(DB_URL, { max: 1 })
  // Abilita asporto (default off) per i test di tracking realtime asporto.
  await sql`update restaurants set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{takeawayEnabled}', 'true') where id = ${env.restaurantId}`
  // Un dipendente reale + sessione: serve per provare che il copilot NON gli concede
  // azioni da owner (privilege escalation via /ai/owner/execute).
  const [d] = await sql`insert into users (restaurant_id, name, email, role)
    values (${env.restaurantId}, 'Cameriere Test', ${'dip-' + randomUUID().slice(0, 8) + '@test.local'}, 'dipendente') returning id`
  dipToken = `test_sess_${randomUUID().replace(/-/g, '')}`
  await sql`insert into sessions (user_id, token, expires_at) values (${d!.id}, ${dipToken}, now() + interval '1 day')`
  await sql.end()
})
afterAll(async () => { await close?.() })

const staff = (token: string) => jsonHeaders(`tako_session=${token}`)

async function execute(token: string, name: string, args: any) {
  return fetch(`${SERVER}/api/ai/owner/execute`, {
    method: 'POST', headers: staff(token), body: JSON.stringify({ name, args }),
  })
}

// ── #1 — Privilege escalation copilot: le azioni owner-only sono negate ai ruoli
//         non autorizzati anche chiamando /execute direttamente. ────────────────
describe('AI copilot: autorizzazione per-ruolo su /execute', () => {
  it('un dipendente NON può creare staff (azione owner-only)', async () => {
    const res = await execute(dipToken, 'create_staff', { name: 'Intruso', role: 'cassiere', pin: '1234' })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(String(body.error?.message ?? '')).toMatch(/ruolo|autorizzat/i)
  })

  it('un dipendente NON può applicare sconti al conto (owner/cassa)', async () => {
    const res = await execute(dipToken, 'apply_bill_discount', { tableNumber: env.tableNumber, discount: 9999 })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(String(body.error?.message ?? '')).toMatch(/ruolo|autorizzat/i)
  })

  it('l\'owner NON viene bloccato dal gate di ruolo (può creare staff)', async () => {
    const res = await execute(env.staffToken, 'create_staff', { name: 'Nuovo Cassiere', role: 'cassiere', pin: '4321' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data?.ok).toBe(true)
  })
})

// ── #8 — Tracking realtime asporto: l'ordine senza tavolo riceve gli aggiornamenti
//         di stato sulla room del proprio ordine (join:order). ──────────────────
describe('Asporto: tracking realtime via room dell\'ordine', () => {
  async function takeawayCookie(): Promise<string> {
    const res = await fetch(`${SERVER}/api/customer/takeaway/${env.restaurantId}/session`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]
    if (!cookie.startsWith('tako_table=')) throw new Error('no takeaway cookie (status ' + res.status + ')')
    return cookie
  }

  it('lo staff avanza lo stato → il cliente asporto riceve order:updated', async () => {
    const cookie = await takeawayCookie()
    const o = (await (await fetch(`${SERVER}/api/customer/orders`, {
      method: 'POST', headers: jsonHeaders(cookie),
      body: JSON.stringify({ restaurantId: env.restaurantId, type: 'takeaway', items: [{ menuItemId: env.menuItemId, quantity: 1 }], idempotencyKey: `tk-${randomUUID()}`, customerName: 'Mario' }),
    })).json()).data
    expect(o.type).toBe('takeaway')

    const socket: Socket = io(SERVER, { transports: ['websocket'], extraHeaders: { Cookie: cookie } })
    await new Promise<void>((res, rej) => {
      socket.on('connect', () => res())
      socket.on('connect_error', rej)
      setTimeout(() => rej(new Error('socket connect timeout')), 5000)
    })
    try {
      socket.emit('join:order', o.id)
      await new Promise(r => setTimeout(r, 400)) // lascia completare il join autorizzato
      const evt = waitForEvent(socket, 'order:updated')
      const patch = await fetch(`${SERVER}/api/orders/${o.id}/status`, { method: 'PATCH', headers: staff(env.staffToken), body: JSON.stringify({ status: 'confirmed' }) })
      expect(patch.status).toBe(200)
      const payload = await evt
      expect(payload.orderId).toBe(o.id)
      expect(payload.status).toBe('confirmed')
    } finally {
      socket.disconnect()
    }
  })

  it('un\'altra sessione asporto NON può iscriversi al mio ordine (join:order negato)', async () => {
    const cookieA = await takeawayCookie()
    const o = (await (await fetch(`${SERVER}/api/customer/orders`, {
      method: 'POST', headers: jsonHeaders(cookieA),
      body: JSON.stringify({ restaurantId: env.restaurantId, type: 'takeaway', items: [{ menuItemId: env.menuItemId, quantity: 1 }], idempotencyKey: `tk-${randomUUID()}` }),
    })).json()).data

    // Cliente B (sessione diversa) prova a spiare l'ordine di A.
    const cookieB = await takeawayCookie()
    const socketB: Socket = io(SERVER, { transports: ['websocket'], extraHeaders: { Cookie: cookieB } })
    await new Promise<void>((res, rej) => {
      socketB.on('connect', () => res())
      socketB.on('connect_error', rej)
      setTimeout(() => rej(new Error('socket connect timeout')), 5000)
    })
    try {
      socketB.emit('join:order', o.id)
      await new Promise(r => setTimeout(r, 400))
      let leaked = false
      socketB.on('order:updated', () => { leaked = true })
      await fetch(`${SERVER}/api/orders/${o.id}/status`, { method: 'PATCH', headers: staff(env.staffToken), body: JSON.stringify({ status: 'confirmed' }) })
      await new Promise(r => setTimeout(r, 700))
      expect(leaked).toBe(false) // B non è nella room dell'ordine di A
    } finally {
      socketB.disconnect()
    }
  })
})
