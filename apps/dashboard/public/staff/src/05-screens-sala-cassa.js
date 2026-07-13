/* ───────────────── Tako Dashboard — sala, cassa, comanda, tavoli, QR ───────────────── */

/* vetro smerigliato (glassmorphism) per i pannelli che si aprono: semi-trasparente,
   sfoca ciò che c'è dietro + bordo/riflesso "specchio". */
const GLASS = {
  background: "rgba(251,248,244,0.62)",
  backdropFilter: "blur(22px) saturate(180%)",
  WebkitBackdropFilter: "blur(22px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.55)",
  boxShadow: "0 22px 60px -16px rgba(30,20,16,0.42), inset 0 1px 0 rgba(255,255,255,0.7)",
};

/* Sceglie l'illustrazione 2D del tavolo (assets/tables/*.png).
   La TAGLIA la danno i POSTI (così i tavoli legacy — tutti `square` di default in DB —
   restano vari e corretti senza migrazione); la FORMA rifinisce solo tondo↔quadrato
   nella fascia 3-4 posti, l'unica dove esistono entrambe le varianti nel set. */
function tableAsset(t) {
  const p = t.posti || 4;
  const s = t.shape;
  // Forma scelta ESPLICITAMENTE dall'utente → onorala, taglia dai posti.
  if (s === "round") return p <= 2 ? "round-2" : "round-4";
  if (s === "rectangle") return p >= 7 ? "rect-8" : "rect-6";
  // `square` (anche il default DB dei tavoli legacy) o assente → taglia dai posti;
  // quadrato solo nella fascia 3-4, dove è la forma plausibile.
  if (p <= 2) return "round-2";
  if (p >= 7) return "rect-8";
  if (p >= 5) return "rect-6";
  return "square-4";
}

