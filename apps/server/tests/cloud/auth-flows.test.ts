// FASE 5c — Test di integrazione dei flussi auth del control-plane cloud (§10).
// Coperti qui:
//  1. register → token verifica (mock) → verify (POST) → login OK
//  2. login pre-verifica → EMAIL_NOT_VERIFIED solo dopo password corretta;
//     password errata → INVALID_CREDENTIALS generico (anti-enumeration SEC-008)
//  3. forgot → reset con token valido → login con nuova password; token riusato → 400;
//     reset → sessioni revocate + credentials_version bumpata (SEC-007)
//  anti-enumeration su register/forgot/resend con email inesistente → 200 generico.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupCloud, cookieFromSetCookie, type CloudTestCtx } from './helpers'

let ctx: CloudTestCtx

beforeAll(async () => { ctx = await setupCloud({ cookieMode: 'samesite' }) }, 60000)
afterAll(async () => { await ctx?.close() })

const PW = 'CorrectHorseBattery1'
const NEWPW = 'NuovaPasswordSicura9'

function body(o: unknown) {
  return { method: 'POST' as const, headers: { 'content-type': 'application/json' }, payload: JSON.stringify(o) }
}

async function register(email: string, password = PW, name?: string) {
  return ctx.app.inject({ url: '/api/auth/register', ...body({ email, password, name }) })
}
async function login(email: string, password: string) {
  return ctx.app.inject({ url: '/api/auth/login', ...body({ email, password }) })
}

