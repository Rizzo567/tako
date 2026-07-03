import type { FastifyRequest, FastifyReply } from 'fastify'
import { db, sessions, users } from '@tako/db'
import { eq, and, gt } from 'drizzle-orm'
import { SESSION_COOKIE, STAFF_SESSION_MAX_AGE, SESSION_REFRESH_AFTER_MS, authCookieOptions } from '../lib/cookies.js'

// Le sessioni PIN (tablet condiviso) usano un token nanoid(32); quelle staff
// long-lived un nanoid(64). Il refresh rolling si applica SOLO alle staff, così
// il login "resta" senza allungare le sessioni PIN a rischio più alto.
const STAFF_TOKEN_LEN = 64

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  // Preferisci il cookie HttpOnly; fallback al Bearer durante la transizione.
  const token = req.cookies?.[SESSION_COOKIE] ?? req.headers.authorization?.replace('Bearer ', '')
  if (!token) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } })

  const [session] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    // active=true: revoca immediata di un utente disattivato (le sue sessioni
    // residue non autenticano più, anche se il token non è ancora scaduto).
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()), eq(users.active, true)))
    .limit(1)

  if (!session) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } })

  // Refresh ROLLING della sessione staff: finché usi l'app, la scadenza si sposta
  // avanti (login persistente). Rinnova al più una volta al giorno per non scrivere
  // a ogni richiesta. Best-effort: un errore qui non deve bloccare la richiesta.
  if (token.length >= STAFF_TOKEN_LEN) {
    const remainingMs = session.session.expiresAt.getTime() - Date.now()
    const maxMs = STAFF_SESSION_MAX_AGE * 1000
    if (remainingMs < maxMs - SESSION_REFRESH_AFTER_MS) {
      try {
        await db.update(sessions).set({ expiresAt: new Date(Date.now() + maxMs) }).where(eq(sessions.token, token))
        reply.setCookie(SESSION_COOKIE, token, authCookieOptions(STAFF_SESSION_MAX_AGE))
      } catch { /* non-fatale: la sessione resta valida fino alla scadenza corrente */ }
    }
  }

  req.user = { id: session.user.id, restaurantId: session.user.restaurantId!, name: session.user.name, email: session.user.email, role: session.user.role }
}

export function requireRole(...roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(req, reply)
    // requireAuth ha già risposto 401: non inviare un secondo reply (evita FST_ERR_REP_ALREADY_SENT).
    if (reply.sent) return
    if (!req.user || !roles.includes(req.user.role)) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
    }
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: { id: string; restaurantId: string; name: string; email: string; role: string }
  }
}
