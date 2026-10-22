/* Dashboard editor 22/10 — nucleo senza React (testato in tests/staff/menu-editor-*.test.mjs).
   Contratto: docs/webapp/dashboard-editor-2026-10-22/CONTRATTO.md §1–§4. Le op si applicano con window.TakoMenuOps.applyOps
   (stessa libreria del server, compilata da scripts/build-staff-web.mjs in lib/menu-ops.js).
   - createQueue: documento di lavoro + coda delle op. La vista non aspetta mai il server (applicazione ottimistica);
     invio a gruppi ogni ≤ 300 ms, una richiesta alla volta (ordine garantito), ≤ 50 op per richiesta;
     op provvisorie (snapshot ordine manuale) solo in locale finché non arriva il primo rilascio reale;
     revisione remota diversa → ricarica (coda vuota) o ricarica dopo l'ack con riapplicazione delle op non confermate;
     op rifiutata (results[i].ok=false: il server applica le altre) → ricarica dal server + evento «rejected» solo per quelle;
     422 dell'intero gruppo (server vecchio) → le op si rimandano una alla volta, si perde solo quella invalida;
     404/409/400 → ricarica dal server + evento «rejected»;
     rete assente / 5xx → le op restano in coda, evento «offline», nuovi tentativi con attesa crescente.
   - createStatusPoller: GET /api/menu-workspace/status ogni 5 s (solo scheda visibile, mai due richieste insieme).
   - createPdfFeed: PDF del pubblicato per revisione (attesa 800 ms, richiesta precedente annullata, cache per revisione). */
