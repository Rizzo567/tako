// uso: node qa-ws.mjs save|victoria|restore|show — workspace del QA via API dashboard (account agenzia + switch al QA), mai SQL in scrittura.
import fs from 'node:fs';import {homedir} from 'node:os';import {randomUUID} from 'node:crypto'
import {q} from '../../bot-haiku-2026-10-21/qa-read.mjs'
const B='https://takoitalia.com/api',QA='26050ecd-2e55-4057-a4c5-bff2b449cd47',VIC='528e263c-634e-4695-9632-6c5cc6a3302f',SAVE=homedir()+'/.config/tako-webapp/qa-workspace-before-sost-1024.json'
const txt=fs.readFileSync(homedir()+'/.config/tako-webapp/Takomenu - Credenziali dashboard.txt','utf8');const pw=txt.split('\nManuel\n')[1].match(/Password:\s*(\S+)/)[1]
let cookie='';const call=async(p,m='GET',b)=>{const r=await fetch(B+p,{method:m,headers:{...(b?{'content-type':'application/json'}:{}),cookie,origin:'https://takoitalia.com'},body:b?JSON.stringify(b):undefined});const sc=r.headers.getSetCookie?.()||[];if(sc.length)cookie=sc.map(c=>c.split(';')[0]).join('; ');const t=await r.text();if(!r.ok)throw new Error(p+' '+r.status+' '+t.slice(0,300));return t?JSON.parse(t):{}}
await call('/auth/login','POST',{email:'manuelrizzo474@gmail.com',password:pw});await call('/web-locations/switch','POST',{restaurantId:QA})
const me=await call('/auth/me');const rid=me?.data?.restaurantId??me?.data?.user?.restaurantId??me?.user?.restaurantId;if(rid!==QA)throw new Error('sessione non sul QA: STOP')
const cur=await call('/menu-workspace'),cmd=process.argv[2]
const put=async(w)=>{await call('/menu-workspace','PUT',{expectedRevision:cur.revision,workspace:w});const c2=await call('/menu-workspace');await call('/menu-workspace/publish','POST',{expectedRevision:c2.revision});const c3=await call('/menu-workspace');console.log('rev',c3.revision,'menus',c3.data.menus.map(m=>m.name).join(' | '))}
if(cmd==='save'){if(fs.existsSync(SAVE))throw new Error('salvataggio già presente: '+SAVE);fs.writeFileSync(SAVE,JSON.stringify(cur.data),{mode:0o600});console.log('salvato rev',cur.revision,cur.data.menus.length,'menu')}
if(cmd==='victoria'){if(!fs.existsSync(SAVE))throw new Error('prima save');const v={draft:JSON.parse(fs.readFileSync(new URL('../fixture-base.json',import.meta.url),'utf8'))} // 24/10: copia del menu di Victoria (sola lettura, Menu Giorno della mattina)
 const menus=v.draft.menus.map(m=>{const secMap=new Map();const sections=m.sections.map(s=>{const id=randomUUID();secMap.set(s.id,id);return{...s,id,parentSectionId:null,items:s.items.map(i=>({...i,id:randomUUID(),imageUrl:null}))}})
  for(const s of sections)if(m.sections.find(x=>secMap.get(x.id)===s.id)?.parentSectionId)s.parentSectionId=secMap.get(m.sections.find(x=>secMap.get(x.id)===s.id).parentSectionId)??null
  const out={...m,id:randomUUID(),sections};delete out.paper;if(m.formulas)out.formulas=m.formulas.map(f=>({...f,id:randomUUID(),sectionIds:(f.sectionIds||[]).map(x=>secMap.get(x)).filter(Boolean)}));return out})
 const w={...cur.data,menus};await put(w)}
if(cmd==='restore'){const saved=JSON.parse(fs.readFileSync(SAVE,'utf8'));await put(saved);console.log('ripristinato')}
if(cmd==='show')console.log('rev',cur.revision,cur.data.menus.map(m=>m.name+':'+m.sections.map(s=>s.name+'('+s.items.length+')').join(',')).join(' | '))
// 24/10: «load <file.json>» = metti nel QA un documento menu salvato (es. lo stato di partenza della batteria v187), poi pubblica
if(cmd==='load'){if(!fs.existsSync(SAVE))throw new Error('prima save');const w=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));await put({...cur.data,menus:w.menus})}
