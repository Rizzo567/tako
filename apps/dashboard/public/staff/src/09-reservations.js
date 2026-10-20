/* ───────────────── Tako Dashboard — Prenotazioni ─────────────────
   Schermata gestione prenotazioni (vista giorno navigabile, CRUD, azioni
   rapide di stato, assegnazione tavolo). Stile coerente con le altre schermate.
   Legge/scrive dal backend via window.TakoAPI (route /api/reservations).
   NB: nessuna dichiarazione top-level duplicata rispetto agli altri file
   (React hooks, Btn, Card, Overlay, ScreenScroll, PageHead… sono già in scope). */

/* ═══════════ stati prenotazione (DB enum → label + tono badge) ═══════════ */
const RES_STATUS = {
  requested: { label: "Richiesta",  tone: "wait" },
  confirmed: { label: "Confermata", tone: "info" },
  seated:    { label: "Seduti",     tone: "ok" },
  no_show:   { label: "No show",    tone: "danger" },
  cancelled: { label: "Annullata",  tone: "muted" },
};

/* ═══════════ helper API prenotazioni (usa il client globale TakoAPI) ═══════════ */
const resApi = {
  list: (date) => window.TakoAPI.get(`/reservations?date=${date}`),
  create: (body) => window.TakoAPI.post(`/reservations`, body),
  update: (id, fields) => window.TakoAPI.patch(`/reservations/${id}`, fields),
  setStatus: (id, status) => window.TakoAPI.patch(`/reservations/${id}/status`, { status }),
  assignTable: (id, tableId) => window.TakoAPI.patch(`/reservations/${id}/table`, { tableId }),
  remove: (id) => window.TakoAPI.del(`/reservations/${id}`),
};

