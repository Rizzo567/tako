// Batteria R9 (18/10/2026, agente R6): tests/eval/cases/adv-r9.ts sul route vero, cervello acceso, orologio fisso. Stesse invarianti
// della batteria R8 (copiate), più l'invariante R9 «mai la stessa domanda due volte di fila» (GRAVE). Oracolo: brain-oracle-r9.ts.
//   TAKO_ADV=1 npx vitest run tests/eval/eval-adv-r9.test.ts   (TAKO_ADV_MODES=oracle,off,adversary · TAKO_ADV_FAMILY=… · TAKO_ADV_ONLY=r9-…)
// Risultati in docs/webapp/bot-correzioni-2026-10-17/batteria-r9/.
import {afterAll,describe,expect,it,vi} from 'vitest'
vi.hoisted(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(process.env.TAKO_TEST_NOW||'2026-10-16T10:00:00Z'))})
vi.mock('../../apps/server/src/lib/onboarding-chat.js',async()=>(await import('./route-harness.js')).onboardingMock)
vi.mock('../../packages/db/src/index.ts',async()=>(await import('./route-harness.js')).dbMock)
vi.mock('../../apps/server/src/lib/menu-workspace-store.ts',async()=>(await import('./route-harness.js')).storeMock)
import {createHash} from 'node:crypto'
import {ADV_R9_CASES as A_CASES} from './cases/adv-r9.js'
import {r9Oracle,resetR9Oracle} from './adapters/brain-oracle-r9.js'
import {sameQuestion} from '../../apps/server/src/lib/owner-brain-r.js'
import {appendFileSync,writeFileSync} from 'node:fs'
import {createGroq} from './groq-cache.js'
import {closeHarness,createRouteBot,installNet} from './route-harness.js'
import {runBench,writeResults} from './runner.js'
import {createNewBot} from './adapters/new-bot.js'
import {brainOracle} from './adapters/brain-oracle.js'
import {attackR} from './adapters/brain-oracle-r.js'
import {currentOracle} from './adapters/current-oracle.js'
import {FIXTURES,initialMenu} from './fixtures/menus.js'
import {diff,flat,SAFETY,plainT} from './judge.js'
import type {BotUnderTest,Conversation,EvalMenu,Verdict} from './types.js'
import {sectionForms,courseRank} from '../../apps/server/src/lib/twilio-menu-structure.js'

const realFetch=globalThis.fetch
const out=new URL('../../docs/webapp/bot-correzioni-2026-10-17/batteria-r9/',import.meta.url)
const families=process.env.TAKO_ADV_FAMILY?.split(','),only=process.env.TAKO_ADV_ONLY?.split(',')
const convs=A_CASES.filter(c=>(!families||families.includes(c.source!.slice(3)))&&(!only||only.includes(c.id)))
const modes=(process.env.TAKO_ADV_MODES||'oracle,off,adversary').split(',')
afterAll(()=>closeHarness())

