import { Buffer } from 'node:buffer'
import { isIP } from 'node:net'
import { guardedFetch, validateSiteUrl, isBlockedAddress, parsePage, parseAttributes, collectCssColors, rankBrandColors, type SiteBrandDeps } from './site-brand.js'

export type OnboardingSource = {
  url: string; kind: 'html' | 'pdf' | 'image' | 'text'; text?: string; name?: string
  logoUrl?: string; colors?: string[]; menuLinks?: string[]
  contacts?: { emails: string[]; phones: string[] }; warnings: string[]
}
export interface OnboardingSourceDeps extends SiteBrandDeps {
  /** Server-provided OCR adapter; source documents never choose providers or tools. */
  ocrImage?: (bytes: Buffer, contentType: string) => Promise<string>
}
const MAX_BYTES = 8 * 1024 * 1024
const MAX_TEXT = 60_000
const NOTICE = 'Controlla *piatti e prezzi* prima di pubblicare.'
function entities(s: string): string {
  return s.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity: string) => {
    const e = entity.toLowerCase()
    if (e[0] === '#') { const n = e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)); return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '' }
    return ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' } as Record<string, string>)[e] ?? ''
  })
}
function cleanText(html: string): string {
  return entities(html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<\/(?:p|div|li|h[1-6]|tr|section)>|<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ')).replace(/[\t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}
function bounded(text: string, warnings: string[]): string { if (text.length > MAX_TEXT) warnings.push('La fonte è lunga: ho letto i primi *60000 caratteri*.'); return text.slice(0, MAX_TEXT) }
function publicLink(raw: string, base: string): string | undefined {
  try { const url = validateSiteUrl(new URL(raw, base).href, { httpsOnly: true }); const host = url.hostname.replace(/^\[|\]$/g, ''); return isIP(host) && isBlockedAddress(host) ? undefined : url.href } catch { return undefined }
}
/** Analyze one page only: links are candidates, never recursively fetched or executed. */
export function extractOnboardingHtml(html: string, url: string): OnboardingSource {
  const warnings = [NOTICE], page = parsePage(html, url), weights = new Map<string, number>()
  for (const css of page.css) collectCssColors(css, weights)
  const meta = (html.match(/<meta\b[^>]*>/gi) ?? []).map(parseAttributes)
  const title = meta.find(a => a.property === 'og:site_name')?.content ?? meta.find(a => a.property === 'og:title')?.content ?? html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const candidates = (html.match(/<img\b[^>]*>/gi) ?? []).map(parseAttributes)
  const explicitLogo = candidates.find(a => /logo/i.test(`${a.alt ?? ''} ${a.id ?? ''} ${a.class ?? ''} ${a.src ?? ''}`))?.src
  const logo = explicitLogo ?? page.icons.find(i => i.source !== 'favicon')?.url
  const menuLinks: string[] = [], emails: string[] = [], phones: string[] = []
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = parseAttributes(`<a ${m[1]}>`), href = attrs.href ?? ''
    if (/^mailto:/i.test(href)) emails.push(href.slice(7).split('?')[0]!.slice(0, 254))
    if (/^tel:/i.test(href)) phones.push(href.slice(4).replace(/[^+\d]/g, '').slice(0, 25))
    if (/men[uù]|carta|\.pdf(?:[?#]|$)/i.test(`${href} ${cleanText(m[2]!)}`)) { const link = publicLink(href, url); if (link) menuLinks.push(link) }
  }
  if (page.stylesheets.length && !weights.size) warnings.push('Non ho trovato i *colori del locale*. Vanno controllati.')
  return { url, kind: 'html', text: bounded(cleanText(html), warnings), name: title ? cleanText(title).slice(0, 160) : undefined,
    logoUrl: logo ? publicLink(logo, url) : undefined, colors: [...new Set([...(page.themeColor ? [page.themeColor] : []), ...rankBrandColors(weights)])].slice(0, 8),
    menuLinks: [...new Set(menuLinks)].slice(0, 12), contacts: { emails: [...new Set(emails)].slice(0, 8), phones: [...new Set(phones)].slice(0, 8) }, warnings }
}

export async function inspectOnboardingMedia(bytes: Buffer, contentType: string, deps: OnboardingSourceDeps = {}): Promise<Pick<OnboardingSource, 'kind' | 'text' | 'warnings'>> {
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('La fonte deve contenere dati e non superare 8 MB.')
  const mime = contentType.split(';')[0]!.trim().toLowerCase(), warnings = [NOTICE]
  if (mime === 'application/pdf') {
    if (!bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error('Il file non è un PDF valido.')
    const { getDocumentProxy, extractText } = await import('unpdf')
    const document = await getDocumentProxy(new Uint8Array(bytes))
    try {
      if (document.numPages > 40) throw new Error('Sono consentite al massimo 40 pagine PDF per fonte.')
      const result = await extractText(document, { mergePages: true })
      const text = bounded(result.text.trim(), warnings)
      if (!text) warnings.push('Il *PDF* non ha testo leggibile. Invia foto nitide delle pagine.')
      return { kind: 'pdf', text: text || undefined, warnings }
    } finally { await document.destroy() }
  }
  if (['image/png', 'image/jpeg', 'image/webp'].includes(mime)) {
    const valid = mime === 'image/png' ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' : mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
    if (!valid) throw new Error('Il contenuto non corrisponde al formato immagine dichiarato.')
    if (!deps.ocrImage) return { kind: 'image', warnings: [...warnings, 'Non posso leggere questa *immagine*. Invia il testo del menu.'] }
    const text = bounded((await deps.ocrImage(bytes, mime)).trim(), warnings)
    if (!text) warnings.push('Non riesco a leggere il *testo della foto*. Invia un’immagine più nitida.')
    return { kind: 'image', text: text || undefined, warnings }
  }
  if (mime !== 'text/plain' && mime !== 'text/csv') throw new Error('Formato fonte non supportato. Usare sito HTTPS, PDF, PNG, JPEG, WebP o testo.')
  if (bytes.includes(0)) throw new Error('Il file non contiene testo UTF-8 leggibile.')
  return { kind: 'text', text: bounded(bytes.toString('utf8').trim(), warnings), warnings }
}

export async function ingestOnboardingSource(rawUrl: string, deps: OnboardingSourceDeps = {}): Promise<OnboardingSource> {
  const started = Date.now()
  const url = validateSiteUrl(rawUrl, { ...deps, httpsOnly: true })
  const response = await guardedFetch(url, 'source', { ...deps, httpsOnly: true }, { timeoutMs: Math.min(deps.timeoutMs ?? 8000, 12000), maxBytes: Math.min(deps.maxBytes ?? MAX_BYTES, MAX_BYTES) })
  if (['text/html', 'application/xhtml+xml'].includes(response.contentType)) {
    if (response.body.length > 2 * 1024 * 1024) throw new Error('La pagina HTML supera 2 MB.')
    const html = response.body.toString('utf8'), result = extractOnboardingHtml(html, response.url)
    const parsed = parsePage(html, response.url), weights = new Map<string, number>()
    for (const css of parsed.css) collectCssColors(css, weights)
    let externalRead = false
    for (const href of parsed.stylesheets.slice(0, 2)) {
      const remaining = Math.min(deps.timeoutMs ?? 8000, 12000) - (Date.now() - started)
      if (remaining <= 50) break
      try {
        const sheet = await guardedFetch(href, 'css', { ...deps, httpsOnly: true }, { timeoutMs: Math.min(remaining, 1500), maxBytes: 512 * 1024 })
        collectCssColors(sheet.body.toString('utf8'), weights); externalRead = true
      } catch { /* Optional stylesheets cannot block menu source ingestion. */ }
    }
    result.colors = [...new Set([...(parsed.themeColor ? [parsed.themeColor] : []), ...rankBrandColors(weights)])].slice(0, 8)
    if (externalRead) result.warnings = result.warnings.filter(w => !w.startsWith('Colori non presenti'))
    return result
  }
  return { url: response.url, ...await inspectOnboardingMedia(response.body, response.contentType, deps) }
}
