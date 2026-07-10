// ESC/POS reale per Tako — generazione byte a mano (nessuna dipendenza esterna).
//
// Perché a mano e non `node-thermal-printer`/`escpos`:
//  - servono solo pochi comandi (init, codepage, allineamento, grassetto, dimensione,
//    taglio, cassetto): un modulo di ~200 righe li copre tutti in modo trasparente;
//  - quelle librerie trascinano dipendenze native (`escpos-usb`, `serialport`) o transitive
//    pesanti che qui non servono (stampa è solo TCP raw);
//  - controllo totale sull'encoding degli accenti italiani (CP858) senza `iconv-lite`.
//
// L'invio TCP + guardia SSRF (IP LAN privato, porte 9100-9103) vive in `printer.ts` ed è
// riusato qui: unica fonte di verità per la parte di rete.
import { sendToPrinter } from './printer.js'

export { sendToPrinter }

// ─────────────────────────────────────────────────────────────────────────────
// Encoding CP858 (= CP850 + simbolo €). È la code page che quasi tutte le stampanti
// ESC/POS supportano e che copre gli accenti italiani. Selezioniamo la tabella sulla
// stampante con `ESC t 19` e mappiamo i caratteri sui byte corrispondenti.
// I caratteri non mappati diventano '?' (0x3F) così non si stampano byte casuali.
const CP858: Record<string, number> = {
  'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85, 'å': 0x86, 'ç': 0x87,
  'ê': 0x88, 'ë': 0x89, 'è': 0x8a, 'ï': 0x8b, 'î': 0x8c, 'ì': 0x8d, 'Ä': 0x8e, 'Å': 0x8f,
  'É': 0x90, 'æ': 0x91, 'Æ': 0x92, 'ô': 0x93, 'ö': 0x94, 'ò': 0x95, 'û': 0x96, 'ù': 0x97,
  'ÿ': 0x98, 'Ö': 0x99, 'Ü': 0x9a, 'ø': 0x9b, '£': 0x9c, 'Ø': 0x9d, '×': 0x9e, 'ƒ': 0x9f,
  'á': 0xa0, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3, 'ñ': 0xa4, 'Ñ': 0xa5, 'ª': 0xa6, 'º': 0xa7,
  '¿': 0xa8, '®': 0xa9, '½': 0xab, '¼': 0xac, '¡': 0xad, '«': 0xae, '»': 0xaf,
  'Á': 0xb5, 'Â': 0xb6, 'À': 0xb7, '©': 0xb8,
  'ã': 0xc6, 'Ã': 0xc7,
  'ð': 0xd0, 'Ð': 0xd1, 'Ê': 0xd2, 'Ë': 0xd3, 'È': 0xd4, '€': 0xd5, 'Í': 0xd6, 'Î': 0xd7,
  'Ï': 0xd8, 'Ì': 0xde,
  'Ó': 0xe0, 'ß': 0xe1, 'Ô': 0xe2, 'Ò': 0xe3, 'õ': 0xe4, 'Õ': 0xe5, 'µ': 0xe6, 'þ': 0xe7,
  'Þ': 0xe8, 'Ú': 0xe9, 'Û': 0xea, 'Ù': 0xeb, 'ý': 0xec, 'Ý': 0xed,
  '°': 0xf8, '·': 0xfa, '²': 0xfd,
}

