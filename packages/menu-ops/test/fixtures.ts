import type { WsDocument } from '../src/index.js'

/** Documento di prova: due Menu; nel primo un Sottomenu con due Sezioni figlie. */
export function sample(): WsDocument {
  return {
    schemaVersion: 1,
    menus: [
      {
        id: 'm1', name: 'Pranzo', active: true, translations: {}, sections: [
          { id: 's1', parentSectionId: null, name: 'Primi', active: true, translations: {}, items: [
            { id: 'i1', name: 'Carbonara', price: 12, translations: { en: { name: 'Carbonara' } } },
            { id: 'i2', name: 'Amatriciana', price: 11, translations: {} },
            { id: 'i3', name: 'Gricia', price: 10, translations: {} },
          ] },
          { id: 's2', parentSectionId: null, name: 'Secondi', active: true, translations: {}, items: [
            { id: 'i4', name: 'Saltimbocca', price: 15, translations: {} },
          ] },
          { id: 's2a', parentSectionId: 's2', name: 'Di carne', active: true, translations: {}, items: [
            { id: 'i5', name: 'Tagliata', price: 18, translations: {} },
          ] },
          { id: 's2b', parentSectionId: 's2', name: 'Di pesce', active: true, translations: {}, items: [] },
          { id: 's3', parentSectionId: null, name: 'Dolci', active: true, translations: {}, items: [] },
        ],
      },
      {
        id: 'm2', name: 'Cena', active: true, translations: {}, sections: [
          { id: 't1', parentSectionId: null, name: 'Antipasti', active: true, translations: {}, items: [
            { id: 'j1', name: 'Bruschetta', price: 5, translations: {} },
          ] },
        ],
      },
    ],
    design: { primary: '#ed725b' },
  }
}

export const sectionIds = (w: WsDocument, menuId: string) => w.menus.find(m => m.id === menuId)!.sections.map(s => s.id)
export const itemIds = (w: WsDocument, sectionId: string) => w.menus.flatMap(m => m.sections).find(s => s.id === sectionId)!.items.map(i => i.id)
