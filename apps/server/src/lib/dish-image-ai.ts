// ─────────────────────── Tako — FOTO PIATTO con AI (Nano Banana Pro / Gemini) ───────────────────────
// Quando l'owner carica la foto di un piatto (WhatsApp o dashboard/copilot) e il flag
// `aiPhotoEnabled` è attivo, la trasformiamo in una foto da menù professionale con uno
// STILE COERENTE (sempre lo stesso prompt) tramite il modello immagini di Google Gemini
// ("Nano Banana" = gemini-2.5-flash-image; "Nano Banana Pro" = variante pro, impostabile
// via env GEMINI_IMAGE_MODEL). Best-effort: qualsiasi errore → si tiene la foto originale.
import { db, restaurants } from '@tako/db'
import { eq } from 'drizzle-orm'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createPublicKey, verify as edVerify } from 'node:crypto'
import { UPLOADS_DIR } from './image-store.js'
import { isOnline } from './connectivity.js'

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

// Prompt usato quando c'è un'IMMAGINE DI RIFERIMENTO per il ristorante: la prima immagine
// definisce lo stile (luce, sfondo, angolo, mood), la seconda è il piatto reale da rifotografare.
const STYLE_PROMPT_REF = [
  'Hai DUE immagini. La PRIMA è la SCENA/STILE di riferimento (tipo di piatto, superficie del tavolo,',
  'illuminazione, angolo di ripresa, atmosfera). La SECONDA mostra il CIBO reale da usare.',
  'Ricrea da zero una fotografia professionale del CIBO della seconda immagine, ma impiattato e',
  'fotografato ESATTAMENTE nella scena della PRIMA immagine: STESSO tipo di piatto (forma e colore),',
  'STESSA superficie/tovaglia, STESSA illuminazione direzionale morbida, STESSO angolo e mood editoriale fine-dining.',
  'Sostituisci completamente il piatto e lo sfondo dell\'originale con quelli del riferimento.',
  'MANTIENI fedeli SOLO gli ingredienti e il tipo di pietanza della seconda immagine: non inventare cibo diverso',
  'e NON copiare il cibo della prima immagine. Nessun testo, nessun logo, nessun watermark, nessuna persona.',
].join(' ')

// Immagine di riferimento per-ristorante (ancora di stile): <UPLOADS_DIR>/<rid>/_style_ref.jpg.
// Si tara con ogni proprietario finché lo stile in output lo convince; da lì tutti i piatti
// vengono uniformati a quella reference. Opzionale: senza reference si usa lo STYLE_PROMPT fisso.
function styleRefPath(restaurantId: string): string {
  return join(UPLOADS_DIR, restaurantId, '_style_ref.jpg')
}
export function hasStyleRef(restaurantId: string): boolean {
  try { return existsSync(styleRefPath(restaurantId)) } catch { return false }
}
function loadStyleRef(restaurantId: string): Buffer | null {
  try { const p = styleRefPath(restaurantId); return existsSync(p) ? readFileSync(p) : null } catch { return null }
}
// Imposta/aggiorna la reference del ristorante (il buffer è già validato+re-encodato a monte).
export function setStyleRef(restaurantId: string, buf: Buffer): void {
  const dir = join(UPLOADS_DIR, restaurantId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(styleRefPath(restaurantId), buf)
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

// true se il ristorante ha attivato aiPhotoEnabled E c'è una chiave Gemini configurata.
export async function aiPhotoEnabledFor(restaurantId: string): Promise<boolean> {
  if (!isOnline()) return false // fast-fail: senza internet niente styling (evita il "sto migliorando" a vuoto)
  if (!geminiKey()) return false
  try {
    const [r] = await db.select({ settings: restaurants.settings }).from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1)
    return (r?.settings as any)?.aiPhotoEnabled === true
  } catch { return false }
}

// Genera la versione stilizzata col MODELLO indicato; ritorna il Buffer o null (best-effort).
export async function generateStyledDishImage(buf: Buffer, mimeType: string, model: string, refBuf?: Buffer | null): Promise<Buffer | null> {
  const key = geminiKey()
  if (!key) return null
  const ac = new AbortController()
  const to = setTimeout(() => ac.abort(), 45_000)
  try {
    // Con reference: [testo, RIFERIMENTO, piatto]. Senza: [testo, piatto].
    const reqParts = refBuf
      ? [
          { text: STYLE_PROMPT_REF },
          { inline_data: { mime_type: 'image/jpeg', data: refBuf.toString('base64') } },
          { inline_data: { mime_type: mimeType, data: buf.toString('base64') } },
        ]
      : [
          { text: STYLE_PROMPT },
          { inline_data: { mime_type: mimeType, data: buf.toString('base64') } },
        ]
    const res = await fetch(`${GEMINI_URL}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ac.signal,
      body: JSON.stringify({
        contents: [{ parts: reqParts }],
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
    if (!isOnline()) return buf // fast-fail offline: niente attese sui timeout di rete
    if (!geminiKey()) return buf
    const [r] = await db.select({ settings: restaurants.settings }).from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1)
    const s = (r?.settings ?? {}) as any
    if (s.aiPhotoEnabled !== true) return buf
    // La reference (style-transfer da immagine) funziona SOLO col modello Pro: flash è un
    // editor e o ignora la reference o ne copia il cibo → su flash NON passiamo la reference
    // (usa lo STYLE_PROMPT testuale, che dà comunque una foto pulita). Pro + reference = Michelin.
    const isPro = verifyProCode(restaurantId, s.aiPhotoProCode)
    const model = isPro ? MODEL_PRO : MODEL_BASE
    const ref = isPro ? loadStyleRef(restaurantId) : null
    const styled = await generateStyledDishImage(buf, mimeType, model, ref)
    return styled ?? buf
  } catch { return buf }
}
