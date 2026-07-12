/* ───────────────── Tako Dashboard — app root REALE (wired) ─────────────────
   UI verbatim del prototipo, collegata al backend. Niente toolbar "prototipo",
   niente toggle desktop/mobile finto, niente generatore di ordini finti. */

function load(k, d) { try { const v = localStorage.getItem("tako-dash-" + k); return v ?? d; } catch (_) { return d; } }
function save(k, v) { try { localStorage.setItem("tako-dash-" + k, v); } catch (_) {} }

const HEX2BRAND = Object.fromEntries(Object.entries(BRAND_PALETTES).map(([k, p]) => [p.brand.toLowerCase(), k]));

/* ── Trascinamento finestra (solo app desktop Tauri) ──────────────────────────
   La finestra usa titleBarStyle "Overlay": senza una zona `data-tauri-drag-region`
   la finestra NON si sposta afferrandola in alto. Questa striscia fissa in cima
   (30px, trasparente) fa da titlebar. Il drag nativo parte solo se il mousedown
   colpisce QUESTA striscia, quindi i controlli sotto restano cliccabili; l'area
   utile (padding 26px in alto sul desktop) è comunque vuota. Doppio-click =
   zoom/maximize, gestito nativamente da Tauri. Non renderizzata nel browser. */
function WindowDragStrip() {
  const isTauri = typeof window !== "undefined" && (window.__TAURI_INTERNALS__ || window.__TAURI__);
  if (!isTauri) return null;
  return (
    <div data-tauri-drag-region aria-hidden="true"
      style={{ position: "fixed", top: 0, left: 0, right: 0, height: 30, zIndex: 9998,
        background: "transparent", WebkitUserSelect: "none", userSelect: "none", cursor: "default" }} />
  );
}

/* ── slug url-safe dal nome ristorante (per /auth/register) ── */
function slugifyName(s) {
  const base = (s || "").toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base.length >= 2 ? base : "ristorante-" + Math.floor(1000 + Math.random() * 9000);
}