/* ═══════════ helper date locali ═══════════ */
const resTimezone = () => SETTINGS_DEFAULTS.fuso || "Europe/Rome";
const resToday = () => new Date().toLocaleDateString("en-CA",{timeZone:resTimezone()}); // YYYY-MM-DD (ora locale)
function resAddDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
}
function resPrettyDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const s = d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const resHHMM = (iso) => { try { return new Intl.DateTimeFormat("it-IT",{timeZone:resTimezone(),hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(iso)); } catch (_) { return ""; } };
/* ISO (timestamptz) → valore per <input type="datetime-local"> in ora locale */
function resIsoToLocalInput(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:resTimezone(),year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
/* tutti i tavoli del locale come opzioni { _id, n, room } (da window.ROOMS) */
function resAllTables() {
  return (window.ROOMS || []).flatMap((r) => (r.tables || []).map((t) => ({ _id: t._id, n: t.n, room: r.nome })));
}

/* ═══════════ stili locali (self-contained, niente dipendenza dall'ordine di caricamento) ═══════════ */
const RES_INPUT = { width: "100%", height: 44, padding: "0 13px", borderRadius: "var(--r-md)", border: "1px solid var(--hairline)", background: "var(--raised)", fontFamily: "var(--f-ui)", fontSize: 14.5, color: "var(--ink)", outline: "none", boxSizing: "border-box" };
const RES_LABEL = { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 };
function ResField({ label, children }) {
  return <label style={{ display: "block", marginBottom: 14 }}><span style={RES_LABEL}>{label}</span>{children}</label>;
}

/* ═══════════════════ MODALE CREA / MODIFICA ═══════════════════ */
function ReservationModal({ open, onClose, reservation, defaultDate, defaultTable, onSaved }) {
  const isEdit = !!reservation;
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [email,setEmail]=useState("");
  const [consent,setConsent]=useState(false);
  const [coperti, setCoperti] = useState(2);
  const [quando, setQuando] = useState("");
  const [durata, setDurata] = useState(90);
  const [tableId, setTableId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const tavoli = resAllTables();

  useEffect(() => {
    if (!open) return;
    if (reservation) {
      setNome(reservation.customerName || "");
      setTel(reservation.customerPhone || "");
      setEmail(reservation.customerEmail||"");setConsent(!!reservation.reminderConsent);
      setCoperti(reservation.partySize || 2);
      setQuando(resIsoToLocalInput(reservation.startsAt));
      setDurata(reservation.durationMin || 90);
      setTableId(reservation.tableId || "");
      setNote(reservation.notes || "");
    } else {
      setNome(""); setTel(""); setEmail("");setConsent(false);setCoperti(2);
      // default: giorno visualizzato alle 20:00
      setQuando(`${defaultDate || resToday()}T20:00`);
      setDurata(90); setTableId(defaultTable?._id || ""); setCoperti(defaultTable?.posti || 2); setNote("");
    }
  }, [open, reservation, defaultDate, defaultTable]);

  const save = async () => {
    if (saving) return;
    if (nome.trim().length < 1) { toast("Inserisci il nome del cliente", { type: "error" }); return; }
    if (tel.trim().length < 1) { toast("Inserisci un recapito telefonico", { type: "error" }); return; }
    if (!quando) { toast("Scegli data e ora", { type: "error" }); return; }
    const startsAt = new Date(quando);
    if (isNaN(startsAt.getTime())) { toast("Data/ora non valida", { type: "error" }); return; }
    setSaving(true);
    try {
      const payload = {
        customerName: nome.trim(),
        customerPhone: tel.trim(),
        customerEmail: email.trim()||null,reminderConsent:consent,
        partySize: Number(coperti) || 1,
        localDate: quando.slice(0,10),localTime:quando.slice(11,16),
        durationMin: Number(durata) || 90,
        tableId: tableId || null,
        notes: note.trim() || null,
      };
      if (isEdit) {
        await resApi.update(reservation.id, payload);
        toast("Prenotazione aggiornata", { type: "success" });
      } else {
        await resApi.create(payload);
        toast("Prenotazione creata", { type: "success" });
      }
      onClose();
      onSaved && onSaved();
    } catch (e) {
      toast(e.code === "RESERVATION_OVERLAP" ? "Il tavolo è già prenotato in quella fascia oraria." : e.message, { type: "error" });
    } finally { setSaving(false); }
  };

  return (
    <Overlay open={open} onClose={onClose} anchor="center">
      <div style={{ width: 420, maxWidth: "calc(100vw - 40px)", background: "var(--surface)", borderRadius: 12, boxShadow: "var(--sh-pop)", display: "flex", flexDirection: "column", maxHeight: "calc(100% - 48px)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--brand-tint)", color: "var(--brand)" }}><Icon name="clock" size={20} /></div>
          <h3 style={{ fontSize: 18, flex: 1 }}>{isEdit ? "Modifica prenotazione" : "Nuova prenotazione"}</h3>
          <IconBtn name="x" tone="soft" onClick={onClose} />
        </div>
        <div className="scroll" style={{ padding: 20, overflowY: "auto" }}>
          <ResField label="Nome cliente"><input style={RES_INPUT} value={nome} autoFocus onChange={(e) => setNome(e.target.value)} placeholder="Es. Marco Rossi" /></ResField>
          <ResField label="Telefono"><input style={RES_INPUT} value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+39…" /></ResField>
          <ResField label="Email (opzionale)"><input type="email" style={RES_INPUT} value={email} onChange={e=>setEmail(e.target.value)}/></ResField>
          <label style={{display:"flex",gap:8,marginBottom:14}}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> Il cliente acconsente al promemoria via email</label>
          <div style={{ display: "flex", gap: 12 }}>
            <ResField label="Coperti"><input style={RES_INPUT} type="number" min="1" value={coperti} onChange={(e) => setCoperti(e.target.value)} /></ResField>
            <ResField label="Durata (min)"><input style={RES_INPUT} type="number" min="15" step="15" value={durata} onChange={(e) => setDurata(e.target.value)} /></ResField>
          </div>
          <ResField label={`Data e ora · ${resTimezone()}`}><input style={RES_INPUT} type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} /></ResField>
          <ResField label="Tavolo (opzionale)">
            <select style={RES_INPUT} value={tableId} onChange={(e) => setTableId(e.target.value)}>
              <option value="">Nessun tavolo assegnato</option>
              {tavoli.map((t) => <option key={t._id} value={t._id}>Tavolo {t.n}{t.room ? ` · ${t.room}` : ""}</option>)}
            </select>
          </ResField>
          <ResField label="Note (opzionale)"><textarea style={{ ...RES_INPUT, height: 66, padding: 13, resize: "none" }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Allergie, occasione, richieste…" /></ResField>
        </div>
        <div style={{ padding: 16, borderTop: "1px solid var(--hairline)", display: "flex", gap: 10 }}>
          <Btn kind="soft" full onClick={onClose}>Annulla</Btn>
          <Btn kind="brand" full icon="check" onClick={save}>{saving ? "Salvo…" : (isEdit ? "Salva" : "Crea prenotazione")}</Btn>
        </div>
      </div>
    </Overlay>
  );
}

/* ═══════════════════ RIGA PRENOTAZIONE ═══════════════════ */
function ReservationRow({ r, mobile, onEdit, onStatus, onDelete }) {
  const st = RES_STATUS[r.status] || RES_STATUS.requested;
  const cancelled = r.status === "cancelled";
  return (
    <div style={{ display: "flex", alignItems: mobile ? "flex-start" : "center", gap: 14, padding: "13px 16px", borderBottom: "1px solid var(--hairline)", flexWrap: mobile ? "wrap" : "nowrap", opacity: cancelled ? 0.55 : 1 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 56, flex: "none" }}>
        <span className="num" style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>{resHHMM(r.startsAt)}</span>
        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.durationMin}′</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.customerName}</span>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>
          <Icon name="user" size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> {r.partySize} coperti
          {r.tableNumber != null ? <> · <Icon name="table" size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> Tavolo {r.tableNumber}</> : <span style={{ color: "var(--wait)" }}> · senza tavolo</span>}
          {r.customerPhone ? <> · <span className="mono">{r.customerPhone}</span></> : null}
        </div>
        {r.notes ? <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 3, fontStyle: "italic" }}>{r.notes}</div> : null}
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {!cancelled && r.status !== "confirmed" && r.status !== "seated" && (
          <Btn size="sm" kind="soft" icon="check" onClick={() => onStatus(r, "confirmed")}>Conferma</Btn>
        )}
        {!cancelled && r.status !== "seated" && (
          <Btn size="sm" kind="soft" icon="user" onClick={() => onStatus(r, "seated")}>Seduti</Btn>
        )}
        {!cancelled && (
          <Btn size="sm" kind="ghost" onClick={() => onStatus(r, "no_show")}>No-show</Btn>
        )}
        <IconBtn name="edit" tone="ghost" onClick={() => onEdit(r)} label="Modifica" />
        {!cancelled
          ? <IconBtn name="x" tone="ghost" style={{ color: "var(--danger)" }} onClick={() => onStatus(r, "cancelled")} label="Annulla" />
          : <IconBtn name="trash" tone="ghost" style={{ color: "var(--danger)" }} onClick={() => onDelete(r)} label="Elimina" />}
      </div>
    </div>
  );
}

