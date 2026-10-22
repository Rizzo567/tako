import { describe, expect, it } from 'vitest'
import { applyOps, dropToOps, manualOrderSnapshot, FIELD_WHITELIST, type Op } from '../src/index.js'
import { sample, sectionIds, itemIds } from './fixtures.js'

const run = (ops: Op[]) => { const w = sample(); const before = JSON.stringify(w); const r = applyOps(w, ops); expect(JSON.stringify(w)).toBe(before); return r }

describe('set', () => {
  it('modifica i campi in whitelist di Piatto, Sezione, Menu', () => {
    const { workspace: w, results } = run([
      { op: 'set', kind: 'item', id: 'i1', fields: { price: 13, hidden: true } },
      { op: 'set', kind: 'section', id: 's2a', fields: { name: 'Carne' } },
      { op: 'set', kind: 'menu', id: 'm2', fields: { active: false, pricing: 'fisso' } },
    ])
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }])
    const i1 = w.menus[0]!.sections[0]!.items[0]!
    expect(i1.price).toBe(13); expect(i1.hidden).toBe(true)
    expect(i1.translations).toEqual({ en: { name: 'Carbonara' } }) // traduzioni intatte
    expect(w.menus[0]!.sections[2]!.name).toBe('Carne')
    expect(w.menus[1]!.active).toBe(false); expect(w.menus[1]!.pricing).toBe('fisso')
  })
  it('FIELD per campi fuori whitelist (id, translations, parentSectionId, items) e nessuna modifica parziale', () => {
    for (const fields of [{ id: 'x' }, { translations: {} }, { parentSectionId: null }, { items: [] }, { name: 'ok', sections: [] }]) {
      const { workspace: w, results } = run([{ op: 'set', kind: 'section', id: 's1', fields }])
      expect(results[0]).toMatchObject({ ok: false, code: 'FIELD' })
      expect(w).toEqual(sample())
    }
  })
  it('NOT_FOUND se id assente o di altro livello', () => {
    expect(run([{ op: 'set', kind: 'item', id: 'zzz', fields: { price: 1 } }]).results[0]).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(run([{ op: 'set', kind: 'item', id: 's1', fields: { price: 1 } }]).results[0]).toMatchObject({ ok: false, code: 'NOT_FOUND' })
  })
  it('whitelist: ogni campo dichiarato è accettato', () => {
    for (const kind of ['menu', 'section', 'item'] as const) {
      const id = kind === 'menu' ? 'm1' : kind === 'section' ? 's1' : 'i1'
      for (const f of FIELD_WHITELIST[kind]) expect(run([{ op: 'set', kind, id, fields: { [f]: null } }]).results[0]).toEqual({ ok: true })
    }
  })
})

