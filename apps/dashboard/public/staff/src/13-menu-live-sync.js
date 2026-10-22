/* Menu live (15/10/2026): le modifiche fatte dal bot WhatsApp (o da un'altra scheda) compaiono senza ricaricare.
   Controllo leggero ogni 5 s con GET /api/menu-workspace/versions (ogni mutazione scrive una riga versione con
   revisione ed etichetta: niente endpoint nuovo). Solo con la schermata Menu montata e la scheda visibile; mai due
   richieste insieme; in pausa durante salvataggio/pubblicazione/busy; errori di rete → backoff senza toast.
   Revisione remota > locale: senza modifiche locali ricarica ed evidenzia i piatti cambiati; con modifiche locali solo
   la notifica con «Ricarica» (il 409 al salvataggio resta la protezione). File JS puro: testato in tests/staff/menu-live-sync.test.mjs. */
(function(){
 const FIELDS=['name','price','available','hidden','imageUrl','description','tags','allergens','featured'];
 const itemsOf=doc=>{const map=new Map();(doc&&doc.menus||[]).forEach(m=>(m.sections||[]).forEach(s=>(s.items||[]).forEach(i=>map.set(i.id,i))));return map;};
 const same=(a,b)=>JSON.stringify(a===undefined?null:a)===JSON.stringify(b===undefined?null:b);
 // Piatti cambiati (per id) o aggiunti tra il documento salvato locale e quello remoto.
 function changedItems(before,after){const old=itemsOf(before),out=[];itemsOf(after).forEach((item,id)=>{const prev=old.get(id);if(!prev||FIELDS.some(k=>!same(prev[k],item[k])))out.push({id,name:item.name||''});});return out;}
 function message(label,changed){if(/^\s*whatsapp/i.test(label||''))return changed.length===1&&changed[0].name?'Aggiornato da WhatsApp: '+changed[0].name:'Aggiornato da WhatsApp';return 'Menu aggiornato';}
 /* GET /api/menu-workspace/status (edge di lettura, 22/10) → stessa forma di latest(): {revision,label}. */
 function fromStatus(st){const n=Number(st&&st.revision);return Number.isFinite(n)?{revision:n,label:String((st&&st.lastLabel)||'')}:null;}
 function latest(rows){let top=null;(Array.isArray(rows)?rows:[]).forEach(r=>{const n=Number(r&&r.revision);if(Number.isFinite(n)&&(!top||n>top.revision))top={revision:n,label:String(r.label||'')};});return top;}

 /* o: {listVersions, load, getState:()=>({revision,saved,dirty,paused}), onApply(next,ids), onNotify({message,reload,revision}),
       interval, maxDelay, env:{setTimeout,clearTimeout,document}} */
 function create(o){
  const env=o.env||{setTimeout:(f,ms)=>window.setTimeout(f,ms),clearTimeout:id=>window.clearTimeout(id),document:window.document};
  const interval=o.interval||5000,maxDelay=o.maxDelay||60000;
  let timer=null,inFlight=false,stopped=true,failures=0,notified=0;
  const visible=()=>env.document.visibilityState==='visible';
  const clear=()=>{if(timer!==null)env.clearTimeout(timer);timer=null;};
  const schedule=delay=>{clear();if(stopped||!visible())return;timer=env.setTimeout(tick,delay);};
  const delay=()=>failures?Math.min(interval*Math.pow(2,failures),maxDelay):interval;
  async function tick(){
   timer=null;
   if(stopped||!visible()||inFlight)return;
   const state=o.getState();
   if(!state||state.paused){schedule(interval);return;}
   inFlight=true;const startedAt=Date.now();
   try{
    const top=o.status?fromStatus(await o.status()):latest(await o.listVersions());
    let st=o.getState();
    if(!stopped&&top&&st&&!st.paused&&Number.isFinite(st.revision)&&top.revision>st.revision){
     if(st.dirty){
      if(top.revision>notified){const next=await o.load();st=o.getState();if(!stopped&&st&&st.dirty){notified=top.revision;o.onNotify({message:message(top.label,changedItems(st.saved,next)),reload:true,revision:top.revision});}}
     }else{
      const next=await o.load();st=o.getState();
      if(!stopped&&st&&!st.paused&&!st.dirty&&next&&next.revision>st.revision){const changed=changedItems(st.saved,next);o.onApply(next,changed.map(c=>c.id));o.onNotify({message:message(top.label,changed),reload:false,revision:next.revision});}
     }
    }
    failures=0;
   }catch(e){failures=Math.min(failures+1,6);}
   // Cadenza da inizio a inizio (5 s anche se la risposta impiega 1 s); col backoff conta l'attesa piena.
   finally{inFlight=false;schedule(failures?delay():Math.max(250,interval-(Date.now()-startedAt)));}
  }
  const onVisibility=()=>{if(stopped)return;if(visible()){clear();tick();}else clear();};
  return {
   start(){if(!stopped)return;stopped=false;env.document.addEventListener('visibilitychange',onVisibility);schedule(interval);},
   stop(){stopped=true;clear();env.document.removeEventListener('visibilitychange',onVisibility);},
   tick,
   get inFlight(){return inFlight;},get failures(){return failures;},get scheduled(){return timer!==null;}
  };
 }

 /* Notifica a pillola (riferimento: toast «Transcription copied» dell'app Flow iOS). Una sola istanza: un nuovo evento
    sostituisce il testo e riparte dal valore corrente dell'animazione, senza code. Sempre scura, in tema chiaro e scuro. */
 const motion=()=>window.TakoMenuMotion||{};
 const ms=(k,f)=>{const v=motion().durationMs&&motion().durationMs[k];return typeof v==='number'?v:f;};
 const ease=(k,f)=>{const v=motion().easing&&motion().easing[k];return Array.isArray(v)?'cubic-bezier('+v.join(',')+')':f;};
 const reduced=()=>!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 let host=null,pill=null,text=null,actions=null,hideTimer=null,shown=false;
 function ensure(){
  if(host&&host.isConnected)return;
  const d=window.document;host=d.createElement('div');host.className='mw-live-toast-host';
  pill=d.createElement('div');pill.className='mw-live-toast';pill.setAttribute('role','status');pill.setAttribute('aria-live','polite');pill.setAttribute('aria-atomic','true');pill.hidden=true;
  const icon=d.createElement('span');icon.className='mw-live-toast-icon';icon.setAttribute('aria-hidden','true');
  icon.innerHTML='<svg viewBox="0 0 24 24" width="25" height="25"><path d="M6.4 12.6l3.7 3.7 7.6-8.2" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  text=d.createElement('span');text.className='mw-live-toast-text';
  actions=d.createElement('span');actions.className='mw-live-toast-actions';
  pill.append(icon,text,actions);host.append(pill);d.body.append(host);
 }
 function animateTo(frame,duration,easing,done,start){
  const cs=getComputedStyle(pill),from=start||{opacity:cs.opacity,transform:cs.transform};
  pill.getAnimations().forEach(a=>a.cancel());
  const keyframes=[{opacity:from.opacity,transform:from.transform==='none'?'none':from.transform},frame];
  const anim=pill.animate(keyframes,{duration,easing,fill:'forwards'});
  anim.onfinish=()=>{if(done)done();};
  return anim;
 }
 function hide(){
  if(!pill||!shown)return;shown=false;window.clearTimeout(hideTimer);hideTimer=null;
  const r=reduced();
  animateTo({opacity:0,transform:r?'none':'translateY(-8px) scale(.97)'},r?ms('micro',140):ms('exit',220),ease('exit','cubic-bezier(.4,0,1,1)'),()=>{if(!shown){pill.hidden=true;pill.getAnimations().forEach(a=>a.cancel());actions.replaceChildren();}});
 }
 function show({message,action=null,duration=3000}){
  ensure();window.clearTimeout(hideTimer);hideTimer=null;
  text.textContent=message;text.title=message;actions.replaceChildren();
  if(action){
   const btn=window.document.createElement('button');btn.type='button';btn.className='mw-live-toast-action';btn.textContent=action.label;btn.addEventListener('click',()=>{hide();action.onClick();});
   const close=window.document.createElement('button');close.type='button';close.className='mw-live-toast-close';close.setAttribute('aria-label','Chiudi notifica');close.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';close.addEventListener('click',hide);
   actions.append(btn,close);
  }
  pill.classList.toggle('has-action',!!action);
  const r=reduced();
  let start=null;
  if(pill.hidden){pill.hidden=false;pill.getAnimations().forEach(a=>a.cancel());start={opacity:'0',transform:r?'none':'translateY(-14px) scale(.94)'};}
  shown=true;
  animateTo({opacity:1,transform:'none'},r?ms('micro',140):ms('surface',340),ease('out','cubic-bezier(.22,1,.36,1)'),null,start);
  if(!action)hideTimer=window.setTimeout(hide,duration);
 }
 const toast={show,hide,get element(){return pill;}};
 window.TakoMenuLive={create,changedItems,message,latest,fromStatus,toast};
})();
