import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import http from 'node:http'
import zlib from 'node:zlib'
import type { AddressInfo } from 'node:net'

// requireRole finto: registra i ruoli richiesti e li applica leggendo header di test (niente DB).
const auth = vi.hoisted(() => ({ roles: [] as string[] }))
vi.mock('../apps/server/src/middleware/auth.js', () => ({
  requireAuth: async () => {},
  requireRole: (...roles: string[]) => {
    auth.roles = roles
    return async (req: any, reply: any) => {
      const id = req.headers['x-test-user'], role = req.headers['x-test-role']
      if (!id) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } })
      req.user = { id, restaurantId: 'r1', name: 'T', email: 't@t', role }
      if (!roles.includes(String(role))) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
    }
  },
}))

import Fastify from '../apps/server/node_modules/fastify/fastify.js'
import {
  extractSiteBrand, guardedFetch, isBlockedAddress, parseCssColor, contrastRatio, normalizeColor, collectCssColors,
  rankBrandColors, suggestPalette, parsePage, createUserRateLimiter, validateSiteUrl, SiteBrandError,
  DEFAULT_TIMEOUT_MS, DEFAULT_MAX_BYTES, USER_AGENT, type SiteBrandDeps,
} from '../apps/server/src/lib/site-brand.js'
import { brandFromSiteRoutes } from '../apps/server/src/routes/brand-from-site.js'

const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64')

const PAGE = `<!doctype html><html><head>
<meta charset="utf-8"><meta name="theme-color" content="#E4572E">
<link rel="stylesheet" href="/ext.css"><link rel="icon" type="image/png" sizes="32x32" href="/icon.png">
<meta property="og:image" content="/og.png">
<style>
 body { background: #fdf6ec; color: #777777 }
 .btn { background-color: #e4572e } .btn:hover { background: #e4572e }
 .accent { color: rgb(46, 134, 171) } .ghost { color: rgba(10,10,10,0) } .muted{color:#eeeeee}
 .pill { border-color: hsl(140, 60%, 40%) }
</style></head><body><a style="color:#E4572E">Prenota</a></body></html>`

let server: http.Server, port = 0
const seen: http.IncomingHttpHeaders[] = []
const big = { aborted: false, sent: 0 }

beforeAll(async () => {
  server = http.createServer((req, res) => {
    seen.push(req.headers)
    const path = req.url ?? '/'
    if (path === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'set-cookie': 'sid=abc' }); return res.end(PAGE) }
    if (path === '/ext.css') { res.writeHead(200, { 'content-type': 'text/css' }); return res.end('.x{color:#6a4c93}.y{background:#6a4c93}') }
    if (path === '/icon.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(PNG_1x1) }
    if (path === '/gz') { res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' }); return res.end(zlib.gzipSync(PAGE)) }
    if (path === '/json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{}') }
    if (path === '/404') { res.writeHead(404, { 'content-type': 'text/html' }); return res.end('no') }
    if (path === '/redir-local') { res.writeHead(302, { location: `http://127.0.0.1:${port}/` }); return res.end() }
    if (path === '/redir-meta') { res.writeHead(301, { location: 'http://169.254.169.254/latest/meta-data' }); return res.end() }
    if (path === '/redir-file') { res.writeHead(302, { location: 'file:///etc/passwd' }); return res.end() }
    if (path === '/redir-ok') { res.writeHead(302, { location: '/' }); return res.end() }
    if (path === '/loop') { res.writeHead(302, { location: '/loop' }); return res.end() }
    if (path === '/hang') return // non risponde mai
    if (path === '/big') {
      res.writeHead(200, { 'content-type': 'text/html' })
      const chunk = Buffer.alloc(64 * 1024, 'a')
      res.on('close', () => { if (!res.writableFinished) big.aborted = true })
      const pump = () => {
        while (big.sent < 20 * 1024 * 1024) {
          big.sent += chunk.length
          if (!res.write(chunk)) return void res.once('drain', pump)
        }
        res.end()
      }
      return pump()
    }
    res.writeHead(404); res.end()
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  port = (server.address() as AddressInfo).port
})
afterAll(async () => { server.closeAllConnections?.(); await new Promise(r => server.close(r)) })

// Iniezione SOLO per i test: «brand.test» risolve al server locale ed è l'unico 127.0.0.1 ammesso.
const deps = (extra: SiteBrandDeps = {}): SiteBrandDeps => ({
  lookup: async host => {
    if (host === 'brand.test') return [{ address: '127.0.0.1', family: 4 }]
    if (host === 'evil.test') return [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }]
    if (host === 'rebind.test') return [{ address: '::ffff:192.168.1.1', family: 6 }]
    throw Object.assign(new Error('nx'), { code: 'ENOTFOUND' })
  },
  isAllowedAddress: (address, hostname) => (hostname === 'brand.test' && address === '127.0.0.1') || !isBlockedAddress(address),
  allowAnyPort: true,
  ...extra,
})
const site = (path = '/') => `http://brand.test:${port}${path}`

