// Dashboard editor 22/10 — T7 concorrenza ed errori. Due pagine (SPA vera) sulla stessa API finta che applica applyOps lato server.
// Le op entrano dal canale del layer iframe (`tako-menu-edit-ops`, CONTRATTO §4), come farebbe il gesto/pannello.
// Criterio per scenario: 0 divergenze fra il documento finale di ogni client (quello che la SPA manda all'iframe) e quello del server.
// Esito: docs/webapp/dashboard-editor-2026-10-22/shots/verifica-concorrenza.json. Chrome headless.
import {writeFile,mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {startHarness,fixture,U,DOCS,tapFrame,fromFrame,frameDoc,waitFor,wait,strip} from './verify-menu-editor-dashboard.mjs'

const H=await startHarness();const {srv}=H;const out=[];
const reset=()=>Object.assign(srv,{doc:fixture(),published:fixture(),revision:3,publishedRevision:3,fail:[],offline:false,flag:true,calls:[]})
const same=async page=>{const d=await frameDoc(page);return !!d&&JSON.stringify(strip(d))===JSON.stringify(srv.doc)}
const converge=async(pages,ms=20000)=>{try{await waitFor(async()=>{for(const p of pages)if(!await same(p))return false;return true},ms,'convergenza');return 0}catch{let n=0;for(const p of pages)if(!await same(p))n++;return n}}
const item=id=>srv.doc.menus.flatMap(m=>m.sections.flatMap(s=>s.items)).find(i=>i.id===id)
async function scenario(name,fn){reset();const p1=await H.open('desktop'),p2=await H.open('desktop');const started=Date.now()
 try{for(const p of [p1,p2]){await p.waitForSelector('.mw-ed-stage');await tapFrame(p);await waitFor(()=>frameDoc(p),15000,'documento')}
  const extra=await fn(p1,p2)||{};const divergences=await converge(extra.pages||[p1,p2]);const ok=divergences===0&&extra.ok!==false
  out.push({scenario:name,ok,divergences,ms:Date.now()-started,...extra.detail?{detail:extra.detail}:{}});console.log(ok?'✓':'✗',name,divergences)}
 catch(e){out.push({scenario:name,ok:false,error:String(e.message||e)});console.log('✗',name,e.message)}
 finally{await p1.close();await p2.close()}}
const ops=(page,list,seq=1)=>fromFrame(page,{type:'tako-menu-edit-ops',seq,ops:list})
const set=(id,fields)=>({op:'set',kind:'item',id,fields})
try{
 await scenario('elementi diversi in parallelo',async(a,b)=>{await Promise.all([ops(a,[set(U(100),{name:'Da A'})]),ops(b,[set(U(110),{name:'Da B'})])]);await waitFor(()=>item(U(100)).name==='Da A'&&item(U(110)).name==='Da B',8000,'entrambe sul server');return {detail:'nessuna perdita'}})
 await scenario('stesso campo in parallelo',async(a,b)=>{await Promise.all([ops(a,[set(U(102),{price:20})]),ops(b,[set(U(102),{price:30})])]);await waitFor(()=>srv.calls.filter(c=>c.p.endsWith('/ops')).length>=2,8000,'due invii');return {detail:'vince l’ultimo arrivato: '+item(U(102)).price}})
 await scenario('bot cambia pubblicato+bozza con coda piena',async(a)=>{srv.latency=600;await ops(a,[set(U(120),{price:7})]);await wait(350);srv.bot(U(121),{price:9},'WhatsApp: prezzo Insalata');await ops(a,[set(U(100),{description:'Dopo il bot'})]);srv.latency=40;await waitFor(()=>item(U(100)).description==='Dopo il bot'&&item(U(120)).price===7,10000,'op dopo il bot');const toast=await a.waitForFunction(()=>/Aggiornato da WhatsApp/.test(document.querySelector('.mw-live-toast-text')?.textContent||''),{timeout:15000}).then(()=>true,()=>false);return {ok:toast&&item(U(121)).price===9,pages:[a],detail:'notifica WhatsApp '+(toast?'vista':'assente')}})
 await scenario('offline → online',async(a)=>{srv.offline=true;await ops(a,[set(U(100),{price:1})]);await ops(a,[set(U(100),{price:2})],2);await wait(1500);const pill=await a.evaluate(()=>/Non salvato, riprovo/.test(document.querySelector('.mw-live-toast-text')?.textContent||''));srv.offline=false;await waitFor(()=>item(U(100)).price===2,20000,'ripresa');return {ok:pill,pages:[a],detail:'pillola offline '+(pill?'vista':'assente')}})
 await scenario('404 bersaglio sparito',async(a)=>{srv.fail.push({path:'/ops',status:404,count:1});await ops(a,[set(U(100),{name:'Mai'})]);const pill=await a.waitForFunction(()=>/Modifica non applicata/.test(document.querySelector('.mw-live-toast-text')?.textContent||''),{timeout:8000}).then(()=>true,()=>false);return {ok:pill&&item(U(100)).name!=='Mai',pages:[a]}})
 await scenario('409 gerarchia (Sottomenu con figlie dentro un altro)',async(a)=>{await ops(a,[{op:'move',kind:'section',id:U(11),toParentId:U(10)}]);const pill=await a.waitForFunction(()=>/Modifica non applicata/.test(document.querySelector('.mw-live-toast-text')?.textContent||''),{timeout:8000}).then(()=>true,()=>false);return {ok:pill,pages:[a]}})
 await scenario('200 op consecutive',async(a)=>{for(let n=0;n<200;n++)await a.evaluate((id,n)=>{const f=document.querySelector('iframe.mw-ed-frame');f.contentWindow.eval(`parent.postMessage({v:1,type:'tako-menu-edit-ops',seq:${n},ops:[{op:'set',kind:'item',id:'${id}',fields:{price:${n}}}]},location.origin)`)},U(100),n);await waitFor(()=>item(U(100)).price===199,20000,'ultima op');const calls=srv.calls.filter(c=>c.p.endsWith('/ops'));const sizes=calls.map(c=>c.b.ops.length),prices=calls.flatMap(c=>c.b.ops.map(o=>o.fields.price));const ordered=prices.every((p,i)=>i===0||p>prices[i-1]);return {ok:ordered&&sizes.every(n=>n<=50)&&prices.length===200,pages:[a],detail:{richieste:calls.length,dimensioni:sizes,ordinato:ordered}}})
 await scenario('Pubblica con modifica dell’altra scheda in mezzo (409 → riquadro aggiornato)',async(a,b)=>{await ops(a,[set(U(100),{price:3})]);await waitFor(()=>item(U(100)).price===3,5000,'bozza');
  await a.evaluate(()=>[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Pubblica').click());await a.waitForSelector('dialog.mw-ed-publish[open] .mw-diff');
  await ops(b,[set(U(110),{price:44})]);await waitFor(()=>item(U(110)).price===44,5000,'modifica altrui');
  await a.evaluate(()=>[...document.querySelectorAll('dialog button')].find(x=>x.textContent.trim()==='Pubblica ora').click());
  const refreshed=await a.waitForFunction(()=>/cambiato nel frattempo/.test(document.querySelector('.mw-ed-publish .mw-publish-error')?.textContent||''),{timeout:15000}).then(()=>true,()=>false);
  await a.evaluate(()=>[...document.querySelectorAll('dialog button')].find(x=>x.textContent.trim()==='Pubblica ora').click());await waitFor(()=>JSON.stringify(srv.doc)===JSON.stringify(srv.published),8000,'pubblicato');return {ok:refreshed,detail:'riquadro aggiornato da solo '+refreshed}})
 if(H.errors.length)out.push({scenario:'errori nel browser',ok:false,error:H.errors})
}finally{await H.close()}
await mkdir(resolve(DOCS,'shots'),{recursive:true})
await writeFile(resolve(DOCS,'shots/verifica-concorrenza.json'),JSON.stringify({ambito:'due pagine Chrome headless, SPA vera, API finta con applyOps lato server',scenari:out},null,1))
const bad=out.filter(x=>!x.ok);console.log(JSON.stringify({ok:!bad.length,scenari:out.length,falliti:bad.map(x=>x.scenario)},null,1));if(bad.length)process.exitCode=1
