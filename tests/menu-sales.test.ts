// F3 prezzo promo + F4 scarsità: giornata alle 06:00 del locale, scadenze in lettura, pagina pubblica e PDF. Orologio sempre finto.
import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { workspaceSchema } from '../apps/server/src/lib/menu-workspace-contract.js'
import { publicWorkspace } from '../apps/server/src/lib/menu-workspace-schedule.js'
import { publicMenuProjection } from '../apps/server/src/lib/published-menu.js'
import { businessDate, resolveUntil, validPromoPrice, salesView, stampOnlyToday, SALES_LABELS, salesTimezone } from '../apps/server/src/lib/menu-sales.js'
import { renderWorkspacePdf, pdfPromoPrices, pdfSalesLabels } from '../apps/server/src/lib/menu-workspace-pdf.js'
import { applyActions } from '../apps/server/src/lib/twilio-menu-ai.js'
import { SALES_COPY } from '../apps/web/src/lib/menu-sales-copy.js'

// Ottobre 2026: CEST (UTC+2) fino al 25/10, poi CET (UTC+1). 18/10/2026 è domenica.
const rome = (local: string, offset = '+02:00') => new Date(local + offset)
const ids = { menu: randomUUID(), section: randomUUID(), carbonara: randomUUID(), tiramisu: randomUUID(), branzino: randomUUID(), testo: randomUUID() }
const doc = (items: Record<string, unknown>[]) => workspaceSchema.parse({ menus: [{ id: ids.menu, name: 'Menu', sections: [{ id: ids.section, name: 'Primi', items }] }], pdf: { showQr: false } })
const visibleItems = (w: ReturnType<typeof doc>, now: Date, ignoreSchedules = true, timezone?: string) => publicWorkspace(w, now, { ignoreSchedules, timezone }).menus.flatMap(m => m.sections.flatMap(s => s.items))

describe('giornata del locale alle 06:00', () => {
  it('prima delle 06:00 locali è ancora il giorno prima, anche col cambio d’ora e in altri fusi', () => {
    expect(businessDate('Europe/Rome', rome('2026-10-17T05:59:59'))).toBe('2026-10-16')
    expect(businessDate('Europe/Rome', rome('2026-10-17T06:00:00'))).toBe('2026-10-17')
    expect(businessDate(undefined, rome('2026-10-17T01:30:00'))).toBe('2026-10-16')
    expect(businessDate('Fuso/Inesistente', rome('2026-10-17T07:00:00'))).toBe('2026-10-17')
    // notte del 25/10 (03:00 CEST → 02:00 CET): 05:30 CET è ancora il 24, 06:00 CET è il 25
    expect(businessDate('Europe/Rome', new Date('2026-10-25T04:30:00Z'))).toBe('2026-10-24')
    expect(businessDate('Europe/Rome', new Date('2026-10-25T05:00:00Z'))).toBe('2026-10-25')
    expect(businessDate('America/New_York', new Date('2026-10-17T09:59:00Z'))).toBe('2026-10-16')
    expect(salesTimezone('')).toBe('Europe/Rome')
  })
  it('«fino a domenica» = la prossima domenica compresa; date dette a voce; espressioni oscure → null', () => {
    expect(resolveUntil('fino a domenica', '2026-10-16')).toBe('2026-10-18')
    expect(resolveUntil('fino a domenica', '2026-10-18')).toBe('2026-10-18')
    expect(resolveUntil('fino a lunedì', '2026-10-18')).toBe('2026-10-19')
    expect(resolveUntil('fino a domani', '2026-10-16')).toBe('2026-10-17')
    expect(resolveUntil('fino a stasera', '2026-10-16')).toBe('2026-10-16')
    expect(resolveUntil('per tutta la settimana', '2026-10-16')).toBe('2026-10-18')
    expect(resolveUntil('fino al 20/10', '2026-10-16')).toBe('2026-10-20')
    expect(resolveUntil('fino al 20 ottobre', '2026-10-16')).toBe('2026-10-20')
    expect(resolveUntil('fino al 20 10', '2026-10-16')).toBe('2026-10-20')
    expect(resolveUntil('fino al 3', '2026-10-16')).toBe('2026-11-03')
    expect(resolveUntil('fino al 10/01', '2026-10-16')).toBe('2027-01-10')
    expect(resolveUntil('fino a quando dico io', '2026-10-16')).toBeNull()
    expect(resolveUntil('fino al 31/02', '2026-10-16')).toBeNull()
  })
})

