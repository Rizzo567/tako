// uso: node qa-link-1023.mjs add|remove|show — numero FITTIZIO solo sul QA, via API dashboard (account agenzia + switch al QA), mai SQL in scrittura.
import fs from 'node:fs';import {homedir} from 'node:os'
import {q} from '../../bot-haiku-2026-10-21/qa-read.mjs'
const B='https://takoitalia.com/api',QA='26050ecd-2e55-4057-a4c5-bff2b449cd47',PHONE='+3900000231029',EMAIL='qa-luisa4-1023@example.com'
const txt=fs.readFileSync(homedir()+'/.config/tako-webapp/Takomenu - Credenziali dashboard.txt','utf8');const pw=txt.split('\nManuel\n')[1].match(/Password:\s*(\S+)/)[1]
let cookie='';const call=async(p,m='GET',b)=>{const r=await fetch(B+p,{method:m,headers:{...(b?{'content-type':'application/json'}:{}),cookie,origin:'https://takoitalia.com'},body:b?JSON.stringify(b):undefined});const sc=r.headers.getSetCookie?.()||[];if(sc.length)cookie=sc.map(c=>c.split(';')[0]).join('; ');const t=await r.text();if(!r.ok)throw new Error(p+' '+r.status+' '+t.slice(0,200));return t?JSON.parse(t):{}}
const links=()=>q(`SELECT restaurant_id,activated_at FROM tako_whatsapp_links WHERE phone='whatsapp:${PHONE}'`)
const cmd=process.argv[2]
if(cmd==='add'||cmd==='remove'){await call('/auth/login','POST',{email:'manuelrizzo474@gmail.com',password:pw});await call('/web-locations/switch','POST',{restaurantId:QA})
 const me=await call('/auth/me');const rid=me?.data?.restaurantId??me?.data?.user?.restaurantId??me?.user?.restaurantId;if(rid!==QA)throw new Error('sessione non sul QA: STOP')
 if(cmd==='add'){const ex=await links();if(ex.length)throw new Error('numero già presente: '+JSON.stringify(ex));const r=await call('/menu-workspace/whatsapp/owner','POST',{phone:PHONE,email:EMAIL});const d=r.data||r;console.log('max',d.max,'numeri',(d.numbers||[]).length)}
 else{const r=await call('/menu-workspace/whatsapp/owner?phone='+encodeURIComponent(PHONE),'DELETE');console.log('tolto',(r.data?.numbers||[]).length)}}
const l=await links();console.log('link:',JSON.stringify(l));if(l.some(x=>x.restaurant_id!==QA))throw new Error('NUMERO NON SUL QA')
