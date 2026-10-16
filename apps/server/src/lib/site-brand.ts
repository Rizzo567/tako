import { Buffer } from 'node:buffer'
/**
 * Colori e logo del brand ricavati da una pagina web pubblica (onboarding
 * «Configura menu cliente»). Il fetch è protetto contro SSRF:
 * - solo http/https, niente credenziali, porte 80/443;
 * - DNS risolto da noi, TUTTI gli indirizzi validati, connessione all'IP
 *   verificato (lookup pinnato: niente DNS rebinding), SNI/Host originali;
 * - redirect manuali (max 3) rivalidati, timeout e limite di byte in streaming;
 * - nessun cookie/Authorization in uscita, User-Agent fisso.
 * Le dipendenze iniettabili (`SiteBrandDeps`) esistono SOLO per i test: non sono
 * raggiungibili da richieste HTTP né da variabili d'ambiente.
 */
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import zlib from 'node:zlib'
import { promises as dnsPromises } from 'node:dns'
import type { LookupAddress } from 'node:dns'
import type { Readable } from 'node:stream'

// ───────────────────────── Errori ─────────────────────────

export type SiteBrandErrorCode = 'VALIDATION' | 'SITE_BLOCKED' | 'SITE_UNREACHABLE'

export class SiteBrandError extends Error {
  constructor(public code: SiteBrandErrorCode, message: string) {
    super(message)
    this.name = 'SiteBrandError'
  }
  get status(): number { return this.code === 'VALIDATION' ? 400 : 422 }
}

const MSG = {
  invalid: "Indirizzo non valido: usa un link completo che inizia con http:// o https://.",
  credentials: "L'indirizzo non può contenere nome utente o password.",
  port: 'Porta non consentita: usa l’indirizzo pubblico del sito, senza porta.',
  blocked: 'Questo indirizzo non è consentito: indica il sito pubblico del locale.',
  timeout: 'Il sito non ha risposto in tempo. Riprova o controlla l’indirizzo.',
  dns: 'Sito non trovato: controlla di aver scritto bene l’indirizzo.',
  notHtml: 'L’indirizzo non porta a una pagina web.',
  tooLarge: 'La pagina è troppo grande da analizzare.',
  redirects: 'Il sito rimanda ad altri indirizzi troppe volte.',
  generic: 'Impossibile raggiungere il sito. Riprova tra poco.',
  status: (s: number) => `Il sito ha risposto con un errore (${s}).`,
}

// ───────────────────────── Indirizzi ─────────────────────────

function parseIPv4(ip: string): number[] | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  const out = parts.map(p => (/^\d{1,3}$/.test(p) ? Number(p) : NaN))
  return out.every(n => n >= 0 && n <= 255) ? out : null
}

/** IPv6 → 16 byte (gestisce `::` e la coda dotted IPv4). */
export function parseIPv6(input: string): number[] | null {
  let ip = input.replace(/^\[|\]$/g, '').split('%')[0]!.toLowerCase()
  if (!net.isIPv6(ip)) return null
  const tail: number[] = []
  const dotted = ip.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) {
    const v4 = parseIPv4(dotted[1]!)
    if (!v4) return null
    tail.push(...v4)
    ip = ip.slice(0, -dotted[1]!.length) + '0:0'
  }
  const [head, rest] = ip.includes('::') ? ip.split('::') as [string, string] : [ip, undefined]
  const h = head ? head.split(':') : []
  const r = rest !== undefined ? (rest ? rest.split(':') : []) : []
  const fill = rest !== undefined ? 8 - h.length - r.length : 0
  const groups = [...h, ...Array(fill).fill('0'), ...r]
  if (groups.length !== 8) return null
  const bytes: number[] = []
  for (const g of groups) { const n = parseInt(g, 16); bytes.push(n >> 8, n & 0xff) }
  if (tail.length) bytes.splice(12, 4, ...tail)
  return bytes
}