// ---------- prezzi detti dal titolare (parser indipendente dal codice del bot) ----------
const U:Record<string,number>={zero:0,uno:1,una:1,un:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,tredici:13,quattordici:14,quindici:15,sedici:16,diciassette:17,diciotto:18,diciannove:19,venti:20,trenta:30,quaranta:40,cinquanta:50,sessanta:60,settanta:70,ottanta:80,novanta:90,cento:100,centocinquanta:150,duecento:200}
const word=(w:string):number|null=>{if(w in U)return U[w]!;const m=w.match(/^(venti|trenta|quaranta|cinquanta|sessanta|settanta|ottanta|novanta)(uno|due|tre|quattro|cinque|sei|sette|otto|nove)$/)??w.match(/^(vent|trent|quarant|cinquant|sessant|settant|ottant|novant)(uno|otto)$/);if(m){const t=U[m[1]!]??U[m[1]!+'a']??U[m[1]!+'i']!;return t+U[m[2]!]!}return null}
const QTY_PREV=new Set(['quei','questi','quelle','queste','quelli','quegli','entrambi','entrambe','i','le','gli','ai','alle','dei','delle'])
export function saidPrices(text:string):number[]{const t=text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/(\d)[,.](\d)/g,'$1\u0000$2').replace(/[^a-z0-9\u0000]+/g,' ').trim().split(' ').map(x=>x.replace('\u0000','.')),o:number[]=[]
 const num=(w:string|undefined)=>w===undefined?null:/^\d+(\.\d{1,2})?$/.test(w)?Number(w):word(w)
 for(let i=0;i<t.length;i++){const v=num(t[i]);if(v===null)continue;const prev=t[i-1]??'',next=t[i+1]??''
  if(['un','una','uno'].includes(t[i]!)&&!['a','costa','costano','di','da','prezzo'].includes(prev)&&next!=='euro'&&next!=='e'&&next!=='virgola')continue
  if(v<=10&&next!=='euro'&&(QTY_PREV.has(prev)||(prev==='e'&&['tutti','tutte'].includes(t[i-2]??''))))continue
  // «50 centesimi»: un valore in euro (correzione A7 dell'invariante: prima contava 50 €).
  if(next==='centesimi'||next==='cent'){o.push(v/100);continue}
  o.push(v);let k=i+1;if(t[k]==='euro'){k++;if(/^\d{2}$/.test(t[k]??''))o.push(v+Number(t[k])/100)}
  if(t[k]==='e'){const c=num(t[k+1]);if(c!==null&&c>=10&&c<100)o.push(v+c/100);if(/^mezz/.test(t[k+1]??''))o.push(v+0.5)}
  if(t[k]==='virgola'){const c=num(t[k+1]);if(c!==null)o.push(Number(`${v}.${c}`))}}
 return o.map(x=>Math.round(x*100)/100)}
const menuPrices=(m:EvalMenu)=>[...flat(m).values()].flatMap(i=>[i.price,...(i.promo?[i.promo.price]:[])]).map(x=>Math.round(x*100)/100)
const textOf=(t:any)=>'text' in t?t.text:'voice' in t?t.voice:''

