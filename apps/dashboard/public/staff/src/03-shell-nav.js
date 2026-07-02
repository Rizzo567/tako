/* ───────────────── Tako Dashboard — shell responsive + navigazione ───────────────── */

const NAV = [
  { group: "Operatività", items: [
    { id: "dashboard", label: "Dashboard", icon: "home" },
    { id: "ordini", label: "Ordini", icon: "orders", badge: true },
    { id: "kds", label: "Cucina", icon: "kitchen" },
    { id: "cassa", label: "Cassa", icon: "cassa" },
    { id: "comanda", label: "Comanda", icon: "comanda" },
  ]},
  { group: "Sala", items: [
    { id: "sala", label: "Sala Live", icon: "map" },
    { id: "tavoli", label: "Gestione Tavoli", icon: "table" },
    { id: "prenotazioni", label: "Prenotazioni", icon: "clock" },
    { id: "qr", label: "QR Codes", icon: "qr" },
    { id: "collega", label: "Collega dispositivi", icon: "qr" },
  ]},
  { group: "Gestione", items: [
    { id: "menu", label: "Menu", icon: "menu" },
    { id: "inventario", label: "Inventario", icon: "inventory" },
    { id: "statistiche", label: "Statistiche", icon: "stats" },
    { id: "insights", label: "Analisi Menu", icon: "insights" },
    { id: "staff", label: "Staff", icon: "staff" },
    { id: "turni", label: "Turni", icon: "clock" },
  ]},
];

/* accesso per ruolo (owner = tutto) */
const ROLE_ACCESS = {
  owner: null,
  cameriere: ["dashboard", "ordini", "sala", "tavoli", "prenotazioni", "comanda", "cassa", "menu", "turni"],
  chef: ["dashboard", "kds", "ordini", "menu", "inventario", "turni"],
  cassiere: ["dashboard", "cassa", "ordini", "sala", "prenotazioni", "turni"],
};
/* schermata d'ingresso per ruolo */
const ROLE_HOME = { owner: "dashboard", cameriere: "sala", chef: "kds", cassiere: "cassa" };
/* item primari bottom-bar mobile per ruolo */
const MOBILE_PRIMARY = {
  owner: ["dashboard", "ordini", "sala", "cassa"],
  cameriere: ["sala", "ordini", "comanda", "cassa"],
  chef: ["kds", "ordini", "menu", "inventario"],
  cassiere: ["cassa", "ordini", "sala", "dashboard"],
};

function navAllowed(role) {
  const allow = ROLE_ACCESS[role];
  return NAV.map(g => ({ ...g, items: g.items.filter(it => !allow || allow.includes(it.id)) })).filter(g => g.items.length);
}
function findItem(id) {
  for (const g of NAV) for (const it of g.items) if (it.id === id) return it;
  return { id, label: id, icon: "home" };
}

