// Vettori condivisi input/ops/output (riusati dalla SPA: bundle globale eseguito in node:vm, tests/staff).
// Rigenerare SOLO dopo aver verificato a mano il cambiamento: MENU_OPS_WRITE_VECTORS=1 npx vitest run packages/menu-ops
import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyOps, dropToOps, manualOrderSnapshot, type Op, type ReorderDrop, type ManualOrderView } from '../src/index.js'
import { sample } from './fixtures.js'

type Case = { name: string; ops?: Op[]; drop?: ReorderDrop; snapshot?: ManualOrderView }
const cases: Case[] = [
  { name: 'set piatto + sezione + menu', ops: [{ op: 'set', kind: 'item', id: 'i1', fields: { price: 13, hidden: true } }, { op: 'set', kind: 'section', id: 's2a', fields: { name: 'Carne' } }, { op: 'set', kind: 'menu', id: 'm2', fields: { active: false } }] },
  { name: 'set campo vietato', ops: [{ op: 'set', kind: 'item', id: 'i1', fields: { translations: {} } }] },
  { name: 'create piatti con ancore', ops: [{ op: 'create', kind: 'item', id: 'n1', parentId: 's1', fields: { name: 'Cacio e pepe', price: 10 } }, { op: 'create', kind: 'item', id: 'n2', parentId: 's1', fields: { name: 'Pesto' }, at: { beforeId: 'i2' } }] },
  { name: 'create sottomenu e sezione figlia', ops: [{ op: 'create', kind: 'section', id: 'r9', parentId: 'm1', fields: { name: 'Contorni', active: false } }, { op: 'create', kind: 'section', id: 'c9', parentId: 'm1', fields: { name: 'Di verdure', parentSectionId: 's2' } }] },
  { name: 'create menu', ops: [{ op: 'create', kind: 'menu', id: 'm3', fields: { name: 'Bevande', active: false }, at: { beforeId: 'm2' } }] },
  { name: 'create ripetuto (idempotente) e EXISTS', ops: [{ op: 'create', kind: 'item', id: 'n1', parentId: 's1', fields: { name: 'X' } }, { op: 'create', kind: 'item', id: 'n1', parentId: 's1', fields: { name: 'X' } }, { op: 'create', kind: 'item', id: 'n1', parentId: 's1', fields: { name: 'Y' } }] },
  { name: 'create figlia di figlia', ops: [{ op: 'create', kind: 'section', id: 'z', parentId: 'm1', fields: { name: 'Z', parentSectionId: 's2a' } }] },
  { name: 'move piatto in altro Menu', ops: [{ op: 'move', kind: 'item', id: 'i1', toParentId: 't1', at: { beforeId: 'j1' } }] },
  { name: 'move ancora mancante = in fondo', ops: [{ op: 'move', kind: 'item', id: 'i1', at: { beforeId: 'ghost' } }] },
  { name: 'move sottomenu con figlie', ops: [{ op: 'move', kind: 'section', id: 's2', at: { beforeId: 's1' } }] },
  { name: 'move sezione in altro sottomenu', ops: [{ op: 'move', kind: 'section', id: 's2a', toParentId: 's1' }] },
  { name: 'move sottomenu con figlie sotto altro (HIERARCHY)', ops: [{ op: 'move', kind: 'section', id: 's2', toParentId: 's1' }] },
  { name: 'remove sottomenu a cascata + NOT_FOUND', ops: [{ op: 'remove', kind: 'section', id: 's2' }, { op: 'remove', kind: 'section', id: 's2a' }] },
  { name: 'reorder tollerante', ops: [{ op: 'reorder', kind: 'section', parentId: 'm1', ids: ['s3', 'x', 's1'] }, { op: 'reorder', kind: 'menu', ids: ['m2'] }] },
  { name: 'manualOrder', ops: [{ op: 'manualOrder', value: true }] },
  { name: 'drop piatto', drop: { id: 'i1', kind: 'dish', fromGroup: 'items:s1', toGroup: 'items:s1', toIndex: 1 } },
  { name: 'drop piatto in sezione vuota', drop: { id: 'i1', kind: 'dish', fromGroup: 'items:s1', toGroup: 'items:s2b', toIndex: 0 } },
  { name: 'drop sezione', drop: { id: 's2b', kind: 'section', fromGroup: 'children:s2', toGroup: 'children:s2', toIndex: 0 } },
  { name: 'drop sottomenu', drop: { id: 's2', kind: 'submenu', fromGroup: 'pills:m1', toGroup: 'pills:m1', toIndex: 2 } },
  { name: 'drop menu', drop: { id: 'm2', kind: 'menu', fromGroup: 'menus', toGroup: 'menus', toIndex: 0 } },
  { name: 'snapshot ordine manuale', snapshot: { menuOrder: ['m2', 'm1'], sectionOrder: { m1: ['s3', 's2b', 's1'] } } },
]

const URL_VECTORS = new URL('./vectors.json', import.meta.url)
function compute() {
  return cases.map(c => {
    const input = sample()
    const ops = c.ops ?? (c.drop ? dropToOps(input, c.drop) : manualOrderSnapshot(input, c.snapshot!))
    const { workspace, results } = applyOps(input, ops)
    return { name: c.name, ...(c.drop ? { drop: c.drop } : {}), ...(c.snapshot ? { snapshot: c.snapshot } : {}), input, ops, output: workspace, results }
  })
}

describe('vectors.json', () => {
  it('applyOps/dropToOps/manualOrderSnapshot riproducono i vettori', () => {
    const vectors = compute()
    if (process.env.MENU_OPS_WRITE_VECTORS === '1') writeFileSync(URL_VECTORS, JSON.stringify({ version: 1, vectors }, null, 1) + '\n')
    const saved = JSON.parse(readFileSync(URL_VECTORS, 'utf8')) as { version: number; vectors: unknown[] }
    expect(saved.vectors).toEqual(JSON.parse(JSON.stringify(vectors)))
    // e ogni vettore salvato si riapplica dal suo input
    for (const v of saved.vectors as Array<{ input: never; ops: Op[]; output: unknown; results: unknown }>) {
      const r = applyOps(v.input, v.ops)
      expect(JSON.parse(JSON.stringify(r.workspace))).toEqual(v.output); expect(r.results).toEqual(v.results)
    }
  })
})
