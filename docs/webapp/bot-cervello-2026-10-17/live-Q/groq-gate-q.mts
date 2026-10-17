// Gate con Groq vero (17/10, perimetro Q), in locale e in sola lettura: frasi con «togli» che passano ancora dall'IA, sul catalogo
// vero del QA. Controllo: un verbo di rimozione non diventa MAI «esaurito» (validatore + prompt), «finito» resta esaurito.
// Nessuna scrittura, nessun messaggio WhatsApp. Chiave: groq-key-test.txt se esiste, altrimenti quella del bot (MAI traduzioni).
// Tetto tassativo 10k token: ≈1,3k a chiamata col catalogo QA, ci si ferma oltre 8,5k.
// Uso (dalla cartella apps/server): npx tsx ../../docs/webapp/bot-cervello-2026-10-17/live-Q/groq-gate-q.mts
import {readFile,writeFile} from 'node:fs/promises';import {homedir} from 'node:os';import {createRequire} from 'node:module'
import {groqMenuPlan,validateMenuPlan,type MenuRef,type SectionRef} from '../../../../apps/server/src/lib/twilio-menu-ai.ts'
import {loadLocalEnvironment} from '../../../../scripts/start-webapp.mjs'
const repo=new URL('../../../../',import.meta.url).pathname,require=createRequire(repo+'package.json'),postgres=require('postgres')
const QA='26050ecd-2e55-4057-a4c5-bff2b449cd47',home=homedir()+'/.config/tako-webapp/'
const keyFile=await readFile(home+'groq-key-test.txt','utf8').then(()=>'groq-key-test.txt',()=>'groq-key.txt'),key=(await readFile(home+keyFile,'utf8')).trim()
const env=await loadLocalEnvironment(repo),u=new URL(env.DATABASE_URL);u.searchParams.delete('sslmode');const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined)
const db=postgres(u.toString(),{max:1,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})}})
const [w]=await db.begin('read only',(tx:any)=>tx`SELECT draft FROM menu_workspaces WHERE restaurant_id=${QA}`);await db.end()
const refs:MenuRef[]=w.draft.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items.map((i:any)=>({id:i.id,name:i.name,price:i.price,available:i.available!==false,hidden:!!i.hidden,menu:m.name,section:s.name,sectionId:s.id,featured:!!i.featured,tags:i.tags??[]}))))
const sections:SectionRef[]=w.draft.menus.flatMap((m:any)=>m.sections.map((s:any)=>({id:s.id,name:s.name,menu:m.name})))
const name=(id:string)=>refs.find(r=>r.id===id)?.name??id
const kinds=(p:any)=>(p.actions??[]).map((a:any)=>`${a.kind}:${name(a.id)}:${a.value??a.price}`)
let used=0;const LIMIT=8500
const noFinish=(dishes:string[])=>(p:any)=>p.type==='change'&&p.actions.some((a:any)=>a.kind==='available'&&dishes.includes(name(a.id)))?'«togli» diventato esaurito':null
const cases:{text:string,check:(plan:any)=>string|null}[]=[
 // Pronome: resta all'IA. Deve nascondere boh, mai segnarlo finito.
 {text:'boh toglilo dal menu',check:p=>noFinish(['boh'])(p)??(p.type==='change'&&!p.actions.some((a:any)=>a.kind==='hidden'&&name(a.id)==='boh')?'boh non nascosto':null)},
 // Dialetto con esaurito + rimozione nella stessa frase: boh esaurito, che ne sacc nascosto.
 {text:'nun ce sta cchiù boh, e levame pure che ne sacc',check:p=>p.type!=='change'?null:p.actions.some((a:any)=>a.kind==='available'&&name(a.id)==='Che ne sacc')?'che ne sacc diventato esaurito':null},
 // Rimozione detta in modo lungo: mai esaurito.
 {text:'il piatto di verifica non lo facciamo più, toglilo proprio dal menu',check:noFinish(['Piatto di verifica'])},
 // Correzione con «no» e pronome.
 {text:'no aspetta, la pasta al ragù levala dal menu',check:noFinish(['pasta al ragù'])},
 // Esaurito vero: resta esaurito (nessun falso positivo della conversione).
 {text:'la pasta al ragù per stasera è finita, non toglierla dal menu',check:p=>p.type==='change'&&p.actions.some((a:any)=>a.kind==='hidden'&&name(a.id)==='pasta al ragù')?'esaurito diventato nascosto':null}]
const out:any[]=[]
for(const c of cases){if(used>LIMIT){out.push({text:c.text,skipped:'budget'});continue}
 let tokens=0;const raw=await groqMenuPlan(c.text,refs,key,sections,{meter:e=>{tokens+=e.prompt+e.completion}})
 used+=tokens;const plan=validateMenuPlan(raw.content,refs,{sections,message:c.text}),problem=c.check(plan)
 out.push({text:c.text,tokens,plan:{type:plan.type,actions:kinds(plan),ids:(plan as any).ids?.map(name)},pass:!problem,problem})
 console.log(problem?'FAIL':'PASS',c.text,'→',plan.type,JSON.stringify(out.at(-1).plan),'·',tokens,'token')}
console.log(JSON.stringify({keyFile,totalTokens:used,cases:out.length,pass:out.filter(x=>x.pass).length}))
await writeFile(new URL('./groq-gate-q-result.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),keyFile,totalTokens:used,out},null,1))