/* ───────────────── desktop sidebar (3 riquadri) ───────────────── */
function Sidebar({ route, go, role, badges, live }) {
  const groups = navAllowed(role);
  const [collapsed, setCollapsed] = useState({});
  const toggle = (k) => setCollapsed(c => ({ ...c, [k]: !c[k] }));
  const NavBtn = (it) => {
    const on = route === it.id;
    return (
      <button key={it.id} className={"press nav-item" + (on ? " on" : "")} onClick={() => go(it.id)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "7px 11px", borderRadius: 11, marginBottom: 1,
          color: on ? "var(--on-brand)" : "var(--nav-ink)", background: on ? "var(--brand)" : "transparent", fontWeight: on ? 700 : 600, fontSize: 14,
          boxShadow: on ? "0 6px 16px -6px var(--brand)" : "none", transition: "background .15s" }}>
        <span className="nav-ico"><Icon name={it.icon} size={18} /></span>
        <span style={{ flex: 1, textAlign: "left" }}>{it.label}</span>
        {it.badge && badges.ordini > 0 && (
          <span style={{ minWidth: 19, height: 19, padding: "0 6px", borderRadius: 99, background: on ? "rgba(255,255,255,.25)" : "var(--brand)", color: "var(--on-brand)", fontSize: 11, fontWeight: 800, display: "grid", placeItems: "center" }}>{badges.ordini}</span>
        )}
      </button>
    );
  };
  const boxStyle = { background: "var(--nav)", color: "var(--nav-ink)", borderRadius: 12, boxShadow: "var(--sh-2)", flex: "none" };

  return (
    <aside className="scroll" style={{ width: 238, flex: "none", margin: "5px 12px 12px 5px", height: "calc(100% - 17px)", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
      {groups.map((g, gi) => {
        const isFirst = gi === 0;
        const isLast = gi === groups.length - 1;
        const isOpen = !collapsed[g.group];
        return (
          <div key={g.group} style={{ ...boxStyle, padding: isFirst ? "30px 10px 9px" : "8px 10px 9px" }}>
            {isFirst && (
              <div style={{ padding: "7px 7px 9px", display: "flex", alignItems: "center", gap: 9 }}>
                <Tako pose="logoMark" size={38} float={false} style={{ filter: "drop-shadow(0 6px 12px rgba(0,0,0,.3))" }} />
                <div>
                  <div style={{ fontFamily: "var(--f-display)", fontWeight: 900, fontSize: 19, color: "#fff", lineHeight: 1 }}>Tako</div>
                  <div style={{ fontSize: 10.5, color: "var(--nav-ink-2)", marginTop: 2 }}>Dashboard</div>
                </div>
              </div>
            )}
            <button className="press" onClick={() => toggle(g.group)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "5px 9px 7px", background: "transparent" }}>
              <span style={{ fontFamily: "var(--f-display)", fontWeight: 800, fontSize: 13.5, color: "var(--nav-ink)", letterSpacing: ".005em" }}>{g.group}</span>
              <Icon name="chevD" size={15} style={{ marginLeft: "auto", color: "var(--nav-ink-2)", transform: isOpen ? "none" : "rotate(-90deg)", transition: "transform .2s" }} />
            </button>
            <div style={{ overflow: "hidden", transition: "max-height .34s var(--out), opacity .26s ease", maxHeight: isOpen ? g.items.length * 40 + 4 : 0, opacity: isOpen ? 1 : 0 }}>
              {g.items.map(NavBtn)}
            </div>
            {isLast && <SidebarUser role={role} go={go} />}
          </div>
        );
      })}
    </aside>
  );
}

