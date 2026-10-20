import { Buffer } from 'node:buffer'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

function key(): Buffer {
  const value = process.env.EMAIL_OUTBOX_KEY || ''
  const decoded = Buffer.from(value, 'base64')
  if (decoded.length !== 32 || decoded.toString('base64') !== value) throw new Error('Email outbox key unavailable')
  return decoded
}
/** Versioned authenticated encryption; context binds ciphertext to its immutable dedupe key. */
export function encryptEmailPayload(payload: unknown, context: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  cipher.setAAD(Buffer.from(context))
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.')
}
export function decryptEmailPayload(value: string, context: string): unknown {
  const [version, iv, tag, ciphertext, extra] = value.split('.')
  if (version !== 'v1' || !iv || !tag || !ciphertext || extra) throw new Error('Invalid encrypted email')
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'))
  decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8'))
}
