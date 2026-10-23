// PDF da modello grafico (23/10): contenuto, prezzi, impaginazione su una pagina, render reale (senza DB).
import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import fontkit from '../apps/server/node_modules/fontkit/dist/main.cjs'
import { PNG } from '../apps/server/node_modules/pngjs/lib/png.js'
import { paperPrice, paperFormulaName, paperContent, layoutPaper, renderPaperPdf, paperMenuIds, DEFAULT_PAPER_AREA, PAPER_MIN_SCALE, PAPER_FONT_FILES, type PaperContent, type PaperMeasure, type PaperFont } from '../apps/server/src/lib/menu-paper-pdf.js'
import { workspaceSchema } from '../apps/server/src/lib/menu-workspace-contract.js'
import { applyOps } from '../packages/menu-ops/src/index.js'

const FONTS = join(__dirname, '../apps/server/assets/fonts')
const faces = Object.fromEntries((Object.entries(PAPER_FONT_FILES) as [PaperFont, string][]).map(([k, f]) => [k, (fontkit as any).openSync(join(FONTS, f))]))
const measure: PaperMeasure = (text, font, size) => faces[font].layout(text, ['lnum', 'kern']).advanceWidth / 1000 * size
const A4 = { width: 595.28, height: 841.89 }
const RID = '528e263c-634e-4695-9632-6c5cc6a3302f'

const content = (perSection: number, long = false): PaperContent => ({
  main: 'COMPLETO 16,90 €', others: ['MENU PRIMO 12 €', 'MENU SECONDO 14 €'],
  sections: ['PRIMI', 'SECONDI', 'CONTORNI'].map(title => ({ title, groups: [{ title: null, dishes: Array.from({ length: perSection }, (_, i) => long && i === 0 ? 'Tagliatelle fatte in casa con vongole veraci, totano, zucchine trifolate, pomodorini datterini e prezzemolo fresco' : `Piatto numero ${i + 1} al forno`) }] })),
  footerTitle: 'TUTTI I MENU COMPRENDONO', footerText: '¼ di vino oppure ½ litro d’acqua + caffè',
})
const areaPt = () => { const unit = A4.width / 1054, H = A4.height / unit; return { top: DEFAULT_PAPER_AREA.top * H * unit, bottom: DEFAULT_PAPER_AREA.bottom * H * unit, left: DEFAULT_PAPER_AREA.left * A4.width, right: DEFAULT_PAPER_AREA.right * A4.width } }
const texts = (l: ReturnType<typeof layoutPaper>) => l.ops.filter(o => o.kind === 'text') as Extract<ReturnType<typeof layoutPaper>['ops'][number], { kind: 'text' }>[]

describe('prezzi e nomi delle formule', () => {
  it('interi senza decimali, altrimenti virgola e due decimali', () => {
    expect(paperPrice(12)).toBe('12 €'); expect(paperPrice(16.9)).toBe('16,90 €'); expect(paperPrice(9.5)).toBe('9,50 €'); expect(paperPrice(10.0001)).toBe('10 €')
  })
  it('Solo primo → MENU PRIMO, Solo secondo → MENU SECONDO, altri in maiuscolo', () => {
    expect(paperFormulaName('Solo primo')).toBe('MENU PRIMO'); expect(paperFormulaName('solo  secondo')).toBe('MENU SECONDO'); expect(paperFormulaName('Completo')).toBe('COMPLETO')
  })
})

const menu = (extra: any = {}) => ({
  id: randomUUID(), name: 'Menu Cena', pricing: 'fisso', included: '¼ di vino oppure ½ litro d’acqua + caffè',
  formulas: [{ id: randomUUID(), name: 'Solo primo', price: 12, note: null, translations: {} }, { id: randomUUID(), name: 'Completo', price: 16.9, note: null, translations: {} }, { id: randomUUID(), name: 'Solo secondo', price: 14, note: null, translations: {} }],
  sections: ['Primi', 'Secondi'].map(name => ({ id: randomUUID(), name, items: [{ id: randomUUID(), name: 'tagliatelle al ragù', price: 9 }, { id: randomUUID(), name: 'Nascosto', price: 9, hidden: true }] })),
  ...extra,
})

describe('contenuto dal Menu', () => {
  it('Completo grande, altre formule in riga nell’ordine salvato, sezioni maiuscole, piatti con iniziale maiuscola', () => {
    const w = workspaceSchema.parse({ menus: [menu()] })
    const c = paperContent({ ...w.menus[0]!, sections: w.menus[0]!.sections.map(s => ({ ...s, items: s.items.filter(i => !i.hidden) })) }, 'it')
    expect(c.main).toBe('COMPLETO 16,90 €'); expect(c.others).toEqual(['MENU PRIMO 12 €', 'MENU SECONDO 14 €'])
    expect(c.sections.map(s => s.title)).toEqual(['PRIMI', 'SECONDI']); expect(c.sections[0]!.groups[0]!.dishes).toEqual(['Tagliatelle al ragù'])
    expect(c.footerTitle).toBe('TUTTI I MENU COMPRENDONO'); expect(c.footerText).toBe('¼ di vino oppure ½ litro d’acqua + caffè')
  })
  it('senza «Compreso» niente piè di pagina; alla carta il prezzo segue il piatto', () => {
    const w = workspaceSchema.parse({ menus: [menu({ pricing: undefined, formulas: undefined, included: null })] })
    const c = paperContent(w.menus[0]!, 'it')
    expect(c.main).toBeNull(); expect(c.footerTitle).toBeNull(); expect(c.sections[0]!.groups[0]!.dishes[0]).toBe('Tagliatelle al ragù  9 €')
  })
})

