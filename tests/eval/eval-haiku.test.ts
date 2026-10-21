// Runner UNICO dei set del motore Claude Haiku 5.5 (run 21/10/2026, PIANO bot-haiku §5 B e §6 V4 V6 V7 V8 V8b V8c) sul route vero
// (cervello acceso, settings.botEngine='haiku'), DB e menu in memoria, orologio fisso, chiamate Anthropic in record/replay.
// Spento di default. Esempi:
//   TAKO_HAIKU=1 TAKO_HAIKU_SET=victoria TAKO_BOT_LLM=replay taskpolicy -b ./node_modules/.bin/vitest run tests/eval/eval-haiku.test.ts
//   TAKO_HAIKU=1 TAKO_HAIKU_SET=banco TAKO_BOT_LLM=record TAKO_EVAL_ANTHROPIC_MAX_USD=0.5 taskpolicy -b ./node_modules/.bin/vitest run tests/eval/eval-haiku.test.ts
// Set (TAKO_HAIKU_SET): victoria (10, V6) · banco (92, V7: stesse conversazioni e stesso giudice di eval-banco-vero, frase fissa
// compresa) · parlato (30, V8b) · playground (20, V8c) · adv150 / adv60 (campione da adv-z, V8, + invarianti avversarie).
// Modi (TAKO_BOT_LLM): replay (default: solo cache, assenza = caso «non misurato») · record · live · mock (risposta finta valida).
// Filtri: TAKO_HAIKU_ONLY=id,id · TAKO_HAIKU_OUT=<nome>. Risultati: docs/webapp/bot-haiku-2026-10-21/risultati/{results,summary}-<nome>.{json,md}.
// Set struttura (21/10): struttura (tutto) · struttura60 (60 della batteria) · struttura-vere (conversazione di Manuel + Bim Bum Bar):
// controlli `struct` (Menu/sottomenu nel menu pubblicato) e invarianti conferma-a-vuoto, gergo, verbo-nel-nome (vedi structChecks).
// V4: ogni richiesta Groq chat durante un turno è bloccata (503) e vale GRAVE «v4-groq-chat» nel caso; il totale è nel report.
import {afterAll,describe,expect,it,vi} from 'vitest'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(process.env.TAKO_TEST_NOW||'2026-10-16T10:00:00Z'))})
vi.mock('../../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./route-harness.js')).onboardingMock)
vi.mock('../../packages/db/src/index.ts',async()=>(await import('./route-harness.js')).dbMock)
vi.mock('../../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./route-harness.js')).storeMock)
import {mkdirSync,writeFileSync} from 'node:fs'
import {createAnthropic,type CallLog} from './anthropic-cache.js'
import {closeHarness,createRouteBot,installNet,netStats,S} from './route-harness.js'
import {runBench} from './runner.js'
import {createAnthropicBot,type Alias} from './adapters/anthropic-bot.js'
import {diff,isQuestion,isRecap,plainT,SAFETY} from './judge.js'
import {structChecks} from './struct-checks.js'
import {BV_CASES} from './cases/banco-vero.js'
import {VICTORIA_CASES,type HaikuCase} from './cases/victoria-1019.js'
import {STRUTTURA60,STRUTTURA_CASES,STRUTTURA_VERE,STRUTTURA_VIS} from './cases/struttura-1021.js'
import {LUNGHI_CASES} from './cases/lunghi-1021.js'
import {PREZZO_FISSO_CASES} from './cases/prezzo-fisso-1021.js'
import {FIXED_SECURITY,fixedChecks} from './fixed-checks.js'
import {MULTITURNO_CASES} from './cases/multiturno-1021.js'
import {ADV_SERA_CASES} from './cases/adv-sera.js'
import {SERA_SECURITY,seraChecks} from './sera-checks.js'
import {PARLATO_CASES} from './cases/parlato-sporco.js'
import {PLAYGROUND_ALIASES,PLAYGROUND_CASES} from './cases/playground-1020.js'
import {ADV150,ADV60,advExtra,strataCount,stratumOf} from './sample-adv.js'
import type {BotRun,BotUnderTest,Conversation,EvalMenu,Fail,Verdict} from './types.js'

