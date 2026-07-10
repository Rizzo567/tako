/* ───────────────── Tako Dashboard — kit primitivi ───────────────── */
const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;

/* icone Lucide-style, stroke 2, viewBox 24 */
const IC = {
  copy:'M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2zM4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2',
  home:'M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5',
  orders:'M5 3h11l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zM8 8h8M8 12h8M8 16h5',
  kitchen:'M5 11h14v1a7 7 0 0 1-14 0zM3 11h18M5 12H3M19 12h2M8.3 6c.6-.8.2-1.9-.3-2.6M12 6c.6-.8.2-1.9-.3-2.6M15.7 6c.6-.8.2-1.9-.3-2.6',
  cassa:'M3 7h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 7l2-3h14l2 3M16 13h2',
  menu:'M4 4h13a3 3 0 0 1 0 6H4zM4 4v16M4 14h13a3 3 0 0 1 0 6H4',
  stats:'M4 20V10M10 20V4M16 20v-7M22 20H2',
  insights:'M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4',
  inventory:'M3 8 12 3l9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v9',
  staff:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.8',
  settings:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 6 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H.1a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 1.4 6M4.6 4.6l.1.1A1.6 1.6 0 0 0 7 4.6h0M9 1.4V1a2 2 0 0 1 4 0v.1',
  sala:'M3 3h18v18H3zM3 9h18M9 9v12',
  qr:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
  comanda:'M9 3h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2V4a1 1 0 0 1 1-1zM9 5h6M9 12l2 2 4-4',
  plus:'M5 12h14M12 5v14', minus:'M5 12h14', check:'M20 6 9 17l-5-5',
  x:'M18 6 6 18M6 6l12 12', search:'M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M21 21l-4.3-4.3',
  filter:'M22 3H2l8 9.5V19l4 2v-8.5z', bell:'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  chevL:'m15 18-6-6 6-6', chevR:'m9 18 6-6-6-6', chevD:'m6 9 6 6 6-6', chevU:'m18 15-6-6-6 6',
  arrowR:'M5 12h14M13 5l7 7-7 7', clock:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 7v5l3 2',
  edit:'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z',
  trash:'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
  more:'M12 5h.01M12 12h.01M12 19h.01',
  apps:'M5 5h.01M12 5h.01M19 5h.01M5 12h.01M12 12h.01M19 12h.01M5 19h.01M12 19h.01M19 19h.01', logout:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  alert:'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0M12 9v4M12 17h.01',
  sparkles:'M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6ZM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18z',
  printer:'M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v7H6z',
  split:'M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7', banknote:'M3 6h18v12H3zM12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M6 9v.01M18 15v.01',
  card:'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1M2 10h20',
  smartphone:'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1M11 18h2',
  euro:'M19 5a7 7 0 1 0 0 14M5 9h7M5 13h6',
  coins:'M8 8m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82', user:'M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  download:'M12 3v12M7 10l5 5 5-5M5 21h14', flame:'M12 22a7 7 0 0 0 7-7c0-3-2-5-3-7-1.5 1-2 2-2 2s-1-4-4-6c0 4-3 5-3 11a5 5 0 0 0 5 5',
  refresh:'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z', map:'M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15',
  phone:'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  table:'M3 9h18M3 9 5 4h14l2 5M4 9v11M20 9v11M9 9v4M15 9v4',
  move:'M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3',
  apps:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
};
function Icon({ name, size = 20, stroke = 2, fill = "none", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block", flex: "none", ...style }}>
      <path d={IC[name] || ""} fill={fill} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* card */
function Card({ children, pad = 18, style, className = "", ...rest }) {
  return <div className={className} style={{ background: "var(--raised)", borderRadius: "var(--r-lg)", boxShadow: "var(--sh-1)", border: "1px solid var(--hairline)", padding: pad, ...style }} {...rest}>{children}</div>;
}

/* button */
function Btn({ children, onClick, kind = "brand", size = "md", icon, full, disabled, style }) {
  const sizes = { sm: { h: 36, px: 13, fs: 13.5 }, md: { h: 44, px: 18, fs: 15 }, lg: { h: 52, px: 24, fs: 16.5 } }[size];
  const kinds = {
    brand: { background: disabled ? "var(--ink-3)" : "var(--brand)", color: "var(--on-brand)", boxShadow: disabled ? "none" : "0 6px 16px -6px var(--brand)" },
    dark: { background: "var(--ink)", color: "var(--surface)" },
    soft: { background: "var(--sunken)", color: "var(--ink)" },
    ghost: { background: "transparent", color: "var(--ink)", boxShadow: "inset 0 0 0 1.5px var(--hairline)" },
    danger: { background: "var(--danger-bg)", color: "var(--danger)" },
    ok: { background: "var(--ok)", color: "#fff" },
  }[kind];
  return (
    <button className="press" onClick={onClick} disabled={disabled}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: full ? "100%" : "auto",
        height: sizes.h, padding: `0 ${sizes.px}px`, borderRadius: "var(--r-md)", fontSize: sizes.fs, fontWeight: 700,
        fontFamily: "var(--f-ui)", opacity: disabled ? .6 : 1, transition: "filter .15s", ...kinds, ...style }}>
      {icon && <Icon name={icon} size={sizes.fs + 4} />}{children}
    </button>
  );
}
function IconBtn({ name, onClick, size = 40, iconSize = 20, tone = "soft", style, label }) {
  const tones = { soft: { background: "var(--sunken)", color: "var(--ink)" }, ghost: { background: "transparent", color: "var(--ink-2)" }, brand: { background: "var(--brand)", color: "var(--on-brand)" }, raised: { background: "var(--raised)", color: "var(--ink)", boxShadow: "var(--sh-1)" } }[tone];
  return <button aria-label={label || name} className="press" onClick={onClick} style={{ width: size, height: size, borderRadius: "var(--r-md)", display: "grid", placeItems: "center", ...tones, ...style }}><Icon name={name} size={iconSize} /></button>;
}

