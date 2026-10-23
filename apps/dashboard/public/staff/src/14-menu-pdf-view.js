/* 23/10: Menu → Piatti, selettore «Telefono / PDF» + «Stampa».
   Telefono = editor del menu digitale. PDF = il PDF PUBBLICATO del Menu scelto in «Menu ▾» (è quello che si stampa),
   non modificabile. Con modifiche non pubblicate: riga sottile + al tocco di Stampa la scelta «Pubblica e stampa» / «Stampa com'è» / «Annulla».
   Movimento: pillola che scivola (MW_USE_THUMB, token standard), Stampa in dissolvenza (fast/exit), contenuto in dissolvenza incrociata (MW_PANEL_*). */
const MW_PV_TOUCH=()=>window.matchMedia('(pointer:coarse)').matches;
const MW_PV_FILE=name=>String(name||'menu').normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase().slice(0,60)+'.pdf';
let MW_PV_FRAME=null;
/* Stampa un PDF già pronto. Sincrono rispetto al tocco: su iPhone/iPad il foglio di condivisione (da lì AirPrint) richiede il gesto. */
function MW_PRINT_PDF(blob,name){
 if(MW_PV_TOUCH()){
  try{const file=new File([blob],MW_PV_FILE(name),{type:'application/pdf'});if(navigator.canShare?.({files:[file]})){navigator.share({files:[file],title:name||'Menu'}).catch(()=>{});return 'share';}}catch{}
  const url=URL.createObjectURL(blob),w=window.open(url,'_blank');setTimeout(()=>URL.revokeObjectURL(url),120000);return w?'tab':'blocked';
 }
 if(MW_PV_FRAME){MW_PV_FRAME.remove();URL.revokeObjectURL(MW_PV_FRAME.dataset.url);MW_PV_FRAME=null;}
 const url=URL.createObjectURL(blob),frame=window.document.createElement('iframe');
 frame.className='mw-print-frame';frame.title='Stampa menu';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.dataset.url=url;
 Object.assign(frame.style,{position:'fixed',right:'0',bottom:'0',width:'1px',height:'1px',border:'0',opacity:'0',pointerEvents:'none'});
 const fallback=()=>{const w=window.open(url,'_blank');if(!w)toast('Il browser ha bloccato la stampa: consenti i popup e riprova.',{type:'warn'});};
 frame.onload=()=>setTimeout(()=>{try{const win=frame.contentWindow;if(!win)throw new Error('frame');win.focus();win.print();}catch{fallback();}},60);
 frame.src=url;window.document.body.appendChild(frame);MW_PV_FRAME=frame;return 'print';
}
const MW_PV_NOOP=()=>({st:{status:'idle'},retry:()=>{},print:()=>{},dialog:null,ready:false});
/* Stato del PDF pubblicato (cache per revisione+menu, richiesta precedente annullata) e flusso di stampa. */
function useMenuPdfView({adapter,active,menuId,revision,pending,publish,reviewOpen,menuName}){
 const [st,setSt]=useState({status:'idle',blob:null,error:'',key:'',blobKey:''}),feed=useRef(null);
 const [ask,setAsk]=useState(''),after=useRef(null),stRef=useRef(st);stRef.current=st;
 const render=useCallback((w,signal)=>adapter?.renderPublishedPdf?adapter.renderPublishedPdf(w.menuIds,signal):window.MW_RENDER_PDF_PUBLISHED(w.menuIds),[adapter]);
 useEffect(()=>{const core=window.TakoMenuEditorCore;if(!core?.createPdfFeed)return;feed.current=core.createPdfFeed({render:(w,signal)=>render(w,signal),onChange:s=>setSt(prev=>({...s,blobKey:s.status==='ready'?s.key:(s.blob===prev.blob?prev.blobKey:'')}))});return()=>{feed.current?.destroy();feed.current=null;};},[render]);
 /* Contenitore prima del contenuto: al passaggio su PDF la richiesta parte a pillola ferma (standard), così il thread resta libero mentre scivola. */
 const wasActive=useRef(false);
 useEffect(()=>{if(!active||revision===undefined||!feed.current){wasActive.current=active;return;}const go=()=>feed.current?.update({revision:revision??null,menuIds:menuId?[menuId]:[]});
  if(wasActive.current||MW_REDUCED()){go();return;}wasActive.current=true;const t=setTimeout(go,MW_MS('standard',280));return()=>{clearTimeout(t);wasActive.current=false;};},[active,revision,menuId]);
 const key=revision!=null&&menuId?revision+'|'+menuId:'';
 const ready=st.status==='ready'&&!!st.blob&&st.blobKey===key;
 const doPrint=()=>{const s=stRef.current;if(!s.blob)return;MW_PRINT_PDF(s.blob,menuName);};
 /* «Pubblica e stampa»: si ricorda la revisione di partenza; se il riquadro di pubblicazione si chiude senza nuova revisione, si annulla. */
 useEffect(()=>{const a=after.current;if(!a)return;if(Date.now()-a.at>180000){after.current=null;return;}
  if(revision!=null&&revision!==a.rev){if(ready&&st.blobKey===key){after.current=null;if(MW_PV_TOUCH())setAsk('ready');else doPrint();}return;}
  if(reviewOpen)a.seen=true;else if(a.seen)after.current=null;},[revision,reviewOpen,ready,st.blobKey,key]);
 const print=()=>{if(!ready)return;if(pending){setAsk('pending');return;}doPrint();};
 const close=()=>setAsk('');
 const dialog=ask?<MenuPdfPrintDialog kind={ask} onClose={close}
  onPrintAsIs={()=>{close();doPrint();}}
  onPublishPrint={()=>{close();after.current={rev:revision,at:Date.now(),seen:false};publish?.();}}
  onPrintReady={()=>{close();doPrint();}}/>:null;
 return {st,ready,retry:()=>feed.current?.retry(),print,dialog};
}
/* Fallback senza adattatore editor: PDF del pubblicato (preview:false). */
window.MW_RENDER_PDF_PUBLISHED=menuIds=>window.TakoMenuWorkspaceContract?.renderPdf?window.TakoMenuWorkspaceContract.renderPdf({menuIds,preview:false}):Promise.reject(new Error('PDF non disponibile'));
function MenuPdfPrintDialog({kind,onClose,onPrintAsIs,onPublishPrint,onPrintReady}){
 const ref=useRef(null),closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{const d=ref.current,prev=window.document.activeElement;d?.showModal();if(d&&!MW_REDUCED())d.animate([{opacity:0,transform:'translateY(8px) scale(.98)'},{opacity:1,transform:'none'}],{duration:MW_MS('surface',340),easing:MW_EASE('out')});return()=>{d?.close();if(prev?.isConnected)prev.focus({preventScroll:true});};},[]);
 return ReactDOM.createPortal(<dialog ref={ref} className="mw-publish-dialog mw-print-dialog" aria-labelledby="mw-print-title" aria-describedby="mw-print-text" onCancel={e=>{e.preventDefault();closeRef.current();}} onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeRef.current();}}>
  {kind==='ready'?<><h3 id="mw-print-title">PDF aggiornato pronto</h3><p id="mw-print-text">Il menu è pubblicato. Tocca Stampa per aprire la stampa.</p><div className="mw-publish-actions"><Btn kind="soft" onClick={onClose}>Chiudi</Btn><Btn onClick={onPrintReady}>Stampa</Btn></div></>
  :<><h3 id="mw-print-title">Ci sono modifiche non pubblicate</h3><p id="mw-print-text">Il PDF stampato mostra il menu online. Vuoi pubblicare prima le modifiche?</p><div className="mw-publish-actions mw-print-actions"><Btn kind="soft" onClick={onClose}>Annulla</Btn><Btn kind="soft" onClick={onPrintAsIs}>Stampa com’è</Btn><Btn onClick={onPublishPrint}>Pubblica e stampa</Btn></div></>}
 </dialog>,window.document.body);
}
const MW_PV_ICON={phone:<svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>,
 pdf:<svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"/><path d="M14 2.5V8h5.5M8.5 13h7M8.5 17h5"/></svg>,
 print:<svg aria-hidden width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 9V3h11v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6.5 14h11v7h-11z"/></svg>};
/* Pillola Telefono/PDF: thumb nero condiviso che scivola (transform, riparte dal valore corrente sui tocchi rapidi). */
function MenuViewSwitch({value,onChange,disabled,onPrint,printReady}){
 const nav=useRef(null),thumb=useRef(null),on=value==='pdf';
 MW_USE_THUMB(nav,thumb,value,true);
 const style={'--mw-vs-ms':MW_MS('standard',280)+'ms','--mw-vs-fast':MW_MS('fast',180)+'ms','--mw-vs-exit':MW_MS('exit',220)+'ms','--mw-vs-ease':MW_EASE('out'),'--mw-vs-exit-ease':MW_EASE('exit')};
 return <div className="mw-view-tools" style={style}>
  <div ref={nav} className="mw-view-switch" role="group" aria-label="Vista del menu"><span ref={thumb} className="mw-tab-thumb" aria-hidden="true"/>
   {[['phone','Telefono'],['pdf','PDF']].map(([id,label])=><button key={id} type="button" className={'press'+(value===id?' active':'')} aria-pressed={value===id} aria-label={label} disabled={disabled} onClick={()=>onChange(id)}>{MW_PV_ICON[id]}<span className="mw-view-label">{label}</span></button>)}
  </div>
  <button type="button" className={'press mw-print-btn'+(on?' is-on':'')} aria-hidden={on?undefined:'true'} tabIndex={on?0:-1} inert={on?undefined:''} disabled={on&&!printReady} aria-label="Stampa il PDF del menu" title="Stampa" onClick={onPrint}>{MW_PV_ICON.print}<span className="mw-print-label">Stampa</span></button>
 </div>;
}
function MenuWorkspacePdfView({st,ready,pending,onRetry,menuName}){
 const Viewer=window.MenuWorkspacePdfViewer;
 return <section className="mw-pdf-view" aria-label={'PDF del menu '+(menuName||'')}>
  {pending&&<p className="mw-pdf-view-note" role="note">Ci sono modifiche non pubblicate: il PDF mostra il menu online.</p>}
  {st.status==='empty'?<p className="mw-pdf-view-empty">Il menu non è ancora pubblicato: il PDF comparirà dopo «Pubblica».</p>
   :st.status==='error'?<div className="mw-pdf-retry"><p role="alert">{st.error}</p><Btn kind="soft" size="sm" onClick={onRetry}>Riprova</Btn></div>
   :ready&&Viewer?<div className="mw-pdf-view-doc"><Viewer key={st.blobKey} blob={st.blob}/></div>
   :<div className="mw-pdf-view-loading"><TakoLoading variant="page" label="Preparazione PDF…"/></div>}
 </section>;
}
Object.assign(window,{useMenuPdfView,MenuViewSwitch,MenuWorkspacePdfView,MW_PV_NOOP,MW_PRINT_PDF});