/* ── schermata accesso/registrazione (on-brand, minimale) ── */
function Login({ onDone }) {
  const [mode, setMode] = useState("login");          // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [name, setName] = useState("");
  const [newsletter, setNewsletter] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");   // se valorizzata → schermata "conferma email"
  const [info, setInfo] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const isReg = mode === "register";
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (isReg && password.length < 8) { setErr("La password deve avere almeno 8 caratteri."); return; }
    setBusy(true);
    try {
      const d = isReg
        ? await TakoAPI.post("/auth/register", { restaurantName: restaurantName.trim(), restaurantSlug: slugifyName(restaurantName), name: name.trim(), email: email.trim(), password, newsletter })
        : await TakoAPI.post("/auth/login", { email: email.trim(), password });
      // Gate verifica email attivo: la registrazione NON apre sessione — mostra
      // la schermata "conferma la tua email" e si entra dal login dopo il click.
      if (d && d.pendingVerification) { setInfo(""); setVerifyEmail(d.email || email.trim()); return; }
      onDone(d);
    } catch (ex) {
      if (ex.code === "EMAIL_NOT_VERIFIED") { setInfo(""); setVerifyEmail(email.trim()); return; }
      if (ex.code === "VERIFY_UNAVAILABLE") { setErr(ex.message || "Serve la connessione internet per completare la verifica email."); return; }
      if (isReg) setErr(ex.message && ex.status !== 500 ? ex.message : "Registrazione non riuscita. Controlla i dati o prova un'altra email.");
      else setErr(ex.status === 429 ? "Troppi tentativi, riprova tra qualche minuto." : "Email o password non validi.");
    } finally { setBusy(false); }
  };
  const resend = async () => {
    setBusy(true); setInfo("");
    try { await TakoAPI.post("/auth/resend-verification", { email: verifyEmail }); setInfo("Email inviata di nuovo: controlla la posta (anche lo spam)."); }
    catch (_) { setInfo("Email inviata di nuovo: controlla la posta (anche lo spam)."); }
    finally { setBusy(false); }
  };
  const p = BRAND_PALETTES.arancione;
  const inp = { width: "100%", margin: "6px 0 14px", padding: "11px 12px", borderRadius: 11, border: "1px solid var(--hairline,#ddd)", fontSize: 14.5, background: "var(--sunken,#fafafa)" };
  const lab = { fontSize: 12.5, fontWeight: 700, color: "var(--ink2,#555)" };
  const wrapStyle = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg, #FBF8F4)", padding: 24,
    "--brand": p.brand, "--brand-deep": p.deep, "--brand-tint": p.tint, "--brand-wash": p.wash, "--on-brand": p.on };
  const cardStyle = { width: 360, maxWidth: "100%", background: "var(--surface,#fff)", borderRadius: 20, padding: 28, boxShadow: "0 8px 40px rgba(0,0,0,.08)", border: "1px solid var(--hairline,#eee)" };

  // Schermata "conferma la tua email" (gate verifica attivo): niente sessione finché
  // il link nell'email non è stato cliccato; si entra dal pulsante Accedi.
  if (verifyEmail) {
    return (
      <div style={wrapStyle}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 10 }} aria-hidden="true">📬</div>
          <div style={{ fontFamily: "var(--font-display, inherit)", fontWeight: 900, fontSize: 21, color: "var(--ink,#2A1F1A)", marginBottom: 8 }}>Conferma la tua email</div>
          <div style={{ fontSize: 14, color: "var(--ink2,#555)", lineHeight: 1.5, marginBottom: 4 }}>
            Ti abbiamo inviato un link di verifica a<br /><b style={{ color: "var(--ink,#2A1F1A)" }}>{verifyEmail}</b>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink3,#888)", marginBottom: 18 }}>Controlla anche la cartella spam.</div>
          {info && <div style={{ fontSize: 13, color: "var(--brand)", fontWeight: 700, margin: "0 0 12px" }}>{info}</div>}
          <button type="button" disabled={busy} onClick={() => { setVerifyEmail(""); setMode("login"); setErr(""); setInfo(""); }}
            style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", background: "var(--brand)", color: "var(--on-brand)", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
            Ho confermato — Accedi
          </button>
          <button type="button" disabled={busy} onClick={resend}
            style={{ width: "100%", marginTop: 10, padding: "11px", borderRadius: 12, border: "1px solid var(--hairline,#ddd)", background: "var(--sunken,#fafafa)", color: "var(--ink2,#555)", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: busy ? .6 : 1 }}>
            Reinvia email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg, #FBF8F4)", padding: 24,
      "--brand": p.brand, "--brand-deep": p.deep, "--brand-tint": p.tint, "--brand-wash": p.wash, "--on-brand": p.on }}>
      <form onSubmit={submit} style={{ width: 360, maxWidth: "100%", background: "var(--surface,#fff)", borderRadius: 20, padding: 28, boxShadow: "0 8px 40px rgba(0,0,0,.08)", border: "1px solid var(--hairline,#eee)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <img src="/staff/assets/takos/arancione/logo.png" alt="Tako"
            onError={(e) => { if (e.currentTarget.src.indexOf('piatto') < 0) e.currentTarget.src = '/staff/assets/takos/arancione/piatto.png'; }}
            style={{ width: 84, height: 84, objectFit: "contain" }} />
          <div style={{ fontFamily: "var(--font-display, inherit)", fontWeight: 900, fontSize: 24, color: "var(--ink,#2A1F1A)" }}>Tako</div>
          <div style={{ fontSize: 13.5, color: "var(--ink3,#888)" }}>{isReg ? "Crea il tuo ristorante" : "Accedi alla dashboard"}</div>
        </div>
        {isReg && (
          <>
            <label style={lab}>Nome del ristorante</label>
            <input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} type="text" autoFocus required minLength={2} style={inp} />
            <label style={lab}>Il tuo nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" required minLength={2} style={inp} />
          </>
        )}
        <label style={lab}>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoFocus={!isReg} required style={inp} />
        <label style={lab}>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={isReg ? 8 : undefined} placeholder={isReg ? "almeno 8 caratteri" : undefined} style={{ ...inp, marginBottom: 6 }} />
        {isReg && (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "10px 0 2px", fontSize: 12.5, color: "var(--ink3,#888)", cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} style={{ marginTop: 2, accentColor: "var(--brand)" }} />
            <span>Voglio ricevere novità e consigli per il mio ristorante (facoltativo, annullabile quando vuoi)</span>
          </label>
        )}
        {err && <div style={{ color: "var(--danger,#d9533a)", fontSize: 13, margin: "8px 0" }}>{err}</div>}
        <button type="submit" disabled={busy}
          style={{ width: "100%", marginTop: 14, padding: "12px", borderRadius: 12, border: "none", background: "var(--brand)", color: "var(--on-brand)", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: busy ? .6 : 1 }}>
          {busy ? (isReg ? "Creazione…" : "Accesso…") : (isReg ? "Crea ristorante" : "Entra")}
        </button>
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--ink3,#888)" }}>
          {isReg ? "Hai già un account? " : "Primo accesso? "}
          <a href="#" onClick={(e) => { e.preventDefault(); setErr(""); setMode(isReg ? "login" : "register"); }} style={{ color: "var(--brand)", fontWeight: 700, textDecoration: "none" }}>
            {isReg ? "Accedi" : "Registra il tuo ristorante"}
          </a>
        </div>
      </form>
    </div>
  );
}

