// Regola d'uso 22/10/2026 (decisione Manuel dopo la prova con Gio, Victoria Bar) + bug delle chat del pomeriggio (BUG-CHAT-VICTORIA-1022.md).
// «svuota / togli tutto il menu X» = piatti nascosti, sottomenu e prezzi fissi intatti; «nei primi inserisci A, B» = visibili/creati, gli
// altri non si toccano. Unit test delle funzioni pure + route vero (DB e modello finti: il modello risponde «MODELLO» e non scrive mai,
// così ogni scrittura viene dal server) + BATTERIA AVVERSARIA (frasi scritte e trascrizioni di vocali) con invarianti a programma.
// Fixture «vicx»: locale INVENTATO con la forma di Victoria (Menu Giorno e Menu Cena a prezzo fisso con Primi/Secondi/Contorni, omonimi
// tra Menu, piatti nascosti da ieri), nessun dato vero.
import {afterAll,describe,expect,it,vi} from 'vitest'
import {writeFileSync} from 'node:fs'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-16T10:00:00Z'))})
vi.mock('../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./eval/route-harness.js')).onboardingMock)
vi.mock('../packages/db/src/index.ts',async()=>(await import('./eval/route-harness.js')).dbMock)
vi.mock('../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./eval/route-harness.js')).storeMock)
import {closeHarness,createRouteBot,installNet} from './eval/route-harness.js'
import {brainSql,resetBrainTables} from './eval/adapters/new-bot.js'
import {createFakeHaiku,A,P,type Planner,type FakeCtx} from './eval/fake-haiku.js'
import {clearIntent,sameName,menusIn,splitNames,parseInsert,ruleTurn,contextMenu,dailyReplaceParse} from '../apps/server/src/lib/owner-brain-svuota.js'
import {candidateFacts} from '../apps/server/src/lib/owner-brain-r.js'
import {dropInventedGroups,replaceReply} from '../apps/server/src/routes/twilio-menu.js'
import type {Conversation,EvalMenu,Turn} from './eval/types.js'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'

const realFetch=globalThis.fetch
afterAll(()=>closeHarness())
const plainT=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const strip=(r:string)=>r.replace(/^Sono l.*?persona\.\s*/s,'')

// ---------------- fixture vicx ----------------
let n=0;const id=(p:string)=>p+'-5555-4555-8555-'+String(++n).padStart(12,'0')
const S_=(name:string,items:[string,number,boolean?][])=>({id:id('7a000000'),name,items:items.map(([nm,price,h])=>({id:id('5a000000'),name:nm,price,...(h?{hidden:true}:{})}))})
function vicx():EvalMenu{n=0
 const giorno={id:id('6a000000'),name:'Menu Giorno',type:'lunch',pricing:'fisso',formulas:[] as any[],sections:[
  S_('Primi',[['Lasagna',0],['Pasta al pomodoro',0],['Pasta e fagioli',0,true],['Linguine vongole e pomodorini',0,true]]),
  S_('Secondi',[['Cotoletta alla milanese',0],['Polpette al sugo',0],['Arrosto di vitello',0,true]]),
  S_('Contorni',[['Patate al forno',0],['Spinaci al burro',0]])]}
 const cena={id:id('6a000000'),name:'Menu Cena',type:'dinner',pricing:'fisso',formulas:[] as any[],sections:[
  S_('Primi',[['Risotto ai funghi porcini',0],['Pappardelle al cinghiale',0],['Linguine vongole e pomodorini',0,true],['Tagliatelle panna, speck e zucchine',0,true]]),
  S_('Secondi',[['Tagliata di manzo con rucola e grana',0],['Orata al forno',0],['Nodino burro e salvia',0,true],['Gamberetti sale e pepe',0,true]]),
  S_('Contorni',[['Patate al forno',0],['Insalata mista',0],['Zucchine fritte',0,true]])]}
 const carta={id:id('6a000000'),name:'Alla carta',type:'main',sections:[S_('Primi piatti',[['Spaghetti alla carbonara',10],['Pasta al pesto',8]]),S_('Contorni',[['Insalata mista',4],['Patatine fritte',4]])]}
 const drinks={id:id('6a000000'),name:'Drinks',type:'drinks',sections:[S_('Bevande',[['Acqua',2],['Caffè',1.5]])]}
 giorno.formulas=[{id:id('5b000000'),name:'Completo',price:12,note:null,sectionIds:giorno.sections.map(s=>s.id),translations:{}}]
 cena.formulas=[{id:id('5b000000'),name:'Completo',price:16.9,note:null,sectionIds:cena.sections.map(s=>s.id),translations:{}},{id:id('5b000000'),name:'Solo primo',price:12,note:null,sectionIds:[cena.sections[0]!.id],translations:{}},{id:id('5b000000'),name:'Solo secondo',price:14,note:null,sectionIds:[cena.sections[1]!.id,cena.sections[2]!.id],translations:{}}]
 return{menus:[giorno,cena,carta,drinks] as any,design:{}}}

