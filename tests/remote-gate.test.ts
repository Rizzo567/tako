// F1.3 (P0) — Gate di sicurezza sul traffico che entra dal tunnel.
//
// È l'unico task che, sbagliato, mette il ristorante su internet. Qui si verifica il
// contratto in tre strati:
//   1. i PREDICATI di riconoscimento (unit, deterministici: nessuna dipendenza dal tunnel);
//   2. il gate END-TO-END contro il server vivo, marcando le richieste come provenienti dal
//      bordo Cloudflare (header CF-Ray) — deterministico anche senza tunnel attivo;
//   3. il ramo ALLOWLIST sull'Host, eseguito quando /api/system/info riporta un hostname
//      pubblico (cioè quando un tunnel è realmente configurato).
//
// Nota tecnica: `fetch` (undici) IGNORA silenziosamente un header `Host` impostato a mano,
// quindi le richieste che devono presentarsi con un Host arbitrario usano `node:http` grezzo.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import { seedTestEnv, SERVER, type TestEnv } from './helpers'
import { isRemoteRequest, isTrustedTunnelHost, rateLimitKey } from '../apps/server/src/middleware/remoteGate.js'
import type { FastifyRequest } from 'fastify'

let env: TestEnv
let close: () => Promise<void>
/** Hostname pubblico realmente configurato sul server sotto test (null = niente tunnel). */
let publicHost: string | null = null

const url = new URL(SERVER)
const HOSTNAME = url.hostname
const PORT = Number(url.port || 80)

interface RawRes { status: number; body: string }

/** Richiesta HTTP grezza: permette di forzare l'header Host (fetch non lo consente). */
function raw(path: string, opts: { method?: string; host?: string; headers?: Record<string, string> } = {}): Promise<RawRes> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: HOSTNAME,
        port: PORT,
        path,
        method: opts.method ?? 'GET',
        headers: { ...(opts.host ? { Host: opts.host } : {}), ...(opts.headers ?? {}) },
      },
      (res) => {
        let body = ''
        res.on('data', (c) => { body += c })
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
      },
    )
    req.on('error', reject)
    req.end()
  })
}

/** La risposta è il 404 OPACO del gate (non un 404 applicativo della route)? */
function isGate404(res: RawRes): boolean {
  if (res.status !== 404) return false
  try {
    const b = JSON.parse(res.body)
    return b?.error === 'Not Found' && b?.statusCode === 404 && String(b?.message ?? '').startsWith('Route ')
  } catch { return false }
}

// Marcatura "arriva dal bordo Cloudflare": è la condizione di fail-closed del gate.
const CF = { 'CF-Ray': '8a1b2c3d4e5f6789-FCO', 'CF-Connecting-IP': '203.0.113.7' }
const bearer = () => ({ Authorization: `Bearer ${env.staffToken}` })

beforeAll(async () => {
  ;({ env, close } = await seedTestEnv())
  const info = await fetch(`${SERVER}/api/system/info`).then((r) => r.json())
  publicHost = info?.data?.tunnel?.hostname ?? null
})
afterAll(async () => close())

// ─────────────────────────── 1. Predicati di riconoscimento ───────────────────────────

describe('riconoscimento del traffico remoto (predicati)', () => {
  const saved = process.env['TAKO_TUNNEL_HOSTNAME']
  afterAll(() => {
    if (saved === undefined) delete process.env['TAKO_TUNNEL_HOSTNAME']
    else process.env['TAKO_TUNNEL_HOSTNAME'] = saved
  })
  const req = (headers: Record<string, string>, ip = '192.168.1.20') =>
    ({ headers, ip } as unknown as FastifyRequest)

  it('Host === hostname pubblico → remoto e FIDATO (allowlist esatta)', () => {
    process.env['TAKO_TUNNEL_HOSTNAME'] = 'box.tako.test'
    expect(isTrustedTunnelHost(req({ host: 'box.tako.test' }))).toBe(true)
    expect(isTrustedTunnelHost(req({ host: 'box.tako.test:8443' }))).toBe(true)
    expect(isRemoteRequest(req({ host: 'box.tako.test' }))).toBe(true)
  })

  it('Host diverso e nessun header CF → LAN (comportamento invariato)', () => {
    process.env['TAKO_TUNNEL_HOSTNAME'] = 'box.tako.test'
    for (const h of ['localhost:3001', 'tako.local:3001', '192.168.1.50:3001', 'box.tako.test.evil.com']) {
      expect(isRemoteRequest(req({ host: h })), h).toBe(false)
      expect(isTrustedTunnelHost(req({ host: h })), h).toBe(false)
    }
  })

  it('header CF su Host non fidato → REMOTO (fail-closed) ma NON fidato', () => {
    process.env['TAKO_TUNNEL_HOSTNAME'] = 'box.tako.test'
    const r = req({ host: 'localhost:3001', 'cf-ray': 'abc-FCO', 'cf-connecting-ip': '203.0.113.7' })
    expect(isRemoteRequest(r)).toBe(true)   // più severi, mai meno
    expect(isTrustedTunnelHost(r)).toBe(false)
  })

  it('senza tunnel configurato e senza header CF il gate è un NO-OP', () => {
    delete process.env['TAKO_TUNNEL_HOSTNAME']
    expect(isRemoteRequest(req({ host: 'localhost:3001' }))).toBe(false)
    expect(isRemoteRequest(req({ host: 'box.tako.test' }))).toBe(false)
  })

  it('rate-limit: CF-Connecting-IP usato SOLO su Host fidato, mai per il solo header', () => {
    process.env['TAKO_TUNNEL_HOSTNAME'] = 'box.tako.test'
    // Dietro il tunnel: chiave = IP reale del client, non il loopback di cloudflared.
    expect(rateLimitKey(req({ host: 'box.tako.test', 'cf-connecting-ip': '203.0.113.7' }, '127.0.0.1'))).toBe('cf:203.0.113.7')
    // Host fidato ma senza header CF → secchio dedicato, non il budget della LAN.
    expect(rateLimitKey(req({ host: 'box.tako.test' }, '127.0.0.1'))).toBe('cf:unknown')
    // Client LAN che falsifica l'header: NON deve poter ruotare la propria chiave.
    expect(rateLimitKey(req({ host: 'localhost:3001', 'cf-connecting-ip': '203.0.113.7' }, '192.168.1.20'))).toBe('192.168.1.20')
  })
})

