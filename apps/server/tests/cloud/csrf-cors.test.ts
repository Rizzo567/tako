// FASE 5c — CSRF (modo crosssite) + CORS allowlist (§10 / SEC-004 / SEC-018).
// In COOKIE_MODE=crosssite il login emette anche il cookie double-submit tako_cloud_csrf;
// i POST a sessione (es. /logout, /pair/code) richiedono l'header X-Tako-CSRF == cookie.
// CORS: solo gli origin in ALLOWED_ORIGINS ricevono Access-Control-Allow-Origin; un
// *.pages.dev arbitrario è bloccato (nessun header CORS riflesso).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupCloud, cookieFromSetCookie, type CloudTestCtx } from './helpers'

let ctx: CloudTestCtx

beforeAll(async () => {
  ctx = await setupCloud({ cookieMode: 'crosssite', allowedOrigins: 'https://tako.app,https://www.tako.app' })
}, 60000)
afterAll(async () => { await ctx?.close() })

const PW = 'CorrectHorseBattery1'
function body(o: unknown) {
  return { method: 'POST' as const, headers: { 'content-type': 'application/json' }, payload: JSON.stringify(o) }
}

async function loggedIn(email: string): Promise<{ session: string; csrf: string }> {
  await ctx.app.inject({ url: '/api/auth/register', ...body({ email, password: PW }) })
  const token = ctx.lastTokenFor('verify')!
  await ctx.app.inject({ url: '/api/auth/verify-email', ...body({ token }) })
  const login = await ctx.app.inject({ url: '/api/auth/login', ...body({ email, password: PW }) })
  const sc = login.headers['set-cookie'] as string[]
  const arr = Array.isArray(sc) ? sc : [sc]
  return {
    session: cookieFromSetCookie(arr, 'tako_cloud_session')!,
    csrf: cookieFromSetCookie(arr, 'tako_cloud_csrf')!,
  }
}

describe('CSRF double-submit (crosssite)', () => {
  it('login in crosssite emette ANCHE il cookie tako_cloud_csrf (non HttpOnly)', async () => {
    const s = await loggedIn('csrf-1@test.local')
    expect(s.csrf).toBeTruthy()
  })

  it('POST /logout senza header X-Tako-CSRF → 403 CSRF', async () => {
    const s = await loggedIn('csrf-2@test.local')
    const res = await ctx.app.inject({
      url: '/api/auth/logout', method: 'POST',
      headers: { cookie: `tako_cloud_session=${s.session}; tako_cloud_csrf=${s.csrf}` },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('CSRF')
  })

  it('POST /logout con header X-Tako-CSRF errato → 403 CSRF', async () => {
    const s = await loggedIn('csrf-3@test.local')
    const res = await ctx.app.inject({
      url: '/api/auth/logout', method: 'POST',
      headers: { cookie: `tako_cloud_session=${s.session}; tako_cloud_csrf=${s.csrf}`, 'x-tako-csrf': 'valore-sbagliato' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('CSRF')
  })

  it('POST /logout con header X-Tako-CSRF corretto → 200', async () => {
    const s = await loggedIn('csrf-4@test.local')
    const res = await ctx.app.inject({
      url: '/api/auth/logout', method: 'POST',
      headers: { cookie: `tako_cloud_session=${s.session}; tako_cloud_csrf=${s.csrf}`, 'x-tako-csrf': s.csrf },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.success).toBe(true)
  })

  it('POST /pair/code senza X-Tako-CSRF → 403 (CSRF prima della logica)', async () => {
    const s = await loggedIn('csrf-pair@test.local')
    const res = await ctx.app.inject({
      url: '/api/pair/code', method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `tako_cloud_session=${s.session}; tako_cloud_csrf=${s.csrf}` },
      payload: JSON.stringify({ restaurantId: '00000000-0000-0000-0000-000000000000' }),
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('CSRF')
  })
})

describe('CORS allowlist esatta (SEC-004/018)', () => {
  it('origin in allowlist → header Access-Control-Allow-Origin riflesso', async () => {
    const res = await ctx.app.inject({
      url: '/api/auth/login', method: 'OPTIONS',
      headers: {
        origin: 'https://tako.app',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    })
    expect(res.headers['access-control-allow-origin']).toBe('https://tako.app')
    expect(res.headers['access-control-allow-credentials']).toBe('true')
  })

  it('origin *.pages.dev arbitrario → nessun Access-Control-Allow-Origin', async () => {
    const res = await ctx.app.inject({
      url: '/api/auth/login', method: 'OPTIONS',
      headers: {
        origin: 'https://attacker.pages.dev',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    })
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('origin fuori allowlist (altro dominio) → nessun header CORS riflesso', async () => {
    const res = await ctx.app.inject({
      url: '/api/auth/me', method: 'GET',
      headers: { origin: 'https://evil.example' },
    })
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })
})
