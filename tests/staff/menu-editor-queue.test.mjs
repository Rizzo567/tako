// Dashboard editor 22/10 — nucleo della SPA (13-menu-editor-core.js) con la vera menu-ops compilata come in lib/menu-ops.js.
import {readFileSync} from 'node:fs';import {test} from 'node:test';import assert from 'node:assert/strict';import {runInNewContext} from 'node:vm';
import {buildMenuOpsLib} from '../../scripts/build-staff-web.mjs';

const lib=await buildMenuOpsLib();
const coreCode=readFileSync(new URL('../../apps/dashboard/public/staff/src/13-menu-editor-core.js',import.meta.url),'utf8');
function load(){const ctx={console,AbortController,setTimeout,clearTimeout,Date,JSON,Promise};ctx.window=ctx;runInNewContext(lib+'\n;window.TakoMenuOps=TakoMenuOps;\n'+coreCode,ctx);return {Ops:ctx.TakoMenuOps,Core:ctx.TakoMenuEditorCore};}
const {Ops,Core}=load();
const plain=v=>JSON.parse(JSON.stringify(v));
const flush=async(n=6)=>{for(let i=0;i<n;i++)await new Promise(r=>setImmediate(r));};
function clock(){let now=0,id=0;const timers=new Map();return {env:{setTimeout:(f,ms)=>{const k=++id;timers.set(k,{f,at:now+ms});return k;},clearTimeout:k=>timers.delete(k),now:()=>now},
 async advance(ms){const end=now+ms;for(;;){const next=[...timers.entries()].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;timers.delete(next[0]);now=next[1].at;next[1].f();await flush();}now=end;await flush();},get pending(){return timers.size;}};}
const doc=()=>({schemaVersion:1,menus:[{id:'m1',name:'Pranzo',active:true,translations:{},sections:[{id:'s1',parentSectionId:null,name:'Primi',active:true,translations:{},items:[{id:'i1',name:'Carbonara',price:12,translations:{}},{id:'i2',name:'Gricia',price:10,translations:{}}]},{id:'s2',parentSectionId:null,name:'Secondi',active:true,translations:{},items:[]}]}]});
/* Server finto: applica le stesse op (applyOps), revisione +1 se cambia qualcosa. */
function server({latency=0}={}){const s={doc:doc(),revision:1,published:1,calls:[],fail:null,
 async send(ops,meta){s.calls.push({ops:plain(ops),meta:plain(meta)});if(latency)await new Promise(r=>setImmediate(r));if(s.fail){const f=s.fail;if(!f.sticky)s.fail=null;const e=new Error(f.message||'errore');e.status=f.status;throw e;}
  const r=Ops.applyOps(s.doc,ops);const changed=JSON.stringify(r.workspace)!==JSON.stringify(s.doc);s.doc=r.workspace;if(changed)s.revision++;return {revision:s.revision,publishedRevision:s.published,pending:true,results:plain(r.results)};},
 async load(){return {...plain(s.doc),revision:s.revision,publishedRevision:s.published};}};return s;}
function setup(opts={}){const c=clock(),srv=server(opts),events=[];const q=Core.createQueue({ops:Ops,env:c.env,send:(ops,meta)=>srv.send(ops,meta),load:()=>srv.load(),onEvent:e=>events.push(e)});q.init({...doc(),revision:1,publishedRevision:1});return {c,srv,q,events};}
const set=(id,fields)=>({op:'set',kind:'item',id,fields});
const names=d=>d.menus[0].sections.flatMap(s=>s.items.map(i=>i.name));

test('menu-ops nel bundle della SPA (node:vm): tutti i vettori condivisi danno lo stesso risultato',()=>{
 const {vectors}=JSON.parse(readFileSync(new URL('../../packages/menu-ops/test/vectors.json',import.meta.url),'utf8'));
 assert.ok(vectors.length>5);
 for(const v of vectors){const r=Ops.applyOps(v.input,v.ops);assert.deepEqual(plain(r.workspace),v.output,v.name);assert.deepEqual(plain(r.results),v.results,v.name);}
});

