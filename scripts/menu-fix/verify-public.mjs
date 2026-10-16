// Verifica che la pagina pubblica (API /api/customer/restaurant/<id>/menu) rifletta il workspace pubblicato.
// Uso: node --experimental-strip-types scripts/menu-fix/verify-public.mjs --only=<slug> [--qa-links=<file>] [--expect=<backup.json>] [--out-dir=<dir>]
// Solo letture (GET). Atteso = workspace pubblicato attuale (o --expect: data di un backup apply-ops/rollback, es. per verificare un rollback),
// proiettato come fa il server: menu/sezioni attivi, item non nascosti e disponibili, menu senza item esclusi.
// Confronta per ogni menu: ordine e id di sezioni/item, nome, descrizione, padre, prezzo, priceDisplay, allergeni, varianti.
// Nota: la descrizione del menu (updateMenu description) NON è esposta dall'API pubblica: viene solo segnalata.
import {readFile} from 'node:fs/promises'
import {base} from '../translations/common.mjs'
import {canonical} from './ops-engine.mjs'
import {arg,onlyList,links,openLocation,atomic,sessionClient,saveSession,defaultOutDir} from './live.mjs'

const slugs=onlyList();if(slugs.length!==1)throw Error('verify-public: un solo slug alla volta')
const link=(await links()).find(r=>r.slug===slugs[0]);if(!link)throw Error(`slug ${slugs[0]} non trovato`)
let expected,source
if(arg('expect')){expected=JSON.parse(await readFile(arg('expect'),'utf8'));source=arg('expect')}
else{const api=await sessionClient();try{expected=await openLocation(api,link.id)}finally{await saveSession(api)};source='workspace live'
 if(expected.revision!==expected.publishedRevision)throw Error(`bozza non pubblicata (rev ${expected.revision}/${expected.publishedRevision}): il pubblico non può coincidere`)}
const w=expected.data,problems=[],notes=[]
const project=m=>({id:m.id,name:m.name,sections:m.sections.filter(s=>s.active!==false&&(!s.parentSectionId||m.sections.some(p=>p.id===s.parentSectionId&&p.active!==false))).map(s=>({id:s.id,name:s.name,description:s.description??null,parentSectionId:s.parentSectionId??null,
 items:s.items.filter(i=>!i.hidden&&i.available!==false).map(i=>({id:i.id,name:i.name,description:i.description??null,price:i.price,priceDisplay:i.priceDisplay??null,allergens:i.allergens??[],variants:(i.variants||[]).filter(v=>v.available!==false).map(v=>({id:v.id,name:v.name,priceModifier:v.priceModifier}))}))}))})
const shape=m=>({id:m.id,name:m.name,sections:m.sections.map(s=>({id:s.id,name:s.sourceName??s.name,description:s.description??null,parentSectionId:s.parentSectionId??null,
 items:s.items.map(i=>({id:i.id,name:i.name,description:i.description??null,price:i.price,priceDisplay:i.priceDisplay??null,allergens:i.allergens??[],variants:(i.variants||[]).map(v=>({id:v.id,name:v.name,priceModifier:v.priceModifier}))}))}))})
for(const m of w.menus)if(m.schedule?.enabled||m.sections.some(s=>s.schedule?.enabled))notes.push(`menu "${m.name}" ha orari: il confronto può differire fuori orario`)
const want=w.menus.filter(m=>m.active!==false).map(project).filter(m=>m.sections.some(s=>s.items.length))
const get=async q=>{const r=await fetch(`${base}/api/customer/restaurant/${link.id}/menu${q}`,{signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-cache'}});if(!r.ok)throw Error(`API pubblica ${r.status} ${q}`);return r.json()}
const first=await get(''),list=first.menus||[]
if(canonical(list.map(m=>m.id))!==canonical(want.map(m=>m.id)))problems.push(`menu pubblici [${list.map(m=>m.name).join(' | ')}] != attesi [${want.map(m=>m.name).join(' | ')}]`)
const pub=[]
for(const m of want){
 const got=first.data?.id===m.id?first.data:(await get(`?menuId=${m.id}`).catch(e=>({error:e.message}))).data
 if(!got||got.id!==m.id){problems.push(`menu "${m.name}" non servito`);continue}
 const g=shape(got);pub.push(g)
 if(canonical(g)===canonical(m))continue
 if(g.name!==m.name)problems.push(`menu "${m.name}": nome pubblico "${g.name}"`)
 const gs=new Map(g.sections.map(s=>[s.id,s]))
 if(canonical(g.sections.map(s=>s.id))!==canonical(m.sections.map(s=>s.id)))problems.push(`menu "${m.name}": ordine/insieme sezioni diverso`)
 for(const s of m.sections){const t=gs.get(s.id);if(!t){problems.push(`sezione "${s.name}" assente`);continue}
  for(const k of ['name','description','parentSectionId'])if(canonical(t[k])!==canonical(s[k]))problems.push(`sezione "${s.name}" ${k}: pubblico ${JSON.stringify(t[k])} atteso ${JSON.stringify(s[k])}`)
  if(canonical(t.items.map(i=>i.id))!==canonical(s.items.map(i=>i.id)))problems.push(`sezione "${s.name}": ordine/insieme item diverso`)
  const ti=new Map(t.items.map(i=>[i.id,i]))
  for(const i of s.items){const j=ti.get(i.id);if(!j)continue;for(const k of ['name','description','price','priceDisplay','allergens','variants'])if(canonical(j[k])!==canonical(i[k]))problems.push(`item "${i.name}" ${k}: pubblico ${JSON.stringify(j[k])} atteso ${JSON.stringify(i[k])}`)}}
}
for(const m of w.menus)if(m.description)notes.push(`descrizione menu "${m.name}" non esposta dall'API pubblica: ${JSON.stringify(m.description)}`)
const hidden=w.menus.flatMap(m=>m.sections.flatMap(s=>s.items.filter(i=>i.hidden).map(i=>i.name)))
if(hidden.length)notes.push(`item nascosti (assenti dal pubblico, verificato): ${hidden.join(', ')}`)
const report={slug:link.slug,restaurantId:link.id,at:new Date().toISOString(),expectedFrom:source,revision:expected.revision,ok:!problems.length,problems,notes,public:pub}
const out=`${arg('out-dir')||defaultOutDir()}/public/${link.slug}-${Date.now()}.json`;await atomic(out,JSON.stringify(report,null,1))
console.log(`${link.slug}: pubblico ${report.ok?'CONFORME':'DIVERSO'} (atteso da ${source}, rev ${expected.revision})`)
for(const p of problems)console.log('  DIFF',p);for(const n of notes)console.log('  nota',n);console.log('  report:',out)
if(problems.length)process.exitCode=1
