/* PDF multipli del locale con «link fisso» (21/10/2026, CONTRATTO docs/webapp/menu-prezzo-fisso-2026-10-21 §7).
   API (owner/manager/menu_editor): GET/PUT /api/menu-workspace/pdf-documents, POST|DELETE …/:id/link, GET …/:id/pdf.
   In cima resta sempre il «PDF predefinito» (calcolato dal server, non salvato): «Modifica» apre le sue impostazioni nella scheda PDF.
   Una sola notifica per volta, dentro il riquadro (niente toast impilati).
   Dopo ogni scrittura si rilegge la lista: la UI mostra solo lo stato reale del server (niente successo ottimistico). */

const MW_PDFDOC_MAX=12;
const MW_PDFDOC_REQ=async(path='',method='GET',body)=>{
 const r=await fetch('/api/menu-workspace/pdf-documents'+path,{method,credentials:'include',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!r.ok){let d=null;try{d=await r.json();}catch{}const e=new Error(d?.error?.message||(r.status===403?'Non hai il permesso di modificare i PDF.':r.status===401?'La sessione è scaduta: accedi di nuovo.':'Operazione PDF non riuscita. Riprova.'));e.status=r.status;throw e;}
 return r;
};
const MW_PDFDOC_DATA=async r=>{const j=await r.json().catch(()=>null);return j&&typeof j==='object'&&'data' in j?j.data:j;};
window.TakoPdfDocumentsApi={
 list:async()=>{const d=await MW_PDFDOC_DATA(await MW_PDFDOC_REQ())||{};return {documents:Array.isArray(d.documents)?d.documents:[],default:d.default||null};},
 /** PUT dell'elenco completo: i documenti nuovi vanno senza id (lo assegna il server), i token restano per id. */
 save:async documents=>MW_PDFDOC_DATA(await MW_PDFDOC_REQ('','PUT',{documents:documents.map(d=>({...(d.id?{id:d.id}:{}),name:String(d.name).trim().slice(0,80),menuIds:[...d.menuIds],...(d.config?{config:d.config}:{})}))})),
 createLink:async id=>MW_PDFDOC_DATA(await MW_PDFDOC_REQ('/'+encodeURIComponent(id)+'/link','POST')),
 revokeLink:async id=>MW_PDFDOC_DATA(await MW_PDFDOC_REQ('/'+encodeURIComponent(id)+'/link','DELETE')),
 download:async id=>{const r=await MW_PDFDOC_REQ('/'+encodeURIComponent(id)+'/pdf');const blob=await r.blob();if(blob.size<5)throw new Error('Il server non ha restituito un PDF valido. Riprova.');return blob;},
 publicUrl:token=>location.origin+'/api/public/menu-pdf/'+encodeURIComponent(token)
};
const MW_PDFDOC_FILE=name=>(String(name||'menu').toLocaleLowerCase('it').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'menu')+'.pdf';

/* Editor di un documento: nome, Menu inclusi (ordine = ordine nel PDF), grafica del locale o propria (stessi controlli del PDF). */
function MenuPdfDocumentEditor({draft,setDraft,menus,adapter,basePdf,busy,error,isNew,onSave,onCancel,onDelete}){
 const [group,setGroup]=useState('format'),[confirmDelete,setConfirmDelete]=useState(false),nameRef=useRef(null);
 useEffect(()=>{nameRef.current?.focus();},[]);
 const included=draft.menuIds.map(id=>menus.find(m=>m.id===id)).filter(Boolean),others=menus.filter(m=>!draft.menuIds.includes(m.id));
 const move=(id,delta)=>setDraft(d=>{const a=[...d.menuIds],i=a.indexOf(id),j=i+delta;if(i<0||j<0||j>=a.length)return d;[a[i],a[j]]=[a[j],a[i]];return {...d,menuIds:a};});
 const groups=(typeof MW_PDF_GROUPS!=='undefined'?MW_PDF_GROUPS:[]).filter(g=>g[0]!=='translation');
 const sel=groups.find(g=>g[0]===group)||groups[0];
 const fields=sel?(adapter?.pdfFields||[]).filter(f=>sel[2].includes(f.key)):[];
 const valid=!!draft.name.trim()&&draft.menuIds.length>0;
 return <form className="mw-pdfdoc-editor" aria-label={isNew?'Nuovo PDF':'Modifica '+draft.name} onSubmit={e=>{e.preventDefault();if(valid&&!busy)onSave();}}>
  <label className="mw-field"><span>Nome</span><input ref={nameRef} maxLength={80} required value={draft.name} placeholder="Es. Pranzo del giorno" onChange={e=>{const v=e.target.value;setDraft(d=>({...d,name:v}));}}/></label>
  <fieldset className="mw-pdfdoc-menus"><legend>Menu inclusi · nell’ordine del PDF</legend>
   <ol>{included.map((m,i)=><li key={m.id} className="mw-pdfdoc-menu is-on"><label className="mw-check"><input type="checkbox" checked onChange={()=>setDraft(d=>({...d,menuIds:d.menuIds.filter(x=>x!==m.id)}))}/>{m.name}</label><span className="mw-pdfdoc-order"><button type="button" className="mw-icon-pill" aria-label={'Sposta su '+m.name} disabled={i===0} onClick={()=>move(m.id,-1)}>↑</button><button type="button" className="mw-icon-pill" aria-label={'Sposta giù '+m.name} disabled={i===included.length-1} onClick={()=>move(m.id,1)}>↓</button></span></li>)}
   {others.map(m=><li key={m.id} className="mw-pdfdoc-menu"><label className="mw-check"><input type="checkbox" checked={false} onChange={()=>setDraft(d=>({...d,menuIds:[...d.menuIds,m.id]}))}/>{m.name}{m.active===false&&<small> · nascosto</small>}</label></li>)}</ol>
   {!draft.menuIds.length&&<p className="mw-pdfdoc-hint" role="status">Scegli almeno un menu.</p>}
  </fieldset>
  <fieldset className="mw-pdfdoc-look"><legend>Grafica</legend>
   <div className="mw-pricing-choice" role="radiogroup" aria-label="Grafica del PDF">{[['base','Come il PDF del locale'],['own','Grafica propria']].map(([id,label])=>{const on=id==='own'?!!draft.config:!draft.config;return <button key={id} type="button" role="radio" aria-checked={on} className="mw-pill" onClick={()=>setDraft(d=>({...d,config:id==='own'?(d.config||JSON.parse(JSON.stringify(basePdf||{}))):null}))}>{label}</button>;})}</div>
   {draft.config&&<div className="mw-pdfdoc-config"><nav className="mw-pdfdoc-groups" aria-label="Grafica del documento">{groups.map(([id,label])=><button key={id} type="button" className="mw-chip" aria-pressed={group===id} onClick={()=>setGroup(id)}>{label}</button>)}</nav><MenuWorkspaceSchema fields={fields} value={{...(basePdf||{}),...draft.config}} onChange={v=>setDraft(d=>({...d,config:v}))}/></div>}
  </fieldset>
  {error&&<p role="alert" className="mw-pdfdoc-error">{error}</p>}
  {confirmDelete?<div className="mw-pdfdoc-confirm" role="alertdialog" aria-label="Conferma eliminazione"><p>Eliminare «{draft.name}»? Il suo link fisso smette di funzionare.</p><div className="mw-actions"><button type="button" className="mw-pill mw-pill-dark" disabled={busy} onClick={onDelete}>Elimina</button><button type="button" className="mw-pill" autoFocus onClick={()=>setConfirmDelete(false)}>Annulla</button></div></div>
  :<div className="mw-actions"><button type="submit" className="mw-pill mw-pill-dark" disabled={!valid||busy}>{busy?'Salvataggio…':'Salva'}</button><button type="button" className="mw-pill" onClick={onCancel}>Annulla</button>{!isNew&&<button type="button" className="mw-pill mw-pdfdoc-delete" onClick={()=>setConfirmDelete(true)}>Elimina</button>}</div>}
 </form>;
}

/* Link fisso: crea/copia, rigenera, revoca. Rigenera e revoca chiedono conferma (il vecchio link smette di funzionare). */
function MenuPdfDocumentLink({doc,api,busy,run,notice}){
 const [confirm,setConfirm]=useState(''),[copied,setCopied]=useState(false),input=useRef(null),box=useRef(null),first=useRef(true);
 // Dopo crea/rigenera/revoca il pulsante premuto sparisce: il focus va al comando principale del riquadro (Copia o Crea link fisso).
 useEffect(()=>{setCopied(false);setConfirm('');if(first.current){first.current=false;return;}setTimeout(()=>{const a=window.document.activeElement;if(!a||a===window.document.body||!a.isConnected||box.current?.contains(a))box.current?.querySelector('.mw-pill-dark')?.focus();},0);},[doc.shareToken]);
 useEffect(()=>{if(!confirm)return;return()=>setTimeout(()=>{const a=window.document.activeElement;if(!a||a===window.document.body)box.current?.querySelector('.mw-actions .mw-pill, .mw-pill-dark')?.focus();},0);},[confirm]);
 // Indirizzo pubblico dal server (WEB_ORIGIN); se manca, stessa origine della dashboard.
 const url=doc.shareToken?(doc.shareUrl||api.publicUrl(doc.shareToken)):'';
 const copy=async()=>{try{await navigator.clipboard.writeText(url);setCopied(true);}catch{input.current?.select();setCopied(false);toast('Seleziona il link e copialo',{type:'info'});}};
 return <div ref={box} className="mw-pdfdoc-link" onKeyDown={e=>{if(e.key==='Escape'&&confirm){e.preventDefault();e.stopPropagation();setConfirm('');}}}>
  <p className="mw-pdfdoc-hint">Il link fisso apre sempre la versione aggiornata del menu pubblicato.</p>
  {!url?<><div className="mw-actions"><button type="button" className="mw-pill mw-pill-dark" disabled={busy} onClick={()=>run(()=>api.createLink(doc.id),'')}>Crea link fisso</button></div>{notice&&<p className="mw-pdfdoc-status" role="status">{notice}</p>}</>:<>
   <div className="mw-pdfdoc-url"><input ref={input} readOnly aria-label={'Link fisso di '+doc.name} value={url} onFocus={e=>e.target.select()}/><button type="button" className="mw-pill mw-pill-dark" onClick={copy}>{copied?'Copiato':'Copia'}</button></div>
   <p className="mw-sr-only" role="status">{copied?'Link copiato':''}</p>
   {confirm?<div className="mw-pdfdoc-confirm" role="alertdialog" aria-label={confirm==='regen'?'Conferma nuovo link':'Conferma revoca'}><p>{confirm==='regen'?'Creare un link nuovo? Quello vecchio smette di funzionare.':'Revocare il link? Chi lo usa non vedrà più il PDF.'}</p><div className="mw-actions"><button type="button" className="mw-pill mw-pill-dark" disabled={busy} onClick={()=>run(()=>confirm==='regen'?api.createLink(doc.id):api.revokeLink(doc.id),confirm==='regen'?'Link nuovo pronto: quello vecchio non funziona più.':'Link revocato.')}>{confirm==='regen'?'Crea link nuovo':'Revoca'}</button><button type="button" className="mw-pill" autoFocus onClick={()=>setConfirm('')}>Annulla</button></div></div>
   :<div className="mw-actions"><button type="button" className="mw-pill" disabled={busy} onClick={()=>setConfirm('regen')}>Rigenera</button><button type="button" className="mw-pill" disabled={busy} onClick={()=>setConfirm('revoke')}>Revoca</button></div>}
   {notice&&!copied&&<p className="mw-pdfdoc-status" role="status">{notice}</p>}</>}
 </div>;
}

function MenuPdfDocuments({adapter,document,onEditDefault,api=window.TakoPdfDocumentsApi}){
 const [state,setState]=useState({loading:true,error:'',documents:[],fallback:null});
 const [editing,setEditing]=useState(null),[editError,setEditError]=useState(''),[open,setOpen]=useState(''),[busy,setBusy]=useState(''),[notice,setNotice]=useState({id:'',text:''}),[rowError,setRowError]=useState({id:'',text:''}),[saved,setSaved]=useState('');
 const opener=useRef(null),host=useRef(null),mounted=useRef(true);
 useEffect(()=>()=>{mounted.current=false;},[]);
 const menus=document?.menus||[];
 const load=async()=>{try{const r=await api.list();if(mounted.current)setState({loading:false,error:'',documents:r.documents,fallback:r.default});return r;}catch(e){if(mounted.current)setState(s=>({...s,loading:false,off:e.status===404,error:e.status===404?'':(e.message||'PDF non disponibili')}));return null;}};
 useEffect(()=>{load();},[]);
 const remember=()=>{opener.current=window.document.activeElement;};
 const restore=()=>setTimeout(()=>{const el=opener.current;opener.current=null;if(el?.isConnected)el.focus();else host.current?.querySelector('[data-pdfdoc-new]')?.focus();},0);
 const close=()=>{setEditing(null);setEditError('');restore();};
 const names=ids=>ids.map(id=>menus.find(m=>m.id===id)?.name).filter(Boolean).join(', ')||'Nessun menu';
 const startNew=(from)=>{remember();setSaved('');setOpen('');setEditError('');setEditing({isNew:true,draft:{id:null,name:from?.name&&state.documents.length===0?from.name:'',menuIds:from?.menuIds?.filter(id=>menus.some(m=>m.id===id))||menus.filter(m=>m.active!==false).map(m=>m.id),config:null}});};
 const startEdit=doc=>{remember();setSaved('');setOpen('');setEditError('');setEditing({isNew:false,draft:{id:doc.id,name:doc.name,menuIds:[...doc.menuIds],config:doc.config?JSON.parse(JSON.stringify(doc.config)):null}});};
 const persist=async next=>{setBusy('save');setEditError('');try{await api.save(next);await load();if(mounted.current){setEditing(null);setSaved(next.length<state.documents.length?'PDF eliminato.':'PDF salvato.');restore();}}catch(e){if(mounted.current)setEditError(e.message);}finally{if(mounted.current)setBusy('');}};
 const save=()=>{const d=editing.draft;const list=editing.isNew?[...state.documents,d]:state.documents.map(x=>x.id===d.id?{...x,...d}:x);persist(list);};
 const remove=()=>{const d=editing.draft;persist(state.documents.filter(x=>x.id!==d.id));};
 const run=async(id,fn,text)=>{setSaved('');setBusy(id);setRowError({id:'',text:''});setNotice({id:'',text:''});try{await fn();await load();if(mounted.current)setNotice({id,text});}catch(e){if(mounted.current)setRowError({id,text:e.message});}finally{if(mounted.current)setBusy('');}};
 const download=async doc=>{setBusy(doc.id||'default');setRowError({id:'',text:''});try{const blob=doc.id?await api.download(doc.id):await adapter.renderPdf({menuIds:doc.menuIds});window.MW_SAVE_PDF?.(blob,MW_PDFDOC_FILE(doc.name));}catch(e){if(mounted.current)setRowError({id:doc.id||'default',text:e.message||'PDF non disponibile'});}finally{if(mounted.current)setBusy('');}};
 const key=e=>{if(e.key!=='Escape')return;if(editing){e.preventDefault();close();}else if(open){e.preventDefault();const id=open;setOpen('');setTimeout(()=>host.current?.querySelector(`[data-pdfdoc-link="${id}"]`)?.focus(),0);}};
 const docs=state.documents,editorFor=id=>editing&&(editing.isNew?id==='new':editing.draft.id===id);
 const editor=editing&&<MenuPdfDocumentEditor draft={editing.draft} setDraft={fn=>setEditing(e=>({...e,draft:typeof fn==='function'?fn(e.draft):fn}))} menus={menus} adapter={adapter} basePdf={document?.pdf} busy={busy==='save'} error={editError} isNew={editing.isNew} onSave={save} onCancel={close} onDelete={remove}/>;
 // Funzione spenta sul server (TAKO_MENU_PDF_DOCUMENTS non attivo → 404): il riquadro non compare, resta il PDF classico.
 if(state.off)return null;
 return <Card className="mw-pdfdoc"><section ref={host} aria-labelledby="mw-pdfdoc-title" onKeyDown={key}>
  <div className="mw-pdfdoc-head"><div><h3 id="mw-pdfdoc-title">I tuoi PDF</h3><p className="mw-pdfdoc-hint">Ogni PDF ha i suoi menu e un link fisso sempre aggiornato.</p></div>{!state.loading&&!state.error&&!editorFor('new')&&<button type="button" data-pdfdoc-new className="mw-pill" disabled={docs.length>=MW_PDFDOC_MAX||!menus.length} onClick={()=>startNew(null)}>Nuovo PDF</button>}</div>
  {saved&&!editing&&<p className="mw-pdfdoc-status mw-pdfdoc-saved" role="status">{saved}</p>}
  {state.loading?<TakoLoading label="Caricamento PDF…" variant="inline"/>:state.error?<div className="mw-pdfdoc-error"><p role="alert">{state.error}</p><button type="button" className="mw-pill" onClick={()=>{setState(s=>({...s,loading:true,error:''}));load();}}>Riprova</button></div>:<>
   {editorFor('new')&&editor}
   <ul className="mw-pdfdoc-list">
    {state.fallback&&<li className="mw-pdfdoc-row is-default"><div className="mw-pdfdoc-info"><strong>{state.fallback.name||'PDF predefinito'}</strong><small>Predefinito · {names(state.fallback.menuIds||[])}</small></div><div className="mw-pdfdoc-actions"><button type="button" className="mw-pill" disabled={!!busy} onClick={()=>download({name:state.fallback.name||'menu',menuIds:state.fallback.menuIds||[]})}>{busy==='default'?'Preparazione…':'Scarica'}</button><button type="button" className="mw-pill" data-pdfdoc-default-edit disabled={!!editing} onClick={()=>onEditDefault?onEditDefault():startNew(state.fallback)}>Modifica</button></div>{rowError.id==='default'&&<p role="alert" className="mw-pdfdoc-error">{rowError.text}</p>}</li>}
    {docs.map(doc=><li key={doc.id} className={'mw-pdfdoc-row'+(open===doc.id?' is-open':'')} data-pdfdoc={doc.id}>
     {editorFor(doc.id)?editor:<>
     <div className="mw-pdfdoc-info"><strong>{doc.name}</strong><small>{names(doc.menuIds)}{doc.config?' · grafica propria':''}{doc.shareToken?' · link attivo':''}</small></div>
     <div className="mw-pdfdoc-actions"><button type="button" className="mw-pill" disabled={!!busy} onClick={()=>download(doc)}>{busy===doc.id&&open!==doc.id?'Preparazione…':'Scarica'}</button><button type="button" className="mw-pill" data-pdfdoc-link={doc.id} aria-expanded={open===doc.id} onClick={()=>{setNotice({id:'',text:''});setOpen(o=>o===doc.id?'':doc.id);}}>Link fisso</button><button type="button" className="mw-pill" disabled={!!editing} onClick={()=>startEdit(doc)}>Modifica</button></div>
     {rowError.id===doc.id&&<p role="alert" className="mw-pdfdoc-error">{rowError.text}</p>}
     {open===doc.id&&<MenuPdfDocumentLink doc={doc} api={api} busy={busy===doc.id} notice={notice.id===doc.id?notice.text:''} run={(fn,text)=>run(doc.id,fn,text)}/>}</>}
    </li>)}
   </ul>
   {docs.length>=MW_PDFDOC_MAX&&<p className="mw-pdfdoc-hint">Massimo {MW_PDFDOC_MAX} PDF.</p>}
  </>}
 </section></Card>;
}
window.MenuPdfDocuments=MenuPdfDocuments;
