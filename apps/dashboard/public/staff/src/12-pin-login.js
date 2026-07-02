/* ───────────────── Tako Dashboard — Accesso rapido PIN ─────────────────
   Schermata di login PIN per il TABLET CONDIVISO del ristorante.
   Flusso: si sceglie il membro dello staff dalla lista → si digita il PIN
   di 4 cifre sul tastierino → chiamata a POST /api/auth/pin-login.

   OWNERSHIP: file nuovo, autonomo. Non modifica 07/03/01/index.html/server.
   Espone due globali:
     - window.PinLogin  → la schermata PIN (usabile da sola)
     - window.LoginGate → wrapper che alterna Login (email/password, in 07)
                          e PinLogin, così l'aggancio in 07 è UNA riga.

   DIPENDENZE (già caricate prima di questo script):
     - 01-data.js: TakoAPI, BRAND_PALETTES, ROLES, ROLE_DB2UI
     - 02-kit.js:  React hooks globali (useState/useEffect/useRef), Icon
   Richiede l'endpoint pubblico GET /api/auth/pin-roster (vedi report).      */

/* keyframes iniettati una sola volta (feedback errore: shake del display) */
(function ensurePinCss() {
  if (typeof document === "undefined" || document.getElementById("tako-pin-css")) return;
  const s = document.createElement("style");
  s.id = "tako-pin-css";
  s.textContent =
    "@keyframes takoPinShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-9px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(4px)}}" +
    ".tako-pin-shake{animation:takoPinShake .42s cubic-bezier(.36,.07,.19,.97)}" +
    ".tako-key{-webkit-tap-highlight-color:transparent;user-select:none;transition:transform .06s ease,background .12s ease}" +
    ".tako-key:active{transform:scale(.94)}";
  document.head.appendChild(s);
})();

