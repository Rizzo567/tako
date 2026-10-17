// Runner del banco E: fa girare le conversazioni su un BotUnderTest, applica il giudice, aggrega e scrive i risultati.
import {mkdirSync,writeFileSync} from 'node:fs'
import {FIXTURES,initialMenu} from './fixtures/menus.js'
import {judge,SAFETY} from './judge.js'
import {FAMILIES,V_FAMILIES,type BotUnderTest,type Conversation,type Verdict} from './types.js'

export async function runBench(bot:BotUnderTest,convs:Conversation[],onEach?:(v:Verdict)=>void):Promise<Verdict[]>{
 const out:Verdict[]=[]
 for(const c of convs){const menu=initialMenu(c.menu,c.mods),run=await bot.run(c,structuredClone(menu),{restaurant:FIXTURES[c.menu]!.restaurant})
  const v=judge(c,menu,run);out.push(v);onEach?.(v)}
 return out}

const worst=(v:Verdict)=>v.fails.some(f=>f.sev==='GRAVE')?'GRAVE':v.fails.some(f=>f.sev==='MEDIO')?'MEDIO':v.fails.some(f=>f.sev==='BASSO')?'BASSO':'OK'
const pct=(a:number,b:number)=>b?Math.round(a/b*1000)/10:0
const quant=(xs:number[],q:number)=>{if(!xs.length)return 0;const s=[...xs].sort((a,b)=>a-b);return Math.round(s[Math.min(s.length-1,Math.floor(q*s.length))]!*10)/10}
export type Row={family:string,n:number,ok:number,success:number,grave:number,medio:number,basso:number,safety:number,clarRate:number,unexpectedClar:number,usedLlm:number,llmMissConvs:number,detN:number,detSuccess:number}
export function summarize(vs:Verdict[]){
 const row=(family:string,xs:Verdict[]):Row=>{const turns=xs.reduce((a,v)=>a+v.replies.length,0),det=xs.filter(v=>!v.usedLlm)
  return{family,n:xs.length,ok:xs.filter(v=>worst(v)==='OK').length,success:xs.filter(v=>v.success).length,grave:xs.filter(v=>worst(v)==='GRAVE').length,medio:xs.filter(v=>worst(v)==='MEDIO').length,basso:xs.filter(v=>worst(v)==='BASSO').length,safety:xs.filter(v=>v.fails.some(f=>f.sev==='GRAVE'&&SAFETY.has(f.code))).length,clarRate:pct(xs.reduce((a,v)=>a+v.clarifications,0),turns),unexpectedClar:xs.reduce((a,v)=>a+v.unexpectedClarifications,0),usedLlm:xs.filter(v=>v.usedLlm).length,llmMissConvs:xs.filter(v=>v.llmMisses>0).length,detN:det.length,detSuccess:det.filter(v=>v.success).length}}
 const families=[...FAMILIES,...V_FAMILIES].filter(f=>vs.some(v=>v.family===f)).map(f=>row(f,vs.filter(v=>v.family===f)))
 const lat=vs.flatMap(v=>v.latencyMs),est=vs.flatMap(v=>v.latencyMs.map((l,i)=>i===v.latencyMs.length-1?l+v.recordedLlmMs:l))
 const codes:Record<string,{GRAVE:number,MEDIO:number,BASSO:number}>={};for(const v of vs)for(const f of v.fails){codes[f.code]??={GRAVE:0,MEDIO:0,BASSO:0};codes[f.code]![f.sev]++}
 const multi=vs.filter(v=>v.replies.length>1)
 return{total:row('TOTALE',vs),multi:row('multi-turno',multi),families,codes,latency:{harnessP50:quant(lat,0.5),harnessP95:quant(lat,0.95),withRecordedGroqP50:quant(est,0.5),withRecordedGroqP95:quant(est,0.95)},llm:{calls:vs.reduce((a,v)=>a+v.llmCalls,0),misses:vs.reduce((a,v)=>a+v.llmMisses,0),tokens:vs.reduce((a,v)=>a+v.llmTokens,0)}}}
export type Summary=ReturnType<typeof summarize>

export function markdown(name:string,s:Summary,meta:Record<string,unknown>){
 const head='| Famiglia | Conv. | Successo | OK | GRAVE | MEDIO | BASSO | GRAVI sicurezza | Chiarimenti/turni | Chiar. non attesi | Usa IA | IA mancante |\n|---|---|---|---|---|---|---|---|---|---|---|---|'
 const line=(r:Row)=>`| ${r.family} | ${r.n} | ${r.success} (${pct(r.success,r.n)}%) | ${r.ok} | ${r.grave} | ${r.medio} | ${r.basso} | ${r.safety} | ${r.clarRate}% | ${r.unexpectedClar} | ${r.usedLlm} | ${r.llmMissConvs} |`
 return[`# Banco E · ${name}`,'',`Generato da tests/eval (${Object.entries(meta).map(([k,v])=>`${k}=${v}`).join(', ')}).`,'',head,...s.families.map(line),line(s.multi),line(s.total),'',
  `Latenza harness (webhook→risposta, senza rete) p50 ${s.latency.harnessP50} ms · p95 ${s.latency.harnessP95} ms. Con la latenza Groq registrata: p50 ${s.latency.withRecordedGroqP50} ms · p95 ${s.latency.withRecordedGroqP95} ms.`,
  `IA: ${s.llm.calls} risposte (cache o vere), ${s.llm.misses} richieste senza risposta (Groq giù/cache assente), ${s.llm.tokens} token veri spesi in questo giro.`,'',
  '| Codice | GRAVE | MEDIO | BASSO |','|---|---|---|---|',...Object.entries(s.codes).sort((a,b)=>b[1].GRAVE-a[1].GRAVE||b[1].MEDIO-a[1].MEDIO).map(([c,x])=>`| ${c} | ${x.GRAVE} | ${x.MEDIO} | ${x.BASSO} |`),''].join('\n')}

export function writeResults(dir:URL,name:string,vs:Verdict[],meta:Record<string,unknown>,extra:Record<string,unknown>={}){
 mkdirSync(dir,{recursive:true});const s=summarize(vs)
 writeFileSync(new URL(`results-${name}.json`,dir),JSON.stringify({bot:name,meta,summary:s,...extra,verdicts:vs},null,1)+'\n')
 writeFileSync(new URL(`summary-${name}.md`,dir),markdown(name,s,meta)+'\n')
 return s}