// ---------------- route ----------------
// Modello finto: «annulla» = undo_last (come il vero); tutto il resto = chiacchiera «MODELLO» senza azioni (se la regola non prende il
// messaggio, NON si scrive niente: lo vede la batteria).
const plannerOf=(extra?:(c:FakeCtx)=>any):Planner=>c=>{const m=plainT(c.message);if(/^(?:annulla|annulla l ultima|torna come prima)$/.test(m))return P('change',[A('undo_last')],'Ok, annullo.');return extra?.(c)??P('chat',[],'MODELLO')}
async function play(turns0:(Turn|string)[],planner:Planner=plannerOf(),menu:EvalMenu=vicx()){const turns=turns0.map(t=>typeof t==='string'?{text:t}:t) as Turn[]
 const fake=createFakeHaiku(planner);installNet(null,realFetch,fake);resetBrainTables();process.env.ANTHROPIC_API_KEY='eval-anthropic-key'
 const c:Conversation={id:'svuota',family:'manuel',menu:'vicx',turns,changes:[]}
 const run=await createRouteBot({name:'haiku',settings:{botBrain:true,botEngine:'haiku'},extraSql:brainSql}).run(c,structuredClone(menu),{restaurant:'Osteria Prova (vicx)'})
 return{replies:run.turns.map(t=>strip(t.reply)),menus:[workspaceSchema.parse(structuredClone(menu)),...run.turns.map(t=>t.menuAfter as any)] as any[]}}
const M=(w:any,name:string)=>w.menus.find((m:any)=>m.name===name)
const vis=(w:any,menu:string,sec:string)=>M(w,menu).sections.find((s:any)=>s.name===sec).items.filter((i:any)=>!i.hidden).map((i:any)=>i.name)
const allVis=(w:any,menu:string)=>M(w,menu).sections.flatMap((s:any)=>s.items.filter((i:any)=>!i.hidden).map((i:any)=>i.name))

// ---------------- invarianti ----------------
const shape=(w:any)=>JSON.stringify(w.menus.map((m:any)=>({id:m.id,name:m.name,active:m.active??true,pricing:m.pricing??null,formulas:m.formulas??[],sections:m.sections.map((s:any)=>({id:s.id,name:s.name,active:s.active??true,parent:s.parentSectionId??null}))})))
const itemsOf=(w:any,menu:string)=>JSON.stringify(M(w,menu).sections.map((s:any)=>s.items))
const ids=(w:any)=>new Set(w.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items.map((i:any)=>i.id))))
export type Case={id:string,turns:(string|{voice:string})[],menu?:string,exact?:Record<string,string[]>,has?:Record<string,string[]>,allHidden?:boolean,keepVisible?:boolean,noWrite?:boolean,said?:string[],reply?:RegExp,ask?:number[],model?:number[],undoTo?:number}
function violations(c:Case,r:{replies:string[],menus:any[]}):string[]{const out:string[]=[],w0=r.menus[0],wN=r.menus[r.menus.length-1]
 for(let t=1;t<r.menus.length;t++){const a=r.menus[t-1],b=r.menus[t]
  if(shape(a)!==shape(b))out.push(`t${t}: Menu/sottomenu/prezzi fissi cambiati`)
  const txt=c.turns[t-1];if(!(typeof txt==='string'&&/annulla/.test(txt)))for(const x of ids(a))if(!ids(b).has(x))out.push(`t${t}: piatto eliminato ${x}`)
  if(c.menu)for(const m of a.menus)if(m.name!==c.menu&&itemsOf(a,m.name)!==itemsOf(b,m.name))out.push(`t${t}: toccato un altro Menu (${m.name})`)
  const rep=r.replies[t-1]??''
  if(!(c.model??[]).includes(t)&&/MODELLO/.test(rep))out.push(`t${t}: il messaggio è andato al modello`)
  if((c.ask??[]).includes(t)&&!/\?/.test(rep))out.push(`t${t}: attesa una domanda, risposta «${rep.slice(0,80)}»`)
  if(!(c.ask??[]).includes(t)&&/\?\s*$/.test(rep.trim())&&!(c.model??[]).includes(t))out.push(`t${t}: domanda inattesa «${rep.slice(0,90)}»`)}
 if(c.noWrite&&JSON.stringify(w0)!==JSON.stringify(wN))out.push('scrittura inattesa')
 if(c.undoTo!==undefined&&JSON.stringify(r.menus[c.undoTo].menus)!==JSON.stringify(wN.menus))out.push('«annulla» non ha rimesso com’era prima dell’ultima modifica')
 if(c.menu&&c.allHidden&&allVis(wN,c.menu).length)out.push('restano visibili: '+allVis(wN,c.menu).join(', '))
 if(c.menu&&c.keepVisible){const before=allVis(w0,c.menu).map(plainT),after=allVis(wN,c.menu).map(plainT);for(const x of before)if(!after.includes(x))out.push('«inserisci» ha nascosto '+x)}
 if(c.menu)for(const [sec,names] of Object.entries(c.exact??{})){const v=vis(wN,c.menu,sec).map(plainT).sort(),e=names.map(plainT).sort();if(JSON.stringify(v)!==JSON.stringify(e))out.push(`${sec}: visibili [${v}] attesi [${e}]`)}
 if(c.menu)for(const [sec,names] of Object.entries(c.has??{})){const v=vis(wN,c.menu,sec).map(plainT);for(const x of names)if(!v.includes(plainT(x)))out.push(`${sec}: manca ${x}`)}
 const allReplies=plainT(r.replies.join(' '))
 if(c.menu)for(const x of c.said??[]){const inMenu=allVis(wN,c.menu).some((y:string)=>plainT(y)===plainT(x));if(!inMenu&&!allReplies.includes(plainT(x)))out.push('nome scartato in silenzio: '+x)}
 if(c.reply&&!c.reply.test(r.replies[r.replies.length-1]??''))out.push('risposta finale senza '+c.reply)
 return out}