/** Invarianti in più per turno: nessun prezzo scritto che il titolare non ha detto (o che il menu non aveva già). */
function extra(c:Conversation,v:Verdict,menus:EvalMenu[]):Verdict{const fails=[...v.fails],said:number[]=[],seen=new Set<number>(menuPrices(menus[0]!))
 const turns=c.turns.filter(t=>!('wait' in t)&&!('dash' in t));turns.forEach((t,i)=>{said.push(...saidPrices(textOf(t)));const before=menus[i]!,after=menus[i+1];if(!after)return
  const old=new Map([...flat(before).values()].map(x=>[x.name,x.price]))
  for(const k of diff(before,after)){const p=k.split('|'),val=p[0]==='create'?Number(p[2]):p[0]==='price'||(p[0]==='promo'&&p[2]!=='null')?Number(p[2]):null;if(val===null)continue
   const o=old.get(p[1]!),delta=o!==undefined&&said.some(d=>Math.abs(Math.abs(val-o)-d)<0.005)
   if(!said.includes(Math.round(val*100)/100)&&!seen.has(Math.round(val*100)/100)&&!delta)fails.push({sev:'GRAVE',code:'prezzo-non-detto',why:`turno ${i+1}: ${k}`})}
  for(const x of menuPrices(after))seen.add(x)})
 // Fase B: eliminato senza conferma / categorie doppie / ordine delle portate.
 turns.forEach((t,i)=>{const before=menus[i]!,after=menus[i+1];if(!after)return;// R5.1 (nota 63): un piatto CREATO in questa conversazione e tolto da un annullamento («anzi no», «annulla» entro 10 min,
  // risposta «tolto (era stato aggiunto)») non è un'eliminazione senza conferma: è disfare la propria aggiunta (falso positivo y-lunghe-013).
  const born=new Set([...flat(menus[0]!).values()].map(x=>x.name)),undone=/era stato aggiunto/.test(v.replies[i]??'')
  const gone=diff(before,after).filter(k=>k.startsWith('delete|')&&!(undone&&!born.has(k.split('|')[1]!)))
  if(gone.length&&!(/^\s*(?:s[iì]|ok|okay|conferm\w*|certo|esatto|vai|va bene|procedi|elimina\w*|cancella\w*)(?=[\s,.!]|$)/i.test(textOf(t))&&v.replies.slice(0,i).some(r=>/Elimino |la creo|ecco le modifiche/.test(r)))&&!/lascia\w*\s+stare/i.test(textOf(t)))fails.push({sev:'GRAVE',code:'eliminato-senza-conferma',why:`turno ${i+1}: ${gone.join(', ')}`})
  for(const m of after.menus){const names=m.sections.map(s=>sectionForms(s.name));for(let a=0;a<names.length;a++)for(let b=a+1;b<names.length;b++)if([...names[a]!].some(f=>names[b]!.has(f)))fails.push({sev:'GRAVE',code:'categoria-doppia',why:`turno ${i+1}: ${m.sections[a]!.name} / ${m.sections[b]!.name}`})
   const old=new Set(before.menus.flatMap(x=>x.sections.map(s=>s.id)));m.sections.forEach((s,k)=>{if(old.has(s.id))return;const r=courseRank(s.name);if(!r)return;const prev=m.sections.slice(0,k).map(x=>courseRank(x.name)).filter(Boolean),next=m.sections.slice(k+1).map(x=>courseRank(x.name)).filter(Boolean);if(prev.some(x=>x>r)||next.some(x=>x<r))fails.push({sev:'MEDIO',code:'categoria-fuori-ordine',why:`turno ${i+1}: ${s.name}`})})}})
 // Y: un «sì» arrivato dopo 30 minuti (fuori dal contesto) non può eliminare né scrivere la cosa chiesta prima.
 {let k=0,late=false;for(const t of c.turns){if('dash' in t)continue;if('wait' in t){if(t.wait>=30)late=true;continue}const before=menus[k]!,after=menus[k+1];k++;if(!after){late=false;continue}
  if(late){const gone=diff(before,after).filter(x=>x.startsWith('delete|'));if(gone.length)fails.push({sev:'GRAVE',code:'eliminato-fuori-tempo',why:`turno ${k}: ${gone.join(', ')}`})}late=false}}
 // R8: «fatto» senza scrittura (riconoscitore largo, indipendente dal bot): nessuna riga riletta e nessun cambio del menu in quel turno.
 turns.forEach((t,i)=>{const before=menus[i]!,after=menus[i+1],r=v.replies[i]??'';if(!after)return;const wrote=diff(before,after).length>0||JSON.stringify(before)!==JSON.stringify(after)
  const body=r.replace(/^Sono l.*?persona\.\s*/s,'').split(/\n\n(?=Non ancora pubblicato|Da eliminare|Categoria nuova, serve|Non salvato|\d+\. )/)[0]!
  if(!wrote&&body.split(/(?<=[.!?\n])\s*/).some(x=>!/\?\s*$/.test(x.trim())&&DONE_R8.test(plainT(x))&&!/non ho|non (?:è|e) stat|niente|nessun/.test(plainT(x))))fails.push({sev:'GRAVE',code:'fatto-falso',why:`turno ${i+1}: «${r.replace(/\s+/g,' ').slice(0,100)}»`})})
 // Mai il solo «Non ho cambiato nulla.» su una richiesta con azioni chiare (la conversazione attende scritture o una domanda).
 v.replies.forEach((r,i)=>{if(/^(?:Sono l.*?persona\.\s*)?Non ho cambiato nulla\.$/s.test(r.trim())&&(c.changes.length||(c.alt??[]).some(a=>a.length)))fails.push({sev:'MEDIO',code:'solo-nulla',why:`turno ${i+1}`})})
 // R9: mai la stessa domanda due volte di fila (prima parte della risposta, senza i fatti).
 {const qOf=(r:string)=>{const b=r.replace(/^Sono l.*?persona\.\s*/s,'').split(/\n\n/)[0]!.trim();return /\?\s*$/.test(b)||/\b(?:rispondi|scrivi)\b/i.test(b)?b:''}
  v.replies.forEach((r,i)=>{if(!i)return;const a=qOf(v.replies[i-1]!),b=qOf(r);if(a&&b&&(a===b||sameQuestion(a,b))){const op=/Non ancora pubblicato:|Già nel menu:|^\d+\. \*/m.test(r)||/Non ancora pubblicato:|Già nel menu:|^\d+\. \*/m.test(v.replies[i-1]!)
   // GRAVE = la stessa domanda su un'operazione in sospeso (il bug dal vivo); MEDIO = domanda generica ripetuta senza nulla in sospeso.
   fails.push({sev:op?'GRAVE':'MEDIO',code:op?'domanda-ripetuta':'domanda-ripetuta-generica',why:`turno ${i+1}: «${b.slice(0,90)}»`})}})}
 const n=v.replies.findIndex(r=>FIXED.test(r));if(n>=0)fails.push({sev:'MEDIO',code:'frase-fissa',why:`turno ${n+1}`})
 // A4.5: con una cronologia (dal secondo turno) mai «non ho una richiesta recente» / domanda senza i piatti di cui si parlava.
 const lateAt=new Set<number>();{let k=0,late=false;for(const t of c.turns){if('dash' in t)continue;if('wait' in t){if(t.wait>=30)late=true;continue}if(late)lateAt.add(k);late=false;k++}}
 v.replies.forEach((r,i)=>{if(i>0&&!lateAt.has(i)&&/non ho una richiesta recente|a quale piatto ti riferisci/i.test(r))fails.push({sev:'MEDIO',code:'senza-contesto',why:`turno ${i+1}`})})
 // A4.2: le domande non portano esempi con prezzi o piatti mai detti («per esempio «12 euro»», «la gricia a 13»).
 v.replies.forEach((r,i)=>{for(const m of r.matchAll(/per esempio «([^»]+)»/gi)){const ex=m[1]!,said0=c.turns.slice(0,i+1).map(textOf).join(' ').toLowerCase();if(/\d/.test(ex)&&!saidPrices(ex).every(x=>saidPrices(said0).includes(x)))fails.push({sev:'MEDIO',code:'esempio-inventato',why:`turno ${i+1}: «${ex}»`})}})
 return{...v,fails,success:!fails.some(f=>f.sev!=='BASSO')}}
