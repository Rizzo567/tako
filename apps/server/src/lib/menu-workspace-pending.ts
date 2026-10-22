// «Ci sono modifiche non pubblicate» (dashboard editor 22/10): si decide per CONTENUTO, non per revisione.
// In SQL: `draft IS DISTINCT FROM published` (uguaglianza jsonb semantica). Qui la stessa regola in JS per righe già lette.
// Prima: revision !== published_revision — non vale più, perché il bot pubblica solo la sua modifica e la revisione
// della bozza sale a ogni op della dashboard.
export const PENDING_SQL = 'draft IS DISTINCT FROM published'

/** Uguaglianza strutturale come jsonb: ordine delle chiavi irrilevante, ordine degli array rilevante. */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) { const bb = b as unknown[]; return a.length === bb.length && a.every((v, i) => jsonEqual(v, bb[i])) }
  const ao = a as Record<string, unknown>, bo = b as Record<string, unknown>
  const ak = Object.keys(ao).filter(k => ao[k] !== undefined), bk = Object.keys(bo).filter(k => bo[k] !== undefined)
  return ak.length === bk.length && ak.every(k => Object.prototype.hasOwnProperty.call(bo, k) && jsonEqual(ao[k], bo[k]))
}

/** true se la bozza differisce dal pubblicato (o non c'è mai stata una pubblicazione e la bozza esiste). */
export function pendingOf(row: { draft: unknown; published: unknown } | null | undefined): boolean {
  if (!row) return false
  if (row.published == null) return row.draft != null
  return !jsonEqual(row.draft, row.published)
}
