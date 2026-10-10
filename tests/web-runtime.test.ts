import { createRequire } from 'node:module'
const Fastify = createRequire(new URL('../apps/server/package.json', import.meta.url))('fastify')
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isWebMode, validateWebRuntime, webOrigin, webRequestAllowed, registerAppliancePlugin, webUnavailable, webServerHost, webSocketOrigin } from '../apps/server/src/lib/web-runtime'
import { authCookieOptions } from '../apps/server/src/lib/cookies'
import { clientBaseUrl, lanBaseUrl, stableTableUrl, tableQrUrl, remoteBaseUrl } from '../apps/server/src/lib/network'

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
  it('generates direct HTTPS links without LAN IP, mDNS or appliance resolver', () => {
    vi.stubEnv('TAKO_MODE', 'web')
    vi.stubEnv('WEB_ORIGIN', valid.WEB_ORIGIN)
    vi.stubEnv('CLIENT_BASE_URL', 'http://192.168.1.5:3002')
    expect(clientBaseUrl()).toBe(valid.WEB_ORIGIN)
    expect(lanBaseUrl()).toBe(valid.WEB_ORIGIN)
    expect(remoteBaseUrl()).toBe(valid.WEB_ORIGIN)
    const expected = valid.WEB_ORIGIN + '/r/restaurant/t/token'
    expect(stableTableUrl('appliance', 'restaurant', 'token')).toBe(expected)
    expect(tableQrUrl('lan', 'appliance', 'restaurant', 'token')).toBe(expected)
    expect(tableQrUrl('cloud', null, 'restaurant', 'token')).toBe(expected)
  })
})


describe('real Fastify appliance policy (no database/network)', () => {
  it('does not install local printer/WhatsApp plugins, including encoded routes', async () => {
    vi.stubEnv('TAKO_MODE', 'web')
    const server = Fastify()
    const called = vi.fn()
    const localPlugin = async (f: typeof server) => {
      called()
      f.post('/enable', async () => ({ reached: true }))
    }
    await registerAppliancePlugin(server, localPlugin, '/api/whatsapp')
    await registerAppliancePlugin(server, localPlugin, '/api/print')
    for (const url of ['/api/whatsapp/enable', '/api/%77hatsapp/enable', '/api/print/enable', '/api/%70rint/enable']) {
      const response = await server.inject({ method: 'POST', url })
      expect(response.statusCode).toBe(404)
    }
    expect(called).not.toHaveBeenCalled()
    await server.close()
  })
  it('rejects PIN/shutdown inside matched handler regardless of URL spelling', async () => {
    vi.stubEnv('TAKO_MODE', 'web')
    const server = Fastify()
    const dangerousAction = vi.fn()
    server.post('/api/auth/pin-login', async (_req, reply) => {
      if (isWebMode()) return webUnavailable(reply)
      dangerousAction()
    })
    server.post('/internal/shutdown', async (_req, reply) => {
      if (isWebMode()) return webUnavailable(reply)
      dangerousAction()
    })
    for (const url of ['/api/auth/pin-login', '/api/auth/%70in-login', '/internal/shutdown', '/%69nternal/shutdown']) {
      const response = await server.inject({ method: 'POST', url })
      expect(response.statusCode).toBe(404)
      expect(response.json().error.code).toBe('NOT_AVAILABLE_WEB')
    }
    expect(dangerousAction).not.toHaveBeenCalled()
    await server.close()
  })
  it('keeps appliance plugins mounted in local mode', async () => {
    vi.stubEnv('TAKO_MODE', 'local')
    const server = Fastify()
    await registerAppliancePlugin(server, async f => { f.post('/enable', async () => ({ reached: true })) }, '/api/print')
    expect((await server.inject({ method: 'POST', url: '/api/print/enable' })).statusCode).toBe(200)
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
