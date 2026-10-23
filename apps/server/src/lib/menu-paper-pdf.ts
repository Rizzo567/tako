/** PDF da MODELLO GRAFICO (23/10/2026, via di Manuel): l'immagine del modello (cornice + logo + titolo, resto vuoto) fa da sfondo
 * a pagina intera e il sistema scrive sopra, centrato, il contenuto del Menu: riga prezzi (formule), Sottomenu con i piatti,
 * separatori dorati col giglio, «TUTTI I MENU COMPRENDONO» + «Compreso». Riferimento grafico: Victoria «Menu Cena».
 * Generato al volo dal documento (pubblicato o bozza in anteprima): si aggiorna da solo a ogni pubblicazione.
 * Limite noto: UNA pagina. Con tanti piatti testi e spazi si riducono insieme fino a PAPER_MIN_SCALE; oltre, il testo
 * resta a quella misura e può toccare la cornice (fits=false, annotato nel registro). */
import { Buffer } from 'node:buffer'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { imageBufferForPdf } from './image-store.js'
import { downloadRemoteImage, remoteStorageEnabled, imageObjectKey } from './remote-image-store.js'
import { publicWorkspace } from './menu-workspace-schedule.js'
import { isFixed, visibleFormulas, type FixedFormula } from './menu-fixed-price.js'
import { fixedIncludedLabel, type PdfRuntimeAssets } from './menu-workspace-pdf.js'
import type { Workspace } from './menu-workspace-contract.js'
import { paperTemplateOf } from './menu-paper-select.js'
export { paperTemplateOf, paperMenuIds } from './menu-paper-select.js'

type Menu = Workspace['menus'][number]
export type PaperArea = { top: number; bottom: number; left: number; right: number }
export type PaperFont = 'regular' | 'bold' | 'black'
/** Zona vuota del modello in frazioni della pagina (misurata sul modello Victoria 1054×1492: titolo fino a 281, cornice interna 30–1022 / 1461). */
export const DEFAULT_PAPER_AREA: PaperArea = { top: 281 / 1492, bottom: 1461 / 1492, left: 30 / 1054, right: 1022 / 1054 }
export const PAPER_FONT_FILES: Record<PaperFont, string> = { regular: 'PlayfairDisplay-Regular.ttf', bold: 'PlayfairDisplay-Bold.ttf', black: 'PlayfairDisplay-Black.ttf' }
export const PAPER_FALLBACK_FILES: Record<PaperFont, string> = { regular: 'NotoSans-Regular.ttf', bold: 'NotoSans-Bold.ttf', black: 'NotoSans-Bold.ttf' }
/** Colori campionati dal riferimento: titoli blu notte, piatti blu più vivo, separatori oro. */
export const PAPER_COLORS = { heading: '#033266', text: '#0b1f78', gold: '#f4c21f' }
/** Il carattere del riferimento è più stretto di Playfair: compressione orizzontale uniforme (Tz) per le stesse proporzioni. */
export const PAPER_CONDENSE = 0.86
export const PAPER_MIN_SCALE = 0.5
export const PAPER_MIN_GAP = 0.7
/** Cifre allineate (16,90 come nel riferimento): Playfair di base usa le cifre «old style». */
const PAPER_FEATURES = ['lnum', 'kern', 'liga']
/** Misure in «pixel di disegno»: larghezza pagina = 1054 come il modello. Valori ricavati dal riferimento Victoria. */
const DESIGN_WIDTH = 1054
const S = {
  firstSep: 31, sepWidth: 622, lilyWidth: 44, lilyHeight: 42, lineGap: 12, lineThickness: 2.6,
  main: { font: 'black' as PaperFont, size: 55 }, row: { font: 'regular' as PaperFont, size: 40 },
  heading: { font: 'black' as PaperFont, size: 64 }, child: { font: 'bold' as PaperFont, size: 44 },
  dish: { font: 'regular' as PaperFont, size: 39 }, footerTitle: { font: 'black' as PaperFont, size: 60 }, footerText: { font: 'regular' as PaperFont, size: 42 },
  sepToNext: 40, sepToFooter: 32, mainToRow: 19, rowToHeading: 43, headingToDish: 18, dishGap: 21.5, dishToSep: 45, footerTitleToText: 18,
  bottomMargin: 28, maxTextWidth: 830, sideMargin: 80,
}
const CAP = 0.708, ASC = 0.784, DESC = 0.19

