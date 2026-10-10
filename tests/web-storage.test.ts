import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify from '../apps/server/node_modules/fastify'
import { remoteStorageConfig, imageObjectKey, remoteImageUsage, uploadRemoteImage } from '../apps/server/src/lib/remote-image-store'
import { remoteImageRoutes } from '../apps/server/src/routes/remote-images'

const tenant = 'a13f50c9-898e-4394-b3d7-9e2f6f2cbf30'
const filename = 'abcdefghijklmnop.png'
beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://tako-test.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-server-only-key-that-is-long-enough')
  vi.stubEnv('SUPABASE_STORAGE_BUCKET', 'tako-menu-images')
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('durable tenant-prefixed image storage', () => {
  it('rejects external credential destinations and path traversal before any fetch', () => {
    expect(() => remoteStorageConfig({ SUPABASE_URL: 'https://attacker.example' })).toThrow()
    expect(() => imageObjectKey('../other', filename)).toThrow()
    expect(() => imageObjectKey(tenant, '../another.png')).toThrow()
  })
  it('counts persisted objects from only the authenticated tenant prefix', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ metadata: { size: 123 } }, { metadata: { size: 456 } }]), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    expect(await remoteImageUsage(tenant)).toBe(579)
    const [url, options] = fetcher.mock.calls[0]!
    expect(url).toContain('/object/list/tako-menu-images')
    expect(JSON.parse(options.body).prefix).toBe(tenant)
    expect(options.headers.Authorization).toContain('Bearer test-server-only')
  })
  it('fails closed when quota inventory is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })))
    await expect(remoteImageUsage(tenant)).rejects.toThrow('unavailable')
  })
  it('writes under the tenant key without replacing an existing image', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await uploadRemoteImage(tenant, filename, Buffer.from('photo'), 'image/png')
    expect(fetcher.mock.calls[0]![0]).toContain(`/tako-menu-images/${tenant}/${filename}`)
    expect(fetcher.mock.calls[0]![1].headers['x-upsert']).toBe('false')
  })
  it('serves public menu bytes on the app origin without leaking server credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('image-bytes', { status: 200, headers: { 'content-type': 'image/png' } })))
    const app = Fastify()
    await app.register(remoteImageRoutes)
    try {
      const result = await app.inject(`/uploads/${tenant}/${filename}`)
      expect(result.statusCode).toBe(200)
      expect(result.body).toBe('image-bytes')
      expect(JSON.stringify(result.headers)).not.toContain('test-server-only')
      expect(result.headers['x-content-type-options']).toBe('nosniff')
      expect((await app.inject('/uploads/invalid/abcdefghijklmnop.png')).statusCode).toBe(404)
    } finally { await app.close() }
  })
  it('does not serve arbitrary upstream content as an image', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<script>bad</script>', { status: 200, headers: { 'content-type': 'text/html' } })))
    const app = Fastify()
    await app.register(remoteImageRoutes)
    try { expect((await app.inject(`/uploads/${tenant}/${filename}`)).statusCode).toBe(502) }
    finally { await app.close() }
  })
})
