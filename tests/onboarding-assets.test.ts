import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
vi.mock('../packages/db/src/index.ts', () => ({ db: {} }))
import { stageOnboardingImage, readOnboardingAsset, generateOnboardingHero } from '../apps/server/src/lib/onboarding-assets.js'
const req = createRequire(resolve('apps/server/package.json')), { PgDialect } = req('drizzle-orm/pg-core'), dialect = new PgDialect()
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64')
const id = '11111111-1111-4111-8111-111111111111'
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('onboarding staged media', () => {
  it('stores only token hash and validated pixels under a locked open session', async () => {
    const queries: any[] = [], tx = { execute: vi.fn(async (q: any) => { const v = dialect.sqlToQuery(q); queries.push(v); if (v.sql.includes('SELECT s.id')) return [{ id }]; if (v.sql.includes('count(*)')) return [{ total: 0 }]; return [] }) }
    const connection = { transaction: async (fn: any) => fn(tx) }
    const url = await stageOnboardingImage(id, png, 'image/png', connection as any), token = url.split('/').at(-1)!
    expect(token).toMatch(/^[a-f0-9]{64}$/)
    expect(queries[0].sql).toContain('FOR UPDATE OF s')
    expect(queries[0].sql).toContain("s.state IN('collecting','review')")
    const insert = queries.at(-1)
    expect(insert.params).not.toContain(token)
    expect(insert.params).toContain(png.toString('base64'))
  })
  it('rejects inactive sessions and session quota exhaustion', async () => {
    const tx = { execute: vi.fn().mockResolvedValueOnce([]) }, connection = { transaction: async (fn: any) => fn(tx) }
    await expect(stageOnboardingImage(id, png, 'image/png', connection as any)).rejects.toThrow('non disponibile')
    tx.execute.mockResolvedValueOnce([{ id }]).mockResolvedValueOnce([{ total: 20 }])
    await expect(stageOnboardingImage(id, png, 'image/png', connection as any)).rejects.toThrow('20 immagini')
  })
  it('rejects mismatched MIME and non-static content without database writes', async () => {
    const connection = { transaction: vi.fn() }
    await expect(stageOnboardingImage(id, png, 'image/jpeg', connection as any)).rejects.toThrow()
    await expect(stageOnboardingImage(id, Buffer.from('<svg/>'), 'image/svg+xml', connection as any)).rejects.toThrow()
    await expect(stageOnboardingImage(id, Buffer.from('GIF89a'), 'image/gif', connection as any)).rejects.toThrow()
    expect(connection.transaction).not.toHaveBeenCalled()
  })
  it('reads only current draft assets within 48h or stable activated assets, never cancelled', async () => {
    const execute = vi.fn().mockResolvedValue([{ bytes_base64: png.toString('base64'), mime: 'image/png' }])
    expect(await readOnboardingAsset('a'.repeat(64), { execute } as any)).toEqual({ bytes: png, mime: 'image/png' })
    const query = dialect.sqlToQuery(execute.mock.calls[0]![0]).sql
    expect(query).toContain("s.state='activated'")
    expect(query).toContain("s.state IN('collecting','review')")
    expect(query).toContain("interval '48 hours'")
    expect(await readOnboardingAsset('bad', { execute } as any)).toBeNull()
    expect(execute).toHaveBeenCalledOnce()
  })
  it('fails closed on corrupt stored assets', async () => {
    const execute = vi.fn().mockResolvedValue([{ bytes_base64: 'garbage', mime: 'image/png' }])
    expect(await readOnboardingAsset('a'.repeat(64), { execute } as any)).toBeNull()
  })
  it('does not claim hero generation if provider key is absent', async () => {
    vi.stubEnv('GEMINI_API_KEY', ''); expect(await generateOnboardingHero('Victoria', ['Pasta'], '#123abc')).toBeNull()
  })
  it('requests landscape hero with empty central logo area and validates returned asset', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] })); vi.stubGlobal('fetch', fetcher)
    expect(await generateOnboardingHero('Victoria', ['Pasta'], '#123abc', 'secret')).toEqual({ bytes: png, mime: 'image/png' })
    const body = JSON.parse(fetcher.mock.calls[0]![1].body)
    expect(body.generationConfig.imageConfig.aspectRatio).toBe('16:9')
    expect(body.contents[0].parts[0].text).toContain('central 45% empty')
  })
  it('provider errors expose neither keys nor fake asset URLs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret')))
    await expect(generateOnboardingHero('Victoria', [], '#123abc', 'secret')).rejects.toThrow('nessun asset')
  })
})