describe('create', () => {
  it('Piatto in fondo, prima/dopo un fratello, con i default dello schema', () => {
    const { workspace: w, results } = run([
      { op: 'create', kind: 'item', id: 'n1', parentId: 's1', fields: { name: 'Cacio e pepe', price: 10 } },
      { op: 'create', kind: 'item', id: 'n2', parentId: 's1', fields: { name: 'Pesto' }, at: { beforeId: 'i2' } },
      { op: 'create', kind: 'item', id: 'n3', parentId: 's1', fields: { name: 'Ragù' }, at: { afterId: 'i1' } },
    ])
    expect(results.every(r => r.ok)).toBe(true)
    expect(itemIds(w, 's1')).toEqual(['i1', 'n3', 'n2', 'i2', 'i3', 'n1'])
    expect(w.menus[0]!.sections[0]!.items[5]).toMatchObject({ id: 'n1', price: 10, available: true, hidden: false, translations: {}, variants: [], displayMode: 'normal' })
  })
  it('Sottomenu e Sezione figlia: in fondo al loro gruppo', () => {
    const { workspace: w, results } = run([
      { op: 'create', kind: 'section', id: 'r9', parentId: 'm1', fields: { name: 'Contorni', active: false } },
      { op: 'create', kind: 'section', id: 'c9', parentId: 'm1', fields: { name: 'Di verdure', parentSectionId: 's2' } },
      { op: 'create', kind: 'section', id: 'r8', parentId: 'm1', fields: { name: 'Antipasti' }, at: { beforeId: 's1' } },
      { op: 'create', kind: 'section', id: 'r7', parentId: 'm1', fields: { name: 'Pizze' }, at: { afterId: 's2' } },
    ])
    expect(results.every(r => r.ok)).toBe(true)
    expect(sectionIds(w, 'm1')).toEqual(['r8', 's1', 's2', 's2a', 's2b', 'c9', 'r7', 's3', 'r9'])
    expect(w.menus[0]!.sections.find(s => s.id === 'c9')!.parentSectionId).toBe('s2')
    expect(w.menus[0]!.sections.find(s => s.id === 'r9')).toMatchObject({ parentSectionId: null, active: false, items: [] })
  })
  it('Menu nuovo', () => {
    const { workspace: w } = run([{ op: 'create', kind: 'menu', id: 'm3', fields: { name: 'Bevande', active: false }, at: { beforeId: 'm2' } }])
    expect(w.menus.map(m => m.id)).toEqual(['m1', 'm3', 'm2'])
    expect(w.menus[1]).toMatchObject({ sections: [], type: 'main', active: false })
  })
  it('EXISTS: stesso id con campi diversi; riuscita se coincidono (idempotente)', () => {
    const op: Op = { op: 'create', kind: 'item', id: 'n1', parentId: 's1', fields: { name: 'X', price: 3 } }
    const once = applyOps(sample(), [op]).workspace
    const twice = applyOps(once, [op])
    expect(twice.results[0]).toEqual({ ok: true }); expect(twice.workspace).toEqual(once)
    expect(applyOps(once, [{ ...op, fields: { name: 'Y' } }]).results[0]).toMatchObject({ ok: false, code: 'EXISTS' })
    expect(run([{ op: 'create', kind: 'section', id: 'i1', parentId: 'm1', fields: { name: 'X' } }]).results[0]).toMatchObject({ ok: false, code: 'EXISTS' })
  })
  it('HIERARCHY: figlia di una figlia; NOT_FOUND: genitore mancante; FIELD: senza nome o campo non ammesso', () => {
    expect(run([{ op: 'create', kind: 'section', id: 'z', parentId: 'm1', fields: { name: 'Z', parentSectionId: 's2a' } }]).results[0]).toMatchObject({ code: 'HIERARCHY' })
    expect(run([{ op: 'create', kind: 'section', id: 'z', parentId: 'm1', fields: { name: 'Z', parentSectionId: 't1' } }]).results[0]).toMatchObject({ code: 'HIERARCHY' })
    expect(run([{ op: 'create', kind: 'section', id: 'z', parentId: 'm1', fields: { name: 'Z', parentSectionId: 'nope' } }]).results[0]).toMatchObject({ code: 'NOT_FOUND' })
    expect(run([{ op: 'create', kind: 'item', id: 'z', parentId: 'nope', fields: { name: 'Z' } }]).results[0]).toMatchObject({ code: 'NOT_FOUND' })
    expect(run([{ op: 'create', kind: 'section', id: 'z', fields: { name: 'Z' } }]).results[0]).toMatchObject({ code: 'NOT_FOUND' })
    expect(run([{ op: 'create', kind: 'item', id: 'z', parentId: 's1', fields: { price: 3 } }]).results[0]).toMatchObject({ code: 'FIELD' })
    expect(run([{ op: 'create', kind: 'item', id: 'z', parentId: 's1', fields: { name: 'Z', translations: {} } }]).results[0]).toMatchObject({ code: 'FIELD' })
    expect(run([{ op: 'create', kind: 'item', id: 'z', parentId: 's1', fields: { name: 'Z', parentSectionId: 's1' } }]).results[0]).toMatchObject({ code: 'FIELD' })
  })
})

