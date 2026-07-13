/* ═══════════════════════ Tako — OWNER COPILOT (Cmd+K) ═══════════════════════
   Pannello AI globale per l'owner/staff: si apre con ⌘K / Ctrl+K (o window.openCopilot()).
   Chiede in linguaggio naturale (o DETTA: Cmd+K avvia/ferma la dettatura,
   window.DictationButton in 08-dictation.js) e l'AI:
     • LEGGE dati reali (incasso di oggi, statistiche, stato tavoli, cerca piatti)
     • PROPONE modifiche al menu (segna esaurito/disponibile, crea piatto) → richiedono
       CONFERMA esplicita prima di essere eseguite (POST /ai/owner/execute).
   Riusa il motore azioni server (lib/ai-actions) via /api/ai/owner/*.

   Schermata "Cowork": chat multi-sessione con storico persistito in localStorage
   (sopravvive al riavvio dell'app). Sidebar DESTRA nella palette della Sidebar
   principale (var(--nav)): "Nuova chat" + "Elimina tutte", storico COMPATTO (solo
   le ultime 3 chat, freccetta per espandere il resto) e menu ⋯ per riga con
   Rinomina/Duplica/Svuota/Elimina; su mobile diventa un drawer.

   Self-mount: crea un proprio container sotto <body> (non tocca #stage/07-app-root).
   Dipende a runtime da: React, window.TakoAPI, window.toast, window.takoReload.
   ─────────────────────────────────────────────────────────────────────────── */
