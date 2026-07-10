// Emissione della sessione cloud, condivisa tra login email/password (routes/cloud/auth.ts)
// e login OAuth (routes/cloud/oauth.ts). Centralizzata qui per NON duplicare la logica di
// creazione sessione + set-cookie + (eventuale) CSRF. Il token opaco va al client; a riposo
// salviamo solo l'HMAC (token_hash). Snapshot di credentials_version per invalidazione SEC-007.
import type { FastifyReply } from 'fastify'
import { cloudDb, cloudSessions } from './db.js'
import { generateSessionToken, generateCsrfToken, SESSION_TTL_MS } from './security.js'
import { cookieMode } from './config.js'
import {
  CLOUD_SESSION_COOKIE,
  CLOUD_CSRF_COOKIE,
  cloudSessionCookieOptions,
  csrfCookieOptions,
} from './cookies.js'

export interface IssueSessionOpts {
  ownerId: string
  credentialsVersion: number
  ip: string
  userAgent: string | null
}

/** Crea una sessione cloud, imposta i cookie (+ CSRF in crosssite) e ritorna il token opaco. */
export async function issueCloudSession(reply: FastifyReply, opts: IssueSessionOpts): Promise<void> {
  const { token, tokenHash } = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await cloudDb.insert(cloudSessions).values({
    ownerId: opts.ownerId,
    tokenHash,
    expiresAt,
    userAgent: opts.userAgent,
    ip: opts.ip,
    credentialsVersion: opts.credentialsVersion,
  })
  reply.setCookie(CLOUD_SESSION_COOKIE, token, cloudSessionCookieOptions(Math.floor(SESSION_TTL_MS / 1000)))
  if (cookieMode() === 'crosssite') {
    const csrf = generateCsrfToken()
    reply.setCookie(CLOUD_CSRF_COOKIE, csrf, csrfCookieOptions(Math.floor(SESSION_TTL_MS / 1000)))
  }
}
