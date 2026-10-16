import { createRequire } from 'node:module'
const Fastify = createRequire(new URL('../apps/server/package.json', import.meta.url))('fastify')
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isWebMode, validateWebRuntime, webOrigin, webRequestAllowed, webBoundary, webServerHost, webSocketOrigin } from '../apps/server/src/lib/web-runtime'
import { authCookieOptions } from '../apps/server/src/lib/cookies'

const valid = {
  TAKO_MODE: 'web', WEB_ORIGIN: 'https://tako.example.com',
  DATABASE_URL: 'postgresql://tako:password@db.example.com/tako?sslmode=require',
  JWT_SECRET: '39a7db31068f85c659f7f8d910d39a4c08d4',
  UPLOADS_DIR: '/data/uploads', TRUST_PROXY: '172.30.87.0/24',
}
afterEach(() => vi.unstubAllEnvs())
describe('hosted operational mode', () => {
  it('is distinct from legacy local and cloud modes', () => {
    expect(isWebMode({})).toBe(false)
    expect(isWebMode({ TAKO_MODE: 'cloud' })).toBe(false)
    expect(isWebMode(valid)).toBe(true)
    expect(() => validateWebRuntime({ TAKO_MODE: 'local' })).not.toThrow()
  })
  it('accepts explicit managed runtime configuration', () => {
    expect(() => validateWebRuntime(valid)).not.toThrow()
    expect(webOrigin(valid)).toBe('https://tako.example.com')
  })
  it.each([
    { DATABASE_URL: '' }, { DATABASE_URL: 'postgresql://x:y@localhost/tako' },
    { JWT_SECRET: '' }, { JWT_SECRET: 'a'.repeat(48) },
    { JWT_SECRET: 'change-me'.repeat(6) }, { UPLOADS_DIR: './uploads' },
    { TRUST_PROXY: '' }, { EMBEDDED_DB: '1' }, { TAKO_HTTPS: '1' },
    { WEB_ORIGIN: 'http://tako.example.com' },
    { WEB_ORIGIN: 'https://tako.example.com/path' },
    { WEB_ORIGIN: 'https://user:password@tako.example.com' },
  ])('fails closed on incomplete or appliance configuration %j', override => {
    expect(() => validateWebRuntime({ ...valid, ...override })).toThrow()
  })
  it('rejects browser cross-origin reads and writes and originless writes', () => {
    const origin = valid.WEB_ORIGIN
    expect(webRequestAllowed('POST', origin, origin)).toBe(true)
    expect(webRequestAllowed('POST', undefined, origin)).toBe(false)
    expect(webRequestAllowed('DELETE', 'https://evil.example.com', origin)).toBe(false)
    expect(webRequestAllowed('GET', 'https://evil.example.com', origin)).toBe(false)
    expect(webRequestAllowed('GET', undefined, origin)).toBe(true)
  })
  it('uses Secure HttpOnly cookies regardless of legacy COOKIE_SECURE', () => {
    vi.stubEnv('TAKO_MODE', 'web')
    vi.stubEnv('COOKIE_SECURE', '0')
    vi.stubEnv('WEB_ORIGIN', valid.WEB_ORIGIN)
    expect(authCookieOptions(3600)).toMatchObject({ secure: true, httpOnly: true, sameSite: 'lax' })
  })
})


