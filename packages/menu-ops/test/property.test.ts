// Property test: ≥ 2000 sequenze casuali con PRNG seminato (riproducibile). Seme di partenza in SEED.
import { describe, expect, it } from 'vitest'
import { applyOps, type Op, type WsDocument, type Kind, FIELD_WHITELIST } from '../src/index.js'

const SEED = 0x7a4c0de
function prng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
type R = () => number
const pick = <T>(r: R, list: readonly T[]): T => list[Math.floor(r() * list.length)]!
const int = (r: R, n: number) => Math.floor(r() * n)

function randomDoc(r: R): WsDocument {
  let n = 0; const id = (p: string) => `${p}${n++}`
  const menus = Array.from({ length: 1 + int(r, 3) }, () => {
    const sections: WsDocument['menus'][number]['sections'] = []
    for (let k = 0, roots = 1 + int(r, 4); k < roots; k++) {
      const root = { id: id('s'), parentSectionId: null, name: 'R', translations: {}, items: Array.from({ length: int(r, 4) }, () => ({ id: id('i'), name: 'P', price: int(r, 20), translations: {} })) }
      sections.push(root)
      for (let c = 0, kids = int(r, 3); c < kids; c++) sections.push({ id: id('s'), parentSectionId: root.id, name: 'C', translations: {}, items: Array.from({ length: int(r, 3) }, () => ({ id: id('i'), name: 'P', price: 1, translations: {} })) })
    }
    return { id: id('m'), name: 'M', translations: {}, sections }
  })
  return { menus, design: {} }
}

const allIds = (w: WsDocument) => w.menus.flatMap(m => [m.id, ...m.sections.flatMap(s => [s.id, ...s.items.map(i => i.id)])])
const itemIdsOf = (w: WsDocument) => w.menus.flatMap(m => m.sections.flatMap(s => s.items.map(i => i.id)))
const ofKind = (w: WsDocument, k: Kind) => k === 'menu' ? w.menus.map(m => m.id) : k === 'section' ? w.menus.flatMap(m => m.sections.map(s => s.id)) : itemIdsOf(w)

let fresh = 0
function randomOp(r: R, w: WsDocument): Op {
  const kind = pick(r, ['menu', 'section', 'item', 'item', 'item'] as const)
  const ids = [...ofKind(w, kind), 'ghost']
  const any = [...allIds(w), 'ghost']
  const at = () => pick(r, [undefined, { beforeId: pick(r, any) }, { afterId: pick(r, any) }])
  switch (pick(r, ['set', 'set', 'create', 'create', 'move', 'move', 'move', 'remove', 'reorder', 'manualOrder'] as const)) {
    case 'set': return { op: 'set', kind, id: pick(r, ids), fields: r() < 0.1 ? { bogus: 1 } : { [pick(r, FIELD_WHITELIST[kind])]: int(r, 100) } }
    case 'create': {
      const id = r() < 0.15 ? pick(r, any) : `n${fresh++}`
      if (kind === 'menu') return { op: 'create', kind, id, fields: { name: 'N' }, at: at() }
      if (kind === 'section') {
        const menu = pick(r, w.menus.length ? w.menus : [{ id: 'ghost', sections: [] }])
        const parent = r() < 0.4 && menu.sections.length ? pick(r, menu.sections).id : undefined
        return { op: 'create', kind, id, parentId: menu.id, fields: parent ? { name: 'N', parentSectionId: parent } : { name: 'N' }, at: at() }
      }
      return { op: 'create', kind, id, parentId: pick(r, [...ofKind(w, 'section'), 'ghost']), fields: { name: 'N', price: 2 }, at: at() }
    }
    case 'move':
      if (kind === 'item') return { op: 'move', kind, id: pick(r, ids), toParentId: pick(r, [undefined, ...ofKind(w, 'section'), 'ghost']), at: at() }
      if (kind === 'section') return { op: 'move', kind, id: pick(r, ids), toParentId: pick(r, [undefined, null, ...ofKind(w, 'section')]), at: at() }
      return { op: 'move', kind, id: pick(r, ids), at: at() }
    case 'remove': return { op: 'remove', kind, id: pick(r, ids) }
    case 'reorder': {
      if (r() < 0.5) return { op: 'reorder', kind: 'menu', ids: shuffle(r, [...w.menus.map(m => m.id), 'ghost']) }
      const menu = w.menus.length ? pick(r, w.menus) : { id: 'ghost', sections: [] }
      return { op: 'reorder', kind: 'section', parentId: menu.id, ids: shuffle(r, menu.sections.map(s => s.id)).slice(0, 1 + int(r, 5)) }
    }
    default: return { op: 'manualOrder', value: r() < 0.5 }
  }
}
function shuffle<T>(r: R, list: T[]) { for (let i = list.length - 1; i > 0; i--) { const j = int(r, i + 1); [list[i], list[j]] = [list[j]!, list[i]!] } return list }

