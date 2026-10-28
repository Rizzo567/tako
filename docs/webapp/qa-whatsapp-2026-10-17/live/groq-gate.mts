// Gate finale con Groq vero (17/10), in locale e in sola lettura: le frasi del quinto giro che passano ancora dall'IA, sul catalogo
// vero del QA. Nessuna scrittura, nessun messaggio WhatsApp. Chiave del bot (groq-key.txt, MAI quella delle traduzioni).
// Budget tassativo 15k token: si stima prima (≈1,2k a chiamata col catalogo QA) e ci si ferma oltre 12k.
// Uso (dalla cartella apps/server): npx tsx ../../docs/webapp/qa-whatsapp-2026-10-17/live/groq-gate.mts
import {readFile} from 'node:fs/promises';import {homedir} from 'node:os';import {createRequire} from 'node:module'
import {groqMenuPlan,validateMenuPlan,type MenuRef,type SectionRef} from '../../../../apps/server/src/lib/twilio-menu-ai.ts'
import {negatedClauses} from '../../../../apps/server/src/lib/twilio-menu-clarify.ts'
import {loadLocalEnvironment} from '../../../../scripts/start-webapp.mjs'
const repo=new URL('../../../../',import.meta.url).pathname,require=createRequire(repo+'package.json'),postgres=require('postgres')
const QA='26050ecd-2e55-4057-a4c5-bff2b449cd47',key=(await readFile(homedir()+'/.config/tako-webapp/groq-key.txt','utf8')).trim()
const env=await loadLocalEnvironment(repo),u=new URL(env.DATABASE_URL);u.searchParams.delete('sslmode');const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined)
const db=postgres(u.toString(),{max:1,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})}})
const [w]=await db.begin('read only',(tx:any)=>tx`SELECT draft FROM menu_workspaces WHERE restaurant_id=${QA}`);await db.end()
const refs:MenuRef[]=w.draft.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items.map((i:any)=>({id:i.id,name:i.name,price:i.price,available:i.available!==false,hidden:!!i.hidden,menu:m.name,section:s.name,sectionId:s.id,featured:!!i.featured,tags:i.tags??[]}))))
const sections:SectionRef[]=w.draft.menus.flatMap((m:any)=>m.sections.map((s:any)=>({id:s.id,name:s.name,menu:m.name})))
const name=(id:string)=>refs.find(r=>r.id===id)?.name??id
let used=0;const LIMIT=12000
const cases:{text:string,check:(plan:any)=>string|null}[]=[
 // Chiarimento con l'azione già capita: deve arrivare l'azione sul piatto di verifica (il bot la tiene in sospeso e chiede quale).
 {text:'metti il piatto di verifica a 13,50 come boh',check:p=>p.type==='clarify'&&p.actions?.length===1&&p.actions[0].kind==='price'&&name(p.actions[0].id)==='Piatto di verifica'?null:p.type==='change'&&p.actions.every((a:any)=>name(a.id)!=='boh')?null:'atteso chiarimento con azione o modifica senza boh'},
 // Pronome che rimanda al piatto negato solo per il prezzo: la promo sì, il prezzo pieno mai.
 {text:'non cambiare il prezzo del piatto di verifica, mettilo in promo a 12',check:p=>p.type==='change'&&p.actions.some((a:any)=>a.kind==='price')?'prezzo cambiato':null},
 // Contraddizione: il piatto negato non si cambia mai.
 {text:'non cambiare boh, mettilo a 25',check:p=>p.type==='change'&&p.actions.some((a:any)=>name(a.id)==='boh')?'boh cambiato':null},
 // Negazione tenuta nel testo («tranne»): il resto va, boh resta com'è e non rende ambiguo il resto.
 {text:'metti in promo a 9 tutti i piatti di prova tranne boh e che ne sacc, la pasta al ragù a 8',check:p=>p.type==='change'&&p.actions.some((a:any)=>['boh','Che ne sacc'].includes(name(a.id)))?'piatto negato cambiato':null}]
const out:any[]=[]
// --only=N,M ripete solo quei casi (1-based), per non spendere token due volte sugli stessi.
const only=(process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',').map(Number))??null
for(const [i,c] of cases.entries()){if(only&&!only.includes(i+1))continue;if(used>LIMIT){out.push({text:c.text,skipped:'budget'});continue}
 const neg=negatedClauses(c.text,refs),message=neg?.strip?neg.rest:c.text,exclude=neg?.excluded??[]
 let tokens=0;const raw=await groqMenuPlan(message,refs,key,sections,{meter:e=>{tokens+=e.prompt+e.completion}})
 used+=tokens;const plan=validateMenuPlan(raw.content,refs,{sections,message,exclude}),problem=c.check(plan)
 out.push({text:c.text,message,exclude:exclude.map(e=>name(e.id)+(e.kinds?'('+e.kinds.join(',')+')':'')),tokens,plan:{type:plan.type,actions:(plan as any).actions?.map((a:any)=>({kind:a.kind,dish:name(a.id),price:a.price})),ids:(plan as any).ids?.map(name)},pass:!problem,problem})
 console.log(problem?'FAIL':'PASS',c.text,'→',plan.type,JSON.stringify(out.at(-1).plan),'·',tokens,'token')}
console.log(JSON.stringify({totalTokens:used,cases:out.length,pass:out.filter(x=>x.pass).length}))
await (await import('node:fs/promises')).writeFile(new URL(only?`./groq-gate-result-only-${only.join('-')}.json`:'./groq-gate-result.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),totalTokens:used,out},null,1))
