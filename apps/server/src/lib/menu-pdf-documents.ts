import { Buffer } from 'node:buffer'
import { z } from 'zod'
import { pdfConfigSchema, type Workspace } from './menu-workspace-contract.js'

/** PDF multipli per locale (21/10/2026, decisione `brain/decisioni/2026-10-21-takomenu-pdf-multipli-sempre-aggiornati.md`,
 * CONTRATTO §7 in docs/webapp/menu-prezzo-fisso-2026-10-21). I documenti stanno in `restaurants.settings.pdfDocuments`
 * (nessuna tabella nuova). Ogni PDF si genera SEMPRE dal menu pubblicato del momento: qui solo dati e regole pure,
 * niente DB, così le stesse funzioni servono route, test e script di confronto. */
export const MAX_PDF_DOCUMENTS = 12
export const SHARE_TOKEN = /^[A-Za-z0-9_-]{32,128}$/
/** Grafica del documento: qualsiasi sottoinsieme della config PDF del locale (assente = quella del locale). */
export const pdfDocumentConfigSchema = pdfConfigSchema.partial()
const menuIdsSchema = z.array(z.string().uuid()).min(1).max(50).refine(ids => new Set(ids).size === ids.length, 'Menu ripetuto nel documento')
export const pdfDocumentSchema = z.object({
 id: z.string().uuid(),
 name: z.string().trim().min(1).max(80),
 menuIds: menuIdsSchema,
 config: pdfDocumentConfigSchema.optional(),
 shareToken: z.string().regex(SHARE_TOKEN).nullable().default(null),
 updatedAt: z.string().datetime(),
})
export type PdfDocument = z.infer<typeof pdfDocumentSchema>
/** Corpo di PUT: il client non manda mai token né date (si conservano per id). */
export const pdfDocumentsInputSchema = z.object({
 documents: z.array(z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(80), menuIds: menuIdsSchema, config: pdfDocumentConfigSchema.optional() })).max(MAX_PDF_DOCUMENTS)
  .refine(docs => { const ids = docs.map(d => d.id).filter(Boolean); return new Set(ids).size === ids.length }, 'Documento ripetuto'),
})
export type PdfDocumentsInput = z.infer<typeof pdfDocumentsInputSchema>

/** Documenti salvati nel blob settings. Righe rovinate si scartano una per una: mai un errore al ristoratore. */
export function readPdfDocuments(settings: unknown): PdfDocument[] {
 const raw = settings && typeof settings === 'object' ? (settings as { pdfDocuments?: unknown }).pdfDocuments : undefined
 if (!Array.isArray(raw)) return []
 const out: PdfDocument[] = []
 for (const entry of raw.slice(0, MAX_PDF_DOCUMENTS)) { const parsed = pdfDocumentSchema.safeParse(entry); if (parsed.success && !out.some(d => d.id === parsed.data.id)) out.push(parsed.data) }
 return out
}

/** Nessun documento salvato → «PDF predefinito» con tutti i Menu attivi (calcolato, non salvato). */
export function defaultPdfDocument(workspace: Pick<Workspace, 'menus'> | null | undefined): { name: string; menuIds: string[] } {
 return { name: 'Tutti i menu', menuIds: (workspace?.menus ?? []).filter(m => m.active).map(m => m.id) }
}

/** Token del link fisso: 32 byte casuali → 43 caratteri base64url (WebCrypto: c'è sia in Node sia nell'edge Deno). */
export function newShareToken(): string {
 const bytes = new Uint8Array(32); globalThis.crypto.getRandomValues(bytes)
 return Buffer.from(bytes).toString('base64url')
}

/** PUT: sostituisce l'elenco mantenendo token esistenti per id; i documenti nuovi nascono senza link. */
export function mergePdfDocuments(existing: PdfDocument[], input: PdfDocumentsInput, now = new Date(), newId: () => string = () => globalThis.crypto.randomUUID()): PdfDocument[] {
 const byId = new Map(existing.map(d => [d.id, d]))
 return input.documents.map(doc => {
  const previous = doc.id ? byId.get(doc.id) : undefined
  const next: PdfDocument = { id: doc.id ?? newId(), name: doc.name, menuIds: [...doc.menuIds], shareToken: previous?.shareToken ?? null, updatedAt: now.toISOString() }
  if (doc.config && Object.keys(doc.config).length) next.config = doc.config
  if (previous && previous.name === next.name && JSON.stringify(previous.menuIds) === JSON.stringify(next.menuIds) && JSON.stringify(previous.config ?? null) === JSON.stringify(next.config ?? null)) next.updatedAt = previous.updatedAt
  return next
 })
}

/** Workspace con la grafica del documento sopra quella del locale. */
export function documentWorkspace(workspace: Workspace, doc: Pick<PdfDocument, 'config'>): Workspace {
 if (!doc.config || !Object.keys(doc.config).length) return workspace
 return { ...workspace, pdf: pdfConfigSchema.parse({ ...workspace.pdf, ...doc.config }) }
}

/** Menu del documento ancora presenti e attivi nel workspace pubblicato, nell'ordine del documento. */
export function documentMenuIds(workspace: Pick<Workspace, 'menus'>, doc: Pick<PdfDocument, 'menuIds'>): string[] {
 return doc.menuIds.filter(id => workspace.menus.some(m => m.id === id && m.active))
}

/** Nome file leggibile e sicuro per Content-Disposition. */
export function documentFilename(name: string): string {
 const slug = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
 return `${slug || 'menu'}.pdf`
}

/** ETag del PDF pubblico: revisione pubblicata + hash di (documento, grafica effettiva, lingua, giorno).
 * Il giorno c'è perché i piatti con data di fine scadono da soli anche senza nuova pubblicazione. */
export async function documentEtag(input: { publishedRevision: number | null; doc: Pick<PdfDocument, 'id' | 'name' | 'menuIds' | 'config'>; pdf: Workspace['pdf']; language: string; restaurantName: string; businessDay: string }): Promise<string> {
 const payload = JSON.stringify([input.doc.id, input.doc.name, input.doc.menuIds, input.doc.config ?? null, input.pdf, input.language, input.restaurantName, input.businessDay])
 const digest = Buffer.from(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))).toString('hex').slice(0, 24)
 return `"r${input.publishedRevision ?? 0}-${digest}"`
}

/** If-None-Match: confronto forte, accetta elenchi e `*`. */
export function etagMatches(header: string | string[] | undefined, etag: string): boolean {
 const value = Array.isArray(header) ? header.join(',') : header
 if (!value) return false
 return value.split(',').map(v => v.trim().replace(/^W\//, '')).some(v => v === '*' || v === etag)
}
