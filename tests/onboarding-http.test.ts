import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from '../apps/server/node_modules/fastify/fastify.js'
const mocks = vi.hoisted(() => ({ execute: vi.fn(), transaction: vi.fn(), approve: vi.fn(), hash: vi.fn((s: string) => 'hashed:' + s), bcrypt: vi.fn().mockResolvedValue('hashed-password') }))
vi.mock('../packages/db/src/index.ts', () => ({ db: { execute: mocks.execute, transaction: mocks.transaction } }))
vi.mock('../apps/server/src/middleware/auth.js', () => ({ requireAuth: async (req: any, reply: any) => { if (!req.headers['x-test-user']) return reply.code(401).send({ error: { message: 'Auth required' } }); req.user = { id: String(req.headers['x-test-user']) } } }))
vi.mock('../apps/server/src/lib/agency-access.js', () => ({ isAgencyUser: (id: string) => id === 'agency' }))
vi.mock('../apps/server/src/lib/onboarding-chat.js', () => ({ onboardingHash: mocks.hash, onboardingToken: vi.fn().mockResolvedValue('https://example.com/token'), reservedOnboardingSlug: () => false }))
vi.mock('../apps/server/src/lib/onboarding-store.js', () => ({ getOnboarding: vi.fn(), listOnboarding: vi.fn().mockResolvedValue([]), updateOnboarding: vi.fn(), approveOnboarding: mocks.approve, cancelOnboarding: vi.fn() }))
vi.mock('../apps/server/src/lib/menu-workspace-qr.js', () => ({ renderDigitalQr: vi.fn().mockResolvedValue(Buffer.from('PNG')) }))
vi.mock('bcryptjs', () => ({ default: { hash: mocks.bcrypt } }))
import { onboardingRoutes, onboardingSessionByToken } from '../apps/server/src/routes/onboarding.js'
const token = 'a'.repeat(64), tenant = 'a1111111-1111-4111-8111-111111111111'
const session = { id: 'b1111111-1111-4111-8111-111111111111', actorId: 'agency', state: 'activated', restaurantId: tenant, data: { name: 'Victoria', ownerName: 'Marco', ownerEmail: 'marco@example.com', ownerPhone: '+393331112222', workspace: {}, warnings: [], unresolved: [] } }
let app: ReturnType<typeof Fastify>
beforeEach(async () => { vi.clearAllMocks(); mocks.execute.mockReset(); mocks.transaction.mockReset(); app = Fastify(); await onboardingRoutes(app as any) })
afterEach(async () => { await app.close() })
const payload = (password = 'sufficient-password') => ({ name: 'Marco', email: 'marco@example.com', password })
function sqlText(query: any): string { return (query?.queryChunks ?? []).map((c: any) => typeof c === 'string' ? c : Array.isArray(c?.value) ? c.value.join('') : c?.queryChunks ? sqlText(c) : '?').join('') }
describe('onboarding HTTP boundaries', () => {
  it('denies pairing to anonymous and non-agency users', async () => {
    expect((await app.inject({ method: 'POST', url: '/agency/onboarding/pair' })).statusCode).toBe(401)
    expect((await app.inject({ method: 'POST', url: '/agency/onboarding/pair', headers: { 'x-test-user': 'owner' } })).statusCode).toBe(403)
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it('issues short-lived pairing only for authenticated agency', async () => {
    mocks.execute.mockResolvedValue([])
    const response = await app.inject({ method: 'POST', url: '/agency/onboarding/pair', headers: { 'x-test-user': 'agency' } })
    expect(response.statusCode).toBe(200)
    expect(response.json().data.expiresIn).toBe(300)
    expect(response.json().data.message).toMatch(/^collega agenzia [a-f0-9]{64}$/)
    expect(mocks.execute).toHaveBeenCalledTimes(2)
  })
  it('does not query tokens for invalid formats, and rejects non-agency sessions', async () => {
    expect(await onboardingSessionByToken('bad', 'preview')).toBeNull()
    expect(mocks.execute).not.toHaveBeenCalled()
    mocks.execute.mockResolvedValue([{ ...session, actorId: 'owner' }])
    expect(await onboardingSessionByToken(token, 'claim')).toBeNull()
  })
  it('requires unused, unexpired token and active agency in token query', async () => {
    mocks.execute.mockResolvedValue([session])
    expect(await onboardingSessionByToken(token, 'preview')).toEqual(session)
    const query = sqlText(mocks.execute.mock.calls[0]![0])
    expect(query).toContain('t.expires_at>now()')
    expect(query).toContain('t.used_at IS NULL')
    expect(query).toContain('u.active=true')
    expect(query).toContain("s.state IN('collecting','review') AND s.expires_at>now()")
  })
  it('marks private preview and failed claims non-cacheable and non-indexable', async () => {
    mocks.execute.mockResolvedValue([])
    for (const url of [`/onboarding/preview/${token}`, `/onboarding/claim/${token}`]) {
      const response = await app.inject({ url })
      expect(response.statusCode).toBe(404)
      expect(response.headers['cache-control']).toBe('no-store')
      expect(response.headers['x-robots-tag']).toContain('noindex')
      expect(response.headers['referrer-policy']).toBe('no-referrer')
    }
  })
  it('preview does not disclose owner contact or token hash', async () => {
    mocks.execute.mockResolvedValue([{ ...session, previewTokenHash: 'private' }])
    const response = await app.inject({ url: `/onboarding/preview/${token}` })
    expect(response.statusCode).toBe(200)
    expect(JSON.stringify(response.json())).not.toContain('marco@example.com')
    expect(response.json().data).not.toHaveProperty('previewTokenHash')
  })
  it.each(['short', 'a'.repeat(73), '🦑'.repeat(19)])('rejects passwords outside min characters / bcrypt byte limit', async password => {
    const response = await app.inject({ method: 'POST', url: `/onboarding/claim/${token}`, payload: payload(password) })
    expect(response.statusCode).toBe(400)
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(mocks.bcrypt).not.toHaveBeenCalled()
  })
  it('does not allow changing invitation email or claiming inactive sessions', async () => {
    mocks.execute.mockResolvedValue([session])
    const wrongEmail = await app.inject({ method: 'POST', url: `/onboarding/claim/${token}`, payload: { ...payload(), email: 'attacker@example.com' } })
    expect(wrongEmail.statusCode).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
    mocks.execute.mockResolvedValue([{ ...session, state: 'review' }])
    expect((await app.inject({ method: 'POST', url: `/onboarding/claim/${token}`, payload: payload() })).statusCode).toBe(404)
  })
  it.each(['replayed', 'email', 'phone'])('blocks claim takeover scenario: %s', async scenario => {
    mocks.execute.mockResolvedValue([session])
    const tx = { execute: vi.fn(async (q: any) => {
      const query = sqlText(q)
      if (query.includes('SELECT token_hash')) return scenario === 'replayed' ? [] : [{ token_hash: 'h' }]
      if (query.includes('SELECT state,restaurant_id')) return [{ state: 'activated', restaurant_id: tenant }]
      if (query.includes('SELECT id,restaurant_id,role,active FROM users')) return scenario === 'email' ? [{ id: 'existing-owner' }] : []
      if (query.includes('SELECT restaurant_id,actor_id FROM tako_whatsapp_links')) return scenario === 'phone' ? [{ restaurant_id: 'other-tenant' }] : []
      return []
    }) }
    mocks.transaction.mockImplementation(async fn => fn(tx))
    const response = await app.inject({ method: 'POST', url: `/onboarding/claim/${token}`, payload: payload() })
    expect(response.statusCode).toBe(409)
    expect(tx.execute.mock.calls.some(([q]) => sqlText(q).includes('INSERT INTO users'))).toBe(false)
  })
  it('successful owner creation does not automatically verify email or activate WhatsApp', async () => {
    mocks.execute.mockResolvedValue([session]); const queries: string[] = []
    const tx = { execute: vi.fn(async (q: any) => { const query = sqlText(q); queries.push(query); if (query.includes('SELECT token_hash')) return [{ token_hash: 'h' }]; if (query.includes('SELECT state,restaurant_id')) return [{ state: 'activated', restaurant_id: tenant }]; return [] }) }
    mocks.transaction.mockImplementation(async fn => fn(tx))
    const response = await app.inject({ method: 'POST', url: `/onboarding/claim/${token}`, payload: payload() })
    expect(response.statusCode).toBe(200)
    expect(queries.find(q => q.includes('INSERT INTO users'))).toContain('true,false')
    expect(queries.find(q => q.includes('INSERT INTO tako_whatsapp_links'))).toContain('NULL')
    expect(queries.find(q => q.includes('UPDATE tako_onboarding_tokens'))).toContain("kind='claim'")
  })
  it('QR only queries activated and published active restaurant', async () => {
    mocks.execute.mockResolvedValue([])
    expect((await app.inject({ url: `/onboarding/qr/${tenant}` })).statusCode).toBe(404)
    const query = sqlText(mocks.execute.mock.calls[0]![0])
    expect(query).toContain("s.state='activated'")
    expect(query).toContain('w.published IS NOT NULL')
    expect(query).toContain('r.active=true')
  })
  it('passes exact expected revision to approval and reports stale revision conflict', async () => {
    mocks.approve.mockRejectedValue(new Error('Approva la versione corrente'))
    const response = await app.inject({ method: 'POST', url: `/agency/onboarding/${session.id}/approve`, headers: { 'x-test-user': 'agency' }, payload: { expectedRevision: 7 } })
    expect(response.statusCode).toBe(409)
    expect(mocks.approve).toHaveBeenCalledWith(session.id, 'agency', 7)
  })
})