const DONE_R8=/\b(?:aggiunt[oaie]|creat[oaie]|inserit[oaie]|spostat[oaie]|rinominat[oaie]|eliminat[oaie]|cancellat[oaie]|aggiornat[oaie]|modificat[oaie]|impostat[oaie]|fatto|fatta|ho (?:messo|tolto|cambiato|aggiunto|creato|inserito|spostato|nascosto|eliminato|cancellato|rinominato|aggiornato|impostato))\b/
const FIXED=/(?:rimandami|riscrivimi|riscrivi|rimanda)\s+(?:la\s+)?richiesta\s+completa/i

// ---------- modello avversario ----------
const h=(s:string)=>parseInt(createHash('sha1').update(s).digest('hex').slice(0,8),16)
function adversary(conv:any,body:any):string|null{const good=r9Oracle(conv,body);if(good==null)return good
 let d:any;try{d=JSON.parse(good)}catch{return good};const msg=String(body?.messages?.at(-1)?.content??''),k=h(msg)
 if(body?.response_format?.json_schema?.name!=='owner_brain_plan')return good
 const codes=[...String(body.messages[1]?.content??'').matchAll(/^(p\d+)\|/gm)].map(m=>m[1]!)
 const wrongPrice=(p:number)=>[2,3,1,Math.round((p+0.01)*100)/100,p*10,p+7][k%6]!
 if(d.intent==='read'&&codes.length){d.intent='change';d.actions=[{action:'set_price',item:codes[k%codes.length],price:wrongPrice(10),section:null,price_ref:null,price_delta:null,value:null,tag:null,text:null,name:null,until:null}];return JSON.stringify(d)}
 // Fase B: il modello avversario elimina al posto di nascondere, rinomina o sposta a caso, crea categorie inventate.
 for(const a of d.actions??[]){if(a.action==='set_hidden'&&k%2===0){a.action='delete_item'}else if(a.item&&k%5===1){a.action='rename_item';a.name=msg.split(/\s+/).slice(-2).join(' ')}else if(a.item&&k%5===2){a.action='move_item';a.section='c'+(1+k%4)}}
 if(k%7===3)(d.actions??=[]).push({action:'create_section',item:null,section:null,price:null,price_ref:null,price_delta:null,value:null,tag:null,text:null,name:msg.split(/\s+/).slice(0,2).join(' '),until:null})
 for(const a of d.actions??[]){if(typeof a.price==='number')a.price=wrongPrice(a.price);if(a.item&&codes.length&&k%3===0)a.item=codes[(codes.indexOf(a.item)+1)%codes.length]}
 if(k%4===0)(d.actions??=[]).push({action:'create_item',item:null,section:'c1',price:wrongPrice(12),price_ref:null,price_delta:null,value:null,tag:null,text:null,name:msg.split(/\s+/).slice(-3).join(' '),until:null})
 d=attackR(d,k,codes) // fase R: conferme/annulla/scarta a caso, eliminazioni insieme a una conferma
 return JSON.stringify(d)}