// ─────────────────────────── 2. Gate end-to-end (marcatura CF) ───────────────────────────

describe('gate remoto end-to-end — richiesta marcata come proveniente dal tunnel', () => {
  it('(a) nessun Bearer → 404 su tutto', async () => {
    for (const p of ['/api/tables', '/api/bills/open', '/api/orders/active', '/health', '/']) {
      const res = await raw(p, { headers: CF })
      expect(res.status, p).toBe(404)
    }
  })

  it('(a bis) il 404 del gate è indistinguibile da una rotta inesistente', async () => {
    const gated = await raw('/api/tables', { headers: CF })
    const genuine = await raw('/api/rotta-che-non-esiste-affatto', { headers: CF })
    expect(gated.status).toBe(404)
    expect(JSON.parse(gated.body)).toEqual({
      message: 'Route GET:/api/tables not found',
      error: 'Not Found',
      statusCode: 404,
    })
    // Stessa forma esatta: nessun oracolo che riveli "questa rotta esiste ma sei fuori".
    expect(Object.keys(JSON.parse(gated.body)).sort()).toEqual(Object.keys(JSON.parse(genuine.body)).sort())
  })

  it('(b) Bearer valido su /api/tables → 200', async () => {
    const res = await raw('/api/tables', { headers: { ...CF, ...bearer() } })
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body).data).toBeTruthy()
  })

  it('(c) /api/auth/pin-roster → 404 SEMPRE, anche con Bearer valido', async () => {
    expect((await raw('/api/auth/pin-roster', { headers: CF })).status).toBe(404)
    expect((await raw('/api/auth/pin-roster', { headers: { ...CF, ...bearer() } })).status).toBe(404)
  })

  it('/staff/ non è mai servita dal remoto, nemmeno autenticata', async () => {
    for (const p of ['/staff/index.html', '/staff/', '/staff']) {
      expect((await raw(p, { headers: { ...CF, ...bearer() } })).status, p).toBe(404)
    }
  })

  it('/api/setup/*, /internal/shutdown e il bootstrap-code WhatsApp restano LAN-only', async () => {
    expect((await raw('/api/setup/state', { headers: { ...CF, ...bearer() } })).status).toBe(404)
    expect((await raw('/internal/shutdown', { method: 'POST', headers: { ...CF, ...bearer() } })).status).toBe(404)
    expect((await raw('/api/whatsapp/bootstrap-code', { method: 'POST', headers: { ...CF, ...bearer() } })).status).toBe(404)
  })

  it('la deny-list non si aggira con maiuscole, doppie barre o slash finali', async () => {
    for (const p of ['/Staff/index.html', '//staff/index.html', '/staff/index.html/', '/API/Setup/state', '/%73taff/index.html', '/api/../staff/index.html', '/./staff/index.html']) {
      expect((await raw(p, { headers: { ...CF, ...bearer() } })).status, p).toBe(404)
    }
  })

  it('token invalido, scaduto o malformato → 404 (mai 401: nessun oracolo)', async () => {
    for (const t of ['non-esiste-questo-token-affatto-x', 'x', '"; drop table sessions; --', `${env.staffToken}x`]) {
      const res = await raw('/api/tables', { headers: { ...CF, Authorization: `Bearer ${t}` } })
      expect(res.status, t.slice(0, 12)).toBe(404)
    }
  })

  it('un utente disattivato perde subito anche l accesso remoto', async () => {
    const postgres = (await import('postgres')).default
    const sql = postgres(process.env['DATABASE_URL'] ?? 'postgresql://tako:tako@localhost:5432/takodb')
    try {
      await sql`update users set active = false where id = ${env.userId}`
      expect((await raw('/api/tables', { headers: { ...CF, ...bearer() } })).status).toBe(404)
      await sql`update users set active = true where id = ${env.userId}`
      expect((await raw('/api/tables', { headers: { ...CF, ...bearer() } })).status).toBe(200)
    } finally {
      await sql.end()
    }
  })
})