// ---------------- unit: funzioni pure ----------------
describe('regola svuota/inserisci — funzioni pure',()=>{
 it('clearIntent: il Menu intero sì, un sottomenu o un gruppo di piatti no',()=>{
  for(const t of ['togli tutto il menu di pranzo','svuota il menu cena','togli tutti i piatti del pranzo','nascondi tutto','leva tutti i piatti','Nel menu cena dobbiamo cambiare tutto il menù, nascondi tutto','Il menù cena si deve vedere ma devi nascondere tutti i piatti','elimina tutti i piatti del menu cena','togli tutto quanto dalla cena','svuotalo'])expect(clearIntent(t,['Primi','Secondi','Contorni']),t).toBe(true)
  for(const t of ['togli tutti i primi','togli tutte le linguine','togli tutto dai secondi','togli tutto quello che hai fatto','togli tutte le foto','togli tutti i prezzi','non togliere tutto','tutto esaurito','togli tutti e due','rimetti tutto com era','togli tutti i piatti nascosti','nascondi il menu cena','togli la carbonara'])expect(clearIntent(t,['Primi','Secondi','Contorni']),t).toBe(false)})
 it('sameName: omonimo con articoli, «di», plurali, una lettera; nome diverso = piatto nuovo',()=>{
  expect(sameName('nodino di burro e salvia','Nodino burro e salvia')).toBe(true)
  expect(sameName('le lasagne','Lasagna')).toBe(true)
  expect(sameName('risoto ai funghi porcini','Risotto ai funghi porcini')).toBe(true)
  expect(sameName('pasta carbonara','Pasta alla carbonara')).toBe(true)
  expect(sameName('linguine','Linguine vongole e pomodorini')).toBe(false)
  expect(sameName('tagliata','Tagliata di manzo con rucola e grana')).toBe(false)})
 it('menusIn: «pranzo» → Menu Giorno, «stasera» → Menu Cena, nome detto vince',()=>{
  const ms=[{id:'g',name:'Menu Giorno'},{id:'c',name:'Menu Cena'},{id:'a',name:'Alla carta'}]
  expect(menusIn('togli tutto il menu di pranzo',ms).map(m=>m.id)).toEqual(['g'])
  expect(menusIn('nascondi tutto per stasera',ms).map(m=>m.id)).toEqual(['c'])
  expect(menusIn('nel menu giorno togli le linguine',ms).map(m=>m.id)).toEqual(['g'])
  expect(menusIn('nei primi inserisci la carbonara',ms)).toEqual([])
  expect(contextMenu([{role:'owner',text:'svuota il menu cena',at:1},{role:'bot',text:'*Menu Cena svuotato*',at:2}],ms)?.id).toBe('c')})
 const T=(s:string)=>s.split(/(\s+|,)/).filter(x=>x.trim()).map(x=>({w:plainT(x)||x,raw:x}))
 it('splitNames: «e» dentro i nomi, virgole, a capo, vocali senza virgole',()=>{
  const sp=(s:string)=>{const t=parseInsert('nei primi inserisci '+s,[{id:'p',name:'Primi',menu:'M'}],[{name:'M'}],['Nodino burro e salvia']);return t.lists[0]?.names??[]}
  expect(sp('carbonara e pasta e fagioli')).toEqual(['carbonara','pasta e fagioli'])
  expect(sp('spaghetti aglio olio e peperoncino e pasta e ceci')).toEqual(['spaghetti aglio olio e peperoncino','pasta e ceci'])
  expect(sp('pasta alla carbonara, linguine e tagliatelle')).toEqual(['pasta alla carbonara','linguine','tagliatelle'])
  expect(sp('pasta alla carbonara linguine e tagliatelle')).toEqual(['pasta alla carbonara','linguine','tagliatelle'])
  expect(sp('tagliata di manzo con rucola e grana e orata al forno')).toEqual(['tagliata di manzo con rucola e grana','orata al forno'])
  expect(sp('nodino burro e salvia')).toEqual(['nodino burro e salvia'])
  expect(splitNames(T('la carbonara'),[])).toEqual(['carbonara'])})
 it('parseInsert: più sottomenu in un messaggio, ordine invertito, portata che nel Menu non c’è',()=>{
  const secs=[{id:'p',name:'Primi',menu:'Menu Cena'},{id:'s',name:'Secondi',menu:'Menu Cena'},{id:'c',name:'Contorni',menu:'Menu Cena'}],ms=[{name:'Menu Cena'}]
  const a=parseInsert('nei primi inserisci carbonara e amatriciana, nei secondi cotoletta e polpette, nei contorni patatine fritte',secs,ms,[])
  expect(a.lists.map(l=>[l.secId,l.names])).toEqual([['p',['carbonara','amatriciana']],['s',['cotoletta','polpette']],['c',['patatine fritte']]])
  const b=parseInsert('inserisci la carbonara nei primi e la tagliata nei secondi',secs,ms,[])
  expect(b.lists.map(l=>[l.secId,l.names])).toEqual([['p',['carbonara']],['s',['tagliata']]])
  const c=parseInsert('nel menu cena nei dolci inserisci tiramisù',secs,ms,[])
  expect(c.lists.map(l=>[l.secId,l.names])).toEqual([[null,['tiramisù']]])})
 it('ruleTurn: bozza in sospeso + Menu a prezzo fisso detto («nono devi guardare menu cena») = il piatto nascosto torna visibile (B4)',()=>{
  const menus=[{id:'g',name:'Menu Giorno',pricing:'fisso' as const},{id:'c',name:'Menu Cena',pricing:'fisso' as const}],sections=[{id:'s1',name:'Secondi',menu:'Menu Cena'},{id:'s2',name:'Secondi',menu:'Menu Giorno'}]
  const refs=[{id:'n1',name:'Nodino burro e salvia',price:0,available:true,hidden:true,menu:'Menu Cena',sectionId:'s1'}]
  const r=ruleTurn({text:'nono devi guardare menu cena',menus,sections,refs,history:[],draftName:'Nodino di burro e salvia'})
  expect(r?.kind).toBe('apply');expect((r as any).actions).toEqual([{kind:'hidden',id:'n1',value:false}])})
 it('dailyReplaceParse: «stasera a cena metti primi: …» con il Menu detto è letta dal server (B1)',()=>{
  const menus=[{id:'g',name:'Menu Giorno',pricing:'fisso' as const},{id:'c',name:'Menu Cena',pricing:'fisso' as const}],sections=['Primi','Secondi','Contorni'].flatMap(s=>[{id:'g'+s,name:s,menu:'Menu Giorno'},{id:'c'+s,name:s,menu:'Menu Cena'}])
  const d=dailyReplaceParse('stasera a cena metti primi: risotto ai funghi porcini e pappardelle al cinghiale, secondi metti tagliata di manzo con rucola e grana e orata al forno, contorni patate al forno e insalata mista',menus,sections,[])
  expect(d?.menu.id).toBe('c');expect(d?.lists).toEqual([{secId:'cPrimi',names:['risotto ai funghi porcini','pappardelle al cinghiale']},{secId:'cSecondi',names:['tagliata di manzo con rucola e grana','orata al forno']},{secId:'cContorni',names:['patate al forno','insalata mista']}])
  expect(dailyReplaceParse('nel menu del pranzo nei primi inserisci carbonara',menus,sections,[])).toBeNull()})
 it('B6: elenco numerato senza «(0,00 €)» per i piatti senza prezzo',()=>{
  const refs=[{id:'a',name:'Risotto',price:0,available:true,hidden:false,menu:'Menu Cena'},{id:'b',name:'Carbonara',price:12,available:true,hidden:false,menu:'Alla carta'}]
  const t=candidateFacts(['a','b'],refs as any);expect(t).not.toMatch(/0,00/);expect(t).toMatch(/Carbonara\* \(12,00 €\)/)})
 it('B2/K1: frase della bozza con un «*Menu X*» che nel locale non c’è → cade',()=>{
  expect(dropInventedGroups('Quale Primi vuoi eliminare: quello del *Menu Pranzo* o quello del *Menu Cena*?',['Menu Giorno','Menu Cena','Primi'],'eliminane uno')).toBeNull()
  expect(dropInventedGroups('Nel *Menu Cena* ci sono i Primi.',['Menu Giorno','Menu Cena','Primi'],'')).toBe('Nel *Menu Cena* ci sono i Primi.')})
 it('K3: nota della foto ereditata PRIMA di «Per tornare come prima…»',()=>{
  const t=replaceReply([{kind:'hidden',id:'x',value:false} as any],[{id:'x',name:'Riso giallo',price:0,available:true,hidden:true,menu:'Menu del giorno',sectionId:'p'}],[{id:'p',name:'Primi',menu:'Menu del giorno'}],'*Riso giallo*: foto presa da Menu di verifica')
  expect(t.indexOf('foto presa da')).toBeLessThan(t.indexOf('Per tornare come prima'))})
})

