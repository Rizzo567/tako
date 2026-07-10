// Sprite pixel-art del polpo Tako + badge centrale per i QR.
//
// Lo sprite è disegnato in codice (griglia 16×16) e renderizzato con sharp: nessun
// asset PNG da shippare nel bundle/deploy, nessuna dipendenza da file su disco. Il
// badge è il polpo su un quadrato chiaro arrotondato che fa da "quiet zone" al centro
// del QR. Si usa con errorCorrectionLevel 'H' (≈30% ridondanza) così coprire il ~24%
// centrale non rompe la scansione.
import sharp from 'sharp'

// Griglia pixel-art del polpo. Pochi pixel = blocchi grandi, look chunky.
// B = corpo polpo, W = bianco occhio, K = pupilla, '.' = trasparente.
const GRID = [
  '...........',
  '...BBBBB...',
  '..BBBBBBB..',
  '.BBBBBBBBB.',
  '.BBBBBBBBB.',
  '.BBWBBBWBB.',
  '.BBBBBBBBB.',
  '.BBBBBBBBB.',
  '.BBBBBBBBB.',
  '.B.B.B.B.B.',
  '...........',
]
const GRID_H = GRID.length
const GRID_W = GRID[0]!.length

// Bianco e nero: corpo nel dark del QR (#2A1F1A), occhi bianchi sul corpo scuro.
const COLORS: Record<string, [number, number, number, number]> = {
  B: [42, 31, 26, 255],    // corpo (= dark dei moduli QR)
  W: [255, 255, 255, 255], // occhi
  K: [42, 31, 26, 255],
  '.': [0, 0, 0, 0],
}

// Costruisce il buffer RGBA grezzo dello sprite (dimensioni dalla griglia).
function octopusRaw(): Buffer {
  const buf = Buffer.alloc(GRID_W * GRID_H * 4)
  for (let y = 0; y < GRID_H; y++) {
    const row = GRID[y]!
    for (let x = 0; x < GRID_W; x++) {
      const [r, g, b, a] = COLORS[row[x]!] ?? COLORS['.']!
      const i = (y * GRID_W + x) * 4
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a
    }
  }
  return buf
}

// Cache per dimensione: il badge è deterministico, lo calcoliamo una volta sola.
const cache = new Map<number, Promise<Buffer>>()

/** Badge PNG (polpo pixel su quadrato chiaro arrotondato) da comporre al centro del QR. */
export function octopusBadge(size = 96): Promise<Buffer> {
  let p = cache.get(size)
  if (!p) {
    p = buildBadge(size)
    cache.set(size, p)
  }
  return p
}

async function buildBadge(size: number): Promise<Buffer> {
  const inner = Math.round(size * 0.78) // il polpo non tocca i bordi del pad
  // Resize NEAREST per mantenere i pixel netti (no anti-aliasing → vero pixel-art).
  const octo = await sharp(octopusRaw(), { raw: { width: GRID_W, height: GRID_H, channels: 4 } })
    .resize(inner, inner, { kernel: 'nearest' })
    .png()
    .toBuffer()

  const radius = Math.round(size * 0.22)
  const pad = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#FFF8F3"/></svg>`,
  )

  return sharp(pad).composite([{ input: octo, gravity: 'center' }]).png().toBuffer()
}

/**
 * Genera il QR del `url` con il badge polpo al centro. Restituisce un data-URL PNG.
 * EC level 'H' è obbligatorio per tollerare il logo centrale.
 */
export async function qrWithOctopus(url: string, width = 400): Promise<string> {
  const QRCode = (await import('qrcode')).default
  const qrBuf = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H',
    width,
    margin: 2,
    color: { dark: '#2A1F1A', light: '#FFF8F3' },
  })
  const badge = await octopusBadge(Math.round(width * 0.28))
  const out = await sharp(qrBuf).composite([{ input: badge, gravity: 'center' }]).png().toBuffer()
  return `data:image/png;base64,${out.toString('base64')}`
}
