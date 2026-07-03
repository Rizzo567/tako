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

  const CHAT_INTRO = { role: "assistant", content: "Ciao! Sono Tako. Chiedimi incassi, statistiche, stato tavoli — o dimmi di segnare/eliminare/modificare un piatto. Scrivi o premi ⌘K per dettare." };

  // Stato chat PERSISTENTE finché l'app resta aperta: vive a livello modulo (non in
  // localStorage/DB), quindi sopravvive a unmount/remount della schermata Cowork
  // (navigazione via e ritorno) ma si AZZERA al riavvio dell'app (il webview
  // ricarica lo script → questa variabile torna al valore iniziale).
  let __coworkChat = { messages: [CHAT_INTRO], input: "" };

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
    // Ripristina lo stato dalla sessione app-aperta (module store).
    const [messages, setMessages] = useState(() => __coworkChat.messages);
    const [input, setInput] = useState(() => __coworkChat.input);
    const [busy, setBusy] = useState(false);
    const [dictState, setDictState] = useState("idle"); // idle | rec | busy
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    const inputValRef = useRef("");
    useEffect(() => { inputValRef.current = input; }, [input]);
    // Persisti a ogni cambio: alla prossima apertura di Cowork (stessa sessione app)
    // la conversazione è ancora qui.
    useEffect(() => { __coworkChat = { messages, input }; }, [messages, input]);
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

    // Textarea auto-crescente (fino a ~200px)
    useEffect(() => {
      const el = inputRef.current;
      if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 200) + "px"; }
    }, [input]);

    const hasConvo = messages.some((m) => m.role === "user");
    const hour = new Date().getHours();
    const greet = hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";
    const owner = (window.RESTAURANT && (RESTAURANT.owner || RESTAURANT.name)) || "";
    const canSend = !!input.trim() && !busy;

    // Composer stile Claude: box arrotondato, textarea, mic a sinistra, invio a destra.
    const composer = (
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
        {/* Waveform durante la dettatura (pennellata Wispr) — compatta, senza testo */}
        {DictWave && (dictState === "rec" || dictState === "busy") && (
          <div style={{ marginBottom: 10, height: 54, borderRadius: 16, overflow: "hidden", position: "relative",
            background: "linear-gradient(180deg,#F4F0E7 0%,#EFEADF 55%,#EAE4D7 100%)",
            border: "1px solid #0000000f", boxShadow: "0 8px 24px rgba(30,20,12,.16), inset 0 1.5px 0 rgba(255,255,255,.7)" }}>
            <DictWave />
          </div>
        )}

        <div style={{ borderRadius: 24, background: "var(--surface,#fff)", border: "1px solid var(--hairline,#E5E5E5)",
          boxShadow: "0 1px 2px rgba(0,0,0,.06), 0 12px 32px rgba(30,20,10,.07)", padding: "14px 16px 10px" }}>
          <textarea ref={inputRef} value={input} rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Come posso aiutarti? Scrivi o premi ⌘K per dettare…"
            style={{ width: "100%", border: "none", outline: "none", resize: "none", background: "transparent",
              fontSize: 16, lineHeight: 1.5, color: "var(--ink,#1F1E1D)", maxHeight: 200, overflowY: "auto",
              fontFamily: "inherit", display: "block", padding: "2px 2px 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            {DictBtn && <DictBtn onText={(seg) => typeInto(seg)} onStateChange={setDictState} size={36} />}
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

    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0, background: "var(--bg,#FAF9F5)" }}>
        {hasConvo ? (
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
                        {m.content}
                      </div>
                    </div>
                    {m.role === "assistant" && m.pending && m.pending.map((p, pi) => (
                      <PendingCard key={pi} item={p} onDone={() => {}} />
                    ))}
                  </div>
                ))}
                {busy && <div style={{ fontSize: 13, color: "var(--ink3,#9a8f86)", padding: "4px 2px" }}>Sto pensando…</div>}
              </div>
            </div>
            <div style={{ padding: mobile ? "0 12px 14px" : "4px 24px 20px" }}>{composer}</div>
          </>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", padding: mobile ? "24px 16px" : "24px", gap: 8 }}>
            <div style={{ textAlign: "center", marginBottom: 26 }}>
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
            {composer}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8, maxWidth: 640 }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13.5,
                    color: "var(--ink2,#6a5f56)", background: "transparent", border: "1px solid var(--hairline,#e6ded6)",
                    borderRadius: 999, cursor: "pointer", transition: "background .15s, color .15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface2,#F0EEE6)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
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
