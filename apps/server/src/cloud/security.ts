// Helper di sicurezza per l'identità cloud (MASTER_PLAN-cloud-auth §7).
// Tutto ciò che riguarda token, hashing a riposo, password policy e normalizzazione
// email vive qui, così le route restano leggibili e le scelte di sicurezza centralizzate.
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'
import { nanoid } from 'nanoid'
import bcrypt from 'bcryptjs'

// ─── PEPPER / HMAC a riposo ──────────────────────────────────────────────────
// I token URL (verifica email, reset, sessione opaca) NON si salvano in chiaro:
// a riposo si salva HMAC-SHA256(token, TOKEN_PEPPER) (SEC-012/SEC-016). Un dump del
// DB cloud non rivela token utilizzabili. Il pepper è una env server, non sta nel DB.
function pepper(): string {
  const p = process.env['TOKEN_PEPPER']
  if (!p || p.length < 16) {
    throw new Error('TOKEN_PEPPER è obbligatoria (≥16 caratteri) in TAKO_MODE=cloud')
  }
  return p
}

/** HMAC-SHA256(value, TOKEN_PEPPER) → hex. Usato per token/code/session a riposo. */
export function hashToken(value: string): string {
  return createHmac('sha256', pepper()).update(value).digest('hex')
}

/** Confronto hash in tempo costante (evita timing oracle sul confronto). */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex')
  const bb = Buffer.from(b, 'hex')
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

// ─── Generazione token ───────────────────────────────────────────────────────
// nanoid con ≥32 byte di entropia. Alfabeto URL-safe di default: adatto a link email.
// 43 char base64-url ≈ 256 bit; usiamo 48 char per margine (≥32 byte richiesti).
const URL_TOKEN_LEN = 48

/** Token opaco per link URL (verifica/reset). Ritorna {token, tokenHash}. */
export function generateUrlToken(): { token: string; tokenHash: string } {
  const token = nanoid(URL_TOKEN_LEN)
  return { token, tokenHash: hashToken(token) }
}

/** Token opaco di sessione cloud. Più lungo: vive nel cookie, mai in URL. */
export function generateSessionToken(): { token: string; tokenHash: string } {
  // 64 byte di entropia random codificati base64url (no padding) → opaco e robusto.
  const token = randomBytes(48).toString('base64url')
  return { token, tokenHash: hashToken(token) }
}

// ─── Password ────────────────────────────────────────────────────────────────
// Policy: min 10 caratteri, max 72 BYTE (limite hard di bcrypt: oltre i 72 byte
// l'input viene troncato silenziosamente → due password diverse potrebbero
// collidere). Validiamo i byte UTF-8, non i caratteri.
export const PASSWORD_MIN = 10
export const PASSWORD_MAX_BYTES = 72

export function passwordPolicyError(password: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `La password deve avere almeno ${PASSWORD_MIN} caratteri.`
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return `La password è troppo lunga (max ${PASSWORD_MAX_BYTES} byte).`
  }
  return null
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ─── Email ───────────────────────────────────────────────────────────────────
/** Normalizza l'email: trim + lowercase (SEC-015). Coerente con l'unique index DB. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

// ─── CSRF double-submit ──────────────────────────────────────────────────────
/** Genera un token CSRF opaco (per cookie+header double-submit in COOKIE_MODE=crosssite). */
export function generateCsrfToken(): string {
  return randomBytes(24).toString('base64url')
}

// ─── TTL (millisecondi) ──────────────────────────────────────────────────────
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000 // 24h
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000          // 1h (da contratto DB)
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000       // 30 giorni