describe('move', () => {
  it('Piatto su/giù e in un\'altra Sezione di un altro Menu', () => {
    const { workspace: w, results } = run([
      { op: 'move', kind: 'item', id: 'i3', at: { beforeId: 'i1' } },
      { op: 'move', kind: 'item', id: 'i1', toParentId: 't1', at: { beforeId: 'j1' } },
      { op: 'move', kind: 'item', id: 'i2', toParentId: 's2b' },
    ])
    expect(results.every(r => r.ok)).toBe(true)
    expect(itemIds(w, 's1')).toEqual(['i3'])
    expect(itemIds(w, 't1')).toEqual(['i1', 'j1'])
    expect(itemIds(w, 's2b')).toEqual(['i2'])
  })
  it('ancora mancante = in fondo', () => {
    expect(itemIds(run([{ op: 'move', kind: 'item', id: 'i1', at: { beforeId: 'ghost' } }]).workspace, 's1')).toEqual(['i2', 'i3', 'i1'])
    expect(sectionIds(run([{ op: 'move', kind: 'section', id: 's1', at: { afterId: 'ghost' } }]).workspace, 'm1')).toEqual(['s2', 's2a', 's2b', 's3', 's1'])
    expect(run([{ op: 'move', kind: 'menu', id: 'm1', at: { beforeId: 'ghost' } }]).workspace.menus.map(m => m.id)).toEqual(['m2', 'm1'])
  })
  it('Sottomenu porta con sé le sue Sezioni figlie', () => {
    expect(sectionIds(run([{ op: 'move', kind: 'section', id: 's2', at: { beforeId: 's1' } }]).workspace, 'm1')).toEqual(['s2', 's2a', 's2b', 's1', 's3'])
    expect(sectionIds(run([{ op: 'move', kind: 'section', id: 's1', at: { afterId: 's2' } }]).workspace, 'm1')).toEqual(['s2', 's2a', 's2b', 's1', 's3'])
    // ancora = figlia di un altro Sottomenu → si usa il blocco di quel Sottomenu
    expect(sectionIds(run([{ op: 'move', kind: 'section', id: 's3', at: { beforeId: 's2b' } }]).workspace, 'm1')).toEqual(['s1', 's3', 's2', 's2a', 's2b'])
  })
  it('Sezione figlia: riordino fra figlie, cambio di Sottomenu, diventa Sottomenu', () => {
    expect(sectionIds(run([{ op: 'move', kind: 'section', id: 's2b', at: { beforeId: 's2a' } }]).workspace, 'm1')).toEqual(['s1', 's2', 's2b', 's2a', 's3'])
    const moved = run([{ op: 'move', kind: 'section', id: 's2a', toParentId: 's1' }]).workspace
    expect(sectionIds(moved, 'm1')).toEqual(['s1', 's2a', 's2', 's2b', 's3'])
    expect(moved.menus[0]!.sections[1]!.parentSectionId).toBe('s1')
    const root = run([{ op: 'move', kind: 'section', id: 's2a', toParentId: null, at: { afterId: 's3' } }]).workspace
    expect(sectionIds(root, 'm1')).toEqual(['s1', 's2', 's2b', 's3', 's2a'])
    expect(root.menus[0]!.sections[4]!.parentSectionId).toBeNull()
    // Sottomenu senza figlie diventa Sezione
    const child = run([{ op: 'move', kind: 'section', id: 's3', toParentId: 's1', at: { beforeId: 'zzz' } }]).workspace
    expect(sectionIds(child, 'm1')).toEqual(['s1', 's3', 's2', 's2a', 's2b'])
  })
  it('HIERARCHY: Sottomenu con figlie sotto un altro, figlia sotto figlia, altro Menu, se stessa, Piatto senza Sezione', () => {
    expect(run([{ op: 'move', kind: 'section', id: 's2', toParentId: 's1' }]).results[0]).toMatchObject({ code: 'HIERARCHY' })
    expect(run([{ op: 'move', kind: 'section', id: 's1', toParentId: 's2a' }]).results[0]).toMatchObject({ code: 'HIERARCHY' })
    expect(run([{ op: 'move', kind: 'section', id: 's3', toParentId: 't1' }]).results[0]).toMatchObject({ code: 'HIERARCHY' })
    expect(run([{ op: 'move', kind: 'section', id: 's3', toParentId: 's3' }]).results[0]).toMatchObject({ code: 'HIERARCHY' })
    expect(run([{ op: 'move', kind: 'item', id: 'i1', toParentId: null }]).results[0]).toMatchObject({ code: 'HIERARCHY' })
    expect(run([{ op: 'move', kind: 'item', id: 'i1', toParentId: 'm1' }]).results[0]).toMatchObject({ code: 'HIERARCHY' })
    expect(run([{ op: 'move', kind: 'menu', id: 'm1', toParentId: 'm2' }]).results[0]).toMatchObject({ code: 'HIERARCHY' })
  })
  it('NOT_FOUND: elemento o genitore inesistente', () => {
    expect(run([{ op: 'move', kind: 'item', id: 'nope' }]).results[0]).toMatchObject({ code: 'NOT_FOUND' })
    expect(run([{ op: 'move', kind: 'item', id: 'i1', toParentId: 'nope' }]).results[0]).toMatchObject({ code: 'NOT_FOUND' })
    expect(run([{ op: 'move', kind: 'section', id: 's3', toParentId: 'nope' }]).results[0]).toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('remove', () => {
  it('Piatto, Menu, Sottomenu con le sue figlie', () => {
    const { workspace: w, results } = run([
      { op: 'remove', kind: 'item', id: 'i2' },
      { op: 'remove', kind: 'section', id: 's2' },
      { op: 'remove', kind: 'menu', id: 'm2' },
    ])
    expect(results.every(r => r.ok)).toBe(true)
    expect(itemIds(w, 's1')).toEqual(['i1', 'i3'])
    expect(sectionIds(w, 'm1')).toEqual(['s1', 's3'])
    expect(w.menus.map(m => m.id)).toEqual(['m1'])
  })
  it('NOT_FOUND la seconda volta, documento invariato', () => {
    const once = applyOps(sample(), [{ op: 'remove', kind: 'item', id: 'i2' }]).workspace
    const again = applyOps(once, [{ op: 'remove', kind: 'item', id: 'i2' }])
    expect(again.results[0]).toMatchObject({ ok: false, code: 'NOT_FOUND' }); expect(again.workspace).toEqual(once)
  })
})

describe('reorder e manualOrder', () => {
  it('reorder tollerante dei Menu e delle sezioni', () => {
    expect(run([{ op: 'reorder', kind: 'menu', ids: ['ghost', 'm2', 'm2'] }]).workspace.menus.map(m => m.id)).toEqual(['m2', 'm1'])
    expect(sectionIds(run([{ op: 'reorder', kind: 'section', parentId: 'm1', ids: ['s3', 'x', 's1'] }]).workspace, 'm1')).toEqual(['s3', 's1', 's2', 's2a', 's2b'])
    expect(run([{ op: 'reorder', kind: 'section', parentId: 'nope', ids: [] }]).results[0]).toMatchObject({ code: 'NOT_FOUND' })
    expect(run([{ op: 'reorder', kind: 'section', parentId: 'm1', ids: 'x' as unknown as string[] }]).results[0]).toMatchObject({ code: 'FIELD' })
  })
  it('manualOrder scrive design.manualOrder; senza op il campo non compare', () => {
    expect(run([]).workspace.design).toEqual({ primary: '#ed725b' })
    expect(run([{ op: 'manualOrder', value: true }]).workspace.design).toEqual({ primary: '#ed725b', manualOrder: true })
    expect(run([{ op: 'manualOrder', value: 'si' as unknown as boolean }]).results[0]).toMatchObject({ code: 'FIELD' })
  })
  it('op malformate → FIELD', () => {
    expect(run([{ op: 'set', kind: 'dish', id: 'i1', fields: {} } as unknown as Op]).results[0]).toMatchObject({ code: 'FIELD' })
    expect(run([{ op: 'boom', kind: 'item', id: 'i1' } as unknown as Op]).results[0]).toMatchObject({ code: 'FIELD' })
    expect(run([null as unknown as Op]).results[0]).toMatchObject({ code: 'FIELD' })
    expect(run([{ op: 'set', kind: 'item', id: 'i1', fields: 'x' } as unknown as Op]).results[0]).toMatchObject({ code: 'FIELD' })
  })
  it("un'op rifiutata non ferma le altre", () => {
    const { workspace: w, results } = run([{ op: 'set', kind: 'item', id: 'nope', fields: { price: 1 } }, { op: 'set', kind: 'item', id: 'i1', fields: { price: 1 } }])
    expect(results.map(r => r.ok)).toEqual([false, true]); expect(w.menus[0]!.sections[0]!.items[0]!.price).toBe(1)
  })
})

describe('dropToOps', () => {
  it('dish: indice nel gruppo di arrivo senza il trascinato', () => {
    const w = sample()
    expect(dropToOps(w, { id: 'i1', kind: 'dish', fromGroup: 'items:s1', toGroup: 'items:s1', toIndex: 1 })).toEqual([{ op: 'move', kind: 'item', id: 'i1', toParentId: 's1', at: { beforeId: 'i3' } }])
    expect(dropToOps(w, { id: 'i1', kind: 'dish', fromGroup: 'items:s1', toGroup: 'items:s1', toIndex: 2 })).toEqual([{ op: 'move', kind: 'item', id: 'i1', toParentId: 's1', at: { afterId: 'i3' } }])
    expect(dropToOps(w, { id: 'i1', kind: 'dish', fromGroup: 'items:s1', toGroup: 'items:s2b', toIndex: 0 })).toEqual([{ op: 'move', kind: 'item', id: 'i1', toParentId: 's2b', at: undefined }])
    const after = applyOps(w, dropToOps(w, { id: 'i1', kind: 'dish', fromGroup: 'items:s1', toGroup: 'items:s1', toIndex: 1 })).workspace
    expect(itemIds(after, 's1')).toEqual(['i2', 'i1', 'i3'])
  })
  it('section: figlia fra figlie di un Sottomenu', () => {
    const w = sample()
    const ops = dropToOps(w, { id: 's2b', kind: 'section', fromGroup: 'children:s2', toGroup: 'children:s2', toIndex: 0 })
    expect(ops).toEqual([{ op: 'move', kind: 'section', id: 's2b', toParentId: 's2', at: { beforeId: 's2a' } }])
    expect(sectionIds(applyOps(w, ops).workspace, 'm1')).toEqual(['s1', 's2', 's2b', 's2a', 's3'])
  })
  it('submenu: reorder delle radici, ciascuna seguita dalle figlie', () => {
    const w = sample()
    const ops = dropToOps(w, { id: 's2', kind: 'submenu', fromGroup: 'pills:m1', toGroup: 'pills:m1', toIndex: 2 })
    expect(ops).toEqual([{ op: 'reorder', kind: 'section', parentId: 'm1', ids: ['s1', 's3', 's2', 's2a', 's2b'] }])
  })
  it('menu: reorder dei Menu', () => {
    expect(dropToOps(sample(), { id: 'm2', kind: 'menu', fromGroup: 'menus', toGroup: 'menus', toIndex: 0 })).toEqual([{ op: 'reorder', kind: 'menu', ids: ['m2', 'm1'] }])
  })
  it('rilasci non validi → []', () => {
    const w = sample()
    expect(dropToOps(w, { id: 'i1', kind: 'dish', fromGroup: 'items:s1', toGroup: 'children:s2', toIndex: 0 })).toEqual([])
    expect(dropToOps(w, { id: 'ghost', kind: 'dish', fromGroup: 'items:s1', toGroup: 'items:s1', toIndex: 0 })).toEqual([])
    expect(dropToOps(w, { id: 's2a', kind: 'submenu', fromGroup: 'pills:m1', toGroup: 'pills:m1', toIndex: 0 })).toEqual([])
    expect(dropToOps(w, { id: 'm1', kind: 'menu', fromGroup: 'menus', toGroup: 'pills:m1', toIndex: 0 })).toEqual([])
    expect(dropToOps(w, { id: 's1', kind: 'section', fromGroup: 'children:s2', toGroup: 'children:nope', toIndex: 0 })).toEqual([])
  })
})

describe('manualOrderSnapshot', () => {
  it('fotografa Menu e Sottomenu, figlie dopo la radice, poi manualOrder:true', () => {
    const w = sample()
    const ops = manualOrderSnapshot(w, { menuOrder: ['m2', 'm1'], sectionOrder: { m1: ['s3', 's2b', 's1'] } })
    expect(ops).toEqual([
      { op: 'reorder', kind: 'menu', ids: ['m2', 'm1'] },
      { op: 'reorder', kind: 'section', parentId: 'm1', ids: ['s3', 's2', 's2b', 's2a', 's1'] },
      { op: 'manualOrder', value: true },
    ])
    const out = applyOps(w, ops)
    expect(out.results.every(r => r.ok)).toBe(true)
    expect(out.workspace.design!.manualOrder).toBe(true)
    expect(sectionIds(out.workspace, 'm1')).toEqual(['s3', 's2', 's2b', 's2a', 's1'])
  })
  it('vista vuota → solo manualOrder', () => {
    expect(manualOrderSnapshot(sample(), { menuOrder: [], sectionOrder: {} })).toEqual([{ op: 'manualOrder', value: true }])
  })
})
