// Menu «a prezzo fisso» (21/10): proiezione pubblica (CONTRATTO §1, §2, §6). Alla carta resta identica a prima.
import {it,expect,vi} from 'vitest'
import {randomUUID} from 'node:crypto'
vi.mock('../packages/db/src/index.ts',()=>({menuItems:{},db:{execute:async()=>[]}}))
vi.mock('../apps/server/src/lib/menu-workspace-store.js',()=>({readWorkspace:async()=>null}))
import {publicMenuProjection,fixedPriceProjection} from '../apps/server/src/lib/published-menu.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'

const ids={primi:randomUUID(),secondi:randomUUID(),contorni:randomUUID(),completo:randomUUID(),primo:randomUUID()}
const dish=(name:string)=>({id:randomUUID(),name,price:0})
const fixedMenu=(extra:Record<string,unknown>={})=>workspaceSchema.parse({menus:[{id:randomUUID(),name:'Menu Cena',pricing:'fisso',included:'¼ di vino oppure ½ litro d’acqua + caffè',
 translations:{en:{name:'Dinner menu',included:'¼ wine or ½ l water + coffee'}},
 formulas:[{id:ids.completo,name:'Completo',price:16.9,note:'Un primo + un secondo con contorno',sectionIds:[ids.primi,ids.secondi,ids.contorni],translations:{en:{name:'Full',description:'A first + a main with side'}}},
  {id:ids.primo,name:'Solo primo',price:9,note:'Un primo',sectionIds:[ids.primi],translations:{}}],
 sections:[{id:ids.primi,name:'Primi',items:[dish('Linguine'),dish('Gnocchi')]},{id:ids.secondi,name:'Secondi',items:[dish('Nodino')]},{id:ids.contorni,name:'Contorni',items:[dish('Patate')]}],...extra}]}).menus[0]!

it('menu fisso: opzioni nell’ordine, sectionIds, nota e Compreso; i piatti restano scritti una volta',()=>{
 const p=publicMenuProjection(fixedMenu())
 expect(p.pricing).toBe('fisso');expect(p.included).toBe('¼ di vino oppure ½ litro d’acqua + caffè')
 expect(p.formulas).toEqual([{id:ids.completo,name:'Completo',price:16.9,note:'Un primo + un secondo con contorno',sectionIds:[ids.primi,ids.secondi,ids.contorni]},{id:ids.primo,name:'Solo primo',price:9,note:'Un primo',sectionIds:[ids.primi]}])
 expect(p.sections.map(s=>s.name)).toEqual(['Primi','Secondi','Contorni'])
 expect(p.sections.flatMap(s=>s.items).length).toBe(4)
})
it('menu fisso tradotto: nome, nota e Compreso nella lingua; senza traduzione resta l’italiano',()=>{
 const p=publicMenuProjection(fixedMenu(),'en','it')
 expect(p.formulas?.[0]).toMatchObject({name:'Full',note:'A first + a main with side'})
 expect(p.formulas?.[1]).toMatchObject({name:'Solo primo',note:'Un primo'})
 expect(p.included).toBe('¼ wine or ½ l water + coffee')
 const fr=publicMenuProjection(fixedMenu(),'fr','it');expect(fr.included).toBe('¼ di vino oppure ½ litro d’acqua + caffè')
})
it('senza sectionIds nessun campo sectionIds; sezioni sparite dal pubblicato si tolgono',()=>{
 const m=fixedMenu();m.formulas![0]!.sectionIds=undefined;m.formulas![1]!.sectionIds=[randomUUID()]
 const p=fixedPriceProjection(m)
 expect(p.formulas!.every(f=>!('sectionIds' in f))).toBe(true)
})
it('menu fisso senza opzioni: formulas vuoto, niente Compreso vuoto',()=>{
 const p=publicMenuProjection(fixedMenu({formulas:[],included:'  '}))
 expect(p.pricing).toBe('fisso');expect(p.formulas).toEqual([]);expect('included' in p).toBe(false)
})
it('alla carta (o documento vecchio): nessun campo nuovo, anche con formule salvate',()=>{
 const carta=publicMenuProjection(fixedMenu({pricing:'carta'}))
 expect('pricing' in carta||'formulas' in carta||'included' in carta).toBe(false)
 const old=publicMenuProjection(workspaceSchema.parse({menus:[{id:randomUUID(),name:'Cena',sections:[{id:randomUUID(),name:'Primi',items:[{id:randomUUID(),name:'Pasta',price:10}]}]}]}).menus[0]!)
 expect(Object.keys(old).sort()).toEqual(['id','name','sections'])
})
