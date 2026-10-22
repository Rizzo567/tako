// Messaggi iframe ↔ SPA della vista di modifica (CONTRATTO §4, dashboard editor 22/10). Logica pura, testata in tests/web.
// Same-origin, `v:1`, origine ed `event.source` verificati dal chiamante con `acceptParentMessage`.
import type { Op } from '../../../../../packages/menu-ops/src/types'

export const EDIT_PROTOCOL_VERSION = 1 as const
export type ModelKind = 'menu' | 'section' | 'item'
export type EditSelection = { kind: ModelKind; id: string } | null

export type EditStateMessage = { type: 'tako-menu-edit-state'; v: 1; document: any; menuId: string; selection: EditSelection; flash: string[]; disabled: boolean; editing: boolean }
export type EditExitMessage = { type: 'tako-menu-edit-exit'; v: 1 }
export type ParentMessage = EditStateMessage | EditExitMessage

const KINDS = new Set<ModelKind>(['menu', 'section', 'item'])
const isSelection = (value: unknown): value is EditSelection =>
  value === null || value === undefined || (typeof value === 'object' && KINDS.has((value as any).kind) && typeof (value as any).id === 'string' && !!(value as any).id)

/** Valida un messaggio della SPA. Ritorna null se non è del protocollo (tipo, versione o forma sbagliati). */
export function parseParentMessage(data: unknown): ParentMessage | null {
  if (!data || typeof data !== 'object') return null
  const m = data as Record<string, unknown>
  if (m.v !== EDIT_PROTOCOL_VERSION) return null
  if (m.type === 'tako-menu-edit-exit') return { type: 'tako-menu-edit-exit', v: 1 }
  if (m.type !== 'tako-menu-edit-state') return null
  if (!m.document || typeof m.document !== 'object' || typeof m.menuId !== 'string' || !m.menuId) return null
  if (!isSelection(m.selection)) return null
  const flash = Array.isArray(m.flash) ? m.flash.filter((x): x is string => typeof x === 'string').slice(0, 200) : []
  return { type: 'tako-menu-edit-state', v: 1, document: m.document, menuId: m.menuId, selection: (m.selection as EditSelection) ?? null, flash, disabled: m.disabled === true, editing: m.editing === true }
}

/** Accetta solo messaggi della finestra genitore, stessa origine, del protocollo v1. */
export function acceptParentMessage(event: { origin: string; source: unknown; data: unknown }, origin: string, parent: unknown): ParentMessage | null {
  if (event.origin !== origin || event.source !== parent || parent == null) return null
  return parseParentMessage(event.data)
}

/** Messaggi iframe → SPA. */
export const outgoing = {
  ready: () => ({ type: 'tako-menu-edit-ready' as const, v: 1 as const }),
  select: (selection: EditSelection) => selection ? { type: 'tako-menu-edit-select' as const, v: 1 as const, kind: selection.kind, id: selection.id } : { type: 'tako-menu-edit-select' as const, v: 1 as const, kind: null },
  open: (selection: { kind: ModelKind; id: string }) => ({ type: 'tako-menu-edit-open' as const, v: 1 as const, kind: selection.kind, id: selection.id }),
  ops: (ops: Op[], seq: number, provisional = false) => ({ type: 'tako-menu-edit-ops' as const, v: 1 as const, ops, seq, ...(provisional ? { provisional: true } : {}) }),
  mode: (editing: boolean) => ({ type: 'tako-menu-edit-mode' as const, v: 1 as const, editing }),
  menu: (menuId: string) => ({ type: 'tako-menu-edit-menu' as const, v: 1 as const, menuId }),
  /** Ordine che il cliente vede ora (solo con documento non manuale): la SPA lo usa per la fotografia quando si crea un Menu o un Sottomenu. */
  view: (view: { menuOrder: string[]; sectionOrder: Record<string, string[]> }) => ({ type: 'tako-menu-edit-view' as const, v: 1 as const, view }),
  error: (code: string) => ({ type: 'tako-menu-edit-error' as const, v: 1 as const, code }),
}

export const sameSelection = (a: EditSelection, b: EditSelection) => (!a && !b) || (!!a && !!b && a.kind === b.kind && a.id === b.id)