function PinLogin({ onDone, onBack }) {
  // phase: "loading" | "error" | "pick" | "pin"
  const [phase, setPhase] = useState("loading");
  const [restaurantId, setRestaurantId] = useState(null);
  const [restaurantName, setRestaurantName] = useState("");
  const [members, setMembers] = useState([]);
  const [loadErr, setLoadErr] = useState("");

  const [sel, setSel] = useState(null);       // membro selezionato {id,name,role}
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");         // messaggio errore PIN
  const [locked, setLocked] = useState(false); // lockout server (429)
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const submittingRef = useRef(false);

  const p = (typeof BRAND_PALETTES !== "undefined" && BRAND_PALETTES.arancione) ||
    { brand: "#ED7159", deep: "#D9533A", tint: "#FCE7DF", wash: "#FBF1ED", on: "#FFFFFF" };

  const roleLabel = (dbRole) => {
    try {
      const uiRole = (ROLE_DB2UI && ROLE_DB2UI[dbRole]) || dbRole;
      return (ROLES && ROLES[uiRole] && ROLES[uiRole].label) || uiRole || "Staff";
    } catch (_) { return "Staff"; }
  };
  const initials = (name) => (name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  /* carica il roster pubblico (id+nome+ruolo dei membri con PIN attivo) */
  const loadRoster = async () => {
    setPhase("loading"); setLoadErr("");
    try {
      const d = await TakoAPI.get("/auth/pin-roster");
      setRestaurantId(d.restaurantId || (d.restaurant && d.restaurant.id) || null);
      setRestaurantName((d.restaurant && d.restaurant.name) || "");
      setMembers(Array.isArray(d.members) ? d.members : []);
      setPhase("pick");
    } catch (ex) {
      setLoadErr(
        ex.status === 404
          ? "Accesso rapido non ancora disponibile su questo dispositivo."
          : (ex.message || "Impossibile caricare l'elenco dello staff.")
      );
      setPhase("error");
    }
  };
  useEffect(() => { loadRoster(); }, []);

  const pickMember = (m) => { setSel(m); setPin(""); setErr(""); setLocked(false); setPhase("pin"); };
  const backToPick = () => { setSel(null); setPin(""); setErr(""); setLocked(false); setPhase("pick"); };

  const fail = (msg, lock) => {
    setErr(msg); setPin(""); setLocked(!!lock);
    setShake(true); setTimeout(() => setShake(false), 440);
  };

  const submit = async (code) => {
    if (submittingRef.current || !sel || !restaurantId) return;
    submittingRef.current = true; setBusy(true); setErr("");
    try {
      const res = await TakoAPI.post("/auth/pin-login", { restaurantId, userId: sel.id, pin: code });
      // Allinea la sessione al login email/password: passa { user, restaurant }.
      // pin-login ritorna solo { user }, quindi il ristorante lo prendiamo da /restaurants/me
      // (il cookie di sessione è già impostato dalla risposta di pin-login).
      const restaurant = await TakoAPI.get("/restaurants/me").catch(() => null);
      onDone({ user: res.user, restaurant });
    } catch (ex) {
      if (ex.status === 429) fail(ex.message || "Troppi tentativi. Riprova tra 15 minuti.", true);
      else if (ex.status === 401) fail("PIN errato. Riprova.", false);
      else fail(ex.message || "Accesso non riuscito.", false);
    } finally {
      submittingRef.current = false; setBusy(false);
    }
  };

  const press = (digit) => {
    if (busy || locked || pin.length >= 4) return;
    const next = pin + String(digit);
    setErr(""); setPin(next);
    if (next.length === 4) submit(next);
  };
  const del = () => { if (busy || locked) return; setErr(""); setPin((s) => s.slice(0, -1)); };
  const clear = () => { if (busy || locked) return; setErr(""); setPin(""); };

  /* stili condivisi (coerenti con la Login card di 07) */
  const brandVars = { "--brand": p.brand, "--brand-deep": p.deep, "--brand-tint": p.tint, "--brand-wash": p.wash, "--on-brand": p.on };
  const screen = {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "var(--bg, #FBF8F4)", padding: 24, ...brandVars,
  };
  const card = {
    width: 420, maxWidth: "100%", background: "var(--surface,#fff)", borderRadius: 24, padding: 30,
    boxShadow: "0 10px 46px rgba(0,0,0,.09)", border: "1px solid var(--hairline,#eee)",
  };
  const header = (title, sub) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 20 }}>
      <img src="assets/takos/arancione/piatto.png" alt="Tako" style={{ width: 64, height: 64, objectFit: "contain" }} />
      <div style={{ fontFamily: "var(--font-display, inherit)", fontWeight: 900, fontSize: 22, color: "var(--ink,#2A1F1A)" }}>{title}</div>
      {sub && <div style={{ fontSize: 13.5, color: "var(--ink3,#888)", textAlign: "center" }}>{sub}</div>}
    </div>
  );
  const linkBtn = (label, onClick) => (
    <button type="button" onClick={onClick}
      style={{ background: "none", border: "none", color: "var(--brand)", fontWeight: 700, fontSize: 13.5, cursor: "pointer", padding: "6px 4px" }}>
      {label}
    </button>
  );

  /* ── stato: caricamento ── */
  if (phase === "loading") {
    return (
      <div style={screen}><div style={{ ...card, textAlign: "center", color: "var(--ink3,#999)" }}>
        {header("Accesso rapido", "Caricamento staff…")}
      </div></div>
    );
  }

  /* ── stato: errore roster (es. endpoint assente) ── */
  if (phase === "error") {
    return (
      <div style={screen}><div style={{ ...card, textAlign: "center" }}>
        {header("Accesso rapido")}
        <div style={{ color: "var(--danger,#d9533a)", fontSize: 14, lineHeight: 1.5, margin: "6px 0 18px" }}>{loadErr}</div>
        <button onClick={loadRoster}
          style={{ width: "100%", padding: "13px", borderRadius: 13, border: "none", background: "var(--brand)", color: "var(--on-brand)", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
          Riprova
        </button>
        {onBack && <div style={{ marginTop: 12 }}>{linkBtn("Accedi con email e password", onBack)}</div>}
      </div></div>
    );
  }

  /* ── stato: selezione membro ── */
  if (phase === "pick") {
    return (
      <div style={screen}><div style={card}>
        {header("Accesso rapido", restaurantName ? `Chi sei? · ${restaurantName}` : "Seleziona il tuo profilo")}
        {members.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--ink3,#999)", fontSize: 14, padding: "18px 4px 6px", lineHeight: 1.5 }}>
            Nessun membro con PIN configurato. Chiedi al titolare di assegnarti un PIN dalla sezione Staff.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxHeight: "48vh", overflowY: "auto", padding: 2 }}>
            {members.map((m) => (
              <button key={m.id} type="button" className="tako-key" onClick={() => pickMember(m)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, padding: "18px 10px", borderRadius: 16,
                  border: "1px solid var(--hairline,#eee)", background: "var(--sunken,#faf7f4)", cursor: "pointer", minHeight: 116 }}>
                <span style={{ width: 52, height: 52, borderRadius: "50%", flex: "none", display: "grid", placeItems: "center",
                  background: "var(--brand)", color: "var(--on-brand)", fontWeight: 800, fontSize: 20 }}>{initials(m.name)}</span>
                <span style={{ fontWeight: 800, fontSize: 14.5, color: "var(--ink,#2A1F1A)", textAlign: "center", lineHeight: 1.2 }}>{m.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-deep,#b34)" }}>{roleLabel(m.role)}</span>
              </button>
            ))}
          </div>
        )}
        {onBack && <div style={{ textAlign: "center", marginTop: 18 }}>{linkBtn("Accedi con email e password", onBack)}</div>}
      </div></div>
    );
  }

  /* ── stato: tastierino PIN ── */
  const dots = (
    <div className={shake ? "tako-pin-shake" : ""} style={{ display: "flex", justifyContent: "center", gap: 16, margin: "6px 0 4px" }}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} style={{ width: 16, height: 16, borderRadius: "50%",
          background: i < pin.length ? (err ? "var(--danger,#d9533a)" : "var(--brand)") : "transparent",
          border: `2px solid ${i < pin.length ? (err ? "var(--danger,#d9533a)" : "var(--brand)") : "var(--hairline,#ddd)"}`,
          transition: "background .12s, border-color .12s" }} />
      ))}
    </div>
  );
  const keyStyle = {
    height: 74, borderRadius: 18, border: "1px solid var(--hairline,#eee)", background: "var(--surface,#fff)",
    fontFamily: "var(--f-mono, ui-monospace, monospace)", fontSize: 28, fontWeight: 700, color: "var(--ink,#2A1F1A)",
    cursor: "pointer", display: "grid", placeItems: "center",
  };
  const Key = ({ children, onClick, disabled, faint }) => (
    <button type="button" className="tako-key" onClick={onClick} disabled={disabled}
      style={{ ...keyStyle, opacity: disabled ? .4 : 1, color: faint ? "var(--ink3,#999)" : keyStyle.color, fontSize: faint ? 15 : keyStyle.fontSize, fontWeight: faint ? 800 : 700 }}>
      {children}
    </button>
  );

  return (
    <div style={screen}><div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button type="button" onClick={backToPick} aria-label="Indietro"
          style={{ width: 38, height: 38, borderRadius: 12, border: "1px solid var(--hairline,#eee)", background: "var(--sunken,#faf7f4)", display: "grid", placeItems: "center", cursor: "pointer", flex: "none" }}>
          <Icon name="chevL" size={20} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          <span style={{ width: 40, height: 40, borderRadius: "50%", flex: "none", display: "grid", placeItems: "center",
            background: "var(--brand)", color: "var(--on-brand)", fontWeight: 800, fontSize: 15 }}>{initials(sel && sel.name)}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15.5, color: "var(--ink,#2A1F1A)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sel && sel.name}</div>
            <div style={{ fontSize: 12.5, color: "var(--ink3,#888)" }}>{roleLabel(sel && sel.role)}</div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 14, color: "var(--ink3,#888)", marginBottom: 10 }}>Inserisci il PIN</div>
      {dots}
      <div style={{ minHeight: 22, textAlign: "center", margin: "8px 0 4px" }}>
        {err && <span style={{ color: "var(--danger,#d9533a)", fontSize: 13.5, fontWeight: 600 }}>{err}</span>}
        {busy && !err && <span style={{ color: "var(--ink3,#999)", fontSize: 13.5 }}>Accesso…</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 6 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <Key key={n} onClick={() => press(n)} disabled={busy || locked}>{n}</Key>
        ))}
        <Key onClick={clear} disabled={busy || locked || !pin} faint>C</Key>
        <Key onClick={() => press(0)} disabled={busy || locked}>0</Key>
        <Key onClick={del} disabled={busy || locked || !pin} faint>⌫</Key>
      </div>

      {locked && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          {linkBtn("Torna alla lista", backToPick)}
        </div>
      )}
    </div></div>
  );
}

/* Gate di accesso: alterna la Login email/password (definita in 07) e PinLogin.
   Default = "password" (comportamento invariato): l'Accesso rapido è opt-in e non
   rompe il boot se l'endpoint /auth/pin-roster non è ancora deployato. Per rendere
   il PIN il default sul tablet, cambiare lo stato iniziale a "pin". */
function LoginGate({ onDone }) {
  const [mode, setMode] = useState("password"); // "password" | "pin"
  if (mode === "pin") return <PinLogin onDone={onDone} onBack={() => setMode("password")} />;
  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <Login onDone={onDone} />
      <button type="button" onClick={() => setMode("pin")}
        style={{ position: "fixed", left: "50%", bottom: 26, transform: "translateX(-50%)",
          display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 999,
          border: "1px solid rgba(0,0,0,.08)", background: "#fff", color: "#2A1F1A", fontWeight: 800, fontSize: 14,
          boxShadow: "0 6px 22px rgba(0,0,0,.10)", cursor: "pointer", zIndex: 40 }}>
        <Icon name="user" size={17} /> Accesso rapido con PIN
      </button>
    </div>
  );
}

if (typeof window !== "undefined") { window.PinLogin = PinLogin; window.LoginGate = LoginGate; }
