// Prove del giudice e del set del banco E (sempre accese, nessuna rete, nessun bot): il giudice è deterministico e
// classifica come fix-loop.md; il set rispetta i minimi del perimetro E.
import {describe,expect,it} from 'vitest'
import {CONVERSATIONS,byFamily} from './conversations.js'
import {dishNames,FIXTURES,initialMenu} from './fixtures/menus.js'
import {diff,judge,optionsIn} from './judge.js'
import {FAMILIES,type BotRun,type Conversation,type EvalMenu} from './types.js'

const edit=(m:EvalMenu,name:string,f:(i:any)=>void)=>{const w=structuredClone(m);for(const x of w.menus)for(const s of x.sections)for(const i of s.items)if(i.name===name)f(i);return w}
const run=(steps:[string,EvalMenu][]):BotRun=>({turns:steps.map(([reply,menuAfter])=>({reply,menuAfter,latencyMs:1,llm:{calls:0,tokens:0,misses:0,recordedMs:0}})),finalMenu:steps.at(-1)![1]})
const conv=(x:Partial<Conversation>):Conversation=>({id:'t',family:'anche',menu:'romana',turns:[{text:'a'},{text:'b'}],changes:[],...x})
const m0=initialMenu('romana')

describe('banco E: set conversazionale',()=>{
 it('≥250 conversazioni, 1–6 turni di messaggio, tutte le famiglie, id unici',()=>{
  expect(CONVERSATIONS.length).toBeGreaterThanOrEqual(250)
  for(const c of CONVERSATIONS){const n=c.turns.filter(t=>'text' in t||'voice' in t).length;expect(n,c.id).toBeGreaterThanOrEqual(1);expect(n,c.id).toBeLessThanOrEqual(6)}
  expect(new Set(CONVERSATIONS.map(c=>c.id)).size).toBe(CONVERSATIONS.length)
  for(const f of FAMILIES)expect(byFamily()[f]??0,f).toBeGreaterThan(0)})
 it('ogni attesa nomina piatti che esistono nella sua fixture',()=>{
  for(const c of CONVERSATIONS){const names=new Set(dishNames(c.menu));expect(FIXTURES[c.menu],c.id).toBeTruthy();initialMenu(c.menu,c.mods)
   for(const ch of [...c.changes,...(c.alt??[]).flat(),...(c.interim??[])])if(ch.op!=='create')expect(names.has(ch.dish),`${c.id}: ${ch.dish}`).toBe(true)
   for(const t of c.turns)if('dash' in t)expect(names.has(t.dash.dish),c.id).toBe(true)}})
 it('copre i 4 casi del QA 17/10 e il vocale di Manuel',()=>{
  const src=CONVERSATIONS.map(c=>c.source??'').join('\n');for(const k of ['QA 17/10 caso 1','QA 17/10 caso 2','QA 17/10 caso 3','QA 17/10 caso 4','Manuel 17/10'])expect(src).toContain(k)
  expect(CONVERSATIONS.some(c=>c.turns.some(t=>'voice' in t&&t.voice.includes('tojibo')))).toBe(true)})
})

