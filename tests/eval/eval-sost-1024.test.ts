// Caccia 24/10 (sostituzioni «togli X metti Y», conferme, refusi del Menu): route vero, motore Haiku 5.5 in record/replay,
// fixture = copia del menu di Victoria (sola lettura). Spento di default:
//   TAKO_SOST=1 TAKO_SOST_CASES=<file.json> TAKO_SOST_FIXTURE=<workspace.json> TAKO_SOST_OUT=<out.json> TAKO_BOT_LLM=record \
//   TAKO_EVAL_ANTHROPIC_MAX_USD=0.5 taskpolicy -b ./node_modules/.bin/vitest run tests/eval/eval-sost-1024.test.ts
// Casi: [{id, turns:[string|{text,overlapMs?}|{wait:minuti}]}]. Uscita: per caso risposte, tempi, e per turno le differenze del menu.
import {afterAll,describe,it,vi} from 'vitest'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(process.env.TAKO_TEST_NOW||'2026-10-24T15:55:00Z'))})
vi.mock('../../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./route-harness.js')).onboardingMock)
vi.mock('../../packages/db/src/index.ts',async()=>(await import('./route-harness.js')).dbMock)
vi.mock('../../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./route-harness.js')).storeMock)
import {readFileSync,writeFileSync} from 'node:fs'
import {createAnthropic} from './anthropic-cache.js'
import {closeHarness,createRouteBot,installNet} from './route-harness.js'
import {brainSql,resetBrainTables} from './adapters/new-bot.js'
import type {Conversation,Turn} from './types.js'

const ON=process.env.TAKO_SOST==='1',realFetch=globalThis.fetch
afterAll(()=>closeHarness())
type Case={id:string,turns:(string|Turn)[]}
const label=(w:any)=>{const out:Record<string,string[]>={};for(const m of w.menus){for(const s of m.sections)out[m.name+'›'+s.name]=s.items.filter((i:any)=>!i.hidden).map((i:any)=>i.name+(i.available===false?' (finito)':'')+(Number(i.price)?' '+i.price:''));for(const f of m.formulas??[])out[m.name+'›opzione '+f.name]=[String(f.price)]}return out}
const diff=(a:any,b:any)=>{const x=label(a),y=label(b),d:string[]=[];for(const k of new Set([...Object.keys(x),...Object.keys(y)]))if(JSON.stringify(x[k])!==JSON.stringify(y[k]))d.push(k+': '+(x[k]??[]).join(', ')+' → '+(y[k]??[]).join(', '));return d}

describe.skipIf(!ON)('caccia sostituzioni 24/10',()=>{
 it('gira i casi',async()=>{
  const cases=JSON.parse(readFileSync(process.env.TAKO_SOST_CASES!,'utf8')) as Case[],fixture=JSON.parse(readFileSync(process.env.TAKO_SOST_FIXTURE!,'utf8'))
  const only=process.env.TAKO_SOST_ONLY?.split(',')
  const anth=createAnthropic({cacheDir:new URL('./cache/anthropic/calls/',import.meta.url).pathname,ledgerFile:new URL('./cache/anthropic/ledger.json',import.meta.url).pathname,realFetch,set:'sost-1024'})
  installNet(null,realFetch,anth);process.env.ANTHROPIC_API_KEY='eval-anthropic-key';if(!process.env.GROQ_API_KEY)process.env.GROQ_API_KEY='eval-no-groq';delete process.env.TAKO_BOT_BRAIN_OFF
  const bot=createRouteBot({name:'haiku',settings:{botBrain:true,botEngine:'haiku'},extraSql:brainSql})
  const out:any[]=[]
  for(const c of cases){if(only&&!only.includes(c.id))continue
   resetBrainTables()
   const conv:Conversation={id:c.id,family:'manuel',menu:'victoria',turns:c.turns.map(t=>typeof t==='string'?{text:t}:t) as Turn[],changes:[]}
   const t0=performance.now();let run:any
   try{run=await bot.run(conv,structuredClone(fixture),{restaurant:'Victoria (copia)'})}catch(e){out.push({id:c.id,error:String((e as any)?.stack??e).slice(0,500)});continue}
   let prev=structuredClone(fixture);const turns=[] as any[]
   const said=conv.turns.filter(t=>!('wait' in t)&&!('dash' in t)) as any[]
   run.turns.forEach((t:any,i:number)=>{turns.push({said:said[i]?.text??said[i]?.voice,reply:t.reply.replace(/^Sono l.*?persona\.\s*/s,''),ms:t.latencyMs,llm:t.llm?.calls,miss:t.llm?.misses,diff:diff(prev,t.menuAfter)});prev=t.menuAfter})
   out.push({id:c.id,turns,final:label(run.finalMenu),pending:run.pending??null,ms:Math.round(performance.now()-t0)})
   writeFileSync(process.env.TAKO_SOST_OUT!,JSON.stringify(out,null,1))}
  anth.finish()
  writeFileSync(process.env.TAKO_SOST_OUT!,JSON.stringify(out,null,1))
  console.log('SPESA giro',JSON.stringify({real:anth.stats.real,hits:anth.stats.hits,misses:anth.stats.misses,usd:anth.stats.usd}))
 },3_600_000)
})
