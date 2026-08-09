// ─────────────────────── Tako — GATE DI SICUREZZA SUL TRAFFICO DAL TUNNEL ───────────────────────
//
// Con il Cloudflare Tunnel l'appliance smette di essere solo un box in una LAN: diventa
// raggiungibile da internet. Questo hook è l'unica cosa che sta fra il ristorante e il resto
// del mondo, e vale la regola più stretta possibile:
//
//   Sull'hostname PUBBLICO il server risponde 404 a TUTTO ciò che non porta una sessione
//   valida — incluse la SPA /staff, le route di setup e il resolver PIN.
//
// Perché 404 e non 401/403: un 401 conferma che dietro quell'hostname c'è un Tako con un
// login da attaccare. Il 404 è indistinguibile da una rotta inesistente (il corpo è
// BYTE-IDENTICO a quello del not-found handler di Fastify) → dall'esterno l'appliance non
// autenticata è indistinguibile da un hostname vuoto.
//
// ── Riconoscimento del traffico remoto (la parte delicata) ────────────────────────────────
// Gli header aggiunti da Cloudflare (CF-Ray / CF-Connecting-IP) sono FALSIFICABILI da chi è
// già sulla LAN. La regola è quindi asimmetrica, e l'asimmetria è deliberata:
//
//   • GATE (quanto sono severo)  → REMOTO se  Host == remoteHost  OPPURE  header CF presenti.
//     Unione = fail-closed: se l'operatore dimentica TAKO_TUNNEL_HOSTNAME, il traffico che
//     arriva da Cloudflare resta comunque gated. Un client LAN che falsifica CF-Ray non
//     guadagna nulla: si auto-impone il regime PIÙ severo.
//
//   • FIDUCIA (di chi mi fido)   → solo se  Host == remoteHost  (allowlist esatta, il ripiego
//     previsto dal piano). È questa, e solo questa, la condizione che autorizza il rate-limit
//     a usare CF-Connecting-IP come chiave. Altrimenti un client LAN potrebbe evadere il
//     limite per-IP ruotando un CF-Connecting-IP inventato.
//
// Se `remoteHost()` è null e non arrivano header CF (appliance senza tunnel), l'hook è un
// NO-OP totale: la LAN si comporta esattamente come prima di questo file.
import type { FastifyRequest, FastifyReply } from 'fastify'
import type { IncomingMessage, IncomingHttpHeaders } from 'node:http'
import { db, sessions, users } from '@tako/db'
import { eq, and, gt } from 'drizzle-orm'
import { SESSION_COOKIE } from '../lib/cookies.js'
import { remoteHost } from '../lib/network.js'

// ── Superfici MAI esposte sul remoto, nemmeno con una sessione valida ─────────────────────
// Restano LAN-only per progetto: sono i punti in cui il possesso della rete locale È
// l'autenticazione, oppure che non hanno senso fuori dal locale.
const REMOTE_DENY_PREFIXES = [
  '/staff',          // SPA con form di login: non si espone un login a internet (D3)
  '/api/setup',      // pairing/bootstrap dell'appliance: prova = essere in LAN
  '/internal',       // contratto con la shell Tauri (/internal/shutdown), solo loopback
]
const REMOTE_DENY_EXACT = [
  '/api/auth/pin-roster',        // anonimo per progetto: su internet = enumerazione dello staff
  '/api/whatsapp/bootstrap-code', // il codice di collegamento si legge dalla dashboard, in LAN
]

// Percorso senza query string, normalizzato: niente doppie barre, niente maiuscole, niente
// slash finale. Un deny-list si aggira con /Staff/, //staff o /staff/../staff: qui no.
function normalizedPath(url: string): string {
  let p = (url.split('?')[0] ?? '/').toLowerCase()
  try { p = decodeURIComponent(p) } catch { /* percorso malformato: usa il grezzo */ }
  p = p.replace(/\/{2,}/g, '/')
  // Risolvi `.` e `..` PRIMA del confronto: /api/../staff/index.html non deve poter
  // presentarsi al deny-list con una faccia diversa da /staff/index.html.
  if (p.includes('..') || p.includes('./')) {
    const out: string[] = []
    for (const seg of p.split('/')) {
      if (seg === '' || seg === '.') continue
      if (seg === '..') { out.pop(); continue }
      out.push(seg)
    }
    p = '/' + out.join('/')
  }
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p || '/'
}

function isDeniedOnRemote(path: string): boolean {
  if (REMOTE_DENY_EXACT.includes(path)) return true
  return REMOTE_DENY_PREFIXES.some((pre) => path === pre || path.startsWith(pre + '/'))
}

// I predicati lavorano sugli HEADER GREZZI, non su FastifyRequest: lo stesso codice deve
// valere anche per l'handshake Socket.io, che vede una IncomingMessage e NON passa dagli
// hook di Fastify (vedi socketAllowRequest in fondo).

