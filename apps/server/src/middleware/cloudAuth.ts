// Middleware del modo cloud: risoluzione sessione owner + protezione CSRF.
// SEPARATO da middleware/auth.ts (modo local), che resta invariato.
import type { FastifyRequest, FastifyReply } from 'fastify'
import { timingSafeEqual } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { cloudDb, cloudSessions, cloudOwners } from '../cloud/db.js'
import { hashToken } from '../cloud/security.js'
import { CLOUD_SESSION_COOKIE, CLOUD_CSRF_COOKIE, CSRF_HEADER } from '../cloud/cookies.js'
import { cookieMode } from '../cloud/config.js'

export interface CloudOwnerCtx {
  id: string
  email: string
  name: string | null
  sessionId: string
}

declare module 'fastify' {
  interface FastifyRequest {
    cloudOwner?: CloudOwnerCtx
  }
}

/**
 * Risolve la sessione cloud dal cookie opaco. Verifica:
 *  - scadenza sessione;
 *  - che il `credentials_version` snapshot della sessione combaci con quello attuale
 *    dell'owner (un reset/cambio-pw bumpa la versione → invalida le vecchie sessioni, SEC-007).
 * Popola req.cloudOwner. Risponde 401 se assente/invalida.
 */
export async function requireCloudAuth(req: FastifyRequest, reply: FastifyReply) {
  // Solo cookie (niente Bearer nel cloud: superficie XSS ridotta).
  const token = req.cookies?.[CLOUD_SESSION_COOKIE]
  if (!token) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Sessione assente' } })

  const tokenHash = hashToken(token)
  const [row] = await cloudDb
    .select({ session: cloudSessions, owner: cloudOwners })
    .from(cloudSessions)
    .innerJoin(cloudOwners, eq(cloudSessions.ownerId, cloudOwners.id))
    .where(and(eq(cloudSessions.tokenHash, tokenHash), gt(cloudSessions.expiresAt, new Date())))
    .limit(1)

  if (!row) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Sessione non valida o scaduta' } })

  // Snapshot credentials_version: se l'owner ha bumpato (reset), la sessione è stale.
  if (row.session.credentialsVersion !== row.owner.credentialsVersion) {
    return reply.code(401).send({ error: { code: 'SESSION_STALE', message: 'Sessione revocata. Esegui di nuovo l’accesso.' } })
  }

  req.cloudOwner = {
    id: row.owner.id,
    email: row.owner.email,
    name: row.owner.name,
    sessionId: row.session.id,
  }
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Confronto CSRF in TEMPO COSTANTE (NEW-03). Evita un timing oracle sul token double-submit.
 * `timingSafeEqual` richiede buffer di pari lunghezza: gestiamo lunghezze diverse senza throw
 * (ritorno false) ma confrontando comunque per non rivelare la lunghezza via early-return.
 */
function csrfTokensMatch(header: string | undefined, cookie: string | undefined): boolean {
  if (!header || !cookie) return false
  const a = Buffer.from(header, 'utf8')
  const b = Buffer.from(cookie, 'utf8')
  if (a.length !== b.length) {
    // Lunghezze diverse → sicuramente diversi. Eseguiamo comunque un confronto fittizio
    // della stessa lunghezza per non introdurre un early-return dipendente dalla lunghezza.
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}

/**
 * Protezione CSRF (double-submit) attiva SOLO in COOKIE_MODE=crosssite.
 * Sui metodi che mutano stato richiede l'header X-Tako-CSRF uguale al cookie CSRF.
 * In samesite è un no-op (SameSite=Lax basta). Va montato DOPO requireCloudAuth.
 */
export async function requireCsrf(req: FastifyRequest, reply: FastifyReply) {
  if (cookieMode() !== 'crosssite') return
  if (!UNSAFE_METHODS.has(req.method.toUpperCase())) return

  const headerToken = req.headers[CSRF_HEADER]
  const cookieToken = req.cookies?.[CLOUD_CSRF_COOKIE]
  const header = Array.isArray(headerToken) ? headerToken[0] : headerToken

  if (!csrfTokensMatch(header, cookieToken)) {
    return reply.code(403).send({ error: { code: 'CSRF', message: 'Token CSRF mancante o non valido' } })
  }
}