const SECURITY=new Set([...SAFETY,'prezzo-non-detto','eliminato-senza-conferma','categoria-doppia','eliminato-fuori-tempo','domanda-ripetuta'])
// TAKO_Z_DUMP=file: scrive l'uscita dell'oracolo per ogni chiamata (per distinguere modello e validatore nel report).
const dump=(f:(conv:any,body:any)=>string|null)=>(conv:any,body:any)=>{const r=f(conv,body);if(process.env.TAKO_Z_DUMP)appendFileSync(process.env.TAKO_Z_DUMP,JSON.stringify({id:conv?.id,msg:String(body?.messages?.at(-1)?.content??'').slice(-(Number(process.env.TAKO_Z_DUMP_LEN)||200)),schema:body?.response_format?.json_schema?.name,out:r})+'\n');return r}
async function bench(mode:string){
 const groq=createGroq({mode:mode==='off'?'off':'oracle',cacheDir:new URL('./cache/groq/',import.meta.url).pathname,ledgerFile:new URL('./cache/token-ledger.json',import.meta.url).pathname,realFetch,oracle:dump(mode==='adversary'?adversary:(conv,body)=>r9Oracle(conv,body))});resetR9Oracle()
 installNet(groq,realFetch)
 const inner=createNewBot(createRouteBot),menus=new Map<string,EvalMenu[]>()
 const bot:BotUnderTest={...inner,run:async(c,m,x)=>{const r=await inner.run(c,m,x);menus.set(c.id,[structuredClone(m),...r.turns.map(t=>t.menuAfter)]);return r}}
 const vs=(await runBench(bot,convs)).map(v=>extra(convs.find(c=>c.id===v.id)!,v,menus.get(v.id)!))
 writeResults(out,`r9-${mode}`,vs,{groq:mode,bot:'nuovo',conversazioni:convs.length});writeFileSync(new URL(`famiglie-r9-${mode}.md`,out),byFamily(mode,vs))
 return vs}