/** Hostname della richiesta, minuscolo e senza porta (`Host: box.tako.it:8443` → `box.tako.it`). */
function requestHost(headers: IncomingHttpHeaders): string {
  const raw = String(headers['host'] ?? '').trim().toLowerCase()
  if (!raw) return ''
  // IPv6 letterale: [::1]:3001 → [::1]
  if (raw.startsWith('[')) return raw.slice(0, raw.indexOf(']') + 1) || raw
  const i = raw.lastIndexOf(':')
  return i === -1 ? raw : raw.slice(0, i)
}

/** Host della richiesta === hostname pubblico configurato. Allowlist esatta = fiducia. */
export function isTrustedTunnelHeaders(headers: IncomingHttpHeaders): boolean {
  const expected = remoteHost()
  if (!expected) return false
  return requestHost(headers) === expected
}

/** Header aggiunti dal bordo Cloudflare. Indizio, non prova (falsificabili dalla LAN). */
function hasCloudflareHeaders(headers: IncomingHttpHeaders): boolean {
  return !!(headers['cf-ray'] || headers['cf-connecting-ip'])
}

/** Regime severo? Unione fail-closed: nel dubbio si è più severi, mai meno. */
export function isRemoteHeaders(headers: IncomingHttpHeaders): boolean {
  return isTrustedTunnelHeaders(headers) || hasCloudflareHeaders(headers)
}

/** Host della richiesta === hostname pubblico configurato (versione Fastify). */
export function isTrustedTunnelHost(req: FastifyRequest): boolean {
  return isTrustedTunnelHeaders(req.headers)
}

/**
 * La richiesta va trattata come REMOTA (regime severo)? Unione fail-closed fra allowlist
 * sull'Host e presenza di header CF: nel dubbio si sceglie sempre di essere più severi.
 */
export function isRemoteRequest(req: FastifyRequest): boolean {
  return isRemoteHeaders(req.headers)
}

// ── Estrazione e verifica della sessione ──────────────────────────────────────────────────
// Forma plausibile di un token di sessione (nanoid 32/64 → alfabeto url-safe). Il filtro
// serve a NON interrogare il DB per ogni spazzatura che arriva da internet: chi non porta
// nemmeno un token ben formato riceve 404 senza costare una query.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{16,200}$/

/** Valore di un cookie dall'header grezzo (l'handshake Socket.io non ha req.cookies). */
function cookieValue(headers: IncomingHttpHeaders, name: string): string | null {
  const raw = headers['cookie']
  if (!raw) return null
  for (const part of String(raw).split(';')) {
    const i = part.indexOf('=')
    if (i === -1) continue
    if (part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()) } catch { return part.slice(i + 1).trim() }
    }
  }
  return null
}

function extractToken(req: FastifyRequest, path: string): string | null {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim()
  if (bearer) return bearer
  const cookie = req.cookies?.[SESSION_COOKIE] ?? cookieValue(req.headers, SESSION_COOKIE)
  if (cookie) return cookie
  // Socket.io: in un browser l'upgrade WebSocket NON può portare header custom, quindi il
  // token viaggia in query (`?token=`). Lo accettiamo SOLO sul percorso /socket.io, e viene
  // verificato come tutti gli altri. Il resto dell'API non accetta token in query: finirebbe
  // nei log e nei referrer.
  if (path === '/socket.io' || path.startsWith('/socket.io/')) {
    const q = (req.query as Record<string, unknown> | undefined)?.['token']
    if (typeof q === 'string' && q) return q
  }
  return null
}

/**
 * Sessione staff viva? Stessa condizione di middleware/auth.ts (token non scaduto + utente
 * attivo) → revocare un dispositivo o disattivare un utente chiude anche l'accesso remoto,
 * senza un secondo elenco da tenere allineato.
 */
async function hasLiveSession(token: string): Promise<boolean> {
  if (!TOKEN_SHAPE.test(token)) return false
  try {
    const [row] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()), eq(users.active, true)))
      .limit(1)
    return !!row
  } catch {
    // DB non raggiungibile: FAIL-CLOSED. Sul remoto, in caso di dubbio, si nega.
    return false
  }
}

/** 404 byte-identico a quello del not-found handler di Fastify (nessun oracolo). */
function notFound(req: FastifyRequest, reply: FastifyReply) {
  return reply.code(404).send({
    message: `Route ${req.method}:${req.url} not found`,
    error: 'Not Found',
    statusCode: 404,
  })
}

/**
 * Hook `onRequest` da registrare PRIMA delle route. Sul traffico LAN non fa nulla; sul
 * traffico remoto applica deny-list e sessione obbligatoria.
 */