test('applicazione ottimistica subito, invio a gruppi entro 300 ms, una sola richiesta',async()=>{
 const {c,srv,q}=setup();
 q.push(set('i1',{name:'Carbonara vera'}));q.push(set('i2',{price:11}));
 assert.equal(names(q.view)[0],'Carbonara vera','la vista non aspetta il server');assert.equal(srv.calls.length,0);
 await c.advance(299);assert.equal(srv.calls.length,0);await c.advance(1);
 assert.equal(srv.calls.length,1);assert.equal(srv.calls[0].ops.length,2);assert.equal(srv.calls[0].meta.seq,1);assert.ok(srv.calls[0].meta.clientId);
 await q.whenIdle();assert.equal(q.snapshot.queued,0);assert.equal(q.snapshot.revision,2);assert.deepEqual(plain(q.view),plain(Core.strip(await srv.load())));
});

test('≤ 50 op per richiesta, ordine garantito, una richiesta alla volta (200 op consecutive)',async()=>{
 const {c,srv,q}=setup({latency:1});
 for(let n=0;n<200;n++)q.push(set('i1',{price:n}));
 await c.advance(300);await q.whenIdle();
 assert.deepEqual(srv.calls.map(x=>x.ops.length),[50,50,50,50]);assert.deepEqual(srv.calls.map(x=>x.meta.seq),[1,2,3,4]);
 assert.equal(srv.doc.menus[0].sections[0].items[0].price,199);assert.deepEqual(plain(q.view),plain(Core.strip(await srv.load())));
});

test('op rifiutata (results ok:false) → ricarica dal server e evento rejected',async()=>{
 const {c,srv,q,events}=setup();
 const done=q.push(set('nessuno',{name:'X'}));await c.advance(300);await q.whenIdle();
 assert.equal(await done,false);assert.ok(events.some(e=>e.type==='rejected'));assert.ok(events.some(e=>e.type==='reloaded'));
 assert.deepEqual(plain(q.view),plain(Core.strip(await srv.load())));
});

test('HTTP 404/409 → gruppo scartato, ricarica, pillola; le op dopo restano e partono',async()=>{
 for(const status of [404,409]){
  const {c,srv,q,events}=setup();srv.fail={status};
  q.push(set('i1',{name:'Persa'}));await c.advance(300);await flush();
  q.push(set('i2',{name:'Gricia buona'}));await c.advance(300);await q.whenIdle();
  assert.ok(events.some(e=>e.type==='rejected'&&e.status===status));
  assert.deepEqual(names(srv.doc),['Carbonara','Gricia buona']);assert.deepEqual(plain(q.view),plain(Core.strip(await srv.load())));
 }
});

test('offline → op in coda, evento offline, nuovi tentativi; online → tutto salvato senza perdite né riordino',async()=>{
 const {c,srv,q,events}=setup();srv.fail={status:0,sticky:true,message:'Failed to fetch'};
 q.push(set('i1',{price:20}));await c.advance(300);
 q.push(set('i1',{price:21}));
 assert.ok(events.some(e=>e.type==='offline'));assert.equal(q.snapshot.offline,true);assert.equal(q.snapshot.queued,2);assert.equal(q.view.menus[0].sections[0].items[0].price,21);
 await c.advance(1000);await c.advance(2000);assert.ok(srv.calls.length>=3);
 srv.fail=null;q.online();await c.advance(1);await q.whenIdle();
 assert.ok(events.some(e=>e.type==='online'));assert.equal(srv.doc.menus[0].sections[0].items[0].price,21);assert.equal(q.snapshot.offline,false);
});

test('op provvisorie (snapshot ordine manuale): solo in locale; partono davanti al primo rilascio reale; «Fine» senza rilasci le annulla',async()=>{
 const {c,srv,q}=setup();
 const snap=[{op:'manualOrder',value:true},{op:'reorder',kind:'section',parentId:'m1',ids:['s2','s1']}];
 q.provisional(snap);assert.equal(q.view.design?.manualOrder,true);assert.equal(q.view.menus[0].sections[0].id,'s2');
 await c.advance(1000);assert.equal(srv.calls.length,0,'mai inviate da sole');
 assert.equal(q.dropProvisional(),true);assert.equal(q.view.menus[0].sections[0].id,'s1');assert.equal(q.view.design?.manualOrder,undefined);
 q.provisional(snap);q.promote();q.push({op:'move',kind:'item',id:'i2',toParentId:'s2'});await c.advance(300);await q.whenIdle();
 assert.equal(srv.calls.length,1);assert.deepEqual(srv.calls[0].ops.map(o=>o.op),['manualOrder','reorder','move']);
 assert.equal(srv.doc.design.manualOrder,true);assert.deepEqual(plain(q.view),plain(Core.strip(await srv.load())));
});

