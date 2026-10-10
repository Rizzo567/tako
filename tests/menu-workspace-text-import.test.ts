import { describe,it,expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { workspaceSchema } from '../apps/server/src/lib/menu-workspace-contract.js'
import { importWorkspaceText } from '../apps/server/src/lib/menu-workspace-text-import.js'
const baseline=()=>workspaceSchema.parse({menus:[{id:randomUUID(),name:'Cena',sections:[{id:randomUUID(),name:'Primi',items:[{id:randomUUID(),name:'Ravioli',price:12}]}]}]})
describe('Plain text menu import preview',()=>{
 it('appends explicit prices and one-line descriptions preserving all original IDs and data',()=>{
  const w=baseline(),original=structuredClone(w),menu=w.menus[0]!
  const out=importWorkspaceText(w,'# Primi\r\nRavioli — 12,50 €\r\nRicotta e spinaci\r\n\r\nDessert\r\nTiramisù - 6.00 €',menu.id)
  expect(w).toEqual(original);expect(out.importedCount).toBe(2);expect(out.workspace.menus).toHaveLength(1)
  expect(out.workspace.menus[0]!.sections[0]!.id).toBe(menu.sections[0]!.id)
  expect(out.workspace.menus[0]!.sections[0]!.items[0]).toEqual(menu.sections[0]!.items[0])
  expect(out.workspace.menus[0]!.sections[0]!.items[1]).toMatchObject({name:'Ravioli',price:12.5,description:'Ricotta e spinaci',allergens:[]})
  expect(out.warnings.some(w=>w.includes('duplicato'))).toBe(true)
  expect(out.workspace.menus[0]!.sections[1]!.items[0]!.price).toBe(6)
 })
 it('warns on ambiguous sections, malformed prices and unattached items without inventing data',()=>{
  const out=importWorkspaceText(baseline(),'Orfano — 4 €\n# Antipasti\nPane — 0 €\nDichiarazione\nAltro testo\nSbagliato — -4 €\nSbagliato — 1,234 €\n# Dolci\nGelato – 3 €')
  expect(out.importedCount).toBe(2);expect(out.warnings.some(w=>w.includes('senza sezione'))).toBe(true)
  expect(out.warnings.filter(w=>w.includes('non importato'))).toHaveLength(3)
  expect(out.workspace.menus.at(-1)!.sections[0]!.items[0]!.price).toBe(0)
 })
 it('flags a description followed immediately by another dish for human review',()=>{
  const out=importWorkspaceText(baseline(),'# Primi\nPasta — 10 €\nSecondi\nPollo — 15 €')
  expect(out.workspace.menus.at(-1)!.sections).toHaveLength(1)
  expect(out.warnings.some(w=>w.includes('Se è una sezione'))).toBe(true)
 })
 it('rejects empty imports, foreign target and bounded input',()=>{
  const w=baseline();expect(()=>importWorkspaceText(w,'# Menu\nPiatto senza prezzo')).toThrow('Nessun piatto')
  expect(()=>importWorkspaceText(w,'# Menu\nPiatto — 12 €',randomUUID())).toThrow('Menu non trovato')
  expect(()=>importWorkspaceText(w,'x'.repeat(2*1024*1024+1))).toThrow('2 MB')
  expect(()=>importWorkspaceText(w,'\n'.repeat(10001))).toThrow('10000')
 })
 it('accepts explicit trailing currency with attached euro while rejecting naked trailing prices',()=>{
  const out=importWorkspaceText(baseline(),'# Antipasti\nBruschetta 6,00 €\nOlive 4,50€\nSenza valuta 8\nPrezzo ambiguo 2,999€')
  const items=out.workspace.menus.at(-1)!.sections[0]!.items
  expect(items.map(i=>[i.name,i.price])).toEqual([['Bruschetta',6],['Olive',4.5]])
  expect(out.warnings.filter(w=>w.includes('non importato'))).toHaveLength(2)
  expect(items[1]!.description).toBeNull()
 })
 it('preserves multiline descriptions until explicit headings, new prices or blank blocks',()=>{
  const out=importWorkspaceText(baseline(),'# Primi\nRavioli 12€\nRicotta e spinaci\nPreparati ogni giorno\nPasta — 10 €\nPomodoro fresco\n\nDolci\nGelato 3€\nTre gusti\n# Bevande\nAcqua 2€')
  const sections=out.workspace.menus.at(-1)!.sections
  expect(out.importedCount).toBe(4)
  expect(sections[0]!.items[0]!.description).toBe('Ricotta e spinaci\nPreparati ogni giorno')
  expect(sections[0]!.items[1]!.description).toBe('Pomodoro fresco')
  expect(sections.map(s=>s.name)).toEqual(['Primi','Dolci','Bevande'])
  expect(sections[1]!.items[0]!.description).toBe('Tre gusti')
 })
})