/** «12 €» per gli interi, «16,90 €» altrimenti. */
export function paperPrice(value: number): string {
  if (!Number.isFinite(value)) return ''
  const cents = Math.round(value * 100)
  return (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace('.', ',')) + ' €'
}
/** «Solo primo» → «MENU PRIMO», «Solo secondo» → «MENU SECONDO»; gli altri nomi in maiuscolo. */
export function paperFormulaName(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' '), solo = clean.match(/^solo\s+(.+)$/i)
  return (solo ? 'Menu ' + solo[1] : clean).toLocaleUpperCase('it')
}
const capitalize = (value: string) => { const t = value.trim().replace(/\s+/g, ' '); return t ? t[0]!.toLocaleUpperCase('it') + t.slice(1) : t }

export type PaperContent = {
  main: string | null
  others: string[]
  sections: { title: string; groups: { title: string | null; dishes: string[] }[] }[]
  footerTitle: string | null
  footerText: string | null
}
/** Contenuto da scrivere: solo piatti visibili e disponibili, nell'ordine del Menu. */
export function paperContent(menu: Menu, language: string, defaultLanguage = 'it'): PaperContent {
  const tr = <T extends { translations?: Record<string, { name: string; description?: string; included?: string }> }>(x: T) => language !== defaultLanguage ? x.translations?.[language] : undefined
  const fixed = isFixed(menu), formulas = visibleFormulas(menu)
  const formulaName = (f: FixedFormula) => f.translations?.[language]?.name?.trim() || f.name
  let main: FixedFormula | null = null
  if (formulas.length) main = formulas.find(f => /\bcomplet[oa]\b/i.test(f.name)) ?? (formulas.length === 1 ? formulas[0]! : formulas.reduce((a, b) => b.price > a.price ? b : a))
  const label = (f: FixedFormula) => `${paperFormulaName(formulaName(f))} ${paperPrice(f.price)}`
  const dishName = (item: Menu['sections'][number]['items'][number]) => { const name = capitalize(tr(item)?.name || item.name); const price = fixed ? '' : (item.priceDisplay?.trim() || (item.price > 0 ? paperPrice(item.price) : '')); return price ? `${name}  ${price}` : name }
  const roots = menu.sections.filter(s => !s.parentSectionId), sections: PaperContent['sections'] = []
  for (const root of roots) {
    const groups: PaperContent['sections'][number]['groups'] = []
    if (root.items.length) groups.push({ title: null, dishes: root.items.map(dishName) })
    for (const child of menu.sections.filter(s => s.parentSectionId === root.id)) if (child.items.length) groups.push({ title: (tr(child)?.name || child.name).trim(), dishes: child.items.map(dishName) })
    if (groups.length) sections.push({ title: (tr(root)?.name || root.name).trim().toLocaleUpperCase('it'), groups })
  }
  const included = fixed ? ((tr(menu)?.included?.trim()) || menu.included?.trim() || '') : ''
  return {
    main: main ? label(main) : null,
    others: formulas.filter(f => f !== main).map(label),
    sections,
    footerTitle: included ? (language.split('-')[0] === 'it' ? 'TUTTI I MENU COMPRENDONO' : fixedIncludedLabel(language).toLocaleUpperCase(language)) : null,
    footerText: included || null,
  }
}

export type PaperOp =
  | { kind: 'text'; text: string; font: PaperFont; size: number; x: number; baseline: number; width: number; color: 'heading' | 'text' }
  | { kind: 'sep'; cx: number; cy: number; scale: number }
export type PaperLayout = { ops: PaperOp[]; scale: number; gapScale: number; fits: boolean }
/** measure = larghezza del testo SENZA compressione, in unità di disegno, alla misura data. */
export type PaperMeasure = (text: string, font: PaperFont, size: number) => number

type Line = { text: string; font: PaperFont; size: number; color: 'heading' | 'text'; caps: boolean }
type Block = { gap: number; min?: number; line?: Line; sep?: true; last?: boolean }
/** Distanza minima dal giglio (mezza altezza 21 + aria): stringendo gli spazi il giglio non tocca mai il testo. */
const SEP_CLEAR_BEFORE = 29, SEP_CLEAR_AFTER = 30

