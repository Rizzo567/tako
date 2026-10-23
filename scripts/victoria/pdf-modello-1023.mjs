import fs from 'node:fs'
const OUT=process.env.OUT_DIR?process.env.OUT_DIR+'/':'./'
// 23/10 — Victoria: Modello PDF su «Menu Cena» e «Menu Giorno» via API dashboard (account agenzia; password letta dal file, mai stampata).
// Uso: node scripts/victoria/pdf-modello-1023.mjs        → sola lettura (stato bozza + menu)
//      node scripts/victoria/pdf-modello-1023.mjs go     → SOLO se la bozza non ha modifiche pendenti: carica i 2 modelli, ops, Pubblica, scarica i PDF
const O='https://takoitalia.com',QA='26050ecd-2e55-4057-a4c5-bff2b449cd47',VIC='528e263c-634e-4695-9632-6c5cc6a3302f'
const txt=fs.readFileSync(process.env.HOME+'/.config/tako-webapp/Takomenu - Credenziali dashboard.txt','utf8')
const m=txt.match(/manuelrizzo474@gmail\.com\s*\n\s*Password:\s*(\S+)/);if(!m)throw Error('credenziali non trovate')
let cookie=''
async function req(path,{method='GET',json,form,raw}={}){
 const headers={origin:O,cookie};let body
 if(json!==undefined){headers['content-type']='application/json';body=JSON.stringify(json)}
 if(form){body=form}
 const t=performance.now();const r=await fetch(O+path,{method,headers,body,redirect:'manual',signal:AbortSignal.timeout(90000)})
 const sc=r.headers.getSetCookie?.()||[];if(sc.length)cookie=sc.map(c=>c.split(';')[0]).join('; ')
 const ms=Math.round(performance.now()-t)
 if(raw)return {status:r.status,ms,type:r.headers.get('content-type'),bytes:Buffer.from(await r.arrayBuffer()),headers:r.headers}
 const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}
 return {status:r.status,ms,data}
}
async function login(tenant){
 const l=await req('/api/auth/login',{method:'POST',json:{email:'manuelrizzo474@gmail.com',password:m[1]}});if(l.status!==200)throw Error('login '+l.status)
 const s=await req('/api/web-locations/switch',{method:'POST',json:{restaurantId:tenant}});if(s.status!==200||s.data?.data?.restaurantId!==tenant)throw Error('switch '+s.status)
 return true
}
const area={top:281/1492,bottom:1461/1492,left:30/1054,right:1022/1054}
await login(VIC)
let g=await req('/api/menu-workspace');const W=g.data.data??g.data
console.log('rev',g.data.revision,'pub',g.data.publishedRevision,'pending',g.data.pending)
for(const m of W.menus)console.log(' menu',m.id,m.name,m.pricing??'',JSON.stringify(m.paper??null))
if(process.argv[2]!=='go')process.exit(0)
if(g.data.pending!==false||g.data.revision!==g.data.publishedRevision)throw Error('Victoria ha modifiche in bozza: mi fermo')
const targets=[['Menu Cena','modello-cena.jpg'],['Menu Giorno','modello-giorno.jpg']].map(([name,file])=>({menu:W.menus.find(m=>m.name===name),file}))
if(targets.some(t=>!t.menu))throw Error('menu non trovati')
const ops=[]
for(const t of targets){const fd=new FormData();fd.append('file',new Blob([fs.readFileSync(new URL('../../docs/webapp/pdf-modello-2026-10-23/'+t.file,import.meta.url))],{type:'image/jpeg'}),t.file);const up=await req('/api/menu-workspace/assets',{method:'POST',form:fd});console.log('upload',t.file,up.status,up.data?.data?.url);if(up.status!==201)throw Error('upload');ops.push({op:'set',kind:'menu',id:t.menu.id,fields:{paper:{templateUrl:up.data.data.url,area}}})}
const o=await req('/api/menu-workspace/ops',{method:'POST',json:{clientId:'pdf-template-1023',ops}});console.log('ops',o.status,JSON.stringify(o.data).slice(0,250));if(o.status!==200||o.data.results.some(r=>!r.ok))throw Error('ops')
const p=await req('/api/menu-workspace/publish',{method:'POST',json:{expectedRevision:o.data.revision}});console.log('publish',p.status,JSON.stringify(p.data).slice(0,200));if(p.status!==200)throw Error('publish')
for(const t of targets){const r=await req('/api/menu-workspace/pdf',{method:'POST',json:{menuIds:[t.menu.id]},raw:true});const tag='victoria-'+t.menu.name.toLowerCase().replace(/\s+/g,'-');console.log(tag,r.status,r.type,r.bytes.length,r.ms+'ms');fs.writeFileSync(OUT+tag+'.pdf',r.bytes)}
const carta=W.menus.find(m=>m.name==='Alla carta');const r=await req('/api/menu-workspace/pdf',{method:'POST',json:{menuIds:[carta.id]},raw:true});console.log('alla carta (PDF fornito)',r.status,r.bytes.length,r.headers.get('content-disposition'))
