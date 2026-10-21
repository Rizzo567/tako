/* Menu «a prezzo fisso» nella dashboard (21/10/2026, CONTRATTO docs/webapp/menu-prezzo-fisso-2026-10-21 §1, §3, §6).
   Logica pura in window.TakoMenuFixed (testata in tests/web/menu-fixed-price.test.mjs); componenti agganciati in 13-menu-workspace.js:
   scelta Alla carta/Prezzo fisso, opzioni di prezzo (nome, prezzo, nota, Sottomenu compresi), «Compreso», «Sostituisci i piatti».
   Regole: i prezzi dei piatti NON si toccano mai (restano salvati e nascosti); i piatti tolti da una lista si NASCONDONO, mai eliminati.
   Movimento: nessuna animazione decorativa; solo stati reali. Testi brevi, «Sottomenu» (mai «categoria» nei testi nuovi). */

const MW_FIXED_NORM=v=>String(v||'').toLocaleLowerCase('it').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’`]/g,"'").replace(/\s+/g,' ').trim();
const MW_FIXED_PRICE=value=>{const text=String(value??'').trim().replace('€','').trim().replace(',','.');if(!/^\d+(?:\.\d{1,2})?$/.test(text))return null;const n=Number(text);return Number.isFinite(n)&&n<=100000?n:null;};
const MW_FIXED_EURO=n=>new Intl.NumberFormat('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0)+' €';
const MW_FIXED_TEXT=n=>n==null||n===''?'':String(Number(n).toFixed(2)).replace('.',',');
const TakoMenuFixed={
 isFixed:menu=>menu?.pricing==='fisso',
 /** Cambia solo menu.pricing: prezzi dei piatti e opzioni restano nel documento (le opzioni con «carta» non si mostrano). */
 setPricing(menu,mode){if(!menu||!['carta','fisso'].includes(mode))return false;menu.pricing=mode;if(mode==='fisso'&&!Array.isArray(menu.formulas))menu.formulas=[];return true;},
 addFormula(menu,id,name='Nuova opzione'){if(!menu)return null;if(!Array.isArray(menu.formulas))menu.formulas=[];if(menu.formulas.length>=12)return null;const f={id,name,price:0,note:null,translations:{}};menu.formulas.push(f);return f;},
 updateFormula(menu,id,patch){const f=menu?.formulas?.find(x=>x.id===id);if(!f)return false;
  if('name' in patch)f.name=String(patch.name).slice(0,120);
  if('price' in patch){const p=typeof patch.price==='number'?patch.price:MW_FIXED_PRICE(patch.price);if(p===null||p<0||p>100000)return false;f.price=p;}
  if('note' in patch){const t=String(patch.note??'').slice(0,300);f.note=t.trim()?t:null;}
  return true;},
 moveFormula(menu,id,delta){const a=menu?.formulas||[],i=a.findIndex(x=>x.id===id),j=i+delta;if(i<0||j<0||j>=a.length)return false;[a[i],a[j]]=[a[j],a[i]];return true;},
 removeFormula(menu,id){const a=menu?.formulas||[],n=a.length;menu.formulas=a.filter(x=>x.id!==id);return menu.formulas.length<n;},
 /** Sottomenu compresi: nessuno scelto = «tutto il menu» (chiave assente, come i documenti senza sectionIds). */
 toggleSection(menu,formulaId,sectionId){const f=menu?.formulas?.find(x=>x.id===formulaId);if(!f||!menu.sections.some(s=>s.id===sectionId))return false;
  const set=new Set(f.sectionIds||[]);set.has(sectionId)?set.delete(sectionId):set.add(sectionId);
  const ordered=menu.sections.map(s=>s.id).filter(id=>set.has(id));if(ordered.length)f.sectionIds=ordered;else delete f.sectionIds;return true;},
 setIncluded(menu,text){const t=String(text??'').slice(0,300);menu.included=t.trim()?t:null;},
 /** Una riga = un piatto. Toglie elenchi puntati/numerati e doppioni (stesso nome normalizzato). */
 parseList(text){const seen=new Set(),out=[];for(const raw of String(text||'').split(/\r?\n/)){const name=raw.replace(/^\s*(?:[-–—•·*]+|\d{1,2}[.)])\s*/,'').replace(/\s+/g,' ').trim().slice(0,300);const key=MW_FIXED_NORM(name);if(!key||seen.has(key))continue;seen.add(key);out.push(name);}return out;},
 /** Riepilogo prima di salvare: chi resta (stesso nome → stessi dati), chi è nuovo, chi si nasconde. */
 planReplace(section,names){const items=section?.items||[],byName=new Map();for(const it of items){const k=MW_FIXED_NORM(it.name);if(!byName.has(k))byName.set(k,it);}
  const keep=[],add=[],used=new Set();for(const name of names){const it=byName.get(MW_FIXED_NORM(name));if(it&&!used.has(it.id)){used.add(it.id);keep.push({item:it,name,wasHidden:!!it.hidden||it.available===false});}else if(!it)add.push(name);}
  const hide=items.filter(it=>!used.has(it.id));return {keep,add,hide};},
 /** Applica: nell'ordine della lista; chi resta torna visibile coi suoi dati (descrizione, foto, allergeni, prezzo salvato); nuovi con newItem; gli altri nascosti in fondo. */
 applyReplace(menu,sectionId,names,newItem){const section=menu?.sections?.find(s=>s.id===sectionId);if(!section||!names.length)return null;const plan=TakoMenuFixed.planReplace(section,names),byId=new Map(plan.keep.map(k=>[MW_FIXED_NORM(k.name),k.item]));
  const listed=[];for(const name of names){const kept=byId.get(MW_FIXED_NORM(name));if(kept){if(!listed.includes(kept)){kept.hidden=false;kept.available=true;listed.push(kept);}continue;}const item=newItem(name);if(TakoMenuFixed.isFixed(menu))item.price=0;listed.push(item);}
  const hidden=plan.hide.map(it=>{it.hidden=true;return it;});section.items=[...listed,...hidden];return plan;},
 euro:MW_FIXED_EURO,price:MW_FIXED_PRICE,norm:MW_FIXED_NORM
};
window.TakoMenuFixed=TakoMenuFixed;

/* Scelta Alla carta / Prezzo fisso: due pulsanti (radio), frecce per cambiare. La riga sui prezzi conservati compare col fisso. */
function MenuPricingChoice({value,onChange,disabled,showNote=true,label='Prezzi del menu'}){
 const opts=[['carta','Alla carta'],['fisso','Prezzo fisso']],refs=useRef({});const current=value==='fisso'?'fisso':'carta';
 const key=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const next=current==='fisso'?'carta':'fisso';onChange(next);setTimeout(()=>refs.current[next]?.focus(),0);};
 return <div className="mw-pricing"><div className="mw-pricing-choice" role="radiogroup" aria-label={label} onKeyDown={key}>{opts.map(([id,text])=><button key={id} ref={el=>{refs.current[id]=el;}} type="button" role="radio" aria-checked={current===id} tabIndex={current===id?0:-1} disabled={disabled} className="mw-pill" onClick={()=>current!==id&&onChange(id)}>{text}</button>)}</div>
  {showNote&&current==='fisso'&&<p className="mw-pricing-note" data-mw-prices-kept>I prezzi dei piatti restano salvati: tornano se rimetti Alla carta.</p>}</div>;
}
window.MenuPricingChoice=MenuPricingChoice;

/* Campo prezzo di un'opzione: testo libero («12,50»), scritto nella bozza solo se valido; Esc ripristina. */
function MenuFixedPriceInput({value,label,onCommit}){
 const [text,setText]=useState(MW_FIXED_TEXT(value)),[error,setError]=useState(false);useEffect(()=>{setText(MW_FIXED_TEXT(value));setError(false);},[value]);
 const commit=()=>{const p=MW_FIXED_PRICE(text);if(p===null){setError(true);return;}setError(false);if(p!==value)onCommit(p);else setText(MW_FIXED_TEXT(value));};
 return <label className="mw-field mw-fixed-price"><span>Prezzo (€)</span><input inputMode="decimal" aria-label={label} aria-invalid={error} placeholder="0,00" value={text} onChange={e=>{setText(e.target.value);setError(false);}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit();}if(e.key==='Escape'&&text!==MW_FIXED_TEXT(value)){e.stopPropagation();setText(MW_FIXED_TEXT(value));setError(false);}}}/>{error&&<small role="alert">Prezzo non valido</small>}</label>;
}

/* Pannello del menu fisso, in cima ai piatti: opzioni (aggiungi, modifica, riordina, togli), Sottomenu compresi, «Compreso», anteprima. */
function MenuFixedPricePanel({menu,mutate,onPreview,disabled}){
 const formulas=menu.formulas||[],sections=menu.sections||[],focusNext=useRef(null),host=useRef(null);
 const edit=fn=>mutate(d=>{const m=d.menus.find(x=>x.id===menu.id);if(m)fn(m);});
 useEffect(()=>{const t=focusNext.current;if(!t)return;focusNext.current=null;const el=t.split(' || ').map(x=>host.current?.querySelector(x)).find(Boolean);el?.focus();if(el?.select)el.select();});
 const add=()=>{const id=crypto.randomUUID();edit(m=>TakoMenuFixed.addFormula(m,id,'Opzione '+((m.formulas||[]).length+1)));focusNext.current=`[data-formula="${id}"] input[data-f="name"]`;};
 const move=(f,delta,dir)=>{edit(m=>TakoMenuFixed.moveFormula(m,f.id,delta));focusNext.current=`[data-formula="${f.id}"] [data-move="${dir}"]:not(:disabled) || [data-formula="${f.id}"] [data-move]:not(:disabled)`;};
 const remove=(f,i)=>{const prev=formulas[i-1]||formulas[i+1];edit(m=>TakoMenuFixed.removeFormula(m,f.id));focusNext.current=prev?`[data-formula="${prev.id}"] input[data-f="name"]`:'[data-fixed-add]';};
 const parent=s=>s.parentSectionId?(sections.find(x=>x.id===s.parentSectionId)?.name||'')+' › ':'';
 return <Card className="mw-fixed" aria-labelledby={'mw-fixed-title-'+menu.id}><div ref={host}>
  <div className="mw-fixed-head"><h3 id={'mw-fixed-title-'+menu.id}>Prezzo fisso</h3><MenuPricingChoice value={menu.pricing} disabled={disabled} showNote={false} onChange={mode=>edit(m=>TakoMenuFixed.setPricing(m,mode))}/></div>
  <p className="mw-pricing-note" data-mw-prices-kept>I prezzi dei piatti restano salvati: tornano se rimetti Alla carta.</p>
  {!formulas.length?<div className="mw-fixed-empty"><p>Il cliente vede il prezzo del menu, non dei piatti.</p><button type="button" data-fixed-add className="mw-pill mw-pill-dark" disabled={disabled} onClick={add}>Aggiungi la prima opzione di prezzo</button></div>:<>
  <ol className="mw-fixed-list">{formulas.map((f,i)=>{const chosen=new Set(f.sectionIds||[]);return <li key={f.id} className="mw-fixed-row" data-formula={f.id}>
   <div className="mw-fixed-main"><label className="mw-field"><span>Nome</span><input data-f="name" aria-label={'Nome opzione '+(i+1)} maxLength={120} placeholder="Completo" value={f.name} disabled={disabled} onChange={e=>{const v=e.target.value;edit(m=>TakoMenuFixed.updateFormula(m,f.id,{name:v}));}} onBlur={e=>{if(!e.target.value.trim())edit(m=>TakoMenuFixed.updateFormula(m,f.id,{name:'Opzione '+(i+1)}));}}/></label>
    <MenuFixedPriceInput value={f.price} label={'Prezzo '+(f.name||'opzione')} onCommit={p=>edit(m=>TakoMenuFixed.updateFormula(m,f.id,{price:p}))}/></div>
   <label className="mw-field"><span>Nota</span><input data-f="note" aria-label={'Nota '+(f.name||'opzione')} maxLength={300} placeholder="Facoltativa" value={f.note||''} disabled={disabled} onChange={e=>{const v=e.target.value;edit(m=>TakoMenuFixed.updateFormula(m,f.id,{note:v}));}}/></label>
   {sections.length>0&&<div className="mw-fixed-chips" role="group" aria-label={'Sottomenu compresi in '+(f.name||'opzione')}><span className="mw-fixed-chips-label">Comprende</span>{sections.map(s=><button key={s.id} type="button" className="mw-chip" aria-pressed={chosen.has(s.id)} disabled={disabled} onClick={()=>edit(m=>TakoMenuFixed.toggleSection(m,f.id,s.id))}>{parent(s)}{s.name}</button>)}{!chosen.size&&<small className="mw-fixed-all">Tutto il menu</small>}</div>}
   <div className="mw-fixed-row-actions"><button type="button" className="mw-icon-pill" data-move="up" aria-label={'Sposta su '+(f.name||'opzione')} disabled={disabled||i===0} onClick={()=>move(f,-1,'up')}>↑</button><button type="button" className="mw-icon-pill" data-move="down" aria-label={'Sposta giù '+(f.name||'opzione')} disabled={disabled||i===formulas.length-1} onClick={()=>move(f,1,'down')}>↓</button><button type="button" className="mw-pill mw-fixed-remove" aria-label={'Togli '+(f.name||'opzione')} disabled={disabled} onClick={()=>remove(f,i)}>Togli</button></div>
  </li>;})}</ol>
  {formulas.length<12&&<button type="button" data-fixed-add className="mw-pill" disabled={disabled} onClick={add}>Aggiungi opzione</button>}</>}
  <label className="mw-field mw-fixed-included"><span>Compreso</span><input aria-label="Compreso nel prezzo" maxLength={300} placeholder="¼ di vino oppure ½ l d’acqua + caffè" value={menu.included||''} disabled={disabled} onChange={e=>{const v=e.target.value;edit(m=>TakoMenuFixed.setIncluded(m,v));}}/></label>
  {onPreview&&<div className="mw-fixed-foot"><button type="button" className="mw-pill" onClick={onPreview}>Anteprima cliente</button></div>}
 </div></Card>;
}
window.MenuFixedPricePanel=MenuFixedPricePanel;

/* «Sostituisci i piatti» di un Sottomenu: incolla → riepilogo → conferma nella bozza (poi «Salva» del riquadro). */
function MenuReplaceItems({menu,section,mutate,adapter,disabled}){
 const [step,setStep]=useState(''),[text,setText]=useState(''),[plan,setPlan]=useState(null),trigger=useRef(null),area=useRef(null),ok=useRef(null);
 useEffect(()=>{setStep('');setText('');setPlan(null);},[section.id]);
 useEffect(()=>{if(step==='paste')area.current?.focus();if(step==='review')ok.current?.focus();},[step]);
 const names=TakoMenuFixed.parseList(text);
 const close=()=>{setStep('');setPlan(null);setTimeout(()=>trigger.current?.focus(),0);};
 const review=()=>{setPlan(TakoMenuFixed.planReplace(section,names));setStep('review');};
 const apply=()=>{mutate(d=>{const m=d.menus.find(x=>x.id===menu.id);TakoMenuFixed.applyReplace(m,section.id,names,name=>adapter.newItem(crypto.randomUUID(),name));});toast(`Piatti sostituiti in «${section.name}»: premi Salva`,{type:'success'});setText('');close();};
 const esc=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();step==='review'?setStep('paste'):close();}};
 if(!step)return <section className="mw-replace"><button ref={trigger} type="button" className="mw-pill" disabled={disabled} onClick={()=>setStep('paste')}>Sostituisci i piatti</button></section>;
 return <section className="mw-replace is-open" aria-label={'Sostituisci i piatti di '+section.name} onKeyDown={esc}>
  {step==='paste'?<><label className="mw-field"><span>Incolla la lista · una riga = un piatto</span><textarea ref={area} rows={7} value={text} placeholder={'Pasta al pomodoro\nRisotto ai funghi\nLasagna'} onChange={e=>setText(e.target.value)}/></label>
   <p className="mw-replace-hint">Stesso nome: restano foto, descrizione e allergeni. Chi non è in lista si nasconde, non si elimina.</p>
   <div className="mw-actions"><button type="button" className="mw-pill mw-pill-dark" disabled={!names.length} onClick={review}>Controlla {names.length?`(${names.length})`:''}</button><button type="button" className="mw-pill" onClick={close}>Annulla</button></div></>
  :<><h4 className="mw-replace-title">Riepilogo</h4>
   <dl className="mw-replace-summary">
    <div><dt>Restano <b>{plan.keep.length}</b></dt><dd>{plan.keep.length?plan.keep.map(k=><span key={k.item.id}>{k.item.name}{k.wasHidden?<small> · torna visibile</small>:null}</span>):<small>Nessuno</small>}</dd></div>
    <div><dt>Nuovi <b>{plan.add.length}</b></dt><dd>{plan.add.length?plan.add.map(n=><span key={n}>{n}</span>):<small>Nessuno</small>}</dd></div>
    <div><dt>Nascosti, non eliminati <b>{plan.hide.length}</b></dt><dd>{plan.hide.length?plan.hide.map(it=><span key={it.id}>{it.name}</span>):<small>Nessuno</small>}</dd></div>
   </dl>
   <div className="mw-actions"><button ref={ok} type="button" className="mw-pill mw-pill-dark" onClick={apply}>Conferma</button><button type="button" className="mw-pill" onClick={()=>setStep('paste')}>Modifica lista</button></div></>}
 </section>;
}
window.MenuReplaceItems=MenuReplaceItems;
