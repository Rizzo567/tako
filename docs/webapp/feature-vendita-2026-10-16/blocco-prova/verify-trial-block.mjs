// Verifica live del blocco pubblicazione PROVA (edge v93). Sessione agenzia propria, logout alla fine.
// Unica scrittura: il tentativo di publish (atteso 403) + la scelta del locale attivo della propria sessione.
// Prima prova con revisione volutamente sbagliata: anche senza blocco il server risponderebbe 409 senza pubblicare.
import {writeFile} from 'node:fs/promises'
import {client,login,base} from '../../../../scripts/translations/common.mjs'
const api=client();await login(api)
const req=async(path,opt={})=>{const r=await fetch(base+path,{...opt,headers:{Origin:base,Cookie:api.state.cookie,'Content-Type':'application/json',...opt.headers}});let body=null;try{body=await r.json()}catch{}return{status:r.status,body}}
const out={at:new Date().toISOString(),checks:[]};const check=(name,ok,detail)=>{out.checks.push({name,ok,detail});console.log(ok?'PASS':'FAIL',name,detail??'')}
try{
 const list=await req('/api/agency/restaurants');const rows=list.body?.data??[];const trial=rows.find(r=>r.isTrial)
 if(!trial)throw Error('nessun PROVA trovato')
 out.trial={id:trial.id.slice(0,8),name:trial.name}
 check('switch al PROVA',(await req('/api/web-locations/switch',{method:'POST',body:JSON.stringify({restaurantId:trial.id})})).status===200)
 const ws=async()=>{const r=await req('/api/menu-workspace/');return{status:r.status,revision:r.body?.revision,publishedRevision:r.body?.publishedRevision}}
 const before=await ws();out.before=before
 const safe=await req('/api/menu-workspace/publish',{method:'POST',body:JSON.stringify({expectedRevision:Number(before.revision)+1000})})
 check('publish (revisione sbagliata) → 403 TRIAL_MENU_PRIVATE',safe.status===403&&safe.body?.error?.code==='TRIAL_MENU_PRIVATE',{status:safe.status,error:safe.body?.error})
 if(safe.status===403){const real=await req('/api/menu-workspace/publish',{method:'POST',body:JSON.stringify({expectedRevision:before.revision})});check('publish (revisione corrente) → 403 col messaggio',real.status===403&&real.body?.error?.code==='TRIAL_MENU_PRIVATE',{status:real.status,message:real.body?.error?.message})}
 const after=await ws();out.after=after
 check('revisione e revisione pubblicata identiche prima/dopo',before.revision===after.revision&&before.publishedRevision===after.publishedRevision,{before,after})
}finally{
 const lo=await req('/api/auth/logout',{method:'POST',body:'{}'});const me=await req('/api/auth/me');check('logout, sessione non più valida',me.status===401,{logout:lo.status,me:me.status})
 await writeFile(new URL('./result.json',import.meta.url),JSON.stringify(out,null,1))
}
