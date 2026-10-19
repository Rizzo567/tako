import type { FastifyInstance } from 'fastify'
import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db, users, sessions } from '@tako/db'
import { eq, sql } from 'drizzle-orm'
import { deliverWebMail, type MailDelivery } from '../lib/web-mail.js'
import { requireAuth } from '../middleware/auth.js'
import { SESSION_COOKIE } from '../lib/cookies.js'
import { renderTransactionalEmail } from '../lib/transactional-email/render.js'
import { webEmailEnabled } from '../lib/web-email-enabled.js'

const hash = (token: string) => createHash('sha256').update(token).digest('hex')
const generic = { data: { message: 'Se l’indirizzo è registrato, riceverai le istruzioni.' } }
// 19/10 (decisione Manuel): «Password dimenticata» → email con pulsante «Reimposta la password». Link monouso, 30 minuti; una nuova
// richiesta annulla il link precedente; al massimo 3 link l'ora per account (+ limite per IP). Nel DB solo lo SHA-256 del token.
// Risposta identica se l'email non esiste (niente enumerazione). Dopo il cambio: sessioni chiuse ed email di conferma.
export const RESET_LINK_TTL_MINUTES = 30, RESET_LINKS_PER_HOUR = 3
const passwordRule = z.string().min(8).max(128)
const badLink = { error: { code: 'INVALID_RESET', message: 'Link scaduto, richiedine uno nuovo.' } }
export const resetLinkMail = (url: string, name = 'ristoratore') => renderTransactionalEmail('reset-password', { nome_titolare: name, minuti_validita: String(RESET_LINK_TTL_MINUTES), link_reset: url }, process.env.EMAIL_LOGO_URL)
export const passwordChangedMail = (name = 'ristoratore') => renderTransactionalEmail('password-cambiata', { nome_titolare: name, data_ora: new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) }, process.env.EMAIL_LOGO_URL)
const activeReset = (token: string) => sql`select r.user_id,u.email from web_password_resets r join users u on u.id=r.user_id where r.token_hash=${hash(token)} and r.consumed_at is null and r.expires_at>now() and u.active=true`

