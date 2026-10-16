// Grader deterministico: confronta le operazioni attese con quelle del modello.
// esatto = tutte le azioni attese presenti, nessuna azione in più (keep/none non contano come azioni)
// innocuo = solo domande in più / azione sostituita da una domanda / dati locale o «non supportato» in più
// grave = prezzo o piatto sbagliato, azione persa o opposta, modifica non richiesta, azione dove serviva una domanda
// node --experimental-strip-types grade.ts  → results/<modello>.json + results/summary.json
import {readFileSync,writeFileSync,readdirSync} from 'node:fs'
const here=new URL('.',import.meta.url)
const cases=new Map(readFileSync(new URL('eval/cases.jsonl',here),'utf8').trim().split('\n').map(l=>{const c=JSON.parse(l);return[c.id,c]}))
const W:Record<string,string>={'1':'uno','2':'due','3':'tre','4':'quattro','5':'cinque','6':'sei','7':'sette','8':'otto','9':'nove','10':'dieci'}
const norm=(s?:string)=>String(s??'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’']/g,' ').replace(/\b\d+\b/g,d=>W[d]??d).replace(/\b(il|lo|la|i|gli|le|l|un|una|uno|del|della|pizza|menu)\b/g,' ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()
const lev=(a:string,b:string)=>{const d=Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]);for(let j=1;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length]}
const same=(a?:string,b?:string)=>{const x=norm(a),y=norm(b);return x===y||(Math.min(x.length,y.length)>6&&lev(x,y)<=2)}
const eq=(a?:number,b?:number)=>a!==undefined&&b!==undefined&&Math.abs(Number(a)-Number(b))<0.001
const optSame=(e?:string,g?:string)=>!e||!g||same(e,g)
const priceOf=(c:any,piatto?:string)=>{for(const m of Object.values(c.stato.menu) as any[])for(const cat of Object.values(m) as any[])for(const [n,p] of Object.entries(cat))if(same(n,piatto))return p as number}
const NONACT=new Set(['keep','none'])
function matches(e:any,g:any,c:any){
 if(e.op==='ask')return g.op==='ask'
 if(e.op==='unsupported')return g.op==='unsupported'
 if(e.op==='info_locale')return g.op==='info_locale'&&same(e.campo,g.campo)
 if(e.op==='delta_price'){if(g.op==='delta_price')return same(e.piatto,g.piatto)&&eq(e.delta,g.delta);const p=priceOf(c,e.piatto);return g.op==='set_price'&&same(e.piatto,g.piatto)&&p!==undefined&&eq(p+e.delta,g.prezzo)}
 if(e.op!==g.op)return false
 if(!same(e.piatto,g.piatto))return false
 if(e.op==='add')return eq(e.prezzo,g.prezzo)&&optSame(e.menu,g.menu)&&optSame(e.categoria,g.categoria)
 if(e.op==='set_price')return eq(e.prezzo,g.prezzo)&&optSame(e.menu,g.menu)
 if(e.op==='rename')return same(e.nuovo_nome,g.nuovo_nome)
 if(e.op==='move')return optSame(e.categoria,g.categoria)&&optSame(e.menu,g.menu)
 return true}
function grade(c:any,got:any[]|null){
 if(!got)return{esito:'grave',motivo:['JSON non valido']}
 const exp=c.atteso.filter((o:any)=>!NONACT.has(o.op)),g=got.filter(o=>o&&!NONACT.has(o.op)),used=new Set<number>(),motivo:string[]=[];let grave=false,innocuo=false
 for(const e of exp){const i=g.findIndex((o,k)=>!used.has(k)&&matches(e,o,c));if(i>=0){used.add(i);continue}
  if(e.op==='ask'){motivo.push('domanda attesa mancante');innocuo=true;continue}
  const j=g.findIndex((o,k)=>!used.has(k)&&o.op==='ask');if(j>=0){used.add(j);innocuo=true;motivo.push(`${e.op} ${e.piatto??e.campo??''} → domanda`);continue}
  if(e.op==='unsupported'||e.op==='info_locale'){innocuo=true;motivo.push(`${e.op} mancante`);continue}
  grave=true;motivo.push(`perso/sbagliato: ${e.op} ${e.piatto??''} ${e.prezzo??e.delta??''}`.trim())}
 g.forEach((o,k)=>{if(used.has(k))return;if(['ask','unsupported','info_locale'].includes(o.op)){innocuo=true;motivo.push(`in più: ${o.op}`)}else{grave=true;motivo.push(`in più: ${o.op} ${o.piatto??''} ${o.prezzo??o.delta??''}`.trim())}})
 return{esito:grave?'grave':innocuo?'innocuo':'esatto',motivo}}
