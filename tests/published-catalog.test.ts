import {it,expect,vi,beforeEach} from 'vitest'
import {randomUUID} from 'node:crypto'
const state=vi.hoisted(()=>({rows:[] as any[],calls:0}))
vi.mock('../packages/db/src/index.ts',()=>({menuItems:{restaurantId:'restaurant',available:'available',id:'id'},db:{execute:async()=>{state.calls++;return state.rows}}}))
vi.mock('../apps/server/src/lib/menu-workspace-store.js',()=>({readWorkspace:async()=>null}))
import {readPublishedCatalog,publicMenuProjection} from '../apps/server/src/lib/published-menu.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
beforeEach(()=>{state.rows=[];state.calls=0})
it('reads published data and current availability in one snapshot without altering sources',async()=>{
 const a=randomUUID(),b=randomUUID(),hidden=randomUUID();const w=workspaceSchema.parse({menus:[{id:randomUUID(),name:'Cena',sections:[{id:randomUUID(),name:'Primi',items:[{id:a,name:'Pasta',price:10,translations:{en:{name:'Pasta dish'}}},{id:b,name:'Rice',price:12},{id:hidden,name:'Hidden dish',price:3,hidden:true}]}]}]})
 const before=structuredClone(w);state.rows=[{name:'Venue',settings:{customerOrderingEnabled:false},published:w,available:[a,hidden]}];const result=await readPublishedCatalog('tenant',{catalogOnly:true});expect(state.calls).toBe(1);expect(result!.workspace.menus[0]!.sections[0]!.items.map(i=>i.id)).toEqual([a]);expect(w).toEqual(before);const publicMenu=publicMenuProjection(result!.workspace.menus[0]!,'en');expect(publicMenu.sections[0]!.sourceName).toBe('Primi');expect(publicMenu.sections[0]!.items[0]!.name).toBe('Pasta dish');expect(publicMenu.sections[0]!.items[0]).not.toHaveProperty('costPrice')
})
it('never creates or returns a private draft or an inactive venue',async()=>{state.rows=[{published:null,draft:{menus:['private']}}];expect(await readPublishedCatalog('tenant')).toBeNull();state.rows=[];expect(await readPublishedCatalog('inactive')).toBeNull()})
it('marks texts left in the source language only when another language is requested',()=>{
 const w=workspaceSchema.parse({menus:[{id:randomUUID(),name:'Cena',sections:[{id:randomUUID(),name:'Primi',description:'Fatti in casa',items:[{id:randomUUID(),name:'Pasta',description:'Al pomodoro',price:10,translations:{en:{name:'Pasta dish',description:'With tomato'}}},{id:randomUUID(),name:'Riso',description:'Allo zafferano',price:12}]}]}]})
 const en=publicMenuProjection(w.menus[0]!,'en','it'),it_=publicMenuProjection(w.menus[0]!,'it','it'),legacy=publicMenuProjection(w.menus[0]!,'en')
 expect(en.sections[0]).toMatchObject({nameLang:'it',descriptionLang:'it'})
 expect(en.sections[0]!.items[0]).not.toHaveProperty('nameLang');expect(en.sections[0]!.items[0]).not.toHaveProperty('descriptionLang')
 expect(en.sections[0]!.items[1]).toMatchObject({name:'Riso',nameLang:'it',descriptionLang:'it'})
 expect(it_.sections[0]).not.toHaveProperty('nameLang');expect(legacy.sections[0]!.items[1]).not.toHaveProperty('nameLang')
})
it('exposes the menu note to customers, translated when available and marked when not',()=>{
 const w=workspaceSchema.parse({menus:[{id:randomUUID(),name:'Cena',description:'Coperto 2 €\nWiFi: Ospiti',translations:{en:{name:'Dinner',description:'Cover charge €2'}},sections:[{id:randomUUID(),name:'Primi',items:[{id:randomUUID(),name:'Pasta',price:10}]}]},{id:randomUUID(),name:'Pranzo',description:'Asporto +0,50 €',sections:[]},{id:randomUUID(),name:'Drinks',description:'   ',sections:[]}]})
 expect(publicMenuProjection(w.menus[0]!,'it','it')).toMatchObject({description:'Coperto 2 €\nWiFi: Ospiti'})
 expect(publicMenuProjection(w.menus[0]!,'it','it')).not.toHaveProperty('descriptionLang')
 expect(publicMenuProjection(w.menus[0]!,'en','it')).toMatchObject({name:'Dinner',description:'Cover charge €2'})
 expect(publicMenuProjection(w.menus[0]!,'en','it')).not.toHaveProperty('descriptionLang')
 expect(publicMenuProjection(w.menus[1]!,'en','it')).toMatchObject({description:'Asporto +0,50 €',descriptionLang:'it'})
 expect(publicMenuProjection(w.menus[2]!,'it','it')).not.toHaveProperty('description')
})