export function encodeCp858(text: string): Buffer {
  const out = Buffer.alloc(text.length)
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    const code = ch.charCodeAt(0)
    if (code < 0x80) {
      out[i] = code // ASCII 1:1
    } else {
      out[i] = CP858[ch] ?? 0x3f // '?' per i caratteri fuori tabella
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Comandi ESC/POS grezzi
const ESC = 0x1b
const GS = 0x1d
const CMD = {
  init: Buffer.from([ESC, 0x40]),                 // ESC @ — reset
  codepageCp858: Buffer.from([ESC, 0x74, 19]),    // ESC t 19 — seleziona PC858
  alignLeft: Buffer.from([ESC, 0x61, 0]),
  alignCenter: Buffer.from([ESC, 0x61, 1]),
  alignRight: Buffer.from([ESC, 0x61, 2]),
  boldOn: Buffer.from([ESC, 0x45, 1]),
  boldOff: Buffer.from([ESC, 0x45, 0]),
  lf: Buffer.from([0x0a]),
  // GS V 66 n — feed n righe e taglia (taglio parziale, "function B"): affidabile su
  // stampanti economiche che non gestiscono bene il full-cut immediato.
  cut: Buffer.from([GS, 0x56, 66, 0x00]),
  // ESC p 0 t1 t2 — impulso cassetto (pin 2), ~50ms/200ms.
  kickDrawer: Buffer.from([ESC, 0x70, 0x00, 0x19, 0x78]),
}

// GS ! n — dimensione carattere: bit alti = larghezza (0-7), bit bassi = altezza (0-7).
function sizeCmd(widthMul: number, heightMul: number): Buffer {
  const w = Math.max(1, Math.min(2, widthMul)) - 1
  const h = Math.max(1, Math.min(8, heightMul)) - 1
  return Buffer.from([GS, 0x21, (w << 4) | h])
}

interface RowStyle { bold?: boolean; align?: 'left' | 'center' | 'right'; w?: number; h?: number }

// Costruttore di scontrino: accumula chunk e produce il Buffer finale.
class Ticket {
  private chunks: Buffer[] = []
  readonly cols: number

  constructor(cols = 42) {
    this.cols = cols
    this.chunks.push(CMD.init, CMD.codepageCp858, CMD.alignLeft)
  }

  private align(a: RowStyle['align']): Buffer {
    return a === 'center' ? CMD.alignCenter : a === 'right' ? CMD.alignRight : CMD.alignLeft
  }

  text(line: string, style: RowStyle = {}): this {
    this.chunks.push(this.align(style.align))
    this.chunks.push(sizeCmd(style.w ?? 1, style.h ?? 1))
    this.chunks.push(style.bold ? CMD.boldOn : CMD.boldOff)
    this.chunks.push(encodeCp858(line), CMD.lf)
    return this
  }

  blank(n = 1): this {
    for (let i = 0; i < n; i++) this.chunks.push(CMD.lf)
    return this
  }

  rule(char = '-'): this {
    return this.text(char.repeat(this.cols), { align: 'left' })
  }

  // Riga "voce ......... valore" giustificata alla larghezza carta.
  // Il valore (prezzo) è a destra; se la voce è troppo lunga viene troncata.
  twoCols(left: string, right: string, style: RowStyle = {}): this {
    const width = this.cols / (style.w === 2 ? 2 : 1)
    let l = left
    const max = Math.floor(width) - right.length - 1
    if (l.length > max) l = l.slice(0, Math.max(0, max))
    const gap = Math.max(1, Math.floor(width) - l.length - right.length)
    return this.text(l + ' '.repeat(gap) + right, { ...style, align: 'left' })
  }

  drawer(): this {
    this.chunks.push(CMD.kickDrawer)
    return this
  }

  cut(): this {
    this.chunks.push(CMD.boldOff, sizeCmd(1, 1), CMD.alignLeft, CMD.lf, CMD.cut)
    return this
  }

  build(): Buffer {
    return Buffer.concat(this.chunks)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Formattazione euro all'italiana: 12.5 → "12,50 €"
function euro(n: number): string {
  return `${(n ?? 0).toFixed(2).replace('.', ',')} €`
}

function nowIt(): string {
  return new Date().toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// COMANDA CUCINA — una sezione per stazione, testo grande e leggibile.
export interface ComandaItem {
  name: string
  quantity: number
  notes?: string
  variant?: string
  station?: string
}

export interface ComandaInput {
  tableNumber?: string
  orderType?: 'table' | 'takeaway'
  customerName?: string
  items: ComandaItem[]
  cols?: number
}

export function buildComanda(input: ComandaInput): Buffer {
  const cols = input.cols ?? 42

  // Raggruppa per stazione (default "CUCINA"): ogni stazione → ticket separato + taglio,
  // così ogni reparto strappa la sua comanda.
  const groups = new Map<string, ComandaItem[]>()
  for (const it of input.items) {
    const st = (it.station || 'CUCINA').toUpperCase()
    if (!groups.has(st)) groups.set(st, [])
    groups.get(st)!.push(it)
  }

  const parts: Buffer[] = []
  for (const [station, items] of groups) {
    const t = new Ticket(cols)
    t.text(station, { align: 'center', bold: true, w: 2, h: 2 })
    const dest = input.orderType === 'takeaway'
      ? 'ASPORTO'
      : `TAVOLO ${input.tableNumber ?? '-'}`
    t.text(dest, { align: 'center', bold: true, h: 2 })
    if (input.customerName) t.text(input.customerName, { align: 'center' })
    t.text(nowIt(), { align: 'center' })
    t.rule('=')
    t.blank()

    for (const it of items) {
      // Riga piatto: quantità + nome, doppia altezza per leggibilità al passe.
      t.text(`${it.quantity}x ${it.name}`, { bold: true, h: 2 })
      if (it.variant) t.text(`   (${it.variant})`, { h: 1 })
      if (it.notes) t.text(`   >> ${it.notes}`, { bold: true, h: 1 })
      t.blank()
    }

    t.rule('=')
    t.cut()
    parts.push(t.build())
  }

  return Buffer.concat(parts)
}

// ─────────────────────────────────────────────────────────────────────────────
// SCONTRINO / NOTA CONTO (cortesia, NON fiscale).
export interface ScontrinoItem {
  name: string
  quantity: number
  unitPrice: number // euro
}

export interface ScontrinoInput {
  restaurantName: string
  address?: string
  phone?: string
  vatNumber?: string
  tableNumber?: string
  covers?: number
  items: ScontrinoItem[]
  subtotal: number
  coverCharge?: number // coperto totale
  discount?: number
  discountNote?: string
  tip?: number
  total: number
  paymentMethod?: 'cash' | 'card' | 'digital' | 'split'
  openDrawer?: boolean
  cols?: number
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Contanti', card: 'Carta', digital: 'Digitale', split: 'Misto',
}

export function buildScontrino(input: ScontrinoInput): Buffer {
  const t = new Ticket(input.cols ?? 42)

  // Intestazione ristorante
  t.text(input.restaurantName, { align: 'center', bold: true, w: 2, h: 2 })
  if (input.address) t.text(input.address, { align: 'center' })
  if (input.phone) t.text(`Tel. ${input.phone}`, { align: 'center' })
  if (input.vatNumber) t.text(`P.IVA ${input.vatNumber}`, { align: 'center' })
  t.blank()
  const head: string[] = []
  if (input.tableNumber) head.push(`Tavolo ${input.tableNumber}`)
  if (input.covers) head.push(`Coperti: ${input.covers}`)
  if (head.length) t.text(head.join('   '), { align: 'center' })
  t.text(nowIt(), { align: 'center' })
  t.rule('=')

  // Righe conto
  for (const it of input.items) {
    const line = it.unitPrice * it.quantity
    t.twoCols(`${it.quantity}x ${it.name}`, euro(line))
  }
  t.rule('-')

  // Totali
  t.twoCols('Subtotale', euro(input.subtotal))
  if (input.coverCharge) t.twoCols('Coperto', euro(input.coverCharge))
  if (input.discount) {
    t.twoCols(`Sconto${input.discountNote ? ` (${input.discountNote})` : ''}`, `-${euro(input.discount)}`)
  }
  if (input.tip) t.twoCols('Mancia', euro(input.tip))
  t.rule('-')
  t.twoCols('TOTALE', euro(input.total), { bold: true, h: 2 })
  t.blank()

  if (input.paymentMethod) {
    t.text(`Pagamento: ${PAYMENT_LABELS[input.paymentMethod] ?? input.paymentMethod}`, { align: 'center' })
  }
  t.blank()
  t.text('Documento non fiscale', { align: 'center' })
  t.text('Grazie e arrivederci!', { align: 'center', bold: true })

  // Cassetto: solo su contanti e se richiesto.
  if (input.openDrawer && input.paymentMethod === 'cash') t.drawer()
  t.cut()

  return t.build()
}

// ─────────────────────────────────────────────────────────────────────────────
// STAMPA DI PROVA — una riga di prova reale + info stampante.
export function buildTestTicket(restaurantName: string, cols = 42): Buffer {
  const t = new Ticket(cols)
  t.text('TAKO', { align: 'center', bold: true, w: 2, h: 2 })
  t.text('Stampa di prova', { align: 'center', bold: true })
  t.rule('=')
  t.text(restaurantName, { align: 'center' })
  t.text(nowIt(), { align: 'center' })
  t.blank()
  t.text('Accenti: àèéìòù çÀÈ €', { align: 'center' })
  t.text('Se leggi questa riga senza', { align: 'center' })
  t.text('caratteri strani, la stampante', { align: 'center' })
  t.text('e configurata correttamente.', { align: 'center' })
  t.cut()
  return t.build()
}
