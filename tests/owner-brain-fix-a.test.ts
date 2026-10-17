// Correzioni di fase A (17/10/2026, docs/webapp/bot-correzioni-2026-10-17): le regole pure nuove, una per una.
// Le batterie di conversazioni sono in tests/eval/eval-fix-a.test.ts; qui i casi limite delle singole funzioni.
import {describe,expect,it} from 'vitest'
import {spokenCents} from '../apps/server/src/lib/twilio-menu-nlu.js'
import {g9Prices,withoutQuantities,type MenuRef} from '../apps/server/src/lib/twilio-menu-ai.js'
import {deixisReferents,polarityProblem,priceClauseProblem} from '../apps/server/src/lib/owner-brain-plan.js'
import {splitPair,answerPrices} from '../apps/server/src/lib/twilio-menu-create.js'

const R=(id:string,name:string,price=10):MenuRef=>({id,name,price,available:true,hidden:false,menu:'Menu',section:'Piatti di prova'})
const refs=[R('p','la parmigiana',10),R('t','tiramisù',6),R('b','boh',20),R('r','pasta al ragù',12),R('c','Spaghetti alla carbonara',12),R('l','Lasagna al forno',11)]

describe('A2.1 centesimi solo espliciti',()=>{
 it.each([
  ['10 euro e uno a 20','10 euro e uno a 20'],['Uno deve essere a 10 euro e uno deve essere a 20 euro.','Uno deve essere a 10 euro e uno deve essere a 20 euro.'],
  ['aggiungi lasagna a 20 euro e uno','aggiungi lasagna a 20 euro e uno'],['tredici euro e cinquanta','13,50 euro'],['10 euro e 50','10,50 euro'],
  ['dieci euro e cinquanta centesimi','10,50 euro'],['la parmigiana costa 12 e 50','la parmigiana costa 12,50 euro'],['boh costa dieci e venti','boh costa 10,20 euro'],
  ['metti la parmigiana e il tiramisù a 10 e 20 euro','metti la parmigiana e il tiramisù a 10 e 20 euro'],['la parmigiana a 12 e il tiramisù a 7','la parmigiana a 12 e il tiramisù a 7'],
  ['aggiungi pasta al pesto e lasagna a 10 e 20','aggiungi pasta al pesto e lasagna a 10 e 20'],['10 euro e 5','10 euro e 5'],
 ])('%s',(t,want)=>{expect(spokenCents(t)).toBe(want)})
})

describe('A2.2 quantità e rimandi non sono prezzi',()=>{
 it.each([
  ['cambia i prezzi di quei due prodotti e mettili entrambi a 15 euro',2],['nascondi tutti e tre',3],['mettili tutti e due a 9',2],
  ['aggiungi il caviale a 150 in una categoria nuova',1],['uno a 10 e uno a 20',1],['le due pizze a 8',2],['quei due mettili a 10 e 20',2],
 ])('%s: mai %d',(t,n)=>{expect(g9Prices(t)).not.toContain(n)})
 it('restano i numeri con un segnale di prezzo',()=>{
  expect(g9Prices('il caffè a uno e venti')).toContain(1.2);expect(g9Prices('costa uno')).toContain(1);expect(g9Prices('la gricia a uno in meno')).toContain(1)
  expect(g9Prices('mettili tutti e due a 9')).toContain(9);expect(g9Prices('due euro')).toContain(2);expect(withoutQuantities('metti la carbonara a 12')).toBe('metti la carbonara a 12')
 })
})

describe('rimandi a più piatti o per posizione',()=>{
 const one=(m:string,owners:string[])=>deixisReferents(m,owners,refs)
 it('«quei due», «entrambi», «tutti e tre», «tutti tranne»',()=>{
  expect(one('nascondi quei due piatti',['la parmigiana a 15 e il tiramisù a 15'])).toEqual({kind:'set',ids:['p','t']})
  expect(one('nascondi entrambi',['la parmigiana costa 12','il tiramisù costa 7'])).toEqual({kind:'set',ids:['p','t']})
  expect(one('nascondi tutti e tre',['la parmigiana costa 12','il tiramisù costa 7','boh costa 25'])).toEqual({kind:'set',ids:['p','t','b']})
  expect(one('Ok, cambia i prezzi di quei due prodotti',['Aggiungi la parmigiana a 10 euro, il tiramisù a 6 euro e togli bo.'])?.ids).toEqual(['p','t'])
  expect(one("togli l'evidenza a tutti tranne boh",['metti in evidenza la parmigiana, il tiramisù e boh'])).toEqual({kind:'set',ids:['p','t']})
  expect(one('nascondi tutti e tre',['la parmigiana costa 12'])).toEqual({kind:'set',ids:[]})
 })
 it('«il primo», «l\'ultimo»',()=>{
  expect(one('il primo mettilo a 11',['la parmigiana costa 12','il tiramisù costa 7'])).toEqual({kind:'one',ids:['p']})
  expect(one("l'ultimo nascondilo",['la parmigiana costa 12','il tiramisù costa 7'])).toEqual({kind:'one',ids:['t']})
  expect(one('mettila a 13',['la parmigiana costa 12'])).toBeNull()
 })
})

