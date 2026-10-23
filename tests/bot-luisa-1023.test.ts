// Chat reale di Luisa (Victoria Bar, 23/10/2026 09:21–09:24): «Nel menù pranzo da 12 elimina i primi» → «a quale piatto?»; «Si» →
// di nuovo «Elimino…? Rispondi sì»; «E inserisci» arrivato mentre il «Si» era in lavorazione → domande doppie; elenco senza virgole;
// «Si» finale → «Non c’è niente da confermare». Risultato: NIENTE cambiato. Qui i 7 punti corretti, uno per blocco, e il REPLAY ESATTO
// della chat (stessi testi, «E inserisci» mentre il «Si» lavora) su una copia della struttura di Victoria (tests/fixtures/victoria-struttura-1023.json,
// solo nomi/prezzi/sottomenu/opzioni). Route vero, DB e modello finti (il modello finto non scrive mai da solo: ogni scrittura è del server).
import {afterAll,describe,expect,it,vi} from 'vitest'
import {readFileSync} from 'node:fs'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-23T07:20:00Z'))})
vi.mock('../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./eval/route-harness.js')).onboardingMock)
vi.mock('../packages/db/src/index.ts',async()=>(await import('./eval/route-harness.js')).dbMock)
vi.mock('../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./eval/route-harness.js')).storeMock)
import {closeHarness,createRouteBot,installNet} from './eval/route-harness.js'
import {brainSql,resetBrainTables} from './eval/adapters/new-bot.js'
import {createFakeHaiku,A,P,Q,code,type Planner,type FakeCtx} from './eval/fake-haiku.js'
import {menusIn,sectionClearParse,ruleTurn,parseInsert,insertForQuestion,type RuleMenu} from '../apps/server/src/lib/owner-brain-svuota.js'
import {ahead,waitTurn,releaseTurn,enqueueTurn,TURN_STALE_MS} from '../apps/server/src/lib/whatsapp-turn-queue.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {catalogOf} from '../apps/server/src/lib/owner-brain-eval.js'
import type {Conversation,EvalMenu,Turn} from './eval/types.js'

const realFetch=globalThis.fetch
afterAll(()=>closeHarness())
const plainT=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()

// ---------------- copia della struttura di Victoria ----------------
const STRUCT=JSON.parse(readFileSync(new URL('./fixtures/victoria-struttura-1023.json',import.meta.url),'utf8')) as any[]
let n=0;const id=(p:string)=>p+'-5555-4555-8555-'+String(++n).padStart(12,'0')
export function victoria():EvalMenu{n=0
 return{menus:STRUCT.map(m=>{const sections=m.sections.map((s:any)=>({id:id('7c000000'),name:s.name,items:s.items.map(([nm,price,h]:[string,number,boolean?])=>({id:id('5c000000'),name:nm,price,...(h?{hidden:true}:{})}))}))
  return{id:id('6c000000'),name:m.name,type:m.type,...(m.pricing==='fisso'?{pricing:'fisso',formulas:m.formulas.map((f:any)=>({id:id('5d000000'),name:f.name,price:f.price,note:f.note,sectionIds:f.secs.map((i:number)=>sections[i].id),translations:{}}))}:{}),sections}}) as any,design:{}}}
const W0=workspaceSchema.parse(victoria()),CAT=catalogOf(W0)
const MENUS:RuleMenu[]=(W0.menus as any[]).map(m=>({id:m.id,name:m.name,pricing:m.pricing==='fisso'?'fisso':'carta',formulas:(m.formulas??[]).map((f:any)=>({id:f.id,name:f.name,price:Number(f.price)}))}))
const M=(w:any,name:string)=>w.menus.find((m:any)=>m.name===name)
const secItems=(w:any,menu:string,sec:string)=>M(w,menu).sections.find((s:any)=>s.name===sec).items.filter((i:any)=>!i.hidden).map((i:any)=>i.name)
const allItems=(w:any)=>JSON.stringify(w.menus.map((m:any)=>[m.name,m.sections.map((s:any)=>[s.name,s.items.map((i:any)=>i.name+':'+i.price+(i.hidden?':h':''))])]))
const shape=(w:any)=>JSON.stringify(w.menus.map((m:any)=>({name:m.name,pricing:m.pricing??null,formulas:(m.formulas??[]).map((f:any)=>[f.name,f.price]),sections:m.sections.map((s:any)=>s.name)})))