describe('prezzo promo (F3)', () => {
  it('valida solo se maggiore di zero e minore del prezzo pieno', () => {
    expect(validPromoPrice(9, 12)).toBe(true)
    for (const [p, f] of [[12, 12], [13, 12], [0, 12], [-1, 12], [5, 0], [NaN, 12]]) expect(validPromoPrice(p!, f!), `${p}/${f}`).toBe(false)
    expect(() => doc([{ id: ids.carbonara, name: 'Carbonara', price: 12, promo: { price: 0 } }])).toThrow()
  })
  it('promo «fino a domenica» resta domenica notte e sparisce lunedì alle 06:00; senza fine resta; non valida non si mostra', () => {
    const w = doc([
      { id: ids.carbonara, name: 'Carbonara', price: 12, promo: { price: 9, until: '2026-10-18' } },
      { id: ids.tiramisu, name: 'Tiramisù', price: 6, promo: { price: 4 } },
      { id: ids.branzino, name: 'Branzino', price: 10, promo: { price: 11 } },
    ])
    const promoOf = (now: Date, name: string, ignore = true) => visibleItems(w, now, ignore).find(i => i.name === name)?.promo?.price
    expect(promoOf(rome('2026-10-18T23:30:00'), 'Carbonara')).toBe(9)
    expect(promoOf(rome('2026-10-19T05:59:00'), 'Carbonara')).toBe(9)
    expect(promoOf(rome('2026-10-19T06:00:00'), 'Carbonara')).toBeUndefined()
    expect(promoOf(rome('2026-10-19T06:00:00'), 'Carbonara', false)).toBeUndefined()
    expect(promoOf(rome('2027-03-01T12:00:00', '+01:00'), 'Tiramisù')).toBe(4)
    expect(promoOf(rome('2026-10-16T12:00:00'), 'Branzino')).toBeUndefined()
    // il documento salvato non viene toccato: la scadenza è solo in lettura
    expect(w.menus[0]!.sections[0]!.items[0]!.promo).toEqual({ price: 9, until: '2026-10-18' })
  })
  it('proiezione pubblica: prezzo pieno in price, promoPrice accanto; promo scaduta assente', () => {
    const w = doc([{ id: ids.carbonara, name: 'Carbonara', price: 12, promo: { price: 9, until: '2026-10-18' } }])
    const at = (now: Date) => publicMenuProjection(publicWorkspace(w, now, { ignoreSchedules: true }).menus[0]!, 'en', 'it').sections[0]!.items[0]!
    expect(at(rome('2026-10-17T20:00:00'))).toMatchObject({ price: 12, promoPrice: 9 })
    expect(at(rome('2026-10-19T07:00:00'))).not.toHaveProperty('promoPrice')
  })
  it('un documento senza i campi nuovi resta identico (nessuna chiave aggiunta)', () => {
    const raw = { id: ids.carbonara, name: 'Carbonara', price: 12 }
    const item = doc([raw]).menus[0]!.sections[0]!.items[0]!
    expect('promo' in item).toBe(false)
    expect('scarcity' in item).toBe(false)
    expect('promo' in doc([{ ...raw, promo: null, scarcity: null }]).menus[0]!.sections[0]!.items[0]!).toBe(false)
  })
})

