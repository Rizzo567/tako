const MW_PDF_GROUPS=[
 ['format','Formato',['format','orientation','columns','alignment','categoryPageBreak','background','verticalCentered','backgroundOpacity','backgroundSize']],
 ['text','Stile testo',['font','fontSize','headingFontSize','textColor','headingColor','nameBold','descriptionItalic']],
 ['content','Contenuti',['showPrices','showDescriptions','showImages','showAllergens','includeUnavailable']],
 ['translation','Traduzione',['translationPolicy']],
 ['spaces','Spazi',['margin','marginTop','marginRight','marginBottom','marginLeft']],
 ['advanced','Avanzate',['showCover','showLogo','logoShape','logoBackground','showMenuName','showDate','showPageNumbers','showQr','footer']]
];
function MenuWorkspacePrint({adapter,document,menu,mutate,dirty,initialLanguage='',onImagePending,previewTarget=null,hidePreview=false}) {
 const [blob,setBlob]=useState(null),[blobKey,setBlobKey]=useState(''),[url,setUrl]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [menuIds,setMenuIds]=useState(menu?[menu.id]:[]),[language,setLanguage]=useState(initialLanguage),[presetName,setPresetName]=useState('');
 const [controls,setControls]=useState(false),[mediaBlocked,setMediaBlocked]=useState(false);
 const pending=(changed,busy)=>{setMediaBlocked(!!(changed||busy));onImagePending?.(changed,busy);};
 const [tab,setTab]=useState('document'),[group,setGroup]=useState('format');
 const [element,setElement]=useState('name'),[area,setArea]=useState('page'),[imagePicker,setImagePicker]=useState('');
 const request=useRef(0),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current++;};},[]);
 useEffect(()=>{setMenuIds(ids=>ids.filter(id=>document.menus.some(m=>m.id===id)));},[document.menus]);
 useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
 const renderKey=JSON.stringify([document.pdf,document.revision,menuIds,language]);
 // Il download riusa l'anteprima già generata per la stessa configurazione: niente seconda generazione sul server.
 const render=async download=>{
  if(download&&blob&&blobKey===renderKey&&!busy){MW_SAVE_PDF(blob);return;}
  const sequence=++request.current;setBusy(true);setError('');
  try{const blob=await adapter.renderPdf({menuIds,language:language||undefined,preview:true});if(!mounted.current||sequence!==request.current)return;const next=URL.createObjectURL(blob);setUrl(next);setBlob(blob);setBlobKey(renderKey);if(download)MW_SAVE_PDF(blob);}
  catch(e){if(mounted.current&&sequence===request.current)setError(e.message||'Impossibile generare il PDF');}
  finally{if(mounted.current&&sequence===request.current)setBusy(false);}
 };
 // Render saved configuration automatically; never silently save an unsaved editor draft.
 useEffect(()=>{request.current++;setBusy(false);if(dirty||!menuIds.length)return;const timer=setTimeout(()=>render(false),300);return()=>{clearTimeout(timer);request.current++;};},[renderKey,dirty,adapter]);
 // 23/10: Menu con «Modello PDF» → il PDF è il modello con il menu scritto sopra; impaginazione e temi non servono.
 const paper=menuIds.length>0&&menuIds.every(id=>document.menus.find(m=>m.id===id)?.paper?.templateUrl);
 const selection=MW_PDF_GROUPS.find(g=>g[0]===group)||MW_PDF_GROUPS[0];
 const extraFields=[{key:'verticalCentered',label:'Centra verticalmente il contenuto',type:'boolean'},{key:'backgroundOpacity',label:'Opacità immagine sfondo (0–1)',type:'number'},{key:'backgroundSize',label:'Dimensione immagine sfondo',options:[{value:'cover',label:'Copri pagina'},{value:'contain',label:'Contieni nella pagina'}]},{key:'logoBackground',label:'Colore sfondo logo',type:'color',nullable:true}];
 const allFields=[...(adapter.pdfFields||[]),...extraFields.filter(e=>!(adapter.pdfFields||[]).some(f=>f.key===e.key))];
 const fields=allFields.filter(f=>selection[2].includes(f.key));
 const fonts=['sans','serif','mono','poppins','staatliches','amaranth','italiana'];
 const typoFields=[{key:'font',label:'Font',options:fonts},{key:'fontSize',label:'Dimensione',type:'number'},{key:'color',label:'Colore',type:'color'},...['bold','italic','underline'].map(key=>({key,label:({bold:'Grassetto',italic:'Corsivo',underline:'Sottolineato'})[key],type:'boolean'})),{key:'align',label:'Allineamento',options:[{value:'left',label:'Sinistra'},{value:'center',label:'Centro'},{value:'right',label:'Destra'}]}];
 const pdf={backgroundOpacity:1,backgroundSize:'cover',verticalCentered:false,...(document.pdf||{})},elementStyle={font:pdf.font||'sans',fontSize:['category','subcategory'].includes(element)?(pdf.headingFontSize||18)-2:element==='menu'?(pdf.headingFontSize||18):element==='footer'?8:['description','legend'].includes(element)?(pdf.fontSize||11)-1:(pdf.fontSize||11),color:['category','subcategory','menu'].includes(element)?pdf.headingColor:pdf.textColor,bold:element==='name'?pdf.nameBold:['category','subcategory','menu'].includes(element),italic:element==='description'&&pdf.descriptionItalic,underline:false,align:pdf.alignment||'left',...pdf.typography?.[element]};
 const qr=async format=>{setError('');try{const image=await adapter.downloadQr(menu?.id,format);const link=window.document.createElement('a'),qr=URL.createObjectURL(image);link.href=qr;link.download='menu-tako-qr.'+format;link.click();setTimeout(()=>URL.revokeObjectURL(qr),1000);}catch(e){setError(e.message||'Impossibile scaricare il QR');}};
 return <section className="mw-pdf-editor" aria-label="Editor PDF">
  <div className="mw-pdf-shell"><div className="mw-pdf-controls">
  <div className="mw-pdf-header"><div><h3>Documento PDF</h3><p>Configura il menu da stampare.</p></div></div><Btn disabled={busy||dirty||!menuIds.length} onClick={()=>render(true)}>{busy?'Generazione…':'Scarica menu PDF'}</Btn>
  {paper&&<p className="mw-pdf-note" role="status">Questo menu usa il <strong>Modello PDF</strong> (matita del menu): piatti e prezzi si scrivono da soli sul modello e il PDF si aggiorna a ogni pubblicazione.</p>}
  {!paper&&<label className="mw-field">Allineamento testi<select aria-label="Allineamento testi PDF" value={document.pdf.alignment||'left'} onChange={e=>{const alignment=e.target.value;mutate(d=>{d.pdf.alignment=alignment;for(const key of Object.keys(d.pdf.typography||{})){if(key!=='price'&&key!=='footer')d.pdf.typography[key]={...d.pdf.typography[key],align:alignment};}});}}><option value="left">A sinistra</option><option value="center">Centrati</option></select></label>}
  <fieldset className="mw-pdf-selection"><legend>Menu da includere nel PDF</legend>{document.menus.map(m=><label key={m.id} className="mw-check"><input type="checkbox" checked={menuIds.includes(m.id)} onChange={e=>setMenuIds(ids=>e.target.checked?[...ids,m.id]:ids.filter(id=>id!==m.id))}/>{m.name}</label>)}</fieldset>
  {!paper&&<Btn kind="soft" disabled={mediaBlocked} aria-expanded={controls} aria-controls="mw-pdf-panel" onClick={()=>setControls(v=>!v)}>{controls?'Chiudi impaginazione e temi':'Impaginazione e temi'}</Btn>}
  {controls&&<div className="mw-pdf-tabs" role="tablist" aria-label="Configurazione PDF">{[['document','Documento'],['themes','Temi']].map(([id,label])=><button key={id} id={'mw-pdf-tab-'+id} type="button" disabled={mediaBlocked} role="tab" aria-selected={tab===id} aria-controls="mw-pdf-panel" onClick={()=>setTab(id)}>{label}</button>)}</div>}
  {dirty&&<p className="mw-pdf-note" role="status">Salva le modifiche dell’editor per aggiornare l’anteprima e scaricare il PDF. L’anteprima visualizzata corrisponde all’ultima generazione.</p>}
  {error&&<p role="alert">{error}</p>}
  <div className={"mw-pdf-layout"+(controls?"":" mw-pdf-simple")} id="mw-pdf-panel" role="tabpanel" aria-labelledby={'mw-pdf-tab-'+tab}>
   {controls&&<nav className="mw-pdf-nav" aria-label="Sezioni del documento PDF">{MW_PDF_GROUPS.map(([id,label])=><button key={id} type="button" disabled={mediaBlocked} aria-current={tab==='document'&&group===id?'page':undefined} onClick={()=>{setTab('document');setGroup(id);}}>{label}</button>)}</nav>}
   {controls&&<div className="mw-pdf-settings">
    {tab==='document'?<><h4>{selection[1]}</h4>
     {group==='format'&&<p>Scegli formato, colonne, allineamento e sfondo del documento.</p>}
     {group==='text'&&<><p>Personalizza ogni elemento del documento con font e formattazione indipendenti.</p><label className="mw-field">Elemento<select value={element} onChange={e=>setElement(e.target.value)}>{[['menu','Nome menu'],['category','Sottomenu'],['subcategory','Sezione'],['name','Nome piatto'],['price','Prezzo piatto'],['description','Descrizione piatto'],['allergens','Allergeni'],['traits','Caratteristiche'],['additives','Additivi'],['legend','Legenda generale'],['footer','Piè di pagina']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><MenuWorkspaceSchema fields={typoFields} value={elementStyle} onChange={v=>mutate(d=>{d.pdf.typography={...(d.pdf.typography||{}),[element]:v};})}/><h4>Impostazioni di base</h4></>}
     {group==='content'&&<fieldset><legend>Menu da includere</legend>{document.menus.map(m=><label key={m.id} className="mw-check"><input type="checkbox" checked={menuIds.includes(m.id)} onChange={e=>setMenuIds(ids=>e.target.checked?[...ids,m.id]:ids.filter(id=>id!==m.id))}/>{m.name}</label>)}{!menuIds.length&&<p role="status">Seleziona almeno un menu per generare il PDF.</p>}</fieldset>}
     {group==='translation'&&<><label className="mw-check"><input type="checkbox" checked={pdf.translationActive??!!language} onChange={e=>mutate(d=>{d.pdf.translationActive=e.target.checked;})}/>Traduzioni attive</label><label className="mw-field">Lingua del documento<select value={language} onChange={e=>setLanguage(e.target.value)}><option value="">Originale</option>{document.languages?.map(l=><option key={l} value={l}>{l.toUpperCase()}</option>)}</select></label><label className="mw-field">Tipologia<select value={pdf.translationNamesPolicy||'all'} onChange={e=>mutate(d=>{d.pdf.translationNamesPolicy=e.target.value;})}><option value="all">Tutti i testi tradotti</option><option value="auto">Automatica: mantieni i nomi dei piatti con descrizione</option></select></label><p>Usa le traduzioni già salvate. Non invia richieste a servizi di traduzione durante la generazione.</p></>}
     {group==='spaces'&&<><label className="mw-field">Area<select value={area} onChange={e=>setArea(e.target.value)}>{[['page','Pagina'],['category','Sottomenu'],['subcategory','Sezioni'],['item','Piatti'],['menu','Nome menu'],['description','Descrizioni'],['legend','Legende'],['logo','Logo']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><p>Spazi in punti tipografici. Per la pagina, un lato vuoto usa il margine generale.</p>{area!=='page'&&<MenuWorkspaceSchema fields={['top','right','bottom','left'].map(key=>({key,label:({top:'Sopra',right:'Destra',bottom:'Sotto',left:'Sinistra'})[key],type:'number'}))} value={pdf.spaces?.[area]||{top:0,right:0,bottom:0,left:0}} onChange={v=>mutate(d=>{d.pdf.spaces={...(d.pdf.spaces||{}),[area]:v};})}/>}</>}
     <MenuWorkspaceSchema fields={group==='spaces'&&area!=='page'?[]:fields} value={pdf} onChange={v=>mutate(d=>{d.pdf=v;})}/>
     {group==='format'&&<section><h4>Immagine di sfondo</h4>{pdf.backgroundImageUrl&&<img src={pdf.backgroundImageUrl} alt="Sfondo PDF selezionato" style={{width:120,height:80,objectFit:'cover'}}/>}<div className="mw-actions"><Btn kind="soft" size="sm" onClick={()=>setImagePicker('background')}>Scegli immagine</Btn>{pdf.backgroundImageUrl&&<Btn kind="ghost" size="sm" onClick={()=>mutate(d=>{d.pdf.backgroundImageUrl=null;})}>Rimuovi sfondo</Btn>}</div></section>}
     {group==='advanced'&&<><h4>Logo</h4><Btn kind="soft" size="sm" onClick={()=>setImagePicker('logo')}>Scegli logo dalla galleria</Btn><h4>Legende</h4>{[['allergens','Allergeni'],['traits','Caratteristiche alimentari'],['additives','Additivi']].map(([key,label])=><label key={key} className="mw-check"><input type="checkbox" checked={pdf.legends?.[key]??(key==='allergens'&&pdf.showFoodLegends)} onChange={e=>mutate(d=>{d.pdf.legends={allergens:d.pdf.showFoodLegends,traits:false,additives:false,...d.pdf.legends,[key]:e.target.checked};})}/>{label}</label>)}{!window.__takoTrialMenu&&<section className="mw-pdf-sharing"><h4>Menu digitale</h4>{window.__takoRestaurantId&&menu&&<a target="_blank" rel="noopener noreferrer" href={`${MW_CUSTOMER_PATH(window.__takoRestaurantId)}?menuId=${menu.id}`}>Apri menu pubblico</a>}<div className="mw-actions"><Btn kind="soft" size="sm" disabled={!menu} onClick={()=>qr('png')}>Scarica QR PNG</Btn><Btn kind="soft" size="sm" disabled={!menu} onClick={()=>qr('svg')}>Scarica QR SVG</Btn><Btn kind="ghost" size="sm" disabled={!menu} onClick={async()=>{try{await navigator.clipboard.writeText(`${location.origin}${MW_CUSTOMER_PATH(window.__takoRestaurantId)}?menuId=${menu.id}`);toast('Link copiato',{type:'success'});}catch{setError('Impossibile copiare il link: apri il menu pubblico e copia l’indirizzo.');}}}>Copia link</Btn></div><p>Questi QR aprono il menu digitale pubblicato.</p></section>}</>}
    </>:<><h4>Temi PDF personali</h4><p>Salva e riutilizza le impostazioni del documento. I temi rimangono nella bozza fino al salvataggio dell’editor.</p>{!(document.pdfPresets||[]).length&&<p>Nessun tema salvato. Crea il primo dalle impostazioni attuali.</p>}{(document.pdfPresets||[]).map(p=><section className="mw-pdf-theme-card" key={p.id}><strong>{p.name}</strong><p>{p.config.format} · {p.config.columns} {p.config.columns===1?'colonna':'colonne'} · {p.config.font}</p><div className="mw-actions"><Btn size="sm" kind="soft" onClick={()=>mutate(d=>{d.pdf=JSON.parse(JSON.stringify(p.config));})}>Applica tema</Btn><Btn size="sm" kind="ghost" onClick={()=>{if(window.confirm(`Eliminare il tema PDF “${p.name}” dalla bozza?`))mutate(d=>{d.pdfPresets=(d.pdfPresets||[]).filter(x=>x.id!==p.id);});}}>Elimina</Btn></div></section>)}<MenuWorkspaceField label="Nome del nuovo tema" value={presetName} onChange={setPresetName}/><Btn kind="soft" size="sm" disabled={!presetName.trim()||(document.pdfPresets||[]).length>=100} onClick={()=>{mutate(d=>{d.pdfPresets=[...(d.pdfPresets||[]),{id:crypto.randomUUID(),name:presetName.trim().slice(0,100),config:JSON.parse(JSON.stringify(d.pdf))}];});setPresetName('');}}>Salva impostazioni come tema</Btn></>}
   {imagePicker&&window.MenuWorkspaceGallery&&<section><div className="mw-row"><h4>{imagePicker==='logo'?'Scegli logo':'Scegli sfondo PDF'}</h4><Btn size="sm" kind="ghost" disabled={mediaBlocked} onClick={()=>setImagePicker('')}>Chiudi galleria</Btn></div><window.MenuWorkspaceGallery onPending={pending} purpose="background" adapter={adapter} onPick={asset=>{mutate(d=>{if(imagePicker==='logo')d.design.logoUrl=asset.url;else d.pdf.backgroundImageUrl=asset.url;});setImagePicker('');}}/></section>}
   </div>}
  </div></div>
   {!hidePreview&&(previewTarget?ReactDOM.createPortal(<aside className="mw-pdf-preview-area" aria-label="Anteprima del documento">{blob?<MenuWorkspacePdfViewer blob={blob}/>:<div className="mw-pdf-empty" role="status">{busy?<TakoLoading label="Generazione dell’anteprima…" variant="page"/>:dirty?'Salva la bozza per generare l’anteprima.':'Seleziona un menu per visualizzare il documento.'}</div>}</aside>,previewTarget):<aside className="mw-pdf-preview-area" aria-label="Anteprima del documento">{blob?<MenuWorkspacePdfViewer blob={blob}/>:<div className="mw-pdf-empty" role="status">{busy?<TakoLoading label="Generazione dell’anteprima…" variant="page"/>:dirty?'Salva la bozza per generare l’anteprima.':'Seleziona un menu per visualizzare il documento.'}</div>}</aside>)}
  </div>
 </section>;
}
window.MenuWorkspacePrint=MenuWorkspacePrint;

let MW_PDFJS_PROMISE;
/* Safari (WebKit) non implementa ancora l'iterazione asincrona di ReadableStream: pdf.js la usa in getTextContent
   e l'eccezione nascondeva l'intera anteprima. Polyfill minimo, applicato solo se manca. */
function MW_PATCH_READABLE_STREAM() {
 const proto=window.ReadableStream?.prototype;if(!proto||proto[Symbol.asyncIterator])return;
 proto.values=proto.values||function({preventCancel=false}={}){const reader=this.getReader();return {next(){return reader.read();},async return(value){if(!preventCancel){const done=reader.cancel(value);reader.releaseLock();await done;}else reader.releaseLock();return {done:true,value};},[Symbol.asyncIterator](){return this;}};};
 proto[Symbol.asyncIterator]=proto.values;
}
function MW_LOAD_PDFJS() {
 MW_PATCH_READABLE_STREAM();
 if(!MW_PDFJS_PROMISE)MW_PDFJS_PROMISE=import(new URL('lib/pdfjs/pdf.mjs',window.document.baseURI).href).then(pdfjs=>{pdfjs.GlobalWorkerOptions.workerSrc=new URL('lib/pdfjs/pdf.worker.mjs',window.document.baseURI).href;return pdfjs;}).catch(error=>{MW_PDFJS_PROMISE=null;throw error;});
 return MW_PDFJS_PROMISE;
}
/** One canvas at a time bounds memory even for long menus; source bytes are the real download PDF. */
function MenuWorkspacePdfViewer({blob}) {
 const container=useRef(null),canvas=useRef(null),renderTask=useRef(null),swipe=useRef(null);
 const [height,setHeight]=useState(380),[fitPage,setFitPage]=useState(true),[pdf,setPdf]=useState(null),[page,setPage]=useState(1),[total,setTotal]=useState(0),[width,setWidth]=useState(600),[loading,setLoading]=useState(true),[error,setError]=useState(''),[text,setText]=useState('');
 useEffect(()=>{const host=container.current;if(!host)return;const resize=()=>{const top=host.getBoundingClientRect().top;setWidth(Math.max(150,Math.min(1100,Math.floor(host.clientWidth||700))));setHeight(Math.max(190,Math.min(900,window.innerHeight-top-65)));};resize();const observer=new ResizeObserver(resize);observer.observe(host);window.addEventListener('resize',resize);return()=>{observer.disconnect();window.removeEventListener('resize',resize);};},[]);
 useEffect(()=>{
  let active=true,task=null;
  setPdf(null);setTotal(0);setPage(1);setText('');setLoading(true);setError('');
  (async()=>{const bytes=new Uint8Array(await blob.arrayBuffer());const library=await MW_LOAD_PDFJS();if(!active)return;
   const asset=name=>new URL('lib/pdfjs/'+name+'/',window.document.baseURI).href;
   task=library.getDocument({data:bytes,isEvalSupported:false,cMapUrl:asset('cmaps'),cMapPacked:true,standardFontDataUrl:asset('standard_fonts'),wasmUrl:asset('wasm')});
   const document=await task.promise;if(!active)return;setTotal(document.numPages);setPdf(document);
  })().catch(e=>{if(active){setError(e.message||'Impossibile aprire il PDF');setLoading(false);}});
  return()=>{active=false;renderTask.current?.cancel();if(task)void task.destroy().catch(()=>{});};
 },[blob]);
 useEffect(()=>{
  if(!pdf)return;let active=true,current=null;setLoading(true);setError('');setText('');
  (async()=>{const documentPage=await pdf.getPage(page);if(!active)return;
   const native=documentPage.getViewport({scale:1}),viewport=documentPage.getViewport({scale:fitPage?Math.min(width/native.width,(width*1.98)/native.height):(width*.9)/native.width}),ratio=Math.min(window.devicePixelRatio||1,2),target=canvas.current;
   if(!target)return;target.width=Math.ceil(viewport.width*ratio);target.height=Math.ceil(viewport.height*ratio);target.style.width=Math.floor(viewport.width)+'px';target.style.height=Math.floor(viewport.height)+'px';
   current=documentPage.render({canvas:target,viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]});renderTask.current=current;
   await current.promise;if(!active)return;setLoading(false);
   // Il testo accessibile è un extra: se il browser non lo supporta, la pagina resta visibile.
   try{const content=await documentPage.getTextContent();if(active)setText(content.items.map(item=>item.str||'').join(' '));}catch{}
  })().catch(e=>{if(active&&e.name!=='RenderingCancelledException'){setError(e.message||'Impossibile mostrare la pagina');setLoading(false);}});
  return()=>{active=false;current?.cancel();if(renderTask.current===current)renderTask.current=null;};
 },[pdf,page,width,height,fitPage]);
 return <section ref={container} className="mw-pdf-viewer" aria-label="Anteprima PDF paginato"><div className="mw-pdf-viewer-toolbar"><div className="mw-row"><Btn kind="soft" size="sm" disabled={!pdf||page<=1} onClick={()=>setPage(p=>p-1)} aria-label="Pagina precedente">←</Btn><span role="status">Pagina {total?page:0} di {total}</span><Btn kind="soft" size="sm" disabled={!pdf||page>=total} onClick={()=>setPage(p=>p+1)} aria-label="Pagina successiva">→</Btn></div><select hidden aria-label="Dimensione anteprima PDF" value={fitPage?'fit':'large'} onChange={e=>setFitPage(e.target.value==='fit')}><option value="fit">Pagina intera</option><option value="large">Ingrandita</option></select></div>{error&&<p role="alert">{error}</p>}<div className="mw-pdf-page-stage" aria-label="Pagina PDF completa" onTouchStart={e=>{const t=e.touches[0];swipe.current={x:t.clientX,y:t.clientY};}} onTouchEnd={e=>{const t=e.changedTouches[0],start=swipe.current;swipe.current=null;if(!start||!pdf)return;const dx=t.clientX-start.x,dy=t.clientY-start.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3)setPage(v=>Math.max(1,Math.min(total,v+(dx<0?1:-1))));}}>{loading&&<div className="mw-pdf-loading"><TakoLoading label='Rendering PDF…' variant="page"/></div>}<canvas ref={canvas} role="img" aria-label={`Pagina ${page} del PDF`} style={{display:pdf&&!error?'block':'none',maxWidth:'100%',background:'#fff'}}/></div>{text&&<p className="mw-pdf-accessible-text">{text}</p>}</section>;
}
window.MenuWorkspacePdfViewer=MenuWorkspacePdfViewer;
/* Salva il PDF già generato. Sincrono rispetto al tocco (nessuna attesa di rete), così Safari iOS mantiene il gesto:
   condivisione file nativa se disponibile (Salva su File/Stampa), altrimenti link di download inserito nel documento. */
function MW_SAVE_PDF(blob,name='menu-tako.pdf') {
 const touch=window.matchMedia('(pointer:coarse)').matches;
 try{const file=new File([blob],name,{type:'application/pdf'});if(touch&&navigator.canShare?.({files:[file]})){navigator.share({files:[file],title:name}).catch(()=>{});return;}}catch{}
 const href=URL.createObjectURL(blob),link=window.document.createElement('a');link.href=href;link.download=name;link.rel='noopener';link.style.display='none';
 window.document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),60000);
}
window.MW_SAVE_PDF=MW_SAVE_PDF;
