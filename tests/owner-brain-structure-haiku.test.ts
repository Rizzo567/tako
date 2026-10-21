// Struttura dal bot (21/10, prova di Manuel sul QA): Menu nuovi, Sottomenu vuoti in un Menu preciso, più azioni insieme,
// e invariante «nessuna conferma a vuoto / niente gergo».
import {describe,expect,it} from 'vitest'
import {structureActions,haikuChecks} from '../apps/server/src/lib/owner-brain-plan.js'
import {applyActions,describeAction,effectiveMenuActions} from '../apps/server/src/lib/twilio-menu-ai.js'
import {cleanDraft,claimsWrite} from '../apps/server/src/lib/owner-brain-r.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'

const QA='11111111-1111-4111-8111-111111111111'
const ws=()=>workspaceSchema.parse({menus:[{id:QA,name:'Menu',type:'main',sections:[{id:'22222222-2222-4222-8222-222222222222',name:'Primi',items:[{id:'33333333-3333-4333-8333-333333333333',name:'Carbonara',price:12}]}]}]})
const menus=[{id:QA,name:'Menu',sections:1}],sections=[{id:'22222222-2222-4222-8222-222222222222',name:'Primi',menu:'Menu'}]
const A=(action:string,o:any={})=>({action,item:null,section:null,menu:null,name:null,...o})

describe('structureActions + applyActions',()=>{
 it('2 Menu + 4 Sottomenu in un piano, con i nomi detti; si applica tutto in una volta',()=>{
  const msg='voglio un menu pranzo con completo e un menu cena con completo, primo e secondo'
  const r=structureActions([A('create_menu',{name:'Pranzo'}),A('create_menu',{name:'Cena'}),A('create_section',{name:'Completo',menu:'Pranzo'}),A('create_section',{name:'Completo',menu:'Cena'}),A('create_section',{name:'Primo',menu:'Cena'}),A('create_section',{name:'Secondo',menu:'Cena'})],{message:msg,sections,menus})
  expect(r.ask).toBeNull();expect(r.actions.map(a=>a.kind)).toEqual(['create_menu','create_menu','create_section','create_section','create_section','create_section'])
  const w=ws();expect(effectiveMenuActions(r.actions,w).length).toBe(6);applyActions(w,r.actions);const p=workspaceSchema.parse(w)
  expect(p.menus.map(m=>m.name)).toEqual(['Menu','Pranzo','Cena'])
  expect(p.menus[1]!.sections.map(s=>s.name)).toEqual(['Completo']);expect(p.menus[2]!.sections.map(s=>s.name).sort()).toEqual(['Completo','Primo','Secondo'])
  expect(p.menus[1]!.type).toBe('lunch');expect(p.menus[2]!.type).toBe('dinner')
  expect(describeAction(r.actions[2]!,[],[])).toBe('Nuovo Sottomenu *Completo* nel Menu *Pranzo*')
 })
 it('nomi dalla cronologia del titolare («No, tu inizi a crearli»)',()=>{
  const r=structureActions([A('create_menu',{name:'Pranzo'})],{message:'No, tu inizi a crearli',history:[{role:'owner',text:'aggiungi un nuovo menù che si chiama pranzo',at:1} as any],sections,menus})
  expect(r.actions).toHaveLength(1)
 })
 it('frase intera o nome non detto → domanda, nessuna azione',()=>{
  expect(structureActions([A('create_menu',{name:'No ho detto che devi creare un nuovo menu'})],{message:'No, ho detto che devi proprio creare un nuovo menù',sections,menus}).ask).toBe('nome_menu')
  expect(structureActions([A('create_menu',{name:'Aperitivo'})],{message:'aggiungi un nuovo menù',sections,menus}).ask).toBe('nome_menu')
 })
 it('Sottomenu senza Menu con più Menu → domanda; con un solo Menu va lì; doppioni saltati',()=>{
  const two=[...menus,{id:'44444444-4444-4444-8444-444444444444',name:'Cena',sections:0}]
  expect(structureActions([A('create_section',{name:'Dolci'})],{message:'crea il sottomenu dolci',sections,menus:two}).ask).toBe('menu_del_sottomenu')
  const one=structureActions([A('create_section',{name:'Dolci'})],{message:'crea il sottomenu dolci',sections,menus});expect(one.actions[0]).toMatchObject({kind:'create_section',menuId:QA})
  const dup=structureActions([A('create_section',{name:'Primi',menu:'Menu'}),A('create_menu',{name:'Menu'})],{message:'crea il menu menu con i primi',sections,menus});expect(dup.actions).toHaveLength(0);expect(dup.notes.join()).toMatch(/esistente/)
 })
})

