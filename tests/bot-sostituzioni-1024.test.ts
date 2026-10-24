// Chat vera di Manuel 24/10 18:09 (Victoria, edge v187): «menu mezzogirno togli lasagna metti rigatoni» → «intendi *Lasagna*? Rispondi sì»
// su un nome esatto e unico; «si» → «Non ho cambiato nulla»; «metti rigatoni» perso. Qui la regola della sostituzione in una frase
// (owner-brain-svuota.ts swapTurn) letta pura sul menu di Victoria delle 18:11 (docs/webapp/bot-sostituzioni-2026-10-24/fixture-now.json).
import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {ruleTurn,ruleReply,swapTurn,fixMealWords,menusIn,type RuleMenu} from '../apps/server/src/lib/owner-brain-svuota.js'
import {wantsCreate} from '../apps/server/src/lib/twilio-menu-ai.js'
import {spelledAlike} from '../apps/server/src/lib/twilio-menu-phonetic.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {catalogOf} from '../apps/server/src/lib/owner-brain-eval.js'

const load=(f:string)=>{const W=workspaceSchema.parse(JSON.parse(readFileSync(new URL('../docs/webapp/bot-sostituzioni-2026-10-24/'+f,import.meta.url),'utf8'))),CAT=catalogOf(W)
 const menus:RuleMenu[]=(W.menus as any[]).map(m=>({id:m.id,name:m.name,pricing:m.pricing==='fisso'?'fisso':'carta',formulas:(m.formulas??[]).map((f:any)=>({id:f.id,name:f.name,price:Number(f.price)}))}))
 return{menus,sections:CAT.sections,refs:CAT.refs}}
const NOW=load('fixture-now.json'),BASE=load('fixture-base.json')
const run=(text:string,c=NOW,history:any[]=[])=>ruleTurn({text,...c,history})
const effect=(r:any,c=NOW)=>{if(!r||r.kind!=='apply')return null;const del=r.actions.filter((a:any)=>a.kind==='delete').map((a:any)=>c.refs.find(x=>x.id===a.id)!.menu+'›'+c.refs.find(x=>x.id===a.id)!.name),add=r.actions.filter((a:any)=>a.kind==='create').map((a:any)=>c.sections.find(s=>s.id===a.sectionId)!.menu+'›'+c.sections.find(s=>s.id===a.sectionId)!.name+'›'+a.name);return{del,add}}

