// FASE 5c — Test pairing appliance↔cloud (§10 / SEC-001/003/007).
// Coperti:
//  - /pair/code: owner autenticato genera un device code per un PROPRIO ristorante;
//    restaurantId di un altro owner → 403 (SEC-011, cross-tenant).
//  - /pair/claim: code valido → bundle SENZA password_hash (SEC-001); code riusato/inesistente
//    → 400; oltre 5 tentativi falliti sullo stesso code → 429 (per-code lockout SEC-003).
//  - /pair/heartbeat: firma ed25519 VALIDA → ok; firma assente/invalida o ts fuori finestra → 401;
//    dopo bump credentials_version cloud → action 'refresh'; appliance revocata → 403 'revoke'.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { generateKeyPairSync, createPrivateKey, sign as edSign } from 'node:crypto'
import { setupCloud, cookieFromSetCookie, type CloudTestCtx } from './helpers'

let ctx: CloudTestCtx

beforeAll(async () => { ctx = await setupCloud({ cookieMode: 'samesite' }) }, 60000)
afterAll(async () => { await ctx?.close() })

const PW = 'CorrectHorseBattery1'

function body(o: unknown) {
  return { method: 'POST' as const, headers: { 'content-type': 'application/json' }, payload: JSON.stringify(o) }
}

// Crea un owner verificato + sessione (cookie) + un ristorante cloud di sua proprietà.
async function makeOwnerWithRestaurant(email: string): Promise<{ ownerId: string; restaurantId: string; sessionCookie: string }> {
  await ctx.app.inject({ url: '/api/auth/register', ...body({ email, password: PW }) })
  const token = ctx.lastTokenFor('verify')!
  await ctx.app.inject({ url: '/api/auth/verify-email', ...body({ token }) })
  const login = await ctx.app.inject({ url: '/api/auth/login', ...body({ email, password: PW }) })
  const sc = login.headers['set-cookie'] as string[] | string
  const sessionCookie = cookieFromSetCookie(Array.isArray(sc) ? sc : [sc], 'tako_cloud_session')!
  const ownerRow = await ctx.sql`select id from cloud_owners where email = ${email}`
  const ownerId = ownerRow[0]!.id as string
  const slug = `r-${email.split('@')[0]}`
  const rest = await ctx.sql`insert into cloud_restaurants (owner_id, name, slug, plan) values (${ownerId}, 'Locale Test', ${slug}, 'free') returning id`
  return { ownerId, restaurantId: rest[0]!.id as string, sessionCookie }
}

// Firma ed25519 di un payload come fa apps/server/src/lib/cloud-client.ts (signPayload).
function signEd25519(privateKeyPem: string, payload: string): string {
  return edSign(null, Buffer.from(payload, 'utf8'), createPrivateKey(privateKeyPem)).toString('base64url')
}

function newKeypair(): { publicKeyPem: string; privateKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }
}

async function genCode(sessionCookie: string, restaurantId: string) {
  return ctx.app.inject({ url: '/api/pair/code', method: 'POST', headers: { 'content-type': 'application/json', cookie: `tako_cloud_session=${sessionCookie}` }, payload: JSON.stringify({ restaurantId }) })
}

describe('/pair/code — ownership (SEC-011)', () => {
  it('owner genera un device code per il proprio ristorante → 200 con code', async () => {
    const a = await makeOwnerWithRestaurant('pair-a@test.local')
    const res = await genCode(a.sessionCookie, a.restaurantId)
    expect(res.statusCode).toBe(200)
    expect(res.json().data.code).toBeTruthy()
    expect(res.json().data.restaurantId).toBe(a.restaurantId)
  })

  it('senza sessione → 401', async () => {
    const a = await makeOwnerWithRestaurant('pair-noauth@test.local')
    const res = await ctx.app.inject({ url: '/api/pair/code', ...body({ restaurantId: a.restaurantId }) })
    expect(res.statusCode).toBe(401)
  })

  it('restaurantId di un ALTRO owner → 403 (cross-tenant)', async () => {
    const a = await makeOwnerWithRestaurant('pair-owner-a@test.local')
    const b = await makeOwnerWithRestaurant('pair-owner-b@test.local')
    // A prova a generare un code per il ristorante di B
    const res = await genCode(a.sessionCookie, b.restaurantId)
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('FORBIDDEN')
  })
})