/* ═══════════════════ SALA LIVE ═══════════════════ */
function ScreenSala({ mobile, rooms, calls, onSetTableState }) {
  // Guardia array vuoto: niente rooms[0].id su lista vuota. I hook restano SEMPRE
  // chiamati (nessun return anticipato prima degli hook): l'empty-state esce dopo.
  const [roomId, setRoomId] = useState(() => (rooms[0] ? rooms[0].id : null));
  const [sel, setSel] = useState(null);
  const [pos, setPos] = useState(() => { try { return JSON.parse(localStorage.getItem("tako-dash-tablepos") || "{}"); } catch (_) { return {}; } });
  const posRef = useRef(pos); posRef.current = pos;
  const pending = useRef({}); // posizioni in attesa di conferma dal server dopo un drag locale
  const mapRef = useRef(null);
  const drag = useRef(null);
  const [trayDragT, setTrayDragT] = useState(null); // tavolo trascinato DAL vassoio verso la pianta
  const trayDrag = useRef(null);
  const trayGhostRef = useRef(null);
  const unplaced = useRef({}); // tavoli tolti dalla pianta (in attesa di conferma server) → vassoio
  // se la sala selezionata sparisce o non è ancora impostata, riallinea alla prima disponibile
  useEffect(() => { if (rooms.length && (roomId == null || !rooms.some(r => r.id === roomId))) setRoomId(rooms[0].id); }, [rooms]);
  const room = rooms.find(r => r.id === roomId) || rooms[0];
  const counts = useMemo(() => {
    const all = rooms.flatMap(r => r.tables);
    return { occ: all.filter(t => t.stato === "occupato").length, free: all.filter(t => t.stato === "libero").length, tot: all.length };
  }, [rooms]);
  // Le posizioni del SERVER vincono sul localStorage (sync cross-dispositivo). Durante un
  // drag attivo, o finché il server non conferma l'ultimo spostamento locale, usa il locale.
  // Posizione EFFETTIVA sulla pianta, oppure null se il tavolo non è ancora piazzato
  // (→ finisce nel vassoio "Da posizionare"). NIENTE default in alto a sinistra: un
  // tavolo appena creato non ha posX/posY sul server, quindi rawPos è null e va nel vassoio.
  const rawPos = (t) => {
    if (unplaced.current[roomId] && unplaced.current[roomId][t.n]) return null; // tolto dalla pianta
    const pend = pending.current[roomId] && pending.current[roomId][t.n];
    if (pend && !(t._hasPos && Math.abs(t.x - pend.x) <= 1 && Math.abs(t.y - pend.y) <= 1)) return pend;
    if (t._hasPos) return { x: t.x, y: t.y };
    const local = pos[roomId] && pos[roomId][t.n];
    return local || null;
  };
  const xy = (t) => {
    // Durante il drag la posizione viva sta in drag.current (aggiornata via DOM, non
    // in state): se un re-render capita a metà trascinamento il tavolo NON salta.
    if (drag.current && drag.current.n === t.n) return { x: drag.current.x, y: drag.current.y };
    return rawPos(t) || { x: 50, y: 50 };
  };

  if (!rooms || rooms.length === 0) {
    return (
      <ScreenScroll mobile={mobile}>
        <PageHead mobile={mobile} tako="serve" title="Sala Live" />
        <Empty tako="neutral" title="Nessuna sala ancora — creane una per iniziare"
          sub="Aggiungi una sala e i suoi tavoli per gestire la pianta del locale."
          action={<Btn kind="brand" icon="plus" onClick={() => window.takoGo && window.takoGo("tavoli")}>Crea una sala</Btn>} />
      </ScreenScroll>
    );
  }

  const onDown = (e, t) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const start = xy(t);
    drag.current = { n: t.n, t, el: e.currentTarget, startX: e.clientX, startY: e.clientY, x: start.x, y: start.y, moved: false };
    // solleva il tavolo trascinato sopra gli altri, senza re-render
    e.currentTarget.style.zIndex = "6";
    e.currentTarget.style.cursor = "grabbing";
    e.currentTarget.style.willChange = "left, top";
  };
  const onMove = (e) => {
    const d = drag.current; if (!d || !mapRef.current || !d.el) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
    d.moved = true;
    const r = mapRef.current.getBoundingClientRect();
    // coordinate frazionarie (niente Math.round) → movimento continuo, non a scatti
    let x = ((e.clientX - r.left) / r.width) * 100;
    let y = ((e.clientY - r.top) / r.height) * 100;
    x = Math.max(5, Math.min(95, x)); y = Math.max(7, Math.min(93, y));
    d.x = x; d.y = y;
    // Aggiorna il DOM DIRETTAMENTE: nessun setState → nessun re-render dei tavoli a
    // ogni pixel. È questo che rende il trascinamento fluido a 60fps.
    d.el.style.left = x + "%";
    d.el.style.top = y + "%";
  };
  const onUp = async (e) => {
    const d = drag.current; if (!d) return;
    e.currentTarget?.releasePointerCapture?.(e.pointerId);
    if (d.el) { d.el.style.zIndex = ""; d.el.style.cursor = "grab"; d.el.style.willChange = ""; }
    drag.current = null;
    if (d.moved) { await place(d.t, Math.round(d.x), Math.round(d.y)); }
    else { setSel(d.t); }
  };

  // Piazza un tavolo sulla pianta a (fx,fy)% e persiste sul server (posX/posY): la
  // posizione resta anche riavviando l'app. Usato sia dal drag sulla pianta sia dal
  // rilascio di un tavolo trascinato dal vassoio.
  const place = async (t, fx, fy) => {
    if (unplaced.current[roomId]) delete unplaced.current[roomId][t.n];
    setPos(p => ({ ...p, [roomId]: { ...(p[roomId] || {}), [t.n]: { x: fx, y: fy } } }));
    const merged = { ...posRef.current, [roomId]: { ...(posRef.current[roomId] || {}), [t.n]: { x: fx, y: fy } } };
    try { localStorage.setItem("tako-dash-tablepos", JSON.stringify(merged)); } catch (_) {}
    pending.current[roomId] = { ...(pending.current[roomId] || {}), [t.n]: { x: fx, y: fy } };
    try { await window.TakoActions.tableUpdate(t._id, { posX: fx, posY: fy }); }
    catch (err) { toast(err.message, { type: "error" }); }
  };

  // Toglie un tavolo dalla pianta → torna nel vassoio (posX/posY = null sul server).
  const unplace = async (t) => {
    unplaced.current[roomId] = { ...(unplaced.current[roomId] || {}), [t.n]: true };
    setPos(p => { const r = { ...(p[roomId] || {}) }; delete r[t.n]; return { ...p, [roomId]: r }; });
    if (pending.current[roomId]) delete pending.current[roomId][t.n];
    const merged = { ...posRef.current, [roomId]: { ...(posRef.current[roomId] || {}) } };
    delete merged[roomId][t.n];
    try { localStorage.setItem("tako-dash-tablepos", JSON.stringify(merged)); } catch (_) {}
    try { await window.TakoActions.tableUpdate(t._id, { posX: null, posY: null }); }
    catch (err) { toast(err.message, { type: "error" }); }
  };

  // ── Drag di un tavolo DAL vassoio verso la pianta (ghost che segue il puntatore) ──
  const onTrayDown = (e, t) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    trayDrag.current = { t, cx: e.clientX, cy: e.clientY, moved: false };
    setTrayDragT(t); // monta il ghost
  };
  const onTrayMove = (e) => {
    const d = trayDrag.current; if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.cx, e.clientY - d.cy) < 4) return;
    d.moved = true; d.cx = e.clientX; d.cy = e.clientY;
    if (trayGhostRef.current) { trayGhostRef.current.style.left = e.clientX + "px"; trayGhostRef.current.style.top = e.clientY + "px"; }
  };
  const onTrayUp = async (e) => {
    const d = trayDrag.current; if (!d) return;
    e.currentTarget?.releasePointerCapture?.(e.pointerId);
    trayDrag.current = null;
    setTrayDragT(null);
    const r = mapRef.current && mapRef.current.getBoundingClientRect();
    // rilasciato DENTRO la pianta → piazza lì; altrimenti resta nel vassoio
    if (d.moved && r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      let x = ((e.clientX - r.left) / r.width) * 100;
      let y = ((e.clientY - r.top) / r.height) * 100;
      x = Math.max(5, Math.min(95, x)); y = Math.max(7, Math.min(93, y));
      await place(d.t, Math.round(x), Math.round(y));
    } else if (!d.moved) {
      setSel(d.t); // tap sul chip → apri il dettaglio tavolo
    }
  };
  const resetLayout = () => { const n = { ...pos }; delete n[roomId]; setPos(n); try { localStorage.setItem("tako-dash-tablepos", JSON.stringify(n)); } catch (_) {} toast("Disposizione ripristinata"); };
  const hasCustom = pos[roomId] && Object.keys(pos[roomId]).length > 0;

  // Piazzati (sulla pianta) vs da posizionare (vassoio): un tavolo senza posizione
  // salvata non finisce più in alto a sinistra, ma nel vassoio sotto la pianta.
  const placedTables = [], trayTables = [];
  for (const t of (room ? room.tables : [])) { (rawPos(t) ? placedTables : trayTables).push(t); }

  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="serve" title="Sala Live" sub={`${counts.occ}/${counts.tot} tavoli occupati · ${counts.free} liberi`}
        actions={hasCustom ? <Btn size="sm" kind="ghost" icon="refresh" onClick={resetLayout}>Ripristina disposizione</Btn> : null} />

      {calls.length > 0 && (
        <Card pad={0} style={{ marginBottom: 16, overflow: "hidden", border: "1.5px solid var(--wait)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "var(--wait-bg)" }}>
            <Icon name="bell" size={17} style={{ color: "var(--wait)" }} />
            <span style={{ fontWeight: 800, fontSize: 14, color: "#9A6912" }}>{calls.length} chiamate cameriere</span>
          </div>
          <div style={{ display: "flex", flexDirection: mobile ? "column" : "row", gap: 1, background: "var(--hairline)" }}>
            {calls.map((c, i) => (
              <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: "var(--raised)" }}>
                <span className="num" style={{ width: 34, height: 34, borderRadius: 9, background: "var(--ink)", color: "#fff", display: "grid", placeItems: "center" }}>{c.tavolo}</span>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.motivo}</div><div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Tavolo {c.tavolo} · {c.min}′ fa</div></div>
                <Btn size="sm" kind="soft" onClick={async () => { try { await window.TakoActions.waiterResolve(c._id); toast('Chiamata risolta',{type:'success'}); } catch(e){ toast(e.message,{type:'error'}); await window.takoReload(); } }}>Risolvi</Btn>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div className="seg">{rooms.map(r => <button key={r.id} className={roomId === r.id ? "on" : ""} onClick={() => setRoomId(r.id)}>{r.nome}</button>)}</div>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ink-3)", fontWeight: 600 }}><Icon name="move" size={15} />Trascina un tavolo per spostarlo</span>
      </div>

      <Card pad={mobile ? 14 : 22}>
        <div ref={mapRef}
          style={{ position: "relative", width: "100%", aspectRatio: mobile ? "1 / 1.15" : "16 / 8", background: "radial-gradient(var(--hairline) 1px, transparent 1px) 0 0/22px 22px, var(--sunken)", borderRadius: 14, border: "1px dashed var(--hairline)" }}>
          {placedTables.length === 0 && (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", color: "var(--ink-3)", fontSize: 13, fontWeight: 600, pointerEvents: "none", padding: 20 }}>
              Trascina qui i tavoli dal riquadro "Da posizionare" qui sotto
            </div>
          )}
          {placedTables.map(t => {
            const st = TABLE_STATUS[t.stato];
            const p = xy(t);
            const sz = mobile ? 62 : 80;
            // Stato = alone RADIALE morbido e diffuso dietro il tavolo (nessun contorno
            // sui lati dritti: il vecchio drop-shadow lasciava righe verdi). Numero al
            // centro (velo bianco per leggibilità sul legno) + pallino di stato.
            return (
              <button key={t.n} onPointerDown={(e) => onDown(e, t)} onPointerMove={onMove} onPointerUp={onUp}
                style={{ position: "absolute", left: p.x + "%", top: p.y + "%", width: sz, height: sz, transform: "translate(-50%,-50%)",
                  background: "transparent", border: "none", padding: 0, display: "grid", placeItems: "center",
                  cursor: "grab", zIndex: 1, touchAction: "none", userSelect: "none" }}>
                <span aria-hidden style={{ position: "absolute", inset: mobile ? -9 : -13, borderRadius: "50%", pointerEvents: "none",
                  background: `radial-gradient(closest-side, ${st.color} 0%, ${st.color} 20%, transparent 74%)`, opacity: 0.5, filter: "blur(4px)" }} />
                <img src={`assets/tables/${tableAsset(t)}.png`} alt="" draggable={false}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none",
                    filter: "drop-shadow(0 3px 4px rgba(30,20,16,.26))" }} />
                <span className="num" style={{ position: "relative", fontSize: mobile ? 16 : 19, color: "var(--ink)", pointerEvents: "none",
                  textShadow: "0 1px 2px rgba(255,255,255,.9), 0 0 5px rgba(255,255,255,.75)" }}>{t.n}</span>
                <span style={{ position: "absolute", top: 2, right: 2, width: 14, height: 14, borderRadius: 99, background: st.color, border: "2px solid var(--raised)", boxShadow: "0 1px 3px rgba(30,20,16,.28)" }} />
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
          {Object.entries(TABLE_STATUS).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}><span style={{ width: 11, height: 11, borderRadius: 99, background: v.color }} />{v.label}</div>
          ))}
        </div>
      </Card>

      {/* Vassoio "Da posizionare": i tavoli senza posizione salvata. Si trascinano nella pianta. */}
      {trayTables.length > 0 && (
        <Card pad={mobile ? 14 : 18} style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <Icon name="grid" size={16} style={{ color: "var(--ink-2)" }} />
            <h3 style={{ fontSize: 14.5 }}>Da posizionare</h3>
            <span style={{ fontSize: 12.5, color: "var(--ink-3)", fontWeight: 600 }}>· trascina un tavolo nella pianta qui sopra</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {trayTables.map(t => {
              const st = TABLE_STATUS[t.stato];
              return (
                <button key={t.n} onPointerDown={(e) => onTrayDown(e, t)} onPointerMove={onTrayMove} onPointerUp={onTrayUp}
                  title={`Tavolo ${t.n} · ${t.posti} posti`}
                  style={{ position: "relative", width: 76, height: 76, borderRadius: 14, border: "1px dashed var(--hairline)", background: "var(--sunken)", display: "grid", placeItems: "center", cursor: "grab", touchAction: "none", userSelect: "none", padding: 0 }}>
                  <img src={`assets/tables/${tableAsset(t)}.png`} alt="" draggable={false} style={{ width: "80%", height: "80%", objectFit: "contain", pointerEvents: "none", filter: "drop-shadow(0 2px 3px rgba(30,20,16,.2))" }} />
                  <span className="num" style={{ position: "absolute", fontSize: 15, color: "var(--ink)", pointerEvents: "none", textShadow: "0 1px 2px rgba(255,255,255,.9)" }}>{t.n}</span>
                  <span style={{ position: "absolute", top: 3, right: 3, width: 11, height: 11, borderRadius: 99, background: st.color, border: "2px solid var(--raised)" }} />
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Ghost che segue il puntatore mentre trascini un tavolo dal vassoio */}
      {trayDragT && (
        <div ref={trayGhostRef} style={{ position: "fixed", left: (trayDrag.current ? trayDrag.current.cx : 0), top: (trayDrag.current ? trayDrag.current.cy : 0), width: mobile ? 62 : 80, height: mobile ? 62 : 80, transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 9999, opacity: 0.92 }}>
          <img src={`assets/tables/${tableAsset(trayDragT)}.png`} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 6px 10px rgba(30,20,16,.4))" }} />
        </div>
      )}

      <Overlay open={!!sel} onClose={() => setSel(null)} anchor={mobile ? "center" : "right"}>
        {sel && <TableDrawer table={sel} mobile={mobile} onClose={() => setSel(null)}
          placed={!!rawPos(sel)}
          onUnplace={() => { unplace(sel); setSel(null); }}
          onSetState={(s) => { onSetTableState(sel.n, s); setSel(null); }} />}
      </Overlay>
    </ScreenScroll>
  );
}
function TableDrawer({ table, mobile, onClose, onSetState, placed, onUnplace }) {
  const st = TABLE_STATUS[table.stato];
  const orders = ORDERS.filter(o => o.tavolo === table.n);
  return (
    <div style={{ width: mobile ? 354 : 360, maxWidth: "100%", height: mobile ? "auto" : "calc(100% - 24px)", maxHeight: "calc(100% - 24px)", margin: mobile ? 0 : 12, borderRadius: 20, display: "flex", flexDirection: "column", overflow: "hidden", ...GLASS }}>
      <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 12 }}>
        <span className="num" style={{ width: 50, height: 50, borderRadius: 14, background: "var(--ink)", color: "#fff", display: "grid", placeItems: "center", fontSize: 24 }}>{table.n}</span>
        <div style={{ flex: 1 }}><h3 style={{ fontSize: 19 }}>Tavolo {table.n}</h3><div style={{ display: "flex", gap: 8, marginTop: 4 }}><Badge tone="muted" dot style={{ background: st.color + "22", color: st.color }}>{st.label}</Badge><Badge tone="muted">{table.posti} posti</Badge></div></div>
        <IconBtn name="x" tone="soft" onClick={onClose} />
      </div>
      <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        <h4 style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 10 }}>Ordini al tavolo</h4>
        {orders.length === 0 ? <Empty icon="orders" title="Nessun ordine" sub="Questo tavolo non ha ordini attivi." /> : orders.map(o => (
          <Card key={o.id} pad={14} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><Badge tone={ORDER_STATUS[o.stato].tone}>{ORDER_STATUS[o.stato].label}</Badge><span style={{ fontSize: 12, color: "var(--ink-3)" }} className="mono">{o.orario}</span></div>
            {o.items.map((it, k) => <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "3px 0" }}><span><b className="num" style={{ color: "var(--brand)" }}>{it.qty}×</b> {it.nome}</span><span style={{ color: "var(--ink-2)" }}>{euro(it.prezzo * it.qty)}</span></div>)}
          </Card>
        ))}
      </div>
      <div style={{ padding: 16, borderTop: "1px solid var(--hairline)", display: "flex", flexDirection: "column", gap: 9 }}>
        <Btn kind="brand" full icon="cassa" onClick={() => { window.takoGo && window.takoGo('cassa'); onClose(); }}>Vai a Cassa</Btn>
        <div style={{ display: "flex", gap: 9 }}>
          <Btn kind="soft" full onClick={() => onSetState("libero")}>Segna libero</Btn>
          <Btn kind="soft" full onClick={() => onSetState("pulizia")}>Pulizia</Btn>
        </div>
        {placed && onUnplace && (
          <Btn kind="ghost" full icon="move" onClick={onUnplace}>Rimetti nel vassoio</Btn>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════ CASSA ═══════════════════ */
/* Modale "Nuovo conto" — sostituisce window.prompt (non funziona in WKWebView/Tauri). */
function NewBillModal({ open, onClose }) {
  const [numero, setNumero] = useState("");
  const [coperti, setCoperti] = useState(2);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setNumero(""); setCoperti(2); } }, [open]);
  const save = async () => {
    if (saving) return;
    if (!String(numero).trim()) { toast("Inserisci un numero tavolo", { type: "error" }); return; }
    setSaving(true);
    try {
      await window.TakoActions.billCreate({ tableNumber: String(numero).trim(), covers: Number(coperti) || 1 });
      toast("Conto creato", { type: "success" });
      onClose();
      await window.takoReload();
    } catch (e) { toast(e.message, { type: "error" }); }
    finally { setSaving(false); }
  };
  return (
    <Overlay open={open} onClose={onClose} anchor="center">
      <div style={{ width: 360, maxWidth: "calc(100vw - 40px)", background: "var(--raised)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-pop)", padding: 24, margin: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, display: "grid", placeItems: "center", background: "var(--brand-tint)", color: "var(--brand)" }}><Icon name="cassa" size={22} /></div>
          <h3 style={{ fontSize: 19, flex: 1 }}>Nuovo conto</h3>
          <IconBtn name="x" tone="soft" onClick={onClose} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={FIELD_LABEL}>Numero tavolo</label>
          <input type="text" value={numero} autoFocus onChange={(e) => setNumero(e.target.value)} style={INPUT_STYLE} placeholder="Es. 12" />
        </div>
        <div style={{ marginBottom: 22 }}>
          <label style={FIELD_LABEL}>Coperti</label>
          <input type="number" min="1" value={coperti} onChange={(e) => setCoperti(e.target.value)} style={INPUT_STYLE} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn kind="soft" full onClick={onClose}>Annulla</Btn>
          <Btn kind="brand" full icon="check" onClick={save}>{saving ? "Creo…" : "Crea conto"}</Btn>
        </div>
      </div>
    </Overlay>
  );
}
function ScreenCassa({ mobile, bills, onClose, settings = SETTINGS_DEFAULTS }) {
  const [pay, setPay] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  // Ponte per il pulsante "Nuovo conto" nell'header desktop (03-shell-nav): apre questa modale.
  useEffect(() => { window.__openNewBill = () => setNewOpen(true); return () => { delete window.__openNewBill; }; }, []);
  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="pay" title="Cassa" sub={`${bills.length} conti aperti`}
        actions={!mobile && <Btn kind="brand" icon="plus" onClick={() => setNewOpen(true)}>Nuovo conto</Btn>} />

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: mobile ? 12 : 16, marginBottom: 18 }}>
        <Kpi label="Incasso oggi" value={euro(CASSA_OGGI.incasso)} icon="coins" accent="var(--brand)" />
        <Kpi label="Mance" value={euro(CASSA_OGGI.mance)} icon="banknote" accent="var(--ok)" />
        <Kpi label="Conti chiusi" value={CASSA_OGGI.conti} icon="check" accent="var(--info)" />
        <Kpi label="Ticket medio" value={euro(CASSA_OGGI.ticket)} icon="stats" accent="var(--wait)" />
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Conti aperti</h3>
      {bills.length === 0 ? (
        <Empty tako="pay" title="Nessun conto aperto"
          sub="I conti aperti compaiono qui. Aprine uno con «Nuovo conto» o dalla scheda del tavolo in Sala."
          action={<Btn kind="brand" icon="plus" onClick={() => setNewOpen(true)}>Nuovo conto</Btn>} />
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
        {bills.map(b => (
          <Card key={b.id} pad={16} className="press" style={{ cursor: "pointer" }} onClick={() => setPay(b)}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span className="num" style={{ width: 46, height: 46, borderRadius: 12, background: "var(--brand-tint)", color: "var(--brand-deep)", display: "grid", placeItems: "center", fontSize: b.takeaway ? 13 : 20, fontWeight: 800 }}>{b.takeaway ? "ASP" : b.tavolo}</span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontFamily: "var(--f-display)", fontSize: 16 }}>{b.takeaway ? ("Asporto" + (b.customerName ? " · " + b.customerName : "")) : ("Tavolo " + b.tavolo)}</div><div style={{ fontSize: 12, color: "var(--ink-3)" }} className="mono">{b.id} · {b.takeaway ? "al ritiro" : (b.coperti + " coperti")} · {b.apertura}</div></div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 12, color: "var(--ink-2)" }}>Totale</div><div className="num" style={{ fontSize: 26 }}>{euro(b.total != null ? b.total : b.subtotale)}</div></div>
              <Btn size="sm" kind="brand" icon="banknote">Incassa</Btn>
            </div>
          </Card>
        ))}
      </div>
      )}

      <Overlay open={!!pay} onClose={() => setPay(null)} anchor="center">
        {pay && <PaymentModal bill={pay} mobile={mobile} settings={settings} onClose={() => setPay(null)} onDone={() => { setPay(null); onClose(pay.id); toast(`${pay.takeaway ? "Asporto" : "Conto T" + pay.tavolo} chiuso`, { type: "success", icon: "check" }); }} />}
      </Overlay>
      <NewBillModal open={newOpen} onClose={() => setNewOpen(false)} />
    </ScreenScroll>
  );
}
function PaymentModal({ bill, mobile, onClose, onDone, settings = SETTINGS_DEFAULTS }) {
  const [method, setMethod] = useState("contanti");
  const [split, setSplit] = useState(1);
  const [given, setGiven] = useState("");
  const [tip, setTip] = useState(0);
  // Il totale del server include GIÀ il coperto (coverCharge calcolato server-side):
  // la UI NON somma più il coperto client-side. `srvTotal` = bill.total del server.
  const [srvTotal, setSrvTotal] = useState(bill.total != null ? bill.total : (bill.subtotale || 0));
  const [coperti, setCoperti] = useState(bill.coperti || 0);
  const [covBusy, setCovBusy] = useState(false);
  // Coperto mostrato = differenza tra totale server e subtotale (verità server, non ricalcolo).
  const cop = Math.max(0, Math.round((srvTotal - bill.subtotale) * 100) / 100);
  const total = srvTotal + tip;
  const perHead = total / split;
  const change = method === "contanti" && given ? Math.max(0, parseFloat(given) - total) : 0;
  const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];
  const METHOD_MAP = { contanti: "cash", carta: "card", digitale: "digital", split: "split" };
  // Cambio coperti → PATCH /bills/:id {covers}, poi rilegge il bill per il nuovo totale server.
  const changeCovers = async (n) => {
    const v = Math.max(1, Math.round(n)); // il backend richiede covers >= 1
    if (v === coperti || covBusy) return;
    setCoperti(v);
    setCovBusy(true);
    try {
      await window.TakoActions.billUpdate(bill.id, { covers: v });
      const fresh = await window.TakoAPI.get("/bills/" + bill.id);
      if (fresh && fresh.total != null) setSrvTotal(Number(fresh.total) || 0);
    } catch (e) { toast(e.message, { type: "error" }); }
    finally { setCovBusy(false); }
  };
  const confirmPay = async () => {
    const METHOD_BACKEND = METHOD_MAP[method] || "cash";
    try {
      // La mancia viaggia dentro il POST /payments (niente PATCH separato → niente 403 cameriere).
      await window.TakoActions.billPay(bill.id, total, METHOD_BACKEND, tip || 0);
      await window.takoReload();
      if (onDone) onDone(); else onClose();
    } catch (e) {
      toast(e.message, { type: "error" });
    }
  };

  return (
    <div style={{ width: mobile ? 354 : 720, maxWidth: "100%", maxHeight: mobile ? "calc(100% - 48px)" : "100%", background: "var(--surface)", borderRadius: mobile ? 24 : "var(--r-xl)", boxShadow: "var(--sh-pop)", display: "flex", flexDirection: mobile ? "column" : "row", overflow: mobile ? "auto" : "hidden" }}>
      {/* left: summary */}
      <div style={{ flex: mobile ? "none" : "0 0 280px", padding: mobile ? "16px 18px" : 22, background: "var(--nav)", color: "var(--nav-ink)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="num" style={{ width: 40, height: 40, borderRadius: 11, background: "var(--brand)", color: "#fff", display: "grid", placeItems: "center", fontSize: bill.takeaway ? 13 : 18 }}>{bill.takeaway ? "ASP" : bill.tavolo}</span><div><div style={{ fontWeight: 800, color: "#fff" }}>{bill.takeaway ? ("Asporto" + (bill.customerName ? " · " + bill.customerName : "")) : ("Tavolo " + bill.tavolo)}</div><div style={{ fontSize: 11.5, color: "var(--nav-ink-2)" }} className="mono">{bill.id}</div></div></div>
          {mobile && <IconBtn name="x" tone="ghost" style={{ color: "#fff" }} onClick={onClose} />}
        </div>
        <div style={{ margin: mobile ? "14px 0 8px" : "22px 0 10px" }}>
          <div style={{ paddingBottom: 10, marginBottom: 6, borderBottom: "1px solid var(--nav-line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--nav-ink-2)", marginBottom: 5 }}><span>Subtotale</span><span>{euro(bill.subtotale)}</span></div>
            {/* Coperti: il cambio fa PATCH /bills {covers} (owner/cassiere). Il cameriere
                ha accesso alla Cassa ma non al PATCH → per lui è read-only (niente 403). */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: "var(--nav-ink-2)", marginBottom: 5 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                Coperti
                {(window.__takoRole === "owner" || window.__takoRole === "cassiere") ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <button className="press" onClick={() => changeCovers(coperti - 1)} disabled={covBusy || coperti <= 1} style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(255,255,255,.12)", color: "#fff", fontWeight: 800, lineHeight: 1 }}>−</button>
                    <span className="num" style={{ minWidth: 16, textAlign: "center", color: "#fff" }}>{coperti}</span>
                    <button className="press" onClick={() => changeCovers(coperti + 1)} disabled={covBusy} style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(255,255,255,.12)", color: "#fff", fontWeight: 800, lineHeight: 1 }}>+</button>
                  </span>
                ) : (
                  <span className="num" style={{ minWidth: 16, textAlign: "center", color: "#fff" }}>{coperti}</span>
                )}
              </span>
              <span>{cop > 0 ? euro(cop) : "—"}</span>
            </div>
            {tip > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--nav-ink-2)" }}><span>Mancia</span><span>{euro(tip)}</span></div>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--nav-ink-2)" }}>Totale da pagare</div>
        </div>
        <div className="num" style={{ fontSize: mobile ? 34 : 46, color: "#fff", lineHeight: 1 }}>{euro(total)}</div>
        {settings.manceSuggerite && (
          <div style={{ marginTop: mobile ? 12 : 18 }}>
            <div style={{ fontSize: 12.5, color: "var(--nav-ink-2)", marginBottom: 8 }}>Mancia suggerita</div>
            <div style={{ display: "flex", gap: 7 }}>
              {[0, 5, 10, 15].map(p => { const amt = Math.round(srvTotal * p) / 100; const on = tip === amt; return <button key={p} className="press" onClick={() => setTip(amt)} style={{ flex: 1, padding: "8px 0", borderRadius: 10, fontWeight: 700, fontSize: 13, background: on ? "var(--brand)" : "rgba(255,255,255,.1)", color: on ? "var(--on-brand)" : "#EDE2D6" }}>{p ? p + "%" : "No"}</button>; })}
            </div>
          </div>
        )}
        <div style={{ marginTop: mobile ? 12 : 18, paddingTop: mobile ? 12 : 16, borderTop: "1px solid var(--nav-line)", display: mobile ? "flex" : "block", alignItems: "center", gap: 10 }}>
          <div style={{ flex: "none", fontSize: 13, color: "var(--nav-ink-2)", marginBottom: mobile ? 0 : 8 }}>Dividi per</div>
          <div style={{ display: "flex", alignItems: "center", gap: mobile ? 8 : 10, flex: 1 }}>
            <IconBtn name="minus" tone="ghost" size={mobile ? 32 : 36} style={{ background: "rgba(255,255,255,.1)", color: "#fff" }} onClick={() => setSplit(s => Math.max(1, s - 1))} />
            <div style={{ flex: 1, textAlign: "center" }}><div className="num" style={{ fontSize: mobile ? 18 : 22, color: "var(--brand)" }}>{euro(perHead)}</div><div style={{ fontSize: 11, color: "var(--nav-ink-2)" }}>{split}× a testa</div></div>
            <IconBtn name="plus" tone="ghost" size={mobile ? 32 : 36} style={{ background: "rgba(255,255,255,.1)", color: "#fff" }} onClick={() => setSplit(s => Math.min(Math.max(1, coperti), s + 1))} />
          </div>
        </div>
      </div>

      {/* right: method + keypad */}
      <div style={{ flex: 1, padding: mobile ? "16px 18px" : 22, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {!mobile && <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}><IconBtn name="x" tone="soft" onClick={onClose} /></div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9, marginBottom: mobile ? 12 : 18 }}>
          {[["contanti", "Contanti", "banknote"], ["carta", "Carta", "card"], ["digitale", "Digitale", "smartphone"]].map(([k, l, ic]) => (
            <button key={k} className="press" onClick={() => setMethod(k)} style={{ padding: mobile ? "10px 6px" : "14px 8px", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: mobile ? 5 : 7, fontWeight: 700, fontSize: mobile ? 12.5 : 13.5, background: method === k ? "var(--brand)" : "var(--sunken)", color: method === k ? "#fff" : "var(--ink)", boxShadow: method === k ? "var(--sh-1)" : "none" }}><Icon name={ic} size={mobile ? 19 : 22} />{l}</button>
          ))}
        </div>

        {method === "contanti" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: mobile ? "10px 14px" : "12px 16px", background: "var(--raised)", borderRadius: 12, border: "1px solid var(--hairline)", marginBottom: mobile ? 10 : 12 }}>
              <div><div style={{ fontSize: 12, color: "var(--ink-2)" }}>Ricevuto</div><div className="num" style={{ fontSize: mobile ? 20 : 24 }}>{given ? euro(parseFloat(given) || 0) : "€0"}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 12, color: "var(--ink-2)" }}>Resto</div><div className="num" style={{ fontSize: mobile ? 20 : 24, color: change > 0 ? "var(--ok-deep)" : "var(--ink-3)" }}>{euro(change)}</div></div>
            </div>
            <div style={{ display: mobile ? "none" : "flex", gap: 7, marginBottom: 12 }}>{[total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50].map((v, i) => <button key={i} className="press" onClick={() => setGiven(String(v))} style={{ flex: 1, padding: "9px", borderRadius: 10, background: "var(--sunken)", fontWeight: 700, fontSize: 13.5 }}>{euro(v)}</button>)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: mobile ? 6 : 8, flex: 1 }}>
              {keypad.map(k => <button key={k} className="press" onClick={() => setGiven(g => k === "⌫" ? g.slice(0, -1) : (g + k))} style={{ borderRadius: 12, background: "var(--raised)", border: "1px solid var(--hairline)", fontFamily: "var(--f-display)", fontWeight: 800, fontSize: mobile ? 17 : 20, color: "var(--ink)", minHeight: mobile ? 34 : 40 }}>{k}</button>)}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center", color: "var(--ink-2)", border: "1.5px dashed var(--hairline)", borderRadius: 14, padding: 24 }}>
            <div><Icon name={method === "carta" ? "card" : "smartphone"} size={44} style={{ color: "var(--brand)", margin: "0 auto 12px" }} /><div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 16 }}>{method === "carta" ? "Pagamento con carta" : "Pagamento digitale"}</div><div style={{ fontSize: 13.5, marginTop: 6 }}>Registra l'incasso di {euro(total)} — conferma manuale</div></div>
          </div>
        )}

        <Btn kind="ok" size={mobile ? "md" : "lg"} full icon="check" style={{ marginTop: mobile ? 10 : 14 }} onClick={confirmPay} disabled={method === "contanti" && (parseFloat(given) || 0) < total}>
          {method === "contanti" && (parseFloat(given) || 0) < total ? `Mancano ${euro(total - (parseFloat(given) || 0))}` : `Incassa ${euro(total)}`}
        </Btn>
      </div>
    </div>
  );
}

