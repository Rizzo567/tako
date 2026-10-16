function MenuWorkspaceImport({adapter,document,dirty,onPreview}) {
 const [format,setFormat]=useState('csv'),[source,setSource]=useState(''),[mapping,setMapping]=useState({menu:'menu',section:'section',name:'name',description:'description',price:'price',allergens:'allergens',tags:'tags'}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null);
 useEffect(()=>{setResult(null);},[document]);
 return <Card><details><summary className="press">Importa menu CSV o JSON</summary><p>L’importazione genera un’anteprima. Applica e salva la bozza solo dopo averla verificata.</p><label className="mw-field">Formato<select value={format} onChange={e=>{setFormat(e.target.value);setResult(null);}}><option value="csv">CSV</option><option value="json">JSON workspace Tako</option></select></label><label className="mw-field">File<input type="file" accept={format==='csv'?'.csv,text/csv':'.json,application/json'} onChange={async e=>{const f=e.target.files?.[0];if(f){setSource(await f.text());setResult(null);}}}/></label><label className="mw-field">Contenuto<textarea rows={5} value={source} onChange={e=>{setSource(e.target.value);setResult(null);}}/></label>{format==='csv'&&<div className="mw-fields">{Object.entries(mapping).map(([key,value])=><MenuWorkspaceField key={key} label={`Colonna ${key}`} value={value} onChange={v=>{setMapping({...mapping,[key]:v});setResult(null);}}/>)}</div>}{error&&<p role="alert">{error}</p>}<Btn disabled={busy||dirty||!source.trim()} onClick={async()=>{setBusy(true);setError('');setResult(null);try{const base=JSON.stringify(document);const response=await adapter.previewImport({expectedRevision:document.revision,format,source,mapping:format==='csv'?mapping:undefined});setResult({...response.data,base});}catch(e){setError(e.message);}finally{setBusy(false);}}}>{busy?'Analisi…':'Genera anteprima'}</Btn>{dirty&&<p>Salva o scarta le modifiche aperte prima di importare.</p>}{result&&<><p>{result.importedCount} piatti pronti per la revisione</p>{result.warnings?.map((w,i)=><p key={i}>{typeof w==='string'?w:JSON.stringify(w)}</p>)}<Btn disabled={dirty||result.base!==JSON.stringify(document)} onClick={()=>{if(dirty||result.base!==JSON.stringify(document)){setError("Il menu è cambiato: genera una nuova anteprima.");return;}onPreview({...result.workspace,revision:document.revision,publishedRevision:document.publishedRevision,capabilities:document.capabilities});setResult(null);}}>Applica all’editor per revisione</Btn></>}</details></Card>;
}
function MenuWorkspaceTranslate({adapter,document,dirty,onPreview}) {
 const [language,setLanguage]=useState(document.languages.find(l=>l!==document.defaultLanguage)||''),[target,setTarget]=useState('missing'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null);
 useEffect(()=>{setResult(null);},[document]);
 return <section><h4>Traduzione assistita</h4><p>La richiesta usa il provider configurato dal titolare. Controlla le traduzioni prima di salvare la bozza.</p><label className="mw-field">Lingua<select value={language} onChange={e=>{setLanguage(e.target.value);setResult(null);}}><option value="">Seleziona lingua</option>{document.languages.filter(l=>l!==document.defaultLanguage).map(l=><option key={l}>{l}</option>)}</select></label><select aria-label="Contenuti da tradurre" value={target} onChange={e=>{setTarget(e.target.value);setResult(null);}}><option value="missing">Solo traduzioni mancanti</option></select><Btn disabled={dirty||busy||!language} onClick={async()=>{setBusy(true);setError('');setResult(null);try{const base=JSON.stringify(document);const response=await adapter.previewTranslation({expectedRevision:document.revision,language,target});setResult({...response.data,base});}catch(e){setError(e.message);}finally{setBusy(false);}}}>{busy?'Traduzione…':'Genera traduzioni'}</Btn>{error&&<p role="alert">{error}</p>}{result&&<><p>{result.translatedCount} contenuti tradotti</p>{result.warnings?.map((w,i)=><p key={i}>{typeof w==='string'?w:JSON.stringify(w)}</p>)}<Btn disabled={dirty||result.base!==JSON.stringify(document)} onClick={()=>{if(dirty||result.base!==JSON.stringify(document)){setError("Il menu è cambiato: genera una nuova anteprima.");return;}onPreview({...result.workspace,revision:document.revision,publishedRevision:document.publishedRevision,capabilities:document.capabilities});setResult(null);}}>Apri le traduzioni nell’editor</Btn></>}</section>;
}

