// Bot titolare (17/10/2026, perimetro Q): unità di «togli» coerente, parte incerta in sospeso, annulla vero e prompt di Whisper.
import {describe,it,expect,vi,afterEach} from 'vitest'
import {holdFromMessage,holdAnswer,removalGuess,squash,undoRecordFor,applyUndo,isUndoRequest,stripLeadBeforeRemoval} from '../apps/server/src/lib/twilio-menu-hold.js'
import {parseIntent,capabilityFromText} from '../apps/server/src/lib/twilio-menu-nlu.js'
import {whisperPrompt,transcribeAudio,validateMenuPlan,whisperServiceWords} from '../apps/server/src/lib/twilio-menu-ai.js'
const sections=[{id:'s1',name:'Primi',menu:'Pranzo'},{id:'s4',name:'Piatti di prova',menu:'Pranzo'},{id:'s6',name:'Dolci',menu:'Cena'}]
const R=(id:string,name:string,sectionId:string,section:string,hidden=false)=>({id,name,price:10,available:true,hidden,menu:'Pranzo',section,sectionId})
const refs=[R('a','Spaghetti alla carbonara','s1','Primi'),R('b','Pasta e fagioli','s1','Primi'),R('c','Piatto di verifica','s4','Piatti di prova'),R('d','Che ne sacc','s4','Piatti di prova'),R('e','boh','s4','Piatti di prova'),R('f','pasta al ragù','s4','Piatti di prova'),R('g','Tiramisù','s6','Dolci')]
const MANUEL='aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e tojibo'

describe('«togli» = nascondere, sempre',()=>{
 it('tutti i verbi di rimozione, anche con «no,» davanti, sono «nascondi»; esaurito solo con finito/esaurito',()=>{
  for(const t of ['togli boh','leva boh','levami boh','elimina boh','cancella boh','rimuovi boh','togli boh dal menu','leva dal menu boh','no togli boh','togliamo boh','eliminami boh'])expect(parseIntent(t),t).toEqual({kind:'hidden',target:'boh',value:true})
  expect(stripLeadBeforeRemoval('no, togli bo')).toBe('togli bo');expect(stripLeadBeforeRemoval('no, la carbonara costa 13')).toBe('no, la carbonara costa 13')
  expect(parseIntent('boh è finito')).toEqual({kind:'available',target:'boh',value:false});expect(parseIntent('non c\'è più boh')).toEqual({kind:'available',target:'boh',value:false})
  expect(capabilityFromText('elimina la carbonara')).toBeNull();expect(capabilityFromText('elimina la categoria dolci')).toContain('delete')
 })
 it('il validatore corregge il modello che segna «finito» un piatto da togliere, anche nelle frasi coordinate',()=>{
  const plan=(msg:string,ids:string[])=>validateMenuPlan({intent:'change',actions:ids.map(id=>({action:'set_available',item_id:id,available:false}))},refs as any,{message:msg})
  expect(plan('togli boh e la carbonara',['e','a'])).toEqual({type:'change',actions:[{kind:'hidden',id:'e',value:true},{kind:'hidden',id:'a',value:true}]})
  expect(plan('la carbonara è finita e togli boh',['a','e'])).toEqual({type:'change',actions:[{kind:'available',id:'a',value:false},{kind:'hidden',id:'e',value:true}]})
  expect(plan('togli boh, la carbonara invece è finita',['e','a'])).toEqual({type:'change',actions:[{kind:'hidden',id:'e',value:true},{kind:'available',id:'a',value:false}]})
 })
})

describe('richiesta multipla con una parte incerta (vocale di Manuel, 17/10)',()=>{
 it('«tojibo» suona come «togli boh»: le aggiunte chiare restano in sospeso e si chiede «Intendi togliere boh?»',()=>{
  expect(squash('tojibo')).toBe('toibo');expect(removalGuess('tojibo',refs as any)?.name).toBe('boh');expect(removalGuess('toglibo',refs as any)?.name).toBe('boh');expect(removalGuess('tortelli',refs as any)).toBeNull()
  const h=holdFromMessage(MANUEL,sections,refs as any)!;expect('hold' in h).toBe(true)
  if(!('hold' in h))return
  expect(h.hold.actions).toEqual([{kind:'create',sectionId:'s4',name:'Parmigiana',price:10,description:null},{kind:'create',sectionId:'s4',name:'Tiramisù',price:6,description:null}])
  expect(h.hold.ask).toEqual({type:'remove',id:'e',word:'tojibo'});expect(h.text).toContain('Intendi *togliere boh* dal menu?');expect(h.text).toContain('Non ho ancora cambiato nulla')
  for(const t of ['sì','esatto','sì, toglilo','togli boh','togli bo','toglibo','no ho detto togli boh'])expect(holdAnswer(stripLeadBeforeRemoval(t),h.hold,refs as any),t).toEqual({actions:[...h.hold.actions,{kind:'hidden',id:'e',value:true}]})
  expect(holdAnswer('no',h.hold,refs as any)).toEqual({actions:h.hold.actions,note:'Non ho toccato *boh*.'});expect(holdAnswer('annulla',h.hold,refs as any)).toBe('cancel');expect(holdAnswer('boh vediamo',h.hold,refs as any)).toBeNull()
 })
 it('un piatto nuovo senza prezzo: si chiede il prezzo e la risposta completa tutto; tutto chiaro con «togli» dentro → si applica',()=>{
  const h=holdFromMessage('aggiungi nei piatti di prova la parmigiana a 10 euro, il tiramisù a 6 euro e la frittata',sections,refs as any)!
  if(!('hold' in h))throw new Error('hold atteso');expect(h.hold.ask).toEqual({type:'price',name:'Frittata',sectionId:'s4'})
  expect(holdAnswer('8 euro',h.hold,refs as any)).toEqual({actions:[...h.hold.actions,{kind:'create',sectionId:'s4',name:'Frittata',price:8,description:null}]})
  expect(holdFromMessage('aggiungi nei piatti di prova la parmigiana a 10 euro e togli boh',sections,refs as any)).toEqual({actions:[{kind:'create',sectionId:'s4',name:'Parmigiana',price:10,description:null},{kind:'hidden',id:'e',value:true}],seen:[]})
  expect(holdFromMessage('aggiungi tra i primi i tonnarelli a 11 e i tortelli a 12',sections,refs as any)).toBeNull()
  expect(holdFromMessage('la carbonara costa 13 e la lasagna 12',sections,refs as any)).toBeNull()
 })
})

