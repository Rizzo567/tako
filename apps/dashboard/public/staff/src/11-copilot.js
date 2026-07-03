/* ═══════════════════════ Tako — OWNER COPILOT (Cmd+K) ═══════════════════════
   Pannello AI globale per l'owner/staff: si apre con ⌘K / Ctrl+K (o window.openCopilot()).
   Chiede in linguaggio naturale (o DETTA: Cmd+K avvia/ferma la dettatura,
   window.DictationButton in 08-dictation.js) e l'AI:
     • LEGGE dati reali (incasso di oggi, statistiche, stato tavoli, cerca piatti)
     • PROPONE modifiche al menu (segna esaurito/disponibile, crea piatto) → richiedono
       CONFERMA esplicita prima di essere eseguite (POST /ai/owner/execute).
   Riusa il motore azioni server (lib/ai-actions) via /api/ai/owner/*.

   Self-mount: crea un proprio container sotto <body> (non tocca #stage/07-app-root).
   Dipende a runtime da: React, window.TakoAPI, window.toast, window.takoReload.
   ─────────────────────────────────────────────────────────────────────────── */
(function () {
  const { useState, useRef, useEffect } = React;

  const SUGGESTIONS = [
    "Quanto ho incassato oggi?",
    "Segna la carbonara come esaurita",
    "Stato dei tavoli",
    "Statistiche degli ultimi 7 giorni",
  ];

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
        {state === "done" || state === "error"
          ? <div style={{ marginTop: 8, fontSize: 13, color: state === "error" ? "var(--danger,#d9533a)" : "var(--ink2,#6a5f56)" }}>{msg}</div>
          : (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => setState("done")} disabled={state === "running"}
                style={{ flex: "0 0 auto", padding: "9px 14px", borderRadius: 11, border: "1px solid var(--hairline,#e6ded6)", background: "var(--surface,#fff)", color: "var(--ink2,#6a5f56)", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
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

  function Copilot() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([
      { role: "assistant", content: "Ciao! Sono Tako. Chiedimi incassi, statistiche, stato tavoli — o dimmi di segnare un piatto esaurito o crearne uno nuovo." },
    ]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [dictState, setDictState] = useState("idle"); // idle | rec | busy
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    const openRef = useRef(false);
    const inputValRef = useRef("");
    useEffect(() => { openRef.current = open; }, [open]);
    useEffect(() => { inputValRef.current = input; }, [input]);
    const DictBtn = window.DictationButton;
    const DictWave = window.TakoDictationWave;

    // Inserimento del trascritto LETTERA-PER-LETTERA (typewriter veloce ~11ms/car),
    // come richiesto: il testo "scorre" nel campo appena arriva dalla dettatura.
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

    // ⌘K / Ctrl+K = DETTATURA: se il copilot è chiuso lo apre E avvia la
    // registrazione; se è aperto, avvia/ferma la dettatura (allo stop il testo
    // trascritto+pulito finisce nel campo). Esc chiude (e libera il mic).
    useEffect(() => {
      const onKey = (e) => {
        if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
          e.preventDefault();
          if (!openRef.current) {
            setOpen(true);
            // il bottone mic registra window.takoDictationToggle al mount
            setTimeout(() => { window.takoDictationToggle && window.takoDictationToggle(); }, 150);
          } else {
            window.takoDictationToggle && window.takoDictationToggle();
          }
        }
        else if (e.key === "Escape") {
          // Esc annulla PRIMA la dettatura in corso (come Wispr Flow); solo se
          // non sta registrando chiude il pannello.
          if (window.takoDictationCancel) { e.preventDefault(); window.takoDictationCancel(); }
          else setOpen(false);
        }
      };
      window.addEventListener("keydown", onKey);
      window.openCopilot = () => setOpen(true);
      return () => { window.removeEventListener("keydown", onKey); delete window.openCopilot; };
    }, []);

    useEffect(() => { if (open && inputRef.current) setTimeout(() => inputRef.current.focus(), 60); }, [open]);
    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, busy]);

    const send = async (override) => {
      const text = (override != null ? override : input).trim();
      if (!text || busy) return;
      setInput("");
      const next = [...messages, { role: "user", content: text }];
      setMessages(next);
      setBusy(true);
      try {
        const history = next.slice(-12).map((m) => ({ role: m.role, content: m.content }));
        const data = await TakoAPI.post("/ai/owner/chat", { message: text, history });
        setMessages((m) => [...m, { role: "assistant", content: data.message || "Fatto.", pending: Array.isArray(data.pending) ? data.pending : [] }]);
      } catch (ex) {
        const m = ex && ex.status === 503 ? "AI non configurata su questo server." : "Tako non disponibile, riprova.";
        setMessages((mm) => [...mm, { role: "assistant", content: m }]);
      } finally {
        setBusy(false);
      }
    };

    if (!open) {
      // Launcher flottante (utilizzabile anche senza voce di menu).
      return (
        <button onClick={() => setOpen(true)} title="Tako (⌘K)"
          style={{ position: "fixed", right: 18, bottom: "calc(18px + env(safe-area-inset-bottom))", zIndex: 3500,
            width: 54, height: 54, borderRadius: 16, border: "none", cursor: "pointer",
            background: "var(--brand,#ED7159)", color: "var(--on-brand,#fff)", display: "grid", placeItems: "center",
            boxShadow: "0 10px 30px rgba(237,113,89,.45)" }}>
          <SparkIcon size={22} />
        </button>
      );
    }

    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 3500, display: "flex", alignItems: "flex-start", justifyContent: "center",
        background: "rgba(30,20,16,.42)", backdropFilter: "blur(3px)", padding: "10vh 16px 16px" }}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        <div style={{ width: "min(620px, 100%)", maxHeight: "78vh", display: "flex", flexDirection: "column",
          background: "var(--bg,#FBF8F4)", borderRadius: 20, overflow: "hidden", boxShadow: "0 24px 70px rgba(40,20,10,.34)", border: "1px solid #0000000f" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--hairline,#eee)", background: "var(--surface,#fff)" }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--brand,#ED7159)", color: "var(--on-brand,#fff)" }}><SparkIcon size={18} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 15.5, color: "var(--ink,#2A1F1A)" }}>Tako</div>
              <div style={{ fontSize: 12, color: "var(--ink3,#9a8f86)" }}>⌘K</div>
            </div>
            <button onClick={() => setOpen(false)} title="Chiudi"
              style={{ width: 32, height: 32, borderRadius: 9, border: "none", background: "var(--sunken,#F2ECE6)", color: "var(--ink2,#8a7f76)", fontSize: 15, cursor: "pointer" }}>✕</button>
          </div>

          {/* Conversazione */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "86%", padding: "10px 13px", borderRadius: 16,
                    background: m.role === "user" ? "var(--brand,#ED7159)" : "var(--surface,#fff)",
                    color: m.role === "user" ? "var(--on-brand,#fff)" : "var(--ink,#2A1F1A)",
                    border: m.role === "user" ? "none" : "1px solid var(--hairline,#eee)",
                    fontSize: 14.5, lineHeight: 1.45, fontWeight: 500, whiteSpace: "pre-wrap" }}>
                    {m.content}
                  </div>
                </div>
                {m.role === "assistant" && m.pending && m.pending.map((p, pi) => (
                  <PendingCard key={pi} item={p} onDone={() => {}} />
                ))}
              </div>
            ))}
            {messages.length === 1 && !busy && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid var(--hairline,#e6ded6)", background: "var(--surface,#fff)", color: "var(--ink2,#6a5f56)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {busy && <div style={{ fontSize: 13, color: "var(--ink3,#9a8f86)", padding: "4px 2px" }}>Sto pensando…</div>}
          </div>

          {/* Composer + microfono (dettatura Cmd+K) */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, borderTop: "1px solid var(--hairline,#eee)", background: "var(--surface,#fff)" }}>
            {DictBtn && <DictBtn onText={(seg) => typeInto(seg)} onStateChange={setDictState} size={44} />}
            <input ref={inputRef} value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
              placeholder="Chiedi o detta con Cmd+K… (es. incasso di oggi)"
              style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--hairline,#e6ded6)", background: "var(--sunken,#FBF8F4)", fontSize: 14.5, outline: "none" }} />
            <button onClick={() => send()} disabled={!input.trim() || busy}
              style={{ width: 44, height: 44, borderRadius: 12, border: "none", background: "var(--brand,#ED7159)", color: "var(--on-brand,#fff)", cursor: "pointer", display: "grid", placeItems: "center", opacity: (!input.trim() || busy) ? .5 : 1 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </button>
          </div>

          {/* Waveform fluida SOTTO la chat: visibile mentre detti / elabora
              (stile Wispr Flow — linea a pennello che ondeggia con la voce). */}
          {DictWave && (dictState === "rec" || dictState === "busy") && (
            <div style={{ padding: "0 12px 12px", background: "var(--surface,#fff)" }}>
              <div style={{ height: 64, borderRadius: 14, overflow: "hidden",
                background: "var(--surface2,#F1ECE3)", border: "1px solid var(--hairline,#e6ded6)",
                boxShadow: "inset 0 1px 3px rgba(0,0,0,.05)", position: "relative" }}>
                <DictWave />
                {dictState === "rec" && (
                  <div style={{ position: "absolute", left: 12, top: 8, fontSize: 11, fontWeight: 700, letterSpacing: .3,
                    color: "#B4453F", display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#E5484D", animation: "takoDictPulse 1.2s ease-in-out infinite" }} />
                    In ascolto · Esc per annullare
                  </div>
                )}
                {dictState === "busy" && (
                  <div style={{ position: "absolute", left: 12, top: 8, fontSize: 11, fontWeight: 700, letterSpacing: .3, color: "#9a8f86" }}>
                    Trascrivo…
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* Self-mount in un container dedicato sotto <body> (non tocca #stage). */
  function mount() {
    if (window.__copilotMounted) return;
    window.__copilotMounted = true;
    const el = document.createElement("div");
    el.id = "tako-copilot";
    // Eredita il colore brand corrente (i brandVars vivono sul div dell'app, non su :root).
    try { el.style.setProperty("--brand", (window.RESTAURANT && RESTAURANT.brand) || "#ED7159"); } catch (_) {}
    document.body.appendChild(el);
    ReactDOM.createRoot(el).render(<Copilot />);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();

  window.TakoCopilot = { mount };
})();