// ---------------- route ----------------
const base:Planner=c=>{const m=plainT(c.message);if(/^(?:annulla|annulla l ultima)$/.test(m))return P('change',[A('undo_last')],'Ok, annullo.');return P('chat',[],'MODELLO')}
async function play(turns0:(Turn|string)[],planner:Planner=base,o:{slowMs?:number}={}){const turns=turns0.map(t=>typeof t==='string'?{text:t}:t) as Turn[]
 const fake=createFakeHaiku(planner),slow=o.slowMs?{...fake,handle:async(u:string,i:any)=>{await new Promise(r=>setTimeout(r,o.slowMs));return fake.handle(u,i)}}:fake
 installNet(null,realFetch,slow as any);resetBrainTables();process.env.ANTHROPIC_API_KEY='eval-anthropic-key'
 const c:Conversation={id:'luisa',family:'manuel',menu:'victoria',turns,changes:[]}
 const run=await createRouteBot({name:'haiku',settings:{botBrain:true,botEngine:'haiku'},extraSql:brainSql}).run(c,structuredClone(victoria()),{restaurant:'Victoria (copia)'})
 if(process.env.LUISA_DUMP)(await import('node:fs')).appendFileSync(process.env.LUISA_DUMP,'=== '+turns.map(t=>(t as any).text).join(' | ')+'\n'+run.turns.map((t,i)=>'#'+i+' '+t.reply).join('\n')+'\nPENDING '+JSON.stringify(run.pending??null).slice(0,400)+'\n\n')
 return{replies:run.turns.map(t=>t.reply.replace(/^Sono l.*?persona\.\s*/s,'')),menus:[workspaceSchema.parse(victoria()),...run.turns.map(t=>t.menuAfter as any)] as any[],pending:run.pending}}
const last=(r:{menus:any[]})=>r.menus[r.menus.length-1]
const GIORNO_PRIMI=['Pasta al pesto','linguine allo scoglio','Rigatoni al sugo']

// ======================= 1) «elimina i primi» = tutti i piatti del sottomenu =======================
describe('1) «primi/secondi/…» sono sottomenu: «elimina i primi» li elimina tutti',()=>{
 it('lettura pura',()=>{
  for(const t of ['elimina i primi','Eliminare tutti i primi','Nel menù pranzo elimina i primi','togli tutti i piatti dei primi','svuota i secondi','leva i contorni del menu cena'])expect(sectionClearParse(t,{menus:MENUS,sections:CAT.sections}),t).not.toBeNull()
  for(const t of ['togli la pasta al pesto dai primi','elimina il primo piatto','elimina i primi?','non togliere i primi','togli i primi tranne la pasta al pesto','i primi a 10 euro'])expect(sectionClearParse(t,{menus:MENUS,sections:CAT.sections}),t).toBeNull()})
 it('«Nel menù pranzo da 12 elimina i primi» → i 3 Primi del Menu Giorno eliminati SUBITO, il resto identico, «annulla» li rimette',async()=>{
  const r=await play(['Nel menù pranzo da 12 elimina i primi','annulla'])
  expect(secItems(r.menus[1],'Menu Giorno','Primi')).toEqual([])
  expect(r.replies[0]).not.toMatch(/a quale piatto/i);expect(r.replies[0]).toMatch(/Menu Giorno aggiornato/);expect(r.replies[0]).toMatch(/annulla/)
  for(const p of GIORNO_PRIMI)expect(r.replies[0]).toContain(p)
  const w0=r.menus[0],w1=r.menus[1];for(const m of ['Menu Cena','Alla carta','Drinks'])expect(JSON.stringify(M(w1,m))).toBe(JSON.stringify(M(w0,m)))
  expect(shape(w1)).toBe(shape(w0))
  expect(allItems(r.menus[2])).toBe(allItems(w0))})
 it('«elimina i primi» senza Menu → UNA domanda sul Menu; la risposta «Menù mezzogiorno da 12 euro» esegue',async()=>{
  const r=await play(['elimina i primi','Menù mezzogiorno da 12 euro'])
  expect(r.replies[0]).toMatch(/Menu Giorno/);expect(r.replies[0]).toMatch(/Menu Cena/);expect(allItems(r.menus[1])).toBe(allItems(r.menus[0]))
  expect(secItems(r.menus[2],'Menu Giorno','Primi')).toEqual([]);expect(secItems(r.menus[2],'Menu Cena','Primi').length).toBe(3)})
 it('Menu alla carta: svuotare un sottomenu chiede il «sì» (deciso dal server), il «sì» elimina',async()=>{
  const r=await play(['nel menu alla carta elimina i dolci','sì'])
  expect(r.replies[0]).toMatch(/Rispondi \*sì\*/);expect(secItems(r.menus[1],'Alla carta','Dolci').length).toBe(9)
  expect(secItems(r.menus[2],'Alla carta','Dolci')).toEqual([])})})