(function () {
  const { useState, useRef, useEffect } = React;

  // Keyframe per il pallino "live" pulsante e i puntini di caricamento dell'anteprima
  // Streaming (iniettato una sola volta a livello di modulo).
  if (typeof document !== "undefined" && !document.getElementById("tako-stream-css")) {
    const st = document.createElement("style");
    st.id = "tako-stream-css";
    st.textContent = "@keyframes takoLivePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.32;transform:scale(.72)}}"
      // POP "a molla" della card Streaming quando arriva in cima alla sidebar (fase 2):
      // scale su ~1.04 e ritorno — solo geometria, nessuna opacity.
      + "@keyframes takoPop{0%{transform:scale(1)}45%{transform:scale(1.045)}100%{transform:scale(1)}}";
    (document.head || document.documentElement).appendChild(st);
  }

  /* ─────────────────── TARGET DINAMICO del widget "Streaming" ───────────────────
     Il widget Streaming non mostra più SEMPRE gli Ordini: mostra l'interfaccia
     pertinente all'ultima azione confermata in chat. Dopo un'azione su tavoli/sale
     (create_table, update_table, delete_table, create_room, set_table_status,
     refresh_table_qr…) il target passa a "sala"; dopo un'azione su ordini
     (cancel_order) torna a "ordini". Altre azioni lasciano il target invariato.
     Piccolo store a livello di modulo + evento custom letto dal widget con un hook. */
  let __streamTarget = "ordini";
  function setStreamTarget(t) {
    if (t !== "sala" && t !== "ordini") return;   // solo target noti
    if (t === __streamTarget) return;             // nessun cambio → nessun evento
    __streamTarget = t;
    try { window.dispatchEvent(new CustomEvent("tako-stream-target", { detail: t })); } catch (_) {}
  }
  // Deduce il target dal nome dell'azione appena eseguita; ritorna null se invariato.
  function targetForAction(name) {
    const n = String(name || "");
    if (/table|room/i.test(n)) return "sala";     // create/update/delete_table, create_room, set_table_status, refresh_table_qr…
    if (n === "cancel_order") return "ordini";    // azione ordine esplicita
    return null;                                  // altrimenti lascia invariato
  }
  // Hook: legge il target corrente e si aggiorna sull'evento "tako-stream-target".
  function useStreamTarget() {
    const [t, setT] = useState(__streamTarget);
    useEffect(() => {
      const h = (e) => setT((e && e.detail) || __streamTarget);
      window.addEventListener("tako-stream-target", h);
      return () => window.removeEventListener("tako-stream-target", h);
    }, []);
    return t;
  }

  const SUGGESTIONS = [
    "Quanto ho incassato oggi?",
    "Segna la carbonara come esaurita",
    "Stato dei tavoli",
    "Statistiche degli ultimi 7 giorni",
  ];

  const CHAT_INTRO = { role: "assistant", content: "Ciao! Sono Tako. Chiedimi incassi, statistiche, stato tavoli — o dimmi di segnare/eliminare/modificare un piatto. Scrivi o premi ⌘K per dettare." };

  /* ─────────────────────────── STORE MULTI-SESSIONE ───────────────────────────
     Sostituisce la vecchia singola conversazione a livello modulo. Le sessioni
     vivono in localStorage (chiave tako-cowork-sessions) così sopravvivono al
     riavvio dell'app. Struttura:
       { sessions: [{ id, title, messages:[...], createdAt, updatedAt }], activeId }
     Un piccolo pub/sub tiene sincronizzati eventuali mount multipli; la scrittura
     su localStorage è throttled (durante lo streaming arrivano molti token). */
  const LS_KEY = "tako-cowork-sessions";

  function newSession() {
    const now = Date.now();
    return {
      id: "s_" + now.toString(36) + "_" + Math.random().toString(36).slice(2, 7),
      title: "",                 // titolo custom (rinomina); se vuoto si deriva dal 1° messaggio utente
      messages: [CHAT_INTRO],
      createdAt: now,
      updatedAt: now,
    };
  }

  // Carica e sanifica lo store; su assenza/corruzione ricade con grazia su una
  // sessione nuova con l'intro.
  function loadStore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && Array.isArray(p.sessions)) {
          const sessions = p.sessions
            .filter((s) => s && typeof s.id === "string" && Array.isArray(s.messages))
            .map((s) => ({
              id: s.id,
              title: typeof s.title === "string" ? s.title : "",
              messages: s.messages.length ? s.messages : [CHAT_INTRO],
              createdAt: s.createdAt || Date.now(),
              updatedAt: s.updatedAt || s.createdAt || Date.now(),
            }));
          if (sessions.length) {
            let activeId = p.activeId;
            if (!sessions.some((s) => s.id === activeId)) activeId = sessions[0].id;
            return { sessions, activeId };
          }
        }
      }
    } catch (_) { /* fallback sotto */ }
    const s = newSession();
    return { sessions: [s], activeId: s.id };
  }

  let __store = loadStore();
  const __subs = new Set();
  let __saveT = null;
  function persistNow() { try { localStorage.setItem(LS_KEY, JSON.stringify(__store)); } catch (_) {} }
  function schedulePersist() { if (!__saveT) __saveT = setTimeout(() => { __saveT = null; persistNow(); }, 500); }
  function flushPersist() { if (__saveT) { clearTimeout(__saveT); __saveT = null; } persistNow(); }
  // Aggiorna lo store: notifica subito i subscriber (UI fluida) e persiste in throttle.
  function setStore(next) { __store = next; __subs.forEach((f) => f()); schedulePersist(); }
  // Mutazione mirata di una sessione per id (robusta a cambi di sessione durante lo stream).
  function mutateSession(id, fn) {
    setStore({ ...__store, sessions: __store.sessions.map((s) => (s.id === id ? fn(s) : s)) });
  }
  // Hook: iscrive il componente ai cambi dello store.
  function useCoworkStore() {
    const [, force] = useState(0);
    useEffect(() => { const f = () => force((x) => x + 1); __subs.add(f); return () => __subs.delete(f); }, []);
    return __store;
  }

  // Titolo da mostrare: rinomina custom → 1° messaggio utente troncato → "Nuova chat".
  function deriveTitle(messages) {
    const firstUser = (messages || []).find((m) => m.role === "user");
    const t = firstUser ? String(firstUser.content || "").trim().replace(/\s+/g, " ") : "";
    return t ? (t.length > 28 ? t.slice(0, 28) + "…" : t) : "";
  }
  function displayTitle(s) { return (s.title && s.title.trim()) || deriveTitle(s.messages) || "Nuova chat"; }

  // Tempo relativo compatto in italiano.
  function relTime(ts) {
    const d = Date.now() - (ts || 0);
    const m = Math.floor(d / 60000);
    if (m < 1) return "ora";
    if (m < 60) return m + " min fa";
    const h = Math.floor(m / 60);
    if (h < 24) return h + " h fa";
    const g = Math.floor(h / 24);
    if (g < 7) return g + (g === 1 ? " giorno fa" : " giorni fa");
    const w = Math.floor(g / 7);
    return w + (w === 1 ? " sett fa" : " sett fa");
  }

  function SparkIcon({ size = 18 }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      </svg>
    );
  }

  /* Card di una mutation PROPOSTA: eseguita solo su conferma esplicita. */
  function PendingCard({ item, onDone }) {
    const [state, setState] = useState("idle"); // idle | running | done | error
    const [msg, setMsg] = useState("");
    const confirm = async () => {
      setState("running");
      try {
        const res = await TakoAPI.post("/ai/owner/execute", { name: item.name, args: item.args });
        setMsg(res && res.summary ? res.summary : "Fatto.");
        setState("done");
        // Aggiorna il target del widget Streaming in base all'azione eseguita
        // (tavolo/sala → "sala", cancel_order → "ordini", altrimenti invariato).
        const tgt = targetForAction(item.name);
        if (tgt) setStreamTarget(tgt);
        if (window.toast) toast(res && res.summary ? res.summary : "Azione eseguita", { type: "success", icon: "check" });
        if (window.takoReload) { try { await window.takoReload(); } catch (_) {} }
        onDone && onDone();
      } catch (ex) {
        setMsg(ex && ex.message ? ex.message : "Esecuzione non riuscita.");
        setState("error");
      }
    };
    return (
      <div style={{ border: "1px solid var(--hairline,#e6ded6)", background: "var(--surface,#fff)", borderRadius: 14, padding: 12, marginTop: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--brand,#ED7159)", textTransform: "uppercase", letterSpacing: .4, marginBottom: 6 }}>
          Conferma richiesta
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink,#2A1F1A)" }}>{item.label}</div>
        {state === "done" || state === "error" || state === "cancelled"
          ? <div style={{ marginTop: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 6, color: state === "error" ? "var(--danger,#d9533a)" : state === "cancelled" ? "var(--ink-3,#9a8f86)" : "var(--ink-2,#6a5f56)" }}>
              {state === "cancelled" && <Icon name="x" size={14} />}{state === "cancelled" ? "Annullato" : msg}
            </div>
          : (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => { setState("cancelled"); if (window.toast) toast("Annullato", { type: "info" }); }} disabled={state === "running"}
                style={{ flex: "0 0 auto", padding: "9px 14px", borderRadius: 11, border: "1px solid var(--hairline,#e6ded6)", background: "var(--surface,#fff)", color: "var(--ink-2,#6a5f56)", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
                Annulla
              </button>
              <button onClick={confirm} disabled={state === "running"}
                style={{ flex: 1, padding: "9px 14px", borderRadius: 11, border: "none", background: "var(--brand,#ED7159)", color: "var(--on-brand,#fff)", fontWeight: 800, fontSize: 13.5, cursor: "pointer", opacity: state === "running" ? .6 : 1 }}>
                {state === "running" ? "Eseguo…" : "Conferma ed esegui"}
              </button>
            </div>
          )}
      </div>
    );
  }

  /* ─────────────────────────── SIDEBAR SESSIONI ───────────────────────────────
     Palette identica alla Sidebar principale (03-shell-nav.js): riquadro scuro
     var(--nav), testi var(--nav-ink)/var(--nav-ink-2), item attivo con pillola
     var(--brand) + ombra "0 6px 16px -6px var(--brand)", hover su var(--nav-2),
     divisori var(--nav-line), ombra card var(--sh-2), dropdown var(--nav-2)+sh-3. */

  // Menu azioni per una singola chat (kebab "⋯"). Dropdown posizionato via portal
  // (position:fixed calcolato dal rect del bottone) così non viene tagliato dagli
  // overflow della lista. Si chiude su click-fuori o Esc. Voci: Rinomina, Duplica,
  // Svuota, Elimina (che avvia la conferma inline nella riga).
  function SessionMenu({ active, onRename, onDuplicate, onClear, onDelete }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState(null);
    const btnRef = useRef(null);
    const popRef = useRef(null);
    const W = 176;
    useEffect(() => {
      if (!open) return;
      const h = (e) => { if (popRef.current && !popRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) setOpen(false); };
      const k = (e) => { if (e.key === "Escape") setOpen(false); };
      document.addEventListener("mousedown", h);
      document.addEventListener("keydown", k);
      return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
    }, [open]);
    const toggle = (e) => {
      e.stopPropagation();
      if (open) { setOpen(false); return; }
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8)) });
      setOpen(true);
    };
    const run = (fn) => (e) => { e.stopPropagation(); setOpen(false); fn && fn(); };
    const items = [
      { label: "Rinomina", icon: "edit", onClick: run(onRename) },
      { label: "Duplica", icon: "copy", onClick: run(onDuplicate) },
      { label: "Svuota", icon: "refresh", onClick: run(onClear) },
      { label: "Elimina", icon: "trash", danger: true, onClick: run(onDelete) },
    ];
    return (
      <>
        <button ref={btnRef} onClick={toggle} aria-label="Azioni chat" className="press"
          style={{ flex: "none", width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer",
            background: open ? "var(--nav-2,#313338)" : "transparent",
            color: active ? "var(--on-brand,#fff)" : "var(--nav-ink-2,#9B9CA4)", display: "grid", placeItems: "center", opacity: .85 }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = .85; }}>
          <Icon name="more" size={16} />
        </button>
        {open && pos && ReactDOM.createPortal(
          <div ref={popRef} className="pop-in"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: W, zIndex: 200,
              background: "var(--nav-2,#313338)", border: "1px solid var(--nav-line,rgba(255,255,255,.09))",
              borderRadius: 12, boxShadow: "var(--sh-3)", padding: 6 }}>
            {items.map((it) => (
              <button key={it.label} onClick={it.onClick} className="press nav-item"
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9,
                  border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit",
                  color: it.danger ? "#F0907F" : "var(--nav-ink,#E6E6EA)", fontSize: 13.5, fontWeight: 600 }}>
                <Icon name={it.icon} size={16} />{it.label}
              </button>
            ))}
          </div>,
          document.body
        )}
      </>
    );
  }

  // Riga singola dello storico: titolo + tempo relativo, item attivo con pillola
  // brand (stile Sidebar principale). Rinomina con doppio click o dal menu ⋯,
  // conferma inline per l'eliminazione, azioni Duplica/Svuota dal menu ⋯.
  function SessionRow({ s, active, onSelect, onDelete, onRename, onDuplicate, onClear }) {
    const [confirming, setConfirming] = useState(false);
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState("");
    const title = displayTitle(s);

    const startEdit = () => { setConfirming(false); setName(title); setEditing(true); };
    const saveName = () => {
      setEditing(false);
      const v = name.trim();
      if (v && v !== title) onRename(s.id, v);
    };

    return (
      <div onClick={() => !editing && !confirming && onSelect(s.id)}
        style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, padding: "8px 8px 8px 11px",
          borderRadius: 11, cursor: "pointer", userSelect: "none",
          background: active ? "var(--brand,#ED7159)" : "transparent",
          boxShadow: active ? "0 6px 16px -6px var(--brand,#ED7159)" : "none",
          transition: "background .14s" }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--nav-2,#313338)"; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input autoFocus value={name} onClick={(e) => e.stopPropagation()}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveName(); } else if (e.key === "Escape") setEditing(false); }}
              style={{ width: "100%", border: "1px solid var(--nav-line,rgba(255,255,255,.16))", borderRadius: 8, padding: "3px 6px",
                fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", outline: "none", background: "var(--nav,#25262A)", color: "var(--nav-ink,#E6E6EA)" }} />
          ) : (
            <div onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
              title={title}
              style={{ fontSize: 13.5, fontWeight: active ? 700 : 600, color: active ? "var(--on-brand,#fff)" : "var(--nav-ink,#E6E6EA)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {title}
            </div>
          )}
          {!editing && (
            confirming ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                <span style={{ fontSize: 11.5, color: active ? "rgba(255,255,255,.92)" : "#F0907F", fontWeight: 700 }}>Eliminare?</span>
                <button onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                  style={{ border: "none", background: "transparent", color: active ? "#fff" : "#F0907F", fontSize: 11.5, fontWeight: 800, cursor: "pointer", padding: 0 }}>Sì</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
                  style={{ border: "none", background: "transparent", color: "var(--nav-ink-2,#9B9CA4)", fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>No</button>
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: active ? "rgba(255,255,255,.82)" : "var(--nav-ink-2,#9B9CA4)", marginTop: 2 }}>{relTime(s.updatedAt)}</div>
            )
          )}
        </div>
        {!editing && !confirming && (
          <SessionMenu active={active}
            onRename={startEdit}
            onDuplicate={() => onDuplicate(s.id)}
            onClear={() => onClear(s.id)}
            onDelete={() => setConfirming(true)} />
        )}
      </div>
    );
  }

  // Contenuto della sidebar (riusato su desktop e nel drawer mobile).
  // COMPATTA: mostra solo le ULTIME 3 chat; le altre stanno in un blocco
  // collassabile che si apre verso il basso con una freccetta (chevD che ruota
  // 180°) — stessa transizione max-height/opacity della Sidebar principale.
  function SessionSidebar({ sessions, activeId, onNew, onSelect, onDelete, onRename, onDuplicate, onClear, onDeleteAll, header }) {
    const ordered = sessions.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const [expanded, setExpanded] = useState(false);
    const [confirmAll, setConfirmAll] = useState(false);
    const head = ordered.slice(0, 3);
    const rest = ordered.slice(3);
    // Se lo storico scende sotto le 4 chat, richiudi ed esci dalla conferma.
    useEffect(() => { if (!rest.length && expanded) setExpanded(false); }, [rest.length]);

    const rowProps = { onSelect, onDelete, onRename, onDuplicate, onClear };
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {header}
        {/* Riga azioni globali: Nuova chat + Elimina tutte (con conferma) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onNew} className="press"
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 40, borderRadius: 11,
              border: "1px solid var(--nav-line,rgba(255,255,255,.12))", background: "var(--nav-2,#313338)",
              color: "var(--nav-ink,#E6E6EA)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--brand,#ED7159)"; e.currentTarget.style.color = "var(--on-brand,#fff)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--nav-2,#313338)"; e.currentTarget.style.color = "var(--nav-ink,#E6E6EA)"; }}>
            <Icon name="plus" size={17} /> Nuova chat
          </button>
          {sessions.length > 1 && (confirmAll ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
              <button onClick={() => { onDeleteAll(); setConfirmAll(false); }} title="Elimina tutte le chat"
                style={{ border: "none", background: "transparent", color: "#F0907F", fontSize: 12, fontWeight: 800, cursor: "pointer", padding: "0 2px" }}>Tutte?</button>
              <button onClick={() => setConfirmAll(false)}
                style={{ border: "none", background: "transparent", color: "var(--nav-ink-2,#9B9CA4)", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "0 2px" }}>No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmAll(true)} aria-label="Elimina tutte le chat" title="Elimina tutte le chat" className="press"
              style={{ flex: "none", width: 40, height: 40, borderRadius: 11, border: "1px solid var(--nav-line,rgba(255,255,255,.12))",
                background: "var(--nav-2,#313338)", color: "var(--nav-ink-2,#9B9CA4)", display: "grid", placeItems: "center", cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#F0907F"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--nav-ink-2,#9B9CA4)"; }}>
              <Icon name="trash" size={17} />
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: "var(--nav-ink-2,#9B9CA4)", padding: "0 4px" }}>
          Storico
        </div>
        {/* Ultime 3 chat, sempre visibili */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {head.map((s) => (
            <SessionRow key={s.id} s={s} active={s.id === activeId} {...rowProps} />
          ))}
        </div>
        {/* Blocco espandibile con tutte le altre chat + freccetta */}
        {rest.length > 0 && (
          <>
            <div style={{ overflow: "hidden", transition: "max-height .34s var(--out), opacity .26s ease",
              maxHeight: expanded ? rest.length * 58 + 8 : 0, opacity: expanded ? 1 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 3 }}>
                {rest.map((s) => (
                  <SessionRow key={s.id} s={s} active={s.id === activeId} {...rowProps} />
                ))}
              </div>
            </div>
            <button onClick={() => setExpanded((v) => !v)} className="press"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", height: 32, borderRadius: 10,
                border: "none", background: "transparent", color: "var(--nav-ink-2,#9B9CA4)", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--nav-2,#313338)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              {expanded ? "Mostra meno" : "Altre " + rest.length + " chat"}
              <Icon name="chevD" size={15} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            </button>
          </>
        )}
      </div>
    );
  }

  /* ─────────────────────── ANTEPRIMA "STREAMING" (desktop) ───────────────────────
     Riquadro nella sidebar destra del Cowork che mostra un'ALTRA interfaccia dell'app
     in miniatura e in tempo reale, leggendo lo stato pubblicato da 07-app-root su
     window.__takoLive ({ orders, badges, rooms, calls }).
     La schermata mostrata dipende dal TARGET DINAMICO (__streamTarget): dopo un'azione
     su tavoli/sale mostra la Sala live (ScreenSala), altrimenti gli Ordini (ScreenOrdini).
     Al click parte l'animazione in 3 fasi: la card chat slida in alto e scompare →
     la card Streaming risale al suo posto e fa un piccolo POP → espansione FLIP a
     tutta pagina (geometrica pura, niente fade) → naviga davvero al target. */

  // Hook: legge lo stato live pubblicato da App e si aggiorna sull'evento "tako-live".
  // (niente useSyncExternalStore in questo runtime → useState + listener.)
  function useTakoLive() {
    const [live, setLive] = useState(() => (typeof window !== "undefined" && window.__takoLive) || null);
    useEffect(() => {
      const h = () => setLive(window.__takoLive || null);
      window.addEventListener("tako-live", h);
      h(); // stato iniziale nel caso App sia già montata (evento già passato)
      return () => window.removeEventListener("tako-live", h);
    }, []);
    return live;
  }

  // Piccolo boundary: se ScreenOrdini in miniatura lancia in render, mostra il fallback
  // invece di far crollare l'intera schermata Cowork.
  class PreviewBoundary extends React.Component {
    constructor(p) { super(p); this.state = { err: false }; }
    static getDerivedStateFromError() { return { err: true }; }
    render() { return this.state.err ? this.props.fallback : this.props.children; }
  }

  // Placeholder mostrato quando lo stato live non è ancora disponibile (o su errore).
  function PreviewPlaceholder({ loading, text }) {
    return (
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--nav-ink-2,#9B9CA4)", fontSize: 12, fontWeight: 600 }}>
        {loading ? (
          <span style={{ display: "inline-flex", gap: 6 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 7, height: 7, borderRadius: 99, background: "var(--nav-ink-2,#9B9CA4)", animation: "takoLivePulse 1s ease-in-out infinite", animationDelay: i * 0.18 + "s" }} />
            ))}
          </span>
        ) : (text || "Anteprima non disponibile")}
      </div>
    );
  }

  // Larghezza logica del render "desktop" da scalare nella miniatura (px). L'altezza
  // deriva dal rapporto 16/10 del contenitore: MH = MW * 10/16, indipendente dalla scala.
  const MW = 1100, MH = MW * 10 / 16;

  function StreamingPreview({ onExpandStart, onExpandEnd }) {
    const live = useTakoLive();
    const target = useStreamTarget();               // "ordini" | "sala" (ultima azione in chat)
    const liveOrders = live && Array.isArray(live.orders) ? live.orders : null;
    const liveRooms = live && Array.isArray(live.rooms) ? live.rooms : null;
    const liveCalls = live && Array.isArray(live.calls) ? live.calls : [];
    const cardRef = useRef(null);   // card intera (rect di partenza per l'espansione)
    const contRef = useRef(null);   // contenitore anteprima (per misurare la scala)
    const animRef = useRef(false);  // true durante l'intera sequenza in 3 fasi
    const [scale, setScale] = useState(0.22);
    const [overlay, setOverlay] = useState(null); // { start, grown } durante l'espansione (fase 3)
    const noop = () => {};

    // Misura la larghezza reale del contenitore → scala così che 1100px riempiano l'area.
    useEffect(() => {
      const el = contRef.current; if (!el) return;
      const measure = () => { const w = el.clientWidth; if (w) setScale(w / MW); };
      measure();
      let ro; try { ro = new ResizeObserver(measure); ro.observe(el); } catch (_) {}
      window.addEventListener("resize", measure);
      return () => { try { ro && ro.disconnect(); } catch (_) {} window.removeEventListener("resize", measure); };
    }, []);

    // Target EFFETTIVO: "sala" solo se ScreenSala è montabile e i dati sala sono
    // pubblicati su window.__takoLive; altrimenti fallback su Ordini (niente crash).
    const salaOk = typeof ScreenSala === "function" && !!liveRooms;
    const effTarget = target === "sala" && salaOk ? "sala" : "ordini";
    const targetLabel = effTarget === "sala" ? "Sala live" : "Ordini";
    const canRender = effTarget === "sala" || (typeof ScreenOrdini === "function" && !!liveOrders);

    // Render della schermata target (riusato in miniatura e nell'overlay full-screen).
    // ScreenSala è il componente REALE (05-screens-sala-cassa.js): riceve rooms/calls
    // live e un onSetTableState noop (sola lettura: pointerEvents:none blocca i click).
    const renderTarget = () => effTarget === "sala"
      ? <ScreenSala mobile={false} rooms={liveRooms} calls={liveCalls} onSetTableState={noop} />
      : <ScreenOrdini mobile={false} orders={liveOrders || []} onConfirm={noop} onServe={noop} onCancel={noop} go={noop} />;

    /* Sequenza al click — dinamica, fluida, senza tagli (specifica di Manuel):
       1. t=0      la card CHAT esce visivamente (slide-up + fade .22s) — il layout
                   NON cambia ancora (fase "hide" nel parent).
       2. t≈210ms  il parent collassa il layout ISTANTANEAMENTE (fase "collapsed":
                   max-height fuori dalla transition) → misuriamo la posizione prima
                   (rect0) e dopo (rect1) e animiamo la RISALITA della card via FLIP
                   con Web Animations: molla con overshoot (supera di qualche px e
                   scala a ~1.05 al colmo) → movimento fisico, d'impatto.
       3. a fine risalita → espansione FLIP a tutta pagina (curva energica, solo
                   transform/border-radius: zero fade). A fine → takoGo(target). */
    const expand = () => {
      if (animRef.current) return;
      animRef.current = true;
      const tgt = effTarget; // congela il target per tutta la sequenza
      const finish = () => {
        try { window.takoGo && window.takoGo(tgt); } catch (_) {}
        setOverlay(null); animRef.current = false;
        onExpandEnd && onExpandEnd();
        // NB: lo slide-in della sidebar sinistra parte all'INIZIO dell'espansione
        // (in flipExpand), non qui: così sidebar + overlay si muovono insieme.
      };
      const flipExpand = () => {                 // fase 3 → espansione FLIP nell'area main
        const el = cardRef.current;
        if (!el) { finish(); return; }
        const r = el.getBoundingClientRect();    // rect nella posizione in alto
        // Espande nel RETTANGOLO del <main> (area destra), NON a tutto lo schermo: a fine
        // espansione l'overlay combacia pixel-a-pixel con la schermata reale, quindi la
        // parte destra non "scatta" da full-width a larghezza-con-sidebar. La sidebar
        // sinistra scivola dentro CONTEMPORANEAMENTE nella sua striscia a sinistra.
        const mainEl = document.querySelector("main");
        const m = mainEl ? mainEl.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const start = `translate(${r.left - m.left}px, ${r.top - m.top}px) scale(${r.width / m.width}, ${r.height / m.height})`;
        setOverlay({ start, grown: false, box: { left: m.left, top: m.top, width: m.width, height: m.height } });
        try { window.dispatchEvent(new Event("tako-nav-slidein")); } catch (_) {} // sidebar in parallelo
        requestAnimationFrame(() => requestAnimationFrame(() => setOverlay((o) => (o ? { ...o, grown: true } : o))));
        setTimeout(finish, 470);
      };
      onExpandStart && onExpandStart("hide");    // fase 1 → chat esce (solo visivo)
      setTimeout(() => {
        const el = cardRef.current;
        if (!el) { flipExpand(); return; }
        const r0 = el.getBoundingClientRect();   // posizione PRIMA del collasso
        onExpandStart && onExpandStart("collapsed"); // collasso layout istantaneo
        requestAnimationFrame(() => {
          const r1 = el.getBoundingClientRect(); // posizione DOPO (in alto)
          const dy = r0.top - r1.top;
          if (!dy || typeof el.animate !== "function") { flipExpand(); return; }
          // fase 2 → risalita a molla: parte dalla vecchia posizione, supera di
          // qualche px con un gonfiore (pop integrato), si assesta. Solo geometria.
          const overshoot = Math.max(6, Math.min(14, dy * 0.06));
          let flipped = false;
          const flipOnce = () => { if (flipped) return; flipped = true; flipExpand(); };
          const anim = el.animate([
            { transform: `translateY(${dy}px) scale(1)`, easing: "cubic-bezier(.2,.8,.3,1)" },
            { transform: `translateY(${-overshoot}px) scale(1.05)`, offset: 0.68, easing: "cubic-bezier(.35,0,.25,1)" },
            { transform: "translateY(0) scale(1)" },
          ], { duration: 560 });
          anim.onfinish = flipOnce;
          setTimeout(flipOnce, 700); // rete di sicurezza se onfinish non scatta
        });
      }, 210);
    };

    return (
      <div ref={cardRef} style={{ padding: 14, background: "var(--nav,#25262A)", color: "var(--nav-ink,#E6E6EA)",
        border: "1px solid var(--nav-line,rgba(255,255,255,.09))", borderRadius: 16, boxShadow: "var(--sh-2)", flex: "none" }}>
        {/* Intestazione: pallino rosso live pulsante + titoletto dinamico per target */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: "#F0524A", animation: "takoLivePulse 1.4s ease-in-out infinite", flex: "none" }} />
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase", color: "var(--nav-ink-2,#9B9CA4)" }}>
            Streaming · {targetLabel}
          </div>
        </div>

        {/* Riquadro anteprima cliccabile (16/10). Dentro: la schermata target scalata in miniatura. */}
        <button onClick={expand} title={"Apri " + targetLabel} className="press"
          style={{ display: "block", width: "100%", padding: 0, border: "1px solid var(--nav-line,rgba(255,255,255,.12))",
            borderRadius: 12, overflow: "hidden", cursor: "pointer", position: "relative", background: "var(--bg,#FAF9F5)", aspectRatio: "16 / 10" }}>
          <div ref={contRef} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            {canRender ? (
              <PreviewBoundary key={effTarget} fallback={<PreviewPlaceholder text="Anteprima non disponibile" />}>
                <div key={effTarget} style={{ width: MW, height: MH, transform: "scale(" + scale + ")", transformOrigin: "top left", pointerEvents: "none", display: "flex", flexDirection: "column" }}>
                  {renderTarget()}
                </div>
              </PreviewBoundary>
            ) : (
              <PreviewPlaceholder loading />
            )}
          </div>
          {/* velo leggero + etichetta in basso per invitare al click */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "16px 10px 8px", pointerEvents: "none",
            background: "linear-gradient(180deg, transparent, rgba(0,0,0,.42))", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></svg>
            Apri a schermo intero
          </div>
        </button>

        {/* Overlay di espansione (FLIP, fase 3): full-screen renderizzato a scala 1,
            transform iniziale che lo rimpicciolisce sul rect della card (post fase 2)
            → anima a inset:0. Espansione GEOMETRICA PURA: transita solo transform e
            border-radius, nessuna opacity/fade/ombra. */}
        {overlay && ReactDOM.createPortal(
          <div style={{ position: "fixed", left: overlay.box.left, top: overlay.box.top, width: overlay.box.width, height: overlay.box.height, zIndex: 300, transformOrigin: "top left",
            overflow: "hidden", background: "var(--bg,#FAF9F5)", borderRadius: overlay.grown ? 0 : 12,
            transform: overlay.grown ? "none" : overlay.start,
            transition: "transform .45s cubic-bezier(.22,.9,.24,1), border-radius .45s ease" }}>
            <div style={{ width: overlay.box.width, height: overlay.box.height, overflow: "hidden", display: "flex", flexDirection: "column", pointerEvents: "none" }}>
              <PreviewBoundary fallback={<PreviewPlaceholder text="Anteprima non disponibile" />}>
                {renderTarget()}
              </PreviewBoundary>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  // Schermata "Cowork": la chat con Tako vive QUI (sezione della sidebar app),
  // riempie l'area principale. Sidebar sessioni a destra (drawer su mobile).
  function TakoChat({ mobile }) {
    const store = useCoworkStore();
    const active = store.sessions.find((s) => s.id === store.activeId) || store.sessions[0];
    const messages = active.messages;

    const [input, setInput] = useState("");
    // Immagine allegata (per assegnarla a un piatto): caricata subito, l'URL viaggia col
    // messaggio. Il server la assegna al piatto nominato nel testo (pre-gate deterministico).
    const [attachedImage, setAttachedImage] = useState(null);
    const [imgBusy, setImgBusy] = useState(false);
    const onPickCopilotImage = async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      setImgBusy(true);
      try {
        const res = await window.TakoActions.uploadImage(file);
        setAttachedImage({ url: res.url });
      } catch (err) {
        if (window.toast) window.toast(err.message || "Upload immagine fallito", { type: "error" });
      } finally { setImgBusy(false); }
    };
    const [busy, setBusy] = useState(false);
    // Transizione "primo messaggio": tiene il layout vuoto per ~460ms mentre i suggerimenti
    // si dissolvono e la barra slitta in basso, poi passa alla chat attiva.
    const [leaving, setLeaving] = useState(false);
    const [dictState, setDictState] = useState("idle"); // idle | rec | busy
    const [drawer, setDrawer] = useState(false);         // pannello storico su mobile
    const [streamExpanding, setStreamExpanding] = useState(false); // anteprima Streaming in espansione (desktop)
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    const inputValRef = useRef("");
    useEffect(() => { inputValRef.current = input; }, [input]);

    const DictBtn = window.DictationButton;
    const DictWave = window.TakoDictationWave;

    const focusInput = (delay = 0) => { setTimeout(() => { try { inputRef.current && inputRef.current.focus(); } catch (_) {} }, delay); };

    // Scrive i messaggi della sessione ATTIVA nello store (aggiorna anche updatedAt).
    const setMessages = (updater) => {
      const id = active.id;
      mutateSession(id, (s) => {
        const msgs = typeof updater === "function" ? updater(s.messages) : updater;
        return { ...s, messages: msgs, updatedAt: Date.now() };
      });
    };
    // Aggiorna SOLO l'ultimo messaggio (l'assistente in streaming).
    const patchLast = (fn) => setMessages((m) => { const c = m.slice(); const i = c.length - 1; if (i >= 0) c[i] = fn(c[i]); return c; });

    // Inserimento del trascritto LETTERA-PER-LETTERA (typewriter veloce ~11ms/car).
    const typeInto = (seg) => {
      const base = inputValRef.current ? inputValRef.current + " " : "";
      let i = 1;
      const tick = () => {
        setInput(base + seg.slice(0, i));
        if (i < seg.length) { i++; setTimeout(tick, 11); }
        else if (inputRef.current) { try { inputRef.current.focus(); } catch (_) {} }
      };
      tick();
    };

    // Autofocus: al montaggio (solo desktop, per non far spuntare la tastiera su mobile).
    useEffect(() => { if (!mobile) focusInput(80); }, []);
    // Al cambio di sessione: azzera la bozza e rimetti a fuoco (solo desktop).
    useEffect(() => { setInput(""); if (!mobile) focusInput(40); }, [active.id]);
    // Persisti sempre allo smontaggio.
    useEffect(() => () => flushPersist(), []);
    // Auto-scroll in fondo.
    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, busy]);

    const errMsg = (ev) => (ev && ev.code) === "AI_UNAVAILABLE" ? "AI non configurata su questo server."
      : (ev && ev.code) === "AI_RATE_LIMITED" ? "Troppe richieste: aspetta qualche secondo e riprova."
      : ((ev && ev.message) || "Tako non disponibile, riprova.");

    const send = async (override) => {
      const text = (override != null ? override : input).trim();
      const img = attachedImage;
      if ((!text && !img) || busy) return;
      // Primo messaggio: si passa direttamente al layout chat (barra in basso), senza
      // animazione di transizione.
      setInput("");
      setAttachedImage(null);
      // History = conversazione PRECEDENTE (senza il messaggio corrente: il server
      // lo aggiunge già come userMessage — includerlo qui lo duplicava nel prompt).
      const history = messages.slice(-12).map((m) => ({ role: m.role, content: String(m.content || "").slice(0, 1900) }));
      // Con immagine ma senza testo, mandiamo comunque un messaggio (min 1 char lato server);
      // il pre-gate immagine risolve il piatto dal testo. Con foto → suggerisci di nominarlo.
      const msgOut = (text || "foto").slice(0, 3900);
      // Aggiungo il turno utente + un placeholder assistente da riempire in streaming.
      setMessages((m) => [...m, { role: "user", content: text || "📷 (immagine)", image: img ? img.url : undefined }, { role: "assistant", content: "", pending: [], streaming: true }]);
      setBusy(true);
      focusInput(0); // mantieni il focus sul composer dopo l'invio
      try {
        const r = await fetch("/api/ai/owner/chat/stream", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msgOut, history, imageUrl: img ? img.url : undefined }),
        });
        if (!r.ok || !r.body) throw Object.assign(new Error("no-stream"), { status: r.status });
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = "", finished = false, errEv = null;
        while (!finished) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const raw = buf.slice(0, idx); buf = buf.slice(idx + 2);
            const line = raw.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue; // riga di commento/heartbeat
            let ev; try { ev = JSON.parse(line.slice(5).trim()); } catch (_) { continue; }
            if (ev.type === "token") patchLast((a) => ({ ...a, content: (a.content || "") + ev.text }));
            else if (ev.type === "reset") patchLast((a) => ({ ...a, content: "" }));
            else if (ev.type === "done") { patchLast((a) => ({ ...a, content: (ev.message || a.content || "Fatto."), pending: Array.isArray(ev.pending) ? ev.pending : [], streaming: false })); finished = true; }
            else if (ev.type === "error") { errEv = ev; finished = true; } // → fallback non-streaming
          }
        }
        // Errore dallo stream: provo UNA volta il non-streaming prima di arrendermi.
        if (errEv) throw Object.assign(new Error("stream-error"), { ev: errEv });
        patchLast((a) => ({ ...a, streaming: false }));
      } catch (ex) {
        // Fallback: una volta sulla versione NON-streaming (SSE assente/proxy, oppure
        // evento error dal server — es. quota esaurita sul modello grande).
        try {
          const data = await TakoAPI.post("/ai/owner/chat", { message: msgOut, history, imageUrl: img ? img.url : undefined });
          patchLast((a) => ({ ...a, content: data.message || "Fatto.", pending: Array.isArray(data.pending) ? data.pending : [], streaming: false }));
        } catch (ex2) {
          const ev = (ex && ex.ev) || { code: ex2 && ex2.status === 503 ? "AI_UNAVAILABLE" : ex2 && ex2.status === 429 ? "AI_RATE_LIMITED" : "" };
          patchLast((a) => ({ ...a, content: errMsg(ev), streaming: false }));
        }
      } finally {
        setBusy(false);
        flushPersist();
        focusInput(0);
      }
    };

    // Textarea auto-crescente (fino a ~200px)
    useEffect(() => {
      const el = inputRef.current;
      if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 200) + "px"; }
    }, [input]);

    // Handler storico sessioni.
    const handleNew = () => {
      const s = newSession();
      setStore({ sessions: [s, ...store.sessions], activeId: s.id });
      setDrawer(false);
      focusInput(60);
    };
    const handleSelect = (id) => { if (id !== store.activeId) setStore({ ...__store, activeId: id }); setDrawer(false); };
    const handleDelete = (id) => {
      const rest = __store.sessions.filter((s) => s.id !== id);
      if (!rest.length) { const s = newSession(); setStore({ sessions: [s], activeId: s.id }); }
      else {
        let activeId = __store.activeId;
        if (activeId === id) activeId = rest.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0].id;
        setStore({ sessions: rest, activeId });
      }
      flushPersist();
      if (window.toast) toast("Chat eliminata", { icon: "trash" });
    };
    const handleRename = (id, title) => { mutateSession(id, (s) => ({ ...s, title: String(title || "").slice(0, 60) })); flushPersist(); };
    // Duplica: copia i messaggi in una nuova sessione "Copia di …" e la attiva.
    const handleDuplicate = (id) => {
      const src = __store.sessions.find((s) => s.id === id);
      if (!src) return;
      const now = Date.now();
      const copy = {
        id: "s_" + now.toString(36) + "_" + Math.random().toString(36).slice(2, 7),
        title: ("Copia di " + displayTitle(src)).slice(0, 60),
        messages: src.messages.map((m) => ({ ...m })),
        createdAt: now,
        updatedAt: now,
      };
      setStore({ sessions: [copy, ...__store.sessions], activeId: copy.id });
      flushPersist();
      focusInput(60);
      if (window.toast) toast("Chat duplicata", { icon: "copy" });
    };
    // Svuota: resetta i messaggi all'intro mantenendo il titolo della sessione.
    const handleClear = (id) => {
      mutateSession(id, (s) => ({ ...s, messages: [CHAT_INTRO], updatedAt: Date.now() }));
      flushPersist();
      if (id === active.id) setInput("");
      if (window.toast) toast("Chat svuotata", { icon: "refresh" });
    };
    // Elimina tutte: azzera lo storico ripartendo da una singola chat nuova.
    const handleDeleteAll = () => {
      const s = newSession();
      setStore({ sessions: [s], activeId: s.id });
      flushPersist();
      focusInput(60);
      if (window.toast) toast("Tutte le chat eliminate", { icon: "trash" });
    };

    const hasConvo = messages.some((m) => m.role === "user");
    const hour = new Date().getHours();
    const greet = hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";
    // Suggerimenti DINAMICI: le richieste più frequenti fatte dal ristoratore in cowork
    // (aggregate dallo storico chat locale). Sotto una certa soglia usa i default.
    const freqSug = (() => {
      try {
        const counts = new Map();
        (store.sessions || []).forEach((s) => (s.messages || []).forEach((m) => {
          if (!m || m.role !== "user") return;
          const t = String(m.content || "").trim();
          if (t.length < 5 || t.length > 72 || t.startsWith("📷")) return;
          const k = t.toLowerCase().replace(/\s+/g, " ");
          const e = counts.get(k) || { text: t, n: 0 };
          e.n += 1; counts.set(k, e);
        }));
        const arr = [...counts.values()].sort((a, b) => b.n - a.n).map((e) => e.text);
        return arr.length >= 3 ? arr.slice(0, 5) : SUGGESTIONS;
      } catch (_) { return SUGGESTIONS; }
    })();
    // Saluto rivolto all'UTENTE loggato (nome per ruolo), non al nome del ristorante:
    // "Buonasera, Marco" e non "Buonasera, Pizzeria da Marco".
    const _role = window.__takoRole || "owner";
    const _uname = (window.ROLES && ROLES[_role] && ROLES[_role].name) || "";
    const owner = (_uname && _uname !== "—") ? _uname.split(" ")[0] : "";
    const canSend = (!!input.trim() || !!attachedImage) && !busy;

    // Composer stile Claude: box arrotondato, textarea, mic a sinistra, invio a destra.
    const composer = (
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
        {/* Waveform durante la dettatura (pennellata Wispr) — larga ~1/3, centrata, senza testo */}
        {DictWave && (dictState === "rec" || dictState === "busy") && (
          <div style={{ width: "34%", maxWidth: 240, margin: "0 auto 10px", height: 84, borderRadius: 20, overflow: "hidden", position: "relative",
            background: "linear-gradient(180deg,#F4F0E7 0%,#EFEADF 55%,#EAE4D7 100%)",
            border: "1px solid #0000000f", boxShadow: "0 8px 24px rgba(30,20,12,.16), inset 0 1.5px 0 rgba(255,255,255,.7)" }}>
            <DictWave />
          </div>
        )}

        <div style={{ borderRadius: 24, background: "var(--surface,#fff)", border: "1px solid var(--hairline,#E5E5E5)",
          boxShadow: "0 1px 2px rgba(0,0,0,.06), 0 12px 32px rgba(30,20,10,.07)", padding: "14px 16px 10px" }}>
          {attachedImage && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "5px 8px 5px 5px", borderRadius: 12, background: "var(--sunken,#F4F0E7)", border: "1px solid var(--hairline,#E5E5E5)" }}>
              <img src={attachedImage.url} alt="allegato" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover" }} />
              <span style={{ fontSize: 12.5, color: "var(--ink-2,#666)" }}>Foto pronta — scrivi a quale piatto assegnarla</span>
              <button onClick={() => setAttachedImage(null)} aria-label="Rimuovi" style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-3,#999)", fontSize: 16, lineHeight: 1, padding: "0 2px" }}>×</button>
            </div>
          )}
          <textarea ref={inputRef} value={input} rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Come posso aiutarti? Scrivi o premi ⌘K per dettare…"
            style={{ width: "100%", border: "none", outline: "none", resize: "none", background: "transparent",
              fontSize: 16, lineHeight: 1.5, color: "var(--ink,#1F1E1D)", maxHeight: 200, overflowY: "auto",
              fontFamily: "inherit", display: "block", padding: "2px 2px 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            {DictBtn && <DictBtn onText={(seg) => typeInto(seg)} onStateChange={setDictState} size={36} />}
            <label aria-label="Allega immagine" title="Allega una foto da assegnare a un piatto"
              style={{ width: 36, height: 36, borderRadius: 12, display: "grid", placeItems: "center", cursor: imgBusy ? "wait" : "pointer", color: "var(--ink-2,#666)", border: "1px solid var(--hairline,#E5E5E5)", background: "transparent" }}>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onPickCopilotImage} disabled={imgBusy} style={{ position: "absolute", width: 0, height: 0, opacity: 0 }} />
              {imgBusy
                ? <span style={{ fontSize: 12 }}>…</span>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>}
            </label>
            <div style={{ flex: 1 }} />
            <button onClick={() => send()} disabled={!canSend} aria-label="Invia"
              style={{ width: 36, height: 36, borderRadius: 12, border: "none", display: "grid", placeItems: "center",
                cursor: canSend ? "pointer" : "default", color: "#fff", transition: "background .15s, opacity .15s",
                background: canSend ? "var(--brand,#D97757)" : "var(--brand,#D97757)", opacity: canSend ? 1 : .32 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>
            </button>
          </div>
        </div>
        <p style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "var(--ink-3,#999)" }}>
          Tako può sbagliare. Verifica le informazioni importanti.
        </p>
      </div>
    );

    // Area chat vera e propria (condivisa desktop/mobile).
    const chatArea = (hasConvo && !leaving) ? (
      <>
        <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: mobile ? "16px" : "24px 24px 8px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "86%", padding: "11px 14px", borderRadius: 16,
                    background: m.role === "user" ? "var(--brand,#ED7159)" : "var(--surface,#fff)",
                    color: m.role === "user" ? "var(--on-brand,#fff)" : "var(--ink,#2A1F1A)",
                    border: m.role === "user" ? "none" : "1px solid var(--hairline,#eee)",
                    fontSize: 14.5, lineHeight: 1.45, fontWeight: 500, whiteSpace: "pre-wrap" }}>
                    {m.image && <img src={m.image} alt="allegato" style={{ display: "block", maxWidth: 180, borderRadius: 10, marginBottom: m.content ? 8 : 0 }} />}
                    {m.content || (m.streaming ? "…" : "")}
                    {m.streaming && m.content ? <span style={{ display: "inline-block", width: 6, height: 14, marginLeft: 3, borderRadius: 2, background: "var(--brand,#ED7159)", verticalAlign: "-2px", opacity: .55 }} /> : null}
                  </div>
                </div>
                {m.role === "assistant" && m.pending && m.pending.map((p, pi) => (
                  <PendingCard key={pi} item={p} onDone={() => {}} />
                ))}
              </div>
            ))}
            {busy && !messages.some((x) => x.streaming) && <div style={{ fontSize: 13, color: "var(--ink-3,#9a8f86)", padding: "4px 2px" }}>Sto pensando…</div>}
          </div>
        </div>
        <div style={{ padding: mobile ? "0 12px 14px" : "4px 24px 20px" }}>{composer}</div>
      </>
    ) : (
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: mobile ? "24px 16px" : "24px", gap: 8, pointerEvents: leaving ? "none" : "auto" }}>
        <div style={{ textAlign: "center", marginBottom: 26, transition: "opacity .24s ease, transform .34s cubic-bezier(.4,0,1,1)", opacity: leaving ? 0 : 1, transform: leaving ? "translateY(-22px) scale(.96)" : "none" }}>
          <img src="assets/takos/arancione/logo.png" alt="Tako" draggable={false}
            style={{ width: 80, height: 80, objectFit: "contain", margin: "0 auto 16px", filter: "drop-shadow(0 10px 20px rgba(42,31,26,.18))" }} />
          <h1 style={{ fontSize: mobile ? 27 : 34, fontWeight: 400, color: "var(--ink,#2A1F1A)", letterSpacing: "-.5px", lineHeight: 1.1 }}>
            {greet}{owner ? ", " : ""}
            {owner && (
              <span style={{ position: "relative", display: "inline-block", fontWeight: 600, paddingBottom: 6 }}>
                {owner}
                <svg style={{ position: "absolute", width: "140%", height: 18, bottom: -2, left: "-20%", color: "var(--brand,#D97757)" }}
                  viewBox="0 0 140 24" fill="none" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M6 16 Q 70 24, 134 14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
                </svg>
              </span>
            )}
          </h1>
        </div>
        <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>{composer}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8, maxWidth: 640, transition: "opacity .18s ease, transform .24s cubic-bezier(.4,0,1,1), filter .2s", opacity: leaving ? 0 : 1, transform: leaving ? "translateY(22px) scale(.9)" : "none", filter: leaving ? "blur(3px)" : "none" }}>
          {freqSug.map((s) => (
            <button key={s} onClick={() => send(s)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13.5,
                color: "var(--ink-2,#6a5f56)", background: "transparent", border: "1px solid var(--hairline,#e6ded6)",
                borderRadius: 999, cursor: "pointer", transition: "background .15s, color .15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sunken,#F0EEE6)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              {s}
            </button>
          ))}
        </div>
      </div>
    );

    // ── MOBILE: chat a schermo pieno + drawer storico a scomparsa ──
    if (mobile) {
      return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0, background: "var(--bg,#FAF9F5)" }}>
          {/* Barra compatta in alto: apre lo storico, nuova chat rapida */}
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
            borderBottom: "1px solid var(--hairline,#e6ded6)", background: "var(--surface,#fff)" }}>
            <button onClick={() => setDrawer(true)} aria-label="Storico chat"
              style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 12px", borderRadius: 11,
                border: "1px solid var(--hairline,#e6ded6)", background: "var(--surface,#fff)", color: "var(--ink,#2A1F1A)",
                fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
              Storico
            </button>
            <div style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: 13.5, fontWeight: 700, color: "var(--ink,#2A1F1A)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayTitle(active)}</div>
            <button onClick={handleNew} aria-label="Nuova chat"
              style={{ flex: "none", width: 36, height: 36, borderRadius: 11, border: "1px solid var(--hairline,#e6ded6)",
                background: "var(--surface,#fff)", color: "var(--brand,#ED7159)", display: "grid", placeItems: "center", cursor: "pointer" }}>
              <Icon name="plus" size={18} />
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{chatArea}</div>

          {/* Drawer storico (pannello destro a scomparsa) */}
          <Overlay open={drawer} onClose={() => setDrawer(false)} anchor="right">
            <div className="scroll" style={{ width: "min(84vw, 320px)", height: "100%", overflowY: "auto", background: "var(--nav,#25262A)", color: "var(--nav-ink,#E6E6EA)", padding: 14,
              borderLeft: "1px solid var(--nav-line,rgba(255,255,255,.09))", boxShadow: "-12px 0 40px rgba(0,0,0,.34)" }}>
              <SessionSidebar sessions={store.sessions} activeId={store.activeId}
                onNew={handleNew} onSelect={handleSelect} onDelete={handleDelete} onRename={handleRename}
                onDuplicate={handleDuplicate} onClear={handleClear} onDeleteAll={handleDeleteAll}
                header={(
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Le tue chat</div>
                    <button onClick={() => setDrawer(false)} aria-label="Chiudi"
                      style={{ width: 32, height: 32, borderRadius: 9, border: "none", background: "transparent", color: "var(--nav-ink-2,#9B9CA4)", cursor: "pointer", display: "grid", placeItems: "center" }}>
                      <Icon name="x" size={18} />
                    </button>
                  </div>
                )} />
            </div>
          </Overlay>
        </div>
      );
    }

    // ── DESKTOP: chat a sinistra/centro + sidebar sessioni a DESTRA ──
    // Card flottante nella STESSA palette della Sidebar principale (03-shell-nav.js):
    // sfondo var(--nav), testi var(--nav-ink), radius 16, ombra var(--sh-2).
    // È COMPATTA (height:auto, allineata in alto): occupa solo lo spazio necessario
    // e si estende verso il basso solo quando lo storico viene espanso; il resto
    // dello spazio verticale a destra resta libero.
    return (
      <div style={{ height: "100%", display: "flex", minHeight: 0, background: "var(--bg,#FAF9F5)" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {chatArea}
        </div>
        {/* overflow VISIBILE durante la sequenza: il pop/l'ombra della card Streaming
            non devono essere tagliati dai bordi dell'aside mentre risale ed è in cima. */}
        <aside className="scroll" style={{ width: 272, flex: "none", alignSelf: "flex-start",
          margin: "12px 12px 12px 0", maxHeight: "calc(100% - 24px)", overflowY: streamExpanding ? "visible" : "auto",
          display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Card SESSIONI (chat): fase "hide" = esce visivamente (slide-up + fade, il
              layout resta); fase "collapsed" = collasso layout ISTANTANEO (max-height
              fuori dalla transition) così la card Streaming risale via FLIP spring. */}
          <div style={{ padding: 14, background: "var(--nav,#25262A)", color: "var(--nav-ink,#E6E6EA)",
            border: "1px solid var(--nav-line,rgba(255,255,255,.09))", borderRadius: 16, boxShadow: "var(--sh-2)", flex: "none",
            transform: streamExpanding ? "translateY(-22px) scale(.97)" : "none", opacity: streamExpanding ? 0 : 1,
            maxHeight: streamExpanding === "collapsed" ? 0 : 4000, overflow: streamExpanding ? "hidden" : "visible",
            transition: streamExpanding === "collapsed"
              ? "transform .22s var(--out), opacity .18s ease"
              : "transform .22s var(--out), opacity .18s ease, max-height .35s var(--out)" }}>
            <SessionSidebar sessions={store.sessions} activeId={store.activeId}
              onNew={handleNew} onSelect={handleSelect} onDelete={handleDelete} onRename={handleRename}
              onDuplicate={handleDuplicate} onClear={handleClear} onDeleteAll={handleDeleteAll} />
          </div>
          {/* Card STREAMING: anteprima live, al click risale con molla e si espande a tutta pagina */}
          <StreamingPreview onExpandStart={(phase) => setStreamExpanding(phase || "hide")} onExpandEnd={() => setStreamExpanding(false)} />
        </aside>
      </div>
    );
  }

  // Hotkey globali (headless): ⌘K oppure ⌥Space (Option+Space) → vai alla sezione
  // Cowork e avvia/ferma la dettatura; Esc → annulla la dettatura in corso.
  // Vive sempre, indipendente dalla schermata.
  function TakoHotkeys() {
    useEffect(() => {
      const onKey = (e) => {
        // ⌥Space usa e.code (con Option il carattere cambia, e.key non è affidabile).
        const isCmdK = (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
        const isAltSpace = e.altKey && e.code === "Space";
        if (isCmdK || isAltSpace) {
          e.preventDefault();
          const onCowork = !!window.takoDictationToggle; // il bottone è montato solo su Cowork
          if (window.takoGo) window.takoGo("cowork");
          setTimeout(() => { window.takoDictationToggle && window.takoDictationToggle(); }, onCowork ? 0 : 220);
        } else if (e.key === "Escape") {
          if (window.takoDictationCancel) { e.preventDefault(); window.takoDictationCancel(); }
        }
      };
      window.addEventListener("keydown", onKey);
      window.openCopilot = () => window.takoGo && window.takoGo("cowork");
      return () => { window.removeEventListener("keydown", onKey); delete window.openCopilot; };
    }, []);
    return null;
  }
  window.ScreenCowork = TakoChat;

  /* Monta SOLO le hotkey globali (nessuna UI): la chat è la schermata Cowork,
     renderizzata dall'app dentro <main>. */
  function mount() {
    if (window.__takoHotkeysMounted) return;
    window.__takoHotkeysMounted = true;
    const el = document.createElement("div");
    el.id = "tako-hotkeys";
    document.body.appendChild(el);
    ReactDOM.createRoot(el).render(<TakoHotkeys />);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();

  window.TakoCopilot = { mount };
})();