/* badge / status */
const TONE = {
  ok: ["var(--ok-bg)", "var(--ok-deep)"], okDeep: ["var(--ok)", "#fff"], wait: ["var(--wait-bg)", "#9A6912"],
  info: ["var(--info-bg)", "#3A6587"], brand: ["var(--brand-tint)", "var(--brand-deep)"], danger: ["var(--danger-bg)", "var(--danger)"],
  muted: ["var(--muted-bg)", "var(--ink-2)"],
};
function Badge({ children, tone = "muted", dot, solid, style }) {
  const [bg, fg] = TONE[tone] || TONE.muted;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: "var(--r-pill)",
      fontSize: 12.5, fontWeight: 700, background: solid ? fg : bg, color: solid ? "#fff" : fg, whiteSpace: "nowrap", ...style }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: 99, background: solid ? "#fff" : fg }} />}{children}
    </span>
  );
}

/* KPI tile */
function Kpi({ label, value, sub, icon, accent = "var(--brand)", trend }) {
  return (
    <Card pad={18} style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>{label}</span>
        <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: accent + "1f", color: accent }}><Icon name={icon} size={18} /></span>
      </div>
      <div className="num" style={{ fontSize: 30, lineHeight: 1, color: "var(--ink)" }}>{value}</div>
      {sub && <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: trend === "up" ? "var(--ok-deep)" : trend === "down" ? "var(--danger)" : "var(--ink-3)" }}>{sub}</div>}
    </Card>
  );
}

/* progress bar */
function Progress({ value, color = "var(--brand)", h = 8 }) {
  return <div style={{ height: h, borderRadius: 99, background: "var(--sunken)", overflow: "hidden" }}><div style={{ width: Math.min(100, value) + "%", height: "100%", borderRadius: 99, background: color, transition: "width .6s var(--out)" }} /></div>;
}