test('revisione remota diversa: coda vuota → rimpiazzo; coda piena → ack, ricarica, riapplica le op non confermate',async()=>{
 const {c,srv,q}=setup();
 srv.doc.menus[0].sections[0].items[1].name='Gricia del bot';srv.revision=2;srv.published=2;
 q.remote({revision:2,publishedRevision:2,lastLabel:'WhatsApp: prezzo'});await flush();await q.whenIdle();
 assert.equal(names(q.view)[1],'Gricia del bot');assert.equal(q.snapshot.revision,2);
 q.push(set('i1',{price:30}));await c.advance(300);
 q.push(set('i1',{name:'Carbonara mia'}));// in coda, non ancora inviata
 srv.doc.menus[0].sections[0].items[1].price=99;srv.revision++;// scrittura altrui dopo il nostro ack
 q.remote({revision:srv.revision,publishedRevision:2});await flush();await c.advance(300);await q.whenIdle();
 const it=q.view.menus[0].sections[0].items;assert.equal(it[0].name,'Carbonara mia');assert.equal(it[0].price,30);assert.equal(it[1].price,99);
 assert.deepEqual(plain(q.view),plain(Core.strip(await srv.load())));
});

test('evento reloaded segnala la pubblicazione altrui (bot) con etichetta',async()=>{
 const {q,srv,events}=setup();srv.doc.menus[0].sections[0].items[0].price=13;srv.revision=3;srv.published=3;
 q.remote({revision:3,publishedRevision:3,lastLabel:'WhatsApp: prezzo Carbonara'});await flush();await q.whenIdle();
 const ev=events.find(e=>e.type==='reloaded');assert.ok(ev.publishedChanged);assert.equal(ev.label,'WhatsApp: prezzo Carbonara');assert.deepEqual(plain(Core.changedIds(ev.before,ev.after)),['i1']);
});

test('whenIdle aspetta la coda (Pubblica parte solo a coda vuota)',async()=>{
 const {srv,q}=setup({latency:1});q.push(set('i1',{price:1}));let done=false;const p=q.whenIdle().then(()=>{done=true;});
 await flush(1);await p;assert.equal(done,true);assert.equal(srv.calls.length,1,'whenIdle invia subito senza attendere i 300 ms');
});

test('mutateToOps: modifiche dei componenti esistenti (prezzo fisso) → op set in whitelist',()=>{
 const d=doc();const ops=Core.mutateToOps(d,x=>{x.menus[0].pricing='fisso';x.menus[0].formulas=[];x.menus[0].sections[0].items[0].price=1;},Ops.FIELD_WHITELIST);
 assert.deepEqual(plain(ops),[{op:'set',kind:'menu',id:'m1',fields:{pricing:'fisso',formulas:[]}},{op:'set',kind:'item',id:'i1',fields:{price:1}}]);
 assert.deepEqual(plain(Core.changedFields({promo:{price:5}},{promo:undefined},['promo'])),{promo:null},'undefined → null (il server toglie la promo)');
});

test('PDF del pubblicato: attesa 800 ms, richiesta precedente annullata, cache per revisione',async()=>{
 const c=clock(),calls=[],aborted=[];const states=[];
 const feed=Core.createPdfFeed({env:c.env,onChange:s=>states.push(s.status),render:(w,signal)=>{calls.push(w.revision);signal.addEventListener('abort',()=>aborted.push(w.revision));return new Promise(r=>setImmediate(()=>r({rev:w.revision})));}});
 feed.update({revision:1,menuIds:['m1']});await c.advance(0);await flush();assert.deepEqual(calls,[1]);assert.equal(feed.state.status,'ready');
 feed.update({revision:2,menuIds:['m1']});await c.advance(500);feed.update({revision:3,menuIds:['m1']});await c.advance(799);assert.deepEqual(calls,[1],'debounce');
 assert.equal(feed.state.blob.rev,1,'resta visibile il PDF di prima');await c.advance(1);await flush();assert.deepEqual(calls,[1,3]);assert.equal(feed.state.blob.rev,3);
 feed.update({revision:1,menuIds:['m1']});assert.equal(feed.state.blob.rev,1,'dalla cache, subito');assert.deepEqual(calls,[1,3]);
 feed.update({revision:null,menuIds:['m1']});assert.equal(feed.state.status,'empty');
});

