/* ───────────────── Tako Dashboard — app root ───────────────── */

/* pool per nuovi ordini real-time */
const NEW_ORDER_POOL = [
  { tavolo: 7, items: [{ nome: "Pizza Margherita", qty: 2, prezzo: 8, station: "Pizzeria", note: "", stato: "attesa" }, { nome: "Coca Cola", qty: 2, prezzo: 4, station: "Bar", note: "", stato: "attesa" }] },
  { tavolo: 13, items: [{ nome: "Tagliata di manzo", qty: 1, prezzo: 22, station: "Griglia", note: "Ben cotta", stato: "attesa" }, { nome: "Vino Vermentino", qty: 1, prezzo: 24, station: "Bar", note: "", stato: "attesa" }] },
  { tavolo: 1, items: [{ nome: "Tonnarelli cacio e pepe", qty: 2, prezzo: 13, station: "Cucina", note: "", stato: "attesa" }, { nome: "Tiramisù", qty: 2, prezzo: 6, station: "Cucina", note: "", stato: "attesa" }] },
  { tavolo: 10, items: [{ nome: "Spaghetti alle vongole", qty: 3, prezzo: 15, station: "Cucina", note: "1 senza aglio", stato: "attesa" }] },
];

function load(k, d) { try { const v = localStorage.getItem("tako-dash-" + k); return v ?? d; } catch (_) { return d; } }
function save(k, v) { try { localStorage.setItem("tako-dash-" + k, v); } catch (_) {} }

// showcase sync mode: no random orders, only real ones pushed from the phone; don't persist prefs
const SYNC = (() => { try { return new URLSearchParams(location.search).has("sync"); } catch (_) { return false; } })();