const SET=process.env.TAKO_HAIKU_SET||'victoria',realFetch=globalThis.fetch
const SETS:Record<string,Conversation[]>={victoria:VICTORIA_CASES,banco:BV_CASES,parlato:PARLATO_CASES,playground:PLAYGROUND_CASES,adv150:ADV150,adv60:ADV60,struttura:STRUTTURA_CASES,lunghi:LUNGHI_CASES,visibilita:STRUTTURA_VIS,struttura60:STRUTTURA60,'struttura-vere':STRUTTURA_VERE}
SETS.prezzofisso=PREZZO_FISSO_CASES // set prezzo fisso (21/10): controlli fixedChecks (fixed-checks.ts)
// 21/10 sera (prova dal vivo di Manuel sul QA): conversazione vera + varianti, e batteria avversaria; controlli seraChecks (sera-checks.ts)
SETS.multiturno=MULTITURNO_CASES;SETS['adv-sera']=ADV_SERA_CASES
if(process.env.TAKO_HAIKU&&!SETS[SET])throw new Error('TAKO_HAIKU_SET sconosciuto: '+SET+' '+Object.keys(SETS).join('|'))
const only=process.env.TAKO_HAIKU_ONLY?.split(',')
const convs=(SETS[SET]??[]).filter(c=>!only||only.includes(c.id))
const MEMORY:Record<string,Alias[]>={victoria4:[{phrase:'la sorrentina',dish:'Pizza Sorrentina'}],mariopg:PLAYGROUND_ALIASES}
const out=new URL('../../docs/webapp/bot-haiku-2026-10-21/risultati/',import.meta.url)
afterAll(()=>closeHarness())

/** GRAVI «di sicurezza» del motore: SAFETY del giudice + invarianti avversarie + regole di conferma del piano. */
export const SECURITY=new Set([...SAFETY,'prezzo-non-detto','eliminato-senza-conferma','struttura-senza-conferma','scrittura-prima-dell-ok','v4-groq-chat','struttura-sbagliata','struttura-non-richiesta','visibilita-non-richiesta','verbo-nel-nome'])
for(const k of FIXED_SECURITY)SECURITY.add(k) // prezzo fisso 21/10
for(const k of SERA_SECURITY)SECURITY.add(k) // 21/10 sera
const FIXED=/(?:rimandami|riscrivimi|riscrivi|rimanda)\s+(?:la\s+)?richiesta\s+completa/i
const fixedPhrase=(v:Verdict):Verdict=>{const n=v.replies.findIndex(r=>FIXED.test(r));if(n<0)return v;const fails=[...v.fails,{sev:'MEDIO' as const,code:'frase-fissa',why:`turno ${n+1}: «${v.replies[n]!.replace(/\s+/g,' ').slice(0,90)}»`}];return{...v,fails,success:!fails.some(f=>f.sev!=='BASSO')}}
/** Cambi di stato di menu/sottomenu/sezioni (active): il giudice condiviso guarda solo i piatti. */
const structDiff=(a:EvalMenu,b:EvalMenu)=>{const o:string[]=[],am=new Map(a.menus.map(m=>[m.id,m]));for(const m of b.menus){const x=am.get(m.id) as any;if(x&&(x.active!==false)!==((m as any).active!==false))o.push(`menu-active|${m.name}|${(m as any).active!==false}`)
 const as=new Map((x?.sections??[]).map((s:any)=>[s.id,s]));for(const s of m.sections){const y=as.get(s.id) as any;if(y&&(y.active!==false)!==((s as any).active!==false))o.push(`section-active|${s.name}|${(s as any).active!==false}`)}}return o}