// Onboarding is local until the user applies it to the existing draft editor.
const MW_SETUP_EXAMPLE='# ANTIPASTI\nBruschetta — 6,00 €\nPomodoro e basilico\n# PRIMI\nRisotto ai funghi — 14,00 €\nRiso Carnaroli e funghi di stagione';
function MW_SETUP_DOCUMENT(base,workspace,design) {
 const next=JSON.parse(JSON.stringify(workspace||base));
 next.design={...next.design,...design};
 if(design.text!==base.design?.text)for(const mode of ['standard','centered','link'])for(const part of ['name','price','description'])next.design[mode]={...next.design[mode],[part]:{...next.design[mode]?.[part],color:design.text}};
 next.revision=base.revision;next.publishedRevision=base.publishedRevision;next.capabilities=base.capabilities;
 return next;
}
/* ── Colori: estrazione dal logo (canvas, lato client) e controllo del contrasto ── */
const mwHexToRgb=hex=>{let h=String(hex||'').replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h.slice(0,6),16);return Number.isFinite(n)?[n>>16&255,n>>8&255,n&255]:[0,0,0];};
const mwRgbToHex=rgb=>'#'+rgb.map(x=>Math.round(Math.max(0,Math.min(255,x))).toString(16).padStart(2,'0')).join('');
const mwLuminance=hex=>{const [r,g,b]=mwHexToRgb(hex).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*r+0.7152*g+0.0722*b;};
const mwContrast=(a,b)=>{const x=mwLuminance(a),y=mwLuminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
const mwMix=(a,b,t)=>{const x=mwHexToRgb(a),y=mwHexToRgb(b);return mwRgbToHex(x.map((v,i)=>v+(y[i]-v)*t));};
const mwHsl=hex=>{const [r,g,b]=mwHexToRgb(hex).map(v=>v/255);const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2,d=max-min;const s=d===0?0:d/(1-Math.abs(2*l-1));return {s,l};};
const mwDistance=(a,b)=>{const x=mwHexToRgb(a),y=mwHexToRgb(b);return Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2]);};
/* testo leggibile sullo sfondo: almeno 4.5:1 (WCAG AA), preferendo una tinta scura del colore principale */
function mwReadableText(background,primary){
 const tinted=primary?mwMix(primary,'#000000',.72):null;
 for(const c of [tinted,'#111111','#ffffff'])if(c&&mwContrast(c,background)>=4.5)return c;
 return mwContrast('#000000',background)>=mwContrast('#ffffff',background)?'#000000':'#ffffff';
}
/* palette da pixel RGBA: grappoli di colori vicini ordinati per peso, sfondo dal bordo */
function mwPaletteFromPixels(data,width,height){
 const clusters=[],border=[];let borderClear=0,borderTotal=0;
 const add=(list,hex,n=1)=>{const hit=list.find(c=>mwDistance(c.hex,hex)<38);if(hit){hit.n+=n;}else list.push({hex,n});};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,a=data[i+3],edge=x===0||y===0||x===width-1||y===height-1;
  if(edge)borderTotal++;
  if(a<128){if(edge)borderClear++;continue;}
  const hex=mwRgbToHex([data[i],data[i+1],data[i+2]]);
  add(clusters,hex);if(edge)add(border,hex);
 }
 clusters.sort((a,b)=>b.n-a.n);border.sort((a,b)=>b.n-a.n);
 const edgeColor=borderClear/Math.max(1,borderTotal)>.5?null:border[0]?.hex||null;
 const marks=clusters.filter(c=>!edgeColor||mwDistance(c.hex,edgeColor)>=38);
 const vivid=marks.find(c=>{const {s,l}=mwHsl(c.hex);return s>.25&&l>.12&&l<.88;});
 const primary=(vivid||marks[0]||clusters[0]||{hex:'#111111'}).hex;
 const background=edgeColor&&mwLuminance(edgeColor)>.55?edgeColor:mwMix(primary,'#ffffff',.94);
 return {primary,background,text:mwReadableText(background,primary),swatches:[...new Set([...marks,...clusters].map(c=>c.hex))].slice(0,6)};
}
function mwExtractFromImage(src){
 return new Promise((resolve,reject)=>{const img=new Image();img.decoding='async';img.onload=()=>{try{const scale=Math.min(1,96/Math.max(img.naturalWidth||96,img.naturalHeight||96));const w=Math.max(1,Math.round((img.naturalWidth||96)*scale)),h=Math.max(1,Math.round((img.naturalHeight||96)*scale));const canvas=window.document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,w,h);resolve(mwPaletteFromPixels(ctx.getImageData(0,0,w,h).data,w,h));}catch(e){reject(e);}};img.onerror=()=>reject(new Error('Immagine non leggibile'));img.src=src;});
}
const MW_IMAGE_TYPES=['image/png','image/jpeg','image/webp'];
const mwDataUrlToFile=async(dataUrl,name)=>{const blob=await (await fetch(dataUrl)).blob();const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/svg+xml':'svg','image/gif':'gif'}[blob.type]||'png';return new File([blob],`${name}.${ext}`,{type:blob.type});};

/* riquadro «trascina qui»: accetta trascinamento e clic, mostra anteprima, sostituisci e rimuovi */
function MwDropZone({title,label,value,busy,disabled,onFile,onRemove,variant}) {
 const input=useRef(null),[over,setOver]=useState(false);
 const pick=()=>{if(!disabled&&!busy)input.current?.click();};
 const take=file=>{if(file&&!disabled&&!busy)onFile(file);};
 return <div className={'mw-drop'+(variant?' '+variant:'')+(over?' over':'')+(value?' filled':'')} onDragOver={e=>{e.preventDefault();if(!disabled)setOver(true);}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOver(false);}} onDrop={e=>{e.preventDefault();setOver(false);take(e.dataTransfer.files?.[0]);}}>
  <input ref={input} type="file" accept={MW_IMAGE_TYPES.join(',')} tabIndex={-1} aria-hidden="true" style={{display:'none'}} onChange={e=>{const file=e.target.files?.[0];e.target.value='';take(file);}}/>
  {value?<><div className="mw-drop-media"><img src={value} alt={label}/></div><div className="mw-drop-bar"><span>{label}</span><button type="button" className="press mw-chip" disabled={disabled||busy} onClick={pick}>Sostituisci</button><button type="button" className="press mw-chip" disabled={disabled||busy} onClick={onRemove}>Rimuovi</button></div></>
  :<button type="button" className="mw-drop-empty" disabled={disabled||busy} onClick={pick} aria-label={`${title}: scegli un file`}><span className="mw-drop-icon"><Icon name="upload" size={18}/></span><b>{title}</b><small>oppure fai clic per sceglierlo · PNG, JPG o WebP</small></button>}
  {busy&&<div className="mw-drop-busy"><TakoLoading label="Caricamento immagine…" variant="compact"/></div>}
 </div>;
}
function MwSwatch({label,value,onChange}) {
 return <label className="mw-swatch"><span className="mw-swatch-dot" style={{background:value}}><input type="color" value={value} onChange={e=>onChange(e.target.value)} aria-label={`${label}: scegli il colore`}/></span><span className="mw-swatch-text"><span>{label}</span><input value={value} spellCheck={false} aria-label={`${label}: codice colore`} onChange={e=>{const v=e.target.value.trim();if(/^#[0-9a-f]{6}$/i.test(v))onChange(v.toLowerCase());}} key={value}/></span></label>;
}
function MwContrast({text,background}) {
 const ratio=mwContrast(text,background),ok=ratio>=4.5;
 return <span className={'mw-contrast'+(ok?' ok':' low')}><Icon name={ok?'check':'alert'} size={13}/>Contrasto testo {ratio.toFixed(1).replace('.',',')}:1{ok?'':' · sotto 4,5:1'}</span>;
}

function MenuWorkspaceSetup({adapter,document,onApply,onClose,onPending}) {
 const [step,setStep]=useState(0),[design,setDesign]=useState(()=>({...document.design})),[source,setSource]=useState(''),[target,setTarget]=useState(''),[result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[assets,setAssets]=useState([]),[assetsError,setAssetsError]=useState(false);
 const [imageEdit,setImageEdit]=useState(null),[imagePreparing,setImagePreparing]=useState(false),[uploading,setUploading]=useState(null),[proposal,setProposal]=useState(null),[siteUrl,setSiteUrl]=useState(''),[siteBusy,setSiteBusy]=useState(false),[siteError,setSiteError]=useState(''),[uploadError,setUploadError]=useState('');
 const frame=useRef(null),initial=useRef(JSON.stringify(document)),requestId=useRef(0),extractId=useRef(0);
 const changed=JSON.stringify(design)!==JSON.stringify(document.design)||!!source.trim()||!!imageEdit;
 const stale=initial.current!==JSON.stringify(document);
 const candidate=MW_SETUP_DOCUMENT(document,result?.workspace,design);
 const previewMenuId=target||candidate.menus.find(m=>!document.menus.some(original=>original.id===m.id)||m.sections.some(s=>s.items.some(i=>!document.menus.flatMap(x=>x.sections.flatMap(y=>y.items)).some(original=>original.id===i.id))))?.id||candidate.menus[0]?.id;
 const pending=busy||!!uploading||siteBusy||imagePreparing;
 useEffect(()=>{onPending(changed,pending);return()=>onPending(false,false);},[changed,pending]);
 const loadAssets=()=>adapter.listAssets().then(r=>{setAssets(Array.isArray(r)?r:r.data||[]);setAssetsError(false);}).catch(()=>setAssetsError(true));
 useEffect(()=>{let alive=true;adapter.listAssets().then(r=>{if(alive){setAssets(Array.isArray(r)?r:r.data||[]);setAssetsError(false);}}).catch(()=>{if(alive)setAssetsError(true);});return()=>{alive=false;requestId.current++;extractId.current++;};},[adapter]);
 useEffect(()=>{const send=e=>{if(e.origin===location.origin&&e.source===frame.current?.contentWindow&&e.data?.type==='tako-menu-preview-ready')e.source.postMessage({type:'tako-menu-preview',document:candidate,menuId:previewMenuId},location.origin);};window.addEventListener('message',send);frame.current?.contentWindow?.postMessage({type:'tako-menu-preview',document:candidate,menuId:previewMenuId},location.origin);return()=>window.removeEventListener('message',send);},[JSON.stringify(candidate),previewMenuId,step]);
 const change=(key,value)=>{setDesign(d=>({...d,[key]:value,...(key==='primary'?{categoryActiveBackground:value}:{})}));};
 const colors={primary:design.primary||'#242628',background:design.background||'#ffffff',text:design.text||'#242628'};
 const propose=async(src,from)=>{const id=++extractId.current;try{const palette=await mwExtractFromImage(src);if(extractId.current===id)setProposal({...palette,from});}catch(_){/* immagine non leggibile: nessuna proposta */}};
 const upload=async(key,file)=>{setImageEdit({key,file});setUploadError('');};
 const fromSite=async()=>{
  const url=siteUrl.trim();if(!url||siteBusy)return;setSiteBusy(true);setSiteError('');
  try{const response=await fetch('/api/menu-workspace/brand-from-site',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(body?.error?.message||'Sito non raggiungibile');
   const data=body.data||{};const s=data.suggested||{};let fromLogo=null;if(data.logo?.dataUrl){try{fromLogo=await mwExtractFromImage(data.logo.dataUrl);}catch(_){}}
   const background=s.background||'#ffffff',primary=s.primary||fromLogo?.primary||'#111111';
   setProposal({from:'site',host:(()=>{try{return new URL(data.url).hostname;}catch(_){return url;}})(),primary,background,text:s.text&&mwContrast(s.text,background)>=4.5?s.text:mwReadableText(background,primary),swatches:[...new Set([data.themeColor,...(data.colors||[]),...(fromLogo?.swatches||[])].filter(Boolean))].slice(0,8),logo:data.logo?.dataUrl||null});}
  catch(e){setSiteError(e.message||'Sito non raggiungibile');}
  finally{setSiteBusy(false);}
 };
 const useSiteLogo=async()=>{if(!proposal?.logo)return;try{upload('logoUrl',await mwDataUrlToFile(proposal.logo,'logo-sito'));}catch(_){setUploadError('Logo del sito non utilizzabile');}};
 const analyze=async()=>{if(stale||busy)return;setError('');if(!source.trim()){setResult(null);setStep(2);return;}setBusy(true);const id=++requestId.current;try{const response=await adapter.previewImport({expectedRevision:document.revision,format:'text',source,menuId:target||undefined});if(requestId.current===id){setResult({...response.data,base:JSON.stringify(document)});setStep(2);}}catch(e){if(requestId.current===id)setError(e.message||'Impossibile analizzare il testo');}finally{if(requestId.current===id)setBusy(false);}};
 const baseChanged=!!result&&result.base!==JSON.stringify(document);
 const steps=['Identità visiva','Menu','Anteprima'];
 return <section className="mw-setup" aria-labelledby="mw-setup-title">
  <header className="mw-setup-head">
   <div><h3 id="mw-setup-title">Configura menu cliente</h3><p>La pagina cliente cambia solo quando salvi la bozza e la pubblichi.</p></div>
   <Btn kind="soft" size="sm" disabled={pending} onClick={()=>{if(!changed||window.confirm('Chiudere e scartare questa configurazione non applicata?'))onClose();}}>Chiudi</Btn>
  </header>
  <ol className="mw-steps" aria-label="Passi configurazione">{steps.map((label,i)=><li key={label} className={step===i?'active':step>i?'done':''} aria-current={step===i?'step':undefined}><span className="mw-step-n">{step>i?<Icon name="check" size={12} stroke={2.6}/>:i+1}</span>{label}</li>)}</ol>
  {error&&<SbError msg={error}/>}
  {stale&&<SbError msg="La bozza è cambiata. Chiudi e riapri la configurazione per usare la versione corrente."/>}
  {step===0&&<div className="mw-setup-body sb-enter" key="s0">
   <div className="mw-brand">
    <div className="mw-brand-media">
     <MwDropZone title="Trascina qui il logo" label="Logo" variant="logo" value={design.logoUrl} busy={uploading==='logoUrl'} disabled={stale||(!!uploading&&uploading!=='logoUrl')} onFile={file=>upload('logoUrl',file)} onRemove={()=>change('logoUrl',null)}/>
     <MwDropZone title="Trascina qui l’hero" label="Hero" variant="background" value={design.coverUrl} busy={uploading==='coverUrl'} disabled={stale||(!!uploading&&uploading!=='coverUrl')} onFile={file=>upload('coverUrl',file)} onRemove={()=>change('coverUrl',null)}/>
     <window.MenuWorkspaceBackground design={design} onChange={next=>setDesign(next)}/>
     {imageEdit&&<section><window.MenuWorkspaceImageUpload key={imageEdit.key+imageEdit.file.name} initialFile={imageEdit.file} purpose={imageEdit.key==='logoUrl'?'logo':'background'} assets={assets} adapter={adapter} onPending={(changed,pending)=>setImagePreparing(pending)} onUploaded={async asset=>{change(imageEdit.key,asset.url);if(imageEdit.key==='logoUrl')propose(asset.url,'logo');loadAssets();setImageEdit(null);}}/><Btn disabled={imagePreparing} kind="soft" onClick={()=>setImageEdit(null)}>Chiudi editor immagine</Btn></section>}{uploadError&&<SbError msg={uploadError}/> }
     <p className="mw-hint">Le immagini caricate finiscono nella libreria del locale.</p>
     {assets.length>0&&<details className="mw-library"><summary>Scegli dalla libreria <span>{assets.length}</span></summary><div className="mw-library-grid">{assets.map(a=><div className="mw-library-item" key={a.id}><img src={a.url} alt={a.name||'Immagine'}/><div><button type="button" className="press mw-chip" aria-label={`Usa ${a.name||'immagine'} come logo`} onClick={()=>{change('logoUrl',a.url);propose(a.url,'logo');}}>Logo</button><button type="button" className="press mw-chip" aria-label={`Usa ${a.name||'immagine'} come hero`} onClick={()=>change('coverUrl',a.url)}>Hero</button></div></div>)}</div></details>}
     {assetsError&&<p className="mw-hint">Libreria immagini non disponibile al momento: puoi comunque caricare un file.</p>}
    </div>
    <div className="mw-brand-colors">
     <div className="mw-panel">
      <div className="mw-panel-head"><h4>Colori</h4><MwContrast text={colors.text} background={colors.background}/></div>
      <div className="mw-swatches">{[['primary','Principale'],['background','Sfondo'],['text','Testo']].map(([key,label])=><MwSwatch key={key} label={label} value={colors[key]} onChange={v=>change(key,v)}/>)}</div>
      <div className="mw-sample" style={{background:colors.background,color:colors.text}}><b>Bruschetta</b><span>Pomodoro e basilico</span><i style={{background:colors.primary,color:mwReadableText(colors.primary)}}>6,00 €</i></div>
     </div>
     <div className="mw-panel">
      <h4>Ricava i colori</h4>
      <p className="mw-hint">Dal logo caricato, in automatico, oppure dal sito del locale.</p>
      <form className="mw-site" onSubmit={e=>{e.preventDefault();fromSite();}}><input type="text" inputMode="url" autoComplete="url" placeholder="www.ilmioristorante.it" value={siteUrl} onChange={e=>{setSiteUrl(e.target.value);setSiteError('');}} aria-label="Indirizzo del sito" disabled={stale}/><Btn kind="soft" size="sm" type="submit" disabled={!siteUrl.trim()||siteBusy||stale}><SwapText k={siteBusy?'b':'i'}>{siteBusy?<TakoLoading label="Analisi del menu…" variant="compact"/>:'Analizza sito'}</SwapText></Btn></form>
      {siteError&&<SbError msg={siteError}/>}
      {proposal&&<div className="mw-proposal sb-enter" key={proposal.from+proposal.primary+proposal.background}>
       <div className="mw-proposal-head">{proposal.logo&&<img src={proposal.logo} alt="Logo trovato sul sito"/>}<span>{proposal.from==='site'?`Dal sito ${proposal.host}`:'Dal logo'}</span></div>
       <div className="mw-proposal-row">{[['primary','Principale'],['background','Sfondo'],['text','Testo']].map(([key,label])=><label className="mw-proposal-swatch" key={key}><span style={{background:proposal[key]}}><input type="color" value={proposal[key]} aria-label={`Proposta ${label.toLowerCase()}`} onChange={e=>setProposal(p=>({...p,[key]:e.target.value}))}/></span>{label}</label>)}</div>
       {proposal.swatches?.length>0&&<div className="mw-found" aria-label="Altri colori trovati">{proposal.swatches.map(hex=><button type="button" key={hex} className="press" style={{background:hex}} title={`Usa ${hex} come principale`} aria-label={`Usa ${hex} come colore principale`} onClick={()=>setProposal(p=>({...p,primary:hex,text:mwContrast(p.text,p.background)>=4.5?p.text:mwReadableText(p.background,hex)}))}/>)}</div>}
       <MwContrast text={proposal.text} background={proposal.background}/>
       <div className="mw-actions"><Btn size="sm" onClick={()=>{change('primary',proposal.primary);change('background',proposal.background);change('text',proposal.text);}}>Usa questi colori</Btn>{proposal.logo&&!design.logoUrl&&<Btn size="sm" kind="soft" disabled={!!uploading} onClick={useSiteLogo}>Usa il logo del sito</Btn>}<Btn size="sm" kind="ghost" onClick={()=>setProposal(null)}>Scarta</Btn></div>
      </div>}
     </div>
    </div>
   </div>
   <footer className="mw-setup-foot"><span/><Btn disabled={pending||stale} onClick={()=>setStep(1)}>Continua al menu</Btn></footer>
  </div>}
  {step===1&&<div className="mw-setup-body sb-enter" key="s1">
   <label className="mw-field"><span>Dove importare</span><select disabled={busy} value={target} onChange={e=>{setTarget(e.target.value);setResult(null);}}><option value="">Crea o aggiorna “Menu importato”</option>{document.menus.map(m=><option key={m.id} value={m.id}>Aggiungi a {m.name}</option>)}</select></label>
   <p className="mw-hint" role="status">I piatti si aggiungono: se la destinazione esiste, il suo contenuto resta. Controlla i doppioni prima di applicare.</p>
   <label className="mw-field"><span>Testo del menu</span><textarea disabled={busy} rows={11} value={source} placeholder={MW_SETUP_EXAMPLE} aria-describedby="mw-setup-format" onChange={e=>{setSource(e.target.value);setResult(null);}}/></label>
   <div className="mw-help" id="mw-setup-format"><Icon name="info" size={16}/><div><b>Come scriverlo</b><ul><li><code># ANTIPASTI</code> apre una categoria</li><li><code>Bruschetta — 6,00 €</code> nome e prezzo</li><li>La riga sotto è la descrizione</li></ul><span>I casi ambigui vengono segnalati. Lascia vuoto per cambiare solo l’aspetto.</span></div></div>
   <footer className="mw-setup-foot"><Btn kind="soft" disabled={busy} onClick={()=>setStep(0)}>Indietro</Btn><Btn disabled={busy||stale} onClick={analyze}><SwapText k={busy?'b':'i'}>{busy?<TakoLoading label="Analisi del menu…" variant="compact"/>:'Genera anteprima'}</SwapText></Btn></footer>
  </div>}
  {step===2&&<div className="mw-setup-body sb-enter" key="s2">
   {result&&<div className="mw-result"><p role="status"><Icon name="check" size={14}/>{result.importedCount} {result.importedCount===1?'piatto importato':'piatti importati'} da verificare</p>{result.warnings?.length>0&&<ul className="mw-warnings">{result.warnings.map((w,i)=><li key={i}><Icon name="alert" size={13}/>{typeof w==='string'?w:JSON.stringify(w)}</li>)}</ul>}</div>}
   <div className="mw-setup-preview">{previewMenuId?<iframe ref={frame} title="Anteprima configurazione menu cliente" src={`/menu-preview/${previewMenuId}`} onLoad={e=>e.currentTarget.contentWindow?.postMessage({type:'tako-menu-preview',document:candidate,menuId:previewMenuId},location.origin)}/>:<p className="mw-hint">Nessun menu presente: incolla i piatti nel passaggio precedente.</p>}</div>
   <p className="mw-hint">Anteprima in sola lettura. Dopo l’applicazione modifichi categorie, piatti e prezzi nell’editor; per il PDF salva prima la bozza, poi pubblica per aggiornare il menu online.</p>
   <footer className="mw-setup-foot"><Btn kind="soft" onClick={()=>setStep(1)}>Modifica</Btn><div className="mw-actions"><Btn kind="soft" disabled={busy||stale||baseChanged} onClick={()=>{if(stale||baseChanged)return;onApply(candidate,previewMenuId,{openPdf:true});}}>Applica e prepara PDF</Btn><Btn disabled={busy||stale||baseChanged} onClick={()=>{if(stale||baseChanged){setError('La bozza è cambiata: genera una nuova anteprima.');return;}onApply(candidate,previewMenuId);}}>Applica alla bozza</Btn></div></footer>
  </div>}
 </section>;
}