describe('/pair/claim — bundle senza password_hash (SEC-001) + single-use', () => {
  it('code valido → bundle con ownerSnapshot NON segreto e SENZA password_hash', async () => {
    const a = await makeOwnerWithRestaurant('claim-ok@test.local')
    const code = (await genCode(a.sessionCookie, a.restaurantId)).json().data.code as string
    const kp = newKeypair()
    const res = await ctx.app.inject({ url: '/api/pair/claim', ...body({ code, devicePubKey: kp.publicKeyPem }) })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.applianceToken).toBeTruthy()
    expect(data.applianceId).toBeTruthy()
    expect(data.ownerSnapshot.cloud_owner_id).toBe(a.ownerId)
    expect(data.ownerSnapshot.email).toBe('claim-ok@test.local')
    // SEC-001: nessun password_hash in NESSUNA parte del bundle
    expect(JSON.stringify(res.json())).not.toContain('password_hash')
    expect(data.ownerSnapshot.password_hash).toBeUndefined()
  })

  it('riuso dello stesso code → 400 (single-use atomico)', async () => {
    const a = await makeOwnerWithRestaurant('claim-reuse@test.local')
    const code = (await genCode(a.sessionCookie, a.restaurantId)).json().data.code as string
    const kp = newKeypair()
    const first = await ctx.app.inject({ url: '/api/pair/claim', ...body({ code, devicePubKey: kp.publicKeyPem }) })
    expect(first.statusCode).toBe(200)
    const second = await ctx.app.inject({ url: '/api/pair/claim', ...body({ code, devicePubKey: kp.publicKeyPem }) })
    expect(second.statusCode).toBe(400)
    expect(second.json().error.code).toBe('INVALID_CODE')
  })

  it('oltre 5 tentativi falliti sullo stesso code → 429 (per-code lockout SEC-003)', async () => {
    const kp = newKeypair()
    const fakeCode = 'a'.repeat(40) // code inesistente → fallimento ripetuto
    let last = 0
    for (let i = 0; i < 6; i++) {
      const r = await ctx.app.inject({ url: '/api/pair/claim', ...body({ code: fakeCode, devicePubKey: kp.publicKeyPem }) })
      last = r.statusCode
    }
    // i primi 5 tentativi → 400; dal 6° → 429
    expect(last).toBe(429)
  })
})

describe('/pair/heartbeat — proof-of-possession ed25519 (SEC-003/007)', () => {
  async function pairedAppliance(email: string) {
    const a = await makeOwnerWithRestaurant(email)
    const code = (await genCode(a.sessionCookie, a.restaurantId)).json().data.code as string
    const kp = newKeypair()
    const claim = await ctx.app.inject({ url: '/api/pair/claim', ...body({ code, devicePubKey: kp.publicKeyPem }) })
    const data = claim.json().data
    return { ...a, kp, applianceId: data.applianceId as string, credentialsVersion: data.credentialsVersion as number }
  }

  function heartbeat(applianceId: string, kp: { privateKeyPem: string }, opts: { ts?: number; credentialsVersion?: number; signature?: string } = {}) {
    const ts = opts.ts ?? Date.now()
    const cv = opts.credentialsVersion ?? 0
    const payload = JSON.stringify({ applianceId, ts, credentialsVersion: cv })
    const signature = opts.signature ?? signEd25519(kp.privateKeyPem, payload)
    return ctx.app.inject({
      url: '/api/pair/heartbeat',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-tako-appliance-token': applianceId,
        'x-tako-signature': signature,
        'x-tako-timestamp': String(ts),
      },
      payload: JSON.stringify({ credentialsVersion: cv }),
    })
  }

  it('firma valida + ts nella finestra → 200 action none', async () => {
    const p = await pairedAppliance('hb-ok@test.local')
    const res = await heartbeat(p.applianceId, p.kp, { credentialsVersion: p.credentialsVersion })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.action).toBe('none')
  })

  it('firma mancante → 401', async () => {
    const p = await pairedAppliance('hb-nosig@test.local')
    const res = await ctx.app.inject({
      url: '/api/pair/heartbeat', method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tako-appliance-token': p.applianceId, 'x-tako-timestamp': String(Date.now()) },
      payload: JSON.stringify({ credentialsVersion: 0 }),
    })
    expect(res.statusCode).toBe(401)
  })

  it('firma di una keypair diversa → 401 (PoP fallisce)', async () => {
    const p = await pairedAppliance('hb-wrongkey@test.local')
    const other = newKeypair()
    const res = await heartbeat(p.applianceId, { privateKeyPem: other.privateKeyPem }, { credentialsVersion: 0 })
    expect(res.statusCode).toBe(401)
  })

  it('timestamp fuori finestra (±5 min) → 401 (anti-replay)', async () => {
    const p = await pairedAppliance('hb-stale@test.local')
    const oldTs = Date.now() - 10 * 60 * 1000 // 10 minuti fa
    const res = await heartbeat(p.applianceId, p.kp, { ts: oldTs, credentialsVersion: 0 })
    expect(res.statusCode).toBe(401)
  })

  it('appliance sconosciuta → 401', async () => {
    const kp = newKeypair()
    const res = await heartbeat('00000000-0000-0000-0000-000000000000', kp, { credentialsVersion: 0 })
    expect(res.statusCode).toBe(401)
  })

  it('dopo bump credentials_version cloud → action refresh', async () => {
    const p = await pairedAppliance('hb-refresh@test.local')
    // simula un reset/cambio pw: bumpa la versione dell'owner sul cloud
    await ctx.sql`update cloud_owners set credentials_version = credentials_version + 1 where id = ${p.ownerId}`
    // l'appliance firma con la SUA versione vecchia (0) → il cloud la vede minore → refresh
    const res = await heartbeat(p.applianceId, p.kp, { credentialsVersion: 0 })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.action).toBe('refresh')
    expect(res.json().data.credentialsVersion).toBeGreaterThan(0)
  })

  it('appliance revocata → 403 action revoke', async () => {
    const p = await pairedAppliance('hb-revoked@test.local')
    await ctx.sql`update cloud_appliances set revoked_at = now() where id = ${p.applianceId}`
    const res = await heartbeat(p.applianceId, p.kp, { credentialsVersion: 0 })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('REVOKED')
    expect(res.json().data.action).toBe('revoke')
  })
})
