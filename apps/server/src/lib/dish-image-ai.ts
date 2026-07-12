// ─────────────────────── Tako — FOTO PIATTO con AI (Nano Banana Pro / Gemini) ───────────────────────
// Quando l'owner carica la foto di un piatto (WhatsApp o dashboard/copilot) e il flag
// `aiPhotoEnabled` è attivo, la trasformiamo in una foto da menù professionale con uno
// STILE COERENTE (sempre lo stesso prompt) tramite il modello immagini di Google Gemini
// ("Nano Banana" = gemini-2.5-flash-image; "Nano Banana Pro" = variante pro, impostabile
// via env GEMINI_IMAGE_MODEL). Best-effort: qualsiasi errore → si tiene la foto originale.
import { db, restaurants } from '@tako/db'
import { eq } from 'drizzle-orm'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createPublicKey, verify as edVerify } from 'node:crypto'

// ─────────────────── Sblocco PRO (Nano Banana Pro) — a prova di crack ───────────────────
// Il modello Pro (più costoso, qualità max) si sblocca SOLO con un CODICE firmato da Manuel
// con la sua chiave PRIVATA (offline, mai nell'appliance). Qui c'è solo la chiave PUBBLICA:
// verifica la firma ma non può crearne → il ristoratore, anche con accesso completo al Mac
// (DB, config, bundle), NON può forgiare un codice valido. Il codice è legato al restaurantId
// (non copiabile tra ristoranti) e la firma si verifica AD OGNI generazione (un flag nel DB
// non basta). Senza codice valido → modello base (flash). Con codice valido → Pro.
const PRO_PUBLIC_KEY_B64 = 'MCowBQYDK2VwAyEAOAvH9O4XyeH41pNy0ybofIQd8StR+PYWTpMaTUyaVsM='
let _pub: ReturnType<typeof createPublicKey> | null = null
function proPublicKey() {
  if (!_pub) _pub = createPublicKey({ key: Buffer.from(PRO_PUBLIC_KEY_B64, 'base64'), format: 'der', type: 'spki' })
  return _pub
}
// true se `code` è una firma Ed25519 valida di `restaurantId` (fatta con la privata di Manuel).
export function verifyProCode(restaurantId: string, code: string | undefined | null): boolean {
  if (!code || !restaurantId) return false
  try {
    return edVerify(null, Buffer.from(restaurantId, 'utf8'), proPublicKey(), Buffer.from(String(code).trim(), 'base64'))
  } catch { return false }
}

const MODEL_PRO = 'gemini-3-pro-image'      // Nano Banana Pro (solo con codice valido)
const MODEL_BASE = 'gemini-2.5-flash-image' // base (flash), col solo toggle attivo

// La chiave Gemini: da env GEMINI_API_KEY, oppure (comodo sull'app pacchettizzata dove
// non si settano env) da un file `gemini-key.txt` in TAKO_HOME. Così basta incollare la
// chiave in quel file — nessuna configurazione di sistema.
function geminiKey(): string | null {
  const env = process.env['GEMINI_API_KEY']
  if (env && env.trim()) return env.trim()
  // Nessuna cache: così se incolli la chiave nel file mentre il server è già su, viene
  // raccolta senza riavvio (la lettura è economica e la generazione è comunque rara).
  try {
    const home = process.env['TAKO_HOME'] ?? join(homedir(), '.tako')
    const k = readFileSync(join(home, 'gemini-key.txt'), 'utf8').trim()
    return k || null
  } catch { return null }
}

// Stile FISSO applicato a ogni piatto → coerenza visiva su tutto il menù.
const STYLE_PROMPT = [
  'Trasforma questa foto in una fotografia professionale da menù di ristorante.',
  'Stile coerente e fisso: illuminazione naturale morbida dall\'alto, sfondo neutro pulito e sfocato,',
  'inquadratura ravvicinata e appetitosa a ~45°, colori vividi e naturali, alta nitidezza, look editoriale elegante.',
  'MANTIENI fedele il piatto reale, gli ingredienti e le porzioni: non inventare cibo diverso.',
  'Nessun testo, nessun logo, nessun watermark, nessuna persona.',
].join(' ')

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

// true se il ristorante ha attivato aiPhotoEnabled E c'è una chiave Gemini configurata.
export async function aiPhotoEnabledFor(restaurantId: string): Promise<boolean> {
  if (!geminiKey()) return false
  try {
    const [r] = await db.select({ settings: restaurants.settings }).from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1)
    return (r?.settings as any)?.aiPhotoEnabled === true
  } catch { return false }
}

// Genera la versione stilizzata col MODELLO indicato; ritorna il Buffer o null (best-effort).
export async function generateStyledDishImage(buf: Buffer, mimeType: string, model: string): Promise<Buffer | null> {
  const key = geminiKey()
  if (!key) return null
  const ac = new AbortController()
  const to = setTimeout(() => ac.abort(), 45_000)
  try {
    const res = await fetch(`${GEMINI_URL}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ac.signal,
      body: JSON.stringify({
        contents: [{ parts: [
          { text: STYLE_PROMPT },
          { inline_data: { mime_type: mimeType, data: buf.toString('base64') } },
        ] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    })
    if (!res.ok) { console.error('[dish-image-ai] Gemini HTTP', res.status); return null }
    const j: any = await res.json()
    const parts = j?.candidates?.[0]?.content?.parts ?? []
    for (const p of parts) {
      const data = p?.inline_data?.data ?? p?.inlineData?.data
      if (data) return Buffer.from(String(data), 'base64')
    }
    console.error('[dish-image-ai] nessuna immagine nella risposta Gemini')
    return null
  } catch (err) {
    console.error('[dish-image-ai] generazione fallita:', (err as Error)?.message)
    return null
  } finally { clearTimeout(to) }
}

// Applica lo stile SE il flag è attivo e la chiave c'è; sceglie il modello: Pro solo con
// codice firmato valido, altrimenti base (flash). Sempre non-lanciante: originale = fallback.
export async function maybeStyleDishImage(restaurantId: string, buf: Buffer, mimeType: string): Promise<Buffer> {
  try {
    if (!geminiKey()) return buf
    const [r] = await db.select({ settings: restaurants.settings }).from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1)
    const s = (r?.settings ?? {}) as any
    if (s.aiPhotoEnabled !== true) return buf
    const model = verifyProCode(restaurantId, s.aiPhotoProCode) ? MODEL_PRO : MODEL_BASE
    const styled = await generateStyledDishImage(buf, mimeType, model)
    return styled ?? buf
  } catch { return buf }
}