describe('scarsità (F4)', () => {
  it('«Solo oggi» impostato il 16 vale fino alle 06:00 del 17 e poi scade da solo', () => {
    const w = doc([{ id: ids.tiramisu, name: 'Tiramisù', price: 6, scarcity: { onlyToday: '2026-10-16' } }])
    const at = (now: Date) => publicMenuProjection(publicWorkspace(w, now, { ignoreSchedules: true }).menus[0]!).sections[0]!.items[0]!
    expect(at(rome('2026-10-16T12:00:00')).onlyToday).toBe(true)
    expect(at(rome('2026-10-17T05:59:00')).onlyToday).toBe(true)
    expect(at(rome('2026-10-17T06:00:00'))).not.toHaveProperty('onlyToday')
    // il piatto resta nel menu: scade l'etichetta, non il piatto
    expect(at(rome('2026-10-18T12:00:00')).name).toBe('Tiramisù')
  })
  it('«Ultime porzioni» resta finché non si toglie; quando il piatto diventa esaurito si rimuove dal documento', () => {
    const w = doc([{ id: ids.carbonara, name: 'Carbonara', price: 12, scarcity: { lastPortions: true } }])
    expect(publicMenuProjection(publicWorkspace(w, rome('2027-01-01T12:00:00', '+01:00'), { ignoreSchedules: true }).menus[0]!).sections[0]!.items[0]!.lastPortions).toBe(true)
    const soldOut = structuredClone(w); soldOut.menus[0]!.sections[0]!.items[0]!.available = false
    const saved = workspaceSchema.parse(soldOut).menus[0]!.sections[0]!.items[0]!
    expect(saved.scarcity).toBeUndefined()
    saved.available = true
    expect(salesView(saved, '2026-10-16')).toEqual({})
  })
  it('esaurito dal bot («carbonara finita») toglie «Ultime porzioni» e ritorna disponibile senza etichetta', () => {
    const w: any = doc([{ id: ids.carbonara, name: 'Carbonara', price: 12, scarcity: { lastPortions: true, onlyToday: null } }])
    applyActions(w, [{ kind: 'available', id: ids.carbonara, value: false }])
    const parsed = workspaceSchema.parse(w)
    applyActions(parsed, [{ kind: 'available', id: ids.carbonara, value: true }])
    expect(workspaceSchema.parse(parsed).menus[0]!.sections[0]!.items[0]!.scarcity).toBeUndefined()
  })
  it('nei preset «Solo oggi» si ri-data al giorno in cui il preset va online (aiuto per F2)', () => {
    const w = doc([{ id: ids.tiramisu, name: 'Tiramisù', price: 6, scarcity: { onlyToday: '2026-10-12' } }])
    stampOnlyToday(w, ids.menu, '2026-10-19')
    expect(w.menus[0]!.sections[0]!.items[0]!.scarcity?.onlyToday).toBe('2026-10-19')
  })
})

describe('bug esistente: «piatto del giorno» sulla pagina pubblica (catalogOnly=1, orari ignorati)', () => {
  it('il piatto del giorno creato il 15 sparisce alle 06:00 del 16 anche con ignoreSchedules; le fasce orarie restano ignorate', () => {
    const w: any = doc([{ id: ids.carbonara, name: 'Carbonara', price: 12 }])
    applyActions(w, [{ kind: 'special', name: 'Risotto', price: 16, description: null }], { timezone: 'Europe/Rome', now: rome('2026-10-15T12:00:00') })
    const parsed = workspaceSchema.parse(w), names = (now: Date, ignore = true) => visibleItems(parsed, now, ignore).map(i => i.name)
    expect(names(rome('2026-10-15T21:00:00'))).toContain('Risotto')
    expect(names(rome('2026-10-16T05:30:00'))).toContain('Risotto')
    expect(names(rome('2026-10-16T06:00:00'))).not.toContain('Risotto')
    expect(names(rome('2026-10-17T12:00:00'))).not.toContain('Risotto')
    expect(publicWorkspace(parsed, rome('2026-10-17T12:00:00'), { ignoreSchedules: true }).menus[0]!.sections.map(s => s.name)).not.toContain('Piatto del giorno')
    // fascia oraria (pranzo) senza data di fine: sulla pagina pubblica resta visibile come prima
    const lunch = doc([{ id: ids.branzino, name: 'Branzino', price: 18, schedule: { enabled: true, windows: [{ weekdays: [0, 1, 2, 3, 4, 5, 6], start: '12:00', end: '15:00' }] } }])
    expect(visibleItems(lunch, rome('2026-10-16T20:00:00')).map(i => i.name)).toEqual(['Branzino'])
    expect(visibleItems(lunch, rome('2026-10-16T20:00:00'), false)).toEqual([])
  })
})

