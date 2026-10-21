// Test di PROPRIETÀ multiturno (21/10 sera, «non si deve più buggare assolutamente in questo modo»): deterministici, senza modello.
// Sequenze casuali (seed fisso) di comandi, sì, no, cambi di argomento e vocali sul route vero, con la proposta in sospeso vera
// (DB finto) e un finto Haiku che produce piani plausibili, anche quelli SBAGLIATI visti dal vivo (confirm_pending su una domanda,
// la stessa domanda rifatta, «in quale sottomenu?» senza proporre, candidati invece del gruppo intero, «non ho un comando»).
// Invarianti, su ogni turno:
//  I1 nessuna domanda ripetuta due volte di fila;  I2 nessun «sì» ignorato quando c'è una proposta con azioni;
//  I3 nessun comando nuovo perso (eseguito, oppure una domanda/riepilogo suo);  I4 il `source` del pending ≤ «1 messaggio + risposta»;
//  I5 mai «Non ho cambiato nulla» dopo un comando chiaro;  in più: mai «categoria», mai «non ho un comando», nessuna emoji.
import {afterAll,describe,expect,it,vi} from 'vitest'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-16T10:00:00Z'))})
vi.mock('../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./eval/route-harness.js')).onboardingMock)
vi.mock('../packages/db/src/index.ts',async()=>(await import('./eval/route-harness.js')).dbMock)
vi.mock('../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./eval/route-harness.js')).storeMock)
import {closeHarness,createRouteBot,installNet} from './eval/route-harness.js'
import {brainSql,resetBrainTables} from './eval/adapters/new-bot.js'
import {initialMenu} from './eval/fixtures/menus.js'
import {diff} from './eval/judge.js'
import {createFakeHaiku,A,P,Q,code,secCode,type FakeCtx} from './eval/fake-haiku.js'
import type {Conversation,Turn} from './eval/types.js'

const realFetch=globalThis.fetch
afterAll(()=>closeHarness())
const N=Number(process.env.TAKO_PROP_N||200),SEED=Number(process.env.TAKO_PROP_SEED||20261021)
const plainT=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
function rng(seed:number){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}