test('poller dello stato: una richiesta alla volta, pausa durante Pubblica, backoff sugli errori',async()=>{
 const c=clock();let calls=0,paused=false,fail=1;const seen=[];
 const p=Core.createStatusPoller({env:{...c.env,document:null},paused:()=>paused,status:async()=>{calls++;if(fail-->0)throw new Error('x');return {revision:calls};},onStatus:s=>seen.push(s.revision)});
 p.start();await c.advance(5000);assert.equal(calls,1);assert.equal(p.failures,1);await c.advance(10000);assert.equal(calls,2);assert.deepEqual(seen,[2]);
 paused=true;await c.advance(5000);assert.equal(calls,2);p.stop();
});

test('revisione 22/10: 422 di un gruppo intero → le op si rimandano una alla volta, si perde solo quella invalida',async()=>{
 const {c,srv,q,events}=setup();const orig=srv.send;let groups=0;
 srv.send=async(ops,meta)=>{if(ops.length>1){groups++;const e=new Error('INVALID_DOCUMENT');e.status=422;srv.calls.push({ops:plain(ops),meta:plain(meta)});throw e;}if(ops[0].fields&&ops[0].fields.name===''){srv.calls.push({ops:plain(ops),meta:plain(meta)});const e=new Error('INVALID_DOCUMENT');e.status=422;throw e;}return orig(ops,meta);};
 const a=q.push(set('i1',{price:13})),b=q.push(set('i2',{name:''})),d=q.push(set('i2',{price:9}));
 await c.advance(300);for(let n=0;n<10;n++){await c.advance(10);}await q.whenIdle();
 assert.equal(groups,1);assert.equal(await a,true);assert.equal(await b,false);assert.equal(await d,true);
 assert.equal(srv.doc.menus[0].sections[0].items[0].price,13);assert.equal(srv.doc.menus[0].sections[0].items[1].price,9);assert.equal(srv.doc.menus[0].sections[0].items[1].name,'Gricia');
 assert.equal(events.filter(e=>e.type==='rejected').length,1);assert.deepEqual(plain(q.view),plain(Core.strip(await srv.load())));
});

test('revisione 22/10: risposta 200 con results[i].ok=false → le altre op restano applicate, ricarica e una sola pillola',async()=>{
 const {c,srv,q,events}=setup();
 const a=q.push(set('i1',{price:14})),b=q.push(set('nessuno',{name:'X'}));await c.advance(300);await q.whenIdle();
 assert.equal(await a,true);assert.equal(await b,false);assert.equal(srv.doc.menus[0].sections[0].items[0].price,14);assert.equal(q.view.menus[0].sections[0].items[0].price,14);
 assert.equal(events.filter(e=>e.type==='rejected').length,1);assert.ok(events.some(e=>e.type==='reloaded'));
});

test('revisione 22/10: stato remoto più vecchio (cache) → nessuna ricarica, mai indietro di revisione',async()=>{
 const {c,srv,q}=setup();q.push(set('i1',{price:15}));await c.advance(300);await q.whenIdle();assert.equal(q.snapshot.revision,2);
 let loads=0;const load=srv.load;srv.load=async()=>{loads++;return load();};
 assert.equal(q.remote({revision:1,publishedRevision:1}),false);assert.equal(q.remote({revision:2,publishedRevision:1}),false);await flush();
 assert.equal(loads,0);assert.equal(q.snapshot.revision,2);assert.equal(q.remote({revision:3,publishedRevision:1}),true);await flush();await q.whenIdle();assert.equal(loads,1);
});

test('revisione 22/10: whenIdle(timeout) senza rete → false allo scadere, le op restano in coda',async()=>{
 const {c,srv,q}=setup();srv.fail={status:0,sticky:true};
 q.push(set('i1',{price:16}));await c.advance(300);
 let res=null;q.whenIdle(8000).then(v=>{res=v;});await c.advance(7999);assert.equal(res,null);await c.advance(1);assert.equal(res,false);
 assert.ok(q.snapshot.queued>=1);srv.fail=null;q.online();await flush();await c.advance(300);assert.equal(await q.whenIdle(8000),true);assert.equal(srv.doc.menus[0].sections[0].items[0].price,16);
});