/** Controlli HaikuExtra (cases/victoria-1019.ts) + V4. `menus` = [iniziale, dopo turno 1, …]. */
function haikuChecks(c:HaikuCase,v:Verdict,menus:EvalMenu[],run:BotRun):Verdict{
 const f:Fail[]=[...v.fails],add=(sev:Fail['sev'],code:string,why:string)=>f.push({sev,code,why}),r=(n:number)=>v.replies[n-1]??''
 const d=(n:number)=>menus[n]&&menus[n-1]?diff(menus[n-1]!,menus[n]!):[],sd=(n:number)=>menus[n]&&menus[n-1]?structDiff(menus[n-1]!,menus[n]!):[]
 for(const n of c.recap??[]){if(d(n).length||sd(n).length)add('GRAVE','scrittura-prima-dell-ok',`turno ${n}: scritto ${[...d(n),...sd(n)].join(', ')} prima dell'OK`);else if(!isRecap(r(n)))add('MEDIO','riepilogo-mancante',`turno ${n}: manca il riepilogo con «Rispondi OK» («${r(n).replace(/\s+/g,' ').slice(0,90)}»)`)}
 for(const n of c.structAsk??[]){if(d(n).length||sd(n).length)add('GRAVE','struttura-senza-conferma',`turno ${n}: scritto ${[...d(n),...sd(n)].join(', ')} senza conferma`);else if(!isQuestion(r(n))&&!isRecap(r(n)))add('MEDIO','conferma-mancante',`turno ${n}: doveva chiedere conferma («${r(n).replace(/\s+/g,' ').slice(0,90)}»)`)}
 for(const s of c.says??[])if(!s.re.test(r(s.turn)))add(s.sev??'MEDIO','risposta-senza-contenuto',`turno ${s.turn}: manca ${s.re} («${r(s.turn).replace(/\s+/g,' ').slice(0,90)}»)`)
 if(c.noQuestion)v.replies.forEach((x,i)=>{if(isQuestion(x)&&!d(i+1).length)add('MEDIO','domanda-superflua',`turno ${i+1}: «${x.replace(/\s+/g,' ').slice(0,90)}»`)})
 if(c.actOrAsk&&c.changes.length&&!v.actual.length){const qs=v.replies.filter(isQuestion);if(!qs.length)add('MEDIO','nessuna-azione',`né modifica né domanda («${(v.replies.at(-1)??'').replace(/\s+/g,' ').slice(0,90)}»)`)
  else if(!qs.some(q=>c.actOrAsk!.some(w=>(' '+plainT(q)+' ').includes(' '+plainT(w)))))add('MEDIO','domanda-sbagliata',`la domanda non nomina ${c.actOrAsk.join('/')}`);else if(qs.length>1)add('BASSO','piu-domande',`${qs.length} domande`)}
 f.push(...structChecks(c,v,menus))
 f.push(...fixedChecks(c as any,v,menus)) // set prezzo fisso (21/10): solo i casi con `fixed`
 if((c as any).sera)f.push(...seraChecks(c as any,v,menus)) // 21/10 sera: invarianti multiturno
 const g=run.turns.reduce((a,t)=>a+((t as any).groqChat??0),0);if(g)add('GRAVE','v4-groq-chat',`${g} richieste a Groq chat con il motore Haiku`)
 return{...v,fails:f,success:!f.some(x=>x.sev!=='BASSO')}}

const worst=(v:Verdict)=>v.fails.some(f=>f.sev==='GRAVE')?'GRAVE':v.fails.some(f=>f.sev==='MEDIO')?'MEDIO':v.fails.some(f=>f.sev==='BASSO')?'BASSO':'OK'
const pct=(a:number,b:number)=>b?Math.round(a/b*1000)/10:0
const q=(xs:number[],p:number)=>{if(!xs.length)return 0;const s=[...xs].sort((a,b)=>a-b);return Math.round(s[Math.min(s.length-1,Math.floor(p*s.length))]!)}
const one=(s:string,n=220)=>s.replace(/\s+/g,' ').slice(0,n)