function v4Blocked([a, b, c]: number[]): boolean {
  return a === 0 || a === 10 || a === 127 || a! >= 224 // 0/8, 10/8, 127/8, multicast 224/4, riservati 240/4 e broadcast
    || (a === 100 && b! >= 64 && b! <= 127) // CGNAT 100.64/10
    || (a === 169 && b === 254) // link-local + metadata cloud
    || (a === 172 && b! >= 16 && b! <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && (c === 0 || c === 2)) // 192.0.0/24, TEST-NET-1
    || (a === 192 && b === 88 && c === 99) // relay 6to4
    || (a === 198 && (b === 18 || b === 19)) // benchmark
    || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)
}

/** true se l'indirizzo IP non è un unicast pubblico (loopback, privati, link-local, metadata, CGNAT, multicast, mapped…). */
export function isBlockedAddress(address: string): boolean {
  const v4 = parseIPv4(address)
  if (v4) return v4Blocked(v4)
  const b = parseIPv6(address)
  if (!b) return true
  const zero = (from: number, to: number) => b.slice(from, to).every(x => x === 0)
  // ::ffff:a.b.c.d (mapped) e ::a.b.c.d (compatibile, deprecato) → valuta l'IPv4 incorporato
  if (zero(0, 10) && b[10] === 0xff && b[11] === 0xff) return v4Blocked(b.slice(12))
  if (zero(0, 12)) return true // ::, ::1 e IPv4-compatibili
  // NAT64 64:ff9b::/96 → IPv4 incorporato; 64:ff9b:1::/48 locale → bloccato
  if (b[0] === 0 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) return zero(4, 12) ? v4Blocked(b.slice(12)) : true
  // 6to4 2002::/16 → IPv4 nei byte 2..5
  if (b[0] === 0x20 && b[1] === 0x02) return v4Blocked(b.slice(2, 6))
  // Teredo 2001::/32 e documentazione 2001:db8::/32
  if (b[0] === 0x20 && b[1] === 0x01 && ((b[2] === 0 && b[3] === 0) || (b[2] === 0x0d && b[3] === 0xb8))) return true
  // Ammessi solo gli unicast globali 2000::/3 (esclude fc00::/7, fe80::/10, ff00::/8, ::/8…)
  return (b[0]! & 0xe0) !== 0x20
}

const BLOCKED_HOSTS = /^(localhost|metadata\.google\.internal|metadata|instance-data)$|\.localhost$|\.internal$|\.local$/i

// ───────────────────────── Dipendenze (solo test) ─────────────────────────

export type LookupFn = (hostname: string) => Promise<LookupAddress[]>

export interface SiteBrandDeps {
  /** Risoluzione DNS. Default: dns.promises.lookup(host, {all:true}). */
  lookup?: LookupFn
  /** Require HTTPS on initial URL and every redirect. */
  httpsOnly?: boolean
  /** Policy sugli indirizzi risolti. Default: !isBlockedAddress(address). */
  isAllowedAddress?: (address: string, hostname: string) => boolean
  /** Ammette porte diverse da 80/443 (server di test locali). */
  allowAnyPort?: boolean
  /** Timeout della pagina in ms (default 5000). */
  timeoutMs?: number
  /** Limite byte della pagina/CSS (default 2 MB). */
  maxBytes?: number
  /** Limite byte del logo (default 1 MB). */
  maxLogoBytes?: number
}

export const DEFAULT_TIMEOUT_MS = 5000
export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024
export const DEFAULT_MAX_LOGO_BYTES = 1024 * 1024
const SUBRESOURCE_TIMEOUT_MS = 2500
const MAX_REDIRECTS = 3
export const USER_AGENT = 'TakoBrandFetcher/1.0 (+https://takoitalia.com)'

const defaultLookup: LookupFn = host => dnsPromises.lookup(host, { all: true, verbatim: true })

// ───────────────────────── Validazione URL ─────────────────────────

