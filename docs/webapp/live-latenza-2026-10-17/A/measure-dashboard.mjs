// Misura A — tratti dashboard «salva + pubblica» sul QA (solo QA 26050ecd…). Uso: node …/measure-dashboard.mjs [--rounds=5] [--types=price,...] [--tag=before]
// Scrive solo sul QA; stato salvato prima, ripristinato e confrontato per hash alla fine. Nessun segreto nei file prodotti.
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash,randomUUID} from 'node:crypto';import {homedir} from 'node:os';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module'
import {client,json} from '../../../../scripts/translations/common.mjs'
import {loadLocalEnvironment} from '../../../../scripts/start-webapp.mjs'
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../../..'),require=createRequire(resolve(repo,'package.json')),postgres=require('postgres')
const arg=(k,d)=>{const a=process.argv.find(x=>x.startsWith(`--${k}=`));return a?a.split('=').slice(1).join('='):d}
const ROUNDS=Number(arg('rounds',5)),TYPES=arg('types','price,name,new,delete,category,soldout').split(','),TAG=arg('tag','run')
const BASE='https://takoitalia.com',QA='26050ecd-2e55-4057-a4c5-bff2b449cd47'
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,16)
const env=await loadLocalEnvironment(repo),dbUrl=new URL(env.DATABASE_URL);dbUrl.searchParams.delete('sslmode');const ca=env.DATABASE_CA_CERT?.trim()||(env.DATABASE_CA_CERT_PATH?await readFile(env.DATABASE_CA_CERT_PATH,'utf8'):undefined)
const db=postgres(dbUrl.toString(),{max:2,prepare:false,ssl:{rejectUnauthorized:true,...(ca?{ca}:{})},onnotice:()=>{}})
const qaLogin=JSON.parse(await readFile(homedir()+'/.config/tako-webapp/qa-login.json','utf8'))
const api=client();await api.call('/api/auth/login',json({email:qaLogin.email,password:qaLogin.password}))
const me=await api.call('/api/auth/me');if(me.data.restaurantId!==QA)throw Error('sessione non sul QA: stop')
async function dbState(){return db.begin('read only',async tx=>{const [w]=await tx`SELECT draft,published,revision,published_revision FROM menu_workspaces WHERE restaurant_id=${QA}`;const items=await tx`SELECT id,section_id,name,description,price,image_url,allergens,tags,available,featured,position,name_translations,description_translations FROM menu_items WHERE restaurant_id=${QA} ORDER BY id`;const menus=await tx`SELECT id,name,description,type,active,position FROM menus WHERE restaurant_id=${QA} ORDER BY id`;const sections=await tx`SELECT s.id,s.menu_id,s.name,s.description,s.active,s.position,s.name_translations FROM menu_sections s JOIN menus m ON m.id=s.menu_id WHERE m.restaurant_id=${QA} ORDER BY s.id`;const tr=await tx`SELECT item_id,lang,name,description FROM menu_item_translations WHERE restaurant_id=${QA} ORDER BY item_id,lang`;const vv=await tx`SELECT v.id,v.item_id,v.name,v.price_modifier,v.available FROM item_variants v JOIN menu_items i ON i.id=v.item_id WHERE i.restaurant_id=${QA} ORDER BY v.id`;return{w,items,menus,sections,tr,vv}})}
const publicHash=async()=>{const a=await (await fetch(`${BASE}/api/customer/restaurant/${QA}/menu?prefetch=1`)).json(),b=await (await fetch(`${BASE}/api/customer/restaurant/${QA}/menu?prefetch=1&lang=en`)).json();return hash([a,b])}
const digest=async s=>({draft:hash(s.w.draft),published:hash(s.w.published),items:hash(s.items),menus:hash(s.menus),sections:hash(s.sections),translations:hash(s.tr),variants:hash(s.vv),public:await publicHash()})
const before=await dbState();if(before.w.revision!==before.w.published_revision)throw Error('QA con bozza non pubblicata: stop')
const beforeDigest=await digest(before)
const out=resolve(here,'evidence');await mkdir(out,{recursive:true})
await writeFile(resolve(out,`${TAG}-qa-before.json`),JSON.stringify({at:new Date().toISOString(),revision:before.w.revision,digest:beforeDigest,draft:before.w.draft},null,1))
const timings=[];async function raw(path,opt={}){const r=await fetch(BASE+path,{...opt,headers:{Origin:BASE,Cookie:api.state.cookie,...opt.headers}});const st=r.headers.get('server-timing')||'';const b=await r.json().catch(()=>null);if(!r.ok){const e=Error(path+' '+r.status);e.status=r.status;throw e}return Object.assign(b??{},{__st:st})}
const t=async(f)=>{const s=performance.now();const r=await f();return [r,Math.round(performance.now()-s)]}
// commit visto dal DB: polling stretto di published_revision (connessione diretta, ~10 ms)
async function waitCommit(rev,from){for(;;){const [r]=await db`SELECT published_revision FROM menu_workspaces WHERE restaurant_id=${QA}`;if(Number(r.published_revision)>=rev)return Math.round(performance.now()-from);await sleep(15)}}
async function flow(mutate){const [cur,tGet]=await t(()=>api.call('/api/menu-workspace'));const w=structuredClone(cur.data);mutate(w);const click=performance.now();const [saved,tPut]=await t(()=>raw('/api/menu-workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:cur.revision,workspace:w})}));const [,tDiff]=await t(()=>api.call('/api/menu-workspace/publish/diff'));const confirm=performance.now();const seen=waitCommit(saved.revision,confirm);const [pub,tPost]=await t(()=>raw('/api/menu-workspace/publish',json({expectedRevision:saved.revision})));const commitAfterConfirm=await seen;return{tGet,tPut,tDiff,tPost,commitAfterConfirm,commitAfterClick:Math.round(confirm-click)+commitAfterConfirm,stPut:saved.__st,stPost:pub.__st}}
const tpl=before.w.draft.menus[0].sections[0].items[0],sec0=before.w.draft.menus[0].sections[0]
const results=[];let errors=[]
try{
 const [,meMs]=await t(()=>api.call('/api/auth/me'));results.push({type:'auth-me',meMs})
 for(const type of TYPES)for(let i=0;i<ROUNDS;i++){
  let mutate,cleanup=null;const tag=`${type}${i}`
  if(type==='price')mutate=w=>{w.menus[0].sections[0].items[0].price=tpl.price+100+i}
  if(type==='name')mutate=w=>{w.menus[0].sections[0].items[0].name=tpl.name+' L'+i}
  if(type==='new'){const name=`Piatto latenza ${i}`;mutate=w=>{w.menus[0].sections[0].items.push({...structuredClone(tpl),id:randomUUID(),name,translations:{},description:'Prova latenza'})};cleanup=w=>{w.menus[0].sections[0].items=w.menus[0].sections[0].items.filter(x=>x.name!==name)}}
  if(type==='delete'){const name=`Piatto latenza del ${i}`,id=randomUUID();await flow(w=>{w.menus[0].sections[0].items.push({...structuredClone(tpl),id,name,translations:{}})});mutate=w=>{w.menus[0].sections[0].items=w.menus[0].sections[0].items.filter(x=>x.id!==id)}}
  if(type==='category'){const name=`Categoria latenza ${i}`;mutate=w=>{w.menus[0].sections.push({...structuredClone(sec0),id:randomUUID(),name,translations:{},items:[{...structuredClone(tpl),id:randomUUID(),name:'Piatto cat '+i,translations:{}}]})};cleanup=w=>{w.menus[0].sections=w.menus[0].sections.filter(s=>s.name!==name)}}
  if(type==='soldout')mutate=w=>{const it=w.menus[0].sections[0].items[1];it.available=!it.available}
  try{const r=await flow(mutate);results.push({type,i,...r});console.log(type,i,JSON.stringify(r));if(cleanup)await flow(cleanup);if(type==='soldout')await flow(w=>{w.menus[0].sections[0].items[1].available=before.w.draft.menus[0].sections[0].items[1].available})}catch(e){errors.push(tag+': '+e.message);console.log('ERR',tag,e.message)}
  await sleep(400)
 }
}finally{
 try{
  for(const it of before.items){const now=(await db`SELECT available FROM menu_items WHERE id=${it.id}`)[0];if(now&&now.available!==it.available)await api.call(`/api/menus/items/${it.id}/availability`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({available:it.available})})}
  await flow(w=>{for(const k of Object.keys(w))delete w[k];Object.assign(w,structuredClone(before.w.draft))})
  const keepItems=before.items.map(x=>x.id),keepSections=before.sections.map(x=>x.id),keepMenus=before.menus.map(x=>x.id)
  await db.begin(async tx=>{await tx`DELETE FROM item_variants WHERE item_id IN (SELECT id FROM menu_items WHERE restaurant_id=${QA} AND NOT (id = ANY(${keepItems}::uuid[])))`;await tx`DELETE FROM menu_item_translations WHERE restaurant_id=${QA} AND NOT (item_id = ANY(${keepItems}::uuid[]))`;await tx`DELETE FROM menu_items WHERE restaurant_id=${QA} AND NOT (id = ANY(${keepItems}::uuid[]))`;await tx`DELETE FROM menu_sections WHERE menu_id IN (SELECT id FROM menus WHERE restaurant_id=${QA}) AND NOT (id = ANY(${keepSections}::uuid[]))`;await tx`DELETE FROM menus WHERE restaurant_id=${QA} AND NOT (id = ANY(${keepMenus}::uuid[]))`})
  const afterDigest=await digest(await dbState());const diff=Object.keys(beforeDigest).filter(k=>beforeDigest[k]!==afterDigest[k])
  console.log(diff.length?'FAIL ripristino '+diff.join(','):'PASS QA ripristinato per hash')
  const p50=(k,ty)=>{const v=results.filter(r=>r.type===ty).map(r=>r[k]).sort((a,b)=>a-b);return v.length?v[Math.floor((v.length-1)/2)]:null}
  const summary=Object.fromEntries(TYPES.map(ty=>[ty,Object.fromEntries(['tPut','tDiff','tPost','commitAfterConfirm','commitAfterClick'].map(k=>[k,p50(k,ty)]))]))
  console.log(JSON.stringify(summary,null,1))
  await writeFile(resolve(out,`${TAG}-dashboard-${new Date().toISOString().replace(/[:.]/g,'-')}.json`),JSON.stringify({tag:TAG,results,summary,errors,restore:{before:beforeDigest,after:afterDigest,ok:!diff.length}},null,1))
 }catch(e){console.log('FAIL ripristino',e.message)}
 await api.call('/api/auth/logout',{method:'POST'}).catch(()=>{});await db.end()
}