// ---------------- route: casi della chat di Victoria ----------------
describe('regola svuota/inserisci — route (casi Victoria 22/10)',()=>{
 it('B5–B7: «nascondi tutto» nel Menu Cena = TUTTI i piatti visibili nascosti (anche i contorni), sottomenu e prezzi fissi intatti, nessuna domanda',async()=>{
  for(const t of ['Nel menu cena dobbiamo cambiare tutto il menù, nascondi tutto','Il menù cena si deve vedere ma devi nascondere tutti i piatti']){const r=await play([t])
   expect(violations({id:t,turns:[t],menu:'Menu Cena',allHidden:true},r),r.replies[0]).toEqual([])
   expect(r.replies[0]).toMatch(/Menu Cena svuotato/);expect(r.replies[0]).toMatch(/annulla/)}})
 it('nuovo flusso: svuota → nei primi inserisci (nuovi) → nei secondi metti (esistenti nascosti) → annulla ×2 = com’era',async()=>{
  const turns=['svuota il menu cena','Nei primi inserisci pasta alla carbonara, linguine e tagliatelle','nei secondi metti nodino burro e salvia e gamberetti sale e pepe','annulla']
  const r=await play(turns)
  expect(vis(r.menus[2],'Menu Cena','Primi')).toEqual(['Pasta alla carbonara','Linguine','Tagliatelle'])
  expect(vis(r.menus[3],'Menu Cena','Secondi')).toEqual(['Nodino burro e salvia','Gamberetti sale e pepe'])
  expect(r.replies[1]).toMatch(/\*Primi\*\n• Pasta alla carbonara \(nuovo\)/)
  expect(JSON.stringify(r.menus[4].menus)).toBe(JSON.stringify(r.menus[2].menus))
  for(const k of [1,2,3,4])expect(shape(r.menus[k])).toBe(shape(r.menus[0]))})
 it('B3: «nel menu cena aggiungi nodino burro e salvia» e «voglio aggiungere nodino di burro e salvia» (Menu dalla conversazione) = visibile',async()=>{
  let r=await play(['nel menu cena aggiungi nodino burro e salvia']);expect(vis(r.menus[1],'Menu Cena','Secondi')).toContain('Nodino burro e salvia')
  r=await play(['nel menu cena nei contorni inserisci zucchine fritte','voglio aggiungere nodino di burro e salvia']);expect(vis(r.menus[2],'Menu Cena','Secondi')).toContain('Nodino burro e salvia');expect(r.replies[1]).not.toMatch(/MODELLO|prezzo/)})
 it('B1: «stasera a cena metti primi: …, secondi …, contorni …» = sostituzione subito nel Menu Cena (nessuna domanda sui Primi)',async()=>{
  const r=await play(['stasera a cena metti primi: linguine vongole e pomodorini e pasta e fagioli, secondi metti nodino burro e salvia, contorni zucchine fritte'])
  expect(vis(r.menus[1],'Menu Cena','Primi')).toEqual(['Linguine vongole e pomodorini','Pasta e fagioli'])
  expect(vis(r.menus[1],'Menu Cena','Secondi')).toEqual(['Nodino burro e salvia']);expect(vis(r.menus[1],'Menu Cena','Contorni')).toEqual(['Zucchine fritte'])
  expect(itemsOf(r.menus[1],'Menu Giorno')).toBe(itemsOf(r.menus[0],'Menu Giorno'));expect(r.replies[0]).not.toMatch(/MODELLO|\?/)})
 it('K2: nel percorso del modello un piatto detto e lasciato fuori dalla sostituzione viene aggiunto («pasta e fagioli»)',async()=>{
  const pl=plannerOf(c=>{const m=plainT(c.message);if(/carbonara e pasta e fagioli/.test(m)){const sec=c.sections.find(s=>s.name==='Primi'&&/giorno/i.test(s.menu))!;return P('change',[A('replace_section_items',{section:sec.code,menu:'Menu Giorno',text:'Carbonara'})],'Fatto.')}return null})
  const r=await play(['oggi primi carbonara e pasta e fagioli'],pl)
  expect(vis(r.menus[1],'Menu Giorno','Primi').map(plainT).sort()).toEqual(['carbonara','pasta e fagioli'])})
 it('K4: annullo di una modifica su due omonimi in due Menu = testo del server, Menu accanto al nome',async()=>{
  const pl=plannerOf(c=>{if(/patate/.test(plainT(c.message))){const its=c.items.filter(i=>i.name==='Patate al forno');return P('change',its.map(i=>A('set_hidden',{item:i.code,value:true})),'Ok, tolte dal *Menu Giorno*.')}return null})
  const r=await play(['togli le patate al forno da tutti e due i menu','annulla'],pl)
  expect(r.replies[1]).toMatch(/^Ok, annullo l’ultima modifica\./);expect(r.replies[1]).toMatch(/Patate al forno \(Menu Giorno\)/);expect(r.replies[1]).toMatch(/Patate al forno \(Menu Cena\)/)})
})

