import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { seedTestEnv, jsonHeaders, SERVER, DB_URL, type TestEnv } from './helpers'

// Turni staff: clock-in/out, isolamento tenant, permessi manager vs dipendente.
// NB: richiede il server live con la route /api/shifts registrata (wiring in index.ts).

let a: TestEnv, aClose: () => Promise<void>
let b: TestEnv, bClose: () => Promise<void>
let dip: { id: string; token: string }
const sql = postgres(DB_URL)

// Crea un membro extra (con sessione) nel ristorante dato.
async function addUser(restaurantId: string, role: string): Promise<{ id: string; token: string }> {
  const [u] = await sql`
    insert into users (restaurant_id, name, email, role)
    values (${restaurantId}, ${'Membro ' + role}, ${role + '-' + randomUUID().slice(0, 8) + '@test.local'}, ${role})
    returning id`
  const token = `test_sess_${randomUUID().replace(/-/g, '')}`
  await sql`insert into sessions (user_id, token, expires_at) values (${u!.id}, ${token}, now() + interval '1 day')`
  return { id: u!.id as string, token: token }
}

beforeAll(async () => {
  const sa = await seedTestEnv(); a = sa.env; aClose = sa.close
  const sb = await seedTestEnv(); b = sb.env; bClose = sb.close
  dip = await addUser(a.restaurantId, 'dipendente')
})
afterAll(async () => { await aClose?.(); await bClose?.(); await sql.end() })

const hdr = (token: string) => jsonHeaders(`tako_session=${token}`)
const post = (token: string, path: string, body: any) =>
  fetch(`${SERVER}/api/shifts${path}`, { method: 'POST', headers: hdr(token), body: JSON.stringify(body) })
const get = (token: string, path: string) =>
  fetch(`${SERVER}/api/shifts${path}`, { headers: hdr(token) })

describe('Turni · clock-in / clock-out', () => {
  it('owner timbra entrata su se stesso → 201 e compare tra gli attivi', async () => {
    const r = await post(a.staffToken, '/clock-in', {})
    expect(r.status).toBe(201)
    const active = (await (await get(a.staffToken, '/active')).json()).data
    expect(active.some((s: any) => s.userId === a.userId && s.endsAt === null)).toBe(true)
  })

  it('doppio clock-in dello stesso membro → 409 ALREADY_CLOCKED_IN', async () => {
    const r = await post(a.staffToken, '/clock-in', {})
    expect(r.status).toBe(409)
    expect((await r.json()).error.code).toBe('ALREADY_CLOCKED_IN')
  })

  it('clock-out chiude il turno (endsAt valorizzato)', async () => {
    const r = await post(a.staffToken, '/clock-out', {})
    expect(r.status).toBe(200)
    expect((await r.json()).data.endsAt).toBeTruthy()
    const active = (await (await get(a.staffToken, '/active')).json()).data
    expect(active.some((s: any) => s.userId === a.userId)).toBe(false)
  })
})

describe('Turni · permessi', () => {
  it('un dipendente NON può timbrare per un altro membro → 403', async () => {
    const r = await post(dip.token, '/clock-in', { userId: a.userId })
    expect(r.status).toBe(403)
  })

  it('un dipendente può timbrare per sé → 201', async () => {
    const r = await post(dip.token, '/clock-in', { userId: dip.id })
    expect(r.status).toBe(201)
    await post(dip.token, '/clock-out', { userId: dip.id })
  })
})

describe('Turni · isolamento tenant', () => {
  it('il manager del ristorante A non può timbrare un utente del ristorante B → 404', async () => {
    const r = await post(a.staffToken, '/clock-in', { userId: b.userId })
    expect(r.status).toBe(404)
  })

  it('i turni di B non compaiono nella lista di A', async () => {
    // crea un turno manuale in B
    const c = await post(b.staffToken, '/', { userId: b.userId, startsAt: new Date().toISOString() })
    expect(c.status).toBe(201)
    const from = new Date(Date.now() - 86400000).toISOString()
    const to = new Date(Date.now() + 86400000).toISOString()
    const listA = (await (await get(a.staffToken, `/?from=${from}&to=${to}`)).json()).data
    expect(listA.every((s: any) => s.userId !== b.userId)).toBe(true)
  })

  it('crea + elimina turno manuale (owner) → 201 poi 200', async () => {
    const c = await post(a.staffToken, '/', { userId: a.userId, startsAt: new Date().toISOString(), role: 'Sala' })
    expect(c.status).toBe(201)
    const id = (await c.json()).data.id
    // DELETE senza body: solo cookie, niente Content-Type (come fa il client reale
    // TakoAPI.del). Con Content-Type: application/json + body vuoto Fastify risponde 400.
    const d = await fetch(`${SERVER}/api/shifts/${id}`, { method: 'DELETE', headers: { Cookie: `tako_session=${a.staffToken}` } })
    expect(d.status).toBe(200)
  })
})
