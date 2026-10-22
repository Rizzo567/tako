/* Dashboard editor 22/10 — campi del Piatto per il pannello della matita (D8).
   Riusa i componenti della vecchia scheda «Modifica piatto» (MenuWorkspaceSchema, MenuWorkspaceSales, MenuWorkspaceCatalogs,
   MenuWorkspacePhotoZone, MenuWorkspaceVariants, MenuWorkspaceSchedule) senza toccarne il ramo originale (flag spento = identico).
   Niente «Salva»: ogni campo si conferma (Invio o uscita dal campo) e diventa una op set; caselle, scelte e pulsanti confermano subito.
   I campi di testo restano locali mentre si scrive, così un aggiornamento del server non cancella ciò che si sta digitando. */
const MW_ED_TEXTLIKE=el=>!!el&&(el.tagName==='TEXTAREA'||(el.tagName==='INPUT'&&!['checkbox','radio','button','submit','file','range','color'].includes((el.type||'text').toLowerCase())));
/* Campi strutturati: restano LOCALI finché non sono validi per il server (stesse regole di menu-workspace-contract.ts),
   così «Aggiungi variante» o un intervallo senza giorni non partono come op destinate al rifiuto. */
const MW_ED_NUM=(v,min,max,int)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max&&(!int||Number.isInteger(v));
const MW_ED_DATE=v=>v==null||/^\d{4}-\d{2}-\d{2}$/.test(v);
const MW_ED_TIME=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v||''));
const MW_ED_ZONE=v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}};
const MW_ED_VALID={
 name:v=>typeof v==='string'&&!!v.trim(),
 price:v=>MW_ED_NUM(v,0,100000),
 costPrice:v=>v==null||MW_ED_NUM(v,0,Infinity),
 calories:v=>v==null||MW_ED_NUM(v,0,Infinity,true),
 prepTimeMinutes:v=>MW_ED_NUM(v,0,1440,true),
 externalLink:v=>v==null||(typeof v==='string'&&/^https:\/\/[^\s/]+\.[^\s]+/.test(v.trim())),
 variants:v=>Array.isArray(v)&&v.length<=100&&v.every(x=>x&&typeof x.name==='string'&&!!x.name.trim()&&x.name.length<=200&&MW_ED_NUM(x.priceModifier,-100000,100000)),
 schedule:v=>v==null||(!!v&&MW_ED_ZONE(v.timezone||'Europe/Rome')&&MW_ED_DATE(v.from)&&MW_ED_DATE(v.until)&&(!v.from||!v.until||v.from<=v.until)&&Array.isArray(v.windows)&&v.windows.length<=30&&v.windows.every(w=>Array.isArray(w.weekdays)&&w.weekdays.length>0&&MW_ED_TIME(w.start)&&MW_ED_TIME(w.end))),
 promo:v=>v==null||(MW_ED_NUM(v.price,0,100000)&&v.price>0&&MW_ED_DATE(v.until))
};
/* Normalizzazione prima dell'invio: link vuoto = nessun link. */
const MW_ED_CLEAN={externalLink:v=>typeof v==='string'&&!v.trim()?null:typeof v==='string'?v.trim():v};
function MW_USE_BUFFER(entity,keys,onCommit){
 const [edits,setEdits]=useState({}),editsRef=useRef({}),idRef=useRef(entity?.id);
 if(idRef.current!==entity?.id){idRef.current=entity?.id;editsRef.current={};}
 const value={...(entity||{}),...editsRef.current};
 // final=true (chiusura del pannello): ciò che non è valido non può partire e si lascia; altrimenti resta locale finché non lo è.
 const commit=useCallback((final)=>{const pending={...editsRef.current};if(!Object.keys(pending).length)return;
  Object.keys(MW_ED_CLEAN).forEach(k=>{if(k in pending)pending[k]=MW_ED_CLEAN[k](pending[k]);});
  const fields=window.TakoMenuEditorCore.changedFields(entity,{...entity,...pending},Object.keys(pending).filter(k=>keys.includes(k)));
  const held={};
  if(fields.name!==undefined&&!String(fields.name||'').trim()){delete fields.name;toast('Il nome non può essere vuoto',{type:'warn'});}
  Object.keys(fields).forEach(k=>{if(k!=='name'&&MW_ED_VALID[k]&&!MW_ED_VALID[k](fields[k])){held[k]=editsRef.current[k];delete fields[k];}});
  editsRef.current=final===true?{}:held;setEdits(editsRef.current);
  if(final===true&&Object.keys(held).length)toast('Campi incompleti non salvati',{type:'warn'});
  if(Object.keys(fields).length)onCommit(fields);},[entity,keys,onCommit]);
 const later=useRef(false),source=useRef(null);
 const change=useCallback(next=>{const diff={};Object.keys(next).forEach(k=>{if(keys.includes(k)&&next[k]!==value[k])diff[k]=next[k];});if(!Object.keys(diff).length)return;
  editsRef.current={...editsRef.current,...diff};setEdits(editsRef.current);
  // Testo in digitazione → si conferma all'uscita/Invio; tutto il resto (casella, scelta, pulsante) subito.
  // Si guarda l'elemento dell'evento (Safari non dà il fuoco a caselle e pulsanti al clic).
  const from=source.current||window.document.activeElement;if(!MW_ED_TEXTLIKE(from)){later.current=true;}},[value,keys]);
 useEffect(()=>{if(later.current){later.current=false;commit();}});
 const bind={onChangeCapture:e=>{source.current=e.target;},onClickCapture:e=>{source.current=e.target;},onBlur:e=>{if(window.__mwEdMoving)return;if(MW_ED_TEXTLIKE(e.target))commit();},onKeyDown:e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'&&MW_ED_TEXTLIKE(e.target)){e.preventDefault();commit();}}};
 // Chiusura del pannello: ciò che è scritto non si perde.
 const commitRef=useRef(commit);commitRef.current=commit;useEffect(()=>()=>commitRef.current(true),[]);
 return {value,change,commit,bind,dirty:Object.keys(edits).length>0};
}
function MW_ED_PRICE({value,onChange,label='Prezzo (€)'}){
 const shown=p=>p?String(p).replace('.',','):'',[text,setText]=useState(shown(value)),[error,setError]=useState('');
 useEffect(()=>{if(!MW_ED_TEXTLIKE(window.document.activeElement)||window.document.activeElement?.dataset?.edPrice!=='1')setText(shown(value));},[value]);
 const commit=()=>{const next=String(text).trim()===''?0:window.TakoMenuDaily.price(text);if(next===null){setError('Inserisci un prezzo da 0 a 100.000 con massimo due decimali');return;}setError('');if(next!==value)onChange(next);};
 return <label className="mw-field"><span>{label}</span><input data-ed-price="1" inputMode="decimal" placeholder="0,00" value={text} aria-invalid={!!error} onChange={e=>{setText(e.target.value);setError('');}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit();}}}/>{error&&<small role="alert">{error}</small>}</label>;
}
const MW_ED_ITEM_KEYS=['name','description','price','imageUrl','allergens','tags','additives','available','hidden','featured','displayMode','externalLink','priceDisplay','promo','scarcity','schedule','variants','costPrice','calories','kitchenStation','prepTimeMinutes'];
function MenuWorkspaceItemForm({adapter,item,fixed,disabled,onCommit,photo,onDelete}){
 const keys=(window.TakoMenuOps?.FIELD_WHITELIST?.item)||MW_ED_ITEM_KEYS;
 const buf=MW_USE_BUFFER(item,keys,onCommit),v=buf.value;
 const [gallery,setGallery]=useState(false);
 const set=(key,value)=>buf.change({[key]:value});
 const main=(adapter.itemFields||[]).filter(f=>['name','description'].includes(f.key));
 const advanced=(adapter.itemFields||[]).filter(f=>['featured','displayMode','externalLink','priceDisplay','costPrice'].includes(f.key));
 return <div className="mw-ed-form" {...buf.bind}>
  <MenuWorkspaceSchema fields={main} value={v} onChange={next=>buf.change(next)}/>
  {!fixed&&<MW_ED_PRICE value={v.price} onChange={p=>{set('price',p);setTimeout(buf.commit,0);}}/>}
  {photo&&<section className="mw-photo-section"><h4>Foto</h4><MenuWorkspacePhotoZone item={v} job={photo.job} disabled={disabled} onPick={photo.onPick} onDropFile={photo.onDropFile} onCancel={photo.onCancel} onRemove={()=>set('imageUrl',null)}/>
   <div className="mw-actions"><Btn kind="ghost" size="sm" aria-expanded={gallery} onClick={()=>setGallery(x=>!x)}>{gallery?'Chiudi galleria':'Scegli dalla galleria'}</Btn></div>
   {gallery&&window.MenuWorkspaceGallery&&<window.MenuWorkspaceGallery onPending={()=>{}} currentUrl={v.imageUrl} adapter={adapter} onPick={asset=>{set('imageUrl',asset.url);setGallery(false);}}/>}</section>}
  {window.MenuWorkspaceSales&&<window.MenuWorkspaceSales item={v} fixed={fixed} disabled={disabled} onChange={(key,value)=>set(key,value)}/>}
  {/* 22/10 sera: un piatto non si nasconde più (o c'è, o si elimina). Resta solo la disponibilità del giorno. */}
  <fieldset className="mw-ed-visibility"><legend>Disponibilità</legend>
   <label className="mw-check"><input type="checkbox" checked={v.available===false} disabled={disabled} onChange={e=>set('available',!e.target.checked)}/>Esaurito</label>
  </fieldset>
  <details className="mw-inspector-group"><summary>Allergeni</summary><MenuWorkspaceCatalogs only="allergens" adapter={adapter} item={v} onChange={(key,value)=>set(key,value)}/></details>
  <details className="mw-daily-advanced"><summary>Altre opzioni</summary>
   <MenuWorkspaceSchema fields={advanced} value={v} onChange={next=>buf.change(next)}/>
   <MenuWorkspaceVariants variants={v.variants||[]} onChange={variants=>set('variants',variants)}/>
   <MenuWorkspaceSchedule value={v.schedule} onChange={s=>set('schedule',s)}/>
  </details>
  {onDelete&&<div className="mw-item-delete"><Btn size="sm" kind="ghost" disabled={disabled} onClick={onDelete}>Elimina piatto</Btn></div>}
 </div>;
}
/* Menu, Sottomenu, Sezione: nome, visibile/nascosto, Elimina (D8). Il Menu ha anche Alla carta / Prezzo fisso col pannello esistente. */
function MenuEditorLevelForm({kind,entity,menu,disabled,onCommit,onDelete,onFixedMutate,label}){
 const keys=kind==='menu'?['name','description','type','active']:['name','description','active'];
 const buf=MW_USE_BUFFER(entity,keys,onCommit),v=buf.value;
 const fixed=kind==='menu'&&menu?.pricing==='fisso';
 return <div className="mw-ed-form" {...buf.bind}>
  <MenuWorkspaceField label={'Nome '+(kind==='menu'?'del menu':kind==='root'?'del sottomenu':'della sezione')} value={v.name} onChange={name=>buf.change({name})}/>
  {/* 22/10 sera: tolta «Avanzate», la descrizione (prima solo lì) sta nella matita. */}
  <MenuWorkspaceField label={'Descrizione '+(kind==='menu'?'del menu':kind==='root'?'del sottomenu':'della sezione')} value={v.description||''} onChange={description=>buf.change({description:description||null})}/>
  {kind==='menu'&&<label className="mw-field"><span>Tipo di menu</span><select value={v.type||'main'} disabled={disabled} onChange={e=>buf.change({type:e.target.value})}>{[['main','Principale'],['lunch','Pranzo'],['dinner','Cena'],['seasonal','Stagionale'],['event','Evento'],['drinks','Bevande']].map(([t,l])=><option key={t} value={t}>{l}</option>)}</select></label>}
  <label className="mw-check mw-ed-toggle"><input type="checkbox" role="switch" checked={v.active!==false} disabled={disabled} onChange={e=>buf.change({active:e.target.checked})}/>{v.active!==false?'Visibile ai clienti':'Nascosto ai clienti'}</label>
  {kind==='menu'&&!fixed&&window.MenuPricingChoice&&<window.MenuPricingChoice value={menu.pricing} disabled={disabled} showNote={false} onChange={mode=>onFixedMutate(d=>window.TakoMenuFixed.setPricing(d.menus.find(m=>m.id===menu.id),mode))}/>}
  {fixed&&window.MenuFixedPricePanel&&<window.MenuFixedPricePanel menu={menu} mutate={onFixedMutate} disabled={disabled} onPreview={()=>{}}/>}
  <div className="mw-item-delete"><Btn size="sm" kind="ghost" disabled={disabled} onClick={onDelete}>{'Elimina '+label}</Btn></div>
 </div>;
}
Object.assign(window,{MenuWorkspaceItemForm,MenuEditorLevelForm});
