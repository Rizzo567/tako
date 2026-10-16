import{readFileSync}from'node:fs';import{test}from'node:test';import assert from'node:assert/strict';
const code=readFileSync(new URL('../../apps/dashboard/public/staff/src/13-menu-live-sync.js',import.meta.url),'utf8');
const load=()=>{const window={};new Function('window',code)(window);return window.TakoMenuLive;};
const doc=(revision,items)=>({revision,publishedRevision:revision,menus:[{id:'m',sections:[{id:'s',items}]}]});
const dish=(id,name,price,extra={})=>({id,name,price,available:true,hidden:false,imageUrl:null,description:null,tags:[],allergens:[],featured:false,...extra});
const flush=()=>new Promise(r=>setImmediate(r));
function harness({dirty=false,paused=false,versions,remote,fail=0}={}){
 const Live=load(),timers=[],listeners={},calls={versions:0,load:0},applied=[],notes=[];let inFlight=0,maxInFlight=0;
 const env={setTimeout:(fn,ms)=>{const t={fn,ms,id:timers.length+1};timers.push(t);return t.id;},clearTimeout:id=>{const t=timers.find(x=>x.id===id);if(t)t.cleared=true;},
  document:{visibilityState:'visible',addEventListener:(t,f)=>{listeners[t]=f;},removeEventListener:t=>{delete listeners[t];}}};
 const saved=doc(4,[dish('a','Polpo rucola e patate',12),dish('b','Piatto di verifica',12)]);
 const state={revision:4,saved,dirty,paused};
 const track=async v=>{inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);await flush();inFlight--;return v;};
 const sync=Live.create({env,getState:()=>state,
  listVersions:async()=>{calls.versions++;if(fail-->0){await flush();throw new Error('offline');}return track(versions||[{revision:6,label:'WhatsApp: pubblicazione confermata'},{revision:5,label:'WhatsApp: bozza confermata'}]);},
  load:async()=>{calls.load++;return track(remote||doc(6,[dish('a','Polpo rucola e patate',12),dish('b','Piatto di verifica',13)]));},
  onApply:(next,ids)=>{applied.push({next,ids});state.revision=next.revision;state.saved=next;},onNotify:n=>notes.push(n)});
 const pending=()=>timers.filter(t=>!t.cleared&&!t.ran);
 const fire=async()=>{const t=pending().at(-1);assert.ok(t,'a timer is scheduled');t.ran=true;await t.fn();await flush();};
 return{Live,sync,env,state,calls,applied,notes,listeners,timers,pending,fire,get maxInFlight(){return maxInFlight;}};
}

test('remote revision greater and no local changes: reloads, highlights changed dish, WhatsApp message with dish name',async()=>{
 const h=harness();h.sync.start();assert.equal(h.pending()[0].ms,5000);await h.fire();
 assert.equal(h.calls.versions,1);assert.equal(h.calls.load,1);assert.equal(h.applied.length,1);
 assert.deepEqual(h.applied[0].ids,['b']);assert.equal(h.applied[0].next.revision,6);
 assert.deepEqual(h.notes,[{message:'Aggiornato da WhatsApp: Piatto di verifica',reload:false,revision:6}]);
 await h.fire();assert.equal(h.calls.load,1,'same revision afterwards: no reload');assert.equal(h.notes.length,1);h.sync.stop();
});

test('local unsaved changes: document untouched, only a notification with Ricarica, shown once per revision',async()=>{
 const h=harness({dirty:true});h.sync.start();await h.fire();
 assert.equal(h.applied.length,0);assert.equal(h.notes.length,1);assert.equal(h.notes[0].reload,true);assert.equal(h.notes[0].message,'Aggiornato da WhatsApp: Piatto di verifica');
 await h.fire();assert.equal(h.notes.length,1,'no repeated notification');assert.equal(h.applied.length,0);h.sync.stop();
});

test('hidden tab: no request; returning visible checks immediately',async()=>{
 const h=harness();h.env.document.visibilityState='hidden';h.sync.start();assert.equal(h.pending().length,0);await flush();assert.equal(h.calls.versions,0);
 h.env.document.visibilityState='visible';await h.listeners.visibilitychange();await flush();assert.equal(h.calls.versions,1,'immediate check on return');
 h.env.document.visibilityState='hidden';h.listeners.visibilitychange();assert.equal(h.pending().length,0,'timer cleared while hidden');h.sync.stop();assert.equal(h.listeners.visibilitychange,undefined);
});

test('no overlapping requests and pause while busy',async()=>{
 const h=harness();h.sync.start();const a=h.sync.tick(),b=h.sync.tick();await Promise.all([a,b]);await flush();
 assert.equal(h.calls.versions,1);assert.equal(h.maxInFlight,1);
 const p=harness({paused:true});p.sync.start();await p.fire();await p.fire();assert.equal(p.calls.versions,0,'busy → no request');assert.equal(p.pending().length,1,'still scheduled');p.sync.stop();h.sync.stop();
});

test('network errors back off without notifications',async()=>{
 const h=harness({fail:3});h.sync.start();await h.fire();assert.equal(h.pending().at(-1).ms,10000);await h.fire();assert.equal(h.pending().at(-1).ms,20000);await h.fire();
 assert.equal(h.notes.length,0);await h.fire();assert.equal(h.applied.length,1);assert.equal(h.pending().at(-1).ms,5000,'back to normal after success');h.sync.stop();
});

test('own saves are not notified: local revision already equal',async()=>{
 const h=harness({versions:[{revision:4,label:'Salvataggio'}]});h.sync.start();await h.fire();assert.equal(h.calls.load,0);assert.equal(h.notes.length,0);h.sync.stop();
});

test('becoming busy while the request is in flight discards the result',async()=>{
 const h=harness();h.sync.start();const t=h.pending()[0];t.ran=true;const run=t.fn();h.state.paused=true;await run;await flush();assert.equal(h.applied.length,0);assert.equal(h.notes.length,0);h.sync.stop();
});

test('messages: WhatsApp single dish, WhatsApp many, other sources; added dishes count as changed',()=>{
 const L=load();const before=doc(1,[dish('a','A',1)]);
 assert.deepEqual(L.changedItems(before,doc(2,[dish('a','A',1),dish('n','Nuovo',3)])).map(c=>c.id),['n']);
 for(const [k,v] of Object.entries({name:'B',available:false,hidden:true,imageUrl:'x',description:'d',tags:['t'],allergens:['g'],featured:true}))assert.equal(L.changedItems(before,doc(2,[dish('a','A',1,{[k]:v})])).length,1,k);
 assert.equal(L.message('WhatsApp: pubblicazione confermata',[{id:'a',name:'Polpo rucola e patate'}]),'Aggiornato da WhatsApp: Polpo rucola e patate');
 assert.equal(L.message('WhatsApp: pubblicazione confermata',[{id:'a',name:'A'},{id:'b',name:'B'}]),'Aggiornato da WhatsApp');
 assert.equal(L.message('Salvataggio',[{id:'a',name:'A'}]),'Menu aggiornato');
 assert.deepEqual(L.latest([{revision:3,label:'x'},{revision:9,label:'y'}]),{revision:9,label:'y'});
});
