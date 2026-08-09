// Ridimensionamento della foto PRIMA dell'upload (piano §5 F4.3, Exit).
//
// Una fotocamera moderna produce 12–48 MP: un JPEG da 6–12 MB che sfonda o sfiora il
// limite multipart di 10 MB del server. L'Exit del piano è esplicita su quale delle
// due leve tirare: si ridimensiona LATO CLIENT, non si alza il limite del server —
// perché il limite protegge anche da tutto il resto, e perché su 4G attraverso il
// tunnel un upload da 10 MB è comunque un minuto di attesa in piedi accanto al piatto.
//
// 1600 px di lato lungo: il server ri-encoda comunque a 2000 px (`image-store.ts`,
// MAX_DIMENSION), quindi oltre non c'è nessun guadagno di qualità — solo byte.
//
// Best-effort in senso stretto: se `createImageBitmap`, il canvas o `toBlob` non
// sono disponibili o falliscono, si carica il file ORIGINALE. Meglio un upload lento
// di un ristoratore che non riesce a mettere la foto.

const MAX_SIDE = 1600
const QUALITY = 0.86

export interface Resized {
  blob: Blob
  filename: string
  /** true se la foto è stata davvero rimpicciolita (utile per raccontarlo all'utente). */
  shrunk: boolean
  width: number
  height: number
}

export async function resizeForUpload(file: File, maxSide = MAX_SIDE): Promise<Resized> {
  const fallback: Resized = { blob: file, filename: file.name || 'foto.jpg', shrunk: false, width: 0, height: 0 }
  if (typeof createImageBitmap !== 'function') return fallback

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return fallback
  }

  try {
    const { width: w, height: h } = bitmap
    const scale = Math.min(1, maxSide / Math.max(w, h))
    // Già piccola: nessuna ri-codifica. Ricomprimere un JPEG piccolo lo peggiora e
    // basta — e su una foto di piatto la perdita si vede.
    if (scale >= 1) return { ...fallback, width: w, height: h }

    const width = Math.round(w * scale)
    const height = Math.round(h * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return fallback
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => {
      // JPEG e non WebP: il server accetta entrambi, ma il JPEG è ciò che si aspetta
      // Gemini nella pipeline di stile, e Safari lo produce da sempre.
      canvas.toBlob((b) => resolve(b), 'image/jpeg', QUALITY)
    })
    if (!blob) return fallback

    const base = (file.name || 'foto').replace(/\.[^.]+$/, '')
    return { blob, filename: `${base}.jpg`, shrunk: true, width, height }
  } catch {
    return fallback
  } finally {
    bitmap.close?.()
  }
}
