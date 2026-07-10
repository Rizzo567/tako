// Newsletter opt-in (decisione 2026-07-10): la checkbox alla registrazione salva
// cloud_owners.newsletter_opt_in; l'iscrizione alla Resend Audience parte SOLO alla
// verifica email (double opt-in) ed è best-effort (env assenti → skip, mai errore).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupCloud, type CloudTestCtx } from './helpers'

let ctx: CloudTestCtx

beforeAll(async () => { ctx = await setupCloud({ cookieMode: 'samesite' }) }, 60000)
afterAll(async () => { await ctx?.close() })

const PW = 'CorrectHorseBattery1'

function body(o: unknown) {
  return { method: 'POST' as const, headers: { 'content-type': 'application/json' }, payload: JSON.stringify(o) }
}

async function optIn(email: string): Promise<boolean | undefined> {
  const rows = await ctx.sql`select newsletter_opt_in from cloud_owners where email = ${email}`
  return rows[0]?.['newsletter_opt_in'] as boolean | undefined
}

describe('newsletter opt-in alla registrazione', () => {
  it('register con newsletter:true salva newsletter_opt_in=true', async () => {
    const email = 'news-si@test.local'
    const res = await ctx.app.inject({ url: '/api/auth/register', ...body({ email, password: PW, name: 'Mario', newsletter: true }) })
    expect(res.statusCode).toBe(200)
    expect(await optIn(email)).toBe(true)
  })

  it('register senza newsletter salva false (default)', async () => {
    const email = 'news-no@test.local'
    const res = await ctx.app.inject({ url: '/api/auth/register', ...body({ email, password: PW }) })
    expect(res.statusCode).toBe(200)
    expect(await optIn(email)).toBe(false)
  })

  it('ri-register non verificato con newsletter:true registra l\'opt-in (senza rivelare l\'esistenza)', async () => {
    const email = 'news-no@test.local' // creato sopra con false, non verificato
    const res = await ctx.app.inject({ url: '/api/auth/register', ...body({ email, password: PW, newsletter: true }) })
    expect(res.statusCode).toBe(200) // sempre generico anti-enumeration
    expect(await optIn(email)).toBe(true)
  })

  it('verify-email con opt-in e env Resend ASSENTI → verifica ok comunque (subscribe best-effort saltata)', async () => {
    delete process.env['RESEND_AUDIENCE_ID'] // garantisce il ramo "non configurato"
    const email = 'news-verify@test.local'
    await ctx.app.inject({ url: '/api/auth/register', ...body({ email, password: PW, newsletter: true }) })
    const token = ctx.lastTokenFor('verify', email)
    expect(token).toBeTruthy()
    const res = await ctx.app.inject({ url: '/api/auth/verify-email', ...body({ token }) })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.verified).toBe(true)
    const rows = await ctx.sql`select email_verified from cloud_owners where email = ${email}`
    expect(rows[0]?.['email_verified']).toBe(true)
  })
})