/* ═══════════════════ SCHERMATA PRENOTAZIONI ═══════════════════ */
/* A single room/table model is shared with Sala Live. Positions persist via the existing API. */
function ReservationTool({ label, icon, onClick, disabled, active, href }) {
  const tipId=React.useId();
  const [dismissed,setDismissed]=useState(false);
  const Tag=href?"a":"button";
  return <span className="res-tool" data-dismissed={dismissed||undefined} onMouseEnter={()=>setDismissed(false)} onMouseLeave={()=>setDismissed(false)}>
    <Tag className={"res-tool-button"+(active?" is-active":"")} type={href?undefined:"button"} href={href} target={href?"_blank":undefined} rel={href?"noopener noreferrer":undefined}
      aria-label={label} aria-describedby={tipId} aria-pressed={href?undefined:active} disabled={disabled} onClick={onClick} onFocus={()=>setDismissed(false)} onKeyDown={e=>{if(e.key==="Escape")setDismissed(true);}}>
      <Icon name={icon} size={19}/>
    </Tag>
    <span id={tipId} role="tooltip" className="res-tool-tip">{label}</span>
  </span>;
}

function ReservationRoomMap({ rooms: initialRooms, mobile, reservations, onReserve, onNewReservation }) {
  const [rooms,setRooms]=useState(initialRooms);
  const [roomsError,setRoomsError]=useState("");
  const [roomsLoading,setRoomsLoading]=useState(false);
  const roomLoadSeq=useRef(0);
  const loadRooms=async()=>{
    if(!window.TakoAPI?.get)return;
    const seq=++roomLoadSeq.current,scope=window.__takoRestaurantId;
    setRoomsLoading(true);setRoomsError("");
    try{const rows=await window.TakoAPI.get('/tables/rooms');if(seq!==roomLoadSeq.current||scope!==window.__takoRestaurantId)return;const mapped=rows.map(mapRoom);setRooms(mapped);ROOMS=mapped;window.ROOMS=mapped;return mapped;}
    catch(e){if(seq===roomLoadSeq.current)setRoomsError(e.message||"Impossibile caricare le sale");}
    finally{if(seq===roomLoadSeq.current)setRoomsLoading(false);}
  };
  useEffect(()=>{loadRooms();return()=>{roomLoadSeq.current++;};},[initialRooms]);
  const [roomId, setRoomId] = useState(rooms[0]?.id || "");
  const [editing, setEditing] = useState(false);
  const [roomModal, setRoomModal] = useState(false);
  const [tableModal, setTableModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [positions, setPositions] = useState({});
  const canvas = useRef(null), drag = useRef(null);
  const room = rooms.find(r => r.id === roomId) || rooms[0];
  const tables = room?.tables || [];
  const point = t => positions[t._id] || (t._hasPos ? {x:t.x,y:t.y} : null);
  const updatePosition = async (t, x, y) => {
    if(saving) return;
    const next = {x:Math.round(Math.max(8,Math.min(92,x))),y:Math.round(Math.max(12,Math.min(88,y)))};
    setSaving(true);
    try { await window.TakoActions.tableUpdate(t._id,{posX:next.x,posY:next.y}); setPositions(p=>({...p,[t._id]:next})); toast("Posizione salvata",{type:"success"}); }
    catch(e) { toast(e.message,{type:"error"}); }
    finally {setSaving(false);}
  };
  const pointerDown = (e,t) => {
    if(!editing || saving) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p=point(t); drag.current={t,startX:e.clientX,startY:e.clientY,x:p.x,y:p.y,moved:false,el:e.currentTarget};
  };
  const pointerMove = e => {
    const d=drag.current;if(!d||!canvas.current)return;
    if(Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<5&&!d.moved)return;
    d.moved=true;const rect=canvas.current.getBoundingClientRect();
    d.x=Math.max(8,Math.min(92,(e.clientX-rect.left)/rect.width*100));d.y=Math.max(12,Math.min(88,(e.clientY-rect.top)/rect.height*100));
    d.el.style.left=d.x+"%";d.el.style.top=d.y+"%";
  };
  const pointerEnd = async (e,cancelled=false) => {
    const d=drag.current;if(!d)return;drag.current=null;e.currentTarget.releasePointerCapture?.(e.pointerId);
    const original=point(d.t);d.el.style.left=original.x+"%";d.el.style.top=original.y+"%";
    if(d.moved&&!cancelled) await updatePosition(d.t,d.x,d.y);
  };
  const tableButton = (t, placed) => {
    const p=point(t), count=reservations.filter(r=>r.tableId===t._id&&r.status!=="cancelled"&&r.status!=="no_show").length;
    const active=selected?._id===t._id;
    return <button key={t._id} type="button" aria-label={`Tavolo ${t.n}, ${t.posti} posti, ${count} prenotazioni nel giorno`} aria-pressed={active}
      disabled={saving} onClick={()=>setSelected(t)} onPointerDown={placed?e=>pointerDown(e,t):undefined} onPointerMove={placed?pointerMove:undefined}
      onPointerUp={placed?pointerEnd:undefined} onPointerCancel={placed?e=>pointerEnd(e,true):undefined}
      onKeyDown={e=>{if(editing&&placed&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();updatePosition(t,p.x+(e.key==='ArrowRight'?2:e.key==='ArrowLeft'?-2:0),p.y+(e.key==='ArrowDown'?2:e.key==='ArrowUp'?-2:0));}}}
      style={{position:placed?"absolute":"relative",left:placed?p.x+"%":undefined,top:placed?p.y+"%":undefined,transform:placed?"translate(-50%,-50%)":undefined,width:mobile?82:104,padding:4,border:active?"2px solid var(--brand)":"2px solid transparent",borderRadius:14,background:active?"var(--brand-tint)":"transparent",color:"var(--ink)",cursor:editing&&placed?"grab":"pointer",touchAction:editing?"none":"auto",fontFamily:"var(--f-ui)"}}>
      <img src={tableAsset(t)==="round-4"?"/staff/assets/tables/booking-round-4.png":`/staff/assets/tables/${tableAsset(t)}.png`} alt="" draggable="false" style={{display:"block",width:"100%",height:mobile?64:82,objectFit:"contain",pointerEvents:"none"}}/>
      <span style={{display:"block",fontSize:12,fontWeight:800,background:"var(--surface)",borderRadius:6,padding:"2px 4px"}}>T{t.n} · {t.posti} posti</span>
      {count>0&&<span style={{fontSize:11,color:"var(--ink-2)"}}>{count} prenotazioni</span>}
    </button>;
  };
  return <Card pad={mobile?14:20} style={{marginBottom:20}} className="res-floor-card">
    <style>{`
      .res-toolbar{display:flex;align-items:center;gap:14px;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap}
      .res-toolbar-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
      .res-toolbar-divider{width:1px;height:22px;background:var(--hairline);margin:0 5px}
      .res-tool{position:relative;display:inline-flex;flex:none}
      .res-tool-button{display:grid;place-items:center;width:40px;height:40px;border:0;border-radius:10px;background:transparent;color:var(--ink-2);cursor:pointer;text-decoration:none}
      .res-tool-button:hover{background:var(--sunken);color:var(--ink)}
      .res-tool-button:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
      .res-tool-button.is-active{background:var(--ink);color:var(--surface)}
      .res-tool-button:disabled{opacity:.35;cursor:default}
      .res-tool-tip{position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%);padding:7px 10px;border-radius:7px;background:#202020;color:#fff;white-space:nowrap;font-size:12px;font-weight:500;line-height:1.3;opacity:0;visibility:hidden;pointer-events:none;z-index:30}
      .res-tool:hover .res-tool-tip,.res-tool:focus-within .res-tool-tip{opacity:1;visibility:visible}
      .res-tool[data-dismissed] .res-tool-tip{opacity:0;visibility:hidden}
      .res-toolbar-actions>.res-tool:last-child .res-tool-tip{left:auto;right:0;transform:none}
      .res-floor-empty{min-height:200px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:var(--ink-3)}
      @media(max-width:600px){.res-toolbar{gap:12px}.res-toolbar h3{width:100%}.res-toolbar-actions{width:100%;gap:4px}.res-toolbar-actions>.press:last-child{margin-left:auto}.res-toolbar-divider{margin:0 2px}.res-tool-button{width:38px;height:40px}}
    `}</style>
    <div className="res-toolbar">
      <h3 style={{fontSize:19,fontWeight:750,margin:0}}>Sale</h3>
      <div className="res-toolbar-actions" role="group" aria-label="Azioni prenotazioni">
        <ReservationTool label="Aggiorna sale" icon="refresh" onClick={loadRooms} disabled={roomsLoading}/>
        <ReservationTool label="Nuova sala" icon="map" onClick={()=>setRoomModal(true)}/>
        <ReservationTool label={editing?"Termina disposizione":"Disponi tavoli"} icon={editing?"check":"move"} active={editing} disabled={!room} onClick={()=>{setEditing(!editing);setSelected(null);}}/>
        {window.__takoRestaurantId&&<ReservationTool label="Pagina pubblica" icon="globe" href={`/prenota/${window.__takoRestaurantId}`}/>}
        <span className="res-toolbar-divider" aria-hidden="true"/>
        {room&&<Btn kind="soft" size="sm" icon="plus" onClick={()=>setTableModal({table:null})}>Tavolo</Btn>}
        <Btn kind="brand" size="sm" icon="plus" onClick={onNewReservation}>Nuova prenotazione</Btn>
      </div>
    </div>
    {roomsError&&<p role="alert" style={{color:"var(--danger)",marginBottom:12}}>{roomsError}</p>}
    {roomsLoading&&<div role="status" style={{padding:12}}><TakoLoading label="Caricamento sale…" variant="compact"/></div>}
    {rooms.length>0?<>
      <div role="group" aria-label="Sale" style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>{rooms.map(r=><button key={r.id} type="button" aria-pressed={r.id===room?.id} onClick={()=>{setRoomId(r.id);setSelected(null);}} style={{padding:"9px 16px",borderRadius:12,border:"1px solid var(--hairline)",background:r.id===room?.id?"var(--ink)":"var(--surface)",color:r.id===room?.id?"var(--surface)":"var(--ink)",fontWeight:700}}>{r.nome} · {r.tables.length}</button>)}</div>
      {editing&&<p role="status" style={{fontSize:12,color:"var(--ink-2)",marginBottom:12}}>Trascina per disporre</p>}
      <div ref={canvas} aria-label={`Piantina ${room.nome}`} style={{position:"relative",height:mobile?420:490,border:"5px solid var(--hairline)",borderRadius:18,background:"var(--sunken)",overflow:"hidden",boxShadow:"inset 0 0 0 8px var(--surface)"}}>
        <span style={{position:"absolute",left:18,top:14,fontSize:11,fontWeight:800,color:"var(--ink-3)",letterSpacing:2}}>{room.nome.toUpperCase()}</span>
        {tables.filter(t=>point(t)).map(t=>tableButton(t,true))}
        {!tables.some(t=>point(t))&&<div style={{position:"absolute",inset:60,display:"grid",placeItems:"center",textAlign:"center",color:"var(--ink-2)",fontSize:14}}><span>Nessun tavolo</span></div>}
      </div>
      {tables.some(t=>!point(t))&&<div style={{marginTop:14}}><p style={{fontSize:13,fontWeight:700}}>Da posizionare</p><div style={{display:"flex",flexWrap:"wrap",gap:10}}>{tables.filter(t=>!point(t)).map(t=><div key={t._id}>{tableButton(t,false)}<Btn size="sm" kind="soft" disabled={saving} onClick={()=>updatePosition(t,25+(tables.indexOf(t)%3)*25,25+Math.floor(tables.indexOf(t)/3)%3*25)}>Posiziona</Btn></div>)}</div></div>}
      {selected&&<div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:10,marginTop:16,paddingTop:14,borderTop:"1px solid var(--hairline)"}}><strong style={{flex:1}}>Tavolo {selected.n} · {selected.posti} posti</strong><Btn kind="soft" size="sm" onClick={()=>setTableModal({table:{...selected,roomId:room.id}})}>Modifica tavolo</Btn><Btn kind="brand" size="sm" onClick={()=>onReserve(selected)}>Prenota questo tavolo</Btn></div>}
    </>:!roomsLoading&&!roomsError&&<div className="res-floor-empty"><Icon name="map" size={28}/><Btn kind="soft" size="sm" icon="plus" onClick={()=>setRoomModal(true)}>Crea sala</Btn></div>}
    <RoomFormModal open={roomModal} onClose={()=>setRoomModal(false)} onSaved={async created=>{await loadRooms();if(created?.id)setRoomId(created.id);setSelected(null);}}/>
    <TableFormModal open={!!tableModal} table={tableModal?.table||null} rooms={rooms} defaultRoomId={room?.id} onClose={()=>setTableModal(null)} onSaved={async()=>{await loadRooms();setSelected(null);}}/>
  </Card>;
}