// ---------------- BATTERIA AVVERSARIA ----------------
const V=(voice:string)=>({voice})
export const BATTERIA:Case[]=[
 // svuota
 {id:'s01',turns:['togli tutto il menu cena'],menu:'Menu Cena',allHidden:true},
 {id:'s02',turns:['svuota il menu cena'],menu:'Menu Cena',allHidden:true},
 {id:'s03',turns:['togli tutti i piatti della cena'],menu:'Menu Cena',allHidden:true},
 {id:'s04',turns:['nascondi tutto il menu di stasera'],menu:'Menu Cena',allHidden:true},
 {id:'s05',turns:['leva tutti i piatti dal menù cena'],menu:'Menu Cena',allHidden:true},
 {id:'s06',turns:[V('allora nel menu della cena togli tutto che dobbiamo rifarlo')],menu:'Menu Cena',allHidden:true},
 {id:'s07',turns:['togli tutto il menu di pranzo'],menu:'Menu Giorno',allHidden:true},
 {id:'s08',turns:['svuota il pranzo'],menu:'Menu Giorno',allHidden:true},
 {id:'s09',turns:['Nel menu cena dobbiamo cambiare tutto il menù, nascondi tutto'],menu:'Menu Cena',allHidden:true},
 {id:'s10',turns:['Il menù cena si deve vedere ma devi nascondere tutti i piatti'],menu:'Menu Cena',allHidden:true},
 {id:'s11',turns:['svuota il menu','la cena'],menu:'Menu Cena',allHidden:true,ask:[1]},
 {id:'s12',turns:['togli tutto','pranzo'],menu:'Menu Giorno',allHidden:true,ask:[1]},
 {id:'s13',turns:['nel menu cena nei contorni inserisci zucchine fritte','ora togli tutto'],menu:'Menu Cena',allHidden:true},
 {id:'s14',turns:['elimina tutti i piatti del menu cena'],menu:'Menu Cena',allHidden:true,reply:/non eliminati/},
 {id:'s15',turns:['togli tutto il menu cena tranne le patate al forno'],menu:'Menu Cena',exact:{Primi:[],Secondi:[],Contorni:['Patate al forno']}},
 {id:'s16',turns:['svuota il menu cena','annulla'],menu:'Menu Cena',undoTo:0},
 {id:'s17',turns:['svuota il menu cena','svuota il menu cena'],menu:'Menu Cena',allHidden:true,reply:/già vuoto/},
 {id:'s18',turns:[V('svuota il menù della cena')],menu:'Menu Cena',allHidden:true},
 {id:'s19',turns:['togli tutti i piatti del pranzo per favore'],menu:'Menu Giorno',allHidden:true},
 {id:'s20',turns:['svuota il menu cena','no aspetta'],menu:'Menu Cena',allHidden:true,model:[2]},
 // inserisci
 {id:'i01',turns:['svuota il menu cena','Nei primi inserisci pasta alla carbonara, linguine e tagliatelle'],menu:'Menu Cena',exact:{Primi:['Pasta alla carbonara','Linguine','Tagliatelle'],Secondi:[],Contorni:[]},said:['pasta alla carbonara','linguine','tagliatelle']},
 {id:'i02',turns:['svuota il menu cena','nei primi inserisci risotto ai funghi porcini e linguine vongole e pomodorini'],menu:'Menu Cena',exact:{Primi:['Risotto ai funghi porcini','Linguine vongole e pomodorini']}},
 {id:'i03',turns:['svuota il menu cena','nei secondi metti tagliata di manzo con rucola e grana e orata al forno'],menu:'Menu Cena',exact:{Secondi:['Tagliata di manzo con rucola e grana','Orata al forno'],Primi:[]}},
 {id:'i04',turns:['svuota il menu cena','nei contorni aggiungi patate al forno e insalata mista'],menu:'Menu Cena',exact:{Contorni:['Patate al forno','Insalata mista']}},
 {id:'i05',turns:['svuota il menu cena','nei primi inserisci carbonara e amatriciana, nei secondi cotoletta e polpette, nei contorni patatine fritte'],menu:'Menu Cena',exact:{Primi:['Carbonara','Amatriciana'],Secondi:['Cotoletta','Polpette'],Contorni:['Patatine fritte']}},
 {id:'i06',turns:['svuota il menu cena',V('nei primi inserisci pasta alla carbonara linguine e tagliatelle nei secondi orata al forno')],menu:'Menu Cena',exact:{Primi:['Pasta alla carbonara','Linguine','Tagliatelle'],Secondi:['Orata al forno']}},
 {id:'i07',turns:['svuota il menu cena','nei primi inserisci pasta e fagioli'],menu:'Menu Cena',exact:{Primi:['Pasta e fagioli']}},
 {id:'i08',turns:['svuota il menu cena','nei primi inserisci spaghetti aglio olio e peperoncino e pasta e ceci'],menu:'Menu Cena',exact:{Primi:['Spaghetti aglio olio e peperoncino','Pasta e ceci']}},
 {id:'i09',turns:['svuota il menu cena','inserisci carbonara e amatriciana nei primi'],menu:'Menu Cena',exact:{Primi:['Carbonara','Amatriciana']}},
 {id:'i10',turns:['svuota il menu cena','inserisci la carbonara nei primi e la tagliata di manzo con rucola e grana nei secondi'],menu:'Menu Cena',exact:{Primi:['Carbonara'],Secondi:['Tagliata di manzo con rucola e grana']}},
 {id:'i11',turns:['svuota il menu cena','nel primo inserisci carbonara','come secondo metti orata al forno','nei contorno metti insalata mista'],menu:'Menu Cena',exact:{Primi:['Carbonara'],Secondi:['Orata al forno'],Contorni:['Insalata mista']}},
 {id:'i12',turns:['svuota il menu cena','nei primi inserisci risoto ai funghi porcini'],menu:'Menu Cena',exact:{Primi:['Risotto ai funghi porcini']}},
 {id:'i13',turns:['svuota il menu cena','nei primi inserisci','carbonara e lasagne'],menu:'Menu Cena',exact:{Primi:['Carbonara','Lasagne']},ask:[2]},
 {id:'i14',turns:['nei primi inserisci carbonara','cena'],menu:'Menu Cena',has:{Primi:['Carbonara','Risotto ai funghi porcini']},ask:[1]},
 {id:'i15',turns:['nel menu cena nei primi inserisci carbonara'],menu:'Menu Cena',keepVisible:true,has:{Primi:['Carbonara']}},
 {id:'i16',turns:['nel menu del pranzo nei secondi inserisci arrosto di vitello'],menu:'Menu Giorno',keepVisible:true,has:{Secondi:['Arrosto di vitello']}},
 {id:'i17',turns:['nel menu cena nei dolci inserisci tiramisù'],menu:'Menu Cena',noWrite:true,said:['tiramisù'],reply:/Dolci/},
 {id:'i18',turns:['nel menu cena nei primi inserisci risotto ai funghi porcini'],menu:'Menu Cena',noWrite:true,reply:/già nel/},
 {id:'i19',turns:['nel menu cena aggiungi nodino burro e salvia'],menu:'Menu Cena',keepVisible:true,has:{Secondi:['Nodino burro e salvia']}},
 {id:'i20',turns:['nel menu cena nei primi inserisci carbonara','voglio aggiungere nodino di burro e salvia'],menu:'Menu Cena',keepVisible:true,has:{Secondi:['Nodino burro e salvia'],Primi:['Carbonara']}},
 {id:'i21',turns:['svuota il menu cena','nei primi inserisci carbonara','annulla'],menu:'Menu Cena',undoTo:1},
 {id:'i21b',turns:['svuota il menu cena e nei primi inserisci carbonara','annulla'],menu:'Menu Cena',undoTo:0},
 {id:'i22',turns:['svuota il menu cena e nei primi inserisci carbonara e lasagne'],menu:'Menu Cena',exact:{Primi:['Carbonara','Lasagne'],Secondi:[],Contorni:[]}},
 {id:'i23',turns:['togli tutti i piatti del pranzo, poi nei primi metti pasta al pomodoro e nei secondi polpette al sugo'],menu:'Menu Giorno',exact:{Primi:['Pasta al pomodoro'],Secondi:['Polpette al sugo'],Contorni:[]}},
 {id:'i24',turns:['svuota il menu cena','nei primi inserisci:\ncarbonara\nlasagne\npasta e fagioli'],menu:'Menu Cena',exact:{Primi:['Carbonara','Lasagne','Pasta e fagioli']}},
 {id:'i25',turns:['svuota il menu cena','nei secondi inserisci la cotoletta per favore'],menu:'Menu Cena',exact:{Secondi:['Cotoletta']}},
 {id:'i26',turns:['svuota il menu cena','inserisci nel menu cena primi: carbonara, lasagne; secondi: orata al forno'],menu:'Menu Cena',exact:{Primi:['Carbonara','Lasagne'],Secondi:['Orata al forno']}},
 {id:'i27',turns:['nel menu cena nei primi inserisci gnocchi alla sorrentina','nei secondi aggiungi salsiccia alla griglia'],menu:'Menu Cena',keepVisible:true,has:{Primi:['Gnocchi alla sorrentina'],Secondi:['Salsiccia alla griglia']}},
 {id:'i28',turns:['aggiungi nei contorni della cena le zucchine fritte'],menu:'Menu Cena',keepVisible:true,has:{Contorni:['Zucchine fritte']}},
 {id:'i29',turns:['nel menu cena inserisci carbonara'],menu:'Menu Cena',keepVisible:true,has:{Primi:['Carbonara']}},
 {id:'i30',turns:['nel menu cena inserisci il tiramisù'],menu:'Menu Cena',noWrite:true,said:['tiramisù']},
 {id:'i31',turns:['nel menu cena nei secodi inserisci orata al forno'],menu:'Menu Cena',noWrite:true,reply:/già nel/},
 {id:'i32',turns:['svuota il menu cena',V('svuota il menù della cena e poi nei primi metti risotto ai funghi porcini e pappardelle al cinghiale nei secondi tagliata di manzo con rucola e grana')],menu:'Menu Cena',exact:{Primi:['Risotto ai funghi porcini','Pappardelle al cinghiale'],Secondi:['Tagliata di manzo con rucola e grana'],Contorni:[]}},
 {id:'i33',turns:['nel menu cena nei primi inserisci carbonara','togli tutto e metti solo carbonara e tagliata di manzo con rucola e grana'],menu:'Menu Cena',exact:{Primi:['Carbonara'],Secondi:['Tagliata di manzo con rucola e grana'],Contorni:[]}},
 {id:'i34',turns:['svuota il menu cena',V('nei primi mettici la pasta e fagioli e gli spaghetti aglio olio e peperoncino poi nei contorni le patate al forno')],menu:'Menu Cena',exact:{Primi:['Pasta e fagioli','Spaghetti aglio olio e peperoncino'],Contorni:['Patate al forno']}},
 {id:'i35',turns:['svuota il pranzo','nei secondi inserisci cotoletta alla milanese e arrosto di vitello','nei contorni inserisci spinaci al burro'],menu:'Menu Giorno',exact:{Primi:[],Secondi:['Cotoletta alla milanese','Arrosto di vitello'],Contorni:['Spinaci al burro']}},
 {id:'i36',turns:['svuota il menu cena','nei Primi inserisci Linguine Vongole E Pomodorini'],menu:'Menu Cena',exact:{Primi:['Linguine vongole e pomodorini']}},
 {id:'i37',turns:['svuota il menu cena','nei primi inserisci carbonara','nei primi inserisci anche le lasagne'],menu:'Menu Cena',exact:{Primi:['Carbonara','Lasagne']}},
 {id:'i38',turns:['svuota il menu cena','ok adesso nei primi inserisci carbonara, nei secondi orata al forno e nei contorni insalata mista grazie'],menu:'Menu Cena',exact:{Primi:['Carbonara'],Secondi:['Orata al forno'],Contorni:['Insalata mista']}},
 {id:'o01',turns:['oggi nel menu cena nei primi inserisci carbonara'],menu:'Menu Cena',keepVisible:true,has:{Primi:['Carbonara']}},
 {id:'o02',turns:['togli tutto il menu di oggi a pranzo'],menu:'Menu Giorno',allHidden:true},
 {id:'o03',turns:['svuota il menu cena','nei primi inserici carbonara e lasagne'],menu:'Menu Cena',exact:{Primi:['Carbonara','Lasagne']}},
 {id:'o04',turns:['svuota il menu cena','nei primi agiungi la carbonara'],menu:'Menu Cena',exact:{Primi:['Carbonara']}},
 {id:'o05',turns:['svuota la cena'],menu:'Menu Cena',allHidden:true},
 {id:'o06',turns:['svuota il menu cena',V("ehm allora nei secondi ci metti la tagliata di manzo con rucola e grana e poi anche l'orata al forno")],menu:'Menu Cena',exact:{Secondi:['Tagliata di manzo con rucola e grana','Orata al forno'],Primi:[],Contorni:[]}},
 {id:'o07',turns:['svuota il pranzo','nei primi inserisci pasta e fagioli, nei secondi arrosto di vitello','e nei contorni patate al forno'],menu:'Menu Giorno',exact:{Primi:['Pasta e fagioli'],Secondi:['Arrosto di vitello'],Contorni:['Patate al forno']}},
 {id:'o08',turns:['svuota il menu cena','nei primi inserisci carbonara','i secondi restano uguali'],menu:'Menu Cena',exact:{Primi:['Carbonara'],Secondi:[]},model:[3]},
 {id:'o09',turns:['svuota il menu cena','nei primi inserisci carbonara','e nei secondi orata al forno'],menu:'Menu Cena',exact:{Primi:['Carbonara'],Secondi:['Orata al forno']}},
 // sostituzione giornaliera (resta com'è, letta dal server col Menu detto)
 {id:'r01',turns:['stasera a cena primi: carbonara e pasta e fagioli, secondi orata al forno'],menu:'Menu Cena',exact:{Primi:['Carbonara','Pasta e fagioli'],Secondi:['Orata al forno'],Contorni:['Patate al forno','Insalata mista']}},
 {id:'r02',turns:['nel menu del pranzo primi pasta e fagioli e lasagna'],menu:'Menu Giorno',exact:{Primi:['Pasta e fagioli','Lasagna']}},
 {id:'r03',turns:['stasera a cena metti primi: risotto ai funghi porcini e pappardelle al cinghiale, secondi metti tagliata di manzo con rucola e grana e orata al forno, contorni patate al forno e insalata mista'],menu:'Menu Cena',exact:{Primi:['Risotto ai funghi porcini','Pappardelle al cinghiale'],Secondi:['Tagliata di manzo con rucola e grana','Orata al forno'],Contorni:['Patate al forno','Insalata mista']}},
 // NON sono la regola: nessuna scrittura dal server (il modello finto non scrive)
 {id:'n01',turns:['togli tutti i primi del menu cena'],noWrite:true,model:[1]},
 {id:'n02',turns:['togli le linguine'],noWrite:true,model:[1]},
 {id:'n03',turns:['nascondi il menu cena'],noWrite:true,model:[1]},
 {id:'n04',turns:['nei primi inserisci carbonara a 12'],noWrite:true,model:[1]},
 {id:'n05',turns:['aggiungi patatine fritte a 4'],noWrite:true,model:[1]},
 {id:'n06',turns:['quanto costa il completo della cena?'],noWrite:true,model:[1]},
 {id:'n07',turns:['togli tutto quello che hai fatto'],noWrite:true,model:[1]},
 {id:'n08',turns:['rimetti tutto com era'],noWrite:true,model:[1]},
 {id:'n09',turns:['togli tutte le foto'],noWrite:true,model:[1]},
 {id:'n10',turns:['non togliere niente dal menu cena'],noWrite:true,model:[1]},
]

