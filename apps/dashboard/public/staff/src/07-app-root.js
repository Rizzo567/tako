/* ───────────────── Tako Dashboard — app root REALE (wired) ─────────────────
   UI verbatim del prototipo, collegata al backend. Niente toolbar "prototipo",
   niente toggle desktop/mobile finto, niente generatore di ordini finti. */

function load(k, d) { try { const v = localStorage.getItem("tako-dash-" + k); return v ?? d; } catch (_) { return d; } }
function save(k, v) { try { localStorage.setItem("tako-dash-" + k, v); } catch (_) {} }

const HEX2BRAND = Object.fromEntries(Object.entries(BRAND_PALETTES).map(([k, p]) => [p.brand.toLowerCase(), k]));

/* ── schermata login (on-brand, minimale) ── */
function Login({ onDone }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const d = await TakoAPI.post("/auth/login", { email: email.trim(), password }); onDone(d); }
    catch (ex) { setErr(ex.status === 429 ? "Troppi tentativi, riprova tra qualche minuto." : "Email o password non validi."); }
    finally { setBusy(false); }
  };
  const p = BRAND_PALETTES.arancione;
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg, #FBF8F4)", padding: 24,
      "--brand": p.brand, "--brand-deep": p.deep, "--brand-tint": p.tint, "--brand-wash": p.wash, "--on-brand": p.on }}>
      <form onSubmit={submit} style={{ width: 360, maxWidth: "100%", background: "var(--surface,#fff)", borderRadius: 20, padding: 28, boxShadow: "0 8px 40px rgba(0,0,0,.08)", border: "1px solid var(--hairline,#eee)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <img src="assets/takos/arancione/piatto.png" alt="Tako" style={{ width: 76, height: 76, objectFit: "contain" }} />
          <div style={{ fontFamily: "var(--font-display, inherit)", fontWeight: 900, fontSize: 24, color: "var(--ink,#2A1F1A)" }}>Tako</div>
          <div style={{ fontSize: 13.5, color: "var(--ink3,#888)" }}>Accedi alla dashboard</div>
        </div>
        <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2,#555)" }}>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoFocus required
          style={{ width: "100%", margin: "6px 0 14px", padding: "11px 12px", borderRadius: 11, border: "1px solid var(--hairline,#ddd)", fontSize: 14.5, background: "var(--sunken,#fafafa)" }} />
        <label style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2,#555)" }}>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required
          style={{ width: "100%", margin: "6px 0 6px", padding: "11px 12px", borderRadius: 11, border: "1px solid var(--hairline,#ddd)", fontSize: 14.5, background: "var(--sunken,#fafafa)" }} />
        {err && <div style={{ color: "var(--danger,#d9533a)", fontSize: 13, margin: "8px 0" }}>{err}</div>}
        <button type="submit" disabled={busy}
          style={{ width: "100%", marginTop: 14, padding: "12px", borderRadius: 12, border: "none", background: "var(--brand)", color: "var(--on-brand)", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: busy ? .6 : 1 }}>
          {busy ? "Accesso…" : "Entra"}
        </button>
      </form>
    </div>
  );
}

