// Migrazione «trucco COMPLETO/PRIMO/SECONDO» → Menu a prezzo fisso (dati inventati, stessa forma di Victoria).
import {describe,expect,it} from 'vitest'
import {migrateWorkspace,lostDishes,splitDescription} from '../scripts/victoria/fixed-price-migration.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
const U=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const it2=(id:number,name:string,extra:any={})=>({id:U(id),name,price:0,...extra})
const trick=(id:number,name:string,desc:string)=>({id:U(id),name,description:desc,items:[]})
const child=(id:number,parent:number,name:string,items:any[])=>({id:U(id),parentSectionId:U(parent),name,items})
const W=()=>workspaceSchema.parse({menus:[
 {id:U(1),name:'Alla carta',sections:[{id:U(2),name:'Primi',items:[{id:U(3),name:'Carbonara',price:12}]}]},
 {id:U(10),name:'Menu cena',type:'dinner',sections:[
  trick(11,'COMPLETO','16,90 € · Un primo + un secondo con contorno. ¼ di vino oppure ½ litro d’acqua + caffè.'),
  child(12,11,'Primi',[it2(13,'Linguine'),it2(14,'Gnocchi')]),child(15,11,'Secondi',[it2(16,'Nodino',{imageUrl:null})]),child(17,11,'Contorni',[it2(18,'Patate')]),
  trick(20,'PRIMO','9,00 € · Un primo. ¼ di vino oppure ½ litro d’acqua + caffè.'),child(21,20,'Primi',[it2(22,'Linguine'),it2(23,'Gnocchi'),it2(24,'Risotto')]),
  trick(30,'SECONDO','10,00 € · Un secondo con contorno. ¼ di vino oppure ½ litro d’acqua + caffè.'),child(31,30,'Secondi',[it2(32,'Nodino',{imageUrl:'/uploads/nodino.jpg'})]),child(33,30,'Contorni',[it2(34,'Patate')])]}]})
describe('migrazione Victoria al prezzo fisso',()=>{
 it('legge prezzo, nota e Compreso dalla descrizione',()=>{expect(splitDescription('12,00 € · Un primo + un secondo con contorno. ¼ di vino oppure ½ litro d’acqua + caffè.')).toEqual({price:12,note:'Un primo + un secondo con contorno',included:'¼ di vino oppure ½ litro d’acqua + caffè'})})
 it('formule con i sottomenu compresi, piatti una volta sola, nessun piatto perso, dati presi dai doppioni',()=>{
  const before=W(),{workspace}=migrateWorkspace(before),cena=workspace.menus[1]!
  expect(cena.pricing).toBe('fisso');expect(cena.included).toBe('¼ di vino oppure ½ litro d’acqua + caffè')
  expect(cena.formulas!.map(f=>[f.name,f.price])).toEqual([['Completo',16.9],['Solo primo',9],['Solo secondo',10]])
  const name=(id:string)=>cena.sections.find(s=>s.id===id)!.name
  expect(cena.formulas!.map(f=>f.sectionIds!.map(name))).toEqual([['Primi','Secondi','Contorni'],['Primi'],['Secondi','Contorni']])
  expect(cena.sections.map(s=>[s.name,s.parentSectionId,s.items.map(i=>i.name)])).toEqual([['Primi',null,['Linguine','Gnocchi','Risotto']],['Secondi',null,['Nodino']],['Contorni',null,['Patate']]])
  expect(cena.sections[1]!.items[0]!.imageUrl).toBe('/uploads/nodino.jpg')
  expect(lostDishes(before,workspace)).toEqual([]);expect(workspace.menus[0]).toEqual(before.menus[0])
 })
 it('menu senza trucco: invariato',()=>{const w=workspaceSchema.parse({menus:[{id:U(1),name:'Alla carta',sections:[{id:U(2),name:'Primi',items:[{id:U(3),name:'Carbonara',price:12}]}]}]});expect(migrateWorkspace(w).report).toEqual([])})
})

describe('variante dati veri 21/10: piatto-prezzo dentro il sottomenu trucco',()=>{
 it('COMPLETO con un piatto COMPLETO 12 € → formula 12, nota e Compreso dalla descrizione; il piatto-prezzo non è «perso»',()=>{
  const w=workspaceSchema.parse({menus:[
   {id:U(1),name:'Alla carta',sections:[{id:U(2),name:'Formaggi',items:[{id:U(3),name:'Formaggi',price:9}]}]},
   {id:U(20),name:'Menu Pranzo',type:'lunch',sections:[
    {id:U(21),name:'COMPLETO',items:[{id:U(22),name:'COMPLETO',price:12,description:'Un primo + un secondo con contorno. ¼ di vino oppure ½ litro d’acqua + caffè.'}]},
    child(23,21,'Primi',[it2(24,'Gnocchi alla sorrentina')]),child(25,21,'Secondi',[it2(26,'Nodino burro e salvia')])]}]})
  const {workspace:out}=migrateWorkspace(w),m=out.menus.find(x=>x.name==='Menu Pranzo') as any
  expect(m.pricing).toBe('fisso');expect(m.formulas.map((f:any)=>[f.name,f.price,f.note])).toEqual([['Completo',12,'Un primo + un secondo con contorno']])
  expect(m.included).toBe('¼ di vino oppure ½ litro d’acqua + caffè')
  expect(m.sections.map((s:any)=>s.name)).toEqual(['Primi','Secondi'])
  expect(lostDishes(w,out)).toEqual([])
  // Alla carta: un sottomenu con un solo piatto omonimo ma senza figli non è un trucco.
  expect((out.menus[0] as any).pricing).toBeUndefined()
 })
})