describe('banco E: giudice deterministico',()=>{
 it('stato atteso esatto → successo',()=>{const m1=edit(m0,'Carbonara',i=>i.price=13),m2=edit(m1,'Gricia',i=>i.price=13)
  const v=judge(conv({changes:[{op:'price',dish:'Carbonara',price:13},{op:'price',dish:'Gricia',price:13}]}),m0,run([['*Confermato.* Ho aggiornato il menu.\n*Carbonara*: prezzo da 12,00 € a *13,00 €*',m1],['*Confermato.*\n*Gricia*: prezzo da 11,00 € a *13,00 €*',m2]]))
  expect(v.fails).toEqual([]);expect(v.success).toBe(true)})
 it('modifica non richiesta e valore sbagliato → GRAVE',()=>{const m1=edit(edit(m0,'Carbonara',i=>i.price=14),'Tiramisù',i=>i.hidden=true)
  const v=judge(conv({turns:[{text:'a'}],changes:[{op:'price',dish:'Carbonara',price:13}]}),m0,run([['ok',m1]]))
  expect(v.fails.map(f=>f.code).sort()).toEqual(['modifica-non-richiesta','modifica-sbagliata','non-applicato'].sort());expect(v.success).toBe(false)})
 it('scrittura su domanda → GRAVE anche se poi lo stato torna uguale',()=>{const m1=edit(m0,'Carbonara',i=>i.price=13)
  const v=judge(conv({turns:[{text:'la carbonara costa 13?',q:true},{text:'annulla'}]}),m0,run([['Fatto',m1],['Annullato',m0]]))
  expect(v.fails.some(f=>f.code==='scrittura-su-domanda'&&f.sev==='GRAVE')).toBe(true)})
 it('«fatto» senza scrittura → GRAVE; risposta incoerente con lo stato → GRAVE',()=>{
  const v=judge(conv({turns:[{text:'a'}]}),m0,run([['*Confermato.* Ho aggiornato il menu.',m0]]));expect(v.fails.map(f=>f.code)).toContain('fatto-falso')
  const m1=edit(m0,'Carbonara',i=>i.price=13),w=judge(conv({turns:[{text:'a'}],changes:[{op:'price',dish:'Carbonara',price:13}]}),m0,run([['*Confermato.*\n*Carbonara*: prezzo da 12,00 € a *14,00 €*',m1]]));expect(w.fails.map(f=>f.code)).toContain('risposta-incoerente')})
 it('richiesta mancata: domanda → MEDIO, «non trovo» → GRAVE, riepilogo → MEDIO',()=>{const c=conv({turns:[{text:'a'}],changes:[{op:'price',dish:'Carbonara',price:13}]})
  expect(judge(c,m0,run([['Quale piatto intendi?',m0]])).fails.map(f=>f.sev)).toEqual(['MEDIO'])
  expect(judge(c,m0,run([['*Non trovo il piatto.* Scrivi il nome come appare nel menu.',m0]])).fails.map(f=>f.code)).toEqual(['richiesta-persa'])
  expect(judge(c,m0,run([['Ecco le modifiche. Scrivi *OK* per confermare.',m0]])).fails.map(f=>f.code)).toEqual(['in-attesa-ok'])})
 it('chiarimento atteso: mancante → MEDIO; scrive invece di chiedere → GRAVE',()=>{const m1=edit(m0,'Supplì classico',i=>i.price=3)
  expect(judge(conv({turns:[{text:'a'}],ask:[1]}),m0,run([['Ok.',m0]])).fails.map(f=>f.code)).toEqual(['chiarimento-mancante'])
  expect(judge(conv({turns:[{text:'a'}],ask:[1]}),m0,run([['*Confermato.*',m1]])).fails.map(f=>f.code)).toContain('scrive-invece-di-chiedere')})
 it('«sì la seconda» segue le opzioni mostrate dal bot',()=>{expect(optionsIn('Quale piatto intendi?\n1. Supplì classico\n2. Supplì cacio e pepe',m0)).toEqual(['Supplì classico','Supplì cacio e pepe'])
  expect(optionsIn('Quale piatto intendi: Supplì cacio e pepe, Supplì classico?',m0)).toEqual(['Supplì cacio e pepe','Supplì classico'])
  const m1=edit(m0,'Supplì cacio e pepe',i=>i.price=3.5),c=conv({ask:[1],pick:{turn:1,pick:2,make:d=>({op:'price',dish:d,price:3.5})}})
  expect(judge(c,m0,run([['Quale piatto intendi?\n1. Supplì classico\n2. Supplì cacio e pepe',m0],['*Confermato.*',m1]])).success).toBe(true)
  expect(judge(c,m0,run([['Quale piatto intendi?\n1. Supplì cacio e pepe\n2. Supplì classico',m0],['*Confermato.*',m1]])).success).toBe(false)})
 it('alternative accettate e diff stabile',()=>{const m1=edit(m0,'Gricia',i=>i.hidden=true)
  expect(diff(m0,m1)).toEqual(['hidden|Gricia|true'])
  expect(judge(conv({turns:[{text:'a'}],changes:[{op:'available',dish:'Gricia',value:false}],alt:[[{op:'hidden',dish:'Gricia',value:true}]]}),m0,run([['*Confermato.* Gricia nascosta',m1]])).success).toBe(true)})
})