function App({ session }) {
  const role0 = ROLE_DB2UI[session.user.role] || "owner";
  ROLES[role0] = { ...ROLES[role0], name: session.user.name, initials: (session.user.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() };
  const [route, setRoute] = useState(() => { const r = load("route", ROLE_HOME[role0] || "dashboard"); const allow = ROLE_ACCESS[role0]; return (!allow || allow.includes(r)) ? r : (ROLE_HOME[role0] || "dashboard"); });
  const [brand, setBrand] = useState(() => HEX2BRAND[(RESTAURANT.brand || "").toLowerCase()] || load("brand", "arancione"));
  const [settings, setSettings] = useState(() => {
    let ls = {}; try { ls = JSON.parse(localStorage.getItem("tako-dash-settings") || "{}"); } catch (_) { ls = {}; }
    // Backend vince: SETTINGS_DEFAULTS è già stato popolato dal backend in loadAll().
    // localStorage serve solo come cache di fallback quando il backend NON ha risposto.
    // Unica preferenza solo-client non gestita dal backend: `kpi` (visibilità widget home).
    return window.__settings_raw
      ? { ...SETTINGS_DEFAULTS, kpi: ls.kpi || SETTINGS_DEFAULTS.kpi }
      : { ...SETTINGS_DEFAULTS, ...ls };
  });
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const role = role0;
  // Esposto per componenti che non ricevono `role` via prop (es. PaymentModal in
  // 05): il PATCH coperti/sconto è owner/cassiere, così la UI evita azioni che
  // darebbero 403 al cameriere.
  window.__takoRole = role;
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
      else if (ev === "waiter:called") { setCalls((c) => [...c.filter((x) => x._id !== p.tableId), { tavolo: String(p.tableNumber), motivo: CALL_TYPE_LABEL[p.type] || "Chiamata", min: 0, _id: p.tableId, _t: Date.now() }]); if (settingsRef.current.suoniOrdini) playBeep(); if (window.toast) toast(`Tavolo ${p.tableNumber} chiama`, { type: "warn", icon: "bell" }); }
      else if (ev === "waiter:resolved") { setCalls((c) => c.filter((x) => x._id !== p.tableId)); }
      else if (ev === "menu:updated" || ev === "menu:item_availability") { loadAll().then(bump); }
      else if (ev === "inventory:alert") { loadAll().then(bump); if (window.toast) toast(`Scorta bassa · ${p.name}`, { type: "warn" }); }
      else if (ev === "reservation:changed") { setDataVersion((v) => v + 1); }
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
  const onAdvanceItem = async (id, itemId, nome) => {
    const o = orders.find((x) => x.id === id); if (!o) return;
    // Avanza per ID item (univoco), non per nome: due righe con lo stesso piatto non collidono.
    const it = itemId ? o.items.find((i) => i._id === itemId) : o.items.find((i) => i.nome === nome);
    if (!it || !it._id) return;
    const next = it.stato === "attesa" ? "prep" : "pronto";
    patchOrderLocal(id, (oo) => { const items = oo.items.map((i) => i._id === it._id ? { ...i, stato: next } : i); const allReady = items.every((i) => i.stato === "pronto"); return { ...oo, items, stato: allReady ? "pronto" : (oo.stato === "attesa" ? "prep" : oo.stato) }; });
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
  const onSaveSettings = async (nextOrFn) => {
    // I toggle chiamano set(k,v) → setSettings(s => ({...s,[k]:v})): qui arriva una
    // FUNZIONE updater, non un oggetto. Risolvila contro lo stato corrente, altrimenti
    // next.nome/next.iva… sono undefined → vatRate NaN→null → 400 di validazione.
    const next = typeof nextOrFn === "function" ? nextOrFn(settings) : nextOrFn;
    setSettings(next);
    try { await TakoAPI.patch("/restaurants/me", { name: next.nome, address: next.indirizzo, phone: next.telefono,
      settings: { currency: next.valuta, vatRate: Number(next.iva), timezone: next.fuso, defaultLanguage: next.linguaDefault, languages: next.lingue,
                  tableServiceEnabled: next.servizioTavolo, takeawayEnabled: next.asporto, payAtTableEnabled: next.pagaTavolo, aiEnabled: next.ai,
                  printerIp: next.printerIp, printerPort: Number(next.printerPort) || 9100,
                  // preferenze operative ora persistite sul backend
                  coverCharge: Number(next.coperto) || 0, coverChargeEnabled: !!next.copertoOn, suggestedTips: !!next.manceSuggerite,
                  orderSounds: !!next.suoniOrdini, autoConfirm: !!next.autoConferma, autoPrint: !!next.stampaAuto,
                  kdsWarnMinutes: Number(next.kdsWarn) || 10, kdsLateMinutes: Number(next.kdsLate) || 15, kdsCompact: !!next.kdsCompatta,
                  reservationsEnabled: !!next.prenotazioni, showOnboarding: !!next.mostraOnboarding,
                  loyaltyEnabled: !!next.fedelta, reviewRequestEnabled: !!next.recensioni, reviewUrl: next.recensioniUrl || "",
                  autoStockDeductEnabled: !!next.scaricoAuto, dailyBriefingEnabled: !!next.briefingWa,
                  dailyBriefingHour: Number(next.briefingOra) || 9, aiContentEnabled: !!next.aiContenuti,
                  aiPhotoEnabled: !!next.fotoAi, aiPhotoProCode: next.fotoAiCodice || "",
                  menuEngineeringEnabled: !!next.menuEngineering } });
      toast("Impostazioni salvate", { type: "success" }); } catch (e) { toast(e.message, { type: "error" }); }
  };

  CUR.sym = CURRENCIES[settings.valuta] || "€";
  const activeOrders = orders.filter((o) => ["attesa", "confermato", "prep", "pronto"].includes(o.stato)).length;
  const badges = { ordini: activeOrders };
  KPI.ordiniAttivi = activeOrders;

  // Pubblica lo stato live (ordini + sala + badge) per consumatori esterni al tree di App
  // — es. l'anteprima "Streaming" nella sidebar del Cowork, che renderizza ScreenOrdini
  // o ScreenSala in miniatura. `rooms`/`calls` servono all'anteprima della Sala live
  // (target dinamico del widget). L'evento notifica i mount che leggono window.__takoLive
  // fuori da React.
  useEffect(() => { window.__takoLive = { orders, badges, rooms, calls }; window.dispatchEvent(new Event("tako-live")); }, [orders, activeOrders, rooms, calls]);

  let Screen;
  switch (route) {
    case "cowork": Screen = window.ScreenCowork ? React.createElement(window.ScreenCowork, { key: "cowork", mobile }) : null; break;
    case "dashboard": Screen = <ScreenDashboard mobile={mobile} go={go} orders={orders} settings={settings} />; break;
    case "ordini": Screen = <ScreenOrdini mobile={mobile} orders={orders} onConfirm={onConfirm} onServe={onServe} onCancel={onCancel} go={go} />; break;
    case "kds": Screen = <ScreenKDS mobile={mobile} orders={orders} onAdvanceItem={onAdvanceItem} onBump={onBump} settings={settings} />; break;
    case "cassa": Screen = <ScreenCassa mobile={mobile} bills={bills} onClose={onCloseBill} settings={settings} />; break;
    case "comanda": Screen = <ScreenComanda key={"comanda" + dataVersion} mobile={mobile} />; break;
    case "sala": Screen = <ScreenSala mobile={mobile} rooms={rooms} calls={calls} onSetTableState={onSetTableState} />; break;
    case "tavoli": Screen = <ScreenTavoli key={"tavoli" + dataVersion} mobile={mobile} />; break;
    case "prenotazioni": Screen = <ScreenPrenotazioni key={"pren" + dataVersion} mobile={mobile} />; break;
    case "turni": Screen = <ScreenTurni key={"turni" + dataVersion} mobile={mobile} />; break;
    case "qr": Screen = <ScreenQR key={"qr" + dataVersion} mobile={mobile} />; break;
    case "dispositivi": Screen = <ScreenDispositivi key={"disp" + dataVersion} mobile={mobile} />; break;
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
      <WindowDragStrip />
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
  if (state.phase === "login") return <LoginGate onDone={onLogin} />;
  return <App session={state.session} />;
}

/* ── schermata di crash (italiana) mostrata dall'ErrorBoundary ── */
function CrashScreen({ onReload, onHome }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FBF8F4", padding: 24 }}>
      <div style={{ width: 400, maxWidth: "100%", background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 8px 40px rgba(0,0,0,.08)", border: "1px solid #eee", textAlign: "center" }}>
        <img src="assets/takos/arancione/pollice_in_su.png" alt="Tako" style={{ width: 84, height: 84, objectFit: "contain", margin: "0 auto 10px" }} />
        <div style={{ fontWeight: 900, fontSize: 21, color: "#2A1F1A", marginBottom: 8 }}>Qualcosa è andato storto</div>
        <div style={{ fontSize: 14, color: "#8a8079", lineHeight: 1.5, marginBottom: 22 }}>
          Si è verificato un errore imprevisto nella dashboard. Puoi ricaricare la pagina oppure tornare alla Dashboard.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onHome} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1.5px solid #ddd", background: "#fff", color: "#2A1F1A", fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}>Torna alla Dashboard</button>
          <button onClick={onReload} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: "#ED7159", color: "#fff", fontWeight: 800, fontSize: 14.5, cursor: "pointer" }}>Ricarica</button>
        </div>
      </div>
    </div>
  );
}

/* ── Error boundary globale: evita il muro bianco e il crash-loop da route salvata ── */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { try { console.error("Tako crash", error, info); } catch (_) {} }
  render() {
    if (this.state.error) {
      return (
        <CrashScreen
          onReload={() => { try { location.reload(); } catch (_) {} }}
          onHome={() => {
            // Reset della route persistita: se il crash arriva da una schermata salvata
            // in localStorage, riaprirla ricadrebbe subito nel loop. Torniamo alla dashboard.
            try { localStorage.removeItem("tako-dash-route"); } catch (_) {}
            try { location.reload(); } catch (_) {}
          }}
        />
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("stage")).render(<ErrorBoundary><Root /></ErrorBoundary>);