describe('verso del valore e prezzo sul piatto giusto',()=>{
 it('«togli l\'evidenza» non mette in evidenza; «è finito» non rende disponibile',()=>{
  expect(polarityProblem([{kind:'featured',id:'p',value:true}],"togli l evidenza a tutti tranne boh")).toEqual(['p'])
  expect(polarityProblem([{kind:'featured',id:'p',value:false}],"togli l evidenza a tutti tranne boh")).toEqual([])
  expect(polarityProblem([{kind:'available',id:'p',value:true}],'la parmigiana e finita')).toEqual(['p'])
  expect(polarityProblem([{kind:'hidden',id:'p',value:false}],'nascondi la parmigiana')).toEqual(['p'])
  expect(polarityProblem([{kind:'hidden',id:'p',value:false}],'nascondi boh e rimetti la parmigiana')).toEqual([])
 })
 it('prezzi scambiati tra i piatti → problema; correzioni e prezzi senza piatto → nessun controllo',()=>{
  expect(priceClauseProblem([{kind:'price',id:'c',price:12},{kind:'price',id:'l',price:13}],'carbonara 13, lasagna 12',refs).sort()).toEqual(['c','l'])
  expect(priceClauseProblem([{kind:'price',id:'c',price:13},{kind:'price',id:'l',price:12}],'carbonara 13, lasagna 12',refs)).toEqual([])
  expect(priceClauseProblem([{kind:'price',id:'p',price:13}],'la parmigiana a 12, anzi no a 13',refs)).toEqual([])
  expect(priceClauseProblem([{kind:'price',id:'p',price:10},{kind:'price',id:'t',price:20}],'metti la parmigiana e il tiramisù a 10 e 20 euro',refs)).toEqual([])
  expect(priceClauseProblem([{kind:'price',id:'p',price:12},{kind:'price',id:'t',price:7}],'la parmigiana a 7 e il tiramisù a 12',refs).sort()).toEqual(['p','t'])
 })
})

describe('A1 «X e Y» e risposte con più prezzi',()=>{
 it.each([['Pasta al pesto e lasagna',['Pasta al pesto','Lasagna']],['Trofie al pesto e la lasagna',['Trofie al pesto','Lasagna']],['Pasta e fagioli',null],['Spaghetti cacio e pepe',null],
  ['Pane e coperto',null],['Pasta e fagioli alla napoletana',null],['Gnocchi e polpette',['Gnocchi','Polpette']],['Risotto ai funghi e arrosto di vitello',['Risotto ai funghi','Arrosto di vitello']],['Lasagna e uno',null]] as [string,string[]|null][])('%s',(n,want)=>{expect(splitPair(n)).toEqual(want)})
 it('prezzi per nome, ordinale o in ordine',()=>{
  const names=['Pasta al pesto','Lasagna']
  expect(answerPrices('uno a 10 e uno a 20',names)).toEqual([{value:10,idx:null},{value:20,idx:null}])
  expect(answerPrices('la prima 10 la seconda 20',names)).toEqual([{value:10,idx:0},{value:20,idx:1}])
  expect(answerPrices('lasagna 20 e pesto 10',names)).toEqual([{value:20,idx:1},{value:10,idx:0}])
  expect(answerPrices('No, sono due piatti separati.',names)).toEqual([])
 })
})

import {phoneticHits,phoneticCandidates,phoneKey} from '../apps/server/src/lib/twilio-menu-phonetic.js'
describe('A5 nomi storpiati (solo verso piatti del menu, con soglia)',()=>{
 const qa=['Piatto di verifica','Che ne sacc','boh','pasta al ragù','la parmigiana','tiramisù'].map((n,i)=>R('q'+i,n))
 it('suono forte → piatto; debole → solo ipotesi',()=>{
  expect(phoneKey('kenesac')).toBe(phoneKey('che ne sacc'))
  expect(phoneticHits('nel kenesac metti la promo a 12 euro',qa).strong).toEqual(['q1'])
  expect(phoneticHits('che nesac costa 16',qa).strong).toEqual(['q1'])
  expect(phoneticHits('Bu costa 40 euro',qa)).toMatchObject({strong:[],weak:['q2']})
  expect(phoneticHits('nel piatto Bo cambia la descrizione',qa).strong).toEqual(['q2'])
  expect(phoneticCandidates('kenesac',qa).map(r=>r.name)).toEqual(['Che ne sacc'])
 })
 it('nessun falso abbinamento: parole di servizio, nomi parziali, parole fuori menu',()=>{
  const mario=['Bruschetta al pomodoro','Spaghetti alla carbonara','Lasagna al forno','Cotoletta alla milanese','Margherita','Diavola','Tiramisù','Caffè','Cappuccino','Coca Cola 33cl','Birra media','Nuovo burger','Frittatina di pasta','Frittatina di patate'].map((n,i)=>R('m'+i,n))
  for(const t of ['no scusa 7','la costata è finita','metti la costa a 12','il burger vegano costa 12','la frittatina costa 3,50','la lasagna verde costa 12'])expect(phoneticHits(t,mario).strong,t).toEqual([])
  expect(phoneticHits('la margarita a 8',mario).strong).toEqual(['m4'])
  expect(phoneticHits('il capuccino costa 2',mario).strong).toEqual(['m8'])
  expect(phoneticCandidates('mojito',mario)).toEqual([])
 })
})