export async function remoteGate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!isRemoteRequest(req)) return // LAN: comportamento invariato, zero costo

  // PREFLIGHT CORS: un OPTIONS di preflight non porta MAI l'Authorization (lo dice la
  // specifica), quindi bloccarlo qui renderebbe irraggiungibile l'intero endpoint remoto
  // dall'app servita sull'origine LAN — cioè il dual-endpoint non funzionerebbe affatto.
  // Lasciarlo passare non apre nulla: @fastify/cors risponde 204 a QUALUNQUE OPTIONS, che
  // la rotta esista o no (nessun oracolo), senza corpo e senza effetti collaterali. La
  // richiesta vera che segue il preflight resta soggetta al gate.
  if (req.method === 'OPTIONS') return

  const path = normalizedPath(req.url)

  // 1) Superfici mai esposte: 404 SEMPRE, prima ancora di guardare la sessione. Una sessione
  //    valida non è un lasciapassare per /staff o /api/setup dal mondo esterno.
  if (isDeniedOnRemote(path)) {
    req.log.warn({ path, host: requestHost(req.headers) }, 'remote-gate: percorso LAN-only bloccato')
    await notFound(req, reply)
    return
  }

  // 2) Tutto il resto richiede una sessione VIVA. Nessuna eccezione: nemmeno /health, che
  //    dall'esterno non deve nemmeno confermare che qui c'è un'appliance. L'app owner si
  //    arruola in LAN (QR nella dashboard) e da quel momento ha un Bearer da mandare anche
  //    sulla sonda dell'endpoint remoto.
  const token = extractToken(req, path)
  if (!token || !(await hasLiveSession(token))) {
    await notFound(req, reply)
    return
  }

  // Sessione valida: la richiesta prosegue verso le route, che applicano comunque il loro
  // requireAuth/requireRole. Questo gate è uno strato IN PIÙ, non un sostituto.
  ;(req as FastifyRequest & { isRemote?: boolean }).isRemote = true
}

// ── Socket.io: l'hook Fastify NON basta ───────────────────────────────────────────────────
// Socket.io si attacca al server HTTP SOTTO Fastify (engine.io sostituisce i listener
// 'request' e gestisce anche l'evento 'upgrade'): le richieste a /socket.io NON passano
// mai dagli hook onRequest. Senza questa funzione il tunnel esporrebbe comunque un
// endpoint WebSocket a internet — handshake anonimo, room pubbliche (`join:menu`) e
// connessioni tenute aperte a piacere. `allowRequest` è il punto giusto: viene invocato
// sia dal transport polling sia dall'upgrade WebSocket, prima di creare la connessione.
//
// Deviazione consapevole rispetto al "404 su tutto": engine.io rifiuta con un proprio
// 403 (non con il 404 opaco di Fastify) perché il rifiuto avviene sotto il router. Non
// espone nulla — nessun dato, nessun form, nessuna enumerazione — ma è annotato qui
// perché è l'unico punto della superficie remota che non risponde 404.
export function socketAllowRequest(
  req: IncomingMessage,
  callback: (err: string | null, success: boolean) => void,
): void {
  try {
    if (!isRemoteHeaders(req.headers)) return callback(null, true) // LAN: invariato
    // Token dell'handshake: header (client non-browser), cookie di sessione, oppure query
    // `?token=` — l'unico canale disponibile all'upgrade WebSocket di un browser.
    const auth = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim()
    let token = auth || cookieValue(req.headers, SESSION_COOKIE) || null
    if (!token && req.url) {
      const q = req.url.indexOf('?')
      if (q !== -1) {
        const v = new URLSearchParams(req.url.slice(q + 1)).get('token')
        if (v) token = v
      }
    }
    if (!token) return callback('unauthorized', false)
    hasLiveSession(token)
      .then((ok) => callback(ok ? null : 'unauthorized', ok))
      .catch(() => callback('unauthorized', false))
  } catch {
    callback('unauthorized', false) // fail-closed
  }
}

/**
 * Chiave del rate-limit globale. Dietro il tunnel TUTTE le richieste arrivano dallo stesso
 * IP (cloudflared su loopback): senza questo, un solo telefono esaurirebbe il budget di
 * tutti. Si usa CF-Connecting-IP SOLO per le richieste su Host fidato (allowlist esatta),
 * mai per il semplice fatto che l'header c'è.
 */
export function rateLimitKey(req: FastifyRequest): string {
  if (isTrustedTunnelHost(req)) {
    const cf = req.headers['cf-connecting-ip']
    const ip = Array.isArray(cf) ? cf[0] : cf
    if (typeof ip === 'string' && ip.trim()) return `cf:${ip.trim()}`
    // Host fidato ma senza header CF (richiesta anomala): tutte insieme in un secchio
    // dedicato, così non consumano il budget della LAN.
    return 'cf:unknown'
  }
  return req.ip
}