function checkInvariants(w: WsDocument) {
  const ids = allIds(w)
  expect(new Set(ids).size).toBe(ids.length) // id unici
  for (const m of w.menus) for (const s of m.sections) if (s.parentSectionId) {
    const p = m.sections.find(x => x.id === s.parentSectionId)
    expect(p, `genitore di ${s.id} nello stesso Menu`).toBeDefined()
    expect(p!.parentSectionId ?? null).toBeNull() // profondità ≤ 2
  }
}
/** Piatti attesi dopo un'op riuscita: rimossi solo da remove (anche a cascata), aggiunti solo da create. */
function expectedItems(before: WsDocument, after: WsDocument, op: Op, ok: boolean): string[] {
  const prev = itemIdsOf(before)
  if (!ok) return prev
  if (op.op === 'remove') {
    if (op.kind === 'item') return prev.filter(i => i !== op.id)
    const gone = new Set<string>()
    for (const m of before.menus) {
      if (op.kind === 'menu' && m.id === op.id) m.sections.forEach(s => s.items.forEach(i => gone.add(i.id)))
      if (op.kind === 'section') m.sections.filter(s => s.id === op.id || s.parentSectionId === op.id).forEach(s => s.items.forEach(i => gone.add(i.id)))
    }
    return prev.filter(i => !gone.has(i))
  }
  if (op.op === 'create' && op.kind === 'item' && !prev.includes(op.id)) return [...prev, op.id]
  return prev
}
const sorted = (a: string[]) => [...a].sort()

describe('property: sequenze casuali', () => {
  it('2500 sequenze: invarianti, nessun piatto perso/duplicato, input non mutato', () => {
    const r = prng(SEED)
    let applied = 0, rejected = 0
    for (let seq = 0; seq < 2500; seq++) {
      let w = randomDoc(r)
      for (let k = 0, len = 1 + int(r, 12); k < len; k++) {
        const op = randomOp(r, w)
        const snapshot = JSON.stringify(w)
        const { workspace, results } = applyOps(w, [op])
        expect(JSON.stringify(w)).toBe(snapshot)
        checkInvariants(workspace)
        expect(sorted(itemIdsOf(workspace))).toEqual(sorted(expectedItems(w, workspace, op, results[0]!.ok)))
        if (results[0]!.ok) applied++; else { rejected++; expect(workspace).toEqual(w) } // op rifiutata = documento invariato
        w = workspace
      }
    }
    expect(applied).toBeGreaterThan(5000); expect(rejected).toBeGreaterThan(500)
  })

  it('idempotenza: la stessa op ripetuta (set/create/move/reorder/remove/manualOrder) non cambia altro', () => {
    const r = prng(SEED + 1)
    for (let seq = 0; seq < 2000; seq++) {
      const w = randomDoc(r)
      const op = randomOp(r, w)
      const once = applyOps(w, [op]).workspace
      expect(applyOps(once, [op]).workspace, JSON.stringify(op)).toEqual(once)
      expect(applyOps(w, [op, op]).workspace).toEqual(once)
    }
  })

  it('move con ancora mancante = in fondo alla lista di arrivo', () => {
    const r = prng(SEED + 2)
    for (let seq = 0; seq < 2000; seq++) {
      const w = randomDoc(r)
      const items = itemIdsOf(w)
      if (!items.length) continue
      const id = pick(r, items), to = pick(r, w.menus.flatMap(m => m.sections)).id
      const out = applyOps(w, [{ op: 'move', kind: 'item', id, toParentId: to, at: pick(r, [{ beforeId: 'ghost' }, { afterId: 'ghost' }, undefined]) }]).workspace
      const target = out.menus.flatMap(m => m.sections).find(s => s.id === to)!
      expect(target.items[target.items.length - 1]!.id).toBe(id)
      const menu = pick(r, w.menus)
      const ms = applyOps(w, [{ op: 'move', kind: 'menu', id: menu.id, at: { afterId: 'ghost' } }]).workspace
      expect(ms.menus[ms.menus.length - 1]!.id).toBe(menu.id)
    }
  })

  it('commutatività di set su elementi diversi', () => {
    const r = prng(SEED + 3)
    for (let seq = 0; seq < 2000; seq++) {
      const w = randomDoc(r)
      const a = randomOp(r, w), b = randomOp(r, w)
      if (a.op !== 'set' || b.op !== 'set' || a.id === b.id) continue
      expect(applyOps(w, [a, b]).workspace).toEqual(applyOps(w, [b, a]).workspace)
    }
    // anche con set forzati
    for (let seq = 0; seq < 2000; seq++) {
      const w = randomDoc(r)
      const items = itemIdsOf(w); if (items.length < 2) continue
      const [x, y] = shuffle(r, items.slice())
      const a: Op = { op: 'set', kind: 'item', id: x!, fields: { price: int(r, 50), hidden: r() < 0.5 } }
      const b: Op = { op: 'set', kind: 'item', id: y!, fields: { price: int(r, 50), name: 'Z' } }
      expect(applyOps(w, [a, b]).workspace).toEqual(applyOps(w, [b, a]).workspace)
    }
  })
})