// ======================= 2) sinonimi del Menu e contesto =======================
describe('2) sinonimi del Menu (pranzo/mezzogiorno/da 12/del giorno, cena/sera/da 16,90) e contesto',()=>{
 it('menusIn',()=>{
  for(const t of ['menu pranzo','a pranzo','mezzogiorno','menu mezzogiorno','menu da 12','menu da 12 euro','Menù mezzogiorno da 12 euro','nel menu del giorno','menu giorno','pranzo da 12 €'])expect(menusIn(t,MENUS).map(m=>m.name),t).toEqual(['Menu Giorno'])
  expect((ruleTurn({text:'Menù mezzogiorno da 12 euro',menus:MENUS,sections:CAT.sections,refs:CAT.refs,history:[]}) as any)?.text).toMatch(/^Ok, il \*Menu Giorno\*/)
  for(const t of ['cena','stasera','la sera','menu da 16,90','menu cena','menu da 16,90 euro'])expect(menusIn(t,MENUS).map(m=>m.name),t).toEqual(['Menu Cena'])
  expect(menusIn('la carbonara da 12',MENUS)).toEqual([])})
 it('Menu detto prima nella conversazione: non si richiede',()=>{
  const r=ruleTurn({text:'elimina i secondi',menus:MENUS,sections:CAT.sections,refs:CAT.refs,history:[{role:'owner',text:'nel menu cena metti la tagliata',at:Date.now()-60000}]})
  expect(r?.kind).toBe('apply');expect((r as any).menu.name).toBe('Menu Cena')})})

// ======================= 3) messaggi accavallati: fila per numero =======================
describe('3) messaggi accavallati: un numero alla volta, nell’ordine d’arrivo',()=>{
 it('ahead(): biglietti prima del mio, scaduti a parte',()=>{const ph='whatsapp:+39000',now=1_800_000_000_000,k=(t:number,s:string)=>'turn:'+ph+':'+String(t).padStart(15,'0')+':'+s
  const r=ahead([k(now-1000,'A'),k(now-500,'B'),k(now-TURN_STALE_MS-1,'Z')],ph,'B',now);expect(r.mine).toBe(k(now-500,'B'));expect(r.before).toEqual([k(now-1000,'A')]);expect(r.stale).toEqual([k(now-TURN_STALE_MS-1,'Z')])})
 it('due lavori dello stesso numero non si sovrappongono mai (DB finto, 3 messaggi quasi insieme)',async()=>{
  const rows=new Map<string,string>();let seq=0
  const ex={execute:async(q:any)=>{let t='';const p:any[]=[];for(const c of q.queryChunks)if(c&&typeof c==='object'&&Array.isArray(c.value))t+=c.value.join('');else{t+='$';p.push(c)}
   if(t.startsWith('SELECT lpad('))return[{t:String(1_800_000_000_000+(++seq)).padStart(15,'0')}]
   if(t.startsWith('INSERT INTO tako_whatsapp_messages')){rows.set(p[0],p[1]);return[]}
   if(t.startsWith('SELECT sid FROM'))return [...rows.keys()].filter(k=>k.startsWith(p[0])).map(sid=>({sid}))
   if(t.startsWith('DELETE FROM'))return(rows.delete(p[0]),[])
   return[]}}
  const ph='whatsapp:+39111',log:string[]=[];let busy=0,overlap=false
  for(const s of ['S1','S2','S3'])await enqueueTurn(ex,ph,s)
  const work=async(s:string,ms:number)=>{const t=await waitTurn(ex,ph,s,{maxWaitMs:5000,pollMs:5,now:()=>1_800_000_000_100});busy++;if(busy>1)overlap=true;log.push('start '+s);await new Promise(r=>setTimeout(r,ms));log.push('end '+s);busy--;await releaseTurn(ex,t.key)}
  await Promise.all([work('S3',5),work('S1',40),work('S2',10)])
  expect(overlap).toBe(false);expect(log).toEqual(['start S1','end S1','start S2','end S2','start S3','end S3']);expect(rows.size).toBe(0)})
 it('«sì» a una proposta + «e inserisci …» arrivato mentre il «sì» lavora: prima il sì, poi l’inserimento (route)',async()=>{
  const r=await play(['nel menu alla carta elimina i dolci','sì',{text:'e nei dolci inserisci tiramisù',overlapMs:5} as any],base,{slowMs:150})
  const w=last(r);expect(secItems(w,'Alla carta','Dolci')).toEqual([])
  // il «sì» ha eliminato i 9 dolci; l'inserimento alla carta senza prezzo non scrive (chiede il prezzo): nessuna proposta persa né domanda doppia
  expect((r.replies.join('\n').match(/Rispondi \*sì\*/g)??[]).length).toBe(1)})})

