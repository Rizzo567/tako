import { afterEach, describe, expect, it, vi } from 'vitest'
const mocked = vi.hoisted(() => ({ execute: vi.fn(), transaction: vi.fn() }))
vi.mock('@tako/db', () => ({ db: mocked }))
import { encryptEmailPayload, decryptEmailPayload } from '../apps/server/src/lib/transactional-email/crypto.js'
import { retryEmailAt, validateEmailEnvelope, processEmailOutbox, enqueueEmail } from '../apps/server/src/lib/transactional-email/outbox.js'

afterEach(() => vi.unstubAllEnvs())
describe('encrypted email payload', () => {
  it('roundtrips with randomized ciphertext without exposing reset tokens', () => {
    vi.stubEnv('EMAIL_OUTBOX_KEY', Buffer.alloc(32, 7).toString('base64'))
    const payload = { html: 'https://example.com/reset?token=secret-reset-token' }
    const a = encryptEmailPayload(payload, 'reset:1'), b = encryptEmailPayload(payload, 'reset:1')
    expect(a).not.toBe(b); expect(a).not.toContain('secret-reset-token')
    expect(decryptEmailPayload(a, 'reset:1')).toEqual(payload)
    expect(() => decryptEmailPayload(a, 'reset:2')).toThrow()
    const segments = a.split('.'); segments[3] = Buffer.from('tampered').toString('base64')
    expect(() => decryptEmailPayload(segments.join('.'), 'reset:1')).toThrow()
  })
  it('fails closed on absent or malformed key', () => {
    vi.stubEnv('EMAIL_OUTBOX_KEY', '')
    expect(() => encryptEmailPayload({}, 'x')).toThrow()
    vi.stubEnv('EMAIL_OUTBOX_KEY', 'not-a-key')
    expect(() => encryptEmailPayload({}, 'x')).toThrow()
  })
})
describe('delivery safety', () => {
  const envelope = { from: 'Takomenu <noreply@takoitalia.com>', reply_to: 'manuelrizzo474@gmail.com', to: 'qa@example.com', subject: 'Reset', html: '<p>Reset</p>', text: 'Reset' }
  it('preserves sender snapshot and rejects header injection', () => {
    expect(validateEmailEnvelope(envelope)).toEqual(envelope)
    expect(() => validateEmailEnvelope({ ...envelope, subject: 'Reset\r\nBcc: victim@example.com' })).toThrow()
    expect(() => validateEmailEnvelope({ ...envelope, to: 'invalid' })).toThrow()
  })
  it('bounds retries and never crosses idempotency expiry', () => {
    const now = new Date('2026-10-19T10:00:00Z')
    expect(+retryEmailAt(1, new Date(+now + 3600000), now)!).toBe(+now + 30000)
    expect(retryEmailAt(6, new Date(+now + 3600000), now)).toBeNull()
    expect(retryEmailAt(1, new Date(+now + 35000), now)).toBeNull()
  })
})

describe('outbox delivery claims', () => {
  const envelope = { from: 'Takomenu <noreply@takoitalia.com>', reply_to: 'manuelrizzo474@gmail.com', to: 'qa@example.com', subject: 'Notice', html: '<p>Notice</p>', text: 'Notice' }
  function setup(guardValid = true) {
    vi.stubEnv('EMAIL_OUTBOX_KEY', Buffer.alloc(32, 7).toString('base64'))
    const row = { id: 'row-id', user_id: 'user-id', recipient: envelope.to, dedupe_key: 'event:1', attempts: 0, expires_at: new Date(Date.now() + 3600000), encrypted_payload: encryptEmailPayload(envelope, 'event:1') }
    const tx = { execute: vi.fn().mockResolvedValueOnce([row]).mockResolvedValueOnce(guardValid ? [{ id: 'user-id' }] : []).mockResolvedValueOnce([]) }
    mocked.transaction.mockReset().mockImplementation((fn: any) => fn(tx))
    mocked.execute.mockReset().mockResolvedValue([{ id: 'row-id' }])
    return tx
  }
  it('claims before sending; provider sees immutable sender and stable dedupe key', async () => {
    const tx = setup()
    const send = vi.fn().mockResolvedValue({ id: 'provider-id' })
    const outcome = await processEmailOutbox(send, 1, mocked as any)
    expect(outcome).toEqual({ sent: 1, failed: 0, cancelled: 0, retried: 0 })
    expect(send).toHaveBeenCalledWith(envelope, 'event:1')
    expect(tx.execute).toHaveBeenCalledTimes(3)
    expect(mocked.execute).toHaveBeenCalledTimes(1)
  })
  it('never sends a deactivated user notification', async () => {
    setup(false)
    const send = vi.fn()
    expect((await processEmailOutbox(send, 1, mocked as any)).cancelled).toBe(1)
    expect(send).not.toHaveBeenCalled()
  })
  it('does not report success when another claim fenced this worker out', async () => {
    setup(); mocked.execute.mockResolvedValue([])
    const result = await processEmailOutbox(vi.fn().mockResolvedValue({ id: 'p' }), 1, mocked as any)
    expect(result.sent).toBe(0)
  })
  it('retries a provider failure with the same immutable payload', async () => {
    setup()
    const result = await processEmailOutbox(vi.fn().mockRejectedValue(new Error('provider outage')), 1, mocked as any)
    expect(result.retried).toBe(1); expect(result.sent).toBe(0)
  })
  it('refuses invalid expiry before any insert', async () => {
    const executor = { execute: vi.fn() }
    await expect(enqueueEmail(executor as any, { key: 'event:1', userId: 'id', recipient: 'qa@example.com', template: 'password-cambiata', values: {}, expiresAt: new Date(Date.now() + 24 * 3600000) })).rejects.toThrow('expiry')
    expect(executor.execute).not.toHaveBeenCalled()
  })
})
