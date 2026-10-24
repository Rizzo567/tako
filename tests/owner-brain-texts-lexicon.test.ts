// V5 (run Haiku 21/10/2026): nessun testo verso il titolare contiene «categori» o emoji.
// Lessico fisso Menu / Sottomenu / Sezione / Piatti (PIANO §1.6). Il titolare può dire «categoria»: il modello lo capisce
// come sottomenu, ma il bot non lo dice mai.
// - twilio-menu-copy.ts: si importano i valori esportati (stringhe, oggetti, array; per le funzioni-modello si leggono i
//   letterali del loro sorgente) → nessuna copia delle stringhe qui.
// - owner-brain-*.ts: letterali stringa/template del sorgente (AST TypeScript, commenti esclusi). «categori» si controlla solo
//   sui letterali che sono frasi (contengono uno spazio): parole singole come chiavi o sinonimi d'ingresso non sono risposte.
//   Emoji: su tutti i letterali.
// - owner-brain-context.ts (prompt al modello): unica eccezione ammessa, la riga che spiega che «categoria» detta dal titolare
//   = sottomenu (la stessa riga deve contenere anche «sottomenu»).
import {describe,it,expect} from 'vitest'
import {readFileSync,readdirSync} from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import * as copyModule from '../apps/server/src/lib/twilio-menu-copy.js'

const LIB=path.resolve(__dirname,'../apps/server/src/lib')
const CATEGORY=/categori/i
const EMOJI=/\p{Extended_Pictographic}/u
// Esportazioni che non sono testi verso il titolare (parole d'ingresso riconosciute, non risposte).
const INPUT_ONLY=new Set(['helpWords'])
// Benvenuto del 19/10 (a7b19f4, v119 online, testo approvato da Manuel): le sue emoji sono una scelta di copy, non del cervello.
// Escluso SOLO dal controllo emoji (implementation-notes); «categori» resta vietato anche lì.
const EMOJI_OK=new Set(['copy.welcome'])

/** Letterali stringa e pezzi di template di un sorgente TS/JS (commenti esclusi). */
function literalsOf(source:string,file='x.ts'):string[]{
 const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS)
 const out:string[]=[]
 const visit=(node:ts.Node)=>{
  if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))out.push(node.text)
  else if(ts.isTemplateHead(node)||ts.isTemplateMiddle(node)||ts.isTemplateTail(node))out.push(node.text)
  ts.forEachChild(node,visit)
 }
 visit(sf)
 return out
}

/** Tutti i testi raggiungibili da un valore esportato. */
function textsOf(value:unknown,where:string,out:{where:string,text:string}[]=[],seen=new Set<unknown>()):{where:string,text:string}[]{
 if(typeof value==='string')out.push({where,text:value})
 else if(typeof value==='function')for(const text of literalsOf(`(${value.toString()})`,'fn.js'))out.push({where:where+'()',text})
 else if(value&&typeof value==='object'&&!seen.has(value)){
  seen.add(value)
  for(const [key,v] of Object.entries(value))if(key!=='id')textsOf(v,`${where}.${key}`,out,seen) // id = identificatore interno, non testo
 }
 return out
}

type Hit={where:string,text:string,why:string}
const short=(s:string)=>s.length>140?s.slice(0,140)+'…':s
function check(entries:{where:string,text:string}[],opts:{sentencesOnly?:boolean,allowCategoryLine?:boolean}={}):Hit[]{
 const hits:Hit[]=[]
 for(const {where,text} of entries){
  if(EMOJI.test(text)&&!EMOJI_OK.has(where))hits.push({where,text:short(text),why:'emoji'})
  if(opts.sentencesOnly&&!/\s/.test(text.trim()))continue
  for(const line of text.split('\n')){
   if(!CATEGORY.test(line))continue
   if(opts.allowCategoryLine&&/sottomenu/i.test(line))continue
   hits.push({where,text:short(line.trim()),why:'categori'})
  }
 }
 return hits
}
const report=(hits:Hit[])=>hits.map(h=>`[${h.why}] ${h.where}: ${h.text}`).join('\n')

describe('V5 lessico dei testi verso il titolare',()=>{
 it('twilio-menu-copy: nessun «categori», nessuna emoji',()=>{
  const entries=Object.entries(copyModule).filter(([name])=>!INPUT_ONLY.has(name)).flatMap(([name,value])=>textsOf(value,name))
  expect(entries.length).toBeGreaterThan(50) // il modulo è stato davvero letto
  const hits=check(entries)
  expect(hits,report(hits)).toEqual([])
 })

 const brainFiles=readdirSync(LIB).filter(f=>/^owner-brain-.*\.ts$/.test(f)&&f!=='owner-brain-context.ts').sort()
 it.each(brainFiles)('%s: letterali di risposta senza «categori» né emoji',file=>{
  const entries=literalsOf(readFileSync(path.join(LIB,file),'utf8'),file).map(text=>({where:file,text}))
  const hits=check(entries,{sentencesOnly:true})
  expect(hits,report(hits)).toEqual([])
 })

 it('owner-brain-context (prompt): «categori» solo nella riga che la mappa a sottomenu, nessuna emoji',()=>{
  const file='owner-brain-context.ts'
  const entries=literalsOf(readFileSync(path.join(LIB,file),'utf8'),file).map(text=>({where:file,text}))
  expect(entries.length).toBeGreaterThan(10)
  const hits=check(entries,{sentencesOnly:true,allowCategoryLine:true})
  expect(hits,report(hits)).toEqual([])
 })

 it('il controllo riconosce davvero i casi vietati (autoverifica)',()=>{
  expect(check([{where:'t',text:'Scegli la categoria'}]).length).toBe(1)
  expect(check([{where:'t',text:'Fatto 👍'}]).length).toBe(1)
  expect(check([{where:'t',text:'Se il titolare dice «categoria» intende un sottomenu'}],{allowCategoryLine:true}).length).toBe(0)
  expect(check([{where:'t',text:'*Pizze* è nel sottomenu Primi'}]).length).toBe(0)
  expect(literalsOf('const a="uno" // categoria\nconst b=`due ${a} tre`')).toEqual(['uno','due ',' tre'])
 })
})