describe('Sezioni e correzioni della struttura',()=>{
 it('Sezione dentro un Sottomenu (section = codice cN)',()=>{
  const r=structureActions([A('create_section',{name:'Rossi',section:'c1'})],{message:'nei primi metti la sezione rossi',sections,menus,codes:new Map([['c1','22222222-2222-4222-8222-222222222222']])})
  expect(r.actions[0]).toMatchObject({kind:'create_section',parentSectionId:'22222222-2222-4222-8222-222222222222',menuId:QA})
  const w=ws();applyActions(w,r.actions);const p=workspaceSchema.parse(w);expect(p.menus[0]!.sections.map(x=>[x.name,x.parentSectionId])).toEqual([['Primi',null],['Rossi','22222222-2222-4222-8222-222222222222']])
 })
 it('«no, anche Cocktail» aggiunge senza togliere',()=>{
  const two=[...menus,{id:'66666666-6666-4666-8666-666666666666',name:'Aperitivo',sections:1}],secs=[...sections,{id:'77777777-7777-4777-8777-777777777777',name:'Spritz',menu:'Aperitivo'}]
  const r=structureActions([A('delete_section',{name:'Spritz',menu:'Aperitivo'}),A('create_section',{name:'Cocktail',menu:'Aperitivo'})],{message:'no, anche Cocktail',sections:secs,menus:two,refs:[]})
  expect(r.actions.map(a=>a.kind)).toEqual(['create_section']);expect(r.notes).toContain('rimozione_scartata')
 })
 it('«chiamalo Colazione»: si toglie il Menu vuoto appena creato e si crea quello giusto; un Menu con piatti non si toglie',()=>{
  const two=[...menus,{id:'55555555-5555-4555-8555-555555555555',name:'Brunch',sections:0}]
  const r=structureActions([A('delete_menu',{name:'Brunch'}),A('create_menu',{name:'Colazione'})],{message:'no, chiamalo colazione',sections,menus:two,refs:[]})
  expect(r.actions.map(a=>a.kind).sort()).toEqual(['create_menu','delete_menu'])
  const w=ws();w.menus.push({id:'55555555-5555-4555-8555-555555555555',name:'Brunch',type:'main',active:true,translations:{},sections:[]});applyActions(w,r.actions);expect(workspaceSchema.parse(w).menus.map(m=>m.name)).toEqual(['Menu','Colazione'])
  const refs=[{id:'33333333-3333-4333-8333-333333333333',name:'Carbonara',price:12,sectionId:'22222222-2222-4222-8222-222222222222'} as any]
  expect(structureActions([A('delete_menu',{name:'Menu'})],{message:'togli il menu',sections,menus,refs}).ask).toBe('menu_non_vuoto')
  expect(structureActions([A('delete_section',{name:'Primi',menu:'Menu'})],{message:'togli i primi',sections,menus,refs}).ask).toBe('sottomenu_non_vuoto')
 })
})

describe('invariante: nessuna conferma a vuoto, niente gergo',()=>{
 it('bozze con «il sistema» o «rispondi 1 per sì» non arrivano al titolare',()=>{
  expect(cleanDraft('Il sistema non può ancora creare Menu e Sottomenu vuoti da solo.',{wrote:false,numbers:[]})).toBeNull()
  expect(cleanDraft('Rispondi 1 per sì oppure 2 per no.',{wrote:false,numbers:[]})).toBeNull()
  expect(cleanDraft('Come si chiama il nuovo Menu?',{wrote:false,numbers:[]})).toBe('Come si chiama il nuovo Menu?')
 })
 it('«ti preparo i due Menu.» senza scrittura = dichiarazione falsa',()=>{expect(claimsWrite('Ok, ti preparo i due Menu.')).toBe(true);expect(claimsWrite('Faccio subito.')).toBe(true)})
 it('«tutti i secondi» con Secondi in due Menu → una domanda',()=>{
  const secs=[{id:'a',name:'Secondi',menu:'Pranzo'},{id:'b',name:'Secondi',menu:'Cena'}]
  const d={intent:'change' as const,plan:{type:'change' as const,actions:[{kind:'price',id:'x',price:15}]},exclude:[],aliasesUsed:[],replyDraft:'',notes:[] as string[]}
  expect(haikuChecks(d as any,'tutti i secondi aumentali di 3 euro',secs as any)!.notes).toContain('sottomenu_in_piu_menu')
  expect(haikuChecks(d as any,'tutti i secondi della cena aumentali di 3 euro',secs as any)).toBeNull()
 })
})

