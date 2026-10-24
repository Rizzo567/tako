// uso: TAKO_QA_PHONE=whatsapp:+39… node live.mjs copione.json out.json — messaggi firmati (TakoSyncTest) dal numero fittizio SOLO QA.
// Ogni passo: {m, gap?} gap = ms dopo l'INVIO del messaggio prima (senza aspettarne la risposta) → accavallati; senza gap si aspetta la risposta + 2,5 s.
import fs from 'node:fs';import path from 'node:path';import {homedir} from 'node:os';import {parseEnv} from 'node:util';import {createHmac,randomBytes} from 'node:crypto'
import {q} from '../../bot-haiku-2026-10-21/qa-read.mjs'
const QA='26050ecd-2e55-4057-a4c5-bff2b449cd47',cfg=path.join(homedir(),'.config/tako-webapp'),phone=process.env.TAKO_QA_PHONE
const link=await q(`SELECT restaurant_id FROM tako_whatsapp_links WHERE phone='${phone}'`);if(link.length!==1||link[0].restaurant_id!==QA)throw new Error('numero non solo QA: STOP')
const tw=parseEnv(fs.readFileSync(path.join(cfg,'twilio-menu.env'),'utf8')),sleep=ms=>new Promise(r=>setTimeout(r,ms))
const sign=(u,f)=>createHmac('sha1',tw.TWILIO_AUTH_TOKEN).update(u+Object.keys(f).sort().map(k=>k+f[k]).join('')).digest('base64')
async function send(body){const f={AccountSid:tw.TWILIO_ACCOUNT_SID,From:phone,To:tw.TWILIO_WHATSAPP_NUMBER,NumMedia:'0',MessageSid:'SM'+randomBytes(16).toString('hex'),Body:body,TakoSyncTest:'1'},t0=performance.now()
 let raw='',st=0,t1=t0;for(let k=0;k<6;k++){t1=performance.now();try{const r=await fetch(tw.TWILIO_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','x-twilio-signature':sign(tw.TWILIO_WEBHOOK_URL,f)},body:new URLSearchParams(f).toString(),signal:AbortSignal.timeout(120000)});st=r.status;raw=await r.text();break}catch(e){raw='[ERRORE '+e.message+']';const local=/ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|getaddrinfo/.test(String(e?.cause?.code??e?.cause?.message??e.message));if(!local||k===5)break;await new Promise(z=>setTimeout(z,5000))}}
 const tBot=performance.now()-t1
 return{status:st,ms:Math.round(tBot),wallMs:Math.round(performance.now()-t0),reply:raw.replace(/<Message>/g,'\n').replace(/<[^>]+>/g,'').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim()}}
const snap=async()=>{for(let k=0;;k++){try{return await snap0()}catch(e){if(k>=10)throw e;await new Promise(z=>setTimeout(z,6000))}}};const snap0=async()=>{const [w]=await q(`SELECT revision,published FROM menu_workspaces WHERE restaurant_id='${QA}'`);const o={};for(const m of w.published.menus){for(const s of m.sections)o[m.name+' › '+s.name]=s.items.filter(i=>!i.hidden).map(i=>i.name+(i.price?' '+i.price:'')+(i.available===false?' (finito)':''));for(const f of m.formulas??[])o[m.name+' › opzione '+f.name]=[String(f.price)]}return o}
const diff=(a,b)=>Object.keys({...a,...b}).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k])).map(k=>k+': '+(a[k]??[]).join(', ')+' → '+(b[k]??[]).join(', '))
const steps=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),out=[];let prev=await snap();const start=prev
for(let i=0;i<steps.length;i++){const group=[steps[i]];while(i+1<steps.length&&typeof steps[i+1].gap==='number'){group.push(steps[++i])}
 const ps=[];for(let k=0;k<group.length;k++){if(k)await sleep(group[k].gap);ps.push(send(group[k].m))}
 const rs=await Promise.all(ps);await sleep(1500);const now=await snap(),d=diff(prev,now);prev=now
 group.forEach((g,k)=>{out.push({m:g.m,gap:g.gap,...rs[k],effect:k===group.length-1?d:[]});console.log(`> ${g.m}${g.gap!=null?' [+'+g.gap+' ms]':''} (${rs[k].ms} ms, ${rs[k].status})\n  ${rs[k].reply.replace(/\n+/g,' ⏎ ').slice(0,500)}`)})
 if(d.length)console.log('  EFFETTO: '+d.join(' | '));await sleep(2500)}
fs.writeFileSync(process.argv[3],JSON.stringify({start,end:prev,steps:out},null,1));console.log('FINE');console.log(JSON.stringify(prev,null,1))