describe('real Fastify web boundary (no database/network)', () => {
  const origin = 'https://tako.example.com'
  async function boundaryServer() {
    const server = Fastify()
    server.addHook('onRequest', webBoundary(origin))
    // The appliance handlers no longer exist: only the boundary answers for them.
    server.post('/api/orders', async () => ({ ok: true }))
    return { server }
  }
  it('answers former appliance endpoints with NOT_AVAILABLE_WEB, including encoded spellings', async () => {
    const { server } = await boundaryServer()
    for (const url of ['/api/whatsapp/enable', '/api/print/enable', '/api/auth/pin-login', '/internal/shutdown', '/api/setup/pair']) {
      const response = await server.inject({ method: 'POST', url, headers: { origin } })
      expect(response.statusCode).toBe(404)
      expect(response.json().error.code).toBe('NOT_AVAILABLE_WEB')
    }
    for (const url of ['/api/%77hatsapp/enable', '/api/%70rint/enable', '/api/auth/%70in-login', '/%69nternal/shutdown']) {
      expect((await server.inject({ method: 'POST', url, headers: { origin } })).statusCode).toBe(404)
    }
    await server.close()
  })
  it('removes modules while preserving live room status and waiter resolution', async () => {
    const { server } = await boundaryServer()
    server.get('/api/tables/rooms', async () => ({ok:true}))
    server.patch('/api/tables/t1/status', async () => ({ok:true}))
    server.post('/api/tables/t1/waiter-resolve', async () => ({ok:true}))
    server.post('/api/tables', async () => ({ok:true}))
    server.get('/api/tables/t1/qr', async () => ({ok:true}))
    for (const url of ['/api/bills','/api/inventory','/api/shifts','/api/devices','/api/insights/menu','/api/ai/owner/chat/stream','/api/customer/takeaway/r1/session','/api/tables','/api/%74ables']) {
      expect((await server.inject({method:'POST',url,headers:{origin}})).statusCode).toBe(404)
    }
    expect((await server.inject({method:'GET',url:'/api/tables/t1/qr'})).statusCode).toBe(404)
    expect((await server.inject({method:'GET',url:'/api/tables/rooms'})).statusCode).toBe(200)
    expect((await server.inject({method:'PATCH',url:'/api/tables/t1/status',headers:{origin}})).statusCode).toBe(200)
    expect((await server.inject({method:'POST',url:'/api/tables/t1/waiter-resolve',headers:{origin}})).statusCode).toBe(200)
    await server.close()
  })
  it('rejects writes from foreign or missing origins and accepts the public origin', async () => {
    const { server } = await boundaryServer()
    expect((await server.inject({ method: 'POST', url: '/api/orders', headers: { origin: 'https://evil.example.com' } })).json().error.code).toBe('ORIGIN_REJECTED')
    expect((await server.inject({ method: 'POST', url: '/api/orders' })).statusCode).toBe(403)
    expect((await server.inject({ method: 'POST', url: '/api/orders', headers: { origin } })).statusCode).toBe(200)
    await server.close()
  })
})


describe('development-only loopback browser access', () => {
  const development = { ...valid, NODE_ENV: 'development', WEB_ORIGIN: 'http://127.0.0.1:5137', TRUST_PROXY: '' }
  it.each(['http://127.0.0.1:5137', 'http://localhost:5137'])('accepts %s only in development without a TLS proxy', origin => {
    expect(() => validateWebRuntime({ ...development, WEB_ORIGIN: origin })).not.toThrow()
    expect(webServerHost({ ...development, WEB_ORIGIN: origin })).toBe('127.0.0.1')
    expect(webSocketOrigin({ ...development, WEB_ORIGIN: origin })).toBe(origin.replace('http:', 'ws:'))
  })
  it.each(['production', 'test', undefined])('rejects loopback HTTP when NODE_ENV=%s', NODE_ENV => {
    expect(() => validateWebRuntime({ ...development, NODE_ENV })).toThrow()
  })
  it.each(['http://192.168.1.10:5137', 'http://0.0.0.0:5137', 'http://example.com:5137', 'http://localhost.evil.example:5137', 'http://[::1]:5137'])('rejects non-authorized HTTP origin %s even in development', WEB_ORIGIN => {
    expect(() => validateWebRuntime({ ...development, WEB_ORIGIN })).toThrow()
  })
  it.each(['0.0.0.0', '192.168.1.10', '::'])('rejects public API binding %s for loopback development', SERVER_HOST => {
    expect(() => validateWebRuntime({ ...development, SERVER_HOST })).toThrow()
  })
  it('uses plain HTTP cookies only for validated local development', () => {
    vi.stubEnv('TAKO_MODE', 'web')
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('WEB_ORIGIN', development.WEB_ORIGIN)
    vi.stubEnv('COOKIE_SECURE', '1')
    expect(authCookieOptions(3600)).toMatchObject({ secure: false, httpOnly: true, sameSite: 'lax', path: '/' })
  })
  it('keeps production HTTPS cookies and secure realtime', () => {
    vi.stubEnv('TAKO_MODE', 'web')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('WEB_ORIGIN', valid.WEB_ORIGIN)
    expect(authCookieOptions(3600).secure).toBe(true)
    expect(webSocketOrigin()).toBe('wss://tako.example.com')
    expect(webServerHost()).toBe('0.0.0.0')
  })
  it('does not relax production managed database or secret requirements', () => {
    expect(() => validateWebRuntime({ ...development, DATABASE_URL: 'postgres://x:y@localhost/tako' })).toThrow()
    expect(() => validateWebRuntime({ ...development, EMBEDDED_DB: '1' })).toThrow()
    expect(() => validateWebRuntime({ ...development, JWT_SECRET: 'weak' })).toThrow()
  })
})