/* mini bar chart */
function BarChart({ data, color = "var(--brand)", h = 120, fmt = (v) => v, labelKey = "g", valKey = "v" }) {
  const max = Math.max(...data.map(d => d[valKey])) || 1;
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: h }}>
      {data.map((d, i) => {
        const pct = (d[valKey] / max) * 100;
        const last = i === data.length - 1;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7, height: "100%", justifyContent: "flex-end" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-2)", fontFamily: "var(--f-mono)" }}>{fmt(d[valKey])}</div>
            <div title={fmt(d[valKey])} style={{ width: "100%", maxWidth: 38, height: mounted ? `calc(${pct}% - 24px)` : 0, minHeight: 4, borderRadius: "8px 8px 4px 4px",
              background: last ? color : color + "55", transition: `height .7s var(--out) ${i * 0.05}s` }} />
            <div style={{ fontSize: 11.5, fontWeight: 600, color: last ? "var(--ink)" : "var(--ink-3)" }}>{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

/* empty / loading / error states */
function Empty({ icon = "sparkles", title, sub, action, tako }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "48px 24px", textAlign: "center" }}>
      {tako
        ? <Tako pose={tako} size={130} />
        : <span style={{ width: 56, height: 56, borderRadius: 18, display: "grid", placeItems: "center", background: "var(--brand-tint)", color: "var(--brand)" }}><Icon name={icon} size={26} /></span>}
      <div style={{ fontFamily: "var(--f-display)", fontWeight: 800, fontSize: 18 }}>{title}</div>
      {sub && <div style={{ fontSize: 14, color: "var(--ink-2)", maxWidth: 320 }}>{sub}</div>}
      {action}
    </div>
  );
}

/* search input */
function Search({ value, onChange, placeholder = "Cerca…", style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, height: 42, padding: "0 14px", background: "var(--raised)", border: "1px solid var(--hairline)", borderRadius: "var(--r-md)", color: "var(--ink-3)", ...style }}>
      <Icon name="search" size={18} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "var(--f-ui)", fontSize: 14.5, color: "var(--ink)" }} />
    </div>
  );
}

/* avatar */
function Avatar({ initials, color = "var(--brand)", size = 38 }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", flex: "none", display: "grid", placeItems: "center", background: color, color: "#fff", fontWeight: 800, fontSize: size * .38, fontFamily: "var(--f-display)" }}>{initials}</span>;
}