// ======================= 4) ogni domanda sì/no ha una proposta consumabile =======================
describe('4) conferme: il «sì» applica sempre ciò che la domanda mostra',()=>{
 it('domanda del modello «…per eliminarli tutti?» con i 3 piatti → «Si» li elimina (mai una seconda domanda)',async()=>{
  const pl:Planner=c=>{const m=plainT(c.message);if(m==='voglio rifare i primi di oggi')return Q('Intendi i *Primi* del *Menu Giorno* da 12 € per eliminarli tutti?',GIORNO_PRIMI.map(nm=>code(c,nm)!).filter(Boolean));return base(c)}
  const r=await play(['voglio rifare i primi di oggi','Si'],pl)
  expect(secItems(r.menus[1],'Menu Giorno','Primi').length).toBe(3)
  expect(secItems(r.menus[2],'Menu Giorno','Primi')).toEqual([]);expect(r.replies[1]).not.toMatch(/Rispondi/);expect(r.replies[1]).toMatch(/annulla/)})
 it('domanda del modello «Vuoi aggiungere questi piatti nei Primi del Menu Giorno?» SENZA azioni → il server mostra i piatti uno per riga e il «Si» li aggiunge',async()=>{
  const pl:Planner=c=>{if(/carbonara/i.test(c.message))return P('clarify',[],'Vuoi aggiungere questi piatti nei *Primi* del *Menu Giorno*? Non serve il prezzo, il menu è a prezzo fisso.');return base(c)}
  const r=await play(['carbonara  amatriciana','Si'],pl)
  expect(r.replies[0]).toMatch(/• Carbonara\n• Amatriciana/);expect(allItems(r.menus[1])).toBe(allItems(r.menus[0]))
  expect(secItems(r.menus[2],'Menu Giorno','Primi')).toEqual([...GIORNO_PRIMI,'Carbonara','Amatriciana']);expect(r.replies[1]).not.toMatch(/niente da confermare/)})
 it('insertForQuestion puro: senza sottomenu nella domanda → null (domanda specifica)',()=>{
  expect(insertForQuestion('Vuoi aggiungere questi piatti?','lasagna, carbonara',{menus:MENUS,sections:CAT.sections,refs:CAT.refs})).toBeNull()})})

// ======================= 5) elenco senza virgole, doppio spazio =======================
describe('5) «Lasagna strozzapreti con Zola e pistacchio  orecchiette con zucca» = 3 piatti',()=>{
 it('lettura pura',()=>{const secs=CAT.sections.filter(s=>s.menu==='Menu Giorno')
  const ip=parseInsert('nei primi Lasagna strozzapreti con Zola e pistacchio  orecchiette con zucca',secs,MENUS,CAT.refs.map(r=>r.name))
  expect(ip.lists[0]!.names.map(x=>x.toLowerCase())).toEqual(['lasagna','strozzapreti con zola e pistacchio','orecchiette con zucca'])})
 it('risposta a «Cosa inserisco nei Primi…?» → i 3 piatti creati (nomi con l’iniziale maiuscola)',async()=>{
  const r=await play(['nel menu pranzo elimina i primi','E inserisci','Lasagna strozzapreti con Zola e pistacchio  orecchiette con zucca'])
  expect(r.replies[1]).toMatch(/Cosa inserisco nei \*Primi\* del \*Menu Giorno\*/)
  expect(secItems(last(r),'Menu Giorno','Primi')).toEqual(['Lasagna','Strozzapreti con zola e pistacchio','Orecchiette con zucca'])
  expect(r.replies[2]).toMatch(/• Lasagna \(nuovo\)\n• Strozzapreti con zola e pistacchio \(nuovo\)\n• Orecchiette con zucca \(nuovo\)/)})})