describe('impaginazione su una pagina', () => {
  for (const n of [3, 5, 8]) it(`${n} piatti per sezione: tutto dentro la zona vuota, centrato, in ordine`, () => {
    const l = layoutPaper(content(n), measure, A4), t = texts(l), a = areaPt()
    expect(l.fits).toBe(true)
    expect(t.filter(o => o.color === 'text').length).toBe(n * 3 + 1)
    for (const o of t) { expect(o.baseline).toBeGreaterThan(a.top); expect(o.baseline).toBeLessThan(a.bottom); expect(o.x).toBeGreaterThan(a.left); expect(o.x + o.width).toBeLessThan(a.right); expect(Math.abs(o.x + o.width / 2 - A4.width / 2)).toBeLessThan(1) }
    for (let i = 1; i < l.ops.length; i++) { const y = (o: any) => o.kind === 'sep' ? o.cy : o.baseline; expect(y(l.ops[i])).toBeGreaterThan(y(l.ops[i - 1])) }
    expect(l.ops.filter(o => o.kind === 'sep').length).toBe(4) // sotto il titolo, tra le 3 sezioni, prima del piè di pagina
  })
  it('più piatti → testi più piccoli (riduzione proporzionale), mai sotto il minimo', () => {
    const size = (n: number) => texts(layoutPaper(content(n), measure, A4)).find(o => o.color === 'text')!.size
    expect(size(3)).toBeGreaterThanOrEqual(size(5)); expect(size(5)).toBeGreaterThan(size(8)); expect(size(8)).toBeGreaterThanOrEqual(39 * 595.28 / 1054 * PAPER_MIN_SCALE - 0.01)
    expect(layoutPaper(content(8), measure, A4).scale).toBeLessThan(1)
  })
  it('oltre il minimo leggibile si ferma e lo segnala (fits=false)', () => {
    const l = layoutPaper(content(30), measure, A4); expect(l.scale).toBe(PAPER_MIN_SCALE); expect(l.fits).toBe(false)
  })
  it('nome lungo va a capo dentro la larghezza massima', () => {
    const l = layoutPaper(content(3, true), measure, A4), dishes = texts(l).filter(o => o.color === 'text')
    expect(dishes.length).toBeGreaterThan(3 * 3 + 1)
    for (const o of dishes) expect(o.width).toBeLessThanOrEqual(830 * 595.28 / 1054 + 0.5)
  })
  it('titoli e prezzi lunghi si stringono su una riga invece di andare a capo', () => {
    const c = content(3); c.others = ['MENU PRIMO CON CONTORNO E DOLCE 12 €', 'MENU SECONDO CON CONTORNO E DOLCE 14 €', 'MENU BAMBINI 8 €']
    const row = texts(layoutPaper(c, measure, A4)).find(o => o.text.startsWith('MENU PRIMO'))!
    expect(row.width).toBeLessThanOrEqual(830 * 595.28 / 1054 + 0.5)
  })
})

describe('render reale (Node, font del repository, modello negli asset del locale)', () => {
  let dir = ''
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'paper-')); mkdirSync(join(dir, RID))
    const png = new PNG({ width: 105, height: 149 }); png.data.fill(240); writeFileSync(join(dir, RID, 'modelloProva0001.png'), PNG.sync.write(png))
    process.env.UPLOADS_DIR = dir
  })
  it('una pagina A4 con il modello e il testo; il Menu con modello vince, gli altri no', async () => {
    const m = menu({ paper: { templateUrl: `/uploads/${RID}/modelloProva0001.png` } }), other = menu({ name: 'Alla carta' })
    const w = workspaceSchema.parse({ menus: [m, other] })
    expect(paperMenuIds(w, [m.id])).toEqual([m.id]); expect(paperMenuIds(w, [m.id, other.id])).toBeNull(); expect(paperMenuIds(w, [other.id])).toBeNull()
    const bytes = await renderPaperPdf(w, [m.id], 'it', 'Victoria', RID)
    const text = bytes.toString('latin1')
    expect(text.startsWith('%PDF-')).toBe(true); expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBe(1); expect(text).toMatch(/PlayfairDisplay/)
  })
  it('schema: paper facoltativo (assente = documento identico), null per toglierlo, URL fuori dagli asset rifiutato', () => {
    const base = menu(); expect('paper' in workspaceSchema.parse({ menus: [base] }).menus[0]!).toBe(false)
    expect(workspaceSchema.parse({ menus: [{ ...base, paper: null }] }).menus[0]!.paper).toBeNull()
    expect(workspaceSchema.safeParse({ menus: [{ ...base, paper: { templateUrl: 'https://evil.example/x.png' } }] }).success).toBe(false)
  })
  it('menu-ops: «paper» modificabile sul Menu con set', () => {
    const m = menu(), doc = { menus: [m] } as any
    const r = applyOps(doc, [{ op: 'set', kind: 'menu', id: m.id, fields: { paper: { templateUrl: `/uploads/${RID}/modelloProva0001.png` } } }]) as any
    expect(JSON.stringify(r)).toContain('modelloProva0001')
  })
})
