import {describe,it,expect} from 'vitest'
import {createStep,parseCreate,startsWithCreate,type CreateDraft} from '../apps/server/src/lib/twilio-menu-create.js'
import {parseIntent} from '../apps/server/src/lib/twilio-menu-nlu.js'
const sections=[{id:'s1',name:'Primi',menu:'Cena'},{id:'s2',name:'Piatti di prova',menu:'Cena'},{id:'s3',name:'Dolci',menu:'Cena'}]
const refs=[{name:'Carbonara',sectionId:'s1'},{name:'Pasta e fagioli',sectionId:'s1'}]
const step=(t:string,d:CreateDraft|null=null)=>createStep(t,d,sections,refs,parseIntent)
const created=(t:string,d:CreateDraft|null=null)=>{const s=step(t,d);return s.kind==='create'?s.action:s}

describe('bot titolare: aggiunta di un piatto senza IA',()=>{
 it('il vocale reale è un\'aggiunta completa, mai un cambio prezzo',()=>{
  expect(created('aggiungi tra piatti di prova il piatto pasta al ragù che costa 12 euro')).toEqual({kind:'create',sectionId:'s2',name:'Pasta al ragù',price:12,description:null})
  expect(created('Aggiungi tra Piatti di Prova il piatto pasta al ragù che costa 12 euro.')).toMatchObject({sectionId:'s2',name:'Pasta al ragù',price:12})
 })
 it('varianti: categoria in coda, prezzo in lettere, «nuovo piatto:», «nella categoria», €',()=>{
  expect(created('aggiungi pasta al ragù 12 euro nei primi')).toMatchObject({sectionId:'s1',name:'Pasta al ragù',price:12})
  expect(created('aggiungi nei piatti di prova pasta al ragù a dodici euro')).toMatchObject({sectionId:'s2',name:'Pasta al ragù',price:12})
  expect(created('aggiungiamo nella categoria dolci la panna cotta a 5,50€')).toMatchObject({sectionId:'s3',name:'Panna cotta',price:5.5})
  expect(created('inserisci tra i dolci un tiramisù, 6 euro')).toMatchObject({sectionId:'s3',name:'Tiramisù',price:6})
  expect(created('metti un nuovo piatto nei primi: gnocchi al pesto 11 euro')).toMatchObject({sectionId:'s1',name:'Gnocchi al pesto',price:11})
 })
 it('«nuovo piatto: tiramisù 6 euro» senza categoria con più categorie: chiede in quale, poi completa',()=>{
  const s=step('nuovo piatto: tiramisù 6 euro');expect(s.kind).toBe('ask');if(s.kind!=='ask')return
  expect(s.text).toContain('In quale categoria');expect(s.text).toContain('Piatti di prova');expect(s.draft).toMatchObject({name:'Tiramisù',price:6,sectionId:null})
  expect(created('Dolci',s.draft)).toMatchObject({sectionId:'s3',name:'Tiramisù',price:6})
  expect(created('nei dolci',s.draft)).toMatchObject({sectionId:'s3'})
 })
 it('conversazione reale: «aggiungiamo un piatto» → domanda; il vocale completo dopo è la risposta',()=>{
  const first=step('aggiungiamo un piatto');expect(first.kind).toBe('ask');if(first.kind!=='ask')return
  expect(first.draft).toEqual({kind:'create_draft',name:null,price:null,sectionId:null})
  expect(created('aggiungi tra piatti di prova il piatto pasta al ragù che costa 12 euro',first.draft)).toMatchObject({sectionId:'s2',name:'Pasta al ragù',price:12})
  // anche senza verbo: «… che costa 12 euro» sarebbe un cambio prezzo, ma c'è la domanda in attesa
  expect(created('tra piatti di prova il piatto pasta al ragù che costa 12 euro',first.draft)).toMatchObject({sectionId:'s2',name:'Pasta al ragù',price:12})
 })
 it('domande nell\'ordine: categoria, prezzo, nome',()=>{
  const p=step('aggiungi pasta al ragù nei primi');expect(p.kind==='ask'&&p.text).toContain('Quanto costa *Pasta al ragù*');if(p.kind!=='ask')return
  expect(created('12 euro',p.draft)).toMatchObject({name:'Pasta al ragù',price:12,sectionId:'s1'})
  const n=step('aggiungi nei primi a 12 euro');expect(n.kind==='ask'&&n.text).toContain('Come si chiama');if(n.kind!=='ask')return
  expect(created('pasta al ragù',n.draft)).toMatchObject({name:'Pasta al ragù',price:12})
  const one=createStep('aggiungi pasta al ragù 12 euro',null,[sections[0]!],refs,parseIntent);expect(one).toMatchObject({kind:'create',action:{sectionId:'s1'}})
  // 17/10 (A3.2): la categoria che non c'è è detta per nome e il nome del piatto resta (prima si perdeva).
  const unknown=step('aggiungi tra i secondi la tagliata 18 euro');expect(unknown.kind==='ask'&&unknown.text).toContain("Nel menu non c'è la categoria *Secondi*");expect(unknown.kind==='ask'&&unknown.draft).toMatchObject({name:'Tagliata',price:18,sectionId:null,sectionName:'Secondi'})
 })
 it('«piatto di …» è parte del nome (bug visto dal vivo: «aggiungi piatto di verifica 12 euro» → «Verifica»)',()=>{
  expect(created('aggiungi piatto di verifica 12 euro nei primi')).toMatchObject({name:'Piatto di verifica',price:12})
  expect(created('aggiungi il piatto piatto della casa 9 euro nei primi')).toMatchObject({name:'Piatto della casa'})
  expect(created('aggiungi nei primi un piatto chiamato pasta e ceci 10 euro')).toMatchObject({name:'Pasta e ceci',price:10})
 })
 it('piatto già presente: lo dice, non lo duplica',()=>{expect(step('aggiungi carbonara 12 euro nei primi')).toMatchObject({kind:'exists',name:'Carbonara',section:'Primi'})})
 it('regressione: senza verbo e senza domanda in attesa resta il flusso di prima',()=>{
  for(const t of ['carbonara 12','la carbonara è finita','prezzo Pasta e fagioli a 9','carbonara costa 13 euro']){expect(startsWithCreate(t)).toBe(false);expect(step(t)).toEqual({kind:'none'})}
  expect(parseIntent('la carbonara è finita')).toMatchObject({kind:'available',value:false})
  expect(parseIntent('prezzo Pasta e fagioli a 9')).toMatchObject({kind:'price',price:9})
  // con una domanda in attesa, un altro comando non è una risposta
  expect(step('la carbonara è finita',{kind:'create_draft',name:null,price:null,sectionId:null})).toEqual({kind:'none'})
 })
 it('parseCreate tollera maiuscole e accenti nella categoria',()=>{expect(parseCreate('aggiungi tra PIATTI DI PRÒVA pasta 9 euro',sections)).toMatchObject({sectionId:'s2',name:'Pasta',price:9})})
})