/** Impaginazione pura (testabile): coordinate in punti PDF della pagina. */
export function layoutPaper(content: PaperContent, measure: PaperMeasure, page: { width: number; height: number; area?: PaperArea }): PaperLayout {
  const unit = page.width / DESIGN_WIDTH, H = page.height / unit, area = page.area ?? DEFAULT_PAPER_AREA
  const top = area.top * H, bottom = area.bottom * H, left = area.left * DESIGN_WIDTH, right = area.right * DESIGN_WIDTH
  const cx = (left + right) / 2, maxWidth = Math.min(S.maxTextWidth, right - left - 2 * S.sideMargin)
  const width = (line: Line, size = line.size) => measure(line.text, line.font, size) * PAPER_CONDENSE
  const wrap = (text: string, font: PaperFont, size: number, f: number): string[] => {
    const out: string[] = []; let current = ''
    for (const word of text.split(/\s+/).filter(Boolean)) { const next = current ? current + ' ' + word : word; if (current && measure(next, font, size * f) * PAPER_CONDENSE > maxWidth) { out.push(current); current = word } else current = next }
    if (current) out.push(current)
    return out
  }
  // Sequenza di blocchi con lo spazio PRIMA di ciascuno (dalla linea di base o dal centro del separatore precedente).
  const build = (f: number): Block[] => {
    const blocks: Block[] = [{ gap: S.firstSep, min: 26, sep: true }]
    let after: 'sep' | 'main' | 'row' | 'heading' | 'dish' = 'sep'
    const push = (gap: number, line: Line) => blocks.push({ gap, line, ...(blocks.at(-1)?.sep ? { min: SEP_CLEAR_AFTER } : {}) })
    const sepGap = (next: 'normal' | 'footer') => next === 'footer' ? S.sepToFooter : S.sepToNext
    if (content.main) { push(sepGap('normal'), { text: content.main, ...S.main, color: 'heading', caps: true }); after = 'main' }
    if (content.others.length) { push(after === 'main' ? S.mainToRow : sepGap('normal'), { text: content.others.join('   ·   '), ...S.row, color: 'heading', caps: true }); after = 'row' }
    content.sections.forEach((section, index) => {
      if (index > 0) { blocks.push({ gap: S.dishToSep, min: SEP_CLEAR_BEFORE, sep: true }); after = 'sep' }
      push(after === 'sep' ? sepGap('normal') : S.rowToHeading, { text: section.title, ...S.heading, color: 'heading', caps: true }); after = 'heading'
      for (const group of section.groups) {
        if (group.title) { push(after === 'heading' ? S.headingToDish + 4 : S.dishGap + 10, { text: group.title, ...S.child, color: 'heading', caps: false }); after = 'heading' }
        for (const dish of group.dishes) for (const text of wrap(dish, S.dish.font, S.dish.size, f)) { push(after === 'heading' ? S.headingToDish : S.dishGap, { text, ...S.dish, color: 'text', caps: false }); after = 'dish' }
      }
    })
    if (content.footerTitle) {
      const last = after as string; if (last !== 'sep') blocks.push({ gap: last === 'dish' ? S.dishToSep : S.rowToHeading, min: SEP_CLEAR_BEFORE, sep: true })
      push(S.sepToFooter, { text: content.footerTitle, ...S.footerTitle, color: 'heading', caps: true })
      let first = true
      for (const text of wrap(content.footerText ?? '', S.footerText.font, S.footerText.size, f)) { push(first ? S.footerTitleToText : S.dishGap, { text, ...S.footerText, color: 'text', caps: false }); first = false }
      after = 'dish'
    }
    const end = blocks.at(-1); if (end) end.last = true
    return blocks
  }
  const gapOf = (b: Block, f: number, g: number) => Math.max((b.min ?? 0) * f, b.gap * f * g)
  const ascent = (line: Line) => (line.caps ? CAP : ASC) * line.size
  // Misure del blocco a scala f (testi e spazi) e g (solo spazi): altezza dal bordo alto della zona all'ultima discendente.
  const measureHeight = (blocks: Block[], f: number, g: number) => {
    let y = 0
    for (const b of blocks) {
      if (b.sep) y += gapOf(b, f, g)
      else { const line = b.line!; y += gapOf(b, f, g) + ascent(line) * f }
      if (b.last && b.line) y += DESC * b.line.size * f
    }
    return y
  }
  const available = bottom - S.bottomMargin - top
  const gapsOf = (list: Block[]) => list.reduce((sum, b) => sum + b.gap, 0)
  // Troppi piatti: prima si stringono gli spazi (fino a PAPER_MIN_GAP), poi testi e spazi insieme fino a PAPER_MIN_SCALE.
  let f = 1, g = 1, blocks = build(1), natural = measureHeight(blocks, 1, 1)
  if (natural > available) {
    const fixed = natural - gapsOf(blocks)
    g = Math.max(PAPER_MIN_GAP, (available - fixed) / Math.max(1, gapsOf(blocks)))
    natural = measureHeight(blocks, 1, g)
    for (let i = 0; i < 8 && natural > available + 0.5 && f > PAPER_MIN_SCALE; i++) { f = Math.max(PAPER_MIN_SCALE, f * available / natural); blocks = build(f); natural = measureHeight(blocks, f, g) }
  } else {
    // Pochi piatti: si allargano solo gli spazi (fino a 1,6×), poi il blocco resta centrato nella zona.
    g = Math.min(1.6, 1 + (available - natural) / Math.max(1, gapsOf(blocks))); natural = measureHeight(blocks, 1, g)
  }
  const fits = natural <= available + 0.5
  let y = top + (fits ? Math.max(0, (available - natural) / 2) : 0)
  const ops: PaperOp[] = []
  for (const b of blocks) {
    if (b.sep) { y += gapOf(b, f, g); ops.push({ kind: 'sep', cx: cx * unit, cy: y * unit, scale: f * unit }); continue }
    const line = b.line!
    let size = line.size * f
    const w = width(line, size); if (w > maxWidth) size *= maxWidth / w // titoli e prezzi su una riga: si stringono per stare nella larghezza
    y += gapOf(b, f, g) + ascent(line) * f
    const finalWidth = width(line, size)
    ops.push({ kind: 'text', text: line.text, font: line.font, size: size * unit, x: (cx - finalWidth / 2) * unit, baseline: y * unit, width: finalWidth * unit, color: line.color })
  }
  return { ops, scale: f, gapScale: g, fits }
}

