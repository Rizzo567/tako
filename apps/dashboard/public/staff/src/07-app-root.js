/* ───────────────── Tako Dashboard — app root REALE (wired) ─────────────────
   UI verbatim del prototipo, collegata al backend. Niente toolbar "prototipo",
   niente toggle desktop/mobile finto, niente generatore di ordini finti. */

function load(k, d) { try { const v = localStorage.getItem("tako-dash-" + k); return v ?? d; } catch (_) { return d; } }
function save(k, v) { try { localStorage.setItem("tako-dash-" + k, v); } catch (_) {} }


/* ── slug url-safe dal nome ristorante (per /auth/register) ── */
function slugifyName(s) {
  const base = (s || "").toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base.length >= 2 ? base : "ristorante-" + Math.floor(1000 + Math.random() * 9000);
}

/* ── schermata accesso/registrazione (on-brand, minimale) ── */
function Login({ onDone, registrationAllowed = true, webMode = false }) {
  const [mode, setMode] = useState(new URLSearchParams(location.search).has("reset") ? "reset" : "login");
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
  const isForgot = mode === "forgot", isReset = mode === "reset";
  /* 19/10: link «Reimposta la password» (monouso, 30 min). Il token si verifica sul server all'apertura: valido → Nuova password /
     Ripeti / Conferma; scaduto o usato → «Link scaduto» con il tasto per richiederne uno nuovo. */
  const [password2, setPassword2] = useState("");
  const [resetState, setResetState] = useState("checking");
  const resetToken = new URLSearchParams(location.search).get("reset") || "";
  useEffect(() => { if (!isReset) return; let alive = true; setResetState("checking");
    TakoAPI.post('/web-accounts/reset-check', { token: resetToken }).then(r => { if (alive) setResetState(r && r.valid ? "valid" : "expired"); }).catch(() => { if (alive) setResetState("expired"); });
    return () => { alive = false; }; }, [isReset, resetToken]);
  /* 19/10 sera: finché le email sono spente il recupero passa dall'agenzia: niente tasto «Password dimenticata». */
  const [emailOn, setEmailOn] = useState(null);
  useEffect(() => { if (!webMode) return; let alive = true; TakoAPI.get('/web-accounts/capabilities').then(c => { if (alive) setEmailOn(!!(c && c.email)); }).catch(() => { if (alive) setEmailOn(false); }); return () => { alive = false; }; }, [webMode]);
  const askNewLink = () => { history.replaceState(null, '', location.pathname); setMode('forgot'); setErr(''); setInfo(''); setPassword(''); setPassword2(''); };
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (isReg && password.length < 8) { setErr("La password deve avere almeno 8 caratteri."); return; }
    setBusy(true);
    try {
      if (isForgot) {
        const capability=await TakoAPI.get('/web-accounts/capabilities');
        if(!capability.email){setErr('Per recuperare la password scrivi alla tua agenzia.');return;}
        await TakoAPI.post('/web-accounts/forgot-password',{email:email.trim()});setInfo('Se l’indirizzo è registrato, riceverai le istruzioni.');return;
      }
      if(isReset){
        if(password.length<8){setErr('La nuova password deve avere almeno 8 caratteri.');return;}
        if(password!==password2){setErr('Le due password non coincidono.');return;}
        try{const r=await TakoAPI.post('/web-accounts/reset-password',{token:resetToken,password});if(r&&r.email)setEmail(r.email);}
        catch(ex){if(ex.code==='INVALID_RESET'){setResetState('expired');return;}throw ex;}
        // 19/10 sera: chi apre il link con una sessione aperta (anche di un altro account) ne esce: si rientra con la password nuova.
        try{await TakoAPI.post('/auth/logout');}catch(_){}
        history.replaceState(null,'',location.pathname);setMode('login');setPassword('');setPassword2('');setInfo('Password cambiata, entra con quella nuova.');return;
      }
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
      else setErr(ex.status === 429 ? "Troppi tentativi, riprova tra qualche minuto." : ex.status === 401 ? "Email o password non validi." : ex.status === 400 ? "Controlla il formato dell’email e i dati inseriti." : "Accesso temporaneamente non disponibile. Controlla la connessione e riprova.");
    } finally { setBusy(false); }
  };
  const resend = async () => {
    setBusy(true); setInfo("");
    try { await TakoAPI.post("/auth/resend-verification", { email: verifyEmail }); setInfo("Email inviata di nuovo: controlla la posta (anche lo spam)."); }
    catch (_) { setInfo("Email inviata di nuovo: controlla la posta (anche lo spam)."); }
    finally { setBusy(false); }
  };
  const inp = { width: "100%", margin: "6px 0 14px", padding: "11px 12px", borderRadius: 11, border: "1px solid var(--hairline,#ddd)", fontSize: 14.5, background: "var(--sunken,#fafafa)" };
  const lab = { fontSize: 12.5, fontWeight: 700, color: "var(--ink2,#555)" };
  const wrapStyle = { minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 };
  const cardStyle = { width: 360, maxWidth: "100%", background: "var(--surface,#fff)", borderRadius: 12, padding: 28, boxShadow: "0 8px 40px rgba(0,0,0,.08)", border: "1px solid var(--hairline,#eee)" };

  // Schermata "conferma la tua email" (gate verifica attivo): niente sessione finché
  // il link nell'email non è stato cliccato; si entra dal pulsante Accedi.
  if (verifyEmail) {
    return (
      <div style={wrapStyle}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 10 }} aria-hidden="true">📬</div>
          <div style={{ fontFamily: "var(--font-display, inherit)", fontWeight: 900, fontSize: 21, color: "var(--ink)", marginBottom: 8 }}>Conferma la tua email</div>
          <div style={{ fontSize: 14, color: "var(--ink2,#555)", lineHeight: 1.5, marginBottom: 4 }}>
            Ti abbiamo inviato un link di verifica a<br /><b style={{ color: "var(--ink)" }}>{verifyEmail}</b>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink3,#888)", marginBottom: 18 }}>Controlla anche la cartella spam.</div>
          {info && <div style={{ fontSize: 13, color: "var(--brand)", fontWeight: 700, margin: "0 0 12px" }}>{info}</div>}
          <button type="button" disabled={busy} onClick={() => { setVerifyEmail(""); setMode("login"); setErr(""); setInfo(""); }}
            style={{ width: "100%", height:48, display:"flex",alignItems:"center",justifyContent:"center",padding: "0 12px", borderRadius: 12, border: "none", background: "var(--brand)", color: "var(--on-brand)", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
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
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <form onSubmit={submit} style={{ width: 360, maxWidth: "100%", background: "var(--surface,#fff)", borderRadius: 12, padding: 28, boxShadow: "0 8px 40px rgba(0,0,0,.08)", border: "1px solid var(--hairline,#eee)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <span role="img" aria-label="Takomenu" style={{ display: "block", width: 228, height: 44, background: "currentColor", mask: "url(/staff/assets/branding/takomenu-wordmark-v2.svg) center / contain no-repeat", WebkitMask: "url(/staff/assets/branding/takomenu-wordmark-v2.svg) center / contain no-repeat" }} />
          <div style={{ fontSize: 13.5, color: "var(--ink3,#888)" }}>{isForgot ? "Recupera l’accesso" : isReset ? "Scegli una nuova password" : isReg ? "Crea il tuo ristorante" : "Accedi alla dashboard"}</div>
        </div>
        {isReg && (
          <>
            <label style={lab}>Nome del ristorante</label>
            <input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} type="text" autoFocus required minLength={2} style={inp} />
            <label style={lab}>Il tuo nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} type="text" required minLength={2} style={inp} />
          </>
        )}
        {!isReset && <><label style={lab}>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete={isReg ? "email" : "username"} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus={!isReg} required style={inp} /></>}
        {isReset && resetState === "checking" && <TakoLoading variant="compact" label="Controllo del link…"/>}
        {isReset && resetState === "expired" && <div role="alert" style={{ fontSize: 14, color: "var(--ink2,#555)", lineHeight: 1.5 }}>
          <p style={{ margin: "0 0 12px", fontWeight: 700, color: "var(--ink)" }}>Link scaduto, richiedine uno nuovo.</p>
          <button type="button" onClick={askNewLink} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", background: "var(--brand)", color: "var(--on-brand)", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Richiedi un nuovo link</button></div>}
        {isReset && resetState === "valid" && <><label style={lab}>Nuova password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" autoFocus required minLength={8} placeholder="almeno 8 caratteri" style={inp} />
        <label style={lab}>Ripeti nuova password</label>
        <input value={password2} onChange={(e) => setPassword2(e.target.value)} type="password" autoComplete="new-password" required minLength={8} style={{ ...inp, marginBottom: 6 }} /></>}
        {!isForgot && !isReset && <><label style={lab}>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete={isReg ? "new-password" : "current-password"} required minLength={isReg ? 8 : undefined} placeholder={isReg ? "almeno 8 caratteri" : undefined} style={{ ...inp, marginBottom: 6 }} /></>}
        {isReg && (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "10px 0 2px", fontSize: 12.5, color: "var(--ink3,#888)", cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} style={{ marginTop: 2, accentColor: "var(--brand)" }} />
            <span>Voglio ricevere novità e consigli per il mio ristorante (facoltativo, annullabile quando vuoi)</span>
          </label>
        )}
        {info && <p role="status" style={{ color: "var(--ok,#2b8a3e)", fontWeight: 700, fontSize: 13.5 }}>{info}</p>}
        {err && <div style={{ color: "var(--danger)", fontSize: 13, margin: "8px 0" }}>{err}</div>}
        {!(isReset && resetState !== "valid") && <button type="submit" disabled={busy}
          style={{ width: "100%", marginTop: 14, padding: "12px", borderRadius: 12, border: "none", background: "var(--brand)", color: "var(--on-brand)", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: busy ? .6 : 1 }}>
          {busy ? <TakoLoading variant="compact" label={isForgot?"Invio istruzioni…":isReset?"Aggiornamento password…":isReg?"Creazione ristorante…":"Accesso a Takomenu…"}/> : isForgot ? "Invia istruzioni" : isReset ? "Conferma" : isReg ? "Crea ristorante" : "Entra"}
        </button>}
        {webMode && !isReg && emailOn === false && !isReset && <p style={{ marginTop: 12, fontSize: 13, color: "var(--ink3,#888)", textAlign: "center" }}>Password dimenticata? Scrivi alla tua agenzia.</p>}
        {webMode && !isReg && (emailOn === true || isReset || isForgot) && <button type="button" disabled={busy} onClick={()=>{if(isReset)history.replaceState(null,'',location.pathname);setMode(isForgot||isReset?'login':'forgot');setErr('');setInfo('');}} style={{marginTop:12,background:'none',border:0,color:'var(--brand)',cursor:'pointer'}}>{isForgot||isReset?'Torna all’accesso':'Password dimenticata?'}</button>}
        {registrationAllowed && <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--ink3,#888)" }}>
          {isReg ? "Hai già un account? " : "Primo accesso? "}
          <a href="#" onClick={(e) => { e.preventDefault(); setErr(""); setMode(isReg ? "login" : "register"); }} style={{ color: "var(--brand)", fontWeight: 700, textDecoration: "none" }}>
            {isReg ? "Accedi" : "Registra il tuo ristorante"}
          </a>
        </div>}
      </form>
    </div>
  );
}

