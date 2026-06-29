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

/* ═══════════════════ SALA LIVE ═══════════════════ */
function ScreenSala({ mobile, rooms, calls, onSetTableState }) {
  const [roomId, setRoomId] = useState(rooms[0].id);
  const [sel, setSel] = useState(null);
  const [pos, setPos] = useState(() => { try { return JSON.parse(localStorage.getItem("tako-dash-tablepos") || "{}"); } catch (_) { return {}; } });
  const posRef = useRef(pos); posRef.current = pos;
  const mapRef = useRef(null);
  const drag = useRef(null);
  const room = rooms.find(r => r.id === roomId);
  const counts = useMemo(() => {
    const all = rooms.flatMap(r => r.tables);
    return { occ: all.filter(t => t.stato === "occupato").length, free: all.filter(t => t.stato === "libero").length, tot: all.length };
  }, [rooms]);
  const xy = (t) => pos[roomId]?.[t.n] || { x: t.x, y: t.y };

  const onDown = (e, t) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { n: t.n, t, startX: e.clientX, startY: e.clientY, moved: false };
  };
  const onMove = (e) => {
    const d = drag.current; if (!d || !mapRef.current) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return;
    d.moved = true;
    const r = mapRef.current.getBoundingClientRect();
    let x = ((e.clientX - r.left) / r.width) * 100;
    let y = ((e.clientY - r.top) / r.height) * 100;
    x = Math.max(5, Math.min(95, x)); y = Math.max(7, Math.min(93, y));
    setPos(p => ({ ...p, [roomId]: { ...(p[roomId] || {}), [d.n]: { x: Math.round(x), y: Math.round(y) } } }));
  };
  const onUp = async (e) => {
    const d = drag.current; if (!d) return;
    e.currentTarget?.releasePointerCapture?.(e.pointerId);
    drag.current = null;
    if (d.moved) {
      try { localStorage.setItem("tako-dash-tablepos", JSON.stringify(posRef.current)); } catch (_) {}
      const p = posRef.current[roomId]?.[d.n];
      if (p) {
        const posX = Math.max(0, Math.min(100, Math.round(p.x)));
        const posY = Math.max(0, Math.min(100, Math.round(p.y)));
        try { await window.TakoActions.tableUpdate(d.t._id, { posX, posY }); }
        catch (err) { toast(err.message, { type: "error" }); }
      }
    } else { setSel(d.t); }
  };
  const resetLayout = () => { const n = { ...pos }; delete n[roomId]; setPos(n); try { localStorage.setItem("tako-dash-tablepos", JSON.stringify(n)); } catch (_) {} toast("Disposizione ripristinata"); };
  const hasCustom = pos[roomId] && Object.keys(pos[roomId]).length > 0;

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
          {room.tables.map(t => {
            const st = TABLE_STATUS[t.stato];
            const p = xy(t);
            const dragging = drag.current && drag.current.n === t.n;
            return (
              <button key={t.n} onPointerDown={(e) => onDown(e, t)} onPointerMove={onMove} onPointerUp={onUp}
                style={{ position: "absolute", left: p.x + "%", top: p.y + "%", width: mobile ? 54 : 68, height: mobile ? 54 : 68, borderRadius: t.posti >= 6 ? 14 : "50%", transform: "translate(-50%,-50%)",
                  background: "var(--raised)", border: `3px solid ${st.color}`, boxShadow: dragging ? "var(--sh-3)" : "var(--sh-1)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                  cursor: "grab", zIndex: dragging ? 5 : 1, touchAction: "none", userSelect: "none" }}>
                <span className="num" style={{ fontSize: mobile ? 17 : 20, color: "var(--ink)" }}>{t.n}</span>
                <span style={{ fontSize: 9.5, color: "var(--ink-3)", fontWeight: 700 }}>{t.posti}p</span>
                <span style={{ position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: 99, background: st.color, border: "2px solid var(--raised)" }} />
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

      <Overlay open={!!sel} onClose={() => setSel(null)} anchor={mobile ? "center" : "right"}>
        {sel && <TableDrawer table={sel} mobile={mobile} onClose={() => setSel(null)} onSetState={(s) => { onSetTableState(sel.n, s); setSel(null); }} />}
      </Overlay>
    </ScreenScroll>
  );
}
function TableDrawer({ table, mobile, onClose, onSetState }) {
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
      </div>
    </div>
  );
}

/* ═══════════════════ CASSA ═══════════════════ */
function ScreenCassa({ mobile, bills, onClose, settings = SETTINGS_DEFAULTS }) {
  const [pay, setPay] = useState(null);
  return (
    <ScreenScroll mobile={mobile}>
      <PageHead mobile={mobile} tako="pay" title="Cassa" sub={`${bills.length} conti aperti`}
        actions={!mobile && <Btn kind="brand" icon="plus" onClick={async () => { const n = window.prompt('Numero tavolo per il nuovo conto?'); if(!n) return; try { await window.TakoActions.billCreate({ tableNumber: String(n).trim(), covers: 2 }); toast('Conto creato', {type:'success'}); await window.takoReload(); } catch(e){ toast(e.message, {type:'error'}); } }}>Nuovo conto</Btn>} />

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: mobile ? 12 : 16, marginBottom: 18 }}>
        <Kpi label="Incasso oggi" value={euro(CASSA_OGGI.incasso)} icon="coins" accent="var(--brand)" />
        <Kpi label="Mance" value={euro(CASSA_OGGI.mance)} icon="banknote" accent="var(--ok)" />
        <Kpi label="Conti chiusi" value={CASSA_OGGI.conti} icon="check" accent="var(--info)" />
        <Kpi label="Ticket medio" value={euro(CASSA_OGGI.ticket)} icon="stats" accent="var(--wait)" />
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Conti aperti</h3>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
        {bills.map(b => (
          <Card key={b.id} pad={16} className="press" style={{ cursor: "pointer" }} onClick={() => setPay(b)}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span className="num" style={{ width: 46, height: 46, borderRadius: 12, background: "var(--brand-tint)", color: "var(--brand-deep)", display: "grid", placeItems: "center", fontSize: 20 }}>{b.tavolo}</span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontFamily: "var(--f-display)", fontSize: 16 }}>Tavolo {b.tavolo}</div><div style={{ fontSize: 12, color: "var(--ink-3)" }} className="mono">{b.id} · {b.coperti} coperti · {b.apertura}</div></div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 12, color: "var(--ink-2)" }}>Totale</div><div className="num" style={{ fontSize: 26 }}>{euro(b.subtotale)}</div></div>
              <Btn size="sm" kind="brand" icon="banknote">Incassa</Btn>
            </div>
          </Card>
        ))}
      </div>

      <Overlay open={!!pay} onClose={() => setPay(null)} anchor="center">
        {pay && <PaymentModal bill={pay} mobile={mobile} settings={settings} onClose={() => setPay(null)} onDone={() => { setPay(null); onClose(pay.id); toast(`Conto T${pay.tavolo} chiuso`, { type: "success", icon: "check" }); if (settings.stampaAuto) setTimeout(() => toast("Scontrino stampato", { icon: "printer" }), 400); }} />}
      </Overlay>
    </ScreenScroll>
  );
}
function PaymentModal({ bill, mobile, onClose, onDone, settings = SETTINGS_DEFAULTS }) {
  const [method, setMethod] = useState("contanti");
  const [split, setSplit] = useState(1);
  const [given, setGiven] = useState("");
  const [tip, setTip] = useState(0);
  const cop = settings.copertoOn ? settings.coperto * bill.coperti : 0;
  const total = bill.subtotale + cop + tip;
  const perHead = total / split;
  const change = method === "contanti" && given ? Math.max(0, parseFloat(given) - total) : 0;
  const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];
  const METHOD_MAP = { contanti: "cash", carta: "card", digitale: "digital", split: "split" };
  const confirmPay = async () => {
    const METHOD_BACKEND = METHOD_MAP[method] || "cash";
    try {
      if ((tip || 0) > 0) await window.TakoActions.billUpdate(bill.id, { tip });
      await window.TakoActions.billPay(bill.id, total, METHOD_BACKEND);
      toast("Conto chiuso", { type: "success" });
      await window.takoReload();
      onClose();
    } catch (e) {
      toast(e.message, { type: "error" });
    }
  };

  return (
    <div style={{ width: mobile ? 354 : 720, maxWidth: "100%", maxHeight: mobile ? "calc(100% - 48px)" : "100%", background: "var(--surface)", borderRadius: mobile ? 24 : "var(--r-xl)", boxShadow: "var(--sh-pop)", display: "flex", flexDirection: mobile ? "column" : "row", overflow: mobile ? "auto" : "hidden" }}>
      {/* left: summary */}
      <div style={{ flex: mobile ? "none" : "0 0 280px", padding: mobile ? "16px 18px" : 22, background: "var(--nav)", color: "var(--nav-ink)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="num" style={{ width: 40, height: 40, borderRadius: 11, background: "var(--brand)", color: "#fff", display: "grid", placeItems: "center", fontSize: 18 }}>{bill.tavolo}</span><div><div style={{ fontWeight: 800, color: "#fff" }}>Tavolo {bill.tavolo}</div><div style={{ fontSize: 11.5, color: "var(--nav-ink-2)" }} className="mono">{bill.id}</div></div></div>
          {mobile && <IconBtn name="x" tone="ghost" style={{ color: "#fff" }} onClick={onClose} />}
        </div>
        <div style={{ margin: mobile ? "14px 0 8px" : "22px 0 10px" }}>
          {(cop > 0 || tip > 0) && (
            <div style={{ paddingBottom: 10, marginBottom: 6, borderBottom: "1px solid var(--nav-line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--nav-ink-2)", marginBottom: 5 }}><span>Subtotale</span><span>{euro(bill.subtotale)}</span></div>
              {cop > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--nav-ink-2)", marginBottom: 5 }}><span>Coperto · {bill.coperti}×{euro(settings.coperto)}</span><span>{euro(cop)}</span></div>}
              {tip > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--nav-ink-2)" }}><span>Mancia</span><span>{euro(tip)}</span></div>}
            </div>
          )}
          <div style={{ fontSize: 12.5, color: "var(--nav-ink-2)" }}>Totale da pagare</div>
        </div>
        <div className="num" style={{ fontSize: mobile ? 34 : 46, color: "#fff", lineHeight: 1 }}>{euro(total)}</div>
        {settings.manceSuggerite && (
          <div style={{ marginTop: mobile ? 12 : 18 }}>
            <div style={{ fontSize: 12.5, color: "var(--nav-ink-2)", marginBottom: 8 }}>Mancia suggerita</div>
            <div style={{ display: "flex", gap: 7 }}>
              {[0, 5, 10, 15].map(p => { const amt = Math.round((bill.subtotale + cop) * p) / 100; const on = tip === amt; return <button key={p} className="press" onClick={() => setTip(amt)} style={{ flex: 1, padding: "8px 0", borderRadius: 10, fontWeight: 700, fontSize: 13, background: on ? "var(--brand)" : "rgba(255,255,255,.1)", color: on ? "var(--on-brand)" : "#EDE2D6" }}>{p ? p + "%" : "No"}</button>; })}
            </div>
          </div>
        )}
        <div style={{ marginTop: mobile ? 12 : 18, paddingTop: mobile ? 12 : 16, borderTop: "1px solid var(--nav-line)", display: mobile ? "flex" : "block", alignItems: "center", gap: 10 }}>
          <div style={{ flex: "none", fontSize: 13, color: "var(--nav-ink-2)", marginBottom: mobile ? 0 : 8 }}>Dividi per</div>
          <div style={{ display: "flex", alignItems: "center", gap: mobile ? 8 : 10, flex: 1 }}>
            <IconBtn name="minus" tone="ghost" size={mobile ? 32 : 36} style={{ background: "rgba(255,255,255,.1)", color: "#fff" }} onClick={() => setSplit(s => Math.max(1, s - 1))} />
            <div style={{ flex: 1, textAlign: "center" }}><div className="num" style={{ fontSize: mobile ? 18 : 22, color: "var(--brand)" }}>{euro(perHead)}</div><div style={{ fontSize: 11, color: "var(--nav-ink-2)" }}>{split}× a testa</div></div>
            <IconBtn name="plus" tone="ghost" size={mobile ? 32 : 36} style={{ background: "rgba(255,255,255,.1)", color: "#fff" }} onClick={() => setSplit(s => Math.min(bill.coperti, s + 1))} />
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
            <div><Icon name={method === "carta" ? "card" : "smartphone"} size={44} style={{ color: "var(--brand)", margin: "0 auto 12px" }} /><div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 16 }}>{method === "carta" ? "Avvicina la carta al POS" : "Mostra il QR al cliente"}</div><div style={{ fontSize: 13.5, marginTop: 6 }}>In attesa di {euro(total)}…</div></div>
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
  const [sez, setSez] = useState(MENU[0].sezione);
  const [sending, setSending] = useState(false);
  const freeTables = ROOMS.flatMap(r => r.tables);
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
      await window.TakoActions.staffOrder({ tableId: tav._id, tableNumber: tav.n, type: "table", items: orderItems });
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

  if (!tavolo) {
    return (
      <ScreenScroll mobile={mobile}>
        <PageHead mobile={mobile} tako="phone" title="Comanda" sub="Seleziona il tavolo per cui prendere l'ordine" />
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(3,1fr)" : "repeat(auto-fill,minmax(110px,1fr))", gap: 12 }}>
          {freeTables.map(t => {
            const st = TABLE_STATUS[t.stato];
            return <button key={t.n} className="press" onClick={() => setTavolo(t.n)} style={{ aspectRatio: "1", borderRadius: 16, background: "var(--raised)", border: `2px solid ${st.color}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, boxShadow: "var(--sh-1)" }}><span className="num" style={{ fontSize: 26 }}>{t.n}</span><span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600 }}>{t.posti} posti</span></button>;
          })}
        </div>
      </ScreenScroll>
    );
  }

  const section = MENU.find(s => s.sezione === sez);
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
                ) : <Btn size="sm" kind="soft" full icon="plus" onClick={() => add(p.nome)}>Aggiungi</Btn>) : <Badge tone="danger">Esaurito · 86</Badge>}
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

function TableFormModal({ open, onClose, table, rooms }) {
  // table = null → nuovo; altrimenti modifica
  const [numero, setNumero] = useState("");
  const [posti, setPosti] = useState(4);
  const [roomId, setRoomId] = useState(rooms[0] ? rooms[0].id : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (table) {
      setNumero(String(table.n));
      setPosti(table.posti);
      setRoomId(table.roomId || (rooms[0] ? rooms[0].id : ""));
    } else {
      setNumero("");
      setPosti(4);
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
        await window.TakoActions.tableUpdate(table._id, { number: String(numero).trim(), seats: Number(posti) || table.posti, roomId });
        toast("Tavolo " + String(numero).trim() + " aggiornato", { type: "success" });
      } else {
        await window.TakoActions.tableCreate({ number: String(numero).trim(), seats: Number(posti) || 4, roomId });
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

      <TableFormModal open={!!tableModal} table={tableModal ? tableModal.table : null} rooms={rooms} onClose={() => setTableModal(null)} />
      <RoomFormModal open={roomModal} onClose={() => setRoomModal(false)} />
      <Confirm open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={confirmDelete} danger
        title={delTarget ? "Eliminare il Tavolo " + delTarget.n + "?" : "Eliminare il tavolo?"}
        body="Questa azione è definitiva e invalida il QR associato al tavolo." confirmLabel="Elimina" />
    </ScreenScroll>
  );
}

/* ═══════════════════ QR CODES ═══════════════════ */
function QrCard({ t, onDownload, onDelete }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const q = await window.TakoActions.tableQr(t._id);
      setQrDataUrl(q.qrDataUrl || "");
      setUrl(q.url || "");
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
    <Card pad={16} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {loading ? (
        <div style={{ width: 120, height: 120, borderRadius: 10, background: "var(--sunken)", display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 12 }}>…</div>
      ) : qrDataUrl ? (
        <img src={qrDataUrl} alt={`QR tavolo ${t.n}`} style={{ width: 120, height: 120, borderRadius: 10 }} />
      ) : (
        <div style={{ width: 120, height: 120, borderRadius: 10, background: "var(--sunken)", display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 12, textAlign: "center", padding: 8 }}>QR non disponibile</div>
      )}
      <div style={{ textAlign: "center", maxWidth: "100%" }}>
        <div style={{ fontWeight: 800, fontFamily: "var(--f-display)" }}>Tavolo {t.n}</div>
        <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={url}>{url || "—"}</div>
      </div>
      <div style={{ display: "flex", gap: 8, width: "100%" }}>
        <Btn size="sm" kind="ghost" full icon="refresh" onClick={regen}>{busy ? "Rigenero…" : "Rigenera"}</Btn>
        <Btn size="sm" kind="soft" full icon="download" onClick={() => onDownload(t, qrDataUrl)}>Scarica</Btn>
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
        <div style={{ display: "flex", gap: 8 }}>
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