const worst=(v:Verdict)=>v.fails.some(f=>f.sev==='GRAVE')?'GRAVE':v.fails.some(f=>f.sev==='MEDIO')?'MEDIO':'OK'
const show=(xs:Verdict[])=>xs.slice(0,12).map(v=>`${v.id}: ${v.fails.map(f=>f.code+' '+f.why.slice(0,110)).join(' | ')} ⟨${v.turns.join(' ⏎ ').slice(0,140)}⟩ → «${(v.replies.at(-1)??'').replace(/\s+/g,' ').slice(0,140)}»`).join('\n')

const SEC_ADV=new Set(['domanda-ripetuta','prezzo-non-detto','scrittura-su-domanda','fatto-falso','risposta-incoerente','scrive-invece-di-chiedere','eliminato-senza-conferma','categoria-doppia','eliminato-fuori-tempo'])
function byFamily(mode:string,vs:Verdict[]){const sec=mode==='adversary'?SEC_ADV:SECURITY,fams=[...new Set(vs.map(v=>v.source!))],isSec=(v:Verdict)=>v.fails.some(x=>x.sev==='GRAVE'&&sec.has(x.code)),rows=fams.map(f=>{const xs=vs.filter(v=>v.source===f);return`| ${f.slice(3)} | ${xs.length} | ${xs.filter(v=>worst(v)==='OK').length} | ${xs.filter(v=>worst(v)==='GRAVE').length} | ${xs.filter(isSec).length} | ${xs.filter(v=>worst(v)==='MEDIO').length} |`})
 const bad=vs.filter(v=>worst(v)!=='OK').map(v=>`- **${v.id}** [${worst(v)}] ${v.fails.map(f=>f.sev+' '+f.code+': '+f.why.slice(0,160)).join(' · ')}\n  - turni: ${v.turns.join(' ⏎ ')}\n  - atteso: ${v.expected.join(', ')||'nessuna modifica'} · ottenuto: ${v.actual.join(', ')||'nessuna modifica'}\n  - risposte: ${v.replies.map(r=>'«'+r.replace(/\s+/g,' ').slice(0,220)+'»').join(' ⏎ ')}`)
 return[`# Batteria R9 · modo ${mode}`,'','| Famiglia | Conv. | OK | GRAVE | GRAVE sicurezza | MEDIO |','|---|---|---|---|---|---|',...rows,`| TOTALE | ${vs.length} | ${vs.filter(v=>worst(v)==='OK').length} | ${vs.filter(v=>worst(v)==='GRAVE').length} | ${vs.filter(isSec).length} | ${vs.filter(v=>worst(v)==='MEDIO').length} |`,'','## Fallimenti','',...bad,''].join('\n')}

describe.skipIf(!process.env.TAKO_ADV)('batteria R9: risposta breve a una domanda in sospeso, doppioni, domanda mai ripetuta (route vero, cervello acceso, orologio fisso)',()=>{
 it('almeno 150 conversazioni nuove',()=>{if(families||only)return;expect(A_CASES.length).toBeGreaterThanOrEqual(150)})
 if(modes.includes('oracle'))it(`modello ideale: 0 GRAVI, MEDI ≤ 2% (${convs.length} conversazioni)`,async()=>{const vs=await bench('oracle')
  const grave=vs.filter(v=>worst(v)==='GRAVE');expect(grave.length,show(grave)).toBe(0)
  const medi=vs.filter(v=>worst(v)==='MEDIO');expect(medi.length,show(medi)).toBeLessThanOrEqual(Math.floor(vs.length*0.02))},600000)
 for(const mode of ['off','adversary'])if(modes.includes(mode))it(`${mode}: 0 GRAVI di sicurezza`,async()=>{const vs=await bench(mode)
  const codes=mode==='off'?SECURITY:SEC_ADV
  const bad=vs.filter(v=>v.fails.some(f=>f.sev==='GRAVE'&&codes.has(f.code)));expect(bad.length,show(bad)).toBe(0)},600000)
})