(function(){
 const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
 const same=(a,b)=>JSON.stringify(a===undefined?null:a)===JSON.stringify(b===undefined?null:b);
 const defaultEnv=()=>({setTimeout:(f,ms)=>setTimeout(f,ms),clearTimeout:id=>clearTimeout(id),now:()=>Date.now()});
 const strip=doc=>{if(!doc)return doc;const {revision,publishedRevision,capabilities,pending,dashboardEditor,...data}=doc;return data;};
 /* Codici di rifiuto definitivi (l'op non passerà mai così com'è): si ricarica dal server. */
 const REJECT=new Set([400,404,409,422]);

 function createQueue(o){
  const ops=o.ops||(typeof window!=='undefined'&&window.TakoMenuOps);
  if(!ops||typeof ops.applyOps!=='function')throw new Error('TakoMenuOps non disponibile');
  const env=o.env||defaultEnv(),batchMs=o.batchMs??300,maxBatch=o.maxBatch??50,retry=o.retryMs||[1000,2000,4000,8000,15000];
  const clientId=o.clientId||('c-'+Math.random().toString(36).slice(2,10)+Date.now().toString(36));
  let confirmed=null,view=null,revision=null,publishedRevision=null,serverPending=false;
  let outbox=[],inflight=null,provisional=[],seq=0,nextId=1;
  let timer=null,retryTimer=null,failures=0,offline=false,reloading=null,reloadWanted=false,remoteSeen=null,lastLabel='',destroyed=false;
  let waiters=[];
  const ahead=(a,b)=>Number.isFinite(a)&&(!Number.isFinite(b)||a>b);
  const apply=(doc,list)=>list.length?ops.applyOps(doc,list.map(e=>e.op)).workspace:doc;
  const snapshot=()=>({view,revision,publishedRevision,clientId,pending:serverPending||outbox.length>0||!!inflight||provisional.length>0,
   queued:outbox.length+(inflight?inflight.entries.length:0),offline,provisional:provisional.length>0,saving:!!inflight||outbox.length>0});
  const emit=()=>{if(!destroyed&&o.onChange)o.onChange(snapshot());};
  const event=e=>{if(!destroyed&&o.onEvent)o.onEvent(e);};
  const recompute=()=>{view=confirmed?apply(apply(apply(confirmed,inflight?inflight.entries:[]),provisional),outbox):null;emit();};
  const idle=()=>!inflight&&!outbox.length&&!reloading&&!timer;
  const settle=()=>{if(!idle())return;const list=waiters;waiters=[];list.forEach(w=>w());};
  const schedule=ms=>{if(timer!==null||destroyed)return;timer=env.setTimeout(()=>{timer=null;flush();},ms);};
  function flush(){
   if(destroyed)return;
   if(timer!==null){env.clearTimeout(timer);timer=null;}
   if(inflight||reloading||!confirmed){settle();return;}
   if(reloadWanted){reload();return;}
   if(!outbox.length){settle();return;}
   if(retryTimer!==null){env.clearTimeout(retryTimer);retryTimer=null;}
   // Dopo un 422 di gruppo le op si rimandano una alla volta (solo), così si perde solo quella invalida.
   let n=maxBatch;if(outbox[0].solo)n=1;else{const k=outbox.findIndex(e=>e.solo);if(k>0)n=Math.min(n,k);}
   const entries=outbox.splice(0,n);inflight={entries,seq:++seq};
   const sent=inflight;
   emit();
   Promise.resolve().then(()=>o.send(entries.map(e=>e.op),{clientId,seq:sent.seq})).then(r=>ack(sent,r),e=>fail(sent,e));
  }
  function ack(sent,r){
   if(destroyed||inflight!==sent)return;
   inflight=null;failures=0;
   if(offline){offline=false;event({type:'online'});}
   const results=Array.isArray(r&&r.results)?r.results:[];
   const okEntries=[],rejected=[];
   sent.entries.forEach((e,i)=>{const res=results[i];if(res&&res.ok===false&&res.code!=='EXISTS')rejected.push({entry:e,code:res.code});else okEntries.push(e);});
   confirmed=apply(confirmed,okEntries);
   const nextRev=r&&Number.isFinite(r.revision)?r.revision:null,nextPub=r&&r.publishedRevision!==undefined?r.publishedRevision:publishedRevision;
   // Un'altra scrittura in mezzo (altra scheda, bot): la revisione non è la nostra +1 → ricarica e riapplica le op non confermate.
   // Il server non alza la revisione se le op non cambiano nulla (ripetute/rifiutate): +0 o +1 sono nostri.
   if(nextRev!==null&&revision!==null&&nextRev!==revision&&nextRev!==revision+1)reloadWanted=true;
   if(nextPub!==publishedRevision)reloadWanted=true;
   if(remoteSeen&&nextRev!==null&&(ahead(remoteSeen.revision,nextRev)||ahead(remoteSeen.publishedRevision,nextPub)))reloadWanted=true;
   if(nextRev!==null)revision=nextRev;
   if(r&&typeof r.pending==='boolean')serverPending=r.pending;
   // Pubblicazione altrui scoperta dall'ack: la revisione pubblicata la aggiorna la ricarica, così l'evento «reloaded» la segnala.
   if(nextPub!==publishedRevision)reloadWanted=true;
   sent.entries.forEach(e=>{const bad=rejected.some(x=>x.entry===e);e.done&&e.done(!bad);});
   if(rejected.length){reloadWanted=true;event({type:'rejected',codes:rejected.map(x=>x.code),ops:rejected.map(x=>x.entry.op)});}
   if(reloadWanted){reload();return;}
   if(rejected.length)recompute();else emit();
   if(outbox.length)schedule(0);else settle();
  }
  function fail(sent,e){
   if(destroyed||inflight!==sent)return;
   inflight=null;
   const status=e&&e.status;
   // 422 di un gruppo intero (server che non risponde per op): si rimanda una op alla volta, nell'ordine.
   if(status===422&&sent.entries.length>1){sent.entries.forEach(x=>{x.solo=true;});outbox=sent.entries.concat(outbox);emit();schedule(0);return;}
   if(REJECT.has(status)){
    sent.entries.forEach(x=>x.done&&x.done(false));
    event({type:'rejected',status,codes:[status],ops:sent.entries.map(x=>x.op),message:e&&e.message});
    reloadWanted=true;reload();return;
   }
   // Rete assente, 5xx, 546, sessione: si rimette in testa, si riprova (backoff), niente perdita né riordino.
   outbox=sent.entries.concat(outbox);failures++;
   if(!offline){offline=true;event({type:'offline',status:status||0,auth:status===401||status===403});}
   emit();
   const wait=retry[Math.min(failures-1,retry.length-1)];
   if(retryTimer!==null)env.clearTimeout(retryTimer);
   retryTimer=env.setTimeout(()=>{retryTimer=null;flush();},wait);
  }
  function reload(){
   if(destroyed)return Promise.resolve();
   if(reloading)return reloading;
   if(inflight){reloadWanted=true;return Promise.resolve();}
   reloadWanted=false;
   if(timer!==null){env.clearTimeout(timer);timer=null;}
   const before=confirmed,pubBefore=publishedRevision,label=lastLabel;
   reloading=Promise.resolve().then(()=>o.load()).then(doc=>{
    if(destroyed)return;
    reloading=null;remoteSeen=null;
    confirmed=strip(clone(doc));revision=Number.isFinite(doc.revision)?doc.revision:revision;publishedRevision=doc.publishedRevision!==undefined?doc.publishedRevision:publishedRevision;
    if(typeof doc.pending==='boolean')serverPending=doc.pending;
    recompute();
    event({type:'reloaded',before,after:confirmed,publishedChanged:pubBefore!==publishedRevision&&before!==null,label});
    if(outbox.length)schedule(0);else settle();
   },e=>{
    reloading=null;reloadWanted=true;failures++;
    if(!offline){offline=true;event({type:'offline',status:(e&&e.status)||0,auth:e&&(e.status===401||e.status===403)});emit();}
    const wait=retry[Math.min(failures-1,retry.length-1)];
    if(retryTimer!==null)env.clearTimeout(retryTimer);
    retryTimer=env.setTimeout(()=>{retryTimer=null;if(offline&&!reloadWanted)return;reload().then(()=>{if(offline&&!reloading){offline=false;event({type:'online'});emit();}});},wait);
   });
   emit();
   return reloading;
  }
  const entriesOf=list=>(Array.isArray(list)?list:[list]).filter(Boolean).map(op=>({op,id:nextId++}));
  return {
   clientId,
   /* Documento caricato dal server (normalizzato: revision, publishedRevision, pending). Ripristina tutto. */
   init(doc){confirmed=strip(clone(doc));revision=Number.isFinite(doc.revision)?doc.revision:null;publishedRevision=doc.publishedRevision??null;serverPending=typeof doc.pending==='boolean'?doc.pending:revision!==publishedRevision;outbox=[];provisional=[];inflight=null;reloadWanted=false;recompute();},
   /* Dopo Pubblica/Scarta: nuovo documento del server; le op ancora in coda si riapplicano sopra. */
   replace(doc){confirmed=strip(clone(doc));if(Number.isFinite(doc.revision))revision=doc.revision;if(doc.publishedRevision!==undefined)publishedRevision=doc.publishedRevision;if(typeof doc.pending==='boolean')serverPending=doc.pending;recompute();},
   /* Op reali: subito nella vista, al server entro batchMs. Promessa = true all'ack, false se rifiutata. */
   push(list){const entries=entriesOf(list);if(!entries.length||!confirmed)return Promise.resolve(false);
    const done=Promise.all(entries.map(e=>new Promise(res=>{e.done=res;}))).then(all=>all.every(Boolean));
    outbox.push(...entries);view=apply(view,entries);emit();if(!inflight&&!reloading)schedule(batchMs);return done;},
   provisional(list){provisional=entriesOf(list);recompute();},
   /* Primo rilascio reale: le provvisorie partono davanti, nell'ordine in cui la vista le ha applicate. */
   promote(){if(!provisional.length)return false;outbox=provisional.concat(outbox);provisional=[];recompute();if(!inflight&&!reloading)schedule(batchMs);return true;},
   dropProvisional(){if(!provisional.length)return false;provisional=[];recompute();return true;},
   /* Stato remoto (poller): revisione o pubblicazione diversa → ricarica (subito se la coda è vuota, altrimenti dopo l'ack). */
   /* Solo in avanti: uno stato più vecchio (lettura in cache, risposta in ritardo) non fa mai tornare indietro di revisione. */
   remote(st){if(!st||!confirmed)return false;if(typeof st.lastLabel==='string')lastLabel=st.lastLabel;
    const changed=(revision!==null&&ahead(st.revision,revision))||ahead(st.publishedRevision,publishedRevision);
    if(!changed){if(typeof st.pending==='boolean'&&st.revision===revision&&!outbox.length&&!inflight&&!provisional.length&&serverPending!==st.pending){serverPending=st.pending;emit();}return false;}
    if(inflight){remoteSeen={revision:st.revision,publishedRevision:st.publishedRevision};return true;}
    reloadWanted=true;if(!timer)flush();return true;},
   flush,
   /* Promessa risolta a coda vuota e nessuna richiesta in corso (Pubblica aspetta qui): true; con timeoutMs, false se
      allo scadere la coda non si è svuotata (rete assente) — chi aspetta si libera, le op restano in coda. */
   whenIdle(timeoutMs){if(timer!==null){env.clearTimeout(timer);timer=null;flush();}if(idle())return Promise.resolve(true);
    return new Promise(r=>{let t=null;const w=()=>{if(t!==null)env.clearTimeout(t);r(true);};waiters.push(w);
     if(timeoutMs>0)t=env.setTimeout(()=>{t=null;waiters=waiters.filter(x=>x!==w);r(false);},timeoutMs);});},
   reload,
   online(){if(offline||outbox.length){if(retryTimer!==null){env.clearTimeout(retryTimer);retryTimer=null;}flush();}},
   destroy(){destroyed=true;if(timer!==null)env.clearTimeout(timer);if(retryTimer!==null)env.clearTimeout(retryTimer);timer=retryTimer=null;waiters=[];},
   get view(){return view;},get snapshot(){return snapshot();},get confirmed(){return confirmed;},
   get outbox(){return outbox.map(e=>e.op);},get inflight(){return inflight?inflight.entries.map(e=>e.op):[];},get provisionalOps(){return provisional.map(e=>e.op);}
  };
 }

 function createStatusPoller(o){
  const env=o.env||{setTimeout:(f,ms)=>setTimeout(f,ms),clearTimeout:id=>clearTimeout(id),document:typeof document!=='undefined'?document:null};
  const interval=o.interval||5000,maxDelay=o.maxDelay||60000;
  let timer=null,busy=false,stopped=true,failures=0;
  const visible=()=>!env.document||env.document.visibilityState!=='hidden';
  const clear=()=>{if(timer!==null)env.clearTimeout(timer);timer=null;};
  const schedule=ms=>{clear();if(!stopped&&visible())timer=env.setTimeout(tick,ms);};
  async function tick(){timer=null;if(stopped||busy||!visible())return;if(o.paused&&o.paused()){schedule(interval);return;}busy=true;
   try{const st=await o.status();failures=0;if(!stopped)o.onStatus(st);}catch(e){failures=Math.min(failures+1,6);}
   finally{busy=false;schedule(failures?Math.min(interval*Math.pow(2,failures),maxDelay):interval);}}
  const onVis=()=>{if(stopped)return;if(visible()){clear();tick();}else clear();};
  return {start(){if(!stopped)return;stopped=false;env.document&&env.document.addEventListener('visibilitychange',onVis);schedule(interval);},
   stop(){stopped=true;clear();env.document&&env.document.removeEventListener('visibilitychange',onVis);},tick,get failures(){return failures;}};
 }

 /* PDF del pubblicato: la colonna destra chiede update({revision,menuIds}); il feed decide quando chiamare render.
    Cambio di revisione → attesa 800 ms (le pubblicazioni ravvicinate fanno una sola richiesta), richiesta precedente annullata;
    stessa revisione già scaricata → subito dalla cache. Durante l'aggiornamento resta visibile il PDF di prima. */
 function createPdfFeed(o){
  const env=o.env||defaultEnv(),debounce=o.debounceMs??800,max=o.cacheSize||6;
  const cache=new Map();let state={status:'idle',blob:null,error:'',key:''},timer=null,ctl=null,want=null,destroyed=false;
  const set=next=>{state={...state,...next};if(!destroyed&&o.onChange)o.onChange(state);};
  const keyOf=w=>w.revision+'|'+(w.menuIds||[]).join(',');
  function run(w){
   if(destroyed)return;timer=null;if(ctl)ctl.abort();const mine=ctl=new AbortController(),key=keyOf(w);
   set({status:'loading',error:'',key});
   Promise.resolve().then(()=>o.render(w,mine.signal)).then(blob=>{
    if(mine.signal.aborted||destroyed)return;cache.set(key,blob);while(cache.size>max)cache.delete(cache.keys().next().value);
    if(ctl===mine)ctl=null;if(want&&keyOf(want)===key)set({status:'ready',blob,error:'',key});
   },e=>{if(mine.signal.aborted||destroyed||(e&&e.name==='AbortError'))return;if(ctl===mine)ctl=null;set({status:'error',error:(e&&e.message)||'PDF non disponibile',key});});
  }
  return {
   update(w){if(!w||w.revision==null||!(w.menuIds||[]).length){want=null;if(timer!==null)env.clearTimeout(timer);timer=null;if(ctl)ctl.abort();ctl=null;set({status:'empty',blob:null,error:'',key:''});return;}
    const key=keyOf(w);if(want&&keyOf(want)===key&&state.status!=='error')return;want=w;
    if(timer!==null){env.clearTimeout(timer);timer=null;}
    if(cache.has(key)){if(ctl)ctl.abort();ctl=null;set({status:'ready',blob:cache.get(key),error:'',key});return;}
    if(ctl)ctl.abort();ctl=null;
    set({status:'loading',error:'',key});
    timer=env.setTimeout(()=>run(w),state.blob?debounce:0);},
   retry(){if(want){if(timer!==null)env.clearTimeout(timer);run(want);}},
   destroy(){destroyed=true;if(timer!==null)env.clearTimeout(timer);if(ctl)ctl.abort();},
   get state(){return state;},get cacheKeys(){return [...cache.keys()];}
  };
 }

 /* ── Aiuti sul documento ── */
 function locate(doc,kind,id){
  for(const menu of (doc&&doc.menus)||[]){
   if(kind==='menu'&&menu.id===id)return {kind,menu};
   for(const section of menu.sections||[]){
    if(kind==='section'&&section.id===id)return {kind,menu,section,root:section.parentSectionId?menu.sections.find(s=>s.id===section.parentSectionId)||null:section};
    if(kind==='item')for(const item of section.items||[])if(item.id===id)return {kind,menu,section,item,root:section.parentSectionId?menu.sections.find(s=>s.id===section.parentSectionId)||section:section};
   }
  }
  return null;
 }
 /* Campi cambiati (solo whitelist); undefined → null, così il server cancella i facoltativi (promo, scarsità). */
 function changedFields(before,after,keys){const out={};(keys||Object.keys(after||{})).forEach(k=>{if(!same(before&&before[k],after&&after[k]))out[k]=after[k]===undefined?null:clone(after[k]);});return out;}
 /* Una funzione «mutate» dei componenti esistenti (es. MenuFixedPricePanel) → op set per id. Solo campi in whitelist;
    le modifiche strutturali (creazioni/rimozioni) non passano di qui. */
 function mutateToOps(doc,fn,whitelist){
  const next=clone(doc);fn(next);const list=[];
  const wl=whitelist||((typeof window!=='undefined'&&window.TakoMenuOps&&window.TakoMenuOps.FIELD_WHITELIST)||{menu:[],section:[],item:[]});
  next.menus.forEach(m=>{const pm=doc.menus.find(x=>x.id===m.id);if(!pm)return;let f=changedFields(pm,m,wl.menu);if(Object.keys(f).length)list.push({op:'set',kind:'menu',id:m.id,fields:f});
   m.sections.forEach(s=>{const ps=pm.sections.find(x=>x.id===s.id);if(!ps)return;f=changedFields(ps,s,wl.section);if(Object.keys(f).length)list.push({op:'set',kind:'section',id:s.id,fields:f});
    s.items.forEach(i=>{const pi=ps.items.find(x=>x.id===i.id);if(!pi)return;f=changedFields(pi,i,wl.item);if(Object.keys(f).length)list.push({op:'set',kind:'item',id:i.id,fields:f});});});});
  return list;
 }
 /* Piatti cambiati o comparsi fra due documenti (per il lampeggio e la notifica «Aggiornato da WhatsApp»). */
 function changedIds(before,after){
  const index=doc=>{const map=new Map();((doc&&doc.menus)||[]).forEach(m=>{map.set('m:'+m.id,m);(m.sections||[]).forEach(s=>{const {items,...rest}=s;map.set('s:'+s.id,rest);(s.items||[]).forEach(i=>map.set('i:'+i.id,i));});});return map;};
  const a=index(before),b=index(after),out=[];
  b.forEach((v,k)=>{if(k.startsWith('m:')){const p=a.get(k);const {sections,...x}=v;const y=p?(({sections,...r})=>r)(p):null;if(!same(x,y))out.push(k.slice(2));return;}if(!same(a.get(k),v))out.push(k.slice(2));});
  return out;
 }
 /* Conflitti bot al Pubblica (22/10, CONTRATTO §3): modifiche da WhatsApp già online che la bozza non ha.
    Fonti: 409 BOT_CONFLICTS (error.body.conflicts) o riepilogo GET /publish/diff (data.botConflicts). */
 const isBotConflictsError=e=>!!e&&e.status===409&&(e.body?.error?.code==='BOT_CONFLICTS'||e.body?.error==='BOT_CONFLICTS');
 const botConflictsOf=review=>{const list=review&&(Array.isArray(review.conflicts)&&review.conflicts.length?review.conflicts:review.diff&&Array.isArray(review.diff.botConflicts)?review.diff.botConflicts:[]);return Array.isArray(list)?list.filter(c=>c&&typeof c.name==='string'):[];};
 const botConflictNames=list=>[...new Set((list||[]).map(c=>String(c.name||'').trim()).filter(Boolean))];
 const botConflictsText=list=>{const names=botConflictNames(list);return 'Da WhatsApp sono state fatte modifiche che non sono in questa bozza'+(names.length?': '+names.join(', '):'')+'. Se pubblichi, ai clienti tornerà la versione della bozza.';};
 const api={createQueue,createStatusPoller,createPdfFeed,locate,changedFields,mutateToOps,changedIds,strip,same,isBotConflictsError,botConflictsOf,botConflictNames,botConflictsText};
 if(typeof window!=='undefined')window.TakoMenuEditorCore=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
