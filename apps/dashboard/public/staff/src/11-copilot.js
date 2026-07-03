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

  // Schermata "Cowork": la chat con Tako vive QUI (sezione della sidebar),
  // riempie l'area principale. Nessun overlay, nessun launcher flottante.
  function TakoChat({ mobile }) {
    const [messages, setMessages] = useState([
      { role: "assistant", content: "Ciao! Sono Tako. Chiedimi incassi, statistiche, stato tavoli — o dimmi di segnare/eliminare/modificare un piatto. Scrivi o premi ⌘K per dettare." },
    ]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [dictState, setDictState] = useState("idle"); // idle | rec | busy
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    const inputValRef = useRef("");
    useEffect(() => { inputValRef.current = input; }, [input]);
    const DictBtn = window.DictationButton;
    const DictWave = window.TakoDictationWave;

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

    useEffect(() => { if (inputRef.current) setTimeout(() => { try { inputRef.current.focus(); } catch (_) {} }, 80); }, []);
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

    const PAD = mobile ? 16 : 24;
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0, background: "var(--bg,#FBF8F4)" }}>
        {/* Header di sezione (su mobile lo mostra già il MobileHeader) */}
        {!mobile && <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 24px", borderBottom: "1px solid var(--hairline,#eee)", background: "var(--surface,#fff)" }}>
          <img src="assets/takos/arancione/logo.png" alt="Tako" draggable={false}
            style={{ width: mobile ? 42 : 48, height: mobile ? 42 : 48, objectFit: "contain", flex: "none", filter: "drop-shadow(0 5px 10px rgba(42,31,26,.16))" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: mobile ? 18 : 21, color: "var(--ink,#2A1F1A)" }}>Tako</div>
            <div style={{ fontSize: 12.5, color: "var(--ink3,#9a8f86)" }}>Assistente operativo · ⌘K per dettare</div>
          </div>
        </div>}

        {/* Conversazione (centrata, leggibile su schermi larghi) */}
        <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: PAD }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "86%", padding: "11px 14px", borderRadius: 16,
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
        </div>

        {/* Waveform in un RIQUADRO SEPARATO sopra il composer (stile Wispr Flow) */}
        {DictWave && (dictState === "rec" || dictState === "busy") && (
          <div style={{ padding: `0 ${PAD}px ${mobile ? 10 : 12}px`, background: "var(--surface,#fff)" }}>
            <div style={{ maxWidth: 760, margin: "0 auto", height: 92, borderRadius: 21, overflow: "hidden", position: "relative",
              background: "linear-gradient(180deg,#F4F0E7 0%,#EFEADF 55%,#EAE4D7 100%)",
              border: "1px solid #0000000f", boxShadow: "0 10px 30px rgba(30,20,12,.20), inset 0 1.5px 0 rgba(255,255,255,.75)" }}>
              <DictWave />
              {dictState === "rec" && (
                <div style={{ position: "absolute", left: 16, top: 11, fontSize: 11.5, fontWeight: 700, letterSpacing: .3,
                  color: "#B4453F", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#E5484D", animation: "takoDictPulse 1.2s ease-in-out infinite" }} />
                  In ascolto · Esc per annullare
                </div>
              )}
              {dictState === "busy" && (
                <div style={{ position: "absolute", left: 16, top: 11, fontSize: 11.5, fontWeight: 700, letterSpacing: .3, color: "#9a8f86" }}>
                  Trascrivo…
                </div>
              )}
            </div>
          </div>
        )}

        {/* Composer + microfono */}
        <div style={{ borderTop: "1px solid var(--hairline,#eee)", background: "var(--surface,#fff)", padding: mobile ? 12 : `12px ${PAD}px 14px` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 760, margin: "0 auto" }}>
            {DictBtn && <DictBtn onText={(seg) => typeInto(seg)} onStateChange={setDictState} size={44} />}
            <input ref={inputRef} value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
              placeholder="Chiedi o detta con ⌘K… (es. incasso di oggi)"
              style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--hairline,#e6ded6)", background: "var(--sunken,#FBF8F4)", fontSize: 14.5, outline: "none" }} />
            <button onClick={() => send()} disabled={!input.trim() || busy}
              style={{ width: 44, height: 44, borderRadius: 12, border: "none", background: "var(--brand,#ED7159)", color: "var(--on-brand,#fff)", cursor: "pointer", display: "grid", placeItems: "center", opacity: (!input.trim() || busy) ? .5 : 1 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Hotkey globali (headless): ⌘K → vai alla sezione Cowork e avvia la dettatura;
  // Esc → annulla la dettatura in corso. Vive sempre, indipendente dalla schermata.
  function TakoHotkeys() {
    useEffect(() => {
      const onKey = (e) => {
        if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
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