async function errorOf(p: Promise<unknown>): Promise<SiteBrandError> {
  try { await p } catch (e) { expect(e).toBeInstanceOf(SiteBrandError); return e as SiteBrandError }
  throw new Error('attesa una SiteBrandError')
}

describe('SSRF: indirizzi bloccati', () => {
  it.each([
    'http://127.0.0.1/', 'http://localhost/', 'http://foo.localhost/', 'http://10.0.0.5/', 'http://169.254.169.254/latest/meta-data',
    'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://2130706433/', 'http://0x7f.1/', 'http://017700000001/',
    'http://192.168.1.1/', 'http://172.20.0.1/', 'http://100.64.0.1/', 'http://0.0.0.0/', 'http://224.0.0.1/', 'http://255.255.255.255/',
    'http://[fe80::1]/', 'http://[fc00::1]/', 'http://[::]/', 'http://[64:ff9b::7f00:1]/', 'http://[2002:7f00:1::]/', 'http://metadata.google.internal/',
  ])('%s → SITE_BLOCKED senza rete', async url => {
    const e = await errorOf(extractSiteBrand(url))
    expect(e.code).toBe('SITE_BLOCKED')
    expect(e.status).toBe(422)
  })

  it('hostname che risolve (anche solo in parte) a IP privato → bloccato', async () => {
    expect((await errorOf(extractSiteBrand('http://evil.test/', deps()))).code).toBe('SITE_BLOCKED')
    expect((await errorOf(extractSiteBrand('http://rebind.test/', deps()))).code).toBe('SITE_BLOCKED')
  })

  it('DNS fallito → SITE_UNREACHABLE', async () => {
    expect((await errorOf(extractSiteBrand('http://nonesiste.test/', deps()))).code).toBe('SITE_UNREACHABLE')
  })

  it('isBlockedAddress: pubblici ammessi, mapped/NAT64 valutati sull’IPv4', () => {
    for (const ok of ['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111', '::ffff:8.8.8.8', '64:ff9b::808:808']) expect(isBlockedAddress(ok)).toBe(false)
    for (const ko of ['127.0.0.1', '169.254.169.254', '::ffff:10.1.2.3', '::ffff:7f00:1', 'fe80::1%lo0', 'ff02::1', '2001:db8::1', 'not-an-ip']) expect(isBlockedAddress(ko)).toBe(true)
  })
})

describe('SSRF: schemi, credenziali, porte', () => {
  it.each(['file:///etc/passwd', 'ftp://example.com/x', 'javascript:alert(1)', 'data:text/html,<b>x</b>', 'gopher://example.com/'])('%s → VALIDATION', async url => {
    const e = await errorOf(extractSiteBrand(url))
    expect(e.code).toBe('VALIDATION')
    expect(e.status).toBe(400)
  })
  it('credenziali nell’URL → VALIDATION', async () => {
    expect((await errorOf(extractSiteBrand('https://user:pass@example.com/'))).code).toBe('VALIDATION')
    expect((await errorOf(extractSiteBrand('https://user@example.com/'))).code).toBe('VALIDATION')
  })
  it('porte non standard → VALIDATION; 80/443 ammesse', () => {
    expect(() => validateSiteUrl('http://example.com:8080/')).toThrow(SiteBrandError)
    expect(() => validateSiteUrl('https://example.com:22/')).toThrow(SiteBrandError)
    expect(validateSiteUrl('http://example.com:443/').hostname).toBe('example.com')
    expect(validateSiteUrl('esempio.it').href).toBe('https://esempio.it/')
  })
})