const fontsDir = fileURLToPath(new URL('../../assets/fonts/', import.meta.url))
const fontCache = new Map<string, Buffer>()
async function fontBytes(file: string, runtime?: PdfRuntimeAssets): Promise<Buffer | null> {
  if (runtime) return runtime.fonts.get(file) ?? null
  const path = join(fontsDir, file); if (!existsSync(path)) return null
  let bytes = fontCache.get(file); if (!bytes) { bytes = await readFile(path); fontCache.set(file, bytes) }
  return bytes
}
async function tenantImage(restaurantId: string, url: string): Promise<Buffer> {
  if (!url.startsWith(`/uploads/${restaurantId}/`)) throw new Error('Modello PDF non valido')
  const filename = url.split('/').pop()!; imageObjectKey(restaurantId, filename)
  const bytes = remoteStorageEnabled()
    ? await (async () => { const response = await downloadRemoteImage(restaurantId, filename); if (!response.ok) throw new Error('Modello PDF non disponibile'); return Buffer.from(await response.arrayBuffer()) })()
    : await readFile(join(process.env.UPLOADS_DIR ?? 'uploads', restaurantId, filename))
  if (bytes.length > 10 * 1024 * 1024) throw new Error('Modello PDF troppo grande')
  return imageBufferForPdf(bytes)
}

