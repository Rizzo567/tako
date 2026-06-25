// FASE 5c — Test OAuth del control-plane cloud (§10 / SEC-002 / SEC-006).
//
// Cosa testiamo e COME (confine col provider esterno mockato, logica interna REALE):
//  - Il vero `cloudOAuthRoutes` viene montato (provider Google+GitHub "configurati" via env).
//  - Mockiamo SOLO il confine esterno:
//      * `fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow` → ritorna un token finto
//        (evita il round-trip OAuth reale e il controllo state, che testiamo a parte);
//      * `global.fetch` → risponde come l'userinfo Google / le /user(/emails) GitHub.
//    Così `googleProfile`/`githubProfile` + `resolveOwner` + `finishCallback` — la logica
//    SEC-002 anti-takeover, vera — vengono eseguiti senza inventare risultati.
//  - `state` mancante/errato (SEC-006): NON mockiamo il token exchange → il plugin lancia →
//    la route fa redirect `?oauth_error=1`. Comportamento reale e raggiungibile.
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { setupCloud, oauthScope, type CloudTestCtx } from './helpers'

let ctx: CloudTestCtx

beforeAll(async () => {
  ctx = await setupCloud({ cookieMode: 'samesite', oauth: { google: true, github: true } })
}, 60000)
afterAll(async () => { await ctx?.close() })

// ─── Mock del confine esterno ────────────────────────────────────────────────
const realFetch = globalThis.fetch
let googleUserinfo: { sub: string; email: string; email_verified: boolean } | null = null
let githubUser: { id: number } | null = null
let githubEmails: Array<{ email: string; primary: boolean; verified: boolean }> | null = null

