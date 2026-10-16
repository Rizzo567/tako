// Verifica live (edge v99) delle frasi più pericolose sul bot del TITOLARE. Il QA «Tako · Verifica web» ha collegato il
// numero di Manuel e NON si tocca: si crea un locale di test temporaneo «ZZ Test bot titolare», il numero finto
// +390000000099 si collega a quello (attore = utente agenzia), e alla fine locale, menu, versioni, collegamento e memoria
// vengono cancellati del tutto. Fixture e pulizia con la connessione owner (Management API). Nessun segreto nei file.
import fs from 'node:fs';import {readFile,writeFile} from 'node:fs/promises';import {createHmac,randomBytes,randomUUID} from 'node:crypto';import {parseEnv} from 'node:util';import {homedir} from 'node:os';import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url'
import {client,login} from '../../../../scripts/translations/common.mjs'
const here=dirname(fileURLToPath(import.meta.url)),WA='whatsapp:+390000000099',QA='26050ecd-2e55-4057-a4c5-bff2b449cd47'
const tok=fs.readFileSync(homedir()+'/.config/tako-webapp/supabase-onboarding.env','utf8').match(/SUPABASE_ACCESS_TOKEN=['"]?([^'"\n]+)/)[1]
const q=async query=>{const r=await fetch('https://api.supabase.com/v1/projects/tcfccmvpycivxuxkoqpw/database/query',{method:'POST',headers:{authorization:'Bearer '+tok,'content-type':'application/json'},body:JSON.stringify({query})});const t=await r.text();if(!r.ok)throw Error('SQL '+r.status+' '+t.slice(0,200));return JSON.parse(t)}
const lit=v=>"'"+String(v).replace(/'/g,"''")+"'",sleep=ms=>new Promise(r=>setTimeout(r,ms))
const tw=parseEnv(await readFile(homedir()+'/.config/tako-webapp/twilio-menu.env','utf8'))
const sign=(u,form)=>createHmac('sha1',tw.TWILIO_AUTH_TOKEN).update(u+Object.keys(form).sort().map(k=>k+form[k]).join('')).digest('base64')
async function say(body){const form={AccountSid:tw.TWILIO_ACCOUNT_SID,From:WA,To:tw.TWILIO_WHATSAPP_NUMBER,NumMedia:'0',MessageSid:'SM'+randomBytes(16).toString('hex'),Body:body};const r=await fetch(tw.TWILIO_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':sign(tw.TWILIO_WEBHOOK_URL,form)},body:new URLSearchParams(form).toString()});const text=(await r.text()).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();await sleep(700);return text}
const rid=randomUUID(),menu=randomUUID(),primi=randomUUID(),dolci=randomUUID(),id={};for(const n of ['carbonara','lasagna','fagioli','tiramisu','panna'])id[n]=randomUUID()
const item=(k,name,price)=>({id:id[k],name,price,available:true})
const draft={languages:['it'],defaultLanguage:'it',menus:[{id:menu,name:'Pranzo',sections:[{id:primi,name:'Primi',items:[item('carbonara','Spaghetti alla carbonara',12),item('lasagna','Lasagna al forno',11),item('fagioli','Pasta e fagioli',9)]},{id:dolci,name:'Dolci',items:[item('tiramisu','Tiramisù',5),item('panna','Panna cotta',5)]}]}]}
const out={at:new Date().toISOString(),edge:'v99',turns:[],checks:[]};const check=(name,ok,detail='')=>{out.checks.push({name,ok:!!ok,detail});console.log(ok?'PASS':'FAIL',name,'|',String(detail).slice(0,160))}
const pub=async()=>{const [w]=await q(`select published,revision,published_revision from menu_workspaces where restaurant_id=${lit(rid)}`);const items=w.published.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>({...i,section:s.name}))));return{w,items,by:n=>items.find(i=>i.name===n)}}
const api=client();let linked=false
try{
 if((await q(`select 1 from tako_whatsapp_links where phone=${lit(WA)}`)).length)throw Error('numero finto già collegato: stop')
 await login(api);const me=await api.call('/api/auth/me')
 await q(`begin;insert into restaurants(id,name,slug,settings) values(${lit(rid)},'ZZ Test bot titolare','zz-test-bot-titolare-${rid.slice(0,8)}','{"timezone":"Europe/Rome"}'::jsonb);insert into menu_workspaces(restaurant_id,draft,published,revision,published_revision) values(${lit(rid)},${lit(JSON.stringify(draft))}::jsonb,${lit(JSON.stringify(draft))}::jsonb,1,1);insert into tako_whatsapp_links(phone,restaurant_id,actor_id,activated_at) values(${lit(WA)},${lit(rid)},${lit(me.data.id)},now());commit;`);linked=true
 const T=async(msg,name,test)=>{const r=await say(msg);const s=await pub();out.turns.push({in:msg,out:r.slice(0,300),revision:s.w.revision});check(name,await test(r,s),r)}
 await T('aggiungi tra i primi il piatto pasta al ragù che costa 12 euro','vocale reale: aggiunta, mai «Non trovo»',(r,s)=>!/Non trovo/.test(r)&&s.by('Pasta al ragù')?.price===12&&s.by('Pasta al ragù').section==='Primi')
 await T('aggiungiamo un piatto','«aggiungiamo un piatto» → una domanda',r=>/In quale categoria|Quanto costa|Come si chiama/.test(r))
 await T('pasta al pesto 11 euro nei primi','risposta alla domanda collegata (G2)',(r,s)=>s.by('Pasta al pesto')?.price===11)
 await T('metti in offerta la lasagna a 9 euro','«metti in offerta … a 9» non è un cambio prezzo (G1)',(r,s)=>s.by('Lasagna al forno').price===11&&!/Non trovo «/.test(r))
 let before=(await pub()).w.revision
 await T('il tiramisù è finito?','domanda, mai azione (G4)',(r,s)=>s.w.revision===before&&s.by('Tiramisù').available!==false)
 await T('la carbonara costa 13?','domanda sul prezzo, mai azione (G4)',(r,s)=>s.by('Spaghetti alla carbonara').price===12)
 await T('la carbonara costa 1300','prezzo implausibile → conferma, non online (G6)',(r,s)=>s.by('Spaghetti alla carbonara').price===12&&/OK/.test(r))
 await say('annulla')
 await T('cabonara finita','refuso + «X finita» senza «è» (G8)',(r,s)=>s.by('Spaghetti alla carbonara').available===false)
 await T('scusa no era la lasagna','correzione: carbonara torna, lasagna finita (G3)',(r,s)=>s.by('Spaghetti alla carbonara').available!==false&&s.by('Lasagna al forno').available===false)
 await T('metti la panna cotta a 6','cambio prezzo semplice',(r,s)=>s.by('Panna cotta').price===6)
 await T('no scusa 7','correzione del prezzo (G2)',(r,s)=>s.by('Panna cotta').price===7)
 await T('anche il tiramisù','«anche il tiramisù» = stessa modifica',(r,s)=>s.by('Tiramisù').price===7)
 await T('aggingi tra i dolci cannolo siciliano 4 euro','refuso nel verbo (G8)',(r,s)=>s.by('Cannolo siciliano')?.price===4)
 before=(await pub()).w.revision
 await T('la carbonara non è finita','negazione: nessuna scrittura (G5)',(r,s)=>s.w.revision===before)
}catch(e){check('esecuzione',false,String(e.message).slice(0,200))}finally{
 try{await q(`begin;delete from tako_whatsapp_proposals where phone=${lit(WA)};delete from tako_whatsapp_links where phone=${lit(WA)};delete from tako_whatsapp_messages where sid=${lit('last:'+WA)};delete from menu_item_translations where restaurant_id=${lit(rid)};delete from item_variants where item_id in (select id from menu_items where restaurant_id=${lit(rid)});delete from menu_items where restaurant_id=${lit(rid)};delete from menu_sections where menu_id in (select id from menus where restaurant_id=${lit(rid)});delete from menus where restaurant_id=${lit(rid)};delete from menu_workspace_versions where restaurant_id=${lit(rid)};delete from menu_workspaces where restaurant_id=${lit(rid)};delete from restaurants where id=${lit(rid)};commit;`)
  const left=(await q(`select (select count(*) from restaurants where id=${lit(rid)})+(select count(*) from tako_whatsapp_links where phone=${lit(WA)}) n`))[0].n;check('pulizia completa (locale, menu, collegamento)',Number(left)===0)
  const qa=await q(`select phone from tako_whatsapp_links where restaurant_id=${lit(QA)}`);check('collegamento del QA (numero di Manuel) intatto',qa.length===1&&qa[0].phone.endsWith('27'))}catch(e){check('pulizia',false,e.message)}
 try{await api.call('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})}catch{}
 await writeFile(resolve(here,'result.json'),JSON.stringify(out,null,1))
}