const pct=(a:number,b:number)=>b?Math.round(a/b*1000)/10:0
const q=(a:number[],p:number)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.min(s.length-1,Math.floor(p*s.length))]:0}
// prezzi USD per 1M token (in/out), fonti nel REPORT
const PRICE:Record<string,[number,number]>={'openai/gpt-oss-120b':[0.15,0.6],'openai/gpt-oss-20b':[0.075,0.3],'qwen/qwen3.8-27b':[0.8,4]}
const summary:any[]=[]
for(const f of readdirSync(new URL('results/',here)).filter(f=>f.startsWith('raw-'))){
 const raw=JSON.parse(readFileSync(new URL(`results/${f}`,here),'utf8'))
 const rows=raw.results.map((r:any)=>{const c=cases.get(r.id);return{...r,difficolta:c.difficolta,parser:c.parser,messaggio:c.messaggio,atteso:c.atteso,...grade(c,r.valid?r.ops:null)}})
 const stat=(rs:any[])=>{const ok=rs.filter(r=>!r.error||r.valid);const tin=rs.reduce((a,r)=>a+r.tin,0),tout=rs.reduce((a,r)=>a+r.tout,0),[pi,po]=PRICE[raw.model]??[0,0]
  return{n:rs.length,esatti:pct(rs.filter(r=>r.esito==='esatto').length,rs.length),innocui:pct(rs.filter(r=>r.esito==='innocuo').length,rs.length),gravi:pct(rs.filter(r=>r.esito==='grave').length,rs.length),jsonNonValido:pct(rs.filter(r=>!r.valid).length,rs.length),jsonRitentato:pct(rs.filter(r=>r.jsonFail).length,rs.length),p50ms:q(ok.map(r=>r.ms),0.5),p95ms:q(ok.map(r=>r.ms),0.95),tokenInMedi:Math.round(tin/rs.length),tokenOutMedi:Math.round(tout/rs.length),costoUsdPer1000:Math.round((tin*pi+tout*po)/1e6/rs.length*1000*1000)/1000}}
 const s={provider:raw.provider,model:raw.model,sample:raw.sample,totale:stat(rows),facile:stat(rows.filter((r:any)=>r.difficolta==='facile')),medio:stat(rows.filter((r:any)=>r.difficolta==='medio')),difficile:stat(rows.filter((r:any)=>r.difficolta==='difficile')),parserNo:stat(rows.filter((r:any)=>r.parser==='no'))}
 summary.push(s)
 writeFileSync(new URL(`results/${f.slice(4)}`,here),JSON.stringify({...s,casi:rows.map((r:any)=>({id:r.id,difficolta:r.difficolta,esito:r.esito,motivo:r.motivo,ms:r.ms,messaggio:r.messaggio,atteso:r.atteso,ottenuto:r.ops}))},null,1))}
writeFileSync(new URL('results/summary.json',here),JSON.stringify(summary,null,1))
for(const s of summary)console.log(s.model.padEnd(22),JSON.stringify(s.totale),'\n  facile',s.facile.esatti,s.facile.gravi,'| medio',s.medio.esatti,s.medio.gravi,'| difficile',s.difficile.esatti,s.difficile.gravi)