// ───────── 2 bis. Socket.io: sta SOTTO Fastify, il gate deve arrivarci lo stesso ─────────

describe('handshake Socket.io dal remoto', () => {
  const HS = '/socket.io/?EIO=4&transport=polling'

  it('handshake anonimo dal remoto → rifiutato (niente WebSocket anonimo su internet)', async () => {
    const res = await raw(HS, { headers: CF })
    expect(res.status).not.toBe(200)
    expect(res.body).not.toContain('"sid"')
  })

  it('handshake dal remoto con token valido in query → accettato', async () => {
    const res = await raw(`${HS}&token=${env.staffToken}`, { headers: CF })
    expect(res.status).toBe(200)
    expect(res.body).toContain('"sid"')
  })

  it('handshake dal remoto con token inventato → rifiutato', async () => {
    const res = await raw(`${HS}&token=questo-token-non-esiste-proprio`, { headers: CF })
    expect(res.status).not.toBe(200)
    expect(res.body).not.toContain('"sid"')
  })

  it('handshake in LAN resta anonimo come prima (PWA cliente, room pubbliche)', async () => {
    const res = await raw(HS, { host: `localhost:${PORT}` })
    expect(res.status).toBe(200)
    expect(res.body).toContain('"sid"')
  })
})

// ─────────────────────────── 3. La LAN non cambia ───────────────────────────

describe('(d) traffico LAN — comportamento invariato rispetto a prima del gate', () => {
  it('senza Bearer /api/tables risponde 401 (non 404): il gate non tocca la LAN', async () => {
    const res = await raw('/api/tables', { host: `localhost:${PORT}` })
    expect(res.status).toBe(401)
  })

  it('con Bearer valido /api/tables risponde 200', async () => {
    const res = await raw('/api/tables', { host: `localhost:${PORT}`, headers: bearer() })
    expect(res.status).toBe(200)
  })

  it('pin-roster in LAN è servito dalla ROUTE, mai bloccato dal gate', async () => {
    // Non si asserisce 200: con più ristoranti seminati la route stessa risponde 404
    // NEEDS_RESTAURANT (comportamento pre-esistente). Ciò che conta è che la risposta
    // arrivi dalla route (envelope {error:{code}}) e non sia il 404 opaco del gate.
    const res = await raw('/api/auth/pin-roster', { host: `localhost:${PORT}` })
    expect(isGate404(res)).toBe(false)
    expect([200, 404]).toContain(res.status)
    if (res.status === 404) expect(JSON.parse(res.body).error.code).toBe('NEEDS_RESTAURANT')
  })

  it('/staff/ e /health restano raggiungibili in LAN', async () => {
    expect((await raw('/staff/index.html', { host: `localhost:${PORT}` })).status).toBe(200)
    expect((await raw('/health', { host: `localhost:${PORT}` })).status).toBe(200)
  })
})

// ─────────────────────────── 4. Ramo allowlist sull'Host (se c'è un tunnel) ───────────────────────────

describe('allowlist sull Host — solo con un tunnel realmente configurato', () => {
  it('Host == hostname pubblico, SENZA header CF → gate attivo comunque', async () => {
    if (!publicHost) return // niente tunnel su questo server: ramo non applicabile
    expect((await raw('/api/tables', { host: publicHost })).status).toBe(404)
    expect((await raw('/staff/index.html', { host: publicHost, headers: bearer() })).status).toBe(404)
    expect((await raw('/api/tables', { host: publicHost, headers: bearer() })).status).toBe(200)
  })

  it('un Host che SOMIGLIA a quello pubblico non è quello pubblico', async () => {
    if (!publicHost) return
    // Suffisso: `evil.com` che finisce con l'hostname pubblico non deve passare per remoto,
    // e soprattutto non deve essere trattato come FIDATO dal rate-limit.
    const res = await raw('/api/tables', { host: `x${publicHost}` })
    expect(res.status).toBe(401) // trattato come LAN → 401 dalla route, non 404 dal gate
  })
})
