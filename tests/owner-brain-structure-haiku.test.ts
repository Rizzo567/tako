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
