// Route di autenticazione del CONTROL-PLANE cloud (MASTER_PLAN-cloud-auth §4/§5/§7).
// Email/password only in Fase 2a; OAuth = Fase 2b. Tutte le mitigazioni §7 applicate:
//  - anti-enumeration: register/forgot/resend rispondono 200 generico;
//    EMAIL_NOT_VERIFIED rivelato SOLO dopo password corretta;
//  - reset password: revoca TUTTE le sessioni + bump credentials_version;
//  - link costruiti da SITE_BASE_URL (env), mai da Host header;
//  - token a riposo come HMAC, single-use ATOMICO (UPDATE…WHERE consumed_at IS NULL RETURNING).
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { and, eq, gt, isNull } from 'drizzle-orm'
import {
  cloudDb,
  cloudOwners,
  cloudSessions,
  cloudEmailVerificationTokens,
  cloudPasswordResetTokens,
} from '../../cloud/db.js'
import {
  hashToken,
  generateUrlToken,
  hashPassword,
  verifyPassword,
  DUMMY_PASSWORD_HASH,
  passwordPolicyError,
  normalizeEmail,
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from '../../cloud/security.js'
import { issueCloudSession } from '../../cloud/session.js'
import { sendEmail, verifyEmailTemplate, resetPasswordTemplate } from '../../cloud/email.js'
import { buildVerifyUrl, buildResetUrl, cookieMode } from '../../cloud/config.js'
import { CLOUD_SESSION_COOKIE, CLOUD_CSRF_COOKIE } from '../../cloud/cookies.js'
import { requireCloudAuth, requireCsrf } from '../../middleware/cloudAuth.js'
import { audit } from '../../cloud/audit.js'
import { incrWithTtl, getCount, del as redisDel } from '../../cloud/redis.js'

// ─── Schemi di validazione (zod) ─────────────────────────────────────────────
const emailField = z.string().trim().toLowerCase().email().max(254)
const passwordField = z.string().min(1).max(200) // policy fine (10..72B) in passwordPolicyError

const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  name: z.string().trim().min(1).max(120).optional(),
})
const loginSchema = z.object({ email: emailField, password: z.string().min(1).max(200) })
const emailOnlySchema = z.object({ email: emailField })
const confirmVerifySchema = z.object({ token: z.string().min(16).max(200) })
const resetSchema = z.object({ token: z.string().min(16).max(200), password: passwordField })

// Messaggio generico anti-enumeration: stessa risposta per email esistente o no.
const GENERIC_EMAIL_SENT = {
  data: { message: 'Se l’indirizzo è registrato, riceverai un’email a breve.' },
}

// Crea un token di verifica email e invia (mock) il link. Best-effort sull'invio.
async function sendVerificationEmail(ownerId: string, ownerName: string | null, to: string): Promise<void> {
  const { token, tokenHash } = generateUrlToken()
  await cloudDb.insert(cloudEmailVerificationTokens).values({
    ownerId,
    tokenHash,
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
  })
  const tpl = verifyEmailTemplate({ name: ownerName, verifyUrl: buildVerifyUrl(token) })
  await sendEmail({ to, subject: tpl.subject, html: tpl.html })
}