/* menu a tendina utente (footer sidebar) */
function SidebarUser({ role, go }) {
  const r = ROLES[role];
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const items = [
    { label: "Impostazioni", icon: "settings", onClick: () => { go("impostazioni"); setOpen(false); } },
    { label: "Notifiche", icon: "bell", onClick: () => { setNotifOpen(true); setOpen(false); } },
  ];
  return (
    <div ref={ref} style={{ position: "relative", paddingTop: 10, marginTop: 8, borderTop: "1px solid var(--nav-line)" }}>
      <NotificationsSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
      {open && (
        <div className="pop-in" style={{ position: "absolute", left: 0, right: 0, bottom: "calc(100% - 2px)", transformOrigin: "bottom", background: "var(--nav-2)", border: "1px solid var(--nav-line)", borderRadius: 14, boxShadow: "var(--sh-3)", padding: 6, marginBottom: 6 }}>
          {items.map(it => (
            <button key={it.label} className="press nav-item" onClick={it.onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 11px", borderRadius: 10, color: "var(--nav-ink)", fontSize: 14, fontWeight: 600, background: "transparent" }}>
              <span className="nav-ico"><Icon name={it.icon} size={18} /></span>{it.label}
            </button>
          ))}
          <div style={{ height: 1, background: "var(--nav-line)", margin: "5px 8px" }} />
          <button className="press" onClick={async () => { try { await window.TakoActions.logout(); } catch (_) {} ; try { localStorage.removeItem('tako-dash-route'); } catch(_){}; window.location.reload(); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 11px", borderRadius: 10, color: "#F0907F", fontSize: 14, fontWeight: 700, background: "transparent" }}>
            <Icon name="logout" size={18} />Esci dall'account
          </button>
        </div>
      )}
      <button className="press" onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: open ? "var(--nav-2)" : "transparent", borderRadius: 11, padding: 5 }}>
        <Avatar initials={r.initials} size={34} color="var(--brand)" />
        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--nav-ink-2)" }}>{r.label}</div>
        </div>
        <Icon name="chevU" size={16} style={{ color: "var(--nav-ink-2)", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
    </div>
  );
}

/* ───────────────── mobile chrome ───────────────── */
/* notifiche derivate dai dati reali: ultimi ordini (per orario) + chiamate cameriere aperte */
function buildNotifications() {
  const items = [];
  const orders = (window._ORDERS || []).slice();
  const calls = (window._WAITER || []).slice();
  for (const c of calls) {
    items.push({ icon: "bell", tone: "info", title: `Tavolo ${c.tavolo} chiama il cameriere`, sub: c.motivo || "Chiamata in sala", min: typeof c.min === "number" ? c.min : 0, unread: true });
  }
  for (const o of orders) {
    const piatti = (o.items || []).reduce((a, i) => a + (i.qty || 0), 0);
    const dove = o.tipo === "asporto" ? "Asporto" : `Tavolo ${o.tavolo}`;
    items.push({ icon: "orders", tone: o.stato === "pronto" ? "ok" : "brand", title: `${o.stato === "pronto" ? "Pronto" : "Nuovo ordine"} · ${dove}`, sub: `${piatti} piatti · ${o.orario}`, min: typeof o.min === "number" ? o.min : 0, unread: o.stato === "attesa" || o.stato === "pronto" });
  }
  // più recenti prima (min = minuti trascorsi), max 8
  return items.sort((a, b) => a.min - b.min).slice(0, 8);
}
function relTime(min) {
  if (min <= 0) return "ora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h`;
}
function NotificationsSheet({ open, onClose }) {
  const { mounted, active } = useMountTransition(open, 340);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { if (open) setDismissed(false); }, [open]);
  if (!mounted) return null;
  const list = dismissed ? [] : buildNotifications();
  const unread = list.filter(n => n.unread).length;
  return ReactDOM.createPortal(
    <div style={{ position: "absolute", inset: 0, zIndex: 130, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(30,20,16,.45)", opacity: active ? 1 : 0, transition: "opacity .3s", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "relative", background: "var(--surface)", borderRadius: "26px 26px 0 0", boxShadow: "var(--sh-pop)", maxHeight: "76%", display: "flex", flexDirection: "column", transform: active ? "translateY(0)" : "translateY(100%)", transition: "transform .36s var(--spring)", overflow: "hidden" }}>
        <div style={{ flex: "none", padding: "10px 0 4px", display: "grid", placeItems: "center" }}><span style={{ width: 38, height: 5, borderRadius: 99, background: "var(--hairline)" }} /></div>
        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "6px 18px 14px", borderBottom: "1px solid var(--hairline)" }}>
          <h3 style={{ fontSize: 19, fontWeight: 900, fontFamily: "var(--f-display)" }}>Notifiche</h3>
          {unread > 0 && <Badge tone="brand" solid>{unread} nuove</Badge>}
          {list.length > 0 && <button className="press" onClick={() => setDismissed(true)} style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>Segna lette</button>}
        </div>
        <div className="scroll" style={{ overflowY: "auto", padding: "6px 12px 16px" }}>
          {list.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--ink-3)" }}>
              <Icon name="bell" size={30} style={{ color: "var(--ink-3)", margin: "0 auto 10px" }} />
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink-2)" }}>Nessuna notifica</div>
              <div style={{ fontSize: 12.5, marginTop: 4 }}>Gli ordini e le chiamate in arrivo compaiono qui.</div>
            </div>
          ) : list.map((n, i) => {
            const [bg, fg] = TONE[n.tone] || TONE.muted;
            return (
              <div key={i} className="press" style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 10px", borderRadius: 14, background: n.unread ? "var(--brand-wash)" : "transparent" }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, flex: "none", display: "grid", placeItems: "center", background: bg, color: fg }}><Icon name={n.icon} size={19} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.25 }}>{n.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 2 }}>{n.sub}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flex: "none" }}>
                  <span style={{ fontSize: 11.5, color: "var(--ink-3)" }} className="mono">{relTime(n.min)}</span>
                  {n.unread && <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--brand)" }} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.querySelector(".screen") || document.body
  );
}
/* intro contestuale per ogni sezione (mascotte + titolo) */
function routeIntro(route) {
  const m = {
    dashboard: { pose: "hello", title: `Buonasera, ${ROLES.owner.name.split(" ")[0]}!` },
    ordini: { pose: "phone", title: "Ordini live" },
    kds: { pose: "chef", title: "Cucina" },
    cassa: { pose: "pay", title: "Cassa" },
    comanda: { pose: "phone", title: "Comanda" },
    sala: { pose: "serve", title: "Sala Live" },
    tavoli: { pose: "serve", title: "Gestione Tavoli" },
    qr: { pose: "phone", title: "QR Codes" },
    menu: { pose: "dish", title: "Menu" },
    inventario: { pose: "dishAlt", title: "Inventario" },
    statistiche: { pose: "pay", title: "Statistiche" },
    insights: { pose: "dishAlt", title: "Analisi Menu" },
    staff: { pose: "hello", title: "Staff" },
    impostazioni: { pose: "bowtie", title: "Impostazioni" },
  };
  return m[route] || { pose: "neutral", title: findItem(route).label };
}
function MobileHeader({ route, openDrawer, live, role, badges, nome, dark, go }) {
  const intro = routeIntro(route);
  const fg = dark ? "#fff" : "var(--ink)";
  const [notifOpen, setNotifOpen] = useState(false);
  const [anim, setAnim] = useState(null); // { n, phase }
  useLiveNotif(useCallback((n) => setAnim({ n, phase: "prep" }), []));
  useEffect(() => {
    if (!anim) return;
    const next = { prep: ["enter", 30], enter: ["reveal", 560], reveal: ["hold", 540], hold: ["collapse", 2900], collapse: ["exit", 400], exit: [null, 440] }[anim.phase];
    if (!next) return;
    const t = setTimeout(() => setAnim(a => (a ? (next[0] ? { ...a, phase: next[0] } : null) : null)), next[1]);
    return () => clearTimeout(t);
  }, [anim]);

  const ph = anim?.phase;
  const busy = !!anim;
  const headerHidden = busy && ph !== "exit";                 // rientra durante l'uscita
  const active = busy && (ph === "enter" || ph === "reveal" || ph === "hold" || ph === "collapse");
  // capsule geometry per phase (uscita = entrata al contrario)
  const cap = {
    prep:     { x: 290, w: 44,  s: .78, rot: 9,  o: 0 },
    enter:    { x: 0,   w: 44,  s: 1,   rot: 0,  o: 1 },
    reveal:   { x: 0,   w: 256, s: 1,   rot: 0,  o: 1 },
    hold:     { x: 0,   w: 256, s: 1,   rot: 0,  o: 1 },
    collapse: { x: 0,   w: 44,  s: 1,   rot: 0,  o: 1 },
    exit:     { x: 290, w: 44,  s: .78, rot: 9,  o: 0 },
  }[ph] || { x: 290, w: 44, s: .78, rot: 9, o: 0 };
  const capTrans = {
    prep: "none",
    enter: "transform .58s cubic-bezier(.3,1.35,.42,1), opacity .3s ease",
    reveal: "width .52s cubic-bezier(.34,1.5,.5,1)",
    hold: "none",
    collapse: "width .4s cubic-bezier(.5,0,.5,1)",
    exit: "transform .44s cubic-bezier(.45,0,.7,.55), opacity .34s ease",
  }[ph] || "none";
  const showText = ph === "reveal" || ph === "hold";

  return (
    <header style={{ position: "relative", flex: "none", display: "flex", alignItems: "center", gap: 11, padding: "6px 14px 10px", background: "transparent", minHeight: 64 }}>
      {/* logo (reagisce all'arrivo) */}
      <div style={{ position: "relative", flex: "none", display: "grid", placeItems: "center" }}>
        {active && <span className="nb-glow" style={{ position: "absolute", width: 46, height: 46, borderRadius: "50%", background: "radial-gradient(circle, var(--brand) 0%, transparent 70%)", pointerEvents: "none" }} />}
        <Tako pose={intro.pose} size={52} float={false} className={busy ? "nb-tako" : undefined} style={{ flex: "none", position: "relative" }} />
      </div>

      {/* contenuto header — sfuma ed esce verso l'alto */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 11, transform: headerHidden ? "translateY(-30px) scale(.92)" : "translateY(0) scale(1)", filter: headerHidden ? "blur(4px)" : "blur(0)", opacity: headerHidden ? 0 : 1, transition: "transform .4s var(--out), opacity .3s ease, filter .3s ease", transformOrigin: "left center", pointerEvents: headerHidden ? "none" : "auto" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--f-display)", fontWeight: 900, fontSize: 21, lineHeight: 1.05, color: fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{intro.title}</div>
        </div>
        {route === "cassa" && (
          <button className="press" onClick={() => { if (window.__openNewBill) window.__openNewBill(); else window.takoGo && window.takoGo('cassa'); }} style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 6, height: 40, padding: "0 14px", borderRadius: 12, background: "var(--brand)", color: "var(--on-brand)", fontWeight: 700, fontSize: 13.5, fontFamily: "var(--f-ui)", boxShadow: "0 6px 16px -6px var(--brand)" }}>
            <Icon name="plus" size={17} />Nuovo conto
          </button>
        )}
        <span style={{ position: "relative", flex: "none" }}>
          <IconBtn name="bell" tone="soft" size={40} onClick={() => setNotifOpen(true)} style={dark ? { background: "rgba(255,255,255,.1)", color: "#fff" } : undefined} />
          <span style={{ position: "absolute", top: 0, right: 0, width: 10, height: 10, borderRadius: 99, background: "var(--brand)", border: `2px solid ${dark ? "#1A1310" : "var(--surface)"}` }} />
        </span>
      </div>

      {/* capsula notifica volante */}
      {busy && (
        <div onClick={() => { setAnim(null); setNotifOpen(true); }}
          className={ph === "hold" ? "nb-float" : undefined}
          style={{ position: "absolute", left: 74, top: 9, height: 46, width: cap.w, maxWidth: "calc(100% - 88px)", display: "flex", alignItems: "center", gap: 10, padding: "0 10px", borderRadius: 15, background: "var(--nav)", color: "var(--nav-ink)", boxShadow: "0 14px 30px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.08)", overflow: "hidden", whiteSpace: "nowrap", opacity: cap.o, transform: `translateX(${cap.x}px) scale(${cap.s}) rotate(${cap.rot}deg)`, transformOrigin: "right center", transition: capTrans, zIndex: 30, cursor: "pointer" }}>
          {/* sheen sweep */}
          {active && <span className="nb-sheen" style={{ position: "absolute", top: 0, bottom: 0, width: 40, background: "linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent)", pointerEvents: "none" }} />}
          {/* icona */}
          <span style={{ position: "relative", flex: "none", width: 28, height: 28, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--brand)", color: "#fff", boxShadow: "0 4px 10px -3px var(--brand)" }}>
            <Icon name={anim.n.icon || "bell"} size={16} stroke={2.6} className={active ? "nb-bell" : undefined} />
            {active && <span className="nb-pop" style={{ position: "absolute", top: -3, right: -3, width: 9, height: 9, borderRadius: 99, background: "#fff", border: "1.5px solid var(--nav)" }} />}
          </span>
          {/* testo */}
          <span style={{ minWidth: 0, display: showText ? "block" : "none" }} className={showText ? "nb-textin" : undefined}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis" }}>{anim.n.title}</span>
            {anim.n.sub && <span style={{ display: "block", fontSize: 11.5, color: "var(--nav-ink-2)", overflow: "hidden", textOverflow: "ellipsis" }}>{anim.n.sub}</span>}
          </span>
        </div>
      )}

      <NotificationsSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
    </header>
  );
}
/* iOS status bar + dynamic island */
function IOSStatusBar({ dark }) {
  const fg = dark ? "#FFFFFF" : "var(--ink)";
  return (
    <div style={{ position: "relative", flex: "none", height: 48, display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 28px 7px", zIndex: 25 }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: fg, fontFamily: "var(--f-ui)", letterSpacing: ".02em" }}>9:41</span>
      <div style={{ position: "absolute", top: 9, left: "50%", transform: "translateX(-50%)", width: 116, height: 33, borderRadius: 18, background: "#000", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 11 }}>
        <span style={{ width: 9, height: 9, borderRadius: 99, background: "#0E1A2B", boxShadow: "inset 0 0 0 1px rgba(90,130,180,.5)" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: fg }}>
        <span style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 11 }}>{[6, 8, 10, 12].map(h => <span key={h} style={{ width: 3, height: h, borderRadius: 1, background: fg }} />)}</span>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" style={{ color: fg }}><path d="M8 10.4a1 1 0 100-2 1 1 0 000 2M3.4 6.6a6.5 6.5 0 019.2 0M5.6 8.5a3.4 3.4 0 014.8 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
        <span style={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <span style={{ width: 22, height: 11, borderRadius: 3, border: `1.2px solid ${fg}`, padding: 1.5, opacity: .9, display: "flex" }}><span style={{ width: "75%", height: "100%", borderRadius: 1, background: fg }} /></span>
          <span style={{ width: 1.5, height: 4, borderRadius: 1, background: fg, opacity: .9 }} />
        </span>
      </div>
    </div>
  );
}
function HomeIndicator({ dark }) {
  return <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", width: 134, height: 5, borderRadius: 99, background: dark ? "rgba(255,255,255,.5)" : "rgba(42,31,26,.32)", zIndex: 45, pointerEvents: "none" }} />;
}

/* floating glass tab bar */
function BottomBar({ route, go, role, badges, openDrawer, dark }) {
  const prim = MOBILE_PRIMARY[role].map(findItem);
  const compact = useScrollDown();
  const idle = dark ? "#9B9CA4" : "var(--ink-3)";
  const glass = dark
    ? { background: "linear-gradient(160deg, rgba(62,54,48,.4), rgba(26,21,18,.26))", border: "1px solid rgba(255,255,255,.16)", boxShadow: "0 16px 42px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.22), inset 0 -1px 0 rgba(255,255,255,.06)" }
    : { background: "linear-gradient(160deg, rgba(255,255,255,.5), rgba(255,255,255,.24))", border: "1px solid rgba(255,255,255,.7)", boxShadow: "0 16px 42px rgba(42,31,26,.22), inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(255,255,255,.35)" };
  const Tab = ({ it, isMore }) => {
    const on = !isMore && route === it.id;
    return (
      <button className="press bb-tab" onClick={isMore ? openDrawer : () => go(it.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: compact ? 0 : 4, padding: compact ? "8px 0" : "9px 0 8px", color: on ? "var(--brand)" : idle, position: "relative" }}>
        <span className="nav-ico" style={{ position: "relative" }}>
          <Icon name={isMore ? "apps" : it.icon} size={compact ? 25 : 22} stroke={on ? 2.5 : 2} />
          {!isMore && it.badge && badges.ordini > 0 && <span style={{ position: "absolute", top: -5, right: -8, minWidth: 15, height: 15, padding: "0 4px", borderRadius: 99, background: "var(--brand)", color: "var(--on-brand)", fontSize: 9.5, fontWeight: 800, display: "grid", placeItems: "center", border: dark ? "1.5px solid #1A1310" : "1.5px solid rgba(255,255,255,.95)" }}>{badges.ordini}</span>}
        </span>
        <span style={{ fontSize: 10, fontWeight: on ? 700 : 600, maxHeight: compact ? 0 : 14, opacity: compact ? 0 : 1, overflow: "hidden", transition: "max-height .25s var(--out), opacity .18s" }}>{isMore ? "Altro" : it.label.split(" ")[0]}</span>
      </button>
    );
  };
  return (
    <nav style={{ position: "absolute", left: 14, right: 14, bottom: 26, display: "flex", alignItems: "stretch", borderRadius: 26, padding: "2px 6px", zIndex: 40, backdropFilter: "blur(30px) saturate(200%)", WebkitBackdropFilter: "blur(30px) saturate(200%)", transition: "padding .25s var(--out)", ...glass }}>
      {prim.map(it => <Tab key={it.id} it={it} />)}
      <Tab isMore it={{}} />
    </nav>
  );
}

/* drawer "Altro": pannello arrotondato, esclude le voci della bottom-bar */
function MobileDrawer({ open, onClose, route, go, role, badges }) {
  const primary = MOBILE_PRIMARY[role];
  const groups = navAllowed(role).map(g => ({ ...g, items: g.items.filter(it => !primary.includes(it.id)) })).filter(g => g.items.length);
  const r = ROLES[role];
  return (
    <Overlay open={open} onClose={onClose} anchor="right">
      <div className="scroll" style={{ width: 296, maxWidth: "86vw", height: "auto", maxHeight: "calc(100% - 24px)", alignSelf: "flex-end", margin: "12px 12px 12px 0", borderRadius: 26, background: "var(--nav)", color: "var(--nav-ink)", overflowY: "auto", padding: "16px 12px", boxShadow: "var(--sh-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 6px 14px" }}>
          <span style={{ fontFamily: "var(--f-display)", fontWeight: 900, fontSize: 20, color: "#fff" }}>Altro</span>
          <span style={{ fontSize: 12.5, color: "var(--nav-ink-2)" }}>tutte le funzioni</span>
          <IconBtn name="x" tone="ghost" size={34} style={{ marginLeft: "auto", color: "var(--nav-ink-2)" }} onClick={onClose} />
        </div>
        {groups.map(g => (
          <div key={g.group} style={{ marginBottom: 12 }}>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--nav-ink-2)", padding: "6px 8px" }}>{g.group}</div>
            {g.items.map(it => {
              const on = route === it.id;
              return (
                <button key={it.id} className={"press nav-item" + (on ? " on" : "")} onClick={() => { go(it.id); onClose(); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px", borderRadius: 12, color: on ? "var(--on-brand)" : "var(--nav-ink)", background: on ? "var(--brand)" : "transparent", fontWeight: on ? 700 : 600, fontSize: 15 }}>
                  <span className="nav-ico"><Icon name={it.icon} size={20} /></span><span style={{ flex: 1, textAlign: "left" }}>{it.label}</span>
                  {it.badge && badges.ordini > 0 && <span style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 99, background: on ? "rgba(255,255,255,.25)" : "var(--brand)", color: "var(--on-brand)", fontSize: 11.5, fontWeight: 800, display: "grid", placeItems: "center" }}>{badges.ordini}</span>}
                </button>
              );
            })}
          </div>
        ))}
        <div style={{ marginTop: 8, padding: 12, borderTop: "1px solid var(--nav-line)", display: "flex", alignItems: "center", gap: 11 }}>
          <Avatar initials={r.initials} size={36} />
          <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{r.name}</div><div style={{ fontSize: 12, color: "var(--nav-ink-2)" }}>{r.label}</div></div>
          <IconBtn name="settings" tone="ghost" size={36} style={{ color: "var(--nav-ink-2)" }} onClick={() => { go("impostazioni"); onClose(); }} />
          <IconBtn name="logout" tone="ghost" size={36} style={{ color: "#F0907F" }} onClick={async () => { try { await window.TakoActions.logout(); } catch (_) {} ; try { localStorage.removeItem('tako-dash-route'); } catch(_){}; window.location.reload(); }} />
        </div>
      </div>
    </Overlay>
  );
}

Object.assign(window, { NAV, ROLE_ACCESS, ROLE_HOME, MOBILE_PRIMARY, navAllowed, findItem, Sidebar, MobileHeader, BottomBar, MobileDrawer, IOSStatusBar, HomeIndicator });