describe('SSRF: redirect, limiti, timeout, header', () => {
  it('redirect verso 127.0.0.1 / metadata / file: → bloccati', async () => {
    expect((await errorOf(extractSiteBrand(site('/redir-local'), deps()))).code).toBe('SITE_BLOCKED')
    expect((await errorOf(extractSiteBrand(site('/redir-meta'), deps()))).code).toBe('SITE_BLOCKED')
    expect((await errorOf(extractSiteBrand(site('/redir-file'), deps()))).code).toBe('SITE_BLOCKED')
  })
  it('redirect relativo ammesso; loop oltre 3 salti → SITE_UNREACHABLE', async () => {
    expect((await extractSiteBrand(site('/redir-ok'), deps())).url).toBe(site('/'))
    expect((await errorOf(extractSiteBrand(site('/loop'), deps()))).code).toBe('SITE_UNREACHABLE')
  })
  it('risposta non HTML o status ≥ 400 → SITE_UNREACHABLE', async () => {
    expect((await errorOf(extractSiteBrand(site('/json'), deps()))).code).toBe('SITE_UNREACHABLE')
    const e = await errorOf(extractSiteBrand(site('/404'), deps()))
    expect(e.code).toBe('SITE_UNREACHABLE')
    expect(e.message).toContain('404')
  })
  it('oltre il limite di byte → errore e download interrotto', async () => {
    expect(DEFAULT_MAX_BYTES).toBe(2 * 1024 * 1024)
    const e = await errorOf(guardedFetch(site('/big'), 'html', deps()))
    expect(e.code).toBe('SITE_UNREACHABLE')
    expect(e.message).toMatch(/troppo grande/)
    await new Promise(r => setTimeout(r, 200))
    expect(big.aborted).toBe(true)
    expect(big.sent).toBeLessThan(20 * 1024 * 1024)
  })
  it('server che non risponde → timeout configurabile', async () => {
    const t0 = Date.now()
    const e = await errorOf(extractSiteBrand(site('/hang'), deps({ timeoutMs: 300 })))
    expect(e.code).toBe('SITE_UNREACHABLE')
    expect(Date.now() - t0).toBeLessThan(1500)
  })
  it('timeout di default ≈ 5 s (errore entro 5,5 s)', async () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(5000)
    const t0 = Date.now()
    const e = await errorOf(extractSiteBrand(site('/hang'), deps()))
    const elapsed = Date.now() - t0
    expect(e.code).toBe('SITE_UNREACHABLE')
    expect(elapsed).toBeGreaterThanOrEqual(4900)
    expect(elapsed).toBeLessThan(5500)
  }, 10_000)
  it('nessun cookie/Authorization in uscita, User-Agent fisso, Host originale', async () => {
    seen.length = 0
    await extractSiteBrand(site('/'), deps())
    expect(seen.length).toBeGreaterThan(1) // pagina + css + logo
    for (const h of seen) {
      expect(h.cookie).toBeUndefined()
      expect(h.authorization).toBeUndefined()
      expect(h['user-agent']).toBe(USER_AGENT)
      expect(h.host).toBe(`brand.test:${port}`)
    }
  })
})

