import { db } from '@tako/db'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { deliverWebMail, type MailDelivery, type WebMail } from '../web-mail.js'
import { renderTransactionalEmail, type EmailTemplate } from './render.js'
import { decryptEmailPayload, encryptEmailPayload } from './crypto.js'

type Executor = Pick<typeof db, 'execute'>
export type EmailGuard = { kind: 'reset' | 'email-change' | 'welcome'; id: string }
export type EnqueueEmail = { key: string; userId: string; recipient: string; template: EmailTemplate; values: Record<string, string>; expiresAt?: Date; guard?: EmailGuard }
type Envelope = WebMail & { from: string; reply_to: string }
const maxAge = 23 * 3600000
export function retryEmailAt(attempts: number, expiresAt: Date, now: Date): Date | null {
  if (attempts >= 6 || attempts < 1) return null
  const next = new Date(now.getTime() + Math.min(60 * 60000, 30000 * 2 ** (attempts - 1)))
  return next.getTime() + 10000 < expiresAt.getTime() ? next : null
}
export function validateEmailEnvelope(value: unknown): Envelope {
  const mail = value as Envelope
  if (!mail || typeof mail !== 'object' || !['to','from','reply_to','subject','html','text'].every(k => typeof (mail as any)[k] === 'string')
    || /[\r\n]/.test(mail.to + mail.from + mail.reply_to + mail.subject) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.to)
    || !mail.from || !mail.reply_to || !mail.subject || !mail.html) throw new Error('Invalid email envelope')
  return mail
}
export async function enqueueEmail(executor: Executor, input: EnqueueEmail): Promise<string> {
  if (!/^[a-zA-Z0-9:_./-]{1,200}$/.test(input.key)) throw new Error('Invalid email dedupe key')
  const now = new Date()
  const expires = input.expiresAt || new Date(now.getTime() + maxAge - 1000)
  if (!(expires instanceof Date) || !Number.isFinite(+expires) || +expires <= +now || +expires > +now + maxAge) throw new Error('Invalid email expiry')
  const rendered = renderTransactionalEmail(input.template, input.values, process.env.EMAIL_LOGO_URL)
  const envelope = validateEmailEnvelope({ ...rendered, to: input.recipient, from: process.env.EMAIL_FROM || '', reply_to: process.env.EMAIL_REPLY_TO || 'manuelrizzo474@gmail.com' })
  const payload = encryptEmailPayload(envelope, input.key)
  const rows = await executor.execute(sql`insert into tako_email_outbox(dedupe_key,user_id,recipient,template,encrypted_payload,guard_kind,guard_id,created_at,expires_at)
    values(${input.key},${input.userId},${input.recipient},${input.template},${payload},${input.guard?.kind || null},${input.guard?.id || null},${now.toISOString()},${expires.toISOString()})
    on conflict(dedupe_key) do update set dedupe_key=excluded.dedupe_key returning id`)
  return String((rows[0] as any).id)
}
async function guardValid(tx: Executor, row: any): Promise<boolean> {
  const users = await tx.execute(sql`select id from users where id=${row.user_id} and active=true`)
  if (!users[0]) return false
  if (!row.guard_kind) return true
  if (row.guard_kind === 'reset') {
    const rows = await tx.execute(sql`select r.user_id from web_password_resets r join users u on u.id=r.user_id where r.user_id=${row.user_id} and r.token_hash=${row.guard_id} and r.consumed_at is null and r.expires_at>now() and lower(u.email)=lower(${row.recipient})`)
    return !!rows[0]
  }
  if (row.guard_kind === 'email-change') {
    const rows = await tx.execute(sql`select id from tako_email_changes where id=${row.guard_id}::uuid and user_id=${row.user_id} and consumed_at is null and expires_at>now() and lower(new_email)=lower(${row.recipient})`)
    return !!rows[0]
  }
  if (row.guard_kind === 'welcome') {
    const rows = await tx.execute(sql`select u.id from users u join tako_whatsapp_links l on l.actor_id=u.id where u.id=${row.user_id} and l.restaurant_id=${row.guard_id}::uuid and lower(u.email)=lower(${row.recipient})`)
    return !!rows[0]
  }
  return false
}
/** Explicit scheduled invocation; each row is claimed and fenced before any network call. */
export async function processEmailOutbox(deliver: MailDelivery = deliverWebMail, limit = 10, store: typeof db = db) {
  const outcomes = { sent: 0, failed: 0, cancelled: 0, retried: 0 }
  const deadline = Date.now() + 20000
  for (let index = 0; index < Math.max(0, Math.min(50, limit)); index++) {
    // Provider timeout is 10 seconds. Do not start another attempt without that budget.
    if (Date.now() + 10500 > deadline) break
    const claimed = await store.transaction(async tx => {
      const now = new Date()
      const rows = await tx.execute(sql`select * from tako_email_outbox where
        (status='pending' and next_attempt_at<=${now.toISOString()}) or
        (status='sending' and claimed_at<=${new Date(+now - 120000).toISOString()})
        order by created_at for update skip locked limit 1`)
      const row = rows[0] as any
      if (!row) return null
      if (+new Date(row.expires_at) <= +now || row.attempts >= 6 || !row.encrypted_payload || !await guardValid(tx, row)) {
        await tx.execute(sql`update tako_email_outbox set status='cancelled',encrypted_payload=null,claim_token=null,claimed_at=null,last_error='EXPIRED_OR_INVALID' where id=${row.id}`)
        outcomes.cancelled++; return { skip: true }
      }
      const token = randomUUID()
      await tx.execute(sql`update tako_email_outbox set status='sending',claim_token=${token}::uuid,claimed_at=${now.toISOString()},attempts=attempts+1 where id=${row.id}`)
      return { ...row, token, attempts: Number(row.attempts) + 1 }
    })
    if (!claimed) break
    if (claimed.skip) continue
    try {
      const mail = validateEmailEnvelope(decryptEmailPayload(claimed.encrypted_payload, claimed.dedupe_key))
      if (mail.to !== claimed.recipient) throw new Error('Invalid email recipient')
      const result = await deliver(mail, claimed.dedupe_key)
      const updated = await store.execute(sql`update tako_email_outbox set status='sent',provider_id=${result.id},encrypted_payload=null,last_error=null,claim_token=null,claimed_at=null where id=${claimed.id} and claim_token=${claimed.token}::uuid and status='sending' returning id`)
      if (updated[0]) outcomes.sent++
    } catch {
      const next = retryEmailAt(claimed.attempts, new Date(claimed.expires_at), new Date())
      const updated = await store.execute(sql`update tako_email_outbox set status=${next ? 'pending' : 'failed'},next_attempt_at=${(next || new Date()).toISOString()},encrypted_payload=case when ${!!next} then encrypted_payload else null end,last_error='DELIVERY_FAILED',claim_token=null,claimed_at=null where id=${claimed.id} and claim_token=${claimed.token}::uuid and status='sending' returning id`)
      if (updated[0]) { if (next) outcomes.retried++; else outcomes.failed++ }
    }
  }
  return outcomes
}