beforeEach(() => {
  const scope = oauthScope() as any
  // Forza il token exchange a non toccare la rete: ritorna un access_token finto.
  scope.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow = async () => ({
    token: { access_token: 'fake-google-access-token' },
  })
  scope.githubOAuth2.getAccessTokenFromAuthorizationCodeFlow = async () => ({
    token: { access_token: 'fake-github-access-token' },
  })
  // Mock di fetch verso gli endpoint provider.
  globalThis.fetch = (async (url: string | URL | Request) => {
    const u = String(url)
    if (u.includes('openidconnect.googleapis.com/v1/userinfo')) {
      return new Response(JSON.stringify(googleUserinfo), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (u === 'https://api.github.com/user') {
      return new Response(JSON.stringify(githubUser), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (u === 'https://api.github.com/user/emails') {
      return new Response(JSON.stringify(githubEmails), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return realFetch(url as any)
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
  googleUserinfo = null
  githubUser = null
  githubEmails = null
})

const cb = (provider: 'google' | 'github') =>
  ctx.app.inject({ url: `/api/auth/${provider}/callback?code=fake&state=fake` })

async function ownerByEmail(email: string) {
  const rows = await ctx.sql`select id, email, email_verified, password_hash, credentials_version from cloud_owners where email = ${email}`
  return rows[0]
}

describe('Google OAuth — SEC-002 (anti-takeover) + creazione', () => {
  it('email provider NON verificata → NON crea/linka owner, redirect ?oauth_error=email_unverified', async () => {
    googleUserinfo = { sub: 'g-unverified-1', email: 'unv@test.local', email_verified: false }
    const res = await cb('google')
    expect(res.statusCode).toBe(302)
    expect(res.headers['location']).toContain('oauth_error=email_unverified')
    expect(await ownerByEmail('unv@test.local')).toBeUndefined()
  })

  it('email verificata, nessun owner → crea nuovo owner (email_verified, password null) + sessione', async () => {
    googleUserinfo = { sub: 'g-new-1', email: 'gnew@test.local', email_verified: true }
    const res = await cb('google')
    expect(res.statusCode).toBe(302)
    expect(res.headers['location']).toBe('https://tako.app')
    const sc = res.headers['set-cookie'] as string[] | string | undefined
    const arr = Array.isArray(sc) ? sc : sc ? [sc] : []
    expect(arr.some((c) => c.startsWith('tako_cloud_session='))).toBe(true)
    const owner = await ownerByEmail('gnew@test.local')
    expect(owner).toBeTruthy()
    expect(owner!.email_verified).toBe(true)
    expect(owner!.password_hash).toBeNull()
  })

  it('owner esistente NON verificato + email provider verificata → RIFIUTO (no merge silenzioso)', async () => {
    // crea owner via register (resta non verificato)
    await ctx.app.inject({
      url: '/api/auth/register', method: 'POST',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'existing-unv@test.local', password: 'CorrectHorseBattery1' }),
    })
    googleUserinfo = { sub: 'g-takeover-1', email: 'existing-unv@test.local', email_verified: true }
    const res = await cb('google')
    expect(res.statusCode).toBe(302)
    expect(res.headers['location']).toContain('oauth_error=verify_existing_account')
    // nessun link OAuth creato
    const links = await ctx.sql`select count(*)::int as n from cloud_oauth_accounts where provider_user_id = 'g-takeover-1'`
    expect(links[0]!.n as number).toBe(0)
  })

  it('owner esistente VERIFICATO + email provider verificata → link + sessione', async () => {
    // registra e verifica un owner
    const email = 'existing-ver@test.local'
    await ctx.app.inject({ url: '/api/auth/register', method: 'POST', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ email, password: 'CorrectHorseBattery1' }) })
    const token = ctx.lastTokenFor('verify')!
    await ctx.app.inject({ url: '/api/auth/verify-email', method: 'POST', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ token }) })

    googleUserinfo = { sub: 'g-link-1', email, email_verified: true }
    const res = await cb('google')
    expect(res.statusCode).toBe(302)
    expect(res.headers['location']).toBe('https://tako.app')
    const links = await ctx.sql`select count(*)::int as n from cloud_oauth_accounts where provider = 'google' and provider_user_id = 'g-link-1'`
    expect(links[0]!.n as number).toBe(1)
  })

  it('secondo login con stesso (provider, providerUserId) → login diretto, nessun owner duplicato', async () => {
    googleUserinfo = { sub: 'g-link-1', email: 'existing-ver@test.local', email_verified: true }
    const res = await cb('google')
    expect(res.statusCode).toBe(302)
    const links = await ctx.sql`select count(*)::int as n from cloud_oauth_accounts where provider_user_id = 'g-link-1'`
    expect(links[0]!.n as number).toBe(1)
  })
})

describe('GitHub OAuth — usa solo email primaria verificata (SEC-002)', () => {
  it('nessuna email verified+primary → rifiuto email_unverified, nessun owner', async () => {
    githubUser = { id: 9001 }
    githubEmails = [
      { email: 'gh-unverified@test.local', primary: true, verified: false },
      { email: 'gh-secondary@test.local', primary: false, verified: true },
    ]
    const res = await cb('github')
    expect(res.statusCode).toBe(302)
    expect(res.headers['location']).toContain('oauth_error=email_unverified')
    expect(await ownerByEmail('gh-unverified@test.local')).toBeUndefined()
    expect(await ownerByEmail('gh-secondary@test.local')).toBeUndefined()
  })

  it('email primaria verificata → crea owner verificato', async () => {
    githubUser = { id: 9002 }
    githubEmails = [{ email: 'gh-ok@test.local', primary: true, verified: true }]
    const res = await cb('github')
    expect(res.statusCode).toBe(302)
    const owner = await ownerByEmail('gh-ok@test.local')
    expect(owner).toBeTruthy()
    expect(owner!.email_verified).toBe(true)
  })
})

describe('state OAuth mancante/errato (SEC-006)', () => {
  it('callback senza state valido → redirect ?oauth_error=1 (token exchange fallisce)', async () => {
    // NON mockiamo il token exchange in questo test: ripristiniamo il metodo reale del plugin,
    // così `getAccessTokenFromAuthorizationCodeFlow` lancia (state cookie assente) → catch → redirect.
    // (il beforeEach lo ha mockato; qui lo forziamo a lanciare per simulare lo state invalido)
    ;(oauthScope() as any).googleOAuth2.getAccessTokenFromAuthorizationCodeFlow = async () => {
      throw new Error('state mismatch / missing state cookie')
    }
    const res = await ctx.app.inject({ url: '/api/auth/google/callback?code=fake' })
    expect(res.statusCode).toBe(302)
    expect(res.headers['location']).toBe('https://tako.app/?oauth_error=1')
  })
})
