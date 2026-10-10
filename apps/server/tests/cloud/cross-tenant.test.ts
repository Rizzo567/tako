// FASE 5c — Isolamento multi-tenant cloud (§10 / SEC-011).
// L'owner viene SEMPRE dalla sessione, mai dall'input. Verifichiamo che owner A non
// possa leggere/usare risorse di owner B: /me ritorna solo sé stesso.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupCloud, cookieFromSetCookie, type CloudTestCtx } from './helpers'

let ctx: CloudTestCtx

beforeAll(async () => { ctx = await setupCloud({ cookieMode: 'samesite' }) }, 60000)
afterAll(async () => { await ctx?.close() })

const PW = 'CorrectHorseBattery1'
function body(o: unknown) {
  return { method: 'POST' as const, headers: { 'content-type': 'application/json' }, payload: JSON.stringify(o) }
}

async function makeOwner(email: string) {
  await ctx.app.inject({ url: '/api/auth/register', ...body({ email, password: PW, name: email.split('@')[0] }) })
  const token = ctx.lastTokenFor('verify')!
  await ctx.app.inject({ url: '/api/auth/verify-email', ...body({ token }) })
  const login = await ctx.app.inject({ url: '/api/auth/login', ...body({ email, password: PW }) })
  const sc = login.headers['set-cookie'] as string[] | string
  const sessionCookie = cookieFromSetCookie(Array.isArray(sc) ? sc : [sc], 'tako_cloud_session')!
  const ownerRow = await ctx.sql`select id from cloud_owners where email = ${email}`
  const ownerId = ownerRow[0]!.id as string
  const rest = await ctx.sql`insert into cloud_restaurants (owner_id, name, slug, plan) values (${ownerId}, 'Locale', ${'slug-' + email.split('@')[0]}, 'free') returning id`
  return { ownerId, restaurantId: rest[0]!.id as string, sessionCookie, email }
}

describe('cross-tenant (SEC-011)', () => {
  it('/me ritorna SOLO l’owner della sessione', async () => {
    const a = await makeOwner('tenant-a@test.local')
    const b = await makeOwner('tenant-b@test.local')

    const meA = await ctx.app.inject({ url: '/api/auth/me', headers: { cookie: `tako_cloud_session=${a.sessionCookie}` } })
    expect(meA.statusCode).toBe(200)
    expect(meA.json().data.owner.email).toBe('tenant-a@test.local')
    expect(meA.json().data.owner.id).toBe(a.ownerId)

    const meB = await ctx.app.inject({ url: '/api/auth/me', headers: { cookie: `tako_cloud_session=${b.sessionCookie}` } })
    expect(meB.json().data.owner.email).toBe('tenant-b@test.local')
    // A e B non si vedono a vicenda
    expect(meB.json().data.owner.id).not.toBe(a.ownerId)
  })

  it('senza sessione /me → 401', async () => {
    const res = await ctx.app.inject({ url: '/api/auth/me' })
    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('UNAUTHORIZED')
  })
})
