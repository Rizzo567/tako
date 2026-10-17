// Pulizia QA (17/10): elimina SOLO il piatto «Test QA» (c229935f-…, creato dal collaudo WhatsApp) da bozza e pubblicato del locale QA,
// con la sessione di login propria (qa-login.json, mai session.txt), poi confronta il menu QA con stato-iniziale.json.
// Uso: node docs/webapp/qa-whatsapp-2026-10-17/live/cleanup-test-qa.mjs [--dry]
import {readFile} from 'node:fs/promises';import {homedir} from 'node:os';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module'
import {client,json} from '../../../../scripts/translations/common.mjs'
import {loadLocalEnvironment} from '../../../../scripts/start-webapp.mjs'
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../../..'),require=createRequire(resolve(repo,'package.json')),postgres=require('postgres')
const QA='26050ecd-2e55-4057-a4c5-bff2b449cd47',TEST_QA='c229935f-7077-4ab8-b2a9-668dfa6b4f25',DRY=process.argv.includes('--dry')
const env=await loadLocalEnvironment(repo),dbUrl=new URL(env.DATABASE_URL);dbUrl.searchParams.delete('sslmode');const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined)
const db=postgres(dbUrl.toString(),{max:1,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},onnotice:()=>{}})
const items=doc=>doc.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>({...i,category:s.name}))))
const state=async()=>(await db`SELECT draft,published,revision,published_revision FROM menu_workspaces WHERE restaurant_id=${QA}`)[0]
// Confronto con lo stato iniziale del collaudo: nome, prezzo, promo, ultime porzioni, descrizione, categoria, visibilità.
function compare(doc,label){const baseline=JSON.parse(require('node:fs').readFileSync(resolve(here,'../stato-iniziale.json'),'utf8')).baseline,got=items(doc),problems=[]
 if(got.length!==baseline.length)problems.push(`${label}: ${got.length} piatti invece di ${baseline.length}: ${got.map(i=>i.name).join(', ')}`)
 for(const b of baseline){const i=got.find(x=>x.name===b.name);if(!i){problems.push(`${label}: manca ${b.name}`);continue}
  const check=(k,a,e)=>{if(JSON.stringify(a)!==JSON.stringify(e))problems.push(`${label}: ${b.name}.${k} ${JSON.stringify(a)} ≠ ${JSON.stringify(e)}`)}
  check('price',i.price,b.price);check('category',i.category,b.category);check('hidden',!!i.hidden,!!b.hidden);check('description',i.description??null,b.description??null)
  check('promo',i.promo?.price??null,b.promo??null);check('lastPortions',!!i.scarcity?.lastPortions,!!b.lastPortions);check('available',i.available!==false,true)}
 return problems}
try{
 const before=await state();if(before.revision!==before.published_revision)throw Error('QA con bozza non pubblicata: stop')
 const inDraft=items(before.draft).filter(i=>i.id===TEST_QA),inPub=items(before.published).filter(i=>i.id===TEST_QA)
 console.log('Test QA in bozza',inDraft.length,'pubblicato',inPub.length,inDraft[0]?{name:inDraft[0].name,price:inDraft[0].price,hidden:inDraft[0].hidden,category:inDraft[0].category}:'')
 if(inDraft.length&&!(inDraft[0].name==='Test QA'&&inDraft[0].category==='Piatti di prova'))throw Error('il piatto con quell\'id non è «Test QA» in Piatti di prova: stop')
 if(inDraft.length&&!DRY){
  const qaLogin=JSON.parse(await readFile(homedir()+'/.config/tako-webapp/qa-login.json','utf8')),api=client();await api.call('/api/auth/login',json({email:qaLogin.email,password:qaLogin.password}))
  try{const me=await api.call('/api/auth/me');if(me.data.restaurantId!==QA)throw Error('sessione non sul QA: stop')
   const next=structuredClone(before.draft);for(const m of next.menus)for(const s of m.sections)s.items=s.items.filter(i=>i.id!==TEST_QA)
   const saved=await api.call('/api/menu-workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:before.revision,workspace:next})})
   await api.call('/api/menu-workspace/publish',json({expectedRevision:saved.revision}))
  }finally{await api.call('/api/auth/logout',{method:'POST'}).catch(()=>{})}}
 const after=await state(),row=await db`SELECT count(*)::int AS n FROM menu_items WHERE id=${TEST_QA}`
 console.log('dopo: revisione',after.revision,'/',after.published_revision,'· Test QA in bozza',items(after.draft).filter(i=>i.id===TEST_QA).length,'pubblicato',items(after.published).filter(i=>i.id===TEST_QA).length,'menu_items',row[0].n)
 const problems=[...compare(after.draft,'bozza'),...compare(after.published,'pubblicato')]
 console.log(problems.length?'DIFFERENZE dallo stato iniziale:\n'+problems.join('\n'):'PASS: bozza e pubblicato coincidono con stato-iniziale.json (4 piatti)')
}finally{await db.end()}