describe('PDF (F3+F4)', () => {
  const pdfText = async (bytes: Buffer) => { const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs'); const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false }), pdf = await loading.promise; let out = ''; for (let i = 1; i <= pdf.numPages; i++) { const content = await (await pdf.getPage(i)).getTextContent(); out += content.items.filter((v: any) => 'str' in v).map((v: any) => v.str).join(' ') + ' ' } await loading.destroy(); return out.replace(/\s+/g, ' ') }
  const w = () => doc([
    { id: ids.carbonara, name: 'Carbonara', price: 12, promo: { price: 9, until: '2026-10-18' }, scarcity: { lastPortions: true } },
    { id: ids.tiramisu, name: 'Tiramisu', price: 6, scarcity: { onlyToday: '2026-10-16' } },
    { id: ids.testo, name: 'Grigliata', price: 20, priceDisplay: 'secondo peso', promo: { price: 15 } },
  ])
  it('stampa prezzo pieno + promo, etichette sobrie tradotte; scaduto non si stampa', async () => {
    const restaurantId = randomUUID()
    const live = await pdfText(await renderWorkspacePdf(w(), [ids.menu], 'it', 'Promo', restaurantId, undefined, { timezone: 'Europe/Rome', now: rome('2026-10-16T19:00:00') }))
    expect(live).toContain('12,00 €'); expect(live).toContain('9,00 €')
    expect(live).toContain('Promo · Ultime porzioni'); expect(live).toContain('Solo oggi')
    expect(live).toContain('secondo peso'); expect(live).not.toContain('15,00 €')
    const english = await pdfText(await renderWorkspacePdf({ ...w(), languages: ['it', 'en'] }, [ids.menu], 'en', 'Promo', restaurantId, undefined, { now: rome('2026-10-16T19:00:00') }))
    expect(english).toContain('Offer · Last portions'); expect(english).toContain('Today only')
    const later = await pdfText(await renderWorkspacePdf(w(), [ids.menu], 'it', 'Promo', restaurantId, undefined, { timezone: 'Europe/Rome', now: rome('2026-10-19T06:00:00') }))
    expect(later).toContain('12,00 €'); expect(later).not.toContain('9,00 €'); expect(later).not.toContain('Promo'); expect(later).not.toContain('Solo oggi')
    expect(later).toContain('Ultime porzioni')
  })
  it('il prezzo pieno è barrato: una linea passa sopra il prezzo pieno', async () => {
    const bytes = await renderWorkspacePdf(w(), [ids.menu], 'it', 'Promo', randomUUID(), undefined, { now: rome('2026-10-16T19:00:00') })
    const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs'); const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false }), pdf = await loading.promise
    const ops = await (await pdf.getPage(1)).getOperatorList(); await loading.destroy()
    // pdfjs 6 raggruppa i tracciati: constructPath con argomento OPS.stroke
    const strokes = ops.fnArray.filter((f: number, i: number) => f === OPS.stroke || (f === OPS.constructPath && ops.argsArray[i]?.[0] === OPS.stroke)).length
    expect(strokes).toBe(1)
    expect(pdfPromoPrices({ price: 12, promo: { price: 9 } })).toEqual({ full: expect.stringContaining('12,00'), promo: expect.stringContaining('9,00') })
    expect(pdfPromoPrices({ price: 12, priceDisplay: 'a peso', promo: { price: 9 } })).toBeNull()
    expect(pdfSalesLabels({ price: 12, scarcity: { onlyToday: '2026-10-16' } }, 'de')).toBe('Nur heute')
  })
})

describe('traduzioni statiche delle etichette', () => {
  it('12 lingue, una sola volta, identiche tra server (PDF) e pagina pubblica', () => {
    expect(Object.keys(SALES_LABELS).sort()).toEqual(['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'nl', 'pl', 'pt', 'ru', 'zh'])
    for (const row of Object.values(SALES_LABELS)) for (const v of Object.values(row)) expect(v.trim().length).toBeGreaterThan(0)
    expect(SALES_COPY).toEqual(SALES_LABELS)
    // niente chiamate LLM per queste etichette
    expect(readFileSync(new URL('../apps/server/src/lib/menu-sales.ts', import.meta.url), 'utf8')).not.toMatch(/groq|fetch\(/i)
  })
})
