import type { FastifyInstance } from 'fastify'
import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db, users, sessions } from '@tako/db'
import { eq, sql } from 'drizzle-orm'
import { deliverWebMail, escapeMail, type MailDelivery } from '../lib/web-mail.js'

const hash = (token: string) => createHash('sha256').update(token).digest('hex')
const generic = { data: { message: 'Se l’indirizzo è registrato, riceverai le istruzioni.' } }

export function webAccountRoutesWithDelivery(deliver: MailDelivery = deliverWebMail) {
  return async function webAccountRoutes(app: FastifyInstance) {
    app.post('/forgot-password', { config: { rateLimit: { max: 3, timeWindow: 3600000 } } }, async (req, reply) => {
      const parsed = z.object({ email: z.string().email().max(254) }).safeParse(req.body)
      if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Email non valida.' } })
      const email = parsed.data.email.toLowerCase()
      const matches = await db.select().from(users).where(sql`lower(${users.email})=${email} and ${users.active}=true`).limit(2)
      const token = randomBytes(32).toString('base64url')
      if (matches.length === 1) {
        const user = matches[0]!
        const origin = process.env.WEB_ORIGIN
        if (!origin || !origin.startsWith('https://')) return generic
        const tokenHash = hash(token)
        await db.execute(sql`insert into web_password_resets(user_id,token_hash,expires_at) values(${user.id},${tokenHash},now()+interval '30 minutes')`)
        try { await deliver({ to: user.email, subject: 'Reimposta la password Tako', html: `<p>Reimposta la password entro 30 minuti:</p><a href="${escapeMail(origin.replace(/\/$/, '') + '/staff/?reset=' + token)}">Reimposta password</a>` }, `reset-${tokenHash}`) }
        catch { await db.execute(sql`delete from web_password_resets where token_hash=${tokenHash}`) }
      }
      return generic
    })
    app.post('/reset-password', { config: { rateLimit: { max: 10, timeWindow: 60000 } } }, async (req, reply) => {
      const parsed = z.object({ token: z.string().min(32).max(128), password: z.string().min(10).max(128) }).safeParse(req.body)
      if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Dati non validi.' } })
      const passwordHash = await bcrypt.hash(parsed.data.password, 12)
      const result = await db.transaction(async tx => {
        const rows = await tx.execute(sql`update web_password_resets set consumed_at=now() where token_hash=${hash(parsed.data.token)} and consumed_at is null and expires_at>now() returning user_id`)
        const row = rows[0] as { user_id: string } | undefined
        if (!row) return false
        const changed = await tx.update(users).set({ passwordHash, localOwnerSecretHash: null }).where(sql`${users.id}=${row.user_id} and ${users.active}=true`).returning({ id: users.id })
        if (!changed.length) return false
        await tx.delete(sessions).where(eq(sessions.userId, row.user_id))
        await tx.execute(sql`update web_password_resets set consumed_at=now() where user_id=${row.user_id} and consumed_at is null`)
        return true
      })
      if (!result) return reply.code(400).send({ error: { code: 'INVALID_RESET', message: 'Link non valido o scaduto.' } })
      return { data: { reset: true } }
    })
    app.get('/capabilities', async () => ({ data: { email: process.env.WEB_EMAIL_ENABLED === '1' && !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM, cardGuarantee: false } }))
  }
}
export const webAccountRoutes = webAccountRoutesWithDelivery()