function App() {
  const [frame, setFrame] = useState("desktop");
  const [role, setRole] = useState(() => load("role", "owner"));
  const [route, setRoute] = useState(() => SYNC ? "ordini" : load("route", "dashboard"));
  const [brand, setBrand] = useState(() => load("brand", "arancione"));
  const [settings, setSettings] = useState(() => { try { return { ...SETTINGS_DEFAULTS, ...JSON.parse(localStorage.getItem("tako-dash-settings") || "{}") }; } catch (_) { return SETTINGS_DEFAULTS; } });
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const mobileRef = useRef(false);
  const [drawer, setDrawer] = useState(false);
  const stageRef = useRef(null);
  const [mScale, setMScale] = useState(1);

  const [orders, setOrders] = useState(ORDERS);
  const [calls, setCalls] = useState(SYNC ? [] : WAITER_CALLS);
  const [rooms, setRooms] = useState(ROOMS);
  const [bills, setBills] = useState(BILLS);
  const seq = useRef(243);

  const mobile = frame === "mobile";
  useEffect(() => { if (!SYNC) save("frame", frame); }, [frame]);
  useEffect(() => { if (!SYNC) save("role", role); }, [role]);
  useEffect(() => { if (!SYNC) save("route", route); }, [route]);
  useEffect(() => { if (!SYNC) save("brand", brand); }, [brand]);
  useEffect(() => { if (!SYNC) { try { localStorage.setItem("tako-dash-settings", JSON.stringify(settings)); } catch (_) {} } }, [settings]);

  // se il ruolo cambia e la route non è accessibile, vai alla home del ruolo
  useEffect(() => {
    const allow = ROLE_ACCESS[role];
    if (allow && !allow.includes(route)) setRoute(ROLE_HOME[role]);
  }, [role]);

  const go = (id) => { setRoute(id); setDrawer(false); };

  // auto-fit del telefono nello stage (mobile)
  useEffect(() => {
    if (!mobile) return;
    const el = stageRef.current; if (!el) return;
    const calc = () => { const h = el.clientHeight, w = el.clientWidth; const s = Math.min(1, (h - 24) / 858, (w - 24) / 402); setMScale(s > 0 ? s : 1); };
    calc();
    const ro = new ResizeObserver(calc); ro.observe(el);
    window.addEventListener("resize", calc);
    return () => { ro.disconnect(); window.removeEventListener("resize", calc); };
  }, [mobile]);

  // ── handlers ordini ──
  const setStato = (id, stato) => setOrders(os => os.map(o => o.id === id ? { ...o, stato, isNew: false } : o));
  const onConfirm = (id) => { setStato(id, "confermato"); toast("Ordine confermato", { type: "success" }); };
  const onServe = (id) => { setStato(id, "servito"); toast("Ordine servito", { type: "success", icon: "check" }); };
  const onCancel = (id) => { setStato(id, "annullato"); toast("Ordine annullato", { type: "error" }); };
  const onAdvanceItem = (id, nome) => setOrders(os => os.map(o => {
    if (o.id !== id) return o;
    const items = o.items.map(it => it.nome === nome ? { ...it, stato: it.stato === "attesa" ? "prep" : "pronto" } : it);
    const allReady = items.every(it => it.stato === "pronto");
    return { ...o, items, stato: allReady ? "pronto" : (o.stato === "attesa" ? "prep" : o.stato), isNew: false };
  }));
  const onBump = (id) => { setOrders(os => os.map(o => o.id === id ? { ...o, stato: "pronto", items: o.items.map(it => ({ ...it, stato: "pronto" })), isNew: false } : o)); toast("Ordine pronto · servito", { type: "success", icon: "check" }); };
  const onSetTableState = (n, stato) => { setRooms(rs => rs.map(r => ({ ...r, tables: r.tables.map(t => t.n === n ? { ...t, stato } : t) }))); toast(`Tavolo ${n} → ${TABLE_STATUS[stato].label}`); };
  const onCloseBill = (id) => setBills(bs => bs.filter(b => b.id !== id));

  const playBeep = () => { try { const ac = new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.type = "sine"; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.25); o.start(); o.stop(ac.currentTime + 0.26); } catch (_) {} };

  // ── simulazione real-time: nuovo ordine ogni 15s (disattivata in sync mode) ──
  useEffect(() => {
    if (SYNC) return;
    const t = setInterval(() => {
      seq.current += 1;
      const tpl = NEW_ORDER_POOL[Math.floor(Math.random() * NEW_ORDER_POOL.length)];
      const id = `T${String(tpl.tavolo).padStart(2, "0")}-${seq.current}`;
      const now = new Date();
      const order = { id, tavolo: tpl.tavolo, tipo: "tavolo", stato: settingsRef.current.autoConferma ? "confermato" : "attesa", orario: now.toTimeString().slice(0, 5), min: 0, note: "", items: tpl.items.map(i => ({ ...i })), isNew: true };
      setOrders(os => [order, ...os.filter(o => o.id !== id)]);
      if (settingsRef.current.suoniOrdini) playBeep();
      const payload = { title: `Nuovo ordine · Tavolo ${tpl.tavolo}`, sub: `${tpl.items.reduce((a, i) => a + i.qty, 0)} piatti`, icon: "bell" };
      if (mobileRef.current) pushLiveNotif(payload); else toast(payload.title, { type: "info", icon: "orders", sub: payload.sub });
      setTimeout(() => setOrders(os => os.map(o => o.id === id ? { ...o, isNew: false } : o)), 1200);
    }, 15000);
    return () => clearInterval(t);
  }, []);

  // ── sync mode: ricevi eventi reali dall'iPhone (ordine + chiamate cameriere) via showcase relay ──
  useEffect(() => {
    if (!SYNC) return;
    const notify = (payload) => {
      if (settingsRef.current.suoniOrdini) playBeep();
      if (mobileRef.current) pushLiveNotif(payload); else toast(payload.title, { type: "info", icon: payload.icon || "bell", sub: payload.sub });
    };
    const onMsg = (e) => {
      const d = e.data; if (!d || d.source !== "tako-sync") return;

      if (d.type === "new-order") {
        const o = d.order || {};
        seq.current += 1;
        const now = new Date();
        const id = o.orderId || `T${String(o.tavolo).padStart(2, "0")}-${seq.current}`;
        const order = { id, tavolo: o.tavolo, tipo: "tavolo", stato: "attesa", orario: now.toTimeString().slice(0, 5), min: 0, note: "", items: (o.items || []).map(i => ({ ...i })), isNew: true };
        // più tavoli attivi: gli ordini si accumulano (max 9), senza azzerare la sala
        setOrders(os => [order, ...os.filter(x => x.id !== id)].slice(0, 9));
        setRoute("ordini");
        notify({ title: `Nuovo ordine · Tavolo ${o.tavolo}`, sub: `${(o.items || []).reduce((a, i) => a + i.qty, 0)} piatti`, icon: "orders" });
        setTimeout(() => setOrders(os => os.map(x => x.id === id ? { ...x, isNew: false } : x)), 1800);
      }

      if (d.type === "waiter-call") {
        const c = d.call || {};
        setCalls(cs => [...cs, { tavolo: c.tavolo, motivo: c.motivo, min: 0 }].slice(-6));
        notify({ title: `Chiamata cameriere · Tavolo ${c.tavolo}`, sub: c.motivo, icon: "bell" });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const activeOrders = orders.filter(o => ["attesa", "confermato", "prep", "pronto"].includes(o.stato)).length;
  const badges = { ordini: activeOrders };

  CUR.sym = CURRENCIES[settings.valuta] || "€";

  // ── screen routing ──
  let Screen;
  switch (route) {
    case "dashboard": Screen = <ScreenDashboard mobile={mobile} go={go} orders={orders} settings={settings} />; break;
    case "ordini": Screen = <ScreenOrdini mobile={mobile} orders={orders} onConfirm={onConfirm} onServe={onServe} onCancel={onCancel} go={go} />; break;
    case "kds": Screen = <ScreenKDS mobile={mobile} orders={orders} onAdvanceItem={onAdvanceItem} onBump={onBump} settings={settings} />; break;
    case "cassa": Screen = <ScreenCassa mobile={mobile} bills={bills} onClose={onCloseBill} settings={settings} />; break;
    case "comanda": Screen = <ScreenComanda mobile={mobile} />; break;
    case "sala": Screen = <ScreenSala mobile={mobile} rooms={rooms} calls={SYNC ? calls : WAITER_CALLS} onSetTableState={onSetTableState} onResolveCall={(i) => setCalls(cs => cs.filter((_, j) => j !== i))} />; break;
    case "tavoli": Screen = <ScreenTavoli mobile={mobile} />; break;
    case "qr": Screen = <ScreenQR mobile={mobile} />; break;
    case "menu": Screen = <ScreenMenu mobile={mobile} />; break;
    case "inventario": Screen = <ScreenInventario mobile={mobile} />; break;
    case "statistiche": Screen = <ScreenStatistiche mobile={mobile} />; break;
    case "insights": Screen = <ScreenInsights mobile={mobile} />; break;
    case "staff": Screen = <ScreenStaff mobile={mobile} />; break;
    case "impostazioni": Screen = <ScreenImpostazioni mobile={mobile} brand={brand} setBrand={setBrand} settings={settings} setSettings={setSettings} />; break;
    default: Screen = <ScreenDashboard mobile={mobile} go={go} orders={orders} settings={settings} />;
  }

  const p = BRAND_PALETTES[brand] || BRAND_PALETTES.arancione;
  mobileRef.current = mobile;
  const brandVars = { "--brand": p.brand, "--brand-deep": p.deep, "--brand-tint": p.tint, "--brand-wash": p.wash, "--on-brand": p.on };

  return (
    <TakoCtx.Provider value={brand}>
      {/* stage */}
      <div className={"stage-area" + (mobile ? " mobile" : "")} ref={stageRef}>
        {mobile ? (
          <div style={{ width: 402 * mScale, height: 858 * mScale, flex: "none" }}>
            <div className="host-mobile" style={{ transform: `scale(${mScale})`, transformOrigin: "top left" }}>
              <div className="screen" style={brandVars}>
                <div style={{ width: "100%", height: "100%", position: "relative", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--surface)" }}>
                  <div style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", flexDirection: "column" }}>
                    {Screen}
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, background: "rgba(251,248,244,.55)", backdropFilter: "blur(16px) saturate(180%)", WebkitBackdropFilter: "blur(16px) saturate(180%)" }}>
                      <IOSStatusBar />
                      <MobileHeader route={route} openDrawer={() => setDrawer(true)} live role={role} badges={badges} nome={settings.nome} go={go} />
                    </div>
                  </div>
                  <BottomBar route={route} go={go} role={role} badges={badges} openDrawer={() => setDrawer(true)} />
                  <HomeIndicator />
                  <MobileDrawer open={drawer} onClose={() => setDrawer(false)} route={route} go={go} role={role} badges={badges} />
                </div>
                <Toaster mobile />
              </div>
            </div>
          </div>
        ) : (
          <div className="host-desktop">
            <div className="screen" style={brandVars}>
              <div style={{ width: "100%", height: "100%", display: "flex", background: "var(--bg)" }}>
                <Sidebar route={route} go={go} role={role} badges={badges} live />
                <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }}>
                  {Screen}
                </main>
              </div>
              <Toaster mobile={false} />
            </div>
          </div>
        )}
      </div>
    </TakoCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("stage")).render(<App />);
