import type { FastifyReply, FastifyRequest } from 'fastify'
/** Hosted operational runtime; distinct from the cloud identity/control plane. */
import { remoteStorageConfig } from './remote-image-store.js'

export function isWebMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env['TAKO_MODE'] ?? 'local').toLowerCase() === 'web'
}

export function webOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env['WEB_ORIGIN']?.trim()
  if (!raw) throw new Error('TAKO_MODE=web requires WEB_ORIGIN')
  const url = new URL(raw)
  const developmentHttp = env['NODE_ENV'] === 'development' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
  if ((url.protocol !== 'https:' && !developmentHttp) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('WEB_ORIGIN must be HTTPS; only development permits HTTP localhost/127.0.0.1, without credentials, path, query or fragment')
  }
  return url.origin
}

export function validateWebRuntime(env: NodeJS.ProcessEnv = process.env): void {
  if (!isWebMode(env)) return
  webOrigin(env)
  const database = env['DATABASE_URL']
  if (!database || !/^postgres(?:ql)?:\/\//.test(database)) throw new Error('Web runtime requires managed DATABASE_URL')
  const host = new URL(database).hostname.toLowerCase()
  if (['localhost', '127.0.0.1', '[::1]'].includes(host)) throw new Error('Web DATABASE_URL must not use the embedded local database')
  const secret = env['JWT_SECRET'] ?? ''
  if (secret.length < 32 || /^(.)\1+$/.test(secret) || /change.?me|example|placeholder/i.test(secret)) {
    throw new Error('Web runtime requires a strong JWT_SECRET of at least 32 characters')
  }
  if (env['EMBEDDED_DB'] === '1' || env['TAKO_HTTPS'] === '1') throw new Error('Web runtime uses external database and proxy TLS')
  if (env['UPLOADS_DRIVER'] === 'supabase') remoteStorageConfig(env)
  else if (!env['UPLOADS_DIR']?.startsWith('/')) throw new Error('Web runtime requires absolute persistent UPLOADS_DIR')
  webServerHost(env)
  if (!isLoopbackWebDevelopment(env) && !env['TRUST_PROXY']) throw new Error('Web runtime requires explicit TRUST_PROXY addresses for the TLS proxy')
}

/** Strict browser boundary for cookie-auth writes (also blocks sibling-domain CSRF). */
export function webRequestAllowed(method: string, origin: string | undefined, expected: string): boolean {
  if (origin) return origin === expected
  return ['GET', 'HEAD', 'OPTIONS'].includes(method)
}

/** Former local-appliance endpoints (shutdown, pairing, LAN printing, global WhatsApp
 * credentials, PIN login). They always answer with the same explicit 404. */
export const WEB_UNAVAILABLE_PREFIXES = ['/internal', '/api/setup', '/api/print', '/api/whatsapp', '/api/auth/device', '/api/auth/pin-roster', '/api/auth/pin-login', '/api/bills', '/api/inventory', '/api/shifts', '/api/devices', '/api/insights', '/api/ai/owner/chat/stream', '/api/customer/takeaway']

/** onRequest boundary of the web service: unavailable appliance paths, then the
 * strict browser-origin check for cookie-authenticated writes. */
export function webBoundary(publicOrigin: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Twilio authenticates this exact server-to-server POST with its signature, never cookies.
    if(request.method==='POST'&&request.url==='/api/whatsapp/twilio')return
    let path: string
    try { path = decodeURIComponent(request.url.split('?')[0]!) } catch { return reply.code(400).send({ error: { code: 'INVALID_PATH', message: 'Percorso non valido.' } }) }
    if (WEB_UNAVAILABLE_PREFIXES.some(prefix => path === prefix || path.startsWith(prefix + '/'))) {
      return reply.code(404).send({ error: { code: 'NOT_AVAILABLE_WEB', message: 'Funzione non disponibile nel servizio web.' } })
    }
    const tableConfiguration = /^\/api\/tables\/[^/]+\/qr(?:\/|$)/.test(path) || (/^\/api\/tables(?:\/|$)/.test(path) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !/^\/api\/tables\/[^/]+\/(status|waiter-resolve)$/.test(path))
    if (tableConfiguration) {
      return reply.code(404).send({ error: { code: 'NOT_AVAILABLE_WEB', message: 'Configurazione tavoli non disponibile.' } })
    }
    if (!webRequestAllowed(request.method, request.headers.origin, publicOrigin)) {
      return reply.code(403).send({ error: { code: 'ORIGIN_REJECTED', message: 'Origine della richiesta non autorizzata.' } })
    }
  }
}

/** The browser origin may use HTTP only for development confined to this machine. */
export function isLoopbackWebDevelopment(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isWebMode(env) || env['NODE_ENV'] !== 'development') return false
  const origin = new URL(webOrigin(env))
  return ['localhost', '127.0.0.1'].includes(origin.hostname)
}

export function webServerHost(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env['SERVER_HOST']?.trim()
  if (isLoopbackWebDevelopment(env)) {
    if (configured && !['localhost', '127.0.0.1'].includes(configured)) {
      throw new Error('Development web runtime must bind SERVER_HOST=localhost or 127.0.0.1')
    }
    return configured || '127.0.0.1'
  }
  return configured || '0.0.0.0'
}

export function webSocketOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const origin = new URL(webOrigin(env))
  origin.protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:'
  return origin.origin
}