export async function renderPaperPdf(workspace: Workspace, menuIds: string[], language: string, title: string, restaurantId: string, runtimeAssets?: PdfRuntimeAssets): Promise<Buffer> {
  const [{ default: PDFDocument }, fontkit] = await Promise.all([import('pdfkit'), import('fontkit')])
  const lang = workspace.languages.includes(language) ? language : workspace.defaultLanguage
  // Contenuto come la pagina pubblica (piatti nascosti/esauriti fuori), ma il Menu si stampa anche se nascosto e senza fasce orarie.
  const forced = { ...workspace, menus: workspace.menus.map(m => menuIds.includes(m.id) ? { ...m, active: true, schedule: undefined } : m) }
  const visible = publicWorkspace(forced, new Date(), { ignoreSchedules: true })
  const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 0, autoFirstPage: false, info: { Title: title, Creator: 'Tako' } })
  const chunks: Buffer[] = []; const completed = new Promise<Buffer>((resolve, reject) => { doc.on('data', c => chunks.push(Buffer.from(c))); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject) })
  const faces = new Map<string, { font: any; name: string }>()
  const face = async (file: string) => {
    let entry = faces.get(file); if (entry) return entry
    const bytes = await fontBytes(file, runtimeAssets); if (!bytes) throw new Error('PDF font unavailable: ' + file)
    doc.registerFont(file, bytes); entry = { font: (fontkit as any).create(bytes), name: file }; faces.set(file, entry); return entry
  }
  const pick = async (text: string, font: PaperFont) => {
    const main = await face(PAPER_FONT_FILES[font])
    if ([...text].every(ch => /\s/.test(ch) || main.font.hasGlyphForCodePoint(ch.codePointAt(0)))) return main
    return face(PAPER_FALLBACK_FILES[font])
  }
  for (const id of menuIds) {
    const original = workspace.menus.find(m => m.id === id), menu = visible.menus.find(m => m.id === id)
    if (!original || !menu) throw new Error('Menu non trovato')
    const background = await tenantImage(restaurantId, paperTemplateOf(original)!)
    const content = paperContent(menu, lang, workspace.defaultLanguage)
    // Le misure passano dal font vero (anche il ripiego per caratteri mancanti), in unità di disegno.
    const fontsFor = new Map<string, any>()
    for (const op of [content.main, ...content.others, ...content.sections.flatMap(s => [s.title, ...s.groups.flatMap(g => [g.title ?? '', ...g.dishes])]), content.footerTitle, content.footerText]) if (op) for (const font of ['regular', 'bold', 'black'] as PaperFont[]) fontsFor.set(font + '|' + op, (await pick(op, font)).font)
    const measure: PaperMeasure = (text, font, size) => { const f = fontsFor.get(font + '|' + text) ?? faces.get(PAPER_FONT_FILES[font])!.font; return f.layout(text, PAPER_FEATURES).advanceWidth / f.unitsPerEm * size }
    // Le righe spezzate non sono nella mappa: si misurano col font principale (stesso font della riga intera).
    doc.addPage({ size: 'A4', layout: 'portrait', margin: 0 })
    const width = doc.page.width, height = doc.page.height
    const area = (original as { paper?: { area?: PaperArea | null } }).paper?.area ?? undefined
    const layout = layoutPaper(content, measure, { width, height, area })
    doc.image(background, 0, 0, { width, height })
    for (const op of layout.ops) {
      if (op.kind === 'sep') { drawSeparator(doc, op.cx, op.cy, op.scale); continue }
      const chosen = await pick(op.text, op.font)
      doc.save().font(chosen.name).fontSize(op.size).fillColor(PAPER_COLORS[op.color])
      doc.text(op.text, op.x, op.baseline, { lineBreak: false, baseline: 'alphabetic', horizontalScaling: Math.round(PAPER_CONDENSE * 100), features: PAPER_FEATURES } as any)
      doc.restore()
    }
  }
  doc.end()
  return completed
}

/** Separatore: due linee dorate e giglio vettoriale al centro (disegnato sul giglio del riferimento, 44×42 px di disegno). */
export const LILY_PATH = [
  'M0 0 C4 6 8 11 7.5 17 C7 24 3.5 29 0 34 C-3.5 29 -7 24 -7.5 17 C-8 11 -4 6 0 0 Z',
  'M1.5 33.5 C4 26 10 20.5 16 20 C21.5 19.5 23.5 24 21 27.5 C18.5 31 13 29 11 27.5 C9 30 5 32 1.5 33.5 Z',
  'M-1.5 33.5 C-4 26 -10 20.5 -16 20 C-21.5 19.5 -23.5 24 -21 27.5 C-18.5 31 -13 29 -11 27.5 C-9 30 -5 32 -1.5 33.5 Z',
  'M-3.2 31.5 L3.2 31.5 L0 42 Z',
]
function drawSeparator(doc: any, cx: number, cy: number, scale: number) {
  const half = S.sepWidth / 2 * scale, inner = (S.lilyWidth / 2 + S.lineGap) * scale
  doc.save().lineWidth(S.lineThickness * scale).strokeColor(PAPER_COLORS.gold).lineCap('round')
  doc.moveTo(cx - half, cy).lineTo(cx - inner, cy).stroke()
  doc.moveTo(cx + inner, cy).lineTo(cx + half, cy).stroke()
  doc.restore()
  doc.save().translate(cx, cy - S.lilyHeight / 2 * scale).scale(scale).fillColor(PAPER_COLORS.gold)
  for (const path of LILY_PATH) doc.path(path).fill()
  doc.restore()
}
