// Menu a prezzo fisso (21/10): formule, sostituzione giornaliera dei piatti, niente prezzi sui piatti dei menu fissi.
import {describe,expect,it} from 'vitest'
import {structureActions,haikuChecks} from '../apps/server/src/lib/owner-brain-plan.js'
import {applyActions} from '../apps/server/src/lib/twilio-menu-ai.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'

const U=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const ws=()=>workspaceSchema.parse({menus:[{id:U(1),name:'Menu pranzo',type:'lunch',pricing:'fisso',included:'¼ di vino',formulas:[{id:U(9),name:'Completo',price:12,note:'primo + secondo con contorno',translations:{}}],sections:[
 {id:U(2),name:'Primi',items:[{id:U(3),name:'Carbonara',price:0},{id:U(4),name:'Lasagna',price:0,hidden:true},{id:U(5),name:'Gricia',price:0}]},
 {id:U(6),name:'Secondi',items:[{id:U(7),name:'Cotoletta',price:0}]}]}]})
const menus=[{id:U(1),name:'Menu pranzo',sections:2,active:true,pricing:'fisso' as const,formulas:[{id:U(9),name:'Completo',price:12}],secs:[{id:U(2),name:'Primi',active:true,parent:null,items:3},{id:U(6),name:'Secondi',active:true,parent:null,items:1}]}]
const sections=[{id:U(2),name:'Primi',menu:'Menu pranzo'},{id:U(6),name:'Secondi',menu:'Menu pranzo'}]
const refs=[{id:U(3),name:'Carbonara',price:0,sectionId:U(2),hidden:false},{id:U(4),name:'Lasagna',price:0,sectionId:U(2),hidden:true},{id:U(5),name:'Gricia',price:0,sectionId:U(2),hidden:false},{id:U(7),name:'Cotoletta',price:0,sectionId:U(6),hidden:false}] as any[]
const A=(action:string,o:any={})=>({action,item:null,section:null,menu:null,name:null,price:null,text:null,...o})
const codes=new Map([['c1',U(2)],['c2',U(6)]])

describe('formule',()=>{
 it('«il completo a pranzo passa a 12,50» cambia il prezzo della formula (solo se detto)',()=>{
  const r=structureActions([A('set_formula_price',{menu:'pranzo',name:'Completo',price:12.5})],{message:'il completo a pranzo passa a 12,50',sections,menus,refs})
  expect(r.actions[0]).toMatchObject({kind:'set_formula',formulaId:U(9),price:12.5,before:12})
  const w=ws();applyActions(w,r.actions);expect(workspaceSchema.parse(w).menus[0]!.formulas![0]!.price).toBe(12.5)
  expect(structureActions([A('set_formula_price',{menu:'pranzo',name:'Completo',price:17})],{message:'il completo a pranzo passa a 12',sections,menus,refs}).ask).toBe('prezzo_formula_non_detto')
 })
 it('«aggiungi l\'opzione solo primo a 9» crea la formula',()=>{
  const r=structureActions([A('create_formula',{menu:'pranzo',name:'Solo primo',price:9})],{message:"aggiungi l'opzione solo primo a 9 al pranzo",sections,menus,refs})
  expect(r.actions[0]).toMatchObject({kind:'set_formula',isNew:true,name:'Solo primo',price:9})
  const w=ws();applyActions(w,r.actions);expect(workspaceSchema.parse(w).menus[0]!.formulas!.map(f=>f.name)).toEqual(['Completo','Solo primo'])
 })
})

describe('sostituzione giornaliera dei piatti',()=>{
 it('«oggi primi lasagna e carbonara»: lasagna torna, carbonara resta, gricia nascosta (mai eliminata), nuovi a prezzo 0',()=>{
  const r=structureActions([A('replace_section_items',{section:'c1',menu:'pranzo',text:'Lasagna; Carbonara; Amatriciana'})],{message:'oggi a pranzo primi lasagna, carbonara e amatriciana',sections,menus,refs,codes})
  expect(r.ask).toBeNull()
  const w=ws();applyActions(w,r.actions as any);const p=workspaceSchema.parse(w),primi=p.menus[0]!.sections[0]!
  expect(primi.items.filter(i=>!i.hidden).map(i=>i.name).sort()).toEqual(['Amatriciana','Carbonara','Lasagna'])
  expect(primi.items.find(i=>i.name==='Gricia')!.hidden).toBe(true);expect(primi.items.find(i=>i.name==='Amatriciana')!.price).toBe(0)
  expect(p.menus[0]!.sections[1]!.items[0]!.hidden).toBe(false)
 })
 it('nomi non detti → domanda',()=>{
  expect(structureActions([A('replace_section_items',{section:'c1',menu:'pranzo',text:'Tortellini'})],{message:'oggi a pranzo primi lasagna',sections,menus,refs,codes}).ask).toBe('nome_non_detto')
 })
})

describe('prezzi dei piatti nei menu fissi',()=>{
 it('set_price su un piatto di un menu fisso → domanda',()=>{
  const d={intent:'change' as const,plan:{type:'change' as const,actions:[{kind:'price',id:U(3),price:8}]},exclude:[],aliasesUsed:[],replyDraft:'',notes:[] as string[]}
  expect(haikuChecks(d as any,'la carbonara a 8',sections as any,refs,new Set([U(2),U(6)]))!.notes).toContain('prezzo_piatto_menu_fisso')
 })
})