/* ═══════════════════ COMANDA ═══════════════════ */
function ScreenComanda({ mobile }) {
  const [tavolo, setTavolo] = useState(null);
  const [cart, setCart] = useState({});
  // Guardia menu vuoto: niente MENU[0].sezione su lista vuota (hook sempre chiamati).
  const [sez, setSez] = useState(() => (MENU[0] ? MENU[0].sezione : null));
  const [sending, setSending] = useState(false);
  // Tavoli selezionabili per una comanda: TUTTI i tavoli reali, non solo i liberi.
  // Una comanda si prende anche su un tavolo OCCUPATO (portate successive), quindi il
  // vecchio nome "freeTables" era fuorviante: qui non filtriamo per stato libero.
  const selectableTables = ROOMS.flatMap(r => r.tables);
  const add = (nome) => setCart(c => ({ ...c, [nome]: (c[nome] || 0) + 1 }));
  const sub = (nome) => setCart(c => { const n = { ...c }; if (n[nome] > 1) n[nome]--; else delete n[nome]; return n; });
  const items = Object.entries(cart);
  const total = items.reduce((a, [nome, q]) => { const p = MENU.flatMap(s => s.piatti).find(x => x.nome === nome); return a + (p ? p.prezzo * q : 0); }, 0);

  const sendComanda = async () => {
    if (sending) return;
    setSending(true);
    try {
      const allPiatti = MENU.flatMap(s => s.piatti);
      const orderItems = items.map(([nome, q]) => {
        const p = allPiatti.find(x => x.nome === nome);
        return p ? { menuItemId: p._id, quantity: q } : null;
      }).filter(Boolean);
      if (!orderItems.length) throw new Error("Nessun piatto selezionato");
      const tav = ROOMS.flatMap(r => r.tables).find(t => t.n === tavolo);
      if (!tav) throw new Error("Tavolo non trovato");
      // Idempotenza: un doppio-tap / retry di rete non crea due comande (che
      // raddoppierebbero il conto del tavolo). Una chiave per azione di invio.
      const idempotencyKey = (self.crypto && crypto.randomUUID) ? crypto.randomUUID() : `staff-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      await window.TakoActions.staffOrder({ tableId: tav._id, tableNumber: String(tav.n), type: "table", items: orderItems, idempotencyKey });
      const tNum = tavolo;
      setCart({});
      setTavolo(null);
      toast(`Comanda T${tNum} inviata in cucina`, { type: "success", icon: "kitchen" });
      await window.takoReload();
    } catch (e) {
      toast(e.message, { type: "error" });
    } finally {
      setSending(false);
    }
  };

  if (!MENU.length) {
    return (
      <ScreenScroll mobile={mobile}>
        <PageHead mobile={mobile} tako="phone" title="Comanda" />
        <Empty tako="dish" title="Il menu è vuoto — aggiungi piatti da Menu"
          sub="Servono dei piatti a menu per poter prendere una comanda."
          action={<Btn kind="brand" icon="menu" onClick={() => window.takoGo && window.takoGo("menu")}>Vai a Menu</Btn>} />
      </ScreenScroll>
    );
  }

  if (!tavolo) {
    return (
      <ScreenScroll mobile={mobile}>
        <PageHead mobile={mobile} tako="phone" title="Comanda" sub="Seleziona il tavolo per cui prendere l'ordine" />
        {selectableTables.length === 0 ? (
          <Empty tako="neutral" title="Nessun tavolo ancora — creane uno per iniziare"
            sub="Aggiungi una sala e i suoi tavoli per poter prendere una comanda."
            action={<Btn kind="brand" icon="plus" onClick={() => window.takoGo && window.takoGo("tavoli")}>Gestisci tavoli</Btn>} />
        ) : (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(3,1fr)" : "repeat(auto-fill,minmax(110px,1fr))", gap: 12 }}>
          {selectableTables.map(t => {
            const st = TABLE_STATUS[t.stato];
            return <button key={t.n} className="press" onClick={() => setTavolo(t.n)} style={{ aspectRatio: "1", borderRadius: 16, background: "var(--raised)", border: `2px solid ${st.color}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, boxShadow: "var(--sh-1)" }}><span className="num" style={{ fontSize: 26 }}>{t.n}</span><span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600 }}>{t.posti} posti</span></button>;
          })}
        </div>
        )}
      </ScreenScroll>
    );
  }

  const section = MENU.find(s => s.sezione === sez) || MENU[0];
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", paddingTop: mobile ? 104 : 0, margin: mobile ? 0 : 12, borderRadius: mobile ? 0 : 20, ...(mobile ? { background: "var(--surface)" } : GLASS) }}>
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: mobile ? "12px 14px" : "18px 26px", borderBottom: "1px solid var(--hairline)", background: mobile ? "var(--surface)" : "transparent" }}>
        <IconBtn name="chevL" tone="soft" onClick={() => { setTavolo(null); setCart({}); }} />
        <div style={{ flex: 1 }}><h3 style={{ fontSize: 18 }}>Comanda · Tavolo {tavolo}</h3><div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{items.length} piatti · {euro(total)}</div></div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <div className="scroll" style={{ flex: "none", width: mobile ? 96 : 150, overflowY: "auto", borderRight: "1px solid var(--hairline)", padding: 8, background: mobile ? "var(--surface)" : "transparent" }}>
          {MENU.map((s, si) => <button key={s._id || si} className="press" onClick={() => setSez(s.sezione)} style={{ width: "100%", padding: "11px 10px", borderRadius: 11, marginBottom: 4, fontSize: 13, fontWeight: 700, textAlign: "left", background: sez === s.sezione ? "var(--brand-tint)" : "transparent", color: sez === s.sezione ? "var(--brand-deep)" : "var(--ink-2)" }}>{s.sezione}</button>)}
        </div>
        <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: mobile ? 12 : 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
            {section.piatti.map((p, pi) => (
              <Card key={p._id || pi} pad={14} style={{ opacity: p.disp ? 1 : .5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div style={{ fontWeight: 700, fontSize: 14.5 }}>{p.nome}</div><span className="num" style={{ color: "var(--brand)" }}>{euro(p.prezzo)}</span></div>
                <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: "4px 0 12px", lineHeight: 1.4 }}>{p.desc}</p>
                {p.disp ? (cart[p.nome] ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between", background: "var(--sunken)", borderRadius: 99, padding: 4 }}>
                    <IconBtn name="minus" tone="raised" size={34} onClick={() => sub(p.nome)} /><span className="num" style={{ fontSize: 17 }}>{cart[p.nome]}</span><IconBtn name="plus" tone="brand" size={34} onClick={() => add(p.nome)} />
                  </div>
                ) : <Btn size="sm" kind="soft" full icon="plus" onClick={() => add(p.nome)}>Aggiungi</Btn>) : <Badge tone="danger">Esaurito</Badge>}
              </Card>
            ))}
          </div>
        </div>
      </div>
      {items.length > 0 && (
        <div style={{ flex: "none", padding: mobile ? "14px 14px 92px" : "16px 26px", borderTop: "1px solid var(--hairline)", background: mobile ? "var(--raised)" : "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: "var(--ink-2)" }}>{items.reduce((a, [, q]) => a + q, 0)} piatti</div><div className="num" style={{ fontSize: 22 }}>{euro(total)}</div></div>
          <Btn kind="brand" size="lg" icon="check" onClick={sendComanda}>Invia comanda</Btn>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ GESTIONE TAVOLI ═══════════════════ */
const INPUT_STYLE = { padding: "11px", borderRadius: 11, border: "1px solid var(--hairline)", fontSize: 14.5, width: "100%", background: "var(--sunken)", color: "var(--ink)", boxSizing: "border-box" };
const FIELD_LABEL = { display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", marginBottom: 6 };

// Forma di default suggerita dai posti (per i nuovi tavoli e i legacy senza forma
// esplicita): coerente con la taglia che poi disegna tableAsset().
function shapeFromSeats(p) {
  const n = Number(p) || 4;
  if (n <= 2) return "round";
  if (n >= 5) return "rectangle";
  return "square"; // 3-4
}

function TableFormModal({ open, onClose, table, rooms }) {
  // table = null → nuovo; altrimenti modifica
  const [numero, setNumero] = useState("");
  const [posti, setPosti] = useState(4);
  const [forma, setForma] = useState("square");
  const [roomId, setRoomId] = useState(rooms[0] ? rooms[0].id : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (table) {
      setNumero(String(table.n));
      setPosti(table.posti);
      // I tavoli legacy sono tutti `square` di default: se combacia col default-da-posti
      // lo trattiamo come "non scelto" e proponiamo la forma dai posti.
      setForma(table.shape && table.shape !== "square" ? table.shape : shapeFromSeats(table.posti));
      setRoomId(table.roomId || (rooms[0] ? rooms[0].id : ""));
    } else {
      setNumero("");
      setPosti(4);
      setForma("square");
      setRoomId(rooms[0] ? rooms[0].id : "");
    }
  }, [open, table]);

  const save = async () => {
    if (saving) return;
    if (!String(numero).trim()) { toast("Inserisci un numero tavolo", { type: "error" }); return; }
    if (!roomId) { toast("Crea prima una sala", { type: "error" }); return; }
    setSaving(true);
    try {
      if (table) {
        await window.TakoActions.tableUpdate(table._id, { number: String(numero).trim(), seats: Number(posti) || table.posti, roomId, shape: forma });
        toast("Tavolo " + String(numero).trim() + " aggiornato", { type: "success" });
      } else {
        await window.TakoActions.tableCreate({ number: String(numero).trim(), seats: Number(posti) || 4, roomId, shape: forma });
        toast("Tavolo aggiunto", { type: "success" });
      }
      onClose();
      await window.takoReload();
    } catch (e) {
      toast(e.message, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay open={open} onClose={onClose} anchor="center">
      <div style={{ width: 380, maxWidth: "calc(100vw - 40px)", background: "var(--raised)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-pop)", padding: 24, margin: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, display: "grid", placeItems: "center", background: "var(--brand-tint)", color: "var(--brand)" }}><Icon name="grid" size={22} /></div>
          <h3 style={{ fontSize: 19, flex: 1 }}>{table ? "Modifica tavolo" : "Nuovo tavolo"}</h3>
          <IconBtn name="x" tone="soft" onClick={onClose} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={FIELD_LABEL}>Numero</label>
          <input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} style={INPUT_STYLE} placeholder="Es. 12" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={FIELD_LABEL}>Posti</label>
          <input type="number" min="1" value={posti} onChange={(e) => setPosti(e.target.value)} style={INPUT_STYLE} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={FIELD_LABEL}>Forma</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[["round", "Tondo"], ["square", "Quadrato"], ["rectangle", "Rettangolo"]].map(([val, lab]) => (
              <button key={val} type="button" onClick={() => setForma(val)}
                style={{ flex: 1, padding: "9px 6px", borderRadius: 11, fontSize: 13.5, fontWeight: 700, cursor: "pointer",
                  border: `1px solid ${forma === val ? "var(--brand)" : "var(--hairline)"}`,
                  background: forma === val ? "var(--brand-tint)" : "var(--sunken)",
                  color: forma === val ? "var(--brand-deep)" : "var(--ink-2)" }}>{lab}</button>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 6 }}>La grandezza segue i posti; la forma sceglie l'illustrazione del tavolo.</div>
        </div>
        <div style={{ marginBottom: 22 }}>
          <label style={FIELD_LABEL}>Sala</label>
          <select value={roomId} onChange={(e) => setRoomId(e.target.value)} style={INPUT_STYLE}>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn kind="soft" full onClick={onClose}>Annulla</Btn>
          <Btn kind="brand" full icon="check" onClick={save}>{saving ? "Salvataggio…" : "Salva"}</Btn>
        </div>
      </div>
    </Overlay>
  );
}

function RoomFormModal({ open, onClose }) {
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setNome(""); }, [open]);

  const save = async () => {
    if (saving) return;
    if (!String(nome).trim()) { toast("Inserisci un nome sala", { type: "error" }); return; }
    setSaving(true);
    try {
      await window.TakoActions.roomCreate(String(nome).trim());
      toast("Sala creata", { type: "success" });
      onClose();
      await window.takoReload();
    } catch (e) {
      toast(e.message, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay open={open} onClose={onClose} anchor="center">
      <div style={{ width: 360, maxWidth: "calc(100vw - 40px)", background: "var(--raised)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-pop)", padding: 24, margin: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, display: "grid", placeItems: "center", background: "var(--brand-tint)", color: "var(--brand)" }}><Icon name="grid" size={22} /></div>
          <h3 style={{ fontSize: 19, flex: 1 }}>Nuova sala</h3>
          <IconBtn name="x" tone="soft" onClick={onClose} />
        </div>
        <div style={{ marginBottom: 22 }}>
          <label style={FIELD_LABEL}>Nome</label>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} style={INPUT_STYLE} placeholder="Es. Sala interna" />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn kind="soft" full onClick={onClose}>Annulla</Btn>
          <Btn kind="brand" full icon="check" onClick={save}>{saving ? "Salvataggio…" : "Crea sala"}</Btn>
        </div>
      </div>
    </Overlay>
  );
}

function ScreenTavoli({ mobile }) {
  const all = ROOMS.flatMap(r => r.tables.map(t => ({ ...t, room: r.nome, roomId: r.id })));
  const rooms = ROOMS;
  const [tableModal, setTableModal] = useState(null); // { table: null|t } quando aperto
  const [roomModal, setRoomModal] = useState(false);
  const [delTarget, setDelTarget] = useState(null);

  const confirmDelete = async () => {
    const t = delTarget;
    if (!t) return;
    try {
      await window.TakoActions.tableDelete(t._id);
      toast("Tavolo " + t.n + " eliminato", { type: "success" });
      await window.takoReload();
    } catch (e) {
      toast(e.message, { type: "error" });
    }
  };

  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} title="Gestione Tavoli" sub={`${all.length} tavoli · ${ROOMS.length} sale`}
        actions={<div style={{ display: "flex", gap: 9 }}>
          <Btn kind="soft" icon="plus" onClick={() => setRoomModal(true)}>Nuova sala</Btn>
          <Btn kind="brand" icon="plus" onClick={() => setTableModal({ table: null })}>Nuovo tavolo</Btn>
        </div>} />
      {all.length === 0 ? (
        <Empty tako="neutral" title={ROOMS.length === 0 ? "Nessuna sala ancora — creane una per iniziare" : "Nessun tavolo in questa sala"}
          sub={ROOMS.length === 0 ? "Crea prima una sala, poi aggiungi i tavoli con i loro posti." : "Aggiungi il primo tavolo con «Nuovo tavolo»."}
          action={ROOMS.length === 0
            ? <Btn kind="brand" icon="plus" onClick={() => setRoomModal(true)}>Nuova sala</Btn>
            : <Btn kind="brand" icon="plus" onClick={() => setTableModal({ table: null })}>Nuovo tavolo</Btn>} />
      ) : (
      <Card pad={0} style={{ overflow: "hidden" }}>
        {all.map((t, i) => (
          <div key={t.n} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderBottom: i < all.length - 1 ? "1px solid var(--hairline)" : "none" }}>
            <span className="num" style={{ width: 40, height: 40, borderRadius: 11, background: "var(--sunken)", display: "grid", placeItems: "center", fontSize: 17 }}>{t.n}</span>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14.5 }}>Tavolo {t.n}</div><div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{t.room} · {t.posti} posti</div></div>
            <IconBtn name="edit" tone="ghost" onClick={() => setTableModal({ table: t })} />
            <IconBtn name="trash" tone="ghost" style={{ color: "var(--danger)" }} onClick={() => setDelTarget(t)} />
          </div>
        ))}
      </Card>
      )}

      <TableFormModal open={!!tableModal} table={tableModal ? tableModal.table : null} rooms={rooms} onClose={() => setTableModal(null)} />
      <RoomFormModal open={roomModal} onClose={() => setRoomModal(false)} />
      <Confirm open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={confirmDelete} danger
        title={delTarget ? "Eliminare il Tavolo " + delTarget.n + "?" : "Eliminare il tavolo?"}
        body="Questa azione è definitiva e invalida il QR associato al tavolo." confirmLabel="Elimina" />
    </ScreenScroll>
  );
}