describe('annulla vero',()=>{
 const ws=(price:number,extra:any[]=[])=>({menus:[{id:'m',name:'Pranzo',sections:[{id:'s1',name:'Primi',items:[{id:'a',name:'Carbonara',price},{id:'b',name:'Lasagna',price:11},...extra]}]}],design:{}})
 it('ripristina le voci cambiate e toglie quelle aggiunte; se la dashboard le ha cambiate non tocca nulla',()=>{
  const rec=undoRecordFor(ws(12),ws(13,[{id:'n',name:'Cannolo',price:4}]),1000)!;expect(rec.items.map(i=>[i.id,i.before?.price??null,i.after?.price])).toEqual([['a',12,13],['n',null,4]])
  const w=ws(13,[{id:'n',name:'Cannolo',price:4}]);expect(applyUndo(w,rec)).toEqual({ok:true,restored:['Carbonara'],removed:['Cannolo']});expect(w).toEqual(ws(12))
  const changed=ws(15,[{id:'n',name:'Cannolo',price:4}]);expect(applyUndo(changed,rec)).toEqual({ok:false,changed:['Carbonara']});expect(changed).toEqual(ws(15,[{id:'n',name:'Cannolo',price:4}]))
  const other=ws(13,[{id:'n',name:'Cannolo',price:4}]);other.menus[0]!.sections[0]!.items[1]!.price=14;expect(applyUndo(other,rec).ok).toBe(true);expect(other.menus[0]!.sections[0]!.items[1]!.price).toBe(14)
  expect(undoRecordFor(ws(12),ws(12))).toBeNull()
 })
 it('riconosce «annulla / torna indietro / rimetti com\'era», non «no» né «annulla la promo»',()=>{
  for(const t of ['annulla','Annulla.','torna indietro','rimetti com\'era','annulla l\'ultima modifica','torna come prima','no aspetta, annulla','ops annulla','annulla tutto'])expect(isUndoRequest(t),t).toBe(true)
  for(const t of ['no','annulla la promo della carbonara','lascia stare','la carbonara costa 13'])expect(isUndoRequest(t),t).toBe(false)
 })
})

describe('Whisper: nomi del locale nel prompt',()=>{
 afterEach(()=>vi.unstubAllGlobals())
 it('parole di servizio, categorie e piatti (i più recenti per categoria, i visibili prima), entro ~200 token',()=>{
  const p=whisperPrompt(refs as any,sections);expect(p.startsWith(whisperServiceWords)).toBe(true)
  for(const n of ['Primi','Piatti di prova','Dolci','boh','Che ne sacc','Piatto di verifica','pasta al ragù','Tiramisù'])expect(p).toContain(n)
  const many=Array.from({length:300},(_,i)=>R('x'+i,'Piatto numero '+i,'s'+(i%7),'Cat '+(i%7),i%5===0)),big=whisperPrompt(many as any,sections)
  expect(big.length).toBeLessThanOrEqual(600);expect(big).toContain('Piatto numero 298');expect(big).not.toContain('Piatto numero 0,')
 })
 it('il prompt arriva nella richiesta di trascrizione (nessun token LLM)',async()=>{
  let sent:FormData|null=null;vi.stubGlobal('fetch',async(_u:any,init:any)=>{sent=init.body as FormData;return new Response(JSON.stringify({text:'togli boh',duration:2}),{status:200,headers:{'Content-Type':'application/json'}})})
  const vocab=whisperPrompt(refs as any,sections);expect(await transcribeAudio(new Uint8Array([1,2,3]),'audio/ogg','k',{},vocab)).toBe('togli boh')
  expect(sent!.get('prompt')).toBe(vocab);expect(String(sent!.get('prompt'))).toContain('Piatto di verifica');expect(sent!.get('model')).toBe('whisper-large-v3-turbo')
  await transcribeAudio(new Uint8Array([1]),'audio/ogg','k',{});expect(sent!.get('prompt')).toBe(whisperServiceWords)
 })
})