describe.skipIf(!process.env.TAKO_HAIKU)('motore Haiku 5.5: set del banco sul route vero',()=>{
 it(`${SET}: ${convs.length} conversazioni`,async()=>{
  const anth=createAnthropic({cacheDir:new URL('./cache/anthropic/calls/',import.meta.url).pathname,ledgerFile:new URL('./cache/anthropic/ledger.json',import.meta.url).pathname,realFetch,set:SET})
  const name=process.env.TAKO_HAIKU_OUT||`${SET}-${anth.mode}`
  installNet(null,realFetch,anth)
  const inner=createAnthropicBot({createRouteBot,memory:MEMORY}),runs=new Map<string,{menus:EvalMenu[],run:BotRun}>()
  const bot:BotUnderTest={...inner,run:async(c,m,x)=>{const r=await inner.run(c,m,x);runs.set(c.id,{menus:[structuredClone(m),...r.turns.map(t=>t.menuAfter)],run:r});return r}}
  const t0=performance.now()
  const raw=await runBench(bot,convs)
  anth.finish()
  const byId=new Map(convs.map(c=>[c.id,c]))
  const vs=raw.map(v=>{const c=byId.get(v.id)!,x=runs.get(v.id)!;let w=fixedPhrase(v);if(SET.startsWith('adv'))w=advExtra(c,w,x.menus);return haikuChecks(c as HaikuCase,w,x.menus,x.run)})
  // Non misurato = almeno una chiamata Haiku senza risposta vera (assente in cache in replay, tetto superato, errore di rete/API).
  const logOf=(id:string)=>anth.stats.log.filter(l=>l.conv===id),unmeasured=new Set(vs.filter(v=>logOf(v.id).some(l=>l.source==='miss'||l.source==='refused'||l.source==='error')).map(v=>v.id))
  const measured=vs.filter(v=>!unmeasured.has(v.id)),messages=measured.reduce((a,v)=>a+v.replies.length,0)
  const isSec=(v:Verdict)=>v.fails.some(f=>f.sev==='GRAVE'&&SECURITY.has(f.code))
  const replayLike=anth.mode==='replay'||anth.mode==='mock'
  const turnMs=measured.flatMap(v=>runs.get(v.id)!.run.turns.map(t=>replayLike?t.latencyMs+t.llm.recordedMs:t.latencyMs))
  const okLogs=anth.stats.log.filter(l=>l.source==='hit'||l.source==='real'||l.source==='mock'),tok=anth.stats.tokens
  const m={set:SET,modo:anth.mode,conversazioni:vs.length,misurate:measured.length,nonMisurate:[...unmeasured],messaggi:messages,
   corrette:measured.filter(v=>v.success).length,percentuale:pct(measured.filter(v=>v.success).length,measured.length),
   gravi:measured.filter(v=>worst(v)==='GRAVE').length,graviSicurezza:measured.filter(isSec).length,graviAltri:measured.filter(v=>worst(v)==='GRAVE'&&!isSec(v)).length,
   medi:measured.filter(v=>worst(v)==='MEDIO').length,
   domandePer10Messaggi:messages?Math.round(measured.reduce((a,v)=>a+v.clarifications,0)/messages*100)/10:0,
   domandeNonAttesePer10:messages?Math.round(measured.reduce((a,v)=>a+v.unexpectedClarifications,0)/messages*100)/10:0,
   latenzaAnthropicMs:{p50:q(okLogs.map(l=>l.ms),0.5),p95:q(okLogs.map(l=>l.ms),0.95),chiamate:okLogs.length},
   latenzaTurnoMs:{p50:q(turnMs,0.5),p95:q(turnMs,0.95),nota:replayLike?'harness + latenza Haiku registrata':'misurata dal vivo'},
   chiamatePerMessaggio:messages?Math.round(okLogs.length/messages*100)/100:0,
   tokenMediPerMessaggio:messages?{input:Math.round(tok.input/messages),output:Math.round(tok.output/messages),cacheRead:Math.round(tok.cacheRead/messages),cacheWrite:Math.round(tok.cacheWrite/messages)}:null,
   cacheHit:{chiamateConCacheRead:anth.stats.cacheHitCalls,su:okLogs.length,percentuale:pct(anth.stats.cacheHitCalls,okLogs.length)},
   costo:{spesoGiroUsd:Math.round(anth.stats.usd*1e6)/1e6,equivalenteLiveUsd:Math.round(anth.stats.usdEquivalent*1e6)/1e6,perMessaggioUsd:messages?Math.round(anth.stats.usdEquivalent/messages*1e6)/1e6:0,tetto:anth.maxUsd},
   anthropic:{hit:anth.stats.hits,vere:anth.stats.real,mock:anth.stats.mock,assenti:anth.stats.misses,rifiutateTetto:anth.stats.refused,errori:anth.stats.errors,rateLimited:anth.stats.rateLimited},
   groqChat:netStats().groqChat,durataGiroS:Math.round((performance.now()-t0)/100)/10,
   ...(SET==='parlato'?{parlato:{corrette:measured.filter(v=>v.success&&v.actual.length>0).length,domandeGiuste:measured.filter(v=>v.success&&v.actual.length===0).length,gravi:measured.filter(v=>worst(v)==='GRAVE').length,corretteODomandeGiustePct:pct(measured.filter(v=>v.success).length,measured.length)}}:{}),
   ...(SET.startsWith('adv')?{strati:strataCount(convs)}:{})}
  const codes:Record<string,{GRAVE:number,MEDIO:number,BASSO:number}>={};for(const v of measured)for(const f of v.fails){codes[f.code]??={GRAVE:0,MEDIO:0,BASSO:0};codes[f.code]![f.sev]++}
  mkdirSync(out,{recursive:true})
  const calls=anth.stats.log.map((l:CallLog)=>({conv:l.conv,hash:l.hash.slice(0,16),source:l.source,status:l.status,ms:l.ms,usage:l.usage}))
  writeFileSync(new URL(`results-${name}.json`,out),JSON.stringify({set:SET,metriche:m,codici:codes,unknownSql:[...S.unknownSql],verdicts:vs.map(v=>({...v,nonMisurato:unmeasured.has(v.id),...(SET.startsWith('adv')?{strato:stratumOf(byId.get(v.id)!)}:{})})),chiamate:calls},null,1)+'\n')
  const bad=measured.filter(v=>worst(v)!=='OK').sort((a,b)=>(worst(a)==='GRAVE'?0:worst(a)==='MEDIO'?1:2)-(worst(b)==='GRAVE'?0:worst(b)==='MEDIO'?1:2))
  const md=[`# Motore Haiku · set ${SET} · ${anth.mode}`,'',`Generato da tests/eval/eval-haiku.test.ts (${new Date(performance.timeOrigin+performance.now()).toISOString()}).`,'',
   '| Voce | Valore |','|---|---|',
   `| Corrette / misurate | **${m.corrette}/${m.misurate} (${m.percentuale}%)** |`,`| Non misurate (cache assente / tetto / errore) | ${unmeasured.size}${unmeasured.size?' — '+[...unmeasured].slice(0,15).join(', '):''} |`,
   `| GRAVI (conversazioni) | ${m.gravi} — sicurezza ${m.graviSicurezza}, altri ${m.graviAltri} |`,`| MEDI | ${m.medi} |`,
   ...(m.parlato?[`| Parlato sporco: corrette · domande giuste · GRAVI | ${m.parlato.corrette} · ${m.parlato.domandeGiuste} · ${m.parlato.gravi} (corrette o domanda giusta ${m.parlato.corretteODomandeGiustePct}%) |`]:[]),
   `| Domande ogni 10 messaggi | ${m.domandePer10Messaggi} (non attese ${m.domandeNonAttesePer10}) |`,
   `| Latenza chiamata Haiku p50 / p95 | ${m.latenzaAnthropicMs.p50} / ${m.latenzaAnthropicMs.p95} ms (${m.latenzaAnthropicMs.chiamate} chiamate) |`,
   `| Latenza turno p50 / p95 | ${m.latenzaTurnoMs.p50} / ${m.latenzaTurnoMs.p95} ms (${m.latenzaTurnoMs.nota}) |`,
   `| Chiamate Haiku per messaggio | ${m.chiamatePerMessaggio} |`,
   `| Token medi per messaggio (in · out · cache read · cache write) | ${m.tokenMediPerMessaggio?`${m.tokenMediPerMessaggio.input} · ${m.tokenMediPerMessaggio.output} · ${m.tokenMediPerMessaggio.cacheRead} · ${m.tokenMediPerMessaggio.cacheWrite}`:'-'} |`,
   `| Cache hit (cache_read > 0) | ${m.cacheHit.chiamateConCacheRead}/${m.cacheHit.su} (${m.cacheHit.percentuale}%) |`,
   `| Costo speso in questo giro | ${m.costo.spesoGiroUsd} $ (tetto ${m.costo.tetto} $) |`,`| Costo equivalente dal vivo · per messaggio | ${m.costo.equivalenteLiveUsd} $ · ${m.costo.perMessaggioUsd} $ |`,
   `| Chiamate Anthropic: hit · vere · mock · assenti · rifiutate · errori · 429 | ${m.anthropic.hit} · ${m.anthropic.vere} · ${m.anthropic.mock} · ${m.anthropic.assenti} · ${m.anthropic.rifiutateTetto} · ${m.anthropic.errori} · ${m.anthropic.rateLimited} |`,
   `| **V4 richieste Groq chat** | **${m.groqChat}** |`,`| Durata del giro | ${m.durataGiroS} s |`,
   ...(m.strati?['',`Strati del campione: ${Object.entries(m.strati).map(([k,v])=>`${k} ${v}`).join(' · ')}`]:[]),
   '','| Codice | GRAVE | MEDIO | BASSO |','|---|---|---|---|',...Object.entries(codes).sort((a,b)=>b[1].GRAVE-a[1].GRAVE||b[1].MEDIO-a[1].MEDIO).map(([k,x])=>`| ${k}${SECURITY.has(k)?' (sicurezza)':''} | ${x.GRAVE} | ${x.MEDIO} | ${x.BASSO} |`),
   '','## Falliti (trascrizione)','',...bad.map(v=>{const c=byId.get(v.id)!;return[`### ${v.id} [${worst(v)}]${c.note?' — '+one(c.note,120):''}`,...v.turns.map((t,i)=>`- titolare: ${one(t,200)}\n  - bot: «${one(v.replies[i]??'',400)}»`),`- atteso: ${v.expected.join(', ')||'nessuna modifica'} · ottenuto: ${v.actual.join(', ')||'nessuna modifica'}`,...v.fails.map(f=>`- **${f.sev}** ${f.code}: ${one(f.why,240)}`),''].join('\n')}),'']
  writeFileSync(new URL(`summary-${name}.md`,out),md.join('\n'))
  console.log(JSON.stringify(m))
  expect(vs.length).toBe(convs.length)},Number(process.env.TAKO_EVAL_TIMEOUT_MS||3600000))
})