import {botBrainEnabled} from '../apps/server/src/lib/owner-brain-switch.js'
describe('cervello acceso di default con TAKO_BOT_ENGINE_DEFAULT=haiku (Haiku per tutti, 21/10)',()=>{
 it('env haiku → acceso per i locali senza impostazioni; override per locale e kill switch',()=>{
  const H={TAKO_BOT_ENGINE_DEFAULT:'haiku'}
  expect(botBrainEnabled({},H)).toBe(true);expect(botBrainEnabled(null,H)).toBe(true)
  expect(botBrainEnabled({botBrain:false},H)).toBe(false);expect(botBrainEnabled({botEngine:'groq'},H)).toBe(false)
  expect(botBrainEnabled({botBrain:true},{...H,TAKO_BOT_BRAIN_OFF:'1'})).toBe(false)
 })
 it('senza env o con env groq resta com\'era: acceso solo con botBrain=true',()=>{
  expect(botBrainEnabled({},{})).toBe(false);expect(botBrainEnabled({},{TAKO_BOT_ENGINE_DEFAULT:'groq'})).toBe(false);expect(botBrainEnabled({botBrain:true},{TAKO_BOT_ENGINE_DEFAULT:'groq'})).toBe(true)
 })
})

describe('Menu nuovi nascosti e «rendi visibile» (decisione Manuel 21/10)',()=>{
 const mk=()=>[{id:QA,name:'Menu',sections:1,active:true,secs:[{id:'22222222-2222-4222-8222-222222222222',name:'Primi',active:true,parent:null,items:1}]}]
 it('il Menu nuovo nasce nascosto; i suoi sottomenu lo seguono; un sottomenu in un Menu esistente nasce nascosto',()=>{
  const r=structureActions([A('create_menu',{name:'Cena'}),A('create_section',{name:'Primo',menu:'Cena'}),A('create_section',{name:'Dolci',menu:'Menu'})],{message:'crea il menu cena con primo e nel menu metti dolci',sections,menus:mk()})
  const w=ws();applyActions(w,r.actions);const p=workspaceSchema.parse(w)
  const cena=p.menus.find(m=>m.name==='Cena')!;expect(cena.active).toBe(false);expect(cena.sections[0]!.active).toBe(true)
  expect(p.menus[0]!.sections.find(x=>x.name==='Dolci')!.active).toBe(false)
 })
 it('«rendi visibile Cena» mostra il Menu (subito); già visibile → nessuna azione',()=>{
  const menus=[...mk(),{id:'88888888-8888-4888-8888-888888888888',name:'Cena',sections:0,active:false,secs:[]}]
  const r=structureActions([A('set_menu_visible',{menu:'Cena',value:true})],{message:'rendi visibile cena',sections,menus})
  expect(r.actions).toEqual([{kind:'set_menu_active',menuId:'88888888-8888-4888-8888-888888888888',name:'Cena',value:true,items:0}])
  const w=ws();w.menus.push({id:'88888888-8888-4888-8888-888888888888',name:'Cena',type:'dinner',active:false,translations:{},sections:[]});applyActions(w,r.actions);expect(workspaceSchema.parse(w).menus[1]!.active).toBe(true)
  expect(structureActions([A('set_menu_visible',{menu:'Menu',value:true})],{message:'mostra il menu',sections,menus}).actions).toEqual([])
 })
 it('nascondere un Menu con piatti porta il conteggio (il server chiede il sì); sottomenu omonimi senza Menu → domanda',()=>{
  const r=structureActions([A('set_menu_visible',{menu:'Menu',value:false})],{message:'nascondi tutto il menu',sections,menus:mk()});expect(r.actions[0]).toMatchObject({kind:'set_menu_active',value:false,items:1})
  const two=[...mk(),{id:'99999999-9999-4999-8999-999999999999',name:'Cena',sections:1,active:true,secs:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Primi',active:false,parent:null,items:0}]}]
  expect(structureActions([A('set_section_visible',{name:'Primi',value:true})],{message:'fai vedere i primi',sections,menus:two}).ask).toBe('sottomenu_ambiguo')
  expect(structureActions([A('set_section_visible',{name:'Primi',menu:'Cena',value:true})],{message:'fai vedere i primi della cena',sections,menus:two}).actions[0]).toMatchObject({kind:'set_section_active',value:true,items:0})
 })
 it('«annulla» rimette anche la visibilità di un Menu (record strutturale)',async()=>{
  const {undoRecordFor,applyUndo}=await import('../apps/server/src/lib/twilio-menu-hold.js')
  const before=ws(),after=structuredClone(before);after.menus[0]!.active=false
  const rec=undoRecordFor(before,after)!;expect(rec.full).toBeTruthy();const w=structuredClone(after);expect(applyUndo(w,rec).ok).toBe(true);expect(w.menus[0]!.active).toBe(true)
 })
})
