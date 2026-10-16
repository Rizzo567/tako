/* F2 — Preset settimanali per menu (16/10/2026). Variante A approvata: [Menu ▾] [Preset ▾] …… [🔍] [+].
   Contratto movimento: docs/webapp/feature-vendita-2026-10-16/prototipo-preset/FEATURE-MOTION-preset.md
   (M06 vassoio/lista e dialoghi, M01 etichetta, M09 chip, M08 interruttore, M05 azioni con attesa reale).
   Tempi e curve SOLO dai token window.TakoMenuMotion (ripiego = stessi valori di menu-motion.tokens.json).
   Il preset si modifica con lo stesso editor del menu: l'adattatore sostituisce le categorie del menu con quelle
   del preset; «Salva» scrive il preset (mai il documento) e «Pubblica» mette online il preset dopo l'OK. */
const MW_DP_TOKENS={durationMs:{press:90,micro:140,fast:180,standard:280,surface:340,exit:220,data:600},easing:{out:[.22,1,.36,1],exit:[.4,0,1,1]},distancePx:{micro:6,panel:12},scale:{enter:.98},blurPx:{textSwap:3},staggerMs:{list:24,maximumItems:5},recipeDelayMs:{contentAfterSurface:60,textSwap:40}};
const MW_DP_M=()=>{const t=window.TakoMenuMotion||{};return {durationMs:{...MW_DP_TOKENS.durationMs,...t.durationMs},easing:{...MW_DP_TOKENS.easing,...t.easing},distancePx:{...MW_DP_TOKENS.distancePx,...t.distancePx},scale:{...MW_DP_TOKENS.scale,...t.scale},blurPx:{...MW_DP_TOKENS.blurPx,...t.blurPx},staggerMs:{...MW_DP_TOKENS.staggerMs,...t.staggerMs},recipeDelayMs:{...MW_DP_TOKENS.recipeDelayMs,...t.recipeDelayMs}};};
const MW_DP_RM=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const MW_DP_BEZ=a=>`cubic-bezier(${a.join(',')})`;
const MW_DP_DUR=k=>MW_DP_RM()?0:MW_DP_M().durationMs[k];
/* Variabili CSS dai token: una sola fonte per tempi e curve (a zero con reduced motion, tranne lo spinner). */
const MW_DP_STYLE=()=>{const m=MW_DP_M(),rm=MW_DP_RM(),d=k=>(rm&&k!=='data'?0:m.durationMs[k])+'ms';return {'--dp-press':d('press'),'--dp-micro':d('micro'),'--dp-fast':d('fast'),'--dp-standard':d('standard'),'--dp-surface':d('surface'),'--dp-exit':d('exit'),'--dp-data':d('data'),'--dp-out':MW_DP_BEZ(m.easing.out),'--dp-exit-ease':MW_DP_BEZ(m.easing.exit),'--dp-content-delay':(rm?0:m.recipeDelayMs.contentAfterSurface)+'ms','--dp-stagger':(rm?0:m.staggerMs.list)+'ms','--dp-dist-micro':(rm?0:m.distancePx.micro)+'px','--dp-gap':m.distancePx.panel+'px'};};
const MW_DP_SHORT={1:'Lun',2:'Mar',3:'Mer',4:'Gio',5:'Ven',6:'Sab',7:'Dom'};
const MW_DP_JSON=v=>JSON.parse(JSON.stringify(v));

