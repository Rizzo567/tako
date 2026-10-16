/* ───────────────── Locale attivo: selettore in sidebar + gestione locali e accessi ───────────────── */
function useWebLocations(eager=true) {
 const [locations,setLocations]=React.useState([]),[current,setCurrent]=React.useState(window.__takoRestaurantId||'');
 const refresh=async()=>{const result=await fetch('/api/web-locations/',{credentials:'include'});if(!result.ok)throw new Error('Locali non disponibili');const response=await result.json();setLocations(response.data||response);setCurrent(response.currentId||'');};
 React.useEffect(()=>{if(eager)refresh().catch(()=>{});},[eager]);
 return {locations,current,refresh};
}
function locationInitials(name){return String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0].toUpperCase()).join('')||'·';}

function TakoLocationSwitcher({role}) {
 const {locations,current,refresh}=useWebLocations(false);
 const [open,setOpen]=React.useState(false),[manage,setManage]=React.useState(false),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 const ref=React.useRef(null);
 React.useEffect(()=>{if(!open)return;const close=event=>{if(ref.current&&!ref.current.contains(event.target))setOpen(false);};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close);},[open]);
 const active=locations.find(location=>location.id===current);
 const name=active?.name||RESTAURANT.name||'';
 if(!name)return null;
 React.useEffect(()=>{if(open&&!locations.length)refresh().catch(e=>setError(e.message))},[open]);
 const own=active?.role==='owner'||role==='owner';
 const canOpen=locations.length>1||own||!locations.length;
 const switchTo=async(restaurantId)=>{if(restaurantId===current){setOpen(false);return;}if(window.__takoMenuLeaveGuard&&!window.__takoMenuLeaveGuard())return;setBusy(true);setError('');try{await TakoAPI.post('/web-locations/switch',{restaurantId});if(window.takoSwitchSession)await window.takoSwitchSession();else window.location.reload();}catch(exception){setError(exception.message||'Cambio locale non riuscito.');setBusy(false);}};
 const row={width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 10px',borderRadius:8,fontSize:14,fontWeight:600,color:'var(--side-ink)',background:'transparent',textAlign:'left'};
 return <div ref={ref} style={{position:'relative'}}>
  <button type="button" className="press" aria-label="Locale attivo" aria-haspopup={canOpen?'listbox':undefined} aria-expanded={canOpen?open:undefined} disabled={busy||!canOpen} onClick={()=>setOpen(value=>!value)}
   style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 11px',borderRadius:10,border:'1px solid var(--side-line)',background:open?'var(--side-2)':'rgba(255,255,255,.55)',color:'var(--side-ink)',cursor:canOpen?'pointer':'default'}}>
   <span aria-hidden="true" style={{flex:'none',width:24,height:24,borderRadius:'50%',display:'grid',placeItems:'center',background:'var(--brand)',color:'var(--on-brand)',fontSize:10.5,fontWeight:800}}>{locationInitials(name)}</span>
   <span style={{flex:1,minWidth:0,textAlign:'left',fontSize:14,fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{name}</span>
   {canOpen&&<Icon name="chevD" size={16} style={{flex:'none',color:'var(--side-ink-2)',transform:open?'rotate(180deg)':'none',transition:'transform .18s'}}/>}
  </button>
  {error&&<p role="alert" style={{fontSize:12,color:'var(--danger)',margin:'6px 4px 0'}}>{error}</p>}
  {open&&<div role="listbox" aria-label="Locali" className="pop-in" style={{position:'absolute',top:'calc(100% + 6px)',left:0,right:0,zIndex:30,background:'var(--raised)',border:'1px solid var(--hairline)',borderRadius:10,boxShadow:'var(--sh-3)',padding:6}}>
   {!locations.length&&<div style={{display:"flex",justifyContent:"center",padding:12}}><TakoLoading variant="compact"/></div>}
   {locations.map(location=><button key={location.id} type="button" role="option" aria-selected={location.id===current} className="press nav-item" disabled={busy} onClick={()=>switchTo(location.id)} style={row}>
    <span aria-hidden="true" style={{flex:'none',width:22,height:22,borderRadius:'50%',display:'grid',placeItems:'center',background:'var(--sunken)',color:'var(--ink-2)',fontSize:10,fontWeight:800}}>{locationInitials(location.name)}</span>
    <span style={{flex:1,minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{location.name}</span>
    {location.id===current&&<Icon name="check" size={16} style={{flex:'none'}}/>}
   </button>)}
   {own&&<><div style={{height:1,background:'var(--hairline)',margin:'5px 6px'}}/>
   <button type="button" className="press nav-item" onClick={()=>{setOpen(false);setManage(true);}} style={row}><Icon name="settings" size={16} style={{flex:'none'}}/>Gestisci locali e accessi</button></>}
  </div>}
  <TakoLocationsManage open={manage} onClose={()=>setManage(false)} refresh={refresh}/>
 </div>;
}

function TakoLocationsManage({open,onClose,refresh}) {
 const [members,setMembers]=React.useState([]),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 const [name,setName]=React.useState(''),[slug,setSlug]=React.useState(''),[email,setEmail]=React.useState('');
 const loadMembers=async()=>{const response=await TakoAPI.get('/web-locations/members');setMembers(response.data||response);};
 React.useEffect(()=>{if(open)loadMembers().catch(exception=>setError(exception.message||'Accessi non disponibili.'));},[open]);
 const action=async(run)=>{setBusy(true);setError('');try{await run();}catch(exception){setError(exception.message||'Operazione non riuscita.');}finally{setBusy(false);}};
 const field={padding:'10px 12px',border:'1px solid var(--hairline)',borderRadius:10,background:'var(--raised)',color:'var(--ink)',font:'inherit',minWidth:0,flex:1};
 return <Overlay open={open} onClose={onClose}>
  <section aria-label="Locali e accessi" className="scroll" style={{width:520,maxWidth:'calc(100vw - 28px)',maxHeight:'calc(100vh - 48px)',overflowY:'auto',background:'var(--surface)',borderRadius:12,boxShadow:'var(--sh-pop)',padding:22,display:'grid',gap:18}}>
   <div style={{display:'flex',alignItems:'center',gap:10}}><h2 style={{fontSize:20,fontWeight:900,flex:1}}>Locali e accessi</h2><IconBtn name="x" tone="ghost" size={34} label="Chiudi" onClick={onClose}/></div>
   {error&&<p role="alert" style={{color:'var(--danger)',fontSize:13}}>{error}</p>}
   <form onSubmit={event=>{event.preventDefault();action(async()=>{await TakoAPI.post('/web-locations',{name,slug});setName('');setSlug('');await refresh();});}} style={{display:'grid',gap:8}}>
    <strong>Aggiungi un locale</strong>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><input aria-label="Nome del locale" placeholder="Nome" required maxLength={150} value={name} onChange={event=>setName(event.target.value)} style={field}/><input aria-label="Indirizzo del locale" placeholder="nome-locale" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} value={slug} onChange={event=>setSlug(event.target.value)} style={field}/></div>
    <div><Btn size="sm" disabled={busy}>Crea locale</Btn></div>
   </form>
   <form onSubmit={event=>{event.preventDefault();action(async()=>{await TakoAPI.post('/web-locations/members',{email,role:'menu_editor'});setEmail('');await loadMembers();});}} style={{display:'grid',gap:8}}>
    <strong>Accesso editor menu</strong>
    <p style={{fontSize:13,color:'var(--ink-2)'}}>Concedi a un account Tako esistente il permesso di gestire il menu di questo locale.</p>
    <input aria-label="Email editor" type="email" placeholder="Email dell’account" required value={email} onChange={event=>setEmail(event.target.value)} style={field}/>
    <div><Btn size="sm" disabled={busy}>Concedi accesso</Btn></div>
   </form>
   {members.length>0&&<div style={{display:'grid',gap:8}}>
    {members.map(member=><div key={member.id} style={{display:'flex',gap:12,alignItems:'center',fontSize:14}}><span style={{flex:1,minWidth:0}}>{member.name} · {member.email} · {member.role==='menu_editor'?'Editor menu':'Titolare'}</span>{member.role==='menu_editor'&&<Btn size="sm" kind="ghost" disabled={busy} onClick={()=>action(async()=>{await TakoAPI.del('/web-locations/members/'+member.id);setMembers(rows=>rows.filter(row=>row.id!==member.id));})}>Revoca</Btn>}</div>)}
   </div>}
  </section>
 </Overlay>;
}
window.TakoLocationSwitcher=TakoLocationSwitcher;