// ======================= 6) togli + inserisci in un giro =======================
describe('6) «elimina i primi e inserisci A, B» e «sì» seguito da «e inserisci A, B»: entrambe, nell’ordine',()=>{
 it('un messaggio solo',async()=>{const r=await play(['nel menu pranzo elimina i primi e inserisci lasagna, pasta al pesto'])
  expect(secItems(r.menus[1],'Menu Giorno','Primi')).toEqual(['Pasta al pesto','Lasagna'])
  expect(r.replies[0]).toMatch(/Eliminati: linguine allo scoglio, Rigatoni al sugo/)})
 it('due messaggi (il Menu e il sottomenu vengono dalla conversazione)',async()=>{const r=await play(['menu cena: elimina i secondi','e inserisci tagliata, orata al forno'])
  expect(secItems(last(r),'Menu Cena','Secondi')).toEqual(['Tagliata','Orata al forno']);expect(secItems(last(r),'Menu Giorno','Secondi').length).toBe(3)})
 it('«sì» alla domanda del Menu, poi «e inserisci …» accavallato',async()=>{
  const r=await play(['togli i contorni','pranzo',{text:'e inserisci patate al forno, spinaci',overlapMs:3} as any])
  expect(secItems(last(r),'Menu Giorno','Contorni')).toEqual(['Patate al forno','Spinaci']);expect(secItems(last(r),'Menu Cena','Contorni').length).toBe(5)})})

// ======================= 7) sostituzione giornaliera subito, «sì» solo per un Menu intero =======================
describe('7) sostituzione di un sottomenu: subito con «annulla»; il «sì» resta per eliminare un Menu intero',()=>{
 it('togli i primi + metti questi: nessuna domanda',async()=>{const r=await play(['oggi a pranzo togli i primi e metti lasagna e gnocchi al ragù'])
  expect(r.replies[0]).not.toMatch(/\?/);expect(secItems(r.menus[1],'Menu Giorno','Primi').length).toBeGreaterThanOrEqual(2);expect(r.replies[0]).toMatch(/annulla/)})
 it('«elimina il menu pranzo» chiede ancora il sì',async()=>{const r=await play(['elimina il menu pranzo'])
  expect(r.replies[0]).toMatch(/Rispondi \*sì\*/);expect(allItems(r.menus[1])).toBe(allItems(r.menus[0]))})})

// ======================= prezzo delle opzioni detto «alla Luisa» =======================
describe('opzioni del Menu a prezzo fisso: «Il primo del menu da 12 costa 9», «Il solo secondo a pranzo mettilo a 11»',()=>{
 it('lettura pura',()=>{const rt=(t:string)=>ruleTurn({text:t,menus:MENUS,sections:CAT.sections,refs:CAT.refs,history:[]}) as any
  expect(rt('Il primo del menu da 12 costa 9').text).toMatch(/Solo primo\* del \*Menu Giorno\* è già \*9,00 €\*/)
  const r=rt('Il solo secondo a pranzo mettilo a 11');expect(r.kind).toBe('fix');expect(r.actions[0]).toMatchObject({kind:'set_formula',name:'Solo secondo',price:11,before:10})
  expect(rt('Il completo della cena mettilo a 17').actions[0]).toMatchObject({kind:'set_formula',name:'Completo',price:17})
  expect(rt('alza il completo della cena di un euro')).toBeNull()})
 it('route: scritto subito, «annulla» lo rimette',async()=>{const r=await play(['Il solo secondo a pranzo mettilo a 11','annulla'])
  expect(M(r.menus[1],'Menu Giorno').formulas.find((f:any)=>f.name==='Solo secondo').price).toBe(11);expect(r.replies[0]).not.toMatch(/\?/)
  expect(M(r.menus[2],'Menu Giorno').formulas.find((f:any)=>f.name==='Solo secondo').price).toBe(10)})})