/* ═══════════════════ QR CODES ═══════════════════ */
// Copia un URL negli appunti con feedback (checkmark) — usato per gli URL alternativi del QR.
function QrAltRow({ label, hint, value }) {
  const [done, setDone] = useState(false);
  if (!value) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); toast("Copiato", { type: "success" }); setTimeout(() => setDone(false), 1300); }
    catch (_) { toast(value); }
  };
  return (
    <button className="press" onClick={copy} title={value} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "7px 9px", borderRadius: 10, background: "var(--sunken)", border: "1px solid var(--hairline)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)" }}>{label} <span style={{ color: "var(--ink-3)", fontWeight: 500 }}>· {hint}</span></div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      </div>
      <Icon name={done ? "check" : "copy"} size={15} style={{ flex: "none", color: done ? "var(--ok-deep)" : "var(--ink-3)" }} />
    </button>
  );
}
function QrCard({ t, onDownload, onDelete }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState("lan");
  const [alts, setAlts] = useState({ lanUrl: "", cloudUrl: "", ipUrl: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const q = await window.TakoActions.tableQr(t._id);
      setQrDataUrl(q.qrDataUrl || "");
      setUrl(q.url || "");
      setMode(q.mode || "lan");
      setAlts({ lanUrl: q.lanUrl || "", cloudUrl: q.cloudUrl || "", ipUrl: q.ipUrl || "" });
    } catch (e) {
      toast(e.message, { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [t._id]);

  const regen = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await window.TakoActions.tableQrRefresh(t._id);
      await load();
      toast("QR rigenerato", { type: "success" });
    } catch (e) {
      toast(e.message, { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); toast("Link copiato", { type: "success" }); }
    catch (_) { toast(url || "Link non disponibile"); }
  };
  const openLink = () => { try { window.open(url, "_blank"); } catch (_) { toast("Impossibile aprire il link", { type: "error" }); } };

  return (
    <Card pad={16} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%", minWidth: 0, overflow: "hidden" }}>
      {loading ? (
        <div style={{ width: 120, height: 120, borderRadius: 10, background: "var(--sunken)", display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 12 }}>…</div>
      ) : qrDataUrl ? (
        <img src={qrDataUrl} alt={`QR tavolo ${t.n}`} style={{ width: 120, height: 120, borderRadius: 10 }} />
      ) : (
        <div style={{ width: 120, height: 120, borderRadius: 10, background: "var(--sunken)", display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 12, textAlign: "center", padding: 8 }}>QR non disponibile</div>
      )}
      <div style={{ textAlign: "center", maxWidth: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <span style={{ fontWeight: 800, fontFamily: "var(--f-display)" }}>Tavolo {t.n}</span>
          <Badge tone={mode === "cloud" ? "info" : "ok"}>{mode === "cloud" ? "Cloud" : "LAN"}</Badge>
        </div>
        <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={url}>{url || "—"}</div>
      </div>
      {/* URL alternativi: il QR usa `mode`, ma qui puoi copiare gli altri accessi. */}
      {(alts.lanUrl || alts.cloudUrl || alts.ipUrl) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
          <QrAltRow label="tako.local" hint="offline" value={alts.lanUrl} />
          <QrAltRow label="Cloud" hint="accesso da fuori" value={alts.cloudUrl} />
          <QrAltRow label="IP diretto" hint="telefoni senza mDNS" value={alts.ipUrl} />
        </div>
      )}
      <div style={{ display: "flex", gap: 8, width: "100%", flexWrap: "wrap" }}>
        <Btn size="sm" kind="ghost" icon="refresh" onClick={regen} style={{ flex: "1 1 90px", minWidth: 0 }}>{busy ? "Rigenero…" : "Rigenera"}</Btn>
        <Btn size="sm" kind="soft" icon="download" onClick={() => onDownload(t, qrDataUrl)} style={{ flex: "1 1 90px", minWidth: 0 }}>Scarica</Btn>
      </div>
      <div style={{ display: "flex", gap: 8, width: "100%", justifyContent: "center" }}>
        <IconBtn name="qr" tone="soft" onClick={copyLink} title="Copia link" />
        <IconBtn name="phone" tone="soft" onClick={openLink} title="Apri anteprima cliente" />
        <IconBtn name="trash" tone="soft" style={{ color: "var(--danger)" }} onClick={() => onDelete(t)} title="Elimina tavolo + QR" />
      </div>
    </Card>
  );
}

function ScreenQR({ mobile }) {
  const all = ROOMS.flatMap(r => r.tables);
  const [delTarget, setDelTarget] = useState(null);
  const [net, setNet] = useState(null);
  const [netKey, setNetKey] = useState(0);
  const [netBusy, setNetBusy] = useState(false);

  const loadNet = async () => {
    try { setNet(await window.TakoActions.systemInfo()); }
    catch (e) { setNet(null); }
  };
  useEffect(() => { loadNet(); }, []);

  // Ricalcola la rete (IP corrente) e forza i QR a rigenerarsi con il nuovo IP.
  const refreshNet = async () => {
    if (netBusy) return;
    setNetBusy(true);
    try {
      await loadNet();
      setNetKey(k => k + 1); // rimonta le QrCard → nuova fetch /tables/:id/qr
      toast("Rete aggiornata: QR rigenerati con l'IP corrente", { type: "success" });
    } finally {
      setNetBusy(false);
    }
  };

  const confirmDelete = async () => {
    const t = delTarget;
    if (!t) return;
    try {
      await window.TakoActions.tableDelete(t._id);
      toast(`Tavolo ${t.n} eliminato`, { type: "success" });
      await window.takoReload();
    } catch (e) {
      toast(e.message, { type: "error" });
    }
  };

  const downloadQr = async (t, preloaded) => {
    try {
      const qrDataUrl = preloaded || (await window.TakoActions.tableQr(t._id)).qrDataUrl;
      if (!qrDataUrl) throw new Error("QR non disponibile");
      const a = document.createElement("a");
      a.href = qrDataUrl;
      a.download = `qr-tavolo-${t.n}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast(`QR tavolo ${t.n} scaricato`, { type: "success" });
    } catch (e) {
      toast(e.message, { type: "error" });
    }
  };

  const downloadAll = async () => {
    try {
      for (const t of all) {
        const { qrDataUrl } = await window.TakoActions.tableQr(t._id);
        if (!qrDataUrl) continue;
        const a = document.createElement("a");
        a.href = qrDataUrl;
        a.download = `qr-tavolo-${t.n}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      toast("QR scaricati", { type: "success" });
    } catch (e) {
      toast(e.message, { type: "error" });
    }
  };

  const clientUrl = net && (net.clientBaseUrl || (net.urls && net.urls.client));
  const lanIP = net && (net.lanIP || (net.lanIPs && net.lanIPs[0]));

  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="phone" title="QR Codes" sub="Genera e scarica i QR dei tavoli" actions={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Btn kind="soft" icon="qr" onClick={refreshNet} disabled={netBusy}>{netBusy ? "Aggiorno…" : "Aggiorna rete"}</Btn>
          <Btn kind="brand" icon="download" onClick={downloadAll}>Scarica tutti</Btn>
        </div>
      } />
      <Card style={{ marginBottom: 14, padding: 14, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginBottom: 2 }}>Rete attuale del Mac — i QR puntano qui</div>
          <div className="mono" style={{ fontSize: 13.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {clientUrl || "Rilevamento rete…"}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
            {lanIP ? `IP LAN: ${lanIP}` : "Nessun IP LAN rilevato"} · si aggiorna da solo al cambio WiFi
          </div>
        </div>
        <Btn size="sm" kind="soft" icon="qr" onClick={refreshNet} disabled={netBusy}>{netBusy ? "Aggiorno…" : "Aggiorna ora"}</Btn>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
        {all.map(t => (
          <QrCard key={t.n + ":" + netKey} t={t} onDownload={downloadQr} onDelete={setDelTarget} />
        ))}
      </div>
      <Confirm open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={confirmDelete} danger
        title={delTarget ? `Eliminare il Tavolo ${delTarget.n}?` : "Eliminare?"}
        body="Il tavolo e il suo QR verranno rimossi. I clienti che scansionano il vecchio QR non potranno più ordinare."
        confirmLabel="Elimina tavolo" />
    </ScreenScroll>
  );
}

Object.assign(window, { ScreenSala, ScreenCassa, ScreenComanda, ScreenTavoli, ScreenQR });