describe('estrazione dal sito', () => {
  it('theme-color, colori CSS (inline + esterni), sfondo/testo, logo data URL, palette con contrasto ≥ 4.5', async () => {
    const out = await extractSiteBrand(site('/'), deps())
    expect(out.url).toBe(site('/'))
    expect(out.themeColor).toBe('#e4572e')
    expect(out.colors[0]).toBe('#e4572e')
    expect(out.colors).toEqual(expect.arrayContaining(['#2e86ab', '#6a4c93', normalizeColor('hsl(140, 60%, 40%)')]))
    expect(out.colors).not.toContain('#eeeeee')
    expect(out.colors).not.toContain('#777777')
    expect(out.colors.length).toBeLessThanOrEqual(8)
    expect(out.background).toBe('#fdf6ec')
    expect(out.text).toBe('#777777')
    expect(out.logo).toEqual({ dataUrl: `data:image/png;base64,${PNG_1x1.toString('base64')}`, source: 'icon', url: site('/icon.png') })
    expect(out.suggested.primary).toBe('#e4572e')
    expect(out.suggested.background).toBe('#fdf6ec')
    expect(contrastRatio('#777777', '#fdf6ec')).toBeLessThan(4.5)
    expect(out.suggested.text).toBe('#111111')
    expect(contrastRatio(out.suggested.text, out.suggested.background)).toBeGreaterThanOrEqual(4.5)
  })
  it('pagina compressa gzip', async () => {
    expect((await extractSiteBrand(site('/gz'), deps())).themeColor).toBe('#e4572e')
  })
  it('priorità logo: apple-touch-icon > icon (png/svg, più grande) > og:image > /favicon.ico', () => {
    const p = parsePage(`<link rel="icon" href="/a.ico"><link rel="icon" type="image/png" sizes="16x16" href="/s.png"><link rel="icon" type="image/png" sizes="192x192" href="/l.png"><meta property="og:image" content="https://cdn.x/og.jpg"><link rel="apple-touch-icon" href="/apple.png">`, 'https://x.it/menu')
    expect(p.icons.map(i => i.url)).toEqual(['https://x.it/apple.png', 'https://x.it/l.png', 'https://x.it/s.png', 'https://x.it/a.ico', 'https://cdn.x/og.jpg', 'https://x.it/favicon.ico'])
    expect(p.icons.map(i => i.source)).toEqual(['apple-touch-icon', 'icon', 'icon', 'icon', 'og:image', 'favicon'])
  })
  it('msapplication-TileColor come ripiego del theme-color', () => {
    expect(parsePage('<meta name="msapplication-TileColor" content="#123abc">', 'https://x.it/').themeColor).toBe('#123abc')
  })
})

describe('funzioni pure', () => {
  it('parseCssColor: hex 3/4/6/8, rgb/rgba, hsl, nomi, trasparenti', () => {
    expect(parseCssColor('#abc')).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc, a: 1 })
    expect(parseCssColor('#abcd')?.a).toBeCloseTo(0xdd / 255)
    expect(parseCssColor('#E4572E')).toEqual({ r: 228, g: 87, b: 46, a: 1 })
    expect(parseCssColor('#e4572e80')?.a).toBeCloseTo(128 / 255)
    expect(parseCssColor('rgb(46, 134, 171)')).toEqual({ r: 46, g: 134, b: 171, a: 1 })
    expect(parseCssColor('rgba(0,0,0,.5)')?.a).toBe(0.5)
    expect(parseCssColor('rgb(10 20 30 / 50%)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 })
    expect(normalizeColor('hsl(0, 100%, 50%)')).toBe('#ff0000')
    expect(normalizeColor('white')).toBe('#ffffff')
    expect(normalizeColor('transparent')).toBeNull()
    expect(normalizeColor('#e4572e10')).toBeNull()
    expect(parseCssColor('#12')).toBeNull()
    expect(parseCssColor('rgb(1,2)')).toBeNull()
    expect(parseCssColor('var(--x)')).toBeNull()
  })
  it('contrasto WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(4.5)
  })
  it('ranking: niente neutri, quasi-duplicati fusi, max 8', () => {
    const w = collectCssColors('a{color:#ffffff;background:#000;border-color:#888}b{color:#ff0000}b2{color:#ff0000}c{color:#fe0101}d{background:#00aa00}')
    expect(rankBrandColors(w)).toEqual(['#ff0000', '#00aa00'])
    const many = new Map(Array.from({ length: 20 }, (_, i) => [normalizeColor(`hsl(${i * 18}, 80%, 45%)`)!, 20 - i]))
    expect(rankBrandColors(many)).toHaveLength(8)
  })
  it('suggestPalette: sfondo scuro → bianco, testo con contrasto', () => {
    const s = suggestPalette({ themeColor: '#ffffff', colors: ['#0055aa'], background: '#101010', text: '#ffffff' })
    expect(s).toEqual({ primary: '#0055aa', background: '#ffffff', text: '#111111' })
    expect(suggestPalette({ themeColor: null, colors: ['#ffe2e0', '#0550ae'], background: null, text: null }).primary).toBe('#0550ae')
    expect(suggestPalette({ themeColor: null, colors: [], background: null, text: '#333333' })).toEqual({ primary: '#111111', background: '#ffffff', text: '#333333' })
  })
  it('rate limiter per utente a finestra mobile', () => {
    let t = 0
    const rl = createUserRateLimiter({ max: 2, windowMs: 1000, now: () => t })
    expect(rl.hit('u1').ok).toBe(true); expect(rl.hit('u1').ok).toBe(true)
    const r = rl.hit('u1'); expect(r.ok).toBe(false)
    expect(rl.hit('u2').ok).toBe(true)
    t = 1001; expect(rl.hit('u1').ok).toBe(true)
  })
})