// ======================= batteria dal vivo v181: contesto vecchio =======================
describe('il contesto vale solo per gli ultimi 2 scambi (batteria v181)',()=>{
 const H=(xs:[string,string][])=>xs.map(([role,text],i)=>({role,text,at:Date.now()-(xs.length-i)*30000}))
 it('«elimina tutti i primi» con il Menu detto 3 scambi fa → domanda sul Menu, nessuna scrittura',()=>{
  const r=ruleTurn({text:'elimina tutti i primi',menus:MENUS,sections:CAT.sections,refs:CAT.refs,history:H([['owner','nel menu cena metti la tagliata'],['bot','*Menu Cena aggiornato*'],['owner','annulla'],['bot','Ok, annullo.'],['owner','la pasta al pesto è finita'],['bot','*Pasta al pesto*: finito']])}) as any
  expect(r.kind).toBe('ask')})
 it('«metti tutto a zero» dopo i Primi del Menu Giorno: mai un piatto «Tutto a zero»',()=>{
  const r=ruleTurn({text:'metti tutto a zero',menus:MENUS,sections:CAT.sections,refs:CAT.refs,history:H([['owner','nel menu pranzo elimina i primi'],['bot','*Menu Giorno aggiornato*\n\n*Primi*\n• nessun piatto']])}) as any
  expect(JSON.stringify(r??null)).not.toMatch(/Tutto a zero/i)})
 it('«aggiungi il vitello tonnato» con i Primi detti 3 scambi fa: non va nei Primi da solo',()=>{
  const r=ruleTurn({text:'aggiungi il vitello tonnato',menus:MENUS,sections:CAT.sections,refs:CAT.refs,history:H([['owner','nel menu pranzo elimina i primi'],['bot','*Menu Giorno aggiornato*\n\n*Primi*'],['owner','annulla'],['bot','Ok, annullo.'],['owner','grazie'],['bot','Di niente']])}) as any
  expect(r?.kind==='apply'&&JSON.stringify(r.actions).includes('Vitello')).toBe(false)})})

// ======================= REPLAY ESATTO della chat di Luisa =======================
describe('REPLAY chat di Luisa 23/10 09:21–09:24 (stessi testi, «E inserisci» mentre il «Si» lavora)',()=>{
 it('stato finale: Primi del Menu Giorno = Lasagna, Strozzapreti con zola e pistacchio, Orecchiette con zucca; tutto il resto identico',async()=>{
  const r=await play([
   {text:'Nel menù pranzo da 12 elimina i primi'},
   {text:'Eliminare tutti i primi'},
   {text:'Menù mezzogiorno da 12 euro'},
   {text:'Si'},
   {text:'E inserisci',overlapMs:9} as any,
   {text:'Lasagna strozzapreti con Zola e pistacchio  orecchiette con zucca'},
   {text:'Si'}],base,{slowMs:200})
  const w0=r.menus[0],wN=last(r)
  expect(secItems(wN,'Menu Giorno','Primi')).toEqual(['Lasagna','Strozzapreti con zola e pistacchio','Orecchiette con zucca'])
  for(const m of ['Menu Cena','Alla carta','Drinks'])expect(JSON.stringify(M(wN,m))).toBe(JSON.stringify(M(w0,m)))
  for(const s of ['Secondi','Contorni'])expect(secItems(wN,'Menu Giorno',s)).toEqual(secItems(w0,'Menu Giorno',s))
  expect(shape(wN)).toBe(shape(w0))
  const all=r.replies.join('\n---\n');expect(all).not.toMatch(/a quale piatto/i);expect(all).not.toMatch(/niente da confermare/i)
  // una sola domanda alla volta: mai due domande nella stessa risposta, mai la stessa domanda due volte
  const qs=r.replies.flatMap(x=>x.split('\n').filter(l=>/\?\s*$/.test(l)));expect(new Set(qs).size).toBe(qs.length)
  if(process.env.LUISA_PRINT)console.log(r.replies.map((x,i)=>'#'+i+' '+x).join('\n\n'))})})