describe('register → verify → login', () => {
  const email = 'flow1@test.local'

  it('register risponde 200 con messaggio generico e NON crea sessione', async () => {
    const res = await register(email, PW, 'Mario')
    expect(res.statusCode).toBe(200)
    expect(res.json().data.message).toBeTruthy()
    // anti-enumeration: nessun cookie di sessione al register
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('genera un token di verifica via email mock', async () => {
    const token = ctx.lastTokenFor('verify')
    expect(token, 'token di verifica catturato dal mock email').toBeTruthy()
  })

  it('login prima della verifica → EMAIL_NOT_VERIFIED (password corretta)', async () => {
    const res = await login(email, PW)
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('EMAIL_NOT_VERIFIED')
  })

  it('GET /verify-email NON consuma il token (resta valido)', async () => {
    const token = ctx.lastTokenFor('verify')!
    const res = await ctx.app.inject({ url: `/api/auth/verify-email?token=${token}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.valid).toBe(true)
    // ancora valido dopo la GET
    const res2 = await ctx.app.inject({ url: `/api/auth/verify-email?token=${token}` })
    expect(res2.json().data.valid).toBe(true)
  })

  it('POST /verify-email consuma il token e verifica l’email', async () => {
    const token = ctx.lastTokenFor('verify')!
    const res = await ctx.app.inject({ url: '/api/auth/verify-email', ...body({ token }) })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.verified).toBe(true)
  })

  it('riuso dello stesso token di verifica → 400 (single-use atomico)', async () => {
    const token = ctx.lastTokenFor('verify')!
    const res = await ctx.app.inject({ url: '/api/auth/verify-email', ...body({ token }) })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('INVALID_TOKEN')
  })

  it('login dopo verifica → 200 + cookie di sessione', async () => {
    const res = await login(email, PW)
    expect(res.statusCode).toBe(200)
    expect(res.json().data.owner.email).toBe(email)
    const sc = res.headers['set-cookie'] as string[] | string | undefined
    const arr = Array.isArray(sc) ? sc : sc ? [sc] : undefined
    expect(cookieFromSetCookie(arr, 'tako_cloud_session')).toBeTruthy()
  })
})

describe('login anti-enumeration (SEC-008)', () => {
  const email = 'flow2@test.local'

  beforeAll(async () => {
    await register(email, PW)
    const token = ctx.lastTokenFor('verify')!
    await ctx.app.inject({ url: '/api/auth/verify-email', ...body({ token }) })
  })

  it('password errata → INVALID_CREDENTIALS (NON rivela lo stato di verifica)', async () => {
    const res = await login(email, 'PasswordSbagliata123')
    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('INVALID_CREDENTIALS')
  })

  it('email inesistente con password qualsiasi → stesso 401 INVALID_CREDENTIALS', async () => {
    const res = await login('nonexiste@test.local', 'qualunquePassword1')
    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('INVALID_CREDENTIALS')
  })

  it('owner NON verificato: password ERRATA → INVALID_CREDENTIALS (non EMAIL_NOT_VERIFIED)', async () => {
    const unverified = 'unverified@test.local'
    await register(unverified, PW)
    const res = await login(unverified, 'PasswordSbagliata123')
    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('INVALID_CREDENTIALS')
  })

  it('owner NON verificato: password CORRETTA → EMAIL_NOT_VERIFIED (solo dopo password ok)', async () => {
    const unverified2 = 'unverified2@test.local'
    await register(unverified2, PW)
    const res = await login(unverified2, PW)
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('EMAIL_NOT_VERIFIED')
  })
})

describe('forgot → reset → login + single-use + revoca sessioni (SEC-007)', () => {
  const email = 'reset@test.local'

  beforeAll(async () => {
    await register(email, PW)
    const t = ctx.lastTokenFor('verify')!
    await ctx.app.inject({ url: '/api/auth/verify-email', ...body({ token: t }) })
  })

  it('forgot-password → 200 generico e genera un token reset', async () => {
    const res = await ctx.app.inject({ url: '/api/auth/forgot-password', ...body({ email }) })
    expect(res.statusCode).toBe(200)
    expect(ctx.lastTokenFor('reset')).toBeTruthy()
  })

  it('reset-password con token valido → 200', async () => {
    // crea una sessione attiva PRIMA del reset per verificarne la revoca
    const loginBefore = await login(email, PW)
    expect(loginBefore.statusCode).toBe(200)
    const scBefore = loginBefore.headers['set-cookie'] as string[]
    const sessionCookie = cookieFromSetCookie(Array.isArray(scBefore) ? scBefore : [scBefore], 'tako_cloud_session')!

    // leggi credentials_version prima del reset
    const before = await ctx.sql`select credentials_version, (select count(*) from cloud_sessions s where s.owner_id = o.id)::int as sessions from cloud_owners o where email = ${email}`
    const cvBefore = before[0]!.credentials_version as number
    expect(before[0]!.sessions as number).toBeGreaterThanOrEqual(1)

    const token = ctx.lastTokenFor('reset')!
    const res = await ctx.app.inject({ url: '/api/auth/reset-password', ...body({ token, password: NEWPW }) })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.reset).toBe(true)

    // credentials_version bumpata
    const after = await ctx.sql`select credentials_version, (select count(*) from cloud_sessions s where s.owner_id = o.id)::int as sessions from cloud_owners o where email = ${email}`
    expect(after[0]!.credentials_version as number).toBe(cvBefore + 1)
    // TUTTE le sessioni revocate
    expect(after[0]!.sessions as number).toBe(0)

    // la vecchia sessione non funziona più
    const me = await ctx.app.inject({ url: '/api/auth/me', headers: { cookie: `tako_cloud_session=${sessionCookie}` } })
    expect(me.statusCode).toBe(401)
  })

  it('riuso dello stesso token di reset → 400 (single-use atomico)', async () => {
    const token = ctx.lastTokenFor('reset')!
    const res = await ctx.app.inject({ url: '/api/auth/reset-password', ...body({ token, password: 'AltraPassword123' }) })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('INVALID_TOKEN')
  })

  it('login con la NUOVA password → 200; con la vecchia → 401', async () => {
    const ok = await login(email, NEWPW)
    expect(ok.statusCode).toBe(200)
    const ko = await login(email, PW)
    expect(ko.statusCode).toBe(401)
  })
})

describe('anti-enumeration su email inesistente (§10)', () => {
  it('forgot-password su email mai vista → 200 generico, nessun token', async () => {
    const before = ctx.emails.length
    const res = await ctx.app.inject({ url: '/api/auth/forgot-password', ...body({ email: 'ghost-forgot@test.local' }) })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.message).toBeTruthy()
    // nessuna email inviata (owner inesistente)
    expect(ctx.emails.length).toBe(before)
  })

  it('resend-verification su email inesistente → 200 generico, nessuna email', async () => {
    const before = ctx.emails.length
    const res = await ctx.app.inject({ url: '/api/auth/resend-verification', ...body({ email: 'ghost-resend@test.local' }) })
    expect(res.statusCode).toBe(200)
    expect(ctx.emails.length).toBe(before)
  })

  it('register su email ESISTENTE → 200 generico (non rivela il duplicato)', async () => {
    const email = 'dupe@test.local'
    const first = await register(email, PW)
    expect(first.statusCode).toBe(200)
    const second = await register(email, 'AltraPassword456')
    expect(second.statusCode).toBe(200)
    // un solo owner in DB malgrado due register
    const rows = await ctx.sql`select count(*)::int as n from cloud_owners where email = ${email}`
    expect(rows[0]!.n as number).toBe(1)
  })
})

describe('password policy (SEC-015)', () => {
  it('password troppo corta → 400 WEAK_PASSWORD', async () => {
    const res = await register('short@test.local', 'corta1')
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('WEAK_PASSWORD')
  })

  it('email malformata → 400 VALIDATION', async () => {
    const res = await ctx.app.inject({ url: '/api/auth/register', ...body({ email: 'non-una-email', password: PW }) })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('VALIDATION')
  })
})