describe('BATTERIA AVVERSARIA regola svuota/inserisci (22/10)',()=>{
 const results:{id:string,v:string[],replies:string[]}[]=[]
 afterAll(()=>{const frasi=BATTERIA.reduce((a,c)=>a+c.turns.length,0),bad=results.filter(r=>r.v.length)
  try{writeFileSync(new URL('../docs/webapp/bot-haiku-2026-10-21/notte-1022/batteria-svuota-1022.json',import.meta.url),JSON.stringify({casi:BATTERIA.length,frasi,violazioni:bad.reduce((a,r)=>a+r.v.length,0),casiKO:bad.map(r=>({id:r.id,v:r.v,replies:r.replies})),risposte:results.map(r=>({id:r.id,replies:r.replies}))},null,1))}catch{}
  console.log(`BATTERIA svuota/inserisci: ${BATTERIA.length} casi, ${frasi} frasi, ${bad.length} casi con violazioni`)})
 for(const c of BATTERIA)it(c.id+' '+c.turns.map(t=>typeof t==='string'?t:'🎤'+t.voice).join(' → ').slice(0,120),async()=>{
  const r=await play(c.turns.map(t=>typeof t==='string'?{text:t}:t))
  const v=violations(c,r);results.push({id:c.id,v,replies:r.replies.map(x=>x.slice(0,300))})
  expect(v,r.replies.join('\n---\n')).toEqual([])})
})
