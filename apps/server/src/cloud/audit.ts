// Audit log di sicurezza cloud (§7bis). Scrive una riga in cloud_audit_log per gli
// eventi sensibili (login/register/reset/verify/forgot/logout). Best-effort: un
// errore di scrittura audit NON deve far fallire la richiesta dell'utente.
import type { FastifyRequest } from 'fastify'
import { cloudDb, cloudAuditLog } from './db.js'

export type AuditEvent =
  | 'register'
  | 'login_success'
  | 'login_failed'
  | 'login_email_not_verified'
  | 'logout'
  | 'forgot_password_requested'
  | 'password_reset'
  | 'email_verified'
  | 'verification_resent'

interface AuditInput {
  event: AuditEvent
  ownerId?: string | null
  req: FastifyRequest
  meta?: Record<string, unknown>
}

export async function audit({ event, ownerId, req, meta }: AuditInput): Promise<void> {
  try {
    await cloudDb.insert(cloudAuditLog).values({
      ownerId: ownerId ?? null,
      event,
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
      meta: meta ?? {},
    })
  } catch (err) {
    req.log.error({ err, event }, 'cloud audit log write failed')
  }
}
