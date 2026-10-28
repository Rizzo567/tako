import test,{mock} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import {transform} from 'esbuild';
// Menu pubblico live (Compito 2): socket Realtime solo in ricezione, riserva ≤ 1 lettura/60 s, niente ritentativi live.
async function loadModule(path,ctx){const out={module:{exports:{}},...ctx};runInNewContext((await transform(readFileSync(path,'utf8'),{loader:'ts',format:'cjs'})).code,out);return out.module.exports}
function environment(){
 const listeners={doc:{},win:{}},sockets=[]
 const document={visibilityState:'visible',addEventListener:(t,f)=>{(listeners.doc[t]??=[]).push(f)},removeEventListener:(t,f)=>{listeners.doc[t]=(listeners.doc[t]||[]).filter(x=>x!==f)}}
 const window={addEventListener:(t,f)=>{(listeners.win[t]??=[]).push(f)},removeEventListener:(t,f)=>{listeners.win[t]=(listeners.win[t]||[]).filter(x=>x!==f)}}
 class FakeSocket{constructor(url){this.url=url;this.readyState=0;this.sent=[];sockets.push(this);setTimeout(()=>{this.readyState=1;this.onopen?.()},0)}send(m){const d=JSON.parse(m);this.sent.push(d);if(d.topic==='phoenix'&&!this.silent)setTimeout(()=>this.reply({topic:'phoenix',event:'phx_reply',payload:{status:'ok'},ref:d.ref}),0)}close(){this.readyState=3;this.closed=true}reply(m){this.onmessage?.({data:JSON.stringify(m)})}}
 const fire=(where,t,e={})=>(listeners[where][t]||[]).forEach(f=>f(e))
 return {document,window,FakeSocket,sockets,fire,ctx:{document,window,setTimeout:(...a)=>setTimeout(...a),clearTimeout:(t)=>clearTimeout(t),Date,Math,JSON,String,Number,encodeURIComponent}}
}
// I timer annidati non scattano in un solo tick: si avanza a passi di 250 ms.
const advance=ms=>{for(let left=ms;left>0;left-=250)mock.timers.tick(Math.min(250,left))}
const join=(socket,topic='realtime:menu-live:r1')=>socket.reply({topic,event:'phx_reply',payload:{status:'ok',response:{}},ref:'1'})
test('joins the PRIVATE channel of the restaurant and reacts only to its version signal',async()=>{
 mock.timers.enable({apis:['setTimeout','Date']});try{
 const env=environment(),live=await loadModule('apps/web/src/lib/public-menu-live.ts',env.ctx),reasons=[]
 const stop=live.watchPublicMenu('r1',r=>reasons.push(r),{WebSocketImpl:env.FakeSocket,now:()=>Date.now()})
 advance(1);const s=env.sockets[0];assert.match(s.url,/\/realtime\/v1\/websocket\?apikey=sb_publishable_[^&]+&vsn=1\.0\.0$/)
 const joinMsg=s.sent[0];assert.equal(joinMsg.topic,'realtime:menu-live:r1');assert.equal(joinMsg.event,'phx_join');assert.equal(joinMsg.payload.config.private,true);assert.equal(joinMsg.payload.config.broadcast.self,false)
 join(s);s.reply({topic:'realtime:menu-live:other',event:'broadcast',payload:{event:'v',payload:{}}});s.reply({topic:'realtime:menu-live:r1',event:'broadcast',payload:{event:'other',payload:{}}})
 assert.deepEqual(reasons,[]);s.reply({topic:'realtime:menu-live:r1',event:'broadcast',payload:{type:'broadcast',event:'v',payload:{at:1}}});assert.deepEqual(reasons,['push'])
 // Socket agganciato: nessuna lettura periodica, solo heartbeat.
 advance(10*60000);assert.deepEqual(reasons,['push']);assert.ok(s.sent.some(m=>m.topic==='phoenix'&&m.event==='heartbeat'))
 stop();assert.ok(s.closed)}finally{mock.timers.reset()}
})
test('without a socket: at most one read every 60 s, and none while the tab is hidden',async()=>{
 mock.timers.enable({apis:['setTimeout','Date']});try{
 const env=environment(),live=await loadModule('apps/web/src/lib/public-menu-live.ts',env.ctx),reasons=[]
 class Broken{constructor(){throw Error('blocked')}}
 const stop=live.watchPublicMenu('r1',r=>reasons.push(r),{WebSocketImpl:Broken,now:()=>Date.now()})
 advance(180000);assert.deepEqual(reasons,['poll','poll','poll'])
 env.document.visibilityState='hidden';env.fire('doc','visibilitychange');advance(600000);assert.equal(reasons.length,3)
 env.document.visibilityState='visible';env.fire('doc','visibilitychange');assert.deepEqual(reasons.slice(3),['resume'])
 advance(59000);assert.equal(reasons.length,4);advance(2000);assert.equal(reasons.length,5);stop()}finally{mock.timers.reset()}
})
test('background: socket closed after 15 s hidden, one read on resume, then rejoined',async()=>{
 mock.timers.enable({apis:['setTimeout','Date']});try{
 const env=environment(),live=await loadModule('apps/web/src/lib/public-menu-live.ts',env.ctx),reasons=[]
 const stop=live.watchPublicMenu('r1',r=>reasons.push(r),{WebSocketImpl:env.FakeSocket,now:()=>Date.now()})
 advance(1);join(env.sockets[0])
 env.document.visibilityState='hidden';env.fire('doc','visibilitychange');advance(5000)
 env.document.visibilityState='visible';env.fire('doc','visibilitychange');assert.deepEqual(reasons,[],'short switch: socket kept, no read');assert.equal(env.sockets.length,1)
 env.document.visibilityState='hidden';env.fire('doc','visibilitychange');advance(16000);assert.ok(env.sockets[0].closed);advance(3600000);assert.equal(env.sockets.length,1,'no reconnect in background')
 env.document.visibilityState='visible';env.fire('doc','visibilitychange');assert.deepEqual(reasons,['resume']);advance(1);assert.equal(env.sockets.length,2);join(env.sockets[1]);assert.deepEqual(reasons,['resume'])
 env.fire('win','online');assert.deepEqual(reasons,['resume','resume']);stop()}finally{mock.timers.reset()}
})
test('a dropped socket reconnects with backoff and re-reads once after rejoining',async()=>{
 mock.timers.enable({apis:['setTimeout','Date']});try{
 const env=environment(),live=await loadModule('apps/web/src/lib/public-menu-live.ts',env.ctx),reasons=[]
 const stop=live.watchPublicMenu('r1',r=>reasons.push(r),{WebSocketImpl:env.FakeSocket,now:()=>Date.now()})
 advance(1);join(env.sockets[0]);env.sockets[0].onclose();advance(1400);assert.equal(env.sockets.length,2);advance(1);join(env.sockets[1]);assert.deepEqual(reasons,['resume'])
 // Join rifiutato (es. troppi collegamenti): nuovo tentativo, intanto riserva a 60 s.
 env.sockets[1].reply({topic:'realtime:menu-live:r1',event:'phx_error',payload:{}});advance(61000);assert.ok(reasons.includes('poll')||env.sockets.length>2);stop()}finally{mock.timers.reset()}
})
test('jitter: a structural push re-reads at once (shared read in the Worker), the reconcile after a delta is spread (0.15–3.5 s), resume is short',async()=>{
 const live=await loadModule('apps/web/src/lib/public-menu-live.ts',environment().ctx)
 assert.equal(live.liveJitter('push',()=>0),0);assert.equal(live.liveJitter('push',()=>1),0)
 assert.equal(live.liveJitter('reconcile',()=>0),150);assert.equal(live.liveJitter('reconcile',()=>1),3500);assert.ok(live.liveJitter('resume',()=>1)<=800)
})
test('the published delta of the signal is passed to the page (old {at}-only signals still mean «re-read»)',async()=>{
 mock.timers.enable({apis:['setTimeout','Date']});try{
 const env=environment(),live=await loadModule('apps/web/src/lib/public-menu-live.ts',env.ctx),got=[]
 const stop=live.watchPublicMenu('r1',(r,sig)=>got.push([r,sig]),{WebSocketImpl:env.FakeSocket,now:()=>Date.now()})
 advance(1);const s=env.sockets[0];join(s)
 s.reply({topic:'realtime:menu-live:r1',event:'broadcast',payload:{type:'broadcast',event:'v',payload:{at:1,k:'a',d:[{i:'x',a:false}]}}})
 s.reply({topic:'realtime:menu-live:r1',event:'broadcast',payload:{type:'broadcast',event:'v',payload:{at:2}}})
 assert.equal(got.length,2);assert.equal(got[0][0],'push');assert.equal(got[0][1].d[0].i,'x');assert.equal(got[1][1].d,undefined);stop()}finally{mock.timers.reset()}
})
test('phone locked (timers frozen, socket maybe dead): on return after ≥ 15 s the socket is reopened and the menu re-read once',async()=>{
 mock.timers.enable({apis:['setTimeout','Date']});try{
 const env=environment(),live=await loadModule('apps/web/src/lib/public-menu-live.ts',env.ctx),reasons=[];let clock=Date.now()
 const stop=live.watchPublicMenu('r1',r=>reasons.push(r),{WebSocketImpl:env.FakeSocket,now:()=>clock})
 advance(1);join(env.sockets[0])
 // Nascosta 9 s (timer congelati: l'orologio avanza, i timer no): socket tenuto ma una rilettura di sicurezza.
 env.document.visibilityState='hidden';env.fire('doc','visibilitychange');clock+=9000
 env.document.visibilityState='visible';env.fire('doc','visibilitychange');assert.deepEqual(reasons,['resume']);assert.equal(env.sockets.length,1)
 // Nascosta 40 s con i timer congelati: il socket «vivo» viene sostituito e si rilegge.
 env.document.visibilityState='hidden';env.fire('doc','visibilitychange');clock+=40000
 env.document.visibilityState='visible';env.fire('doc','visibilitychange');assert.deepEqual(reasons,['resume','resume']);assert.ok(env.sockets[0].closed);advance(1);assert.equal(env.sockets.length,2);stop()}finally{mock.timers.reset()}
})
test('live reads are prefetch-marked, never retried on 429, and invalidation is per restaurant',async()=>{
 const calls=[];const cache=await loadModule('apps/web/src/lib/public-menu-cache.ts',{fetch:async url=>{calls.push(url);return url.includes('/r9/')?{ok:false,status:429,headers:{get:k=>k==='Retry-After'?'12':null}}:{ok:true,status:200,json:async()=>({data:{id:'m1'},defaultLanguage:'it'})}},URLSearchParams,setTimeout,DOMException,globalThis:{}})
 await cache.loadMenu('r1','m1','en',{live:true});assert.match(calls[0],/prefetch=1/);await cache.loadMenu('r1','m1','en',{live:true,token:'0123456789abcdef'});assert.match(calls[1],/live=0123456789abcdef/);await cache.loadMenu('r1','m1','en',{live:true,token:'<bad>'});assert.ok(!calls[2].includes('live='))
 await assert.rejects(cache.loadMenu('r9','','',{live:true}),e=>e.status===429&&e.retryAfterMs===12000);assert.equal(calls.filter(u=>u.includes('/r9/')).length,1)
 await cache.loadMenu('r2','m1','');assert.ok(cache.cachedMenu('r1','m1','en'));cache.invalidateMenus('r1');assert.equal(cache.cachedMenu('r1','m1','en'),undefined);assert.ok(cache.cachedMenu('r2','m1',''))
})
test('the public menu keeps the reading point and skips sibling prefetch after a live refresh',()=>{
 const menu=readFileSync('apps/web/src/components/DigitalMenu.tsx','utf8'),renderer=readFileSync('apps/web/src/components/WorkspaceMenuRenderer.tsx','utf8')
 assert.ok(menu.includes('watchPublicMenu(restaurantId'));assert.ok(menu.includes('readingAnchor()'));assert.ok(menu.includes('restoreReadingAnchor(anchor)'));assert.ok(menu.includes("{live:true,token:tokenRef.current}"));assert.ok(menu.includes('if(liveRef.current){liveRef.current=false;return}'))
 assert.ok(renderer.includes('data-item-id={it.id}'))
})
test('a socket that stops answering heartbeats is replaced (no silent dead connection)',async()=>{
 mock.timers.enable({apis:['setTimeout','Date']});try{
 const env=environment(),live=await loadModule('apps/web/src/lib/public-menu-live.ts',env.ctx),reasons=[]
 const stop=live.watchPublicMenu('r1',r=>reasons.push(r),{WebSocketImpl:env.FakeSocket,now:()=>Date.now()})
 advance(1);join(env.sockets[0]);env.sockets[0].silent=true;advance(25000+10000+500);assert.ok(env.sockets[0].closed);advance(2000);assert.equal(env.sockets.length,2);stop()}finally{mock.timers.reset()}
})