/* modal (center) + drawer (right/bottom) */
function Overlay({ open, onClose, children, anchor = "center" }) {
  const { mounted, active } = useMountTransition(open, 320);
  if (!mounted) return null;
  const pos = {
    center: { alignItems: "center", justifyContent: "center" },
    right: { alignItems: "stretch", justifyContent: "flex-end" },
    bottom: { alignItems: "flex-end", justifyContent: "stretch" },
  }[anchor];
  const enter = {
    center: active ? "translateY(0) scale(1)" : "translateY(12px) scale(.97)",
    right: active ? "translateX(0)" : "translateX(100%)",
    bottom: active ? "translateY(0)" : "translateY(100%)",
  }[anchor];
  return ReactDOM.createPortal(
    <div style={{ position: "absolute", inset: 0, zIndex: 120, display: "flex", ...pos }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(30,20,16,.45)", opacity: active ? 1 : 0, transition: "opacity .3s", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "relative", transform: enter, transition: "transform .34s var(--spring)", maxHeight: "100%", display: "flex" }}>{children}</div>
    </div>,
    document.querySelector(".screen") || document.body
  );
}
function useMountTransition(open, dur = 320) {
  const [mounted, setMounted] = useState(open);
  const [active, setActive] = useState(false);
  useEffect(() => {
    let t;
    if (open) { setMounted(true); t = setTimeout(() => setActive(true), 20); }
    else { setActive(false); t = setTimeout(() => setMounted(false), dur); }
    return () => clearTimeout(t);
  }, [open, dur]);
  return { mounted, active };
}

/* toast store */
const _toast = { list: [], subs: new Set(), id: 0 };

/* live-notif bus (header mobile) + scroll direction store */
const _live = { subs: new Set() };
function pushLiveNotif(n) { _live.subs.forEach(f => f(n)); }
function useLiveNotif(handler) { useEffect(() => { _live.subs.add(handler); return () => _live.subs.delete(handler); }, [handler]); }
const _scroll = { down: false, subs: new Set() };
function setScrollDown(v) { if (_scroll.down !== v) { _scroll.down = v; _scroll.subs.forEach(f => f()); } }
function useScrollDown() { const [, f] = useState(0); useEffect(() => { const cb = () => f(x => x + 1); _scroll.subs.add(cb); return () => _scroll.subs.delete(cb); }, []); return _scroll.down; }
/* traduzione messaggi d'errore che il server restituisce ancora in inglese
   (non tocchiamo il server: normalizziamo qui, nel layer toast) */
const MSG_IT = {
  "Invalid email or password": "Email o password non validi",
  "User not found": "Utente non trovato",
  "Table not found": "Tavolo non trovato",
  "Bill not found": "Conto non trovato",
  "Item not found": "Piatto non trovato",
  "Variant not found": "Variante non trovata",
  "Menu not found": "Menu non trovato",
  "Order not found": "Ordine non trovato",
  "Not found": "Elemento non trovato",
  "Cannot delete yourself": "Non puoi eliminare te stesso",
  "Unauthorized": "Non autorizzato",
  "Forbidden": "Operazione non permessa",
};
function translateMsg(m) {
  if (!m || typeof m !== "string") return m;
  if (MSG_IT[m]) return MSG_IT[m];
  if (/invalid email or password/i.test(m)) return "Email o password non validi";
  if (/not found/i.test(m)) return "Elemento non trovato";
  if (/forbidden/i.test(m)) return "Operazione non permessa";
  if (/unauthorized/i.test(m)) return "Non autorizzato";
  return m;
}
function toast(msg, opts = {}) {
  msg = translateMsg(msg);
  const id = ++_toast.id;
  _toast.list = [..._toast.list, { id, msg, type: opts.type || "default", icon: opts.icon, sub: opts.sub, dur: opts.duration || 3600 }];
  _toast.subs.forEach(f => f());
  setTimeout(() => {
    _toast.list = _toast.list.filter(t => t.id !== id); _toast.subs.forEach(f => f());
  }, opts.duration || 3600);
}
function Toaster({ mobile }) {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(x => x + 1); _toast.subs.add(f); return () => _toast.subs.delete(f); }, []);
  const dismiss = (id) => { _toast.list = _toast.list.filter(t => t.id !== id); _toast.subs.forEach(f => f()); };

  if (!mobile) {
    // desktop: card animate bottom-right con barra di avanzamento
    return (
      <div style={{ position: "absolute", bottom: 22, right: 22, zIndex: 300, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12, pointerEvents: "none" }}>
        {_toast.list.map(t => {
          const c = t.type === "success" ? "var(--ok)" : t.type === "error" ? "var(--danger)" : t.type === "warn" ? "var(--wait)" : "var(--brand)";
          const ic = t.icon || (t.type === "success" ? "check" : t.type === "error" ? "alert" : "bell");
          return (
            <div key={t.id} className="ds-toast-in" onClick={() => dismiss(t.id)}
              style={{ position: "relative", display: "flex", alignItems: "center", gap: 13, width: 340, padding: "14px 16px 14px 14px", borderRadius: 16, background: "var(--nav)", color: "#fff", boxShadow: "0 18px 44px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.07)", overflow: "hidden", pointerEvents: "auto", cursor: "pointer" }}>
              <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: c }} />
              <span className="ds-toast-icon" style={{ flex: "none", width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: c, color: "#fff", boxShadow: `0 6px 16px -5px ${c}` }}><Icon name={ic} size={21} stroke={2.4} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, fontFamily: "var(--f-display)" }}>{t.msg}</div>
                {t.sub && <div style={{ fontSize: 12.5, color: "var(--nav-ink-2)", marginTop: 1 }}>{t.sub}</div>}
              </div>
              <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: c, opacity: .5, transformOrigin: "left", animation: `ds-prog ${t.dur}ms linear forwards` }} />
            </div>
          );
        })}
      </div>
    );
  }

  // mobile: piccoli toast in alto al centro (conferme azioni)
  return (
    <div style={{ position: "absolute", top: 66, left: 0, right: 0, zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none", padding: "0 16px" }}>
      {_toast.list.map(t => {
        const c = t.type === "success" ? "var(--ok)" : t.type === "error" ? "var(--danger)" : t.type === "warn" ? "var(--wait)" : "var(--brand)";
        const ic = t.icon || (t.type === "success" ? "check" : t.type === "error" ? "alert" : "bell");
        return (
          <div key={t.id} className="new-row" style={{ display: "inline-flex", alignItems: "center", gap: 11, maxWidth: 420, padding: "11px 16px 11px 12px", borderRadius: 14, background: "var(--ink)", color: "var(--surface)", boxShadow: "var(--sh-3)" }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", background: c, color: "#fff", flex: "none" }}><Icon name={ic} size={15} stroke={2.6} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{t.msg}</div>
              {t.sub && <div style={{ fontSize: 12.5, color: "var(--nav-ink-2)" }}>{t.sub}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* confirm dialog */
function Confirm({ open, onClose, onConfirm, title, body, danger, confirmLabel = "Conferma" }) {
  return (
    <Overlay open={open} onClose={onClose} anchor="center">
      <div style={{ width: 380, maxWidth: "calc(100vw - 40px)", background: "var(--raised)", borderRadius: "var(--r-xl)", boxShadow: "var(--sh-pop)", padding: 24, margin: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, display: "grid", placeItems: "center", background: danger ? "var(--danger-bg)" : "var(--brand-tint)", color: danger ? "var(--danger)" : "var(--brand)", marginBottom: 14 }}><Icon name={danger ? "alert" : "bell"} size={24} /></div>
        <h3 style={{ fontSize: 19 }}>{title}</h3>
        <p style={{ fontSize: 14.5, color: "var(--ink-2)", lineHeight: 1.5, margin: "8px 0 20px" }}>{body}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn kind="soft" full onClick={onClose}>Annulla</Btn>
          <Btn kind={danger ? "danger" : "brand"} full onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Btn>
        </div>
      </div>
    </Overlay>
  );
}

/* section title */
function PageHead({ title, sub, actions, icon, tako, mobile }) {
  if (mobile) {
    return actions ? <div style={{ display: "flex", justifyContent: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>{actions}</div> : null;
  }
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        {tako && <Tako pose={tako} size={62} />}
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900 }}>{title}</h1>
          {sub && <p style={{ fontSize: 14, color: "var(--ink-2)", marginTop: 4 }}>{sub}</p>}
        </div>
      </div>
      {actions && <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}

/* ───────────────── Tako mascotte (contestuali + per colore brand) ───────────────── */
/* alias semantico → filename reale (i nomi file sono mescolati, mappo per contenuto) */
const TAKO_POSE = {
  hello: "logo",         // strizza l'occhio + pollice — saluto / hero / logo
  neutral: "elegante",   // sorriso neutro — generico / vuoto
  chef: "neutro",        // cappello + spatola — cucina
  phone: "piatto",       // tiene telefono con ordine — ordini / comanda / qr
  serve: "pasta",        // vassoio con cloche — sala / servizio
  dish: "telefono",      // piatto di pasta fumante — menu
  dishAlt: "cassa",      // piatto di pasta (alt) — inventario
  pay: "pollice_in_su",  // scontrino + pagamento + monete — cassa / incasso / stats
  bowtie: "mangia",      // papillon elegante — impostazioni
};
const TakoCtx = React.createContext("arancione");
function Tako({ pose = "neutral", size = 120, float = true, flip = false, style, alt = "Tako" }) {
  const brand = useContext(TakoCtx);
  let file = TAKO_POSE[pose] || pose;
  if (pose === "logoMark") file = brand === "arancione" ? "logo-chef" : "neutro";
  return (
    <img src={`assets/takos/${brand}/${file}.png`} alt={alt} draggable={false}
      className={float ? "tako-float" : undefined}
      style={{ width: size, height: size, objectFit: "contain", flex: "none", userSelect: "none",
        filter: "drop-shadow(0 12px 18px rgba(42,31,26,.16))", transform: flip ? "scaleX(-1)" : "none", ...style }} />
  );
}

Object.assign(window, {
  Icon, Card, Btn, IconBtn, Badge, Kpi, Progress, BarChart, Empty, Search, Avatar,
  Overlay, useMountTransition, toast, Toaster, Confirm, PageHead, TONE, Tako, TakoCtx, TAKO_POSE,
  pushLiveNotif, useLiveNotif, setScrollDown, useScrollDown,
});