// Comandi (testo come lo direbbe il titolare) e il piano GIUSTO del modello per ognuno.
type Cmd={say:string,ok:(c:FakeCtx)=>any,wrong?:(c:FakeCtx)=>any}
const pasta=(c:FakeCtx,vis=false)=>c.items.filter(i=>/\bpasta\b/i.test(i.name)&&!/0,00|^0$/.test(String(i.price))&&i.price>0&&(!vis||!i.hidden))
const primi=(c:FakeCtx)=>{const s=c.sections.find(x=>x.name==='Primi'&&/verifica|prova/i.test(x.menu));return c.items.filter(i=>i.section==='Primi'&&s&&i.price>0)}
const CMDS:Cmd[]=[
 {say:'metti il tiramisù a 7',ok:c=>P('change',[A('set_price',{item:code(c,'tiramisù'),price:7})],'Ok.')},
 {say:'nascondi il riso giallo',ok:c=>P('change',[A('set_hidden',{item:code(c,'riso giallo'),value:true})],'Ok.')},
 {say:'la parmigiana passa a 14',ok:c=>P('change',[A('set_price',{item:code(c,'la parmigiana'),price:14})],'Ok.')},
 {say:'togli la pasta al sugo',ok:c=>P('change',[A('set_hidden',{item:code(c,'Pasta al sugo'),value:true})],'Ok.')},
 {say:'aumenta tutti i primi di 1 euro',ok:c=>P('change',primi(c).map(i=>A('set_price',{item:i.code,price_delta:1})),'Ok.'),wrong:c=>Q('',primi(c).map(i=>i.code))},
 {say:'metti tutte le paste a 9 euro',ok:c=>P('change',pasta(c).map(i=>A('set_price',{item:i.code,price:9})),'Ok.'),wrong:c=>Q('Intendi tutte e cinque le paste a *9 €*? Rispondi sì oppure dimmi quali.',pasta(c,true).map(i=>i.code))},
 {say:'aggiungi nel menu pranzo le lasagne a 12',ok:c=>Q('In quale sottomenu del *Menu pranzo* metto le *Lasagne*?'),wrong:c=>P('clarify',[A('create_item',{name:'Lasagne',price:12})],'Ok, in quale Sottomenu del *Menu pranzo* metto le *Lasagne*?',{clarify:{question:null,item_refs:[],missing:['section']}})},
 {say:'aggiungi gnocchi al ragu in menu pranzo a 10',ok:c=>P('change',[A('set_price',{item:code(c,'Gnocchi al ragù'),price:10})],'Ok.')},
 {say:'la pasta a 10',ok:c=>Q('Quale pasta intendi?',pasta(c,true).map(i=>i.code))},
 {say:'rinomina il menu cena in Cena della casa',ok:()=>P('chat',[],'Non ho un comando per rinominare un Menu.')},
 // sessione dei piatti di oggi (Menu pranzo alla carta col solo «Completo»): apertura, piatti a pezzi, uscita
 {say:'modifichiamo menu pranzo',ok:()=>Q('Cosa metto?')},
 {say:'nel completo lasagna 12 e cotoletta 14',ok:c=>!secCode(c,'Completo')?Q('In quale sottomenu?'):/sessione/.test(c.pending)?P('change',[A('replace_section_items',{section:secCode(c,'Completo'),menu:'Menu pranzo',text:'Lasagna 12; Cotoletta 14'})],'Ok.'):P('change',[A('create_item',{section:secCode(c,'Completo'),name:'Lasagna',price:12}),A('create_item',{section:secCode(c,'Completo'),name:'Cotoletta',price:14})],'Ok.'),wrong:()=>Q('A che prezzo?')},
 {say:'cambia il nome del sottomenu Completo in Primi piatti',ok:c=>P('change',[A('rename_section',{section:secCode(c,'Completo'),name:'Primi piatti'})],'Ok.')},
]
const YES=['si','sì','ok','esatto','va bene','sì voglio chiamarlo primi','si si'],NO=['no','no lascia stare','niente','annulla']
const OTHER=['grazie','quanto costa il tiramisù?','la prima','solo quelle visibili','tutte','restano uguali','basta','fatto']
// Finto Haiku: per ogni chiamata un comportamento plausibile, a volte sbagliato (seed della conversazione).
function planner(r:()=>number){return(c:FakeCtx)=>{const m=plainT(c.message),cmd=CMDS.find(x=>plainT(x.say)===m)
 if(cmd){if(c.correction)return r()<0.5?cmd.ok(c):Q('Puoi ripetere?');return cmd.wrong&&r()<0.4?cmd.wrong(c):cmd.ok(c)}
 if(YES.some(y=>plainT(y)===m)){if(!c.pending)return P('chat',[],'Ok.');const q=c.pending.match(/tua domanda aperta\): (.*?)(?: — |$)/m)?.[1];return r()<0.5?P('change',[A('confirm_pending')],'Fatto.'):Q(q||'Intendi questo? Rispondi sì oppure dimmi il nome.')}
 if(NO.some(y=>plainT(y)===m))return P('change',[A('cancel_pending')],'Ok, lascio stare.')
 if(/quanto costa/.test(m))return P('read',[],'',{item_refs:[code(c,'tiramisù')]})
 if(/visibili/.test(m))return Q('Intendi tutte le paste visibili?',pasta(c,true).map(i=>i.code))
 return P('chat',[],'Ok.')}}

function conversation(r:()=>number):Turn[]{const n=3+Math.floor(r()*4),out:Turn[]=[]
 for(let i=0;i<n;i++){const k=r();const say=k<0.5?CMDS[Math.floor(r()*CMDS.length)]!.say:k<0.75?YES[Math.floor(r()*YES.length)]!:k<0.88?NO[Math.floor(r()*NO.length)]!:OTHER[Math.floor(r()*OTHER.length)]!
  out.push(r()<0.3?{voice:say}:{text:say})}
 return out}

