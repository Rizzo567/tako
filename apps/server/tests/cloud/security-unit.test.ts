// FASE 5c — Unit test mirati dei primitivi di sicurezza cloud (§7).
// Niente DB: funzioni pure. Coprono HMAC token a riposo, policy password (byte-aware),
// normalizzazione email, safeRedirect anti-open-redirect, costruzione link da env fissa.
import { describe, it, expect, beforeAll } from 'vitest'

// Le env vanno impostate PRIMA di importare i moduli cloud (lettura a runtime).
beforeAll(() => {
  process.env['TAKO_MODE'] = 'cloud'
  process.env['TOKEN_PEPPER'] = 'test-pepper-0123456789abcdef'
  process.env['SITE_BASE_URL'] = 'https://tako.app'
})

describe('token a riposo (HMAC + single-use helpers — SEC-012/016)', () => {
  it('generateUrlToken: token ≥ 32 byte di entropia e tokenHash deterministico', async () => {
    const { generateUrlToken, hashToken } = await import('../../src/cloud/security.ts')
    const { token, tokenHash } = generateUrlToken()
    expect(token.length).toBeGreaterThanOrEqual(32)
    // l'hash a riposo è HMAC del token in chiaro: ricostruibile dato il pepper
    expect(hashToken(token)).toBe(tokenHash)
  })

  it('hashToken NON è reversibile né uguale al token in chiaro', async () => {
    const { hashToken } = await import('../../src/cloud/security.ts')
    const h = hashToken('un-token-segreto')
    expect(h).not.toBe('un-token-segreto')
    expect(h).toMatch(/^[0-9a-f]{64}$/) // sha256 hex
  })

  it('due token diversi → hash diversi; stesso token → stesso hash', async () => {
    const { generateUrlToken, hashToken } = await import('../../src/cloud/security.ts')
    const a = generateUrlToken()
    const b = generateUrlToken()
    expect(a.tokenHash).not.toBe(b.tokenHash)
    expect(hashToken(a.token)).toBe(a.tokenHash)
  })

  it('generateSessionToken produce token opachi unici', async () => {
    const { generateSessionToken } = await import('../../src/cloud/security.ts')
    const s = new Set(Array.from({ length: 50 }, () => generateSessionToken().token))
    expect(s.size).toBe(50)
  })

  it('safeEqualHex: true su uguali, false su diversi/lunghezze diverse', async () => {
    const { safeEqualHex, hashToken } = await import('../../src/cloud/security.ts')
    const h = hashToken('x')
    expect(safeEqualHex(h, h)).toBe(true)
    expect(safeEqualHex(h, hashToken('y'))).toBe(false)
    expect(safeEqualHex(h, 'ab')).toBe(false)
  })
})

describe('password policy byte-aware (SEC-015)', () => {
  it('< 10 caratteri → errore', async () => {
    const { passwordPolicyError } = await import('../../src/cloud/security.ts')
    expect(passwordPolicyError('corta1')).toBeTruthy()
  })

  it('esattamente 10 caratteri → ok', async () => {
    const { passwordPolicyError } = await import('../../src/cloud/security.ts')
    expect(passwordPolicyError('1234567890')).toBeNull()
  })

  it('> 72 BYTE → errore (limite bcrypt, conteggio byte non caratteri)', async () => {
    const { passwordPolicyError } = await import('../../src/cloud/security.ts')
    // 73 caratteri ASCII = 73 byte
    expect(passwordPolicyError('a'.repeat(73))).toBeTruthy()
    // 20 emoji multi-byte: pochi caratteri ma > 72 byte → deve fallire sul limite byte
    const manyBytes = '😀'.repeat(20) // ogni 😀 = 4 byte → 80 byte
    expect(Buffer.byteLength(manyBytes, 'utf8')).toBeGreaterThan(72)
    expect(passwordPolicyError(manyBytes)).toBeTruthy()
  })

  it('hashPassword/verifyPassword round-trip', async () => {
    const { hashPassword, verifyPassword } = await import('../../src/cloud/security.ts')
    const h = await hashPassword('CorrectHorseBattery1')
    expect(await verifyPassword('CorrectHorseBattery1', h)).toBe(true)
    expect(await verifyPassword('sbagliata', h)).toBe(false)
  })
})

describe('normalizzazione email (SEC-015)', () => {
  it('trim + lowercase', async () => {
    const { normalizeEmail } = await import('../../src/cloud/security.ts')
    expect(normalizeEmail('  Mario.Rossi@TAKO.APP  ')).toBe('mario.rossi@tako.app')
  })
})

describe('link e safeRedirect costruiti da env fissa (SEC-005/013)', () => {
  it('buildVerifyUrl/buildResetUrl usano SITE_BASE_URL, mai Host header', async () => {
    const { buildVerifyUrl, buildResetUrl } = await import('../../src/cloud/config.ts')
    expect(buildVerifyUrl('abc')).toBe('https://tako.app/verify-email?token=abc')
    expect(buildResetUrl('xyz')).toBe('https://tako.app/reset-password?token=xyz')
  })

  it('safeRedirect: stessa origin → consentito; origin esterna → fallback alla home', async () => {
    const { safeRedirect } = await import('../../src/cloud/config.ts')
    expect(safeRedirect('https://tako.app/dashboard')).toBe('https://tako.app/dashboard')
    expect(safeRedirect('https://evil.example/phishing')).toBe('https://tako.app')
    // open-redirect tramite //host → bloccato (risolto contro la base, origin diversa)
    expect(safeRedirect('//evil.example')).toBe('https://tako.app')
    expect(safeRedirect(undefined)).toBe('https://tako.app')
    // un path RELATIVO è ammesso (risolto same-origin sulla base): non è open-redirect
    expect(safeRedirect('/dashboard')).toBe('https://tako.app/dashboard')
  })
})