describe('route POST /api/menu-workspace/brand-from-site', () => {
  const fake = { url: 'https://x.it/', themeColor: null, colors: [], background: null, text: null, logo: null, suggested: { primary: '#111111', background: '#ffffff', text: '#111111' } }
  async function app(extract = async () => fake) {
    const f = Fastify()
    await f.register(brandFromSiteRoutes, { prefix: '/api/menu-workspace', extract, limiter: createUserRateLimiter({ max: 6, windowMs: 60_000 }) })
    return f
  }
  const post = (f: any, headers: Record<string, string>, payload: unknown = { url: 'https://x.it' }) =>
    f.inject({ method: 'POST', url: '/api/menu-workspace/brand-from-site', headers, payload })

  it('usa requireRole(owner, menu_editor); 401 senza sessione, 403 senza ruolo', async () => {
    const f = await app()
    expect(auth.roles).toEqual(['owner', 'menu_editor'])
    expect((await post(f, {})).statusCode).toBe(401)
    const r = await post(f, { 'x-test-user': 'u', 'x-test-role': 'waiter' })
    expect(r.statusCode).toBe(403)
    expect(r.json().error.code).toBe('FORBIDDEN')
    expect((await post(f, { 'x-test-user': 'u', 'x-test-role': 'menu_editor' })).json()).toEqual({ data: fake })
    await f.close()
  })
  it('429 RATE_LIMIT oltre 6 richieste/minuto per utente (anche da loopback), altri utenti liberi', async () => {
    const f = await app()
    const h = { 'x-test-user': 'u-rl', 'x-test-role': 'owner' }
    for (let i = 0; i < 6; i++) expect((await post(f, h)).statusCode).toBe(200)
    const r = await post(f, h)
    expect(r.statusCode).toBe(429)
    expect(r.json().error.code).toBe('RATE_LIMIT')
    expect(r.headers['retry-after']).toBeDefined()
    expect((await post(f, { 'x-test-user': 'altro', 'x-test-role': 'owner' })).statusCode).toBe(200)
    await f.close()
  })
  it('validazione ed errori del sito con envelope, mai 500', async () => {
    const h = { 'x-test-user': 'u-err', 'x-test-role': 'owner' }
    let f = await app()
    const bad = await post(f, h, {})
    expect(bad.statusCode).toBe(400); expect(bad.json().error.code).toBe('VALIDATION')
    await f.close()
    f = await app(() => extractSiteBrand('file:///etc/passwd'))
    expect((await post(f, h)).json()).toEqual({ error: { code: 'VALIDATION', message: expect.any(String) } })
    await f.close()
    f = await app(() => extractSiteBrand('http://169.254.169.254/'))
    const blocked = await post(f, h)
    expect(blocked.statusCode).toBe(422); expect(blocked.json().error.code).toBe('SITE_BLOCKED')
    await f.close()
    f = await app(async () => { throw new Error('boom') })
    const odd = await post(f, h)
    expect(odd.statusCode).toBe(422); expect(odd.json().error.code).toBe('SITE_UNREACHABLE')
    await f.close()
  })
})
