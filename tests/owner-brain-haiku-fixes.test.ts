// Fix del 21/10 mattina (via di Manuel) sul motore Haiku: vincoli deterministici del validatore e del turno.
import {describe,expect,it} from 'vitest'
import {haikuChecks} from '../apps/server/src/lib/owner-brain-plan.js'
import {decideTurn,reasonText} from '../apps/server/src/lib/owner-brain-r.js'

const dec=(actions:any[])=>({intent:'change' as const,plan:{type:'change' as const,actions},exclude:[],aliasesUsed:[],replyDraft:'',notes:[] as string[]})

describe('haikuChecks (motore haiku)',()=>{
 it('separatore delle migliaia → domanda, nessuna azione',()=>{
  const r=haikuChecks(dec([{kind:'price',id:'carb',price:13}]) as any,'la carbonara a 13.000')!
  expect(r.plan.type).toBe('clarify');expect(r.notes).toContain('prezzo_migliaia');expect(reasonText(r.notes)).toMatch(/migliaia/)
  expect(haikuChecks(dec([{kind:'price',id:'carb',price:13.5}]) as any,'la carbonara a 13.50')).toBeNull()
  expect(haikuChecks(dec([{kind:'price',id:'carb',price:13.5}]) as any,'la carbonara a 13,50')).toBeNull()
 })
 it('azioni opposte sullo stesso piatto → domanda',()=>{
  for(const acts of [[{kind:'hidden',id:'b',value:true},{kind:'featured',id:'b',value:true}],[{kind:'available',id:'b',value:true},{kind:'available',id:'b',value:false}],[{kind:'price',id:'b',price:4},{kind:'price',id:'b',price:5}]]){
   const r=haikuChecks(dec(acts) as any,'nascondi il babà e mettilo in evidenza')!;expect(r.plan.type).toBe('clarify');expect(r.notes).toContain('azioni_contraddittorie')}
  expect(haikuChecks(dec([{kind:'hidden',id:'a',value:true},{kind:'featured',id:'b',value:true}]) as any,'nascondi a, evidenzia b')).toBeNull()
 })
 it('data futura («da domani») → domanda con l\'azione in attesa, nessuna scrittura',()=>{
  const r=haikuChecks(dec([{kind:'price',id:'v',price:13.5}]) as any,'il piatto di verifica da domani costa 13,50 euro')!
  expect(r.plan.type).toBe('clarify');expect(r.notes).toContain('data_futura');expect((r.plan as any).actions).toEqual([{kind:'price',id:'v',price:13.5}])
  expect(haikuChecks(dec([{kind:'price',id:'v',price:13.5}]) as any,'il piatto di verifica a 13,50')).toBeNull()
 })
 it('sconto/promo/offerta → promo allo stesso prezzo, mai set_price',()=>{
  const r=haikuChecks(dec([{kind:'hidden',id:'p',value:true},{kind:'price',id:'k',price:12}]) as any,'nascondi la parmigiana e mettimi in sconto il kenesac a 12 euro')!
  expect(r.plan.type).toBe('change');expect((r.plan as any).actions).toEqual([{kind:'hidden',id:'p',value:true},{kind:'promo',id:'k',price:12,until:null}])
  expect(haikuChecks(dec([{kind:'price',id:'k',price:12}]) as any,'il kenesac mettilo in offerta a 12')!.plan).toMatchObject({actions:[{kind:'promo'}]})
  expect(haikuChecks(dec([{kind:'price',id:'k',price:12}]) as any,'il kenesac a 12')).toBeNull()
 })
})

describe('decideTurn: «annulla» con un\'eliminazione in attesa',()=>{
 const pend={kind:'batch',actions:[{kind:'delete',id:'baba'}],why:'delete'} as any
 for(const msg of ['annulla','lascia stare','no','niente'])it(`«${msg}» scarta la proposta anche se il modello sceglie undo_last`,()=>{
  const o=decideTurn({decision:{intent:'clarify',plan:{type:'clarify',ids:[]},notes:[],exclude:[]},control:['undo_last'],raw:{intent:'change',actions:[{action:'undo_last'}]},message:msg,pend,undoOK:false,sections:[],refs:[]})
  expect(o).toEqual({kind:'cancel'})})
 it('«sì» resta una conferma',()=>{
  const o=decideTurn({decision:{intent:'clarify',plan:{type:'clarify',ids:[]},notes:[],exclude:[]},control:['confirm_pending'],raw:{intent:'change',actions:[{action:'confirm_pending'}]},message:'sì',pend,undoOK:false,sections:[],refs:[]})
  expect(o.kind).toBe('confirm')})
})
