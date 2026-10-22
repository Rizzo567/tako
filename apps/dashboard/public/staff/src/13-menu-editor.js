/* Dashboard editor 22/10 (flag per locale `dashboardEditor`): voce Piatti = menu vero modificabile.
   Al centro l'iframe /menu-preview/<menuId>?edit=1 (renderer pubblico + layer di selezione/gesto dell'altro perimetro);
   qui: documento di lavoro + coda op (13-menu-editor-core.js), pannello della matita, «+» a 4 scelte, Pubblica/Scarta,
   notifica WhatsApp, colonna destra = PDF del pubblicato. Con flag spento questo file non disegna nulla.
   Contratto: docs/webapp/dashboard-editor-2026-10-22/CONTRATTO.md (§3 API, §4 messaggi). */

/* ── Adattatore: le API nuove (§3). Errori con lo stato HTTP e il corpo (409 → currentRevision). ── */
const MW_ED_REQUEST=async(path,method='GET',body,signal)=>{
 const response=await fetch('/api/menu-workspace'+path,{method,credentials:'include',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal});
 const result=await response.json().catch(()=>null);
 if(!response.ok){const error=new Error(result?.error?.message||(typeof result?.error==='string'?result.error:'')||'Operazione menu non riuscita');error.status=response.status;error.body=result;throw error;}
 return result;
};
const MW_ED_NORMALIZE=result=>({...result.data,revision:result.revision,publishedRevision:result.publishedRevision,pending:typeof result.pending==='boolean'?result.pending:undefined,capabilities:['owner','menu_editor'].includes(window.__takoRole)?['content','style','pdf']:[]});
if(window.TakoMenuWorkspaceContract)Object.assign(window.TakoMenuWorkspaceContract,{
 applyOps:(ops,meta={})=>MW_ED_REQUEST('/ops','POST',{ops,clientId:meta.clientId,seq:meta.seq}),
 status:()=>MW_ED_REQUEST('/status'),
 discard:async expectedRevision=>{const r=await MW_ED_REQUEST('/discard','POST',{expectedRevision});return r?.data?MW_ED_NORMALIZE(r):window.TakoMenuWorkspaceContract.load();},
 publishStrict:expectedRevision=>MW_ED_REQUEST('/publish','POST',{expectedRevision}),
 renderPublishedPdf:async(menuIds,signal)=>{
  const response=await fetch('/api/menu-workspace/pdf',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({menuIds,preview:false}),signal});
  if(response.ok){const blob=await response.blob();if(blob.size<5)throw new Error('Il server non ha restituito un PDF valido. Riprova.');return blob;}
  if(response.status===404)throw new Error('Questo menu non è ancora pubblicato: premi Pubblica.');
  if(response.status===401)throw new Error('La sessione è scaduta. Accedi di nuovo.');
  let detail={};try{detail=await response.json()}catch{}
  throw new Error(detail.error?.message||'Il PDF non è disponibile al momento. Riprova.');
 }
});
/* Chi può modificare (T9): titolare, manager, editor del menu, agenzia. Il cameriere non entra nella voce Menu. */
const MW_ED_CAN_EDIT=()=>['owner','manager','menu_editor'].includes(window.__takoRole)||window.__takomenuAgency===true;
const MW_ED_UUID=()=>(crypto.randomUUID?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)));
const MW_ED_PILL=(message,opts={})=>window.TakoMenuLive?.toast?.show({message,...opts});
const MW_ED_LABEL={menu:'menu',root:'sottomenu',child:'sezione',item:'piatto'};