const isCmd=(t:string)=>CMDS.some(x=>plainT(x.say)===plainT(t))
const isYes=(t:string)=>YES.some(x=>plainT(x)===plainT(t))
const first=(s:string)=>s.replace(/^Sono l.*?persona\.\s*/s,'').split('\n\n')[0]!.trim()
const asks=(s:string)=>/\?|\brispondi\b/i.test(s)
const EMOJI=/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u

describe('proprietà multiturno sul route vero (finto Haiku, seed fisso)',()=>{
 it(`${N} conversazioni casuali: zero violazioni degli invarianti`,async()=>{
  const viol:string[]=[],r=rng(SEED);let turnsTot=0
  for(let k=0;k<N;k++){const turns=conversation(r),seed=Math.floor(r()*1e9),fake=createFakeHaiku(planner(rng(seed)));installNet(null,realFetch,fake);resetBrainTables();process.env.ANTHROPIC_API_KEY='eval-anthropic-key'
   const pend:any[]=[]
   const menu=initialMenu('qasera'),c:Conversation={id:'prop-'+k,family:'manuel',menu:'qasera',turns,changes:[]}
   const run=await createRouteBot({name:'haiku',settings:{botBrain:true,botEngine:'haiku'},extraSql:brainSql,afterTurn:(_i,p)=>pend.push(p)}).run(c,structuredClone(menu),{restaurant:'Tako · Verifica web'})
   if(process.env.TAKO_PROP_SHOW===String(k))run.turns.forEach((t,i)=>process.stderr.write(`  ${i+1} ${JSON.stringify(turns[i])} → ${JSON.stringify(t.reply.slice(0,300))}\n     pend=${JSON.stringify(pend[i])?.slice(0,300)}\n`))
   let prev=menu;const say=(t:Turn)=>'text' in t?t.text:'voice' in t?t.voice:''
   run.turns.forEach((t,i)=>{turnsTot++;const msg=say(turns[i]!),rep=t.reply.replace(/^Sono l.*?persona\.\s*/s,''),d=diff(prev,t.menuAfter),f=first(rep),tag=`conv ${k} turno ${i+1} «${msg}» → «${rep.replace(/\s+/g,' ').slice(0,140)}»`
    const before=i?pend[i-1]:null
    if(i&&asks(f)&&plainT(f)===plainT(first(run.turns[i-1]!.reply)))viol.push('I1 domanda ripetuta: '+tag)
    if(isYes(msg)&&before?.kind==='brain_ask'&&!before.twins?.length&&(before.actions??[]).length&&((before.ids??[]).length<2||(before.ids??[]).every((id:string)=>before.actions.some((a:any)=>a.id===id)))&&!d.length&&!/già/.test(rep))viol.push('I2 sì ignorato: '+tag)
    if(isCmd(msg)&&!d.length&&!asks(f)&&!/già|si chiama|nuovo nome/.test(rep))viol.push('I3 comando perso: '+tag)
    const p=pend[i];if(p&&typeof p.source==='string'&&p.source.split(' \n ').length>2)viol.push('I4 source accumulato ('+p.source.split(' \n ').length+'): '+tag)
    if(isCmd(msg)&&/^Non ho cambiato nulla\.?$/.test(f))viol.push('I5 «Non ho cambiato nulla» dopo un comando: '+tag)
    if(/categori/i.test(rep))viol.push('lessico «categoria»: '+tag)
    if(/non ho un comando|non posso|non riesco a/i.test(rep))viol.push('«non posso»: '+tag)
    if(EMOJI.test(rep))viol.push('emoji: '+tag)
    prev=t.menuAfter})}
  if(viol.length)process.stderr.write(viol.slice(0,40).join('\n')+'\n')
  expect({turni:turnsTot,violazioni:viol.length,esempi:viol.slice(0,5)}).toMatchObject({violazioni:0})},Number(process.env.TAKO_PROP_TIMEOUT||600000))
})