function App({ session }) {
  window.__takomenuAgency = session.user.agency === true;window.__takoUser=session.user;
  const role0 = ROLE_DB2UI[session.user.role] || "nonAutorizzato";
  ROLES[role0] = { ...ROLES[role0], name: session.user.name, initials: (session.user.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() };
  const [route, setRoute] = useState(() => safeRoute(role0, session.user.agency&&new URLSearchParams(location.search).get("view")==="leads"?"agency_leads":session.user.agency&&["dashboard",null].includes(load("route",null))?"agency":load("route",session.user.agency?"agency":homeRoute(role0))));
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
  window.__takoRestaurantId = session.user.restaurantId || session.restaurant?.id || window.__settings_raw?.id;
  const [drawer, setDrawer] = useState(false);
  // Tema unico «Sobrio»: il riquadro nasce dal pulsante che lo apre (19-sobrio.js).
  useEffect(() => { sbInstallTriggerTracker(); }, []);
  const [frame, setFrame] = useState(() => (typeof window !== "undefined" && window.innerWidth < 900 ? "mobile" : "desktop"));
  const mobile = frame === "mobile";
  const mobileRef = useRef(mobile); mobileRef.current = mobile;

  useEffect(() => { window.__takoRoute = route; window.dispatchEvent(new Event("tako:route")); }, [route]);
  const [orders, setOrders] = useState(window._ORDERS);
  const [rooms, setRooms] = useState(window._ROOMS);
  const [bills, setBills] = useState(window._BILLS);
  const [calls, setCalls] = useState(window._WAITER || []);
  useEffect(() => { window._WAITER = calls; }, [calls]);
  useEffect(() => {
    if (window.__TAKO_STATIC_TRANSPORT === "polling") return;
    let alive = true;
    TakoAPI.get("/tables/waiter-calls").then(rows => {
      if (alive && Array.isArray(rows)) setCalls(rows.map(c => ({ tavolo: String(c.tableNumber), motivo: CALL_TYPE_LABEL[c.type] || "Chiamata", min: minsSince(c.createdAt), _id: c.tableId, _t: new Date(c.createdAt).getTime() })));
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const [, setTick] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);
  // Browser connectivity and the realtime channel are separate signals in the webapp.
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [realtimeOnline, setRealtimeOnline] = useState(false);
  const [syncDelayed,setSyncDelayed]=useState(false);
  useEffect(()=>{setSyncDelayed(false);if(!online||realtimeOnline)return;const timer=setTimeout(()=>setSyncDelayed(true),30000);return()=>clearTimeout(timer)},[online,realtimeOnline]);
  const bump = () => setTick((t) => t + 1);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  // refresh globale + navigazione richiamabili dalle schermate
  useEffect(() => {
    window.takoReload = async () => {
      if(window.__takoMenuLeaveGuard && !window.__takoMenuLeaveGuard())return;
      try { await loadAll(); setOrders(window._ORDERS); setRooms(window._ROOMS); setBills(window._BILLS); setDataVersion((v) => v + 1); bump();
        const rows = window.__TAKO_STATIC_TRANSPORT === "polling" ? [] : await TakoAPI.get("/tables/waiter-calls");
        if (Array.isArray(rows)) setCalls(rows.map(c => ({ tavolo: String(c.tableNumber), motivo: CALL_TYPE_LABEL[c.type] || "Chiamata", min: minsSince(c.createdAt), _id: c.tableId, _t: new Date(c.createdAt).getTime() })));
      } catch (_) {}
    };
    window.takoGo = (id) => go(id);
    return () => { delete window.takoReload; delete window.takoGo; };
  }, [route]);

  useEffect(() => save("route", route), [route]);
  const prevRouteRef = useRef(route);
  useEffect(() => { const prev = prevRouteRef.current; prevRouteRef.current = route; if (prev !== route) sbPageRouteChanged(prev, route); }, [route]);
  useEffect(() => { try { localStorage.setItem("tako-dash-settings", JSON.stringify(settings)); } catch (_) {} }, [settings]);
  useEffect(() => { const onR = () => { const next = window.innerWidth < 900 ? "mobile" : "desktop"; setFrame(prev => { if (prev !== next) window.__takoFrameChangedAt = Date.now(); return next; }); }; window.addEventListener("resize", onR); return () => window.removeEventListener("resize", onR); }, []);
  useEffect(() => { if (!canNavigate(role, route)) setRoute(safeRoute(role, route)); }, [role, route]);

  const go = (id) => {
    const next=safeRoute(role,id);
    if(next!==route && window.__takoMenuLeaveGuard && !window.__takoMenuLeaveGuard())return;
    setRoute(next); setDrawer(false);
  };
  const playBeep = () => { try { const ac = new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.type = "sine"; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.25); o.start(); o.stop(ac.currentTime + 0.26); } catch (_) {} };

  // ── refresh dati dal backend ──
  const refreshOrders = async () => { try { const a = await TakoAPI.get("/orders/active"); const m = a.map(mapOrder); window._ORDERS = m; setOrders(m); } catch (_) {} };
  const refreshRooms = async () => { try { const r = await TakoAPI.get("/tables/rooms"); const m = r.map(mapRoom); window._ROOMS = m; setRooms(m); } catch (_) {} };
  const refreshBills = async () => { try { const b = await TakoAPI.get("/bills/open"); const m = b.map(mapBill); window._BILLS = m; setBills(m); } catch (_) {} };

  // ── socket realtime (sostituisce il generatore finto) ──
  useEffect(() => {
    if(role === "menu_editor")return;
    const restId = session.user.restaurantId || session.restaurant?.id || window.__settings_raw?.id;
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
      else if (ev === "reservation:changed") { setDataVersion((v) => v + 1); }
      else if (ev === "connectivity") { /* Server internet status is not the browser connection. */ }
    });
    const connected = () => setRealtimeOnline(true);
    const disconnected = () => setRealtimeOnline(false);
    if (s) { s.on("connect", connected); s.on("disconnect", disconnected); s.on("connect_error", disconnected); setRealtimeOnline(!!s.connected); }
    return () => { try { if (s) { s.off("connect", connected); s.off("disconnect", disconnected); s.off("connect_error", disconnected); s.disconnect(); } } catch (_) {} };
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
  const onSaveSettings = async (nextOrFn) => {
    // I toggle chiamano set(k,v) → setSettings(s => ({...s,[k]:v})): qui arriva una
    // FUNZIONE updater, non un oggetto. Risolvila contro lo stato corrente, altrimenti
    // next.nome/next.iva… sono undefined → vatRate NaN→null → 400 di validazione.
    const next = typeof nextOrFn === "function" ? nextOrFn(settings) : nextOrFn;
    setSettings(next);
    try { await TakoAPI.patch("/restaurants/me", { name: next.nome, address: next.indirizzo, phone: next.telefono,
      settings: { currency: next.valuta, vatRate: Number(next.iva), timezone: next.fuso, defaultLanguage: next.linguaDefault, languages: next.lingue,
                  tableServiceEnabled: next.servizioTavolo, takeawayEnabled: false, payAtTableEnabled: next.pagaTavolo, aiEnabled: next.ai,
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
                  menuEngineeringEnabled: false,
                  customerOrderingEnabled: next.ordiniClienti !== false, qrMode: next.qrMode === "cloud" ? "cloud" : "lan" } });
      toast("Impostazioni salvate", { type: "success" }); } catch (e) { toast(e.message, { type: "error" }); }
  };

  CUR.sym = CURRENCIES[settings.valuta] || "€";
  const activeOrders = orders.filter((o) => ["attesa", "confermato", "prep", "pronto"].includes(o.stato)).length;
  const badges = { ordini: activeOrders, chiamate: calls.length };
  KPI.ordiniAttivi = activeOrders;

  // Pubblica lo stato live (ordini + sala + badge) per consumatori esterni al tree di App
  // — es. l'anteprima "Streaming" nella sidebar del Cowork, che renderizza ScreenOrdini
  // o ScreenSala in miniatura. `rooms`/`calls` servono all'anteprima della Sala live
  // (target dinamico del widget). L'evento notifica i mount che leggono window.__takoLive
  // fuori da React.
  useEffect(() => { window.__takoLive = { orders, badges, rooms, calls }; window.dispatchEvent(new Event("tako-live")); }, [orders, activeOrders, rooms, calls]);

  let Screen;
  switch (route) {
    case "agency_leads": Screen = session.user.agency===true && window.ScreenAgencyLeads ? <window.ScreenAgencyLeads mobile={mobile}/> : null; break;
    case "agency_tasks": Screen = session.user.agency===true ? <window.ScreenAgencyDashboard mobile={mobile} tasksOnly/> : null; break;
    case "account": Screen = <ScreenMobileAccount mobile={mobile} session={session} go={go}/>; break;
    case "agency": Screen = session.user.agency === true && window.ScreenAgencyDashboard ? <window.ScreenAgencyDashboard mobile={mobile} /> : <ScreenDashboard mobile={mobile} go={go} orders={orders} settings={settings} role={role} />; break;
    case "cowork": Screen = (role === "owner" && window.ScreenCowork) ? React.createElement(window.ScreenCowork, { key: "cowork", mobile }) : <ScreenDashboard mobile={mobile} go={go} orders={orders} settings={settings} role={role} />; break;
    case "dashboard": Screen = <ScreenDashboard mobile={mobile} go={go} orders={orders} settings={settings} role={role} />; break;
    case "ordini": Screen = <ScreenOrdini mobile={mobile} orders={orders} onConfirm={onConfirm} onServe={onServe} onCancel={onCancel} go={go} />; break;
    case "kds": Screen = <ScreenKDS mobile={mobile} orders={orders} onAdvanceItem={onAdvanceItem} onBump={onBump} settings={settings} />; break;
    case "comanda": Screen = <ScreenComanda key={"comanda" + dataVersion} mobile={mobile} />; break;
    case "sala": Screen = <ScreenSala mobile={mobile} rooms={rooms} calls={calls} onSetTableState={onSetTableState} />; break;
    case "chiamate": Screen = <ScreenChiamate mobile={mobile} calls={calls} onResolve={async (call) => { await TakoAPI.post(`/tables/${call._id}/waiter-resolve`); setCalls(c => c.filter(x => x._id !== call._id)); }} />; break;
    case "prenotazioni": Screen = <ScreenPrenotazioni key={"pren" + dataVersion} mobile={mobile} rooms={rooms} />; break;
    case "menu": Screen = ["owner", "menu_editor"].includes(role) && window.ScreenMenuWorkspace ? <window.ScreenMenuWorkspace key={"menu" + dataVersion} mobile={mobile} /> : <ScreenMenu key={"menu" + dataVersion} mobile={mobile} />; break;
    case "statistiche": Screen = role === "owner" && window.ScreenReportsWorkspace ? <window.ScreenReportsWorkspace mobile={mobile}/> : <ScreenStatistiche key={"stats" + dataVersion} mobile={mobile} />; break;
    case "staff": Screen = <ScreenStaff key={"staff" + dataVersion} mobile={mobile} />; break;
    case "impostazioni": Screen = <ScreenImpostazioni mobile={mobile} settings={settings} setSettings={onSaveSettings} />; break;
    default: Screen = <ScreenDashboard mobile={mobile} go={go} orders={orders} settings={settings} role={role} />;
  }

  const sections = {
    sala: [{ id: "sala", label: "Sala live" }],
    statistiche: [{ id: "statistiche", label: "Statistiche" }],
    impostazioni: [{ id: "impostazioni", label: "Locale" }, { id: "staff", label: "Team" }],
  };
  const tabs = (sections[navParent(route)] || []).filter(it => canNavigate(role, it.id));
  const newOrder = ["sala", "ordini", "chiamate"].includes(route) && canNavigate(role, "comanda");
  if (tabs.length > 1 || newOrder) Screen = <WorkspaceNavigation mobile={mobile} tabs={tabs} route={route} go={go} newOrder={newOrder}>{Screen}</WorkspaceNavigation>;
  if (!Object.hasOwn(ROLE_ACCESS, role)) return <div style={{ padding: 32 }}>Il tuo ruolo non è autorizzato ad accedere alla dashboard. Contatta il responsabile del locale.</div>;

  // La schermata sta in un livello che può nascere dal pulsante della Panoramica.
  const ghost = route !== "dashboard" ? <ScreenDashboard mobile={mobile} go={() => {}} orders={orders} settings={settings} role={role} /> : null;
  const Content = <PageMorphLayer route={route} ghost={ghost} mobile={mobile} onBack={() => sbPageBack(go)}>{Screen}</PageMorphLayer>;

  return (
    <>
      {!online && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999, display: "flex", justifyContent: "center", pointerEvents: "none", paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)" }}>
          <div role="status" aria-live="polite" style={{ pointerEvents: "auto", display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 15px", borderRadius: 99, background: "var(--danger)", color: "#fff", fontSize: 13, fontWeight: 700, boxShadow: "0 8px 24px rgba(0,0,0,.20)" }}>
            <Icon name="alert" size={16} stroke={2.4} />
            {"Connessione assente — il servizio richiede internet"}
          </div>
        </div>
      )}
      {mobile ? (
        <div className="screen app-live mobile" style={{ width: "100%", height: "100dvh", position:"fixed", inset:0 }}>
          <div style={{ width: "100%", height: "100%", position: "relative", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--surface)" }}>
            <div className="mobile-header-shell" style={{flex:"none",zIndex:20,paddingTop:"env(safe-area-inset-top, 0px)",background:"var(--surface)"}}>
              <MobileHeader syncDelayed={syncDelayed} route={route} openDrawer={() => setDrawer(true)} live role={role} badges={badges} nome={settings.nome || RESTAURANT.name} go={go} />
            </div>
            <div style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", flexDirection: "column", overflow:"hidden" }}>
              {Content}
            </div>
            <BottomBar route={route} go={go} role={role} badges={badges} openDrawer={() => setDrawer(true)} />
            <MobileDrawer open={drawer} onClose={() => setDrawer(false)} route={route} go={go} role={role} badges={badges} />
          </div>
          <Toaster mobile />
        </div>
      ) : (
        <div className="screen app-live" style={{ width: "100vw", height: "100vh" }}>
          <div style={{ width: "100%", height: "100%", display: "flex", background: "var(--bg)" }}>
            <Sidebar route={route} go={go} role={role} badges={badges} live />
            <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }}>
              {Content}
            </main>
          </div>
          <Toaster mobile={false} />
        </div>
      )}
    </>
  );
}

/* Shared workspace navigation keeps existing screens and their API contracts intact. */
function WorkspaceNavigation({ mobile, tabs, route, go, newOrder, children }) {
  return <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
    <div style={{ flex: "none", padding: mobile ? "12px 14px 0" : "26px 30px 0" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <nav aria-label="Sezioni della pagina" style={{ display: "flex", flex: 1, gap: 6, flexWrap: "wrap" }}>
          {tabs.map(it => <Btn key={it.id} size="sm" kind={route === it.id ? "dark" : "soft"} onClick={() => go(it.id)}>{it.label}</Btn>)}
        </nav>
        {newOrder && <Btn icon="plus" onClick={() => go("comanda")}>Nuovo ordine</Btn>}
      </div>
    </div>
    <div className="workspace-body" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <style>{`.workspace-body > .scroll { padding-top: 16px !important; }`}</style>
      {children}
    </div>
  </div>;
}
function ScreenChiamate({ mobile, calls, onResolve }) {
  const [pending, setPending] = useState({});
  const resolve = async call => {
    if (pending[call._id]) return;
    setPending(p => ({ ...p, [call._id]: true }));
    try { await onResolve(call); toast("Chiamata gestita", { type: "success" }); }
    catch (e) { toast(e.message || "Impossibile chiudere la chiamata", { type: "error" }); }
    finally { setPending(p => ({ ...p, [call._id]: false })); }
  };
  return <ScreenScroll mobile={mobile}>
    <PageHead mobile={mobile} title="Chiamate" sub={`${calls.length} chiamate in attesa`} />
    {!calls.length && <Empty icon="bell" title="Nessuna chiamata in attesa" sub="Le richieste dei clienti appariranno qui." />}
    {calls.map(call => <Card key={call._id} pad={16} style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Icon name="bell" size={24} />
        <div style={{ flex: 1 }}><strong>Tavolo {call.tavolo}</strong><div style={{ color: "var(--ink-2)", fontSize: 13 }}>{call.motivo} · {relTime(call.min)}</div></div>
        <Btn size="sm" disabled={!!pending[call._id]} onClick={() => resolve(call)}>{pending[call._id] ? <TakoLoading label="Chiusura richiesta…" variant="compact"/> : "Gestita"}</Btn>
      </div>
    </Card>)}
  </ScreenScroll>;
}

function Root() {
  const [sessionGeneration,setSessionGeneration]=useState(0);
  const [state, setState] = useState({ phase: "loading", session: null });
  useEffect(() => {
    // 19/10 sera: con ?reset= nell'URL si mostra sempre «Scegli una nuova password», anche con una sessione valida.
    if (new URLSearchParams(location.search).has("reset")) { setState({ phase: "login", session: null }); return; }
    (async () => {
      try {
        const {user:me,restaurant} = await TakoAPI.get("/auth/bootstrap");
        await loadAll(me,restaurant);
        setState({ phase: "app", session: { user: me, restaurant } });
      } catch (_) { setState({ phase: "login", session: null }); }
    })();
  }, []);
  useEffect(()=>{const switchSession=async()=>{const {user,restaurant}=await TakoAPI.get('/auth/bootstrap');await loadAll(user,restaurant);setSessionGeneration(v=>v+1);setState({phase:'app',session:{user,restaurant}})};window.takoSwitchSession=switchSession;return()=>{if(window.takoSwitchSession===switchSession)delete window.takoSwitchSession}},[]);
  const onLogin = async (d) => { await loadAll(d.user,d.restaurant); setState({ phase: "app", session: { user: d.user, restaurant: d.restaurant } }); };
  if (state.phase === "loading") return <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--ink-3)" }}><TakoLoading label="Accesso a Takomenu…" variant="screen"/></div>;
  if (state.phase === "login") return <LoginGate onDone={onLogin} />;
  return <App key={state.session.user.restaurantId+':'+sessionGeneration} session={state.session} />;
}

/* ── schermata di crash (italiana) mostrata dall'ErrorBoundary ── */
function CrashScreen({ onReload, onHome }) {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <div style={{ width: 400, maxWidth: "100%", background: "#fff", borderRadius: 12, padding: 28, boxShadow: "0 8px 40px rgba(0,0,0,.08)", border: "1px solid #eee", textAlign: "center" }}>
        <img src="assets/takos/arancione/pollice_in_su.png" alt="Takomenu" style={{ width: 84, height: 84, objectFit: "contain", margin: "0 auto 10px" }} />
        <div style={{ fontWeight: 900, fontSize: 21, color: "var(--ink)", marginBottom: 8 }}>Qualcosa è andato storto</div>
        <div style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.5, marginBottom: 22 }}>
          Si è verificato un errore imprevisto nella dashboard. Puoi ricaricare la pagina oppure tornare alla Dashboard.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onHome} style={{ flex: 1, padding: "12px", border: "1px solid var(--hairline)", background: "#fff", color: "var(--ink)", fontWeight: 500, borderRadius: 999, fontSize: 14.5, cursor: "pointer" }}>Torna alla Dashboard</button>
          <button onClick={onReload} style={{ flex: 1, padding: "12px", border: "none", background: "var(--ink)", color: "#fff", fontWeight: 500, borderRadius: 999, fontSize: 14.5, cursor: "pointer" }}>Ricarica</button>
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

function ScreenMobileAccount({mobile,session,go}){const [error,setError]=useState(''),[busy,setBusy]=useState(false);const logout=async()=>{if(busy)return;if(window.__takoMenuLeaveGuard&&!window.__takoMenuLeaveGuard())return;setBusy(true);setError('');try{await window.TakoActions.logout();localStorage.removeItem('tako-dash-route');location.reload();}catch(e){setError(e.message||'Impossibile uscire');setBusy(false)}};return <ScreenScroll mobile={mobile}><section className="mobile-account"><Card><h2>{session.user.name}</h2><p>{session.user.email}</p><Badge>{session.user.agency?'Amministratore agenzia':'Gestione ristorante'}</Badge></Card>{!session.user.agency&&<Card><h3>{session.restaurant?.name||'Il tuo ristorante'}</h3><p>Dati del locale e impostazioni</p><Btn full kind="soft" onClick={()=>go('impostazioni')}>Impostazioni del locale</Btn></Card>}<ChangePasswordCard/>{error&&<p role="alert">{error}</p>}<Btn full kind="soft" disabled={busy} onClick={logout}>{busy?'Uscita…':"Esci dall’account"}</Btn></section></ScreenScroll>}

/* 19/10: cambio password da dentro la dashboard (password attuale, nuova, ripeti). Le altre sessioni aperte si chiudono, questa resta. */
function ChangePasswordCard(){const [open,setOpen]=useState(false),[current,setCurrent]=useState(''),[next,setNext]=useState(''),[again,setAgain]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState('');
 const reset=()=>{setCurrent('');setNext('');setAgain('');setError('')};
 const submit=async e=>{e.preventDefault();if(busy)return;setError('');setDone('');if(next.length<8){setError('La nuova password deve avere almeno 8 caratteri.');return}if(next!==again){setError('Le due password non coincidono.');return}
  setBusy(true);try{await TakoAPI.post('/web-accounts/change-password',{current,password:next});reset();setOpen(false);setDone('Password cambiata. Sugli altri dispositivi dovrai entrare di nuovo.')}catch(ex){setError(ex.status===429?'Troppi tentativi, riprova tra qualche minuto.':ex.message||'Password non cambiata. Riprova.')}finally{setBusy(false)}};
 return <Card><h3>Password</h3>{done&&<p role="status" style={{color:'var(--ok,#2b8a3e)',fontWeight:700}}>{done}</p>}
  {!open?<Btn full kind="soft" onClick={()=>{setOpen(true);setDone('')}}>Cambia password</Btn>:
  <form onSubmit={submit} className="mw change-password-form" style={{display:'grid',gap:10}}>
   <label className="mw-field"><span>Password attuale</span><input type="password" autoComplete="current-password" required value={current} disabled={busy} onChange={e=>setCurrent(e.target.value)}/></label>
   <label className="mw-field"><span>Nuova password</span><input type="password" autoComplete="new-password" required minLength={8} placeholder="almeno 8 caratteri" value={next} disabled={busy} onChange={e=>setNext(e.target.value)}/></label>
   <label className="mw-field"><span>Ripeti nuova password</span><input type="password" autoComplete="new-password" required minLength={8} value={again} disabled={busy} onChange={e=>setAgain(e.target.value)}/></label>
   {error&&<p role="alert" style={{color:'var(--danger)'}}>{error}</p>}
   <div style={{display:'flex',gap:8}}><Btn disabled={busy}>{busy?'Salvataggio…':'Conferma'}</Btn><Btn type="button" kind="ghost" disabled={busy} onClick={()=>{reset();setOpen(false)}}>Annulla</Btn></div>
  </form>}</Card>}