function App({ session }) {
  const role0 = ROLE_DB2UI[session.user.role] || "owner";
  ROLES[role0] = { ...ROLES[role0], name: session.user.name, initials: (session.user.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() };
  const [route, setRoute] = useState(() => { const r = load("route", ROLE_HOME[role0] || "dashboard"); const allow = ROLE_ACCESS[role0]; return (!allow || allow.includes(r)) ? r : (ROLE_HOME[role0] || "dashboard"); });
  const [brand, setBrand] = useState(() => HEX2BRAND[(RESTAURANT.brand || "").toLowerCase()] || load("brand", "arancione"));
  const [settings, setSettings] = useState(() => ({ ...SETTINGS_DEFAULTS, ...(() => { try { return JSON.parse(localStorage.getItem("tako-dash-settings") || "{}"); } catch (_) { return {}; } })() }));
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const role = role0;
  const [drawer, setDrawer] = useState(false);
  const [frame, setFrame] = useState(() => (typeof window !== "undefined" && window.innerWidth < 900 ? "mobile" : "desktop"));
  const mobile = frame === "mobile";
  const mobileRef = useRef(mobile); mobileRef.current = mobile;

  const [orders, setOrders] = useState(window._ORDERS);
  const [rooms, setRooms] = useState(window._ROOMS);
  const [bills, setBills] = useState(window._BILLS);
  const [calls, setCalls] = useState([]);
  const [, setTick] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);
  const bump = () => setTick((t) => t + 1);

  // refresh globale + navigazione richiamabili dalle schermate
  useEffect(() => {
    window.takoReload = async () => {
      try { await loadAll(); setOrders(window._ORDERS); setRooms(window._ROOMS); setBills(window._BILLS); setDataVersion((v) => v + 1); bump(); } catch (_) {}
    };
    window.takoGo = (id) => go(id);
    return () => { delete window.takoReload; delete window.takoGo; };
  }, []);

  useEffect(() => save("route", route), [route]);
  useEffect(() => save("brand", brand), [brand]);
  useEffect(() => { try { localStorage.setItem("tako-dash-settings", JSON.stringify(settings)); } catch (_) {} }, [settings]);
  useEffect(() => { const onR = () => setFrame(window.innerWidth < 900 ? "mobile" : "desktop"); window.addEventListener("resize", onR); return () => window.removeEventListener("resize", onR); }, []);
  useEffect(() => { const allow = ROLE_ACCESS[role]; if (allow && !allow.includes(route)) setRoute(ROLE_HOME[role]); }, [role]);

  const go = (id) => { setRoute(id); setDrawer(false); };
  const playBeep = () => { try { const ac = new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.type = "sine"; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.25); o.start(); o.stop(ac.currentTime + 0.26); } catch (_) {} };

  // ── refresh dati dal backend ──
  const refreshOrders = async () => { try { const a = await TakoAPI.get("/orders/active"); const m = a.map(mapOrder); window._ORDERS = m; setOrders(m); } catch (_) {} };
  const refreshRooms = async () => { try { const r = await TakoAPI.get("/tables/rooms"); const m = r.map(mapRoom); window._ROOMS = m; setRooms(m); } catch (_) {} };
  const refreshBills = async () => { try { const b = await TakoAPI.get("/bills/open"); const m = b.map(mapBill); window._BILLS = m; setBills(m); } catch (_) {} };

  // ── socket realtime (sostituisce il generatore finto) ──
  useEffect(() => {
    const restId = session.restaurant?.id || window.__settings_raw?.id;
    if (!restId) return;
    const s = connectSocket(restId, (ev, p) => {
      if (ev === "order:new") {
        refreshOrders(); refreshBills();
        if (settingsRef.current.suoniOrdini) playBeep();
        const payload = { title: `Nuovo ordine · Tavolo ${p.tableNumber ?? "—"}`, sub: `${(p.items || []).reduce((a, i) => a + (i.quantity || 0), 0)} piatti`, icon: "bell" };
        if (mobileRef.current && window.pushLiveNotif) pushLiveNotif(payload); else if (window.toast) toast(payload.title, { type: "info", icon: "orders", sub: payload.sub });
      } else if (ev === "order:updated") { refreshOrders(); }
      else if (ev === "table:updated") { refreshRooms(); }
      else if (ev === "waiter:called") { setCalls((c) => [...c.filter((x) => x._id !== p.tableId), { tavolo: Number(p.tableNumber), motivo: CALL_TYPE_LABEL[p.type] || "Chiamata", min: 0, _id: p.tableId, _t: Date.now() }]); if (settingsRef.current.suoniOrdini) playBeep(); if (window.toast) toast(`Tavolo ${p.tableNumber} chiama`, { type: "warn", icon: "bell" }); }
      else if (ev === "waiter:resolved") { setCalls((c) => c.filter((x) => x._id !== p.tableId)); }
      else if (ev === "menu:updated" || ev === "menu:item_availability") { loadAll().then(bump); }
      else if (ev === "inventory:alert") { loadAll().then(bump); if (window.toast) toast(`Scorta bassa · ${p.name}`, { type: "warn" }); }
    });
    return () => { try { s && s.disconnect(); } catch (_) {} };
  }, []);

  // aggiorna i minuti "min" ogni 30s (calcolati da createdAt)
  useEffect(() => { const t = setInterval(() => { setOrders((os) => os.map((o) => ({ ...o, min: minsSince(o._raw?.createdAt) }))); setCalls((c) => c.map((x) => ({ ...x, min: Math.round((Date.now() - x._t) / 60000) }))); }, 30000); return () => clearInterval(t); }, []);

  // ── handlers ordini → API reale (con update ottimistico) ──
  const rid = (did) => orders.find((o) => o.id === did)?._id || did; // display id → uuid reale
  const patchOrderLocal = (id, fn) => setOrders((os) => os.map((o) => o.id === id ? fn(o) : o));
  const onConfirm = async (id) => { patchOrderLocal(id, (o) => ({ ...o, stato: "confermato" })); try { await TakoAPI.patch(`/orders/${rid(id)}/status`, { status: "confirmed" }); toast("Ordine confermato", { type: "success" }); } catch (e) { toast(e.message, { type: "error" }); refreshOrders(); } };
  const onServe = async (id) => { patchOrderLocal(id, (o) => ({ ...o, stato: "servito" })); try { await TakoAPI.patch(`/orders/${rid(id)}/status`, { status: "served" }); toast("Ordine servito", { type: "success", icon: "check" }); } catch (e) { toast(e.message, { type: "error" }); refreshOrders(); } };
  const onCancel = async (id) => { patchOrderLocal(id, (o) => ({ ...o, stato: "annullato" })); try { await TakoAPI.patch(`/orders/${rid(id)}/cancel`); toast("Ordine annullato", { type: "error" }); refreshOrders(); } catch (e) { toast(e.message, { type: "error" }); refreshOrders(); } };
  const onBump = async (id) => { patchOrderLocal(id, (o) => ({ ...o, stato: "pronto", items: o.items.map((it) => ({ ...it, stato: "pronto" })) })); try { await TakoAPI.patch(`/orders/${rid(id)}/status`, { status: "ready" }); toast("Ordine pronto", { type: "success", icon: "check" }); } catch (e) { toast(e.message, { type: "error" }); refreshOrders(); } };
  const onAdvanceItem = async (id, nome) => {
    const o = orders.find((x) => x.id === id); if (!o) return;
    const it = o.items.find((i) => i.nome === nome); if (!it || !it._id) return;
    const next = it.stato === "attesa" ? "prep" : "pronto";
    patchOrderLocal(id, (oo) => { const items = oo.items.map((i) => i.nome === nome ? { ...i, stato: next } : i); const allReady = items.every((i) => i.stato === "pronto"); return { ...oo, items, stato: allReady ? "pronto" : (oo.stato === "attesa" ? "prep" : oo.stato) }; });
    try { await TakoAPI.patch(`/orders/${o._id}/items/${it._id}/status`, { status: ITEM_UI2DB[next] }); } catch (e) { toast(e.message, { type: "error" }); refreshOrders(); }
  };
  const onSetTableState = async (n, stato) => {
    let tid = null; rooms.forEach((r) => r.tables.forEach((t) => { if (t.n === n) tid = t._id; }));
    setRooms((rs) => rs.map((r) => ({ ...r, tables: r.tables.map((t) => t.n === n ? { ...t, stato } : t) })));
    if (!tid) return;
    try { await TakoAPI.patch(`/tables/${tid}/status`, { status: TBL_UI2DB[stato] }); toast(`Tavolo ${n} → ${TABLE_STATUS[stato].label}`); } catch (e) { toast(e.message, { type: "error" }); refreshRooms(); }
    const call = calls.find((c) => c.tavolo === n); if (call) { try { await TakoAPI.post(`/tables/${tid}/waiter-resolve`); } catch (_) {} }
  };
  // Il pagamento lo esegue il PaymentModal (metodo+mancia). Qui solo refresh.
  const onCloseBill = async (id) => { setBills((bs) => bs.filter((x) => x.id !== id)); refreshBills(); refreshRooms(); };
  const onSetBrand = async (b) => { setBrand(b); try { await TakoAPI.patch("/restaurants/me", { primaryColor: BRAND_PALETTES[b].brand }); } catch (_) {} };
  const onSaveSettings = async (next) => {
    setSettings(next);
    try { await TakoAPI.patch("/restaurants/me", { name: next.nome, address: next.indirizzo, phone: next.telefono,
      settings: { currency: next.valuta, vatRate: Number(next.iva), timezone: next.fuso, defaultLanguage: next.linguaDefault, languages: next.lingue,
                  tableServiceEnabled: next.servizioTavolo, takeawayEnabled: next.asporto, payAtTableEnabled: next.pagaTavolo, aiEnabled: next.ai,
                  printerIp: next.printerIp, printerPort: Number(next.printerPort) || 9100,
                  // preferenze operative ora persistite sul backend
                  coverCharge: Number(next.coperto) || 0, coverChargeEnabled: !!next.copertoOn, suggestedTips: !!next.manceSuggerite,
                  orderSounds: !!next.suoniOrdini, autoConfirm: !!next.autoConferma, autoPrint: !!next.stampaAuto,
                  kdsWarnMinutes: Number(next.kdsWarn) || 10, kdsLateMinutes: Number(next.kdsLate) || 15, kdsCompact: !!next.kdsCompatta,
                  reservationsEnabled: !!next.prenotazioni, showOnboarding: !!next.mostraOnboarding } });
      toast("Impostazioni salvate", { type: "success" }); } catch (e) { toast(e.message, { type: "error" }); }
  };

  CUR.sym = CURRENCIES[settings.valuta] || "€";
  const activeOrders = orders.filter((o) => ["attesa", "confermato", "prep", "pronto"].includes(o.stato)).length;
  const badges = { ordini: activeOrders };
  KPI.ordiniAttivi = activeOrders;

  let Screen;
  switch (route) {
    case "dashboard": Screen = <ScreenDashboard mobile={mobile} go={go} orders={orders} settings={settings} />; break;
    case "ordini": Screen = <ScreenOrdini mobile={mobile} orders={orders} onConfirm={onConfirm} onServe={onServe} onCancel={onCancel} go={go} />; break;
    case "kds": Screen = <ScreenKDS mobile={mobile} orders={orders} onAdvanceItem={onAdvanceItem} onBump={onBump} settings={settings} />; break;
    case "cassa": Screen = <ScreenCassa mobile={mobile} bills={bills} onClose={onCloseBill} settings={settings} />; break;
    case "comanda": Screen = <ScreenComanda key={"comanda" + dataVersion} mobile={mobile} />; break;
    case "sala": Screen = <ScreenSala mobile={mobile} rooms={rooms} calls={calls} onSetTableState={onSetTableState} />; break;
    case "tavoli": Screen = <ScreenTavoli key={"tavoli" + dataVersion} mobile={mobile} />; break;
    case "qr": Screen = <ScreenQR key={"qr" + dataVersion} mobile={mobile} />; break;
    case "menu": Screen = <ScreenMenu key={"menu" + dataVersion} mobile={mobile} />; break;
    case "inventario": Screen = <ScreenInventario key={"inv" + dataVersion} mobile={mobile} />; break;
    case "statistiche": Screen = <ScreenStatistiche key={"stats" + dataVersion} mobile={mobile} />; break;
    case "insights": Screen = <ScreenInsights key={"insights" + dataVersion} mobile={mobile} />; break;
    case "staff": Screen = <ScreenStaff key={"staff" + dataVersion} mobile={mobile} />; break;
    case "impostazioni": Screen = <ScreenImpostazioni mobile={mobile} brand={brand} setBrand={onSetBrand} settings={settings} setSettings={onSaveSettings} />; break;
    case "collega": Screen = <ScreenCollega mobile={mobile} />; break;
    default: Screen = <ScreenDashboard mobile={mobile} go={go} orders={orders} settings={settings} />;
  }

  const p = BRAND_PALETTES[brand] || BRAND_PALETTES.arancione;
  const brandVars = { "--brand": p.brand, "--brand-deep": p.deep, "--brand-tint": p.tint, "--brand-wash": p.wash, "--on-brand": p.on };

  return (
    <TakoCtx.Provider value={brand}>
      {mobile ? (
        <div className="screen app-live mobile" style={{ ...brandVars, width: "100vw", height: "100vh" }}>
          <div style={{ width: "100%", height: "100%", position: "relative", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--surface)" }}>
            <div style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", flexDirection: "column" }}>
              {Screen}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, background: "rgba(251,248,244,.55)", backdropFilter: "blur(16px) saturate(180%)", WebkitBackdropFilter: "blur(16px) saturate(180%)" }}>
                <MobileHeader route={route} openDrawer={() => setDrawer(true)} live role={role} badges={badges} nome={settings.nome || RESTAURANT.name} go={go} />
              </div>
            </div>
            <BottomBar route={route} go={go} role={role} badges={badges} openDrawer={() => setDrawer(true)} />
            <MobileDrawer open={drawer} onClose={() => setDrawer(false)} route={route} go={go} role={role} badges={badges} />
          </div>
          <Toaster mobile />
        </div>
      ) : (
        <div className="screen app-live" style={{ ...brandVars, width: "100vw", height: "100vh" }}>
          <div style={{ width: "100%", height: "100%", display: "flex", background: "var(--bg)" }}>
            <Sidebar route={route} go={go} role={role} badges={badges} live />
            <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }}>
              {Screen}
            </main>
          </div>
          <Toaster mobile={false} />
        </div>
      )}
    </TakoCtx.Provider>
  );
}

function Root() {
  const [state, setState] = useState({ phase: "loading", session: null });
  useEffect(() => {
    (async () => {
      try {
        const me = await TakoAPI.get("/auth/me");
        const restaurant = await TakoAPI.get("/restaurants/me").catch(() => null);
        await loadAll();
        setState({ phase: "app", session: { user: me, restaurant } });
      } catch (_) { setState({ phase: "login", session: null }); }
    })();
  }, []);
  const onLogin = async (d) => { await loadAll(); setState({ phase: "app", session: { user: d.user, restaurant: d.restaurant } }); };
  if (state.phase === "loading") return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FBF8F4", color: "#aaa" }}>Caricamento…</div>;
  if (state.phase === "login") return <Login onDone={onLogin} />;
  return <App session={state.session} />;
}

ReactDOM.createRoot(document.getElementById("stage")).render(<Root />);