function ScreenPrenotazioni({ mobile, rooms = [] }) {
  const [date, setDate] = useState(resToday());
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);      // { reservation: null|r } quando aperto
  const [delTarget, setDelTarget] = useState(null);

  const load = async (d) => {
    setLoading(true);
    try {
      const rows = await resApi.list(d);
      setList(rows || []);
    } catch (e) {
      setList([]); toast(e.message, { type: "error" });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(date); }, [date]);

  const onStatus = async (r, status) => {
    const prev = list;
    setList((l) => l.map((x) => x.id === r.id ? { ...x, status } : x));
    try {
      await resApi.setStatus(r.id, status);
      toast(`Prenotazione · ${(RES_STATUS[status] || {}).label || status}`, { type: "success" });
    } catch (e) { setList(prev); toast(e.message, { type: "error" }); }
  };
  const onDelete = async (r) => {
    try {
      await resApi.remove(r.id);
      toast("Prenotazione eliminata", { type: "success" });
      setDelTarget(null);
      load(date);
    } catch (e) { toast(e.message, { type: "error" }); setDelTarget(null); }
  };

  const attive = list.filter((r) => r.status !== "cancelled");
  const coperti = attive.reduce((a, r) => a + (r.partySize || 0), 0);
  const isToday = date === resToday();

  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} title="Prenotazioni" sub={`${attive.length} prenotazioni · ${coperti} coperti`} />

      {/* navigazione giorno */}
      <Card pad={mobile ? 12 : 14} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <IconBtn name="chevL" tone="soft" onClick={() => setDate((d) => resAddDays(d, -1))} label="Giorno precedente" />
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 15.5, fontFamily: "var(--f-display)" }}>{resPrettyDate(date)}</div>
          {isToday && <div style={{ fontSize: 11.5, color: "var(--brand)", fontWeight: 700 }}>Oggi</div>}
        </div>
        <IconBtn name="chevR" tone="soft" onClick={() => setDate((d) => resAddDays(d, 1))} label="Giorno successivo" />
        {!isToday && <Btn size="sm" kind="soft" onClick={() => setDate(resToday())}>Oggi</Btn>}
      </Card>

      <ReservationRoomMap rooms={rooms} mobile={mobile} reservations={list} onNewReservation={()=>setModal({reservation:null})} onReserve={t=>setModal({reservation:null,table:t})}/>

      {loading ? (
        <Card pad={40}><TakoLoading label="Caricamento prenotazioni…" variant="screen"/></Card>
      ) : list.length === 0 ? (
        <div style={{padding:"20px 4px",fontSize:14,color:"var(--ink-3)"}}>Nessuna prenotazione</div>
      ) : (
        <Card pad={0} style={{ overflow: "hidden" }}>
          {list.map((r) => (
            <ReservationRow key={r.id} r={r} mobile={mobile}
              onEdit={(res) => setModal({ reservation: res })}
              onStatus={onStatus}
              onDelete={(res) => setDelTarget(res)} />
          ))}
        </Card>
      )}

      <ReservationModal open={!!modal} reservation={modal ? modal.reservation : null} defaultDate={date} defaultTable={modal?.table}
        onClose={() => setModal(null)} onSaved={() => load(date)} />
      <Confirm open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={() => delTarget && onDelete(delTarget)} danger
        title="Eliminare la prenotazione?" body="La prenotazione verrà rimossa definitivamente." confirmLabel="Elimina" />
    </ScreenScroll>
  );
}

Object.assign(window, { ScreenPrenotazioni, ReservationModal, ReservationRow, RES_STATUS });
