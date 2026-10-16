import {randomUUID} from 'node:crypto'
import {describe,it,expect} from 'vitest'
import {validateTranslationSnapshot,collectTasks,translationCacheKey,normalizeTranslations,preserveNeutralFields} from '../scripts/menusmart-migration/translate.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
const fixture=()=>({restaurants:[{workspace:workspaceSchema.parse({languages:['it','en','ja'],menus:[{id:randomUUID(),name:'Menu',sections:[{id:randomUUID(),name:'Primi',items:[{id:randomUUID(),name:'Risotto',description:'Riso con pomodoro',price:12,translations:{en:{name:'Hand edited risotto',approved:true}}}]}]}]})}]})
describe('MenuSmart resumable missing translations',()=>{
 it('keeps pending task references attached after checkpoint validation',()=>{
  const data=fixture(),workspace=data.restaurants[0]!.workspace,{tasks}=collectTasks(data)
  validateTranslationSnapshot(data)
  expect(data.restaurants[0]!.workspace).toBe(workspace)
  const item=workspace.menus[0]!.sections[0]!.items[0]!,key=translationCacheKey('ja',{name:item.name,description:item.description!})
  for(const task of tasks.get(key)!)task.apply({name:'リゾット',description:'トマト入りの米料理'})
  validateTranslationSnapshot(data)
  expect(data.restaurants[0]!.workspace.menus[0]!.sections[0]!.items[0]!.translations.ja?.description).toBe('トマト入りの米料理')
 })
 it('preserves language-neutral price/allergen numbers without Italian fallback',()=>{expect(preserveNeutralFields({name:'Risotto',description:'(1,2) · 12,50 €'},{id:'0',name:'リゾット',description:''})).toEqual({id:'0',name:'リゾット',description:'(1,2) · 12,50 €'});expect(preserveNeutralFields({name:'Riso',description:'Riso 12 g'},{name:'Rice',description:'Rice 12 g'}).description).toBe('Rice 12 g')})
 it('normalizes nested wrapper arrays without fabricating or discarding rows',()=>{const rows=[{id:'0',name:'A'},{id:'1',name:'B'}];expect(normalizeTranslations([{translations:[rows[0]]},{translations:rows[1]}])).toEqual(rows);expect(normalizeTranslations({translations:[['0','A',''],['1','B','Description']]})).toEqual([{id:'0',name:'A',description:''},{id:'1',name:'B',description:'Description'}]);expect(()=>normalizeTranslations({foo:'A'})).toThrow()})
 it('fills missing description while preserving approved manual name, prices and source',()=>{
  const data=fixture(),item=data.restaurants[0]!.workspace.menus[0]!.sections[0]!.items[0]!,before=item.price
  const {tasks}=collectTasks(data),key=translationCacheKey('en',{name:item.name,description:item.description!})
  for(const t of tasks.get(key)!)t.apply({name:'Provider risotto',description:'Rice with tomato'})
  expect(item.translations.en).toMatchObject({name:'Hand edited risotto',description:'Rice with tomato',approved:false});expect(item.price).toBe(before);expect(item.description).toBe('Riso con pomodoro')
 })
 it('reuses cache and leaves uncovered language actually missing',()=>{
  const data=fixture(),item=data.restaurants[0]!.workspace.menus[0]!.sections[0]!.items[0]!,key=translationCacheKey('en',{name:item.name,description:item.description!})
  const {tasks}=collectTasks(data,{[key]:{name:'Risotto',description:'Rice with tomato'}})
  expect(tasks.has(key)).toBe(false);expect(item.translations.ja).toBeUndefined()
 })
 it('deduplicates equal entity texts across restaurants',()=>{
  const data=fixture();data.restaurants.push(structuredClone(data.restaurants[0]!));const {tasks}=collectTasks(data)
  const key=translationCacheKey('ja',{name:'Risotto',description:'Riso con pomodoro'})
  expect(tasks.get(key)).toHaveLength(2)
 })
})
