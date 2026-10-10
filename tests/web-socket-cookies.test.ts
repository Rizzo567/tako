import { describe, expect, it } from 'vitest'
import { socketCookie } from '../apps/server/src/socket/cookies'

describe('untrusted realtime authentication cookie', () => {
  it.each(['tako_session=%', 'tako_session=%E0%A4%A', 'tako_session=%FF', 'foo=a; tako_session=%GG; bar=b'])('fails closed without throwing on %s', raw => {
    expect(() => socketCookie(raw, 'tako_session')).not.toThrow()
    expect(socketCookie(raw, 'tako_session')).toBeNull()
  })
  it('extracts only the requested cookie without mixing client and staff tokens', () => {
    const raw = 'tako_table=customer%2Btoken; tako_session=staff%2Btoken'
    expect(socketCookie(raw, 'tako_session')).toBe('staff+token')
    expect(socketCookie(raw, 'tako_table')).toBe('customer+token')
    expect(socketCookie(raw, 'other')).toBeNull()
    expect(socketCookie(undefined, 'tako_session')).toBeNull()
  })
  it('does not fall through from malformed auth to a second duplicate token', () => {
    expect(socketCookie('tako_session=%; tako_session=valid', 'tako_session')).toBeNull()
  })
})