/** Valida schema/credenziali/porta/hostname. Non fa DNS. */
export function validateSiteUrl(raw: string, deps: SiteBrandDeps = {}): URL {
  let url: URL
  const text = String(raw ?? '').trim()
  try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`) } catch { throw new SiteBrandError('VALIDATION', MSG.invalid) }
  if (deps.httpsOnly && url.protocol !== 'https:') throw new SiteBrandError('VALIDATION', 'Usa un collegamento HTTPS pubblico.')
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new SiteBrandError('VALIDATION', MSG.invalid)
  if (url.username || url.password) throw new SiteBrandError('VALIDATION', MSG.credentials)
  if (url.port && !['80', '443'].includes(url.port) && !deps.allowAnyPort) throw new SiteBrandError('VALIDATION', MSG.port)
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (!host) throw new SiteBrandError('VALIDATION', MSG.invalid)
  if (BLOCKED_HOSTS.test(host)) throw new SiteBrandError('SITE_BLOCKED', MSG.blocked)
  url.hash = ''
  return url
}

/** Risolve l'hostname e restituisce l'indirizzo da usare; blocca se UN qualsiasi indirizzo non è ammesso. */
export async function resolveSafeAddress(url: URL, deps: SiteBrandDeps = {}): Promise<LookupAddress> {
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const allowed = deps.isAllowedAddress ?? ((a: string) => !isBlockedAddress(a))
  let addresses: LookupAddress[]
  if (net.isIP(host)) addresses = [{ address: host, family: net.isIP(host) }]
  else {
    try { addresses = await (deps.lookup ?? defaultLookup)(host) } catch { throw new SiteBrandError('SITE_UNREACHABLE', MSG.dns) }
  }
  if (!addresses.length) throw new SiteBrandError('SITE_UNREACHABLE', MSG.dns)
  if (addresses.some(a => !allowed(a.address, host))) throw new SiteBrandError('SITE_BLOCKED', MSG.blocked)
  return addresses[0]!
}

// ───────────────────────── Fetch protetto ─────────────────────────

export interface GuardedResponse { url: string; contentType: string; body: Buffer }
type Kind = 'html' | 'css' | 'image' | 'source'

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'])

function contentTypeOk(kind: Kind, ct: string): boolean {
  if (kind === 'source') return ['text/html', 'application/xhtml+xml', 'text/plain', 'text/csv', 'application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(ct)
  if (kind === 'html') return ct === 'text/html' || ct === 'application/xhtml+xml'
  if (kind === 'css') return ct === '' || ct === 'text/css' || ct === 'text/plain'
  return IMAGE_TYPES.has(ct)
}

const ACCEPT: Record<Kind, string> = {
  source: 'text/html,text/plain,text/csv,application/pdf,image/png,image/jpeg,image/webp',
  html: 'text/html,application/xhtml+xml;q=0.9',
  css: 'text/css,*/*;q=0.1',
  image: 'image/png,image/svg+xml,image/webp,image/*;q=0.8',
}

function requestOnce(url: URL, pinned: LookupAddress, kind: Kind, maxBytes: number, deadline: number): Promise<{ status: number; location?: string; contentType: string; body?: Buffer }> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) return reject(new SiteBrandError('SITE_UNREACHABLE', MSG.timeout))
    const mod = url.protocol === 'https:' ? https : http
    let settled = false
    const fail = (e: SiteBrandError) => { if (!settled) { settled = true; clearTimeout(timer); req.destroy(); reject(e) } }
    const done = (v: Parameters<typeof resolve>[0]) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v) } }
    const host = url.hostname.replace(/^\[|\]$/g, '')
    const req = mod.request({
      protocol: url.protocol,
      host,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      agent: false,
      // Pinning: il socket si connette SOLO all'indirizzo già validato.
      lookup: ((_h: string, opts: { all?: boolean }, cb: (...args: unknown[]) => void) => {
        if (opts?.all) cb(null, [{ address: pinned.address, family: pinned.family }])
        else cb(null, pinned.address, pinned.family)
      }) as unknown as net.LookupFunction,
      ...(url.protocol === 'https:' && !net.isIP(host) ? { servername: host } : {}),
      headers: { 'User-Agent': USER_AGENT, Accept: ACCEPT[kind], 'Accept-Encoding': 'gzip, deflate, br', 'Accept-Language': 'it,en;q=0.8', Connection: 'close' },
    })
    const timer = setTimeout(() => fail(new SiteBrandError('SITE_UNREACHABLE', MSG.timeout)), remaining)
    req.on('error', (e: NodeJS.ErrnoException) => fail(new SiteBrandError('SITE_UNREACHABLE', e.code === 'ENOTFOUND' ? MSG.dns : MSG.generic)))
    req.on('response', res => {
      const status = res.statusCode ?? 0
      const contentType = String(res.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase()
      if (status >= 300 && status < 400 && res.headers.location) { res.resume(); return done({ status, location: String(res.headers.location), contentType }) }
      if (status >= 400 || status < 200) { res.resume(); return fail(new SiteBrandError('SITE_UNREACHABLE', MSG.status(status))) }
      if (!contentTypeOk(kind, contentType)) { res.resume(); return fail(new SiteBrandError('SITE_UNREACHABLE', MSG.notHtml)) }
      const declared = Number(res.headers['content-length'])
      if (Number.isFinite(declared) && declared > maxBytes) return fail(new SiteBrandError('SITE_UNREACHABLE', MSG.tooLarge))
      const enc = String(res.headers['content-encoding'] ?? '').toLowerCase().trim()
      let stream: Readable = res
      if (enc === 'gzip' || enc === 'x-gzip') stream = res.pipe(zlib.createGunzip())
      else if (enc === 'deflate') stream = res.pipe(zlib.createInflate())
      else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress())
      const chunks: Buffer[] = []
      let size = 0
      stream.on('data', (chunk: Buffer) => {
        size += chunk.length
        // Limite sui byte DECOMPRESSI: interrompe subito (anche contro zip bomb).
        if (size > maxBytes) { if (stream !== res) stream.destroy(); return fail(new SiteBrandError('SITE_UNREACHABLE', MSG.tooLarge)) }
        chunks.push(chunk)
      })
      stream.on('error', () => fail(new SiteBrandError('SITE_UNREACHABLE', MSG.generic)))
      if (stream !== res) res.on('error', () => fail(new SiteBrandError('SITE_UNREACHABLE', MSG.generic)))
      res.on('aborted', () => fail(new SiteBrandError('SITE_UNREACHABLE', MSG.generic)))
      stream.on('end', () => done({ status, contentType, body: Buffer.concat(chunks) }))
    })
    req.end()
  })
}

/** GET con validazione SSRF a ogni salto, redirect manuali, timeout e limite di byte. */
export async function guardedFetch(rawUrl: string | URL, kind: Kind, deps: SiteBrandDeps = {}, opts: { timeoutMs?: number; maxBytes?: number } = {}): Promise<GuardedResponse> {
  const deadline = Date.now() + (opts.timeoutMs ?? deps.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const maxBytes = opts.maxBytes ?? deps.maxBytes ?? DEFAULT_MAX_BYTES
  let url = validateSiteUrl(String(rawUrl), deps)
  for (let hop = 0; ; hop++) {
    const pinned = await withDeadline(resolveSafeAddress(url, deps), deadline)
    const res = await requestOnce(url, pinned, kind, maxBytes, deadline)
    if (res.location !== undefined) {
      if (hop >= MAX_REDIRECTS) throw new SiteBrandError('SITE_UNREACHABLE', MSG.redirects)
      let next: URL
      try { next = new URL(res.location, url) } catch { throw new SiteBrandError('SITE_UNREACHABLE', MSG.generic) }
      if (next.protocol !== 'http:' && next.protocol !== 'https:') throw new SiteBrandError('SITE_BLOCKED', MSG.blocked)
      url = validateSiteUrl(next.href, deps)
      continue
    }
    return { url: url.href, contentType: res.contentType, body: res.body ?? Buffer.alloc(0) }
  }
}

function withDeadline<T>(p: Promise<T>, deadline: number): Promise<T> {
  const ms = deadline - Date.now()
  if (ms <= 0) return Promise.reject(new SiteBrandError('SITE_UNREACHABLE', MSG.timeout))
  let t: NodeJS.Timeout
  return Promise.race([p, new Promise<T>((_, rej) => { t = setTimeout(() => rej(new SiteBrandError('SITE_UNREACHABLE', MSG.timeout)), ms) })]).finally(() => clearTimeout(t))
}

// ───────────────────────── Colori (puri) ─────────────────────────

export interface Rgba { r: number; g: number; b: number; a: number }

const NAMED: Record<string, string> = { white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000', blue: '#0000ff', navy: '#000080', gray: '#808080', grey: '#808080', silver: '#c0c0c0', maroon: '#800000', orange: '#ffa500', gold: '#ffd700', purple: '#800080', teal: '#008080', ivory: '#fffff0', beige: '#f5f5dc', whitesmoke: '#f5f5f5' }

function clamp(n: number, lo = 0, hi = 255) { return Math.min(hi, Math.max(lo, n)) }
function num(token: string, scale: number): number {
  const t = token.trim()
  if (t.endsWith('%')) return (parseFloat(t) / 100) * scale
  return parseFloat(t)
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1)
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

/** Parsa un colore CSS (hex 3/4/6/8, rgb/rgba, hsl/hsla, pochi nomi). null se non riconosciuto. */
export function parseCssColor(input: string): Rgba | null {
  const s = input.trim().toLowerCase()
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  if (NAMED[s]) return parseCssColor(NAMED[s]!)
  let m = s.match(/^#([0-9a-f]{3,8})$/)
  if (m) {
    const h = m[1]!
    if (h.length === 3 || h.length === 4) {
      const [r, g, b, a] = h.split('').map(c => parseInt(c + c, 16))
      return { r: r!, g: g!, b: b!, a: a === undefined ? 1 : a / 255 }
    }
    if (h.length === 6 || h.length === 8) {
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 }
    }
    return null
  }
  m = s.match(/^(rgba?|hsla?)\(([^)]*)\)$/)
  if (!m) return null
  const parts = m[2]!.replace(/\s*\/\s*/, ',').split(/\s*,\s*|\s+/).filter(Boolean)
  if (parts.length < 3 || parts.length > 4) return null
  if (parts.some(p => !/^[-+]?\d*\.?\d+(%|deg)?$/.test(p))) return null
  const a = parts[3] !== undefined ? clamp(num(parts[3], 1), 0, 1) : 1
  if (m[1]!.startsWith('rgb')) {
    const [r, g, b] = parts.slice(0, 3).map(p => clamp(Math.round(num(p, 255))))
    return { r: r!, g: g!, b: b!, a }
  }
  const [r, g, b] = hslToRgb(parseFloat(parts[0]!), num(parts[1]!.endsWith('%') ? parts[1]! : parts[1]! + '%', 1), num(parts[2]!.endsWith('%') ? parts[2]! : parts[2]! + '%', 1))
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a }
}

export function toHex(c: { r: number; g: number; b: number }): string {
  return '#' + [c.r, c.g, c.b].map(v => clamp(Math.round(v)).toString(16).padStart(2, '0')).join('')
}

/** Normalizza a #rrggbb (null se trasparente o non valido). */
export function normalizeColor(input: string | null | undefined): string | null {
  if (!input) return null
  const c = parseCssColor(input)
  return c && c.a >= 0.5 ? toHex(c) : null
}

export function relativeLuminance(hex: string): number {
  const c = parseCssColor(hex)
  if (!c) return 0
  const lin = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
}

/** Rapporto di contrasto WCAG 2.x (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Colore «di brand»: né quasi bianco, né quasi nero, né grigio. */
export function isChromatic(hex: string): boolean {
  const c = parseCssColor(hex)
  if (!c) return false
  const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b)
  const l = (max + min) / 2 / 255
  return max - min >= 28 && l > 0.08 && l < 0.94
}

const COLOR_TOKEN = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|(?:rgba?|hsla?)\([^)]{1,80}\)/g

/** Estrae i colori da un testo CSS con un peso per proprietà (sfondi e custom property pesano doppio). */
export function collectCssColors(css: string, into: Map<string, number> = new Map()): Map<string, number> {
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const decl = /([-\w]+)\s*:\s*([^;{}]+)/g
  let m: RegExpExecArray | null
  while ((m = decl.exec(cleaned))) {
    const prop = m[1]!.toLowerCase()
    const weight = prop.startsWith('background') || prop === 'fill' || prop.startsWith('--') ? 2 : 1
    for (const token of m[2]!.match(COLOR_TOKEN) ?? []) {
      const hex = normalizeColor(token)
      if (hex) into.set(hex, (into.get(hex) ?? 0) + weight)
    }
  }
  return into
}

function rgbDistance(a: string, b: string): number {
  const x = parseCssColor(a)!, y = parseCssColor(b)!
  return Math.hypot(x.r - y.r, x.g - y.g, x.b - y.b)
}

/** Colori di brand ordinati per peso, senza neutri e con quasi-duplicati fusi. */
export function rankBrandColors(weights: Map<string, number>, limit = 8): string[] {
  const sorted = [...weights.entries()].filter(([hex]) => isChromatic(hex)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const merged: Array<[string, number]> = []
  for (const [hex, w] of sorted) {
    const near = merged.find(([h]) => rgbDistance(h, hex) < 18)
    if (near) near[1] += w
    else merged.push([hex, w])
  }
  return merged.sort((a, b) => b[1] - a[1]).slice(0, limit).map(([h]) => h)
}

export interface SuggestedPalette { primary: string; background: string; text: string }

/** Palette suggerita: testo sempre con contrasto ≥ 4.5:1 sullo sfondo. */
export function suggestPalette(input: { themeColor: string | null; colors: string[]; background: string | null; text: string | null }): SuggestedPalette {
  // «Saturo»: escludi pastelli e toni troppo scuri, così il primario regge come colore d'accento.
  const vivid = (hex: string) => { const c = parseCssColor(hex)!; const max = Math.max(c.r, c.g, c.b) / 255, min = Math.min(c.r, c.g, c.b) / 255, l = (max + min) / 2; const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1)); return sat >= 0.35 && l >= 0.18 && l <= 0.72 }
  const primary = (input.themeColor && isChromatic(input.themeColor) ? input.themeColor : null) ?? input.colors.find(vivid) ?? input.colors[0] ?? input.themeColor ?? '#111111'
  const background = input.background && relativeLuminance(input.background) >= 0.45 ? input.background : '#ffffff'
  const text = input.text && contrastRatio(input.text, background) >= 4.5
    ? input.text
    : contrastRatio('#111111', background) >= contrastRatio('#ffffff', background) ? '#111111' : '#ffffff'
  return { primary, background, text }
}

// ───────────────────────── HTML (puro) ─────────────────────────

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (_, e: string) => {
    const k = e.toLowerCase()
    if (k.startsWith('#x')) return String.fromCodePoint(parseInt(k.slice(2), 16))
    if (k.startsWith('#')) return String.fromCodePoint(parseInt(k.slice(1), 10))
    return ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' } as Record<string, string>)[k]!
  })
}

export function parseAttributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  const body = tag.replace(/^<\s*[\w:-]+/, '').replace(/\/?>$/, '')
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) out[m[1]!.toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
  return out
}

function tags(html: string, name: string): Array<Record<string, string>> {
  return (html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? []).map(parseAttributes)
}

export interface IconCandidate { url: string; source: 'apple-touch-icon' | 'icon' | 'og:image' | 'favicon'; size: number; type: string }

export interface ParsedPage {
  themeColor: string | null
  background: string | null
  text: string | null
  css: string[]
  stylesheets: string[]
  icons: IconCandidate[]
}

function declValue(css: string, props: string[]): string | null {
  let found: string | null = null
  const re = /([-\w]+)\s*:\s*([^;{}]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    if (!props.includes(m[1]!.toLowerCase())) continue
    const token = m[2]!.replace(/!important/i, '').trim()
    const color = normalizeColor(token) ?? normalizeColor(token.match(COLOR_TOKEN)?.[0] ?? token.split(/\s+/).find(t => parseCssColor(t)) ?? '')
    if (color) found = color
  }
  return found
}

/** Sfondo e testo dichiarati su html/body (regole CSS e attributi inline; vince l'ultima). */
function pageColors(cssBlocks: string[], html: string): { background: string | null; text: string | null } {
  let background: string | null = null, text: string | null = null
  const rule = /([^{}]+)\{([^{}]*)\}/g
  for (const css of cssBlocks) {
    const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '')
    let m: RegExpExecArray | null
    while ((m = rule.exec(cleaned))) {
      const selectors = m[1]!.split(',').map(s => s.trim().toLowerCase())
      if (!selectors.some(s => s === 'body' || s === 'html' || s === ':root')) continue
      background = declValue(m[2]!, ['background-color', 'background']) ?? background
      if (selectors.some(s => s === 'body' || s === 'html')) text = declValue(m[2]!, ['color']) ?? text
    }
  }
  for (const name of ['html', 'body']) {
    for (const attrs of tags(html, name)) {
      if (attrs.bgcolor) background = normalizeColor(attrs.bgcolor) ?? background
      if (attrs.text) text = normalizeColor(attrs.text) ?? text
      if (attrs.style) {
        background = declValue(attrs.style, ['background-color', 'background']) ?? background
        text = declValue(attrs.style, ['color']) ?? text
      }
    }
  }
  return { background, text }
}

/** Analizza l'HTML: theme-color, CSS inline, fogli esterni e candidati logo (URL assoluti). */
export function parsePage(html: string, pageUrl: string): ParsedPage {
  const head = html.slice(0, 600_000)
  const baseHref = tags(head, 'base').find(a => a.href)?.href
  let base: URL
  try { base = new URL(baseHref ?? pageUrl, pageUrl) } catch { base = new URL(pageUrl) }
  const abs = (href: string) => { try { const u = new URL(href.trim(), base); return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null } catch { return null } }

  let themeColor: string | null = null, tileColor: string | null = null
  const icons: IconCandidate[] = []
  for (const meta of tags(head, 'meta')) {
    const name = (meta.name ?? meta.property ?? '').toLowerCase()
    if (name === 'theme-color' && !themeColor) {
      const media = (meta.media ?? '').toLowerCase()
      if (!media.includes('dark')) themeColor = normalizeColor(meta.content)
    } else if (name === 'msapplication-tilecolor' && !tileColor) tileColor = normalizeColor(meta.content)
    else if ((name === 'og:image' || name === 'og:image:url' || name === 'og:image:secure_url') && meta.content) {
      const url = abs(meta.content)
      if (url && !icons.some(i => i.source === 'og:image')) icons.push({ url, source: 'og:image', size: 0, type: '' })
    }
  }
  if (!themeColor) themeColor = tileColor ?? (() => { for (const meta of tags(head, 'meta')) if ((meta.name ?? '').toLowerCase() === 'theme-color') { const c = normalizeColor(meta.content); if (c) return c } return null })()

  const stylesheets: string[] = []
  for (const link of tags(head, 'link')) {
    const rel = (link.rel ?? '').toLowerCase().split(/\s+/)
    if (!link.href) continue
    const url = abs(link.href)
    if (!url) continue
    if (rel.includes('stylesheet') && !rel.includes('alternate')) { if (!stylesheets.includes(url)) stylesheets.push(url); continue }
    const source = rel.includes('apple-touch-icon') || rel.includes('apple-touch-icon-precomposed') ? 'apple-touch-icon' : rel.includes('icon') ? 'icon' : null
    if (!source) continue
    const size = Math.max(0, ...(link.sizes ?? '').toLowerCase().split(/\s+/).map(s => (s === 'any' ? 1024 : parseInt(s, 10) || 0)))
    icons.push({ url, source, size, type: (link.type ?? '').toLowerCase() })
  }
  const typeScore = (i: IconCandidate) => (/svg/.test(i.type) || /\.svg(\?|$)/i.test(i.url) ? 3 : /png/.test(i.type) || /\.png(\?|$)/i.test(i.url) ? 2 : /\.ico(\?|$)/i.test(i.url) || /icon/.test(i.type) ? 0 : 1)
  const rank = { 'apple-touch-icon': 0, icon: 1, 'og:image': 2, favicon: 3 }
  icons.sort((a, b) => rank[a.source] - rank[b.source] || (a.source === 'icon' ? typeScore(b) - typeScore(a) : 0) || b.size - a.size)
  const fav = abs('/favicon.ico')
  if (fav && !icons.some(i => i.url === fav)) icons.push({ url: fav, source: 'favicon', size: 0, type: 'image/x-icon' })

  const css: string[] = []
  for (const m of head.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) css.push(m[1]!)
  const inline = [...html.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map(m => decodeEntities(m[1] ?? m[2] ?? '')).join(';\n')
  if (inline) css.push(inline)
  const { background, text } = pageColors(css, head)
  return { themeColor, background, text, css, stylesheets, icons }
}

// ───────────────────────── Orchestrazione ─────────────────────────

export interface SiteBrandLogo { dataUrl: string; source: IconCandidate['source']; url: string }
export interface SiteBrand {
  url: string
  themeColor: string | null
  colors: string[]
  background: string | null
  text: string | null
  logo: SiteBrandLogo | null
  suggested: SuggestedPalette
}

function sniffImage(buf: Buffer): string | null {
  if (buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'image/png'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  if (buf.subarray(0, 4).toString('ascii') === 'GIF8') return 'image/gif'
  if (buf.subarray(0, 4).toString('hex') === '00000100') return 'image/x-icon'
  if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype svg[^>]*>\s*)?<svg[\s>]/i.test(buf.subarray(0, 2048).toString('utf8'))) return 'image/svg+xml'
  return null
}

async function fetchLogo(icons: IconCandidate[], deps: SiteBrandDeps, budgetMs: number): Promise<SiteBrandLogo | null> {
  // Budget unico per tutti i candidati: un sito lento non allunga la risposta oltre il budget.
  const deadline = Date.now() + budgetMs
  for (const icon of icons.slice(0, 4)) {
    const remaining = deadline - Date.now()
    if (remaining < 100) break
    try {
      const res = await guardedFetch(icon.url, 'image', deps, { timeoutMs: remaining, maxBytes: deps.maxLogoBytes ?? DEFAULT_MAX_LOGO_BYTES })
      // Il tipo reale deve essere un'immagine ammessa: non ci fidiamo solo dell'header.
      const mime = sniffImage(res.body)
      if (!mime || !res.body.length) continue
      return { dataUrl: `data:${mime};base64,${res.body.toString('base64')}`, source: icon.source, url: res.url }
    } catch { /* prova il candidato successivo */ }
  }
  return null
}

/** Legge la pagina pubblica e ne ricava colori e logo del brand. */
export async function extractSiteBrand(rawUrl: string, deps: SiteBrandDeps = {}): Promise<SiteBrand> {
  const page = await guardedFetch(rawUrl, 'html', deps)
  const parsed = parsePage(page.body.toString('utf8'), page.url)
  const subTimeout = Math.min(SUBRESOURCE_TIMEOUT_MS, deps.timeoutMs ?? SUBRESOURCE_TIMEOUT_MS)
  const [sheets, logo] = await Promise.all([
    Promise.all(parsed.stylesheets.slice(0, 2).map(href => guardedFetch(href, 'css', deps, { timeoutMs: subTimeout }).then(r => r.body.toString('utf8'), () => ''))),
    fetchLogo(parsed.icons, deps, subTimeout),
  ])
  const weights = new Map<string, number>()
  for (const css of parsed.css) collectCssColors(css, weights)
  for (const css of sheets) if (css) collectCssColors(css, weights)
  const external = sheets.length ? pageColors(sheets.filter(Boolean), '') : { background: null, text: null }
  // Gli stili inline della pagina vincono su quelli esterni (vengono dopo nel cascade).
  const background = parsed.background ?? external.background
  const text = parsed.text ?? external.text
  const colors = rankBrandColors(weights)
  return {
    url: page.url,
    themeColor: parsed.themeColor,
    colors,
    background,
    text,
    logo,
    suggested: suggestPalette({ themeColor: parsed.themeColor, colors, background, text }),
  }
}

// ───────────────────────── Rate limit per utente ─────────────────────────

/** Finestra mobile in memoria, chiave = id utente (vale anche da loopback). */
export function createUserRateLimiter(opts: { max: number; windowMs: number; now?: () => number }) {
  const hits = new Map<string, number[]>()
  const now = opts.now ?? Date.now
  return {
    hit(key: string): { ok: true } | { ok: false; retryAfterSec: number } {
      const t = now()
      if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(x => t - x < opts.windowMs)) hits.delete(k)
      const recent = (hits.get(key) ?? []).filter(x => t - x < opts.windowMs)
      if (recent.length >= opts.max) {
        hits.set(key, recent)
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((recent[0]! + opts.windowMs - t) / 1000)) }
      }
      recent.push(t)
      hits.set(key, recent)
      return { ok: true }
    },
  }
}
