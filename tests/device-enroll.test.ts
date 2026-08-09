// F2.1 — Arruolamento del telefono del ristoratore (app owner).
//
// I quattro casi sono quelli che decidono se il flusso è sicuro o no:
//   1. codice usato due volte  → il secondo tentativo fallisce (single-use atomico)
//   2. codice scaduto          → fallisce (TTL)
//   3. token emesso            → GET /api/auth/me con Bearer risponde 200
//   4. dispositivo revocato    → lo stesso token risponde 401 (revoca immediata)
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'
import { seedTestEnv, jsonHeaders, SERVER, DB_URL, type TestEnv } from './helpers.js'

let env: TestEnv
let close: () => Promise<void>
let sql: ReturnType<typeof postgres>

const authHeaders = (token: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` })
// GET/DELETE senza corpo: con Content-Type: application/json e body vuoto Fastify
// risponde 400 prima ancora di arrivare alla route.
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

async function newEnrollCode(): Promise<string> {
  const res = await fetch(`${SERVER}/api/auth/device/enroll-code`, {
    method: 'POST',
    headers: authHeaders(env.staffToken),
    body: '{}',
  })
  expect(res.status).toBe(200)
  const body = await res.json()
  return body.data.code as string
}

async function enroll(code: string, extra: Record<string, unknown> = {}) {
  return fetch(`${SERVER}/api/auth/device/enroll`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ code, ...extra }),
  })
}

beforeAll(async () => {
  const s = await seedTestEnv()
  env = s.env
  close = s.close
  sql = postgres(DB_URL)
})

afterAll(async () => {
  await sql.end()
  await close()
})

describe('arruolamento telefono (F2.1)', () => {
  it('genera un codice solo per un owner autenticato', async () => {
    const anon = await fetch(`${SERVER}/api/auth/device/enroll-code`, { method: 'POST', headers: jsonHeaders(), body: '{}' })
    expect(anon.status).toBe(401)

    const res = await fetch(`${SERVER}/api/auth/device/enroll-code`, { method: 'POST', headers: authHeaders(env.staffToken), body: '{}' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.data.code).toBe('string')
    expect(body.data.code.length).toBeGreaterThanOrEqual(32)
    expect(body.data.enrollUrl).toContain('/owner/#enroll=')
    // Il codice in chiaro NON deve esistere nel DB: a riposo c'è solo l'HMAC.
    const rows = await sql`select code_hash from device_enroll_codes where restaurant_id = ${env.restaurantId}`
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) expect(r['code_hash']).not.toBe(body.data.code)
  })

  it('un codice si consuma UNA volta sola', async () => {
    const code = await newEnrollCode()

    const first = await enroll(code, { deviceName: 'iPhone di Manuel', platform: 'iOS' })
    expect(first.status).toBe(201)
    const firstBody = await first.json()
    expect(typeof firstBody.data.token).toBe('string')
    expect(firstBody.data.restaurant.id).toBe(env.restaurantId)

    const second = await enroll(code)
    expect(second.status).toBe(400)
    expect((await second.json()).error.code).toBe('INVALID_CODE')
  })

  it('un codice scaduto non arruola nulla', async () => {
    const code = await newEnrollCode()
    // Sposta la scadenza nel passato: è il TTL, non l'orologio del test, a decidere.
    const before = await sql`select count(*)::int as n from sessions where kind = 'mobile'`
    await sql`update device_enroll_codes set expires_at = now() - interval '1 minute' where restaurant_id = ${env.restaurantId} and consumed_at is null`

    const res = await enroll(code)
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_CODE')

    const after = await sql`select count(*)::int as n from sessions where kind = 'mobile'`
    expect(after[0]!['n']).toBe(before[0]!['n'])
  })

  it('il token emesso autentica, dura 30 giorni ed è revocabile', async () => {
    const code = await newEnrollCode()
    const res = await enroll(code, { deviceName: 'Pixel', platform: 'Android' })
    expect(res.status).toBe(201)
    const { token, deviceId, expiresAt } = (await res.json()).data as { token: string; deviceId: string; expiresAt: string }

    // 30 giorni, non 90: un telefono si perde più facilmente di un Mac in cucina.
    const days = (new Date(expiresAt).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(29)
    expect(days).toBeLessThan(31)

    // Il Bearer autentica.
    const me = await fetch(`${SERVER}/api/auth/me`, { headers: bearer(token) })
    expect(me.status).toBe(200)
    expect((await me.json()).data.restaurantId).toBe(env.restaurantId)

    // Il dispositivo compare nell'elenco, SENZA mai esporre il token.
    const list = await fetch(`${SERVER}/api/auth/devices`, { headers: bearer(env.staffToken) })
    expect(list.status).toBe(200)
    interface DeviceRow { id: string; deviceName: string | null; devicePlatform: string | null; userName: string | null }
    const devices = (await list.json()).data as DeviceRow[]
    const mine = devices.find(d => d.id === deviceId)
    expect(mine).toBeTruthy()
    expect(mine!.deviceName).toBe('Pixel')
    expect(JSON.stringify(devices)).not.toContain(token)

    // Revoca → lo stesso token non autentica più.
    const del = await fetch(`${SERVER}/api/auth/devices/${deviceId}`, { method: 'DELETE', headers: bearer(env.staffToken) })
    expect(del.status).toBe(200)

    const after = await fetch(`${SERVER}/api/auth/me`, { headers: bearer(token) })
    expect(after.status).toBe(401)

    // Revocare due volte non è un errore silenzioso: la seconda volta non c'è più nulla.
    const again = await fetch(`${SERVER}/api/auth/devices/${deviceId}`, { method: 'DELETE', headers: bearer(env.staffToken) })
    expect(again.status).toBe(404)
  })

  it('un altro ristorante non vede né revoca i dispositivi altrui (anti cross-tenant)', async () => {
    const other = await seedTestEnv()
    try {
      const code = await newEnrollCode()
      const res = await enroll(code, { deviceName: 'Telefono del ristorante A' })
      const { deviceId } = (await res.json()).data as { deviceId: string }

      const list = await fetch(`${SERVER}/api/auth/devices`, { headers: bearer(other.env.staffToken) })
      expect(list.status).toBe(200)
      const ids = ((await list.json()).data as { id: string }[]).map(d => d.id)
      expect(ids).not.toContain(deviceId)

      const del = await fetch(`${SERVER}/api/auth/devices/${deviceId}`, { method: 'DELETE', headers: bearer(other.env.staffToken) })
      expect(del.status).toBe(404)
    } finally {
      await other.close()
    }
  })
})