describe('sostituzione in una frase (chat Manuel 18:09)',()=>{
 it('il caso esatto: Lasagna eliminata, Rigatoni nei Primi del Menu Giorno, nessuna domanda',()=>{
  const r=run('menu mezzogirno togli lasagna metti rigatoni')
  expect(effect(r)).toEqual({del:['Menu Giorno›Lasagna'],add:['Menu Giorno›Primi›Rigatoni']})
  const txt=ruleReply((r as any).report,NOW.refs.filter(x=>x.menu==='Menu Giorno'),(r as any).actions,true)
  expect(txt).toContain('*Menu Giorno aggiornato*');expect(txt).toContain('Rigatoni (nuovo)');expect(txt).toContain('Tolto: *Lasagna*');expect(txt).not.toMatch(/\?/)})
 const cases:[string,string[],string[]][]=[
  ['togli la lasagna e metti i rigatoni',['Menu Giorno›Lasagna'],['Menu Giorno›Primi›Rigatoni']],
  ['al posto della lasagna metti rigatoni al ragù',['Menu Giorno›Lasagna'],['Menu Giorno›Primi›Rigatoni al ragù']],
  ['a pranzo al posto di lasagna rigatoni',['Menu Giorno›Lasagna'],['Menu Giorno›Primi›Rigatoni']],
  ['cambia la lasagna con le tagliatelle al ragù',['Menu Giorno›Lasagna'],['Menu Giorno›Primi›Tagliatelle al ragù']],
  ['sostituisci orecchiette con zucca con gnocchi al pomodoro',['Menu Giorno›Orecchiette con zucca'],['Menu Giorno›Primi›Gnocchi al pomodoro']],
  ['invece della lasagna fai gnocchi al pomodoro',['Menu Giorno›Lasagna'],['Menu Giorno›Primi›Gnocchi al pomodoro']],
  ['lasagna no metti rigatoni',['Menu Giorno›Lasagna'],['Menu Giorno›Primi›Rigatoni']],
  ['x pranzo via la cotoletta metti polpette',['Menu Giorno›Cotoletta'],['Menu Giorno›Secondi›Polpette']],
  ['Menù mezzogiorno da 12 euro togli lasagna e al suo posto metti rigatoni',['Menu Giorno›Lasagna'],['Menu Giorno›Primi›Rigatoni']],
  ['pranzzo togli strozzapreti metti pasta e fagioli',['Menu Giorno›Strozzapreti con zola e pistacchio'],['Menu Giorno›Primi›Pasta e fagioli']],
  ['da 12 togli spinaci metti insalata',['Menu Giorno›Spinaci'],['Menu Giorno›Contorni›Insalata']],
  ['stasera togli pollo al forno metti salsiccia alla griglia',['Menu Cena›pollo al forno'],['Menu Cena›Secondi›Salsiccia alla griglia']],
  ['menu giorno togli lasagna e orecchiette metti rigatoni e gnocchi',['Menu Giorno›Lasagna','Menu Giorno›Orecchiette con zucca'],['Menu Giorno›Primi›Rigatoni','Menu Giorno›Primi›Gnocchi']],
  ['togli la lasagnia metti i rigatoni',['Menu Giorno›Lasagna'],['Menu Giorno›Primi›Rigatoni']],
  ['togli la coteletta metti le polpette',['Menu Giorno›Cotoletta'],['Menu Giorno›Secondi›Polpette']],
  ['x pranzo togli cotoletta metti polpette  contorni togli spinaci metti fagiolini',['Menu Giorno›Cotoletta','Menu Giorno›Spinaci'],['Menu Giorno›Secondi›Polpette','Menu Giorno›Contorni›Fagiolini']]]
 for(const [t,del,add] of cases)it(t,()=>{const e=effect(run(t));expect(e?.del.sort()).toEqual([...del].sort());expect(e?.add.map(x=>x.toLowerCase()).sort()).toEqual(add.map(x=>x.toLowerCase()).sort())})
 it('omonimi (Pasta al pesto nel Menu Giorno e alla carta): il Menu detto decide; senza Menu il Menu a prezzo fisso; alla carta mai',()=>{
  expect(effect(run('nel menu giorno togli pasta al pesto metti pasta al ragù',BASE),BASE)).toEqual({del:['Menu Giorno›Pasta al pesto'],add:['Menu Giorno›Primi›Pasta al ragù']})
  expect(effect(run('togli la pasta al pesto metti trofie al pesto',BASE),BASE)?.del).toEqual(['Menu Giorno›Pasta al pesto'])})
 it('non sono sostituzioni: negazioni, domande, prezzi, «tutti»',()=>{
  for(const t of ['non togliere la lasagna metti rigatoni','togli la lasagna?','togli tutti i primi e metti rigatoni','togli il tiramisù metti la panna cotta','togli la lasagna metti 5 euro'])expect(swapTurn({text:t,...NOW,history:[]} as any),t).toBeNull()})
 it('«togli X e metti Y» non letto come sostituzione non inserisce mai Y perdendo «togli X»',()=>{
  const r=run('nel menu giorno togli il tiramisù e metti rigatoni');expect(r===null||r.kind!=='apply'||!(r as any).actions.some((a:any)=>a.kind==='create')).toBe(true)})
 it('refusi delle parole del pasto',()=>{
  expect(fixMealWords('menu mezzogirno togli')).toBe('menu mezzogiorno togli');expect(fixMealWords('pranzzo togli')).toBe('pranzo togli');expect(fixMealWords('il prezzo')).toBe('il prezzo')
  expect(menusIn('da 12 togli lasagna',NOW.menus).map(m=>m.name)).toEqual(['Menu Giorno']);expect(menusIn('stassera togli',NOW.menus).map(m=>m.name)).toEqual(['Menu Cena'])})
 it('il validatore accetta la creazione dentro una sostituzione (piano del modello)',()=>{
  expect(wantsCreate('menu mezzogirno togli lasagna metti rigatoni')).toBe(true);expect(wantsCreate('la lasagna è finita')).toBe(false)})
 it('a suono solo nomi che somigliano anche nelle lettere (tiramisù → mai «Pirata»)',()=>{
  expect(spelledAlike('porta il tiramisu a 6 euro','Pirata')).toBe(false);expect(spelledAlike('la ghisa a dodici','Gricia')).toBe(true);expect(spelledAlike('la birra a sei e cinque','Birra 33 cl')).toBe(true)})
})