export function webAccountRoutesWithDelivery(deliver: MailDelivery = deliverWebMail) {
  return async function webAccountRoutes(app: FastifyInstance) {
    app.post('/forgot-password', { config: { rateLimit: { max: 5, timeWindow: 3600000 } } }, async (req, reply) => {
      const parsed = z.object({ email: z.string().trim().email().max(254) }).safeParse(req.body)
      if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Email non valida.' } })
      const email = parsed.data.email.toLowerCase()
      const matches = await db.select().from(users).where(sql`lower(${users.email})=${email} and ${users.active}=true`).limit(2)
      const origin = process.env.WEB_ORIGIN
      if (matches.length !== 1 || !origin || !origin.startsWith('https://')) return generic
      const user = matches[0]!, token = randomBytes(32).toString('base64url'), tokenHash = hash(token)
      const issued = await db.transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'pw-reset:' + user.id},0))`)
        const recent = await tx.execute(sql`select count(*)::int as n from web_password_resets where user_id=${user.id} and created_at>now()-interval '1 hour'`)
        if (Number((recent[0] as any)?.n ?? 0) >= RESET_LINKS_PER_HOUR) return false
        await tx.execute(sql`update web_password_resets set consumed_at=now() where user_id=${user.id} and consumed_at is null`)
        await tx.execute(sql`insert into web_password_resets(user_id,token_hash,expires_at) values(${user.id},${tokenHash},now()+make_interval(mins => ${RESET_LINK_TTL_MINUTES}))`)
        return true
      })
      if (!issued) return generic
      try { await deliver({ to: user.email, ...resetLinkMail(origin.replace(/\/$/, '') + '/staff/?reset=' + token, user.name) }, `reset-${tokenHash}`) }
      catch { await db.execute(sql`update web_password_resets set consumed_at=now() where token_hash=${tokenHash}`) }
      return generic
    })
    // Apertura del link: la pagina chiede se il token vale ancora prima di mostrare «Nuova password».
    app.post('/reset-check', { config: { rateLimit: { max: 20, timeWindow: 60000 } } }, async (req) => {
      const parsed = z.object({ token: z.string().min(32).max(128) }).safeParse(req.body)
      if (!parsed.success) return { data: { valid: false } }
      return { data: { valid: (await db.execute(activeReset(parsed.data.token))).length === 1 } }
    })
    app.post('/reset-password', { config: { rateLimit: { max: 10, timeWindow: 60000 } } }, async (req, reply) => {
      const parsed = z.object({ token: z.string().min(32).max(128), password: passwordRule }).safeParse(req.body)
      if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'La nuova password deve avere almeno 8 caratteri.' } })
      const passwordHash = await bcrypt.hash(parsed.data.password, 12)
      const result = await db.transaction(async tx => {
        const rows = await tx.execute(sql`update web_password_resets set consumed_at=now() where token_hash=${hash(parsed.data.token)} and consumed_at is null and expires_at>now() returning user_id`)
        const row = rows[0] as { user_id: string } | undefined
        if (!row) return null
        const changed = await tx.update(users).set({ passwordHash, localOwnerSecretHash: null }).where(sql`${users.id}=${row.user_id} and ${users.active}=true`).returning({ id: users.id, email: users.email })
        if (!changed.length) return null
        await tx.delete(sessions).where(eq(sessions.userId, row.user_id))
        await tx.execute(sql`update web_password_resets set consumed_at=now() where user_id=${row.user_id} and consumed_at is null`)
        return changed[0]!
      })
      if (!result) return reply.code(400).send(badLink)
      try { await deliver({ to: result.email, ...passwordChangedMail() }, `password-changed-${hash(parsed.data.token)}`) } catch { /* la password è cambiata comunque */ }
      return { data: { reset: true, email: result.email } }
    })
    // Cambio password da dentro la dashboard: serve la password attuale; le altre sessioni aperte si chiudono, questa resta.
    app.post('/change-password', { preHandler: requireAuth, config: { rateLimit: { max: 10, timeWindow: 900000 } } }, async (req, reply) => {
      const parsed = z.object({ current: z.string().min(1).max(128), password: passwordRule }).safeParse(req.body)
      if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'La nuova password deve avere almeno 8 caratteri.' } })
      const [user] = await db.select().from(users).where(sql`${users.id}=${req.user!.id} and ${users.active}=true`).limit(1)
      const valid = !!user && ((user.passwordHash ? await bcrypt.compare(parsed.data.current, user.passwordHash) : false) || (user.localOwnerSecretHash ? await bcrypt.compare(parsed.data.current, user.localOwnerSecretHash) : false))
      if (!valid) return reply.code(400).send({ error: { code: 'WRONG_PASSWORD', message: 'La password attuale non è corretta.' } })
      if (parsed.data.current === parsed.data.password) return reply.code(400).send({ error: { code: 'SAME_PASSWORD', message: 'La nuova password deve essere diversa da quella attuale.' } })
      const token = req.cookies?.[SESSION_COOKIE] ?? req.headers.authorization?.replace('Bearer ', '') ?? ''
      const passwordHash = await bcrypt.hash(parsed.data.password, 12)
      await db.transaction(async tx => {
        await tx.update(users).set({ passwordHash, localOwnerSecretHash: null }).where(eq(users.id, user!.id))
        await tx.execute(sql`delete from sessions where user_id=${user!.id} and token<>${token}`)
        await tx.execute(sql`update web_password_resets set consumed_at=now() where user_id=${user!.id} and consumed_at is null`)
      })
      return { data: { changed: true } }
    })
    app.get('/capabilities', async () => ({ data: { email: webEmailEnabled(), cardGuarantee: false } }))
  }
}
export const webAccountRoutes = webAccountRoutesWithDelivery()