// Notifica al titolare di Tako (Manuel) ogni nuova registrazione dal sito = lead.
// Destinatario configurabile via ADMIN_NOTIFY_EMAIL (default: indirizzo di Manuel).
// Best-effort: un fallimento non deve mai rompere la registrazione dell'utente.
async function notifyAdminNewRegistration(name: string | null, leadEmail: string): Promise<void> {
  const admin = process.env['ADMIN_NOTIFY_EMAIL'] || 'manuelrizzo474@gmail.com'
  const safeName = (name && name.trim()) || '(nessun nome)'
  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:15px;color:#2A1F1A">
      <h2>🐙 Nuovo ristorante registrato su Tako</h2>
      <p><b>Nome locale:</b> ${safeName}</p>
      <p><b>Email:</b> <a href="mailto:${leadEmail}">${leadEmail}</a></p>
      <p style="color:#8a7d75">Registrazione dal sito takoitalia.com. L'utente ha ricevuto l'email di verifica.</p>
    </div>`
  await sendEmail({ to: admin, subject: `Nuovo lead Tako: ${safeName}`, html })
}

// ─── Throttle per-ACCOUNT sul login (anti brute-force) ───────────────────────
// Il rate-limit per-IP (server.ts) non ferma uno spray distribuito su un singolo account.
// Aggiungiamo un contatore per email normalizzata, condiviso su Redis (fallback in-memory).
// Finestra breve e soglia generosa: alza il costo del brute-force SENZA diventare un
// lockout permanente sfruttabile per DoS mirato (la chiave scade da sola).
const LOGIN_MAX_FAILS = 12
const LOGIN_WINDOW_S = 600 // 10 min
const loginFails = new Map<string, { count: number; exp: number }>()
function loginRedisKey(norm: string): string { return `cloud:login:fail:${norm}` }
async function loginLockedOut(norm: string): Promise<boolean> {
  const count = await getCount(loginRedisKey(norm))
  if (count === null) {
    const e = loginFails.get(norm)
    if (!e || e.exp < Date.now()) return false
    return e.count >= LOGIN_MAX_FAILS
  }
  return count >= LOGIN_MAX_FAILS
}
async function recordLoginFailure(norm: string): Promise<void> {
  const count = await incrWithTtl(loginRedisKey(norm), LOGIN_WINDOW_S)
  if (count === null) {
    const e = loginFails.get(norm)
    if (!e || e.exp < Date.now()) loginFails.set(norm, { count: 1, exp: Date.now() + LOGIN_WINDOW_S * 1000 })
    else e.count++
  }
}
async function clearLoginAttempts(norm: string): Promise<void> {
  await redisDel(loginRedisKey(norm))
  loginFails.delete(norm)
}

export async function cloudAuthRoutes(fastify: FastifyInstance) {
  // ─── REGISTER ──────────────────────────────────────────────────────────────
  // Anti-enumeration: risposta 200 generica anche se l'email esiste già; in quel
  // caso NON creiamo un nuovo owner e (opzionalmente) reinviamo la verifica.
  fastify.post('/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Dati non validi' } })
    const { email, password, name } = parsed.data

    const pwErr = passwordPolicyError(password)
    if (pwErr) return reply.code(400).send({ error: { code: 'WEAK_PASSWORD', message: pwErr } })

    const norm = normalizeEmail(email)
    const [existing] = await cloudDb.select().from(cloudOwners).where(eq(cloudOwners.email, norm)).limit(1)

    if (existing) {
      // Lavoro costante: il ramo "nuovo account" esegue un bcrypt.hash (cost 12). Qui
      // facciamo un bcrypt.compare contro l'hash dummy così la registrazione non rivela
      // via timing se l'email esiste già (anti-enumeration).
      await verifyPassword(password, DUMMY_PASSWORD_HASH)
      // Non rivelare l'esistenza: se non verificato, reinvia silenziosamente la verifica.
      if (!existing.emailVerified) {
        await sendVerificationEmail(existing.id, existing.name, norm).catch(() => {})
      }
      await audit({ event: 'register', ownerId: existing.id, req, meta: { duplicate: true } })
      return reply.code(200).send(GENERIC_EMAIL_SENT)
    }

    const passwordHash = await hashPassword(password)
    let ownerId: string
    let ownerName: string | null
    try {
      const [owner] = await cloudDb.insert(cloudOwners).values({
        email: norm,
        passwordHash,
        name: name ?? null,
        emailVerified: false,
      }).returning()
      ownerId = owner!.id
      ownerName = owner!.name
    } catch (err: any) {
      // Race su unique email: comportati come "esistente" → 200 generico.
      if (err?.code === '23505') {
        await audit({ event: 'register', req, meta: { race: true } })
        return reply.code(200).send(GENERIC_EMAIL_SENT)
      }
      req.log.error({ err }, 'cloud register error')
      return reply.code(500).send({ error: { code: 'SERVER_ERROR', message: 'Errore interno. Riprova.' } })
    }

    await sendVerificationEmail(ownerId, ownerName, norm).catch((err) => req.log.error({ err }, 'verify email send failed'))
    await notifyAdminNewRegistration(ownerName, norm).catch((err) => req.log.error({ err }, 'admin notify failed'))
    await audit({ event: 'register', ownerId, req })
    return reply.code(200).send(GENERIC_EMAIL_SENT)
  })

  // ─── LOGIN ───────────────────────────────────────────────────────────────
  // EMAIL_NOT_VERIFIED rivelato SOLO dopo aver confermato la password (altrimenti
  // diventa un oracle di enumeration). Credenziali errate → INVALID_CREDENTIALS generico.
  fastify.post('/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Dati non validi' } })
    const norm = normalizeEmail(parsed.data.email)

    // Throttle per-account PRIMA del bcrypt: blocca lo spray su un singolo account.
    if (await loginLockedOut(norm)) {
      await audit({ event: 'login_failed', ownerId: null, req, meta: { reason: 'account_throttled' } })
      return reply.code(429).send({ error: { code: 'TOO_MANY_ATTEMPTS', message: 'Troppi tentativi. Riprova tra qualche minuto.' } })
    }

    const [owner] = await cloudDb.select().from(cloudOwners).where(eq(cloudOwners.email, norm)).limit(1)
    // Lavoro costante: esegui SEMPRE un bcrypt.compare (contro l'hash reale o il dummy) così
    // account inesistenti / solo-OAuth non si distinguono via timing (anti-enumeration).
    const ok = await verifyPassword(parsed.data.password, owner?.passwordHash ?? DUMMY_PASSWORD_HASH)
    if (!owner || !owner.passwordHash || !ok) {
      await recordLoginFailure(norm)
      await audit({ event: 'login_failed', ownerId: owner?.id ?? null, req })
      return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Email o password non corretti' } })
    }

    // Password corretta → azzera i tentativi falliti dell'account.
    await clearLoginAttempts(norm)

    if (!owner.emailVerified) {
      await audit({ event: 'login_email_not_verified', ownerId: owner.id, req })
      return reply.code(403).send({ error: { code: 'EMAIL_NOT_VERIFIED', message: 'Conferma la tua email per accedere.' } })
    }

    await issueCloudSession(reply, {
      ownerId: owner.id,
      credentialsVersion: owner.credentialsVersion,
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    })
    await cloudDb.update(cloudOwners).set({ lastLoginAt: new Date() }).where(eq(cloudOwners.id, owner.id))
    await audit({ event: 'login_success', ownerId: owner.id, req })

    return reply.send({ data: { owner: { id: owner.id, email: owner.email, name: owner.name } } })
  })

  // ─── LOGOUT ────────────────────────────────────────────────────────────────
  fastify.post('/logout', { preHandler: [requireCloudAuth, requireCsrf] }, async (req, reply) => {
    const ctx = req.cloudOwner!
    await cloudDb.delete(cloudSessions).where(eq(cloudSessions.id, ctx.sessionId))
    reply.clearCookie(CLOUD_SESSION_COOKIE, { path: '/' })
    if (cookieMode() === 'crosssite') reply.clearCookie(CLOUD_CSRF_COOKIE, { path: '/' })
    await audit({ event: 'logout', ownerId: ctx.id, req })
    return reply.send({ data: { success: true } })
  })

  // ─── ME ──────────────────────────────────────────────────────────────────
  fastify.get('/me', { preHandler: requireCloudAuth }, async (req) => {
    const ctx = req.cloudOwner!
    return { data: { owner: { id: ctx.id, email: ctx.email, name: ctx.name } } }
  })

  // ─── VERIFY EMAIL — landing GET (NON consuma) ────────────────────────────────
  // Pre-fetch dei client email/antivirus possono "cliccare" i link: una GET che
  // consuma brucerebbe il token. La GET dice solo se il token è plausibile; la
  // conferma effettiva avviene con la POST (azione esplicita dell'utente).
  fastify.get('/verify-email', async (req, reply) => {
    const token = (req.query as Record<string, unknown>)?.['token']
    if (typeof token !== 'string' || token.length < 16) {
      return reply.code(400).send({ error: { code: 'INVALID_TOKEN', message: 'Token mancante o non valido' } })
    }
    const tokenHash = hashToken(token)
    const [row] = await cloudDb.select()
      .from(cloudEmailVerificationTokens)
      .where(and(
        eq(cloudEmailVerificationTokens.tokenHash, tokenHash),
        isNull(cloudEmailVerificationTokens.consumedAt),
        gt(cloudEmailVerificationTokens.expiresAt, new Date()),
      ))
      .limit(1)
    return reply.send({ data: { valid: !!row } })
  })

  // ─── VERIFY EMAIL — conferma POST (single-use atomico) ───────────────────────
  fastify.post('/verify-email', async (req, reply) => {
    const parsed = confirmVerifySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'INVALID_TOKEN', message: 'Token mancante o non valido' } })
    const tokenHash = hashToken(parsed.data.token)

    // Consumo atomico: solo una richiesta vince la corsa.
    const [consumed] = await cloudDb.update(cloudEmailVerificationTokens)
      .set({ consumedAt: new Date() })
      .where(and(
        eq(cloudEmailVerificationTokens.tokenHash, tokenHash),
        isNull(cloudEmailVerificationTokens.consumedAt),
        gt(cloudEmailVerificationTokens.expiresAt, new Date()),
      ))
      .returning()

    if (!consumed) return reply.code(400).send({ error: { code: 'INVALID_TOKEN', message: 'Link non valido o scaduto' } })

    await cloudDb.update(cloudOwners).set({ emailVerified: true, updatedAt: new Date() }).where(eq(cloudOwners.id, consumed.ownerId))
    await audit({ event: 'email_verified', ownerId: consumed.ownerId, req })
    return reply.send({ data: { verified: true } })
  })

  // ─── RESEND VERIFICATION ─────────────────────────────────────────────────────
  // Risposta 200 generica (anti-enumeration). Reinvia solo se l'owner esiste e NON è verificato.
  fastify.post('/resend-verification', async (req, reply) => {
    const parsed = emailOnlySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(200).send(GENERIC_EMAIL_SENT)
    const norm = normalizeEmail(parsed.data.email)
    const [owner] = await cloudDb.select().from(cloudOwners).where(eq(cloudOwners.email, norm)).limit(1)
    if (owner && !owner.emailVerified) {
      await sendVerificationEmail(owner.id, owner.name, norm).catch((err) => req.log.error({ err }, 'resend verify failed'))
      await audit({ event: 'verification_resent', ownerId: owner.id, req })
    }
    return reply.code(200).send(GENERIC_EMAIL_SENT)
  })

  // ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────
  // 200 generico sempre. Crea token reset solo se l'owner esiste E ha una password
  // (gli account solo-OAuth non ricevono link reset: nulla da resettare).
  fastify.post('/forgot-password', async (req, reply) => {
    const parsed = emailOnlySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(200).send(GENERIC_EMAIL_SENT)
    const norm = normalizeEmail(parsed.data.email)
    const [owner] = await cloudDb.select().from(cloudOwners).where(eq(cloudOwners.email, norm)).limit(1)

    if (owner?.passwordHash) {
      const { token, tokenHash } = generateUrlToken()
      await cloudDb.insert(cloudPasswordResetTokens).values({
        ownerId: owner.id,
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      })
      const tpl = resetPasswordTemplate({ name: owner.name, resetUrl: buildResetUrl(token) })
      await sendEmail({ to: norm, subject: tpl.subject, html: tpl.html }).catch((err) => req.log.error({ err }, 'reset email failed'))
    }
    await audit({ event: 'forgot_password_requested', ownerId: owner?.id ?? null, req })
    return reply.code(200).send(GENERIC_EMAIL_SENT)
  })

  // ─── RESET PASSWORD ──────────────────────────────────────────────────────────
  // Consumo atomico del token → imposta la nuova password → BUMP credentials_version
  // e REVOCA tutte le sessioni dell'owner (SEC-007). Verifica anche l'email (chi possiede
  // il link di reset ha dimostrato il controllo della casella).
  fastify.post('/reset-password', async (req, reply) => {
    const parsed = resetSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'INVALID_TOKEN', message: 'Dati non validi' } })

    const pwErr = passwordPolicyError(parsed.data.password)
    if (pwErr) return reply.code(400).send({ error: { code: 'WEAK_PASSWORD', message: pwErr } })

    const tokenHash = hashToken(parsed.data.token)
    const [consumed] = await cloudDb.update(cloudPasswordResetTokens)
      .set({ consumedAt: new Date() })
      .where(and(
        eq(cloudPasswordResetTokens.tokenHash, tokenHash),
        isNull(cloudPasswordResetTokens.consumedAt),
        gt(cloudPasswordResetTokens.expiresAt, new Date()),
      ))
      .returning()

    if (!consumed) return reply.code(400).send({ error: { code: 'INVALID_TOKEN', message: 'Link non valido o scaduto' } })

    const passwordHash = await hashPassword(parsed.data.password)
    // Bump credentials_version (Drizzle non ha increment helper qui: leggi+1 in tx logica).
    const [owner] = await cloudDb.select({ v: cloudOwners.credentialsVersion }).from(cloudOwners).where(eq(cloudOwners.id, consumed.ownerId)).limit(1)
    const nextVersion = (owner?.v ?? 0) + 1
    await cloudDb.update(cloudOwners).set({
      passwordHash,
      emailVerified: true,
      credentialsVersion: nextVersion,
      updatedAt: new Date(),
    }).where(eq(cloudOwners.id, consumed.ownerId))

    // Revoca TUTTE le sessioni: niente sessioni superstiti dopo un reset.
    await cloudDb.delete(cloudSessions).where(eq(cloudSessions.ownerId, consumed.ownerId))

    await audit({ event: 'password_reset', ownerId: consumed.ownerId, req })
    return reply.send({ data: { reset: true } })
  })
}