/* ---------- API (si aggiungono al contratto dell'editor; il QA le sostituisce con un finto backend) ---------- */
const MW_DP_REQUEST=async(path,method='GET',body)=>{const r=await fetch('/api/menu-workspace/day-presets'+path,{method,credentials:'include',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json().catch(()=>null);if(!r.ok){const e=new Error(j?.error?.message||'Operazione preset non riuscita');e.status=r.status;throw e;}return j?.data;};
window.TakoMenuDayPresetApi={
 listDayPresets:()=>MW_DP_REQUEST(''),
 readDayPreset:id=>MW_DP_REQUEST('/'+encodeURIComponent(id)),
 activateDayPresets:(menuId,source,fromMenuId)=>MW_DP_REQUEST('/activate','POST',{menuId,source,...(fromMenuId?{fromMenuId}:{})}),
 setDayPresetSettings:(menuId,patch)=>MW_DP_REQUEST('/settings/'+encodeURIComponent(menuId),'PUT',patch),
 createDayPreset:(menuId,name,source,fromPresetId)=>MW_DP_REQUEST('','POST',{menuId,name,source,...(fromPresetId?{fromPresetId}:{})}),
 updateDayPreset:(id,patch)=>MW_DP_REQUEST('/'+encodeURIComponent(id),'PUT',patch),
 deleteDayPreset:id=>MW_DP_REQUEST('/'+encodeURIComponent(id),'DELETE'),
 publishDayPreset:(id,expectedRevision)=>MW_DP_REQUEST('/'+encodeURIComponent(id)+'/publish','POST',{expectedRevision}),
 markNoticeRead:id=>MW_DP_REQUEST('/notices/'+encodeURIComponent(id)+'/read','POST',{}),
};

/* ---------- Adattatore: l'editor lavora sul preset come se fosse il menu ---------- */
const MW_DP_OTHER=(doc,menuId)=>{const c=MW_DP_JSON(doc);delete c.revision;delete c.publishedRevision;delete c.capabilities;delete c.presetView;const m=c.menus.find(x=>x.id===menuId);if(m)m.sections=[];return JSON.stringify(c);};
/* «Pubblicato» solo se il preset è quello online e non è cambiato dopo la pubblicazione. */
const MW_DP_PUBLISHED=(v,revision)=>v.online&&v.onlineAt&&v.updatedAt&&v.updatedAt<=v.onlineAt?revision:null;
window.MW_DAY_PRESET_ADAPTER=(base,viewRef)=>{
 const api={...window.TakoMenuDayPresetApi,...Object.fromEntries(Object.keys(window.TakoMenuDayPresetApi).filter(k=>typeof base[k]==='function').map(k=>[k,base[k]]))};
 const swap=doc=>{const v=viewRef.current;if(!v||!doc)return doc;const menu=doc.menus.find(m=>m.id===v.menuId);if(!menu)return doc;v.baseDoc=MW_DP_JSON(doc);const next=MW_DP_JSON(doc);next.menus.find(m=>m.id===v.menuId).sections=MW_DP_JSON(v.sections);next.publishedRevision=MW_DP_PUBLISHED(v,doc.revision);next.presetView={id:v.presetId,name:v.name};return next;};
 const blocked=()=>{const e=new Error('Stai modificando un preset: torna a «Menu attuale» per questa funzione.');e.status=400;return e;};
 return {...base,dayPresets:api,
  load:async()=>swap(await base.load()),
  save:async(document,revision,publishedRevision)=>{
   const v=viewRef.current;if(!v)return base.save(document,revision,publishedRevision);
   // Solo le categorie del menu finiscono nel preset: ogni altra modifica appartiene al menu attuale.
   if(v.baseDoc&&MW_DP_OTHER(document,v.menuId)!==MW_DP_OTHER(v.baseDoc,v.menuId)){const e=new Error('Queste modifiche riguardano il menu attuale: torna a «Menu attuale» per salvarle.');e.status=400;throw e;}
   const menu=document.menus.find(m=>m.id===v.menuId);
   const saved=await api.updateDayPreset(v.presetId,{expectedRevision:v.revision,sections:menu.sections});
   Object.assign(v,{revision:saved.revision,sections:saved.sections||menu.sections,updatedAt:saved.updatedAt,itemCount:saved.itemCount});
   window.dispatchEvent(new CustomEvent('tako-day-presets-changed'));
   const next=MW_DP_JSON(document);next.publishedRevision=MW_DP_PUBLISHED(v,revision);return next;},
  publishDiff:async()=>{const v=viewRef.current;if(!v)return base.publishDiff();const doc=await base.load();return {revision:doc.revision,preset:{id:v.presetId,name:v.name},added:[],removed:[],changed:[],details:[]};},
  publish:async revision=>{const v=viewRef.current;if(!v)return base.publish(revision);const r=await api.publishDayPreset(v.presetId,revision);v.online=true;v.onlineAt=new Date().toISOString();window.dispatchEvent(new CustomEvent('tako-day-presets-changed'));return r;},
  createVersion:(...a)=>viewRef.current?Promise.reject(blocked()):base.createVersion(...a),
  restoreVersion:(...a)=>viewRef.current?Promise.reject(blocked()):base.restoreVersion(...a),
  previewImport:(...a)=>viewRef.current?Promise.reject(blocked()):base.previewImport(...a),
 };
};

/* ---------- Stato dei preset per la schermata ---------- */
function useMenuDayPresets({adapter,viewRef,menu,document,dirty,busy,refresh,save,discard}){
 const api=adapter?.dayPresets;
 const [data,setData]=useState(null),[error,setError]=useState(''),[open,setOpen]=useState(false),[pending,setPending]=useState(''),[guardState,setGuardState]=useState(null),[confirmState,setConfirmState]=useState(null),[view,setViewState]=useState(viewRef.current?{...viewRef.current}:null);
 const btnRef=useRef(null),epoch=useRef(0),kbOpen=useRef(false);
 const reload=useCallback(async()=>{if(!api)return null;try{const d=await api.listDayPresets();setData(d);setError('');return d;}catch(e){setError(e.message||'Preset non disponibili');return null;}},[api]);
 useEffect(()=>{reload();const on=()=>{setViewState(viewRef.current?{...viewRef.current}:null);reload();};window.addEventListener('tako-day-presets-changed',on);return()=>window.removeEventListener('tako-day-presets-changed',on);},[reload]);
 const menuId=menu?.id,eligible=!!menu&&menu.type!=='drinks'&&!!api;
 const settings=data?.settings?.find(s=>s.menuId===menuId)||{menuId,enabled:false,autoPublish:false,onlinePresetId:null};
 const presets=(data?.presets||[]).filter(p=>p.menuId===menuId).sort((a,b)=>(a.weekday??99)-(b.weekday??99)||a.position-b.position);
 const otherMenus=(document?.menus||[]).filter(m=>m.id!==menuId&&m.type!=='drinks'&&(data?.presets||[]).some(p=>p.menuId===m.id&&p.weekday));
 const viewing=view&&view.menuId===menuId?view:null;
 const setView=next=>{viewRef.current=next;setViewState(next?{...next}:null);};
 /* Cambio di contenuto: richiede «Salva o scarta» se ci sono modifiche aperte. */
 const guard=(action,from)=>{if(!dirty){action();return;}setGuardState({action,from,name:viewing?viewing.name:'Menu attuale'});};
 const enter=async preset=>{const ep=++epoch.current;setPending('view');try{const full=await api.readDayPreset(preset.id);if(ep!==epoch.current)return;setView({menuId:full.menuId,presetId:full.id,name:full.name,weekday:full.weekday,revision:full.revision,sections:full.sections||[],updatedAt:full.updatedAt,itemCount:full.itemCount,online:settings.onlinePresetId===full.id,onlineAt:settings.onlineAt});await refresh();}catch(e){setError(e.message||'Preset non disponibile');}finally{if(ep===epoch.current)setPending('');}};
 const leave=async()=>{epoch.current++;if(!viewRef.current)return;setView(null);await refresh();};
 const pick=id=>{setOpen(false);if(id==='attuale'){if(viewing)guard(()=>leave());return;}if(viewing?.presetId===id)return;const p=presets.find(x=>x.id===id);if(p)guard(()=>enter(p));};
 // Cambiando menu dal selettore si esce dal preset (con «Salva o scarta» se serve).
 const guardMenuChange=action=>{if(!viewRef.current){action();return;}guard(()=>{epoch.current++;setView(null);action();refresh();});};
 useEffect(()=>{if(viewRef.current&&menuId&&viewRef.current.menuId!==menuId&&!dirty){setView(null);refresh();}},[menuId]);
 const activate=async(source,fromMenuId)=>{setPending('activate:'+source+(fromMenuId||''));setError('');try{await api.activateDayPresets(menuId,source,fromMenuId);await reload();toast(source==='empty'?'Preset attivi: 7 giorni pronti':'Preset attivi: 7 giorni copiati',{type:'success'});}catch(e){setError(e.message);}finally{setPending('');}};
 const setEnabled=async enabled=>{setPending('enabled');setError('');try{await api.setDayPresetSettings(menuId,{enabled});if(!enabled&&viewing)await leave();await reload();toast(enabled?'Preset riattivati':'Preset disattivati: restano salvati',{type:'success'});}catch(e){setError(e.message);}finally{setPending('');}};
 /* M08: lo stato cambia al gesto; se il server rifiuta si torna indietro con un messaggio. */
 const setAuto=async autoPublish=>{const prev=data;setData(d=>d&&{...d,settings:[...d.settings.filter(s=>s.menuId!==menuId),{...settings,autoPublish}]});setError('');try{await api.setDayPresetSettings(menuId,{autoPublish});await reload();toast(autoPublish?'Pubblicazione automatica attiva dal prossimo cambio giornata (6:00)':'Pubblicazione automatica spenta',{type:'success'});}catch(e){setData(prev);setError(e.message||'Interruttore non aggiornato');}};
 const create=async(name,source,fromPresetId)=>{setPending('create');setError('');try{const p=await api.createDayPreset(menuId,name,source,fromPresetId);await reload();toast(`Creato «${p.name}»`,{type:'success'});guard(()=>enter(p));return true;}catch(e){setError(e.message);return false;}finally{setPending('');}};
 const rename=async name=>{if(!viewing)return false;setPending('rename');setError('');try{const p=await api.updateDayPreset(viewing.presetId,{expectedRevision:viewRef.current?.revision??viewing.revision,name});Object.assign(viewRef.current,{name:p.name,revision:p.revision,updatedAt:p.updatedAt});setViewState({...viewRef.current});await reload();toast('Preset rinominato',{type:'success'});return true;}catch(e){setError(e.message);return false;}finally{setPending('');}};
 const remove=()=>{if(!viewing)return;const target=viewing;setConfirmState({title:`Eliminare «${target.name}»?`,text:target.online?'È il preset online: il menu dei clienti non cambia, ma il preset non tornerà disponibile.':'Il preset viene eliminato. Il menu online non cambia.',confirmLabel:'Elimina',danger:true,onConfirm:async()=>{await api.deleteDayPreset(target.presetId);discard();await leave();await reload();toast(`Eliminato «${target.name}»`,{type:'success'});}});};
 const markRead=async id=>{try{await api.markNoticeRead(id);}finally{reload();}};
 const toggle=fromKeyboard=>{kbOpen.current=!!fromKeyboard;setOpen(v=>!v);};
 return {api,menuName:menu?.name,kbOpen,toggle,data,error,setError,open,setOpen,pending,menuId,eligible,settings,presets,otherMenus,viewing,today:data?.serviceDay?.weekday,btnRef,pick,guard,guardMenuChange,guardState,setGuardState,confirmState,setConfirmState,activate,setEnabled,setAuto,create,rename,remove,leave,markRead,save,discard,busy,notices:(data?.notices||[]).filter(n=>!n.menuId||n.menuId===menuId)};
}

/* ---------- Pulsante «Preset ▾» (M01 per l'etichetta) ---------- */
function MenuDayPresetButton({dp,disabled}){
 const labelRef=useRef(null),prev=useRef(null);
 const label=dp.viewing?dp.viewing.name:'Preset';
 React.useLayoutEffect(()=>{const el=labelRef.current;if(!el)return;if(prev.current!==null&&prev.current!==label&&!MW_DP_RM()){const m=MW_DP_M();el.getAnimations().forEach(a=>a.cancel());el.animate([{opacity:0,filter:`blur(${m.blurPx.textSwap}px)`},{opacity:1,filter:'blur(0px)'}],{duration:m.durationMs.micro,delay:m.recipeDelayMs.textSwap,easing:MW_DP_BEZ(m.easing.out),fill:'backwards'});}prev.current=label;},[label]);
 if(!dp.eligible)return null;
 const on=dp.settings.enabled;
 return <button ref={dp.btnRef} type="button" className={'mw-dp-btn'+(dp.viewing?' is-preset':'')+(on?'':' is-off')} aria-expanded={dp.open} aria-controls="mw-dp-tray" aria-haspopup="true" aria-label={on?`Preset: ${dp.viewing?dp.viewing.name:'Menu attuale'}`:'Preset: non attivi'} disabled={disabled} onClick={e=>dp.toggle(e.detail===0)} onKeyDown={e=>{if(e.key==='ArrowDown'&&!dp.open){e.preventDefault();dp.kbOpen.current=true;dp.setOpen(true);}}}><span ref={labelRef} className="mw-dp-label">{label}</span><svg aria-hidden width="16" height="16" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg></button>;
}

/* ---------- Superficie: vassoio + lista che scende (M06) + altezza della lista animata ---------- */
function MenuDayPresetStage({dp,contentKey,itemCount,children}){
 const stageRef=useRef(null),innerRef=useRef(null),frameRef=useRef(null),lastHeight=useRef(null),settleTimer=useRef(0),wasOpen=useRef(false);
 const [picked,setPicked]=useState(null);
 const open=dp.eligible&&dp.open;
 // Altezza del vassoio misurata dal vivo (testo lungo, resize).
 React.useLayoutEffect(()=>{const inner=innerRef.current,stage=stageRef.current;if(!inner||!stage)return;const measure=()=>stage.style.setProperty('--dp-tray-h',inner.offsetHeight+'px');measure();const ro=new ResizeObserver(measure);ro.observe(inner);return()=>ro.disconnect();},[dp.eligible,dp.settings.enabled,dp.presets.length]);
 // Chiusura: contenuto prima del collasso solo se il vassoio era fermo aperto; se interrompe un'apertura inverte subito dal valore corrente.
 React.useLayoutEffect(()=>{const stage=stageRef.current;if(!stage)return;const wrap=stage.querySelector('.mw-dp-list-wrap');if(open){stage.style.setProperty('--dp-collapse-delay','0ms');wasOpen.current=true;return;}if(!wasOpen.current)return;wasOpen.current=false;const now=new DOMMatrix(getComputedStyle(wrap).transform).f,target=(parseFloat(stage.style.getPropertyValue('--dp-tray-h'))||0)+MW_DP_M().distancePx.panel;stage.style.setProperty('--dp-collapse-delay',Math.abs(now-target)<1?'var(--dp-content-delay)':'0ms');},[open]);
 // Esc / tocco fuori chiudono senza cambiare; il focus torna al pulsante.
 useEffect(()=>{if(!open)return;const out=e=>{if(dp.guardState||dp.confirmState)return;if(stageRef.current?.querySelector('.mw-dp-tray')?.contains(e.target)||dp.btnRef.current?.contains(e.target))return;dp.setOpen(false);};const key=e=>{if(e.key==='Escape'&&!dp.guardState&&!dp.confirmState){e.preventDefault();dp.setOpen(false);dp.btnRef.current?.focus();}};window.document.addEventListener('pointerdown',out);window.addEventListener('keydown',key);return()=>{window.document.removeEventListener('pointerdown',out);window.removeEventListener('keydown',key);};},[open,dp.guardState,dp.confirmState]);
 // Il focus esce dal vassoio con Tab: si chiude.
 const onBlur=e=>{const t=e.relatedTarget;if(open&&t&&!e.currentTarget.contains(t)&&t!==dp.btnRef.current&&!t.closest?.('dialog'))dp.setOpen(false);};
 // Altezza della lista: quando cambia il contenuto (preset, numero di piatti) il contenitore va dalla vecchia alla nuova altezza (surface), il contenuto entra dopo (micro +60).
 React.useLayoutEffect(()=>{const frame=frameRef.current;if(!frame)return;const target=frame.scrollHeight,from=lastHeight.current;lastHeight.current=target;if(from==null||Math.abs(from-target)<1||MW_DP_RM())return;const m=MW_DP_M(),running=frame.getAnimations().find(a=>a.id==='dp-height');const start=running?frame.getBoundingClientRect().height:from;frame.getAnimations().forEach(a=>{if(a.id==='dp-height')a.cancel();});const a=frame.animate([{height:start+'px'},{height:target+'px'}],{duration:m.durationMs.surface,easing:MW_DP_BEZ(m.easing.out)});a.id='dp-height';frame.classList.add('is-sizing');window.clearTimeout(settleTimer.current);a.onfinish=a.oncancel=()=>{if(!frame.getAnimations().some(x=>x.id==='dp-height'&&x.playState==='running'))frame.classList.remove('is-sizing');};},[contentKey,itemCount]);
 React.useLayoutEffect(()=>{const inner=frameRef.current?.firstElementChild;if(!inner||MW_DP_RM())return;const m=MW_DP_M();inner.getAnimations().forEach(a=>{if(a.id==='dp-content')a.cancel();});const a=inner.animate([{opacity:0},{opacity:1}],{duration:m.durationMs.micro,delay:m.recipeDelayMs.contentAfterSurface,easing:MW_DP_BEZ(m.easing.out),fill:'backwards'});a.id='dp-content';},[contentKey]);
 useEffect(()=>{if(!open)setPicked(null);},[open]);
 const style=MW_DP_STYLE();
 return <div ref={stageRef} className={'mw-dp-stage'+(open?' is-open':'')} style={style}>
  {dp.eligible&&<div className="mw-dp-tray" id="mw-dp-tray" role="group" aria-label={`Preset del menu ${dp.settings.enabled?'':'(non attivi)'}`} inert={open?undefined:''} onBlur={onBlur}><div ref={innerRef} className="mw-dp-tray-inner">{dp.settings.enabled?<MenuDayPresetChips dp={dp} picked={picked} onPick={id=>{setPicked(id);dp.pick(id);}}/>:<MenuDayPresetActivate dp={dp}/>}</div></div>}
  <div className="mw-dp-list-wrap">{dp.viewing&&<MenuDayPresetBar dp={dp}/>}{dp.notices.length>0&&!dp.viewing&&<MenuDayPresetNotices dp={dp}/>}<div ref={frameRef} className="mw-dp-list-frame"><div className="mw-dp-list-content" aria-busy={dp.pending==='view'||undefined}>{dp.viewing&&!itemCount&&<p className="mw-dp-empty"><strong>«{dp.viewing.name}» è vuoto</strong>Aggiungi categorie e piatti con «+», oppure crea un preset come copia di un altro giorno.</p>}{children}</div></div></div>
  {dp.guardState&&<MenuDayPresetGuard dp={dp}/>}
  {dp.confirmState&&<MenuDayPresetConfirm dp={dp}/>}
 </div>;
}

/* ---------- Chip dei giorni (M09: roving tabindex, frecce, Invio, Home/End) ---------- */
function MenuDayPresetChips({dp,picked,onPick}){
 const listRef=useRef(null);const [creating,setCreating]=useState(false);
 const cur=dp.viewing?.presetId||'attuale',m=MW_DP_M();
 const chips=[...dp.presets.map(p=>({id:p.id,short:p.weekday?MW_DP_SHORT[p.weekday]:p.name,name:p.name,today:p.weekday&&p.weekday===dp.today,online:dp.settings.onlinePresetId===p.id,empty:!p.itemCount})),{id:'__new',action:true},{id:'attuale',action:true}];
 useEffect(()=>{if(dp.open&&!creating){const el=listRef.current?.querySelector('[aria-current="true"]')||listRef.current?.querySelector('.mw-dp-chip');if(el&&dp.kbOpen.current){dp.kbOpen.current=false;el.focus();}}},[dp.open]);
 const onKey=e=>{const all=[...listRef.current.querySelectorAll('.mw-dp-chip')],i=all.indexOf(window.document.activeElement);if(i<0)return;let j=null;if(e.key==='ArrowRight'||e.key==='ArrowDown')j=(i+1)%all.length;else if(e.key==='ArrowLeft'||e.key==='ArrowUp')j=(i-1+all.length)%all.length;else if(e.key==='Home')j=0;else if(e.key==='End')j=all.length-1;if(j===null)return;e.preventDefault();all.forEach((c,k)=>c.tabIndex=k===j?0:-1);all[j].focus();};
 const tabFor=id=>id===cur?0:-1;
 return <>
  <ul ref={listRef} className="mw-dp-chips" onKeyDown={onKey}>
   {chips.filter(c=>!c.action).map((c,i)=><li key={c.id}><button type="button" className={'mw-dp-chip'+(picked===c.id?' is-picked':'')} style={{'--i':Math.min(i,m.staggerMs.maximumItems-1)}} aria-current={c.id===cur?'true':'false'} tabIndex={tabFor(c.id)} onClick={()=>onPick(c.id)}><span aria-hidden="true">{c.short}</span><span className="mw-sr">{c.name+(c.today?', oggi':'')+(c.online?', online':'')+(c.empty?', vuoto':'')}</span>{(c.today||c.online)&&<span className="mw-dp-chip-tag" aria-hidden="true">{c.today?'oggi':''}{c.today&&c.online?' · ':''}{c.online&&<><span className="mw-dp-dot"/>online</>}</span>}</button></li>)}
   <li className="mw-dp-chip-sep" aria-hidden="true"/>
   <li><button type="button" className="mw-dp-chip mw-dp-chip--action" style={{'--i':m.staggerMs.maximumItems-1}} aria-current="false" tabIndex={-1} aria-expanded={creating} onClick={()=>setCreating(v=>!v)}><span aria-hidden="true">+</span> Nuovo</button></li>
   <li><button type="button" className="mw-dp-chip mw-dp-chip--action" style={{'--i':m.staggerMs.maximumItems-1}} aria-current={cur==='attuale'?'true':'false'} tabIndex={tabFor('attuale')} onClick={()=>onPick('attuale')}>Menu attuale</button></li>
  </ul>
  {creating&&<MenuDayPresetCreate dp={dp} onDone={()=>setCreating(false)}/>}
  <div className="mw-dp-tray-foot"><MenuDayPresetSwitch label="Pubblica in automatico alle 6:00 nel suo giorno" checked={!!dp.settings.autoPublish} onChange={v=>dp.setAuto(v)}/>{dp.error&&<p className="mw-dp-error" role="alert">{dp.error}</p>}</div>
 </>;
}
function MenuDayPresetCreate({dp,onDone}){
 const [name,setName]=useState(''),[source,setSource]=useState('current'),ref=useRef(null);
 useEffect(()=>{ref.current?.focus();},[]);
 const busy=dp.pending==='create';
 return <form className="mw-dp-create" onSubmit={async e=>{e.preventDefault();if(busy||!name.trim())return;const [kind,from]=source.split(':');if(await dp.create(name.trim(),kind,from))onDone();}}>
  <label className="mw-field"><span>Nome del preset</span><input ref={ref} value={name} maxLength={100} placeholder="Es. Venerdì pesce" onChange={e=>setName(e.target.value)}/></label>
  <label className="mw-field"><span>Contenuto</span><select value={source} onChange={e=>setSource(e.target.value)}><option value="current">Copia del menu attuale</option><option value="empty">Vuoto</option>{dp.presets.map(p=><option key={p.id} value={'preset:'+p.id}>Copia di {p.name}</option>)}</select></label>
  <div className="mw-dp-row"><button type="button" className="mw-dp-pill" onClick={onDone}>Annulla</button><button type="submit" className="mw-dp-pill mw-dp-pill--primary" disabled={!name.trim()} aria-busy={busy||undefined}>{busy?<><span className="mw-dp-spin" aria-hidden="true"/>Creo…</>:'Crea preset'}</button></div>
 </form>;
}
/* «Attiva i preset per <Menu>»: stesso vassoio, tre scelte (più «riattiva» se ci sono già). */
function MenuDayPresetActivate({dp}){
 const busy=k=>dp.pending===k;
 const opt=(key,label,sub,onClick)=><button type="button" className="mw-dp-option" aria-busy={busy(key)||undefined} disabled={!!dp.pending} onClick={onClick}><strong>{busy(key)?<><span className="mw-dp-spin mw-dp-spin--dark" aria-hidden="true"/>Attivo…</>:label}</strong><small>{sub}</small></button>;
 return <div className="mw-dp-activate"><p className="mw-dp-activate-title">Attiva i preset per {dp.menuName||'questo menu'}</p><p className="mw-dp-activate-sub">Un menu pronto per ogni giorno, da Lunedì a Domenica. Il menu online non cambia finché non pubblichi.</p>
  <div className="mw-dp-options">
   {dp.presets.length>0&&opt('enabled',`Riattiva i ${dp.presets.length} preset salvati`,'Ritrovi i giorni come li avevi lasciati',()=>dp.setEnabled(true))}
   {dp.presets.length===0&&opt('activate:current','Copia il menu attuale in tutti i giorni','Poi cambi solo quello che varia',()=>dp.activate('current'))}
   {dp.presets.length===0&&opt('activate:empty','Giorni vuoti','Riempi ogni giorno da zero',()=>dp.activate('empty'))}
   {dp.presets.length===0&&dp.otherMenus.map(m=><React.Fragment key={m.id}>{opt('activate:menu'+m.id,`Copia i giorni da ${m.name}`,'Stessi piatti, giorno per giorno',()=>dp.activate('menu',m.id))}</React.Fragment>)}
  </div>{dp.error&&<p className="mw-dp-error" role="alert">{dp.error}</p>}</div>;
}
/* Barra del preset aperto: stato, «Pubblica questo preset adesso», rinomina, elimina. */
function MenuDayPresetBar({dp}){
 const v=dp.viewing,[renaming,setRenaming]=useState(false),[name,setName]=useState(v.name),ref=useRef(null);
 useEffect(()=>{setName(v.name);},[v.name]);useEffect(()=>{if(renaming)ref.current?.select();},[renaming]);
 const live=dp.settings.onlinePresetId===v.presetId;
 return <div className="mw-dp-bar" role="region" aria-label={`Preset ${v.name}`}>
  {renaming?<form className="mw-dp-rename" onSubmit={async e=>{e.preventDefault();if(name.trim()&&await dp.rename(name.trim()))setRenaming(false);}}><input ref={ref} aria-label="Nuovo nome del preset" value={name} maxLength={100} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setRenaming(false);setName(v.name);}}}/><button type="submit" className="mw-dp-pill mw-dp-pill--primary" aria-busy={dp.pending==='rename'||undefined} disabled={!name.trim()}>Salva nome</button><button type="button" className="mw-dp-pill" onClick={()=>{setRenaming(false);setName(v.name);}}>Annulla</button></form>
  :<><p className="mw-dp-bar-title"><strong>{v.name}</strong>{v.weekday===dp.today&&<span className="mw-dp-tag">oggi</span>}{live&&<span className="mw-dp-tag"><span className="mw-dp-dot"/>online</span>}</p>
   <div className="mw-dp-row"><button type="button" className="mw-dp-pill mw-dp-pill--primary" disabled={dp.busy} onClick={()=>dp.onPublish?.()}>{live?'Aggiorna online':'Pubblica questo preset adesso'}</button><button type="button" className="mw-dp-pill" onClick={()=>setRenaming(true)}>Rinomina</button><button type="button" className="mw-dp-pill mw-dp-pill--danger" onClick={dp.remove}>Elimina</button></div></>}
  <p className="mw-dp-bar-hint">{live?'È il menu online: le modifiche salvate arrivano ai clienti dopo «Aggiorna online».':'Le modifiche restano nel preset finché non lo pubblichi.'}</p>
 </div>;
}
function MenuDayPresetNotices({dp}){
 return <div className="mw-dp-notices" role="status" aria-live="polite">{dp.notices.slice(0,3).map(n=><p key={n.id}><span>{n.message}</span><button type="button" className="mw-dp-pill" onClick={()=>dp.markRead(n.id)}>Ok</button></p>)}</div>;
}
/* M08: interruttore; l'area tocco è tutta la riga (≥44px). */
function MenuDayPresetSwitch({label,checked,onChange,disabled}){
 return <button type="button" role="switch" aria-checked={checked} className="mw-dp-switch" disabled={disabled} onClick={()=>onChange(!checked)}><span className="mw-dp-switch-track" aria-hidden="true"><span className="mw-dp-switch-thumb"/></span><span>{label}</span></button>;
}
/* Dialogo M06: superficie poi contenuto; in uscita contenuto poi superficie. Focus al primo comando, Esc = Annulla. */
function MenuDayPresetDialog({title,text,error,children,onCancel,busy}){
 const ref=useRef(null);
 useEffect(()=>{const d=ref.current,previous=window.document.activeElement;d.showModal();d.querySelector('[data-autofocus]')?.focus();if(!MW_DP_RM()){const m=MW_DP_M();d.animate([{opacity:0,transform:`translateY(${m.distancePx.panel}px) scale(${m.scale.enter})`},{opacity:1,transform:'none'}],{duration:m.durationMs.surface,easing:MW_DP_BEZ(m.easing.out)});d.querySelector('.mw-dp-dialog-body').animate([{opacity:0},{opacity:1}],{duration:m.durationMs.micro,delay:m.recipeDelayMs.contentAfterSurface,easing:MW_DP_BEZ(m.easing.out),fill:'backwards'});}return()=>{if(d.open)d.close();if(previous?.isConnected)previous.focus({preventScroll:true});};},[]);
 return ReactDOM.createPortal(<dialog ref={ref} className="mw-dp-dialog" style={MW_DP_STYLE()} aria-labelledby="mw-dp-dlg-title" aria-describedby="mw-dp-dlg-text" aria-busy={busy||undefined} onCancel={e=>{e.preventDefault();if(!busy)onCancel();}}><div className="mw-dp-dialog-body"><h2 id="mw-dp-dlg-title">{title}</h2><p id="mw-dp-dlg-text">{text}</p>{error&&<p className="mw-dp-error" role="alert">{error}</p>}</div><div className="mw-dp-dialog-actions">{children}</div></dialog>,window.document.body);
}
const MW_DP_CLOSE=(then)=>{const d=window.document.querySelector('dialog.mw-dp-dialog');if(!d||MW_DP_RM()){then();return;}const m=MW_DP_M();d.querySelector('.mw-dp-dialog-body').animate([{opacity:1},{opacity:0}],{duration:m.durationMs.micro,easing:MW_DP_BEZ(m.easing.exit),fill:'forwards'});const a=d.animate([{opacity:1,transform:'none'},{opacity:0,transform:`scale(${m.scale.enter})`}],{duration:m.durationMs.exit,delay:m.recipeDelayMs.contentAfterSurface,easing:MW_DP_BEZ(m.easing.exit),fill:'forwards'});a.onfinish=then;};
function MenuDayPresetGuard({dp}){
 const g=dp.guardState,[busy,setBusy]=useState(false),[error,setError]=useState('');
 const proceed=()=>{const a=g.action;dp.setGuardState(null);a();};
 return <MenuDayPresetDialog title={`Salvare le modifiche a «${g.name}»?`} text="Hai modifiche non salvate. Se scarti, torna la versione salvata." error={error} busy={busy} onCancel={()=>MW_DP_CLOSE(()=>dp.setGuardState(null))}>
  <button type="button" className="mw-dp-pill" disabled={busy} onClick={()=>MW_DP_CLOSE(()=>dp.setGuardState(null))}>Annulla</button>
  <button type="button" className="mw-dp-pill" disabled={busy} onClick={()=>{dp.discard();MW_DP_CLOSE(proceed);}}>Scarta</button>
  <button type="button" data-autofocus className="mw-dp-pill mw-dp-pill--primary" aria-busy={busy||undefined} onClick={async()=>{if(busy)return;setBusy(true);setError('');const ok=await dp.save();setBusy(false);if(ok)MW_DP_CLOSE(proceed);else setError('Salvataggio non riuscito: le modifiche sono ancora qui. Riprova.');}}>{busy?<><span className="mw-dp-spin" aria-hidden="true"/>Salvo…</>:'Salva'}</button>
 </MenuDayPresetDialog>;
}
function MenuDayPresetConfirm({dp}){
 const c=dp.confirmState,[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <MenuDayPresetDialog title={c.title} text={c.text} error={error} busy={busy} onCancel={()=>MW_DP_CLOSE(()=>dp.setConfirmState(null))}>
  <button type="button" data-autofocus className="mw-dp-pill" disabled={busy} onClick={()=>MW_DP_CLOSE(()=>dp.setConfirmState(null))}>Annulla</button>
  <button type="button" className={'mw-dp-pill '+(c.danger?'mw-dp-pill--danger-solid':'mw-dp-pill--primary')} aria-busy={busy||undefined} onClick={async()=>{if(busy)return;setBusy(true);setError('');try{await c.onConfirm();MW_DP_CLOSE(()=>dp.setConfirmState(null));}catch(e){setError(e.message||'Operazione non riuscita: riprova.');}finally{setBusy(false);}}}>{busy?<><span className="mw-dp-spin" aria-hidden="true"/>Attendi…</>:c.confirmLabel}</button>
 </MenuDayPresetDialog>;
}
/* Impostazioni menu: modalità menu unico ⇄ settimanale e automatico, senza perdere i preset. */
function MenuDayPresetSettings({dp}){
 if(!dp.eligible)return null;
 const on=dp.settings.enabled;
 return <section className="mw-dp-settings" aria-label="Preset settimanali"><h4>Preset settimanali</h4>
  <MenuDayPresetSwitch label={on?'Preset attivi (menu settimanale)':'Menu unico: preset spenti'} checked={on} disabled={!!dp.pending} onChange={v=>{if(v&&!dp.presets.length){dp.setOpen(true);return;}dp.setEnabled(v);}}/>
  {on&&<MenuDayPresetSwitch label="Pubblica in automatico alle 6:00 nel suo giorno" checked={!!dp.settings.autoPublish} onChange={v=>dp.setAuto(v)}/>}
  <p className="mw-dp-bar-hint">{on?'Spegnendo i preset torni al menu unico: i preset restano salvati e li ritrovi riattivandoli.':dp.presets.length?`${dp.presets.length} preset salvati, pronti da riattivare.`:'Attivali per avere un menu pronto per ogni giorno.'}</p>
 </section>;
}
Object.assign(window,{useMenuDayPresets,MenuDayPresetButton,MenuDayPresetStage,MenuDayPresetSettings});