function useMenuEditor({adapter,enabled,menuId,setMenuId,trial,onLeft}){
 const [snap,setSnap]=useState(null),[loadError,setLoadError]=useState(''),[selection,setSelection]=useState(null),[editing,setEditing]=useState(false),[flash,setFlash]=useState([]),[panel,setPanel]=useState(null),[review,setReview]=useState(null);
 const qRef=useRef(null),flashTimer=useRef(0),leftRef=useRef(onLeft),busyRef=useRef(false),menuRef=useRef(menuId);leftRef.current=onLeft;menuRef.current=menuId;
 const doFlash=useCallback(ids=>{window.clearTimeout(flashTimer.current);setFlash(ids);flashTimer.current=window.setTimeout(()=>setFlash([]),3100);},[]);
 useEffect(()=>{
  if(!enabled||!adapter?.applyOps||!window.TakoMenuEditorCore||!window.TakoMenuOps)return;
  const C=window.TakoMenuEditorCore;let alive=true;setLoadError('');setSnap(null);
  const q=C.createQueue({send:(ops,meta)=>adapter.applyOps(ops,meta),load:()=>adapter.load(),onChange:s=>{if(alive)setSnap(s);},onEvent:e=>{
   if(e.type==='rejected')MW_ED_PILL('Modifica non applicata: l’elemento è cambiato');
   else if(e.type==='offline')MW_ED_PILL(e.auth?'Sessione scaduta: accedi di nuovo':'Non salvato, riprovo',{duration:600000});
   else if(e.type==='online')MW_ED_PILL('Modifiche salvate');
   else if(e.type==='reloaded'&&e.publishedChanged&&!busyRef.current){const live=window.TakoMenuLive,changed=live?live.changedItems(e.before,e.after):[];const ids=C.changedIds(e.before,e.after);if(ids.length)doFlash(ids);
    // Etichetta fresca dallo stato (la pubblicazione può essere arrivata con l'ack di una op, prima del poller).
    Promise.resolve(adapter.status?adapter.status().then(st=>st?.lastLabel||e.label,()=>e.label):e.label).then(label=>MW_ED_PILL(live?live.message(label,changed):'Menu aggiornato'));}
  }});
  qRef.current=q;
  adapter.load().then(doc=>{if(alive)q.init(doc);}).catch(e=>{if(alive)setLoadError(e.message||'Impossibile caricare il menu');});
  const poller=C.createStatusPoller({status:()=>adapter.status(),paused:()=>busyRef.current,onStatus:st=>q.remote(st)});poller.start();
  const online=()=>q.online();window.addEventListener('online',online);
  const unload=e=>{const s=q.snapshot;if(s.queued>0||s.offline){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',unload);
  return()=>{alive=false;poller.stop();window.removeEventListener('online',online);window.removeEventListener('beforeunload',unload);qRef.current=null;
   // Uscita (Avanzate, altra scheda): le op in coda partono comunque, poi la vecchia schermata rilegge il server.
   q.flush();q.whenIdle().then(()=>{q.destroy();leftRef.current&&leftRef.current();});};
 },[enabled,adapter]);
 const view=snap?.view||null;
 const menus=view?.menus||[];
 const menu=menus.find(m=>m.id===menuId)||null;
 // Menu scelto inesistente (creato da un'altra scheda, eliminato): il primo.
 useEffect(()=>{if(view&&!menu&&menus[0])setMenuId(menus[0].id);},[view,menu]);
 useEffect(()=>{if(!view||!selection)return;if(!window.TakoMenuEditorCore.locate(view,selection.kind,selection.id)){setSelection(null);setPanel(null);}},[view]);
 const push=useCallback(ops=>qRef.current?qRef.current.push(ops):Promise.resolve(false),[]);
 const can=MW_ED_CAN_EDIT();
 const statusText=!snap?'Caricamento…':snap.pending?'Modifiche non pubblicate':'Pubblicato';

 const loadDiff=async()=>{const q=qRef.current;await q.whenIdle();const diff=await adapter.publishDiff();return {diff,revision:q.snapshot.revision};};
 const openPublish=async()=>{if(trial||!qRef.current||busyRef.current)return;busyRef.current=true;setReview({loading:true});try{const r=await loadDiff();setReview(r);}catch(e){setReview({error:e.message||'Impossibile preparare la pubblicazione'});}finally{busyRef.current=false;}};
 const confirmPublish=async()=>{const q=qRef.current;if(!q||busyRef.current)return;busyRef.current=true;setReview(r=>({...r,busy:true,error:''}));
  try{await q.whenIdle();
   // Il riquadro mostrava un'altra revisione (bot, altra scheda): si aggiorna da solo e si riconferma.
   if(review?.revision!==q.snapshot.revision){const r=await loadDiff();setReview({...r,error:'Il menu è cambiato nel frattempo: controlla e conferma di nuovo.'});return;}
   await (adapter.publishStrict||adapter.publish)(q.snapshot.revision);const doc=await adapter.load();q.replace({...doc,pending:false});setReview(null);MW_ED_PILL('Menu pubblicato');}
  catch(e){if(e.status===409){try{await q.reload();const r=await loadDiff();setReview({...r,error:'Il menu è cambiato nel frattempo: controlla e conferma di nuovo.'});}catch(x){setReview(v=>({...v,busy:false,error:x.message}));}}else setReview(v=>({...v,busy:false,error:e.status===423||/prova/i.test(e.message||'')?'Menu di prova privato: la bozza è salvata, la pubblicazione è bloccata.':e.message||'Pubblicazione non riuscita'}));}
  finally{busyRef.current=false;}};
 const discard=async()=>{const q=qRef.current;if(!q||busyRef.current)return;if(!window.confirm('Scartare tutte le modifiche non pubblicate? Il menu torna com’è online.'))return;busyRef.current=true;setReview(r=>({...r,busy:true,error:''}));
  try{await q.whenIdle();const doc=await adapter.discard(q.snapshot.revision);q.replace({...doc,pending:false});setReview(null);setSelection(null);setPanel(null);MW_ED_PILL('Modifiche scartate');}
  catch(e){if(e.status===409){await q.reload().catch(()=>{});try{const r=await loadDiff();setReview({...r,error:'Il menu è cambiato nel frattempo: riprova.'});}catch{setReview(v=>({...v,busy:false}));}}else setReview(v=>({...v,busy:false,error:e.message||'Non riuscito'}));}
  finally{busyRef.current=false;}};

 /* «+» a 4 scelte (D9): genitore preselezionato dalla selezione; id dal client; compare subito, lampeggia, resta selezionato. */
 const sheetDefaults=()=>{const C=window.TakoMenuEditorCore,found=selection&&view?C.locate(view,selection.kind,selection.id):null;
  const sameMenu=found&&found.menu?.id===menuId?found:null;
  const sectionId=sameMenu?.kind==='item'?sameMenu.section.id:sameMenu?.kind==='section'?sameMenu.section.id:(menu?.sections.find(s=>s.active!==false)||menu?.sections[0])?.id||'';
  const rootId=sameMenu?.root?.id||(menu?.sections.find(s=>!s.parentSectionId)?.id)||'';
  const initialKind=sameMenu?.kind==='item'?'item':sameMenu?.kind==='section'?(sameMenu.section.parentSectionId?'item':'section'):'item';
  return {sectionId,rootId,initialKind};};
 const create=async({kind,name,description,price,sectionId,parentId,pricing})=>{
  if(!view||(kind!=='menu'&&!menu))return false;const id=MW_ED_UUID();let op,sel;
  if(kind==='menu'){const fields={name,active:false,type:'main'};if(pricing==='fisso'){const tmp={};window.TakoMenuFixed?.setPricing(tmp,'fisso');Object.assign(fields,tmp);}op={op:'create',kind:'menu',id,fields};sel={kind:'menu',id};}
  else if(kind==='category'){const root=selection&&window.TakoMenuEditorCore.locate(view,selection.kind,selection.id)?.root;const last=root&&menu.sections.filter(s=>s.id===root.id||s.parentSectionId===root.id).at(-1);op={op:'create',kind:'section',id,parentId:menuId,fields:{name,active:false},...(last&&root.id&&menu.sections.some(s=>s.id===root.id)?{at:{afterId:last.id}}:{})};sel={kind:'section',id};}
  else if(kind==='section'){const kids=menu.sections.filter(s=>s.parentSectionId===parentId);const after=(kids.at(-1)||menu.sections.find(s=>s.id===parentId))?.id;op={op:'create',kind:'section',id,parentId:menuId,fields:{name,parentSectionId:parentId},...(after?{at:{afterId:after}}:{})};sel={kind:'section',id};}
  else{const anchor=selection?.kind==='item'&&window.TakoMenuEditorCore.locate(view,'item',selection.id)?.section.id===sectionId?selection.id:null;op={op:'create',kind:'item',id,parentId:sectionId,fields:{name,description:description||null,price:price||0},...(anchor?{at:{afterId:anchor}}:{})};sel={kind:'item',id};}
  const done=push(op);if(kind==='menu')setMenuId(id);setSelection(sel);doFlash([id]);reveal(sel.kind,sel.id);return done;};
 const frameRef=useRef(null);
 const reveal=(kind,id)=>{setSelection({kind,id});window.setTimeout(()=>{try{const el=frameRef.current?.contentDocument?.querySelector(`[data-edit-id="${id}"],[data-item-id="${id}"],#workspace-section-${id}`);el?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}catch{}},120);};
 return {enabled,ready:!!snap,loadError,snap,view,menus,menu,menuId,selection,setSelection,editing,setEditing,flash,panel,setPanel,review,setReview,push,can,trial,statusText,
  openPublish,confirmPublish,discard,create,sheetDefaults,reveal,frameRef,doFlash,
  queue:()=>qRef.current,setMenuIdFromFrame:setMenuId,
  whenIdle:()=>qRef.current?qRef.current.whenIdle():Promise.resolve(),
  mutateOps:fn=>{if(!view)return;const ops=window.TakoMenuEditorCore.mutateToOps(view,fn);if(ops.length)push(ops);}};
}
const MW_ED_NOOP=()=>({enabled:false});

/* ── Centro: iframe a tutta larghezza utile + pannello della matita + riquadro Pubblica ── */
function MenuEditorStage({ed,adapter,mobile}){
 const frame=ed.frameRef,[src]=useState(()=>`/menu-preview/${ed.menuId}?edit=1`),proto=useRef('legacy');
 const edRef=useRef(ed);edRef.current=ed;
 const post=useCallback(()=>{const cur=edRef.current,win=frame.current?.contentWindow;if(!win||!cur.view)return;
  if(proto.current==='edit')win.postMessage({type:'tako-menu-edit-state',v:1,document:cur.view,menuId:cur.menuId,selection:cur.selection,flash:cur.flash,disabled:!cur.can,editing:cur.editing},location.origin);
  else win.postMessage({type:'tako-menu-preview',document:cur.view,menuId:cur.menuId},location.origin);},[]);
 useEffect(()=>{post();},[ed.view,ed.menuId,ed.selection,ed.flash,ed.editing,ed.can]);
 useEffect(()=>{const onMessage=e=>{if(e.origin!==location.origin||e.source!==frame.current?.contentWindow||!e.data||typeof e.data.type!=='string')return;const d=e.data,cur=edRef.current,q=cur.queue();
  switch(d.type){
   case 'tako-menu-preview-ready':post();break;
   case 'tako-menu-edit-ready':proto.current='edit';post();break;
   case 'tako-menu-edit-select':cur.setSelection(d.kind?{kind:d.kind,id:d.id}:null);if(!d.kind||cur.panel?.id!==d.id)cur.setPanel(null);break;
   case 'tako-menu-edit-open':if(!cur.can)break;cur.setSelection({kind:d.kind,id:d.id});cur.setPanel({kind:d.kind,id:d.id});break;
   case 'tako-menu-edit-ops':if(!q||!cur.can||!Array.isArray(d.ops))break;if(d.provisional)q.provisional(d.ops);else{q.promote();q.push(d.ops);}break;
   case 'tako-menu-edit-mode':cur.setEditing(!!d.editing);if(!d.editing&&q)q.dropProvisional();break;
   case 'tako-menu-edit-menu':if(typeof d.menuId==='string')cur.setMenuIdFromFrame?.(d.menuId);break;
   case 'tako-menu-edit-error':console.warn('Menu modificabile:',d.code);break;
  }};window.addEventListener('message',onMessage);return()=>window.removeEventListener('message',onMessage);},[]);
 if(ed.loadError)return <Card><p role="alert">{ed.loadError}</p><Btn onClick={()=>ed.queue()?.reload()}>Riprova</Btn></Card>;
 return <section className={'mw-ed-stage'+(mobile?' is-mobile':'')} aria-label="Menu modificabile">
  {!ed.ready&&<TakoLoading label="Caricamento menu…" variant="page"/>}
  <iframe ref={frame} className="mw-ed-frame" title="Menu modificabile" src={src} onLoad={post} style={{visibility:ed.ready?'visible':'hidden'}}/>
  {ed.panel&&ed.view&&<MenuEditorPanel ed={ed} adapter={adapter} mobile={mobile}/>}
  {ed.review&&<MenuEditorPublishDialog ed={ed}/>}
 </section>;
}

/* Pannello della matita: pop-over ancorato su desktop, foglio dal basso su telefono (D8). Mai nella colonna destra. */
function MenuEditorPanel({ed,adapter,mobile}){
 const C=window.TakoMenuEditorCore,found=C.locate(ed.view,ed.panel.kind,ed.panel.id);
 const narrow=MW_USE_MEDIA('(max-width:899px)'),sheet=mobile||narrow;
 const close=()=>ed.setPanel(null);
 const [job,setJob]=useState(null),ctl=useRef(null),fileInput=useRef(null);
 useEffect(()=>()=>ctl.current?.abort(),[]);
 if(!found)return null;
 const level=found.kind==='menu'?'menu':found.kind==='item'?'item':found.section.parentSectionId?'child':'root';
 const title='Modifica '+MW_ED_LABEL[level];
 const commit=fields=>ed.push({op:'set',kind:found.kind,id:ed.panel.id,fields});
 const remove=()=>{const name=(found.item||found.section||found.menu).name;if(!window.confirm(`Eliminare ${level==='item'?'il piatto':level==='menu'?'il menu':level==='root'?'il sottomenu e i suoi piatti':'la sezione e i suoi piatti'} «${name}»?`))return;ed.push({op:'remove',kind:found.kind,id:ed.panel.id});ed.setSelection(null);close();};
 const upload=async file=>{if(!file)return;const tools=window.TakoMenuImageTools;if(!tools){toast('Caricamento foto non disponibile',{type:'error'});return;}
  if(!MW_PHOTO_TYPES.includes(file.type)){toast('Formato non supportato: usa una foto JPG, PNG o WebP.',{type:'error'});return;}
  ctl.current?.abort();const c=ctl.current=new AbortController(),preview=URL.createObjectURL(file),id=ed.panel.id;setJob({percent:0,preview});
  try{const asset=await tools.quickUpload(file,{adapter,signal:c.signal,onProgress:p=>{if(!c.signal.aborted&&p.percent!=null)setJob(j=>j&&{...j,percent:p.percent});}});if(c.signal.aborted)return;ed.push({op:'set',kind:'item',id,fields:{imageUrl:asset.url}});}
  catch(e){if(e.name!=='AbortError')toast(e.message||'Caricamento non riuscito. Riprova.',{type:'error'});}
  finally{setJob(null);setTimeout(()=>URL.revokeObjectURL(preview),400);}};
 const body=level==='item'?<MenuWorkspaceItemForm key={ed.panel.id} adapter={adapter} item={found.item} fixed={found.menu.pricing==='fisso'} disabled={!ed.can} onCommit={commit} onDelete={remove}
   photo={{job,onPick:()=>fileInput.current?.click(),onDropFile:upload,onCancel:()=>{ctl.current?.abort();setJob(null);}}}/>
  :<MenuEditorLevelForm key={ed.panel.id} kind={level} label={MW_ED_LABEL[level]} entity={found.kind==='menu'?found.menu:found.section} menu={found.menu} disabled={!ed.can} onCommit={commit} onDelete={remove} onFixedMutate={ed.mutateOps}/>;
 const content=<>{body}<input ref={fileInput} type="file" accept={MW_PHOTO_TYPES.join(',')} hidden tabIndex={-1} aria-hidden="true" onChange={e=>{const f=e.target.files?.[0];e.target.value='';upload(f);}}/></>;
 if(sheet)return <MenuWorkspaceDrawer title={title} onClose={close}>{content}</MenuWorkspaceDrawer>;
 return <MenuEditorPopover title={title} anchorId={ed.panel.id} frame={ed.frameRef} onClose={close}>{content}</MenuEditorPopover>;
}
function MenuEditorPopover({title,anchorId,frame,onClose,children}){
 const ref=useRef(null),[pos,setPos]=useState(null),closeRef=useRef(onClose);closeRef.current=onClose;
 const place=useCallback(()=>{const f=frame.current;if(!f)return;const fr=f.getBoundingClientRect();let r=null;
  try{const el=f.contentDocument?.querySelector(`[data-edit-id="${anchorId}"],[data-item-id="${anchorId}"],#workspace-section-${anchorId}`);if(el){const x=el.getBoundingClientRect();r={left:fr.left+x.left,right:fr.left+x.right,top:fr.top+x.top,bottom:fr.top+x.bottom};}}catch{}
  r=r||{left:fr.right-24,right:fr.right-24,top:fr.top+16,bottom:fr.top+16};
  const w=380,gap=12,vw=window.innerWidth,vh=window.innerHeight;
  let left=r.right+gap+w<=vw-16?r.right+gap:Math.max(16,Math.min(vw-w-16,r.left-gap-w>=16?r.left-gap-w:fr.right-w-16));
  const top=Math.max(16,Math.min(r.top,vh-320));setPos({left,top,maxHeight:vh-top-16});},[anchorId]);
 React.useLayoutEffect(()=>{place();const on=()=>place();window.addEventListener('resize',on);let doc=null;try{doc=frame.current?.contentWindow;doc?.addEventListener('scroll',on,true);}catch{}return()=>{window.removeEventListener('resize',on);try{doc?.removeEventListener('scroll',on,true);}catch{}};},[place]);
 useEffect(()=>{const el=ref.current;if(!el)return;const previous=window.document.activeElement;el.querySelector('h3')?.focus({preventScroll:true});
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){el.animate([{opacity:0,transform:'scale(.96)'},{opacity:1,transform:'scale(1)'}],{duration:MW_MS('surface',340),easing:MW_EASE('out')});}
  const key=e=>{if(e.key==='Escape'){e.preventDefault();closeRef.current();}};const outside=e=>{if(el&&!el.contains(e.target)&&!e.target.closest?.('dialog,.mw-live-toast-host'))closeRef.current();};
  window.addEventListener('keydown',key);window.document.addEventListener('pointerdown',outside);
  return()=>{window.removeEventListener('keydown',key);window.document.removeEventListener('pointerdown',outside);if(previous?.isConnected)previous.focus({preventScroll:true});};},[]);
 return ReactDOM.createPortal(<section ref={ref} role="dialog" aria-label={title} className="mw-ed-popover" style={pos?{left:pos.left,top:pos.top,maxHeight:pos.maxHeight}:{visibility:'hidden'}}>
  <div className="mw-drawer-heading"><h3 tabIndex={-1}>{title}</h3><button type="button" className="mw-sheet-close" aria-label={'Chiudi '+title.toLowerCase()} onClick={onClose}><svg aria-hidden width="16" height="16" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button></div>
  <div className="mw-drawer-content">{children}</div></section>,window.document.body);
}
/* Pubblica (D6): elenco differenze esistente, «Pubblica ora», link «Scarta le modifiche». */
function MenuEditorPublishDialog({ed}){
 const ref=useRef(null),r=ed.review;
 useEffect(()=>{const d=ref.current,previous=window.document.activeElement;d?.showModal();return()=>{d?.close();if(previous?.isConnected)previous.focus();};},[]);
 const close=()=>{if(!r.busy)ed.setReview(null);};
 const tokens=window.TakoMenuMotion,style={'--mw-motion-duration':`${tokens?.durationMs?.surface||340}ms`,'--mw-motion-ease':`cubic-bezier(${(tokens?.easing?.out||[.22,1,.36,1]).join(',')})`};
 const empty=r.diff&&!r.diff.details?.length&&!r.diff.added?.length&&!r.diff.removed?.length&&!r.diff.changed?.length;
 return ReactDOM.createPortal(<dialog ref={ref} className="mw-publish-dialog mw-ed-publish" style={style} aria-labelledby="mw-ed-publish-title" aria-busy={!!r.busy||!!r.loading} onCancel={e=>{e.preventDefault();close();}}>
  <h3 id="mw-ed-publish-title">Pubblicare le modifiche?</h3>
  <p>Il menu digitale dei clienti e il PDF verranno aggiornati.</p>
  {r.loading&&<TakoLoading label="Preparo l’elenco delle modifiche…" variant="page"/>}
  {r.diff&&(empty?<p>Nessuna modifica da pubblicare.</p>:<div className="mw-ed-diff"><MenuWorkspaceDiff diff={r.diff} publication/></div>)}
  {r.error&&<p className="mw-publish-error" role="alert">{r.error}</p>}
  <div className="mw-publish-actions"><button type="button" className="mw-ed-link" disabled={r.busy||r.loading||empty} onClick={ed.discard}>Scarta le modifiche</button><span className="mw-dp-spacer"/><Btn kind="soft" disabled={r.busy} onClick={close}>Annulla</Btn><Btn disabled={r.busy||r.loading||!r.diff||empty} onClick={ed.confirmPublish}>{r.busy?'Pubblicazione…':'Pubblica ora'}</Btn></div>
 </dialog>,window.document.body);
}

/* ── Colonna destra = solo PDF del pubblicato (D12/T8) ── */
function MenuEditorPdfColumn({adapter,ed}){
 const [st,setSt]=useState({status:'idle'}),feed=useRef(null);
 useEffect(()=>{feed.current=window.TakoMenuEditorCore.createPdfFeed({render:(w,signal)=>adapter.renderPublishedPdf(w.menuIds,signal),onChange:setSt});return()=>feed.current.destroy();},[adapter]);
 const rev=ed.snap?.publishedRevision;
 useEffect(()=>{if(!ed.snap)return;feed.current?.update({revision:rev||null,menuIds:ed.menuId?[ed.menuId]:[]});},[rev,ed.menuId,!!ed.snap]);
 const Viewer=window.MenuWorkspacePdfViewer;
 return <div className="mw-ed-pdf" aria-label="PDF del menu pubblicato">
  <div className="mw-row mw-ed-pdf-head"><strong>PDF pubblicato</strong>{st.status==='loading'&&st.blob&&<small className="mw-ed-pdf-updating" role="status">Aggiornamento…</small>}</div>
  {st.status==='empty'?<p className="mw-ed-pdf-note">Il menu non è ancora pubblicato: il PDF comparirà dopo «Pubblica».</p>
   :st.status==='error'?<div className="mw-pdf-retry"><p role="alert">{st.error}</p><Btn kind="soft" size="sm" onClick={()=>feed.current?.retry()}>Riprova</Btn></div>
   :st.blob&&Viewer?<Viewer blob={st.blob}/>:<TakoLoading variant="page" label="Preparazione PDF…"/>}
 </div>;
}
Object.assign(window,{useMenuEditor,MenuEditorStage,MenuEditorPdfColumn,MenuEditorPublishDialog,MW_ED_NOOP});
