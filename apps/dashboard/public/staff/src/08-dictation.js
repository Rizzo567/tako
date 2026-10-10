/* ═══════════════════════ Tako — DETTATURA VOCALE (push-to-talk) ═══════════════
   La webapp usa il riconoscimento vocale del browser (SpeechRecognition), avviato
   solo da un gesto esplicito: nessun audio viene inviato al server Tako.

   Espone:
     window.TakoBrowserDictationRecorder — recorder del browser (start/stop/cancel)
     window.DictationButton              — bottone React autonomo (stati: idle/rec/busy)
     window.takoDictationToggle()        — registrata dal bottone montato (per Cmd+K)
   ─────────────────────────────────────────────────────────────────────────── */
(function () {
  const MAX_RECORD_MS = 90_000;    // tetto di sicurezza
  // Il servizio vocale del browser parte solo dopo un gesto esplicito.
  class TakoBrowserDictationRecorder {
    constructor(opts) { this.opts = opts || {}; this.recording = false; this.socket = null; this.recognition = null; this.text = ""; this.ended = false; this.error = null; this._pending = null; }
    getLevel() { return 0; } // SpeechRecognition provides no measured audio level.
    _ensureSocket() { return null; }
    async start() {
      if (this.recording) return;
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Recognition) throw new Error("Questo browser non supporta la dettatura. Scrivi nel campo di testo.");
      const recognition = new Recognition(); this.recognition = recognition;
      this.text = ""; this.ended = false; this.error = null;
      recognition.lang = "it-IT"; recognition.continuous = false; recognition.interimResults = false;
      await new Promise((resolve, reject) => {
        let started = false; this._startReject = reject;
        recognition.onstart = () => { started = true; this._startReject = null; this.recording = true; this._maxTimer = setTimeout(() => this.opts.onSpeechEnd && this.opts.onSpeechEnd(), MAX_RECORD_MS); resolve(); };
        recognition.onresult = event => { for (let i = event.resultIndex; i < event.results.length; i++) if (event.results[i].isFinal) this.text += (this.text ? " " : "") + event.results[i][0].transcript; };
        recognition.onerror = event => { this.error = new Error(event.error === "not-allowed" ? "Permesso microfono negato. Abilitalo nelle impostazioni del browser oppure scrivi nel campo." : event.error === "no-speech" ? "Nessuna voce rilevata. Scrivi nel campo oppure riprova." : "Dettatura del browser non disponibile: " + event.error); if (!started) { this.recording = false; this._startReject = null; reject(this.error); } };
        recognition.onend = () => { this.ended = true; clearTimeout(this._maxTimer); if (this._pending) { const pending = this._pending; this._pending = null; this.error ? pending.reject(this.error) : pending.resolve(this._result()); } else if (this.recording) this.opts.onSpeechEnd && this.opts.onSpeechEnd(); else if (!started) reject(this.error || new Error("Dettatura non avviata.")); };
        try { recognition.start(); } catch (error) { reject(error); }
      });
    }
    _result() { return { text: this.text.trim(), raw: this.text.trim(), asrEngine: "browser", previewOnly: true }; }
    async stop() {
      this.recording = false; clearTimeout(this._maxTimer);
      if (this.ended) { if (this.error) throw this.error; return this._result(); }
      return new Promise((resolve, reject) => { const timeout = setTimeout(() => { this.cancel(); reject(new Error("Timeout dettatura del browser.")); }, 8000); this._pending = { resolve: result => { clearTimeout(timeout); resolve(result); }, reject: error => { clearTimeout(timeout); reject(error); } }; try { this.recognition.stop(); } catch (error) { this._pending.reject(error); this._pending = null; } });
    }
    cancel() { this.recording = false; clearTimeout(this._maxTimer); if (this._startReject) { this._startReject(new Error("Dettatura annullata.")); this._startReject = null; } if (this.recognition) { this.recognition.onstart = null; this.recognition.onend = null; this.recognition.onresult = null; this.recognition.onerror = null; try { this.recognition.abort(); } catch (_) {} } if (this._pending) { this._pending.reject(new Error("Dettatura annullata.")); this._pending = null; } this.text = ""; }
  }
  let dictationRuntimePromise;
  function dictationRuntime() {
    if (!dictationRuntimePromise) dictationRuntimePromise = fetch("/api/system/info", { credentials: "include" }).then(response => { if (!response.ok) throw new Error("Runtime non disponibile"); return response.json(); }).then(result => { if (result.data && result.data.mode === "web") return "web"; if (result.data && typeof result.data.port === "number") return "local"; throw new Error("Runtime non riconosciuto"); });
    return dictationRuntimePromise;
  }

  /* ── Bottone mic autonomo (React) ────────────────────────────────────────── */
  // Stati: idle → rec (pulsante rosso) → busy (trascrizione) → idle.
  // Registra window.takoDictationToggle mentre è montato (usata da Cmd+K).
  // Errori NOMINATI (come Wispr Flow): messaggi specifici invece di uno
  // generico, così l'utente sa esattamente cosa fare.
  function micErrorMessage(e) {
    const name = e && e.name;
    const msg = (e && e.message) || String(e || "");
    if (name === "NotAllowedError" || name === "SecurityError")
      return "Microfono negato. Consenti il microfono a Tako in Impostazioni → Privacy → Microfono.";
    if (name === "NotReadableError" || name === "AbortError")
      return "Microfono occupato da un'altra app. Chiudila e riprova.";
    if (name === "NotFoundError" || name === "OverconstrainedError")
      return "Nessun microfono trovato. Collega un microfono e riprova.";
    if (/sessione staff/i.test(msg))
      return "Sessione scaduta: rientra e riprova la dettatura.";
    if (/non pronta|non pronto/i.test(msg))
      return "Connessione non pronta: riprova tra un istante.";
    if (/nessun motore/i.test(msg))
      return "Nessun motore vocale disponibile: né locale né cloud raggiungibili.";
    if (/timeout/i.test(msg))
      return "La trascrizione ci ha messo troppo. Riprova con una frase più breve.";
    if (/nessun audio|non ho sentito/i.test(msg))
      return "Non ti ho sentito: parla più vicino al microfono e riprova.";
    return "Dettatura fallita: " + (name ? name + " — " : "") + msg;
  }

  // Diagnostica: ogni errore client finisce anche nel log del server (via
  // socket 'clientlog') — così i problemi in-app sono visibili da terminale.
  function reportClientError(rec, where, e) {
    try { console.error("[dettatura]", where, e); } catch (_) {}
    try {
      rec && rec.socket && rec.socket.emit("clientlog", {
        where, name: e && e.name, message: (e && e.message) || String(e),
      });
    } catch (_) {}
  }

  // ── Waveform "pennello d'inchiostro" (canvas) stile Wispr Flow ───────────────
  // UNA pennellata grafite su crema: un filo principale netto + decine di ciocche
  // finissime semitrasparenti che gli si stringono attorno (texture "pelosa").
  // Silhouette fissa (come il riferimento): coda sottile sx → piccola gobba →
  // AVVALLAMENTO profondo a ~0.37 (dove le frange si aprono) → risalita → gobba
  // dolce a ~0.55 → ondina → lunga coda destra che si assottiglia a punta.
  // La voce (window.__takoDictRec.getLevel()) amplifica ampiezza e frange.
  function TakoDictationWave(props) {
    const { useRef, useEffect } = React;
    const canvasRef = useRef(null);
    const active = props && props.active;
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      let raf = 0, lvl = 0, running = true;
      const t0 = Date.now();
      const resize = () => {
        const w = canvas.clientWidth || 300, h = canvas.clientHeight || 64;
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resize();

      const g = (nx, c, wdt) => Math.exp(-((nx - c) / wdt) * ((nx - c) / wdt));
      const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      // Silhouette del riferimento, in unità di h (y positivo = verso il basso).
      const baseShape = (nx) =>
        -0.13 * g(nx, 0.12, 0.075)   // piccola gobba a sinistra
        + 0.46 * g(nx, 0.37, 0.080)  // avvallamento profondo (il tratto dominante)
        - 0.21 * g(nx, 0.55, 0.085)  // gobba dolce centro-destra
        + 0.07 * g(nx, 0.71, 0.090)  // ondina discendente
        - 0.06 * g(nx, 0.85, 0.090); // lieve risalita prima della coda
      // Dove il pennello è "carico": frange folte all'avvallamento e sulla gobba.
      const spreadShape = (nx) => 0.5 + 4.4 * g(nx, 0.37, 0.10) + 1.8 * g(nx, 0.55, 0.12);
      // margine laterale: le punte vivono DENTRO il box, come nel riferimento
      const X0 = 0.045, X1 = 0.955;

      const STRANDS = 64;
      // proprietà per-ciocca stabili (niente random per frame: il moto è di fase)
      const strands = [];
      for (let s = 0; s < STRANDS; s++) {
        const u = (s / (STRANDS - 1)) * 2 - 1;                 // -1..1 (sopra..sotto)
        strands.push({ u, seed: s * 0.618 % 1, ph: s * 2.399 });
      }

      const draw = () => {
        if (!running) return;
        const w = canvas.clientWidth || 300, h = canvas.clientHeight || 64, midY = h / 2;
        const rec = window.__takoDictRec;
        const target = (active !== false && rec && rec.recording) ? rec.getLevel() : 0;
        lvl = target > lvl ? lvl * 0.5 + target * 0.5 : lvl * 0.9 + target * 0.1;
        ctx.clearRect(0, 0, w, h);
        const t = (Date.now() - t0) / 1000;
        const ampScale = h * 0.72 * (0.55 + lvl * 0.5);        // silhouette a riposo, cresce con la voce (senza sbordare)
        const STEP = 3;

        for (let s = 0; s < STRANDS; s++) {
          const st = strands[s];
          const centerW = Math.exp(-(st.u * 1.35) * (st.u * 1.35)); // ciocche centrali più scure
          const alpha = 0.03 + 0.08 * centerW;
          ctx.beginPath();
          ctx.lineWidth = 0.7;
          ctx.lineCap = "round";
          ctx.strokeStyle = "rgba(66,60,53," + alpha.toFixed(3) + ")";
          let first = true;
          for (let px = 0; px <= w; px += STEP) {
            const nx = px / w;
            if (nx < X0 || nx > X1) continue;               // margine: dentro il box
            const u01 = (nx - X0) / (X1 - X0);              // 0..1 sul tratto visibile
            // code affusolate: sinistra corta, destra che si assottiglia a punta
            const env = smooth(0, 0.09, u01) * (1 - smooth(0.86, 1.0, u01) * 0.9);
            const base = baseShape(u01) * ampScale;
            // frange: si aprono dove il pennello è carico; quelle sotto pendono
            // di più nell'avvallamento (come nel riferimento)
            let spread = spreadShape(u01) * (1 + lvl * 1.5);
            if (st.u > 0) spread *= 1 + 1.4 * g(u01, 0.37, 0.09);
            // vita lenta: micro-onde di fase diverse per ciocca (flow, non nervoso)
            const wob = Math.sin(u01 * 9.5 + st.ph + t * 0.55) * 0.55
                      + Math.sin(u01 * 4.2 - st.ph * 0.7 + t * 0.38) * 0.45;
            const y = midY - h * 0.03 + (base + st.u * spread + wob * (0.4 + lvl * 1.4)) * env;
            if (first) { ctx.moveTo(px, y); first = false; } else ctx.lineTo(px, y);
          }
          ctx.stroke();
        }
        // filo principale: il tratto netto che si legge come "la" linea
        ctx.beginPath();
        ctx.lineWidth = 1.2;
        ctx.lineCap = "round";
        ctx.strokeStyle = "rgba(56,50,43,0.62)";
        let firstM = true;
        for (let px = 0; px <= w; px += 2) {
          const nx = px / w;
          if (nx < X0 || nx > X1) continue;
          const u01 = (nx - X0) / (X1 - X0);
          const env = smooth(0, 0.09, u01) * (1 - smooth(0.86, 1.0, u01) * 0.9);
          const wob = Math.sin(u01 * 9.5 + t * 0.55) * 0.4 + Math.sin(u01 * 4.2 + t * 0.38) * 0.35;
          const y = midY - h * 0.03 + (baseShape(u01) * ampScale + wob * (0.3 + lvl * 1.2)) * env;
          if (firstM) { ctx.moveTo(px, y); firstM = false; } else ctx.lineTo(px, y);
        }
        ctx.stroke();
        raf = requestAnimationFrame(draw);
      };
      draw();
      window.addEventListener("resize", resize);
      return () => { running = false; cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
    }, []);
    return React.createElement("canvas", { ref: canvasRef, style: { width: "100%", height: "100%", display: "block" } });
  }

  function DictationButton({ onText, onStateChange, size }) {
    const { useState, useRef, useEffect } = React;
    const [state, setState] = useState("idle"); // idle | rec | busy
    const [available, setAvailable] = useState(false);
    const [availabilityMessage, setAvailabilityMessage] = useState("Verifica dettatura…");
    const mountedRef = useRef(true);
    const recRef = useRef(null);
    const stateRef = useRef("idle");
    const px = size || 44;

    const set = (s) => { stateRef.current = s; if (mountedRef.current) { setState(s); onStateChange && onStateChange(s); } };

    // Stop + trascrizione: unico flusso per stop manuale (click/Cmd+K) e
    // auto-stop su silenzio (endpointing).
    const stopAndTranscribe = async () => {
      const rec = recRef.current;
      if (!rec || stateRef.current !== "rec") return;
      set("busy");
      try {
        const r = await rec.stop();
        if (mountedRef.current && r && r.text) onText && onText(r.text, r);
        else window.toast && window.toast("Non ti ho sentito: parla più vicino al microfono e riprova.", "error");
      } catch (e) {
        reportClientError(rec, "stop", e);
        window.toast && window.toast(micErrorMessage(e), "error");
      } finally {
        set("idle");
      }
    };

    // Annulla la registrazione SENZA trascrivere (Esc / click su annulla).
    const cancel = () => {
      const rec = recRef.current;
      if (rec && stateRef.current === "rec") { rec.cancel(); set("idle"); }
    };

    const toggle = async () => {
      const rec = recRef.current;
      if (!rec) return;
      if (stateRef.current === "busy") return;
      if (stateRef.current === "idle") {
        set("busy"); // anti doppio-avvio mentre getUserMedia/permessi sono in volo
        try { await rec.start(); set("rec"); }
        catch (e) {
          set("idle");
          reportClientError(rec, "start", e);
          window.toast && window.toast(micErrorMessage(e), "error");
        }
        return;
      }
      await stopAndTranscribe();
    };

    // Crea il recorder al MOUNT e PRE-CONNETTE il socket: così l'evento 'ready'
    // (auth) è quasi sempre già arrivato quando l'utente smette di parlare →
    // niente falso "sessione scaduta" per chi detta una frase breve subito.
    // Deps [] OBBLIGATORIE (vedi bug useEffter-cleanup a ogni render).
    useEffect(() => {
      mountedRef.current = true;
      let rec = null;
      dictationRuntime().then(mode => {
      if (!mountedRef.current) return;
      if (mode === "web" && !(window.SpeechRecognition || window.webkitSpeechRecognition)) { setAvailabilityMessage("Dettatura non supportata da questo browser: scrivi nel campo di testo."); return; }
      rec = new TakoBrowserDictationRecorder({
        onSpeechEnd: () => stopAndTranscribe(),
        onNoSpeech: () => {
          if (recRef.current && stateRef.current === "rec") {
            recRef.current.cancel(); set("idle");
            window.toast && window.toast("Nessuna voce rilevata: microfono muto o troppo lontano.", "error");
          }
        },
      });
      recRef.current = rec;
      window.__takoDictRec = rec;                 // condiviso con la waveform del copilot
      try { rec._ensureSocket(); } catch (_) {}   // pre-connessione (auth in anticipo)
      setAvailable(true); setAvailabilityMessage(mode === "web" ? "Detta con il browser · rivedi il testo prima di inviare" : "Detta (Cmd+K)");
      window.takoDictationToggle = toggle;
      }).catch(() => { if (mountedRef.current) setAvailabilityMessage("Dettatura non disponibile: scrivi nel campo di testo."); });
      return () => {
        mountedRef.current = false;
        if (window.takoDictationToggle === toggle) delete window.takoDictationToggle;
        if (rec) rec.cancel();
        try { rec && rec.socket && rec.socket.close(); } catch (_) {}
        if (window.__takoDictRec === rec) delete window.__takoDictRec;
      };
    }, []);

    useEffect(() => {
      if (state === "rec") window.takoDictationCancel = cancel;
      else if (window.takoDictationCancel === cancel) delete window.takoDictationCancel;
    }, [state]);

    // Il bottone: mic idle · quadrato rosso "stop" pulsante in registrazione ·
    // shimmer in elaborazione. La waveform vera è il pannello sotto la chat.
    const bg = state === "rec" ? "#E5484D" : "var(--surface2,#F4EFE8)";
    const fg = state === "rec" ? "#fff" : "#2A1F1A";
    const title = state === "rec" ? "Ferma e trascrivi · Esc per annullare"
      : state === "busy" ? "Trascrizione in corso…" : availabilityMessage;
    return React.createElement("button", {
      onClick: toggle,
      disabled: !available,
      title: title,
      "aria-label": "Dettatura vocale",
      "aria-busy": state === "busy",
      style: {
        width: px, height: px, minWidth: px, borderRadius: "50%", border: "1px solid var(--hairline,#E5DDD3)",
        background: bg, color: fg, cursor: !available ? "not-allowed" : state === "busy" ? "wait" : "pointer", opacity: available ? 1 : 0.45,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        animation: state === "rec" ? "takoDictPulse 1.2s ease-in-out infinite" : "none",
        transition: "background .15s",
      },
    },
      state === "busy"
        ? React.createElement("span", { style: { display: "inline-flex", gap: px * 0.06 } },
            React.createElement("i", { style: { width: px * 0.1, height: px * 0.1, borderRadius: "50%", background: "#B9AEA1", animation: "takoDictDot 1s ease-in-out infinite" } }),
            React.createElement("i", { style: { width: px * 0.1, height: px * 0.1, borderRadius: "50%", background: "#B9AEA1", animation: "takoDictDot 1s ease-in-out .16s infinite" } }),
            React.createElement("i", { style: { width: px * 0.1, height: px * 0.1, borderRadius: "50%", background: "#B9AEA1", animation: "takoDictDot 1s ease-in-out .32s infinite" } }),
          )
        : state === "rec"
          ? React.createElement("span", { style: { width: px * 0.32, height: px * 0.32, borderRadius: px * 0.08, background: "#fff" } })
          : React.createElement("svg", { width: px * 0.5, height: px * 0.5, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
              React.createElement("rect", { x: 9, y: 2, width: 6, height: 12, rx: 3 }),
              React.createElement("path", { d: "M5 10v1a7 7 0 0 0 14 0v-1" }),
              React.createElement("line", { x1: 12, y1: 18, x2: 12, y2: 22 }),
            )
    );
  }

  // keyframes (una volta sola): pulse dell'anello rosso + rimbalzo dei dot shimmer
  if (!document.getElementById("tako-dict-style")) {
    const st = document.createElement("style");
    st.id = "tako-dict-style";
    st.textContent =
      "@keyframes takoDictPulse{0%,100%{box-shadow:0 0 0 0 rgba(229,72,77,.45)}50%{box-shadow:0 0 0 10px rgba(229,72,77,0)}}" +
      "@keyframes takoDictDot{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-30%);opacity:1}}";
    document.head.appendChild(st);
  }

  window.TakoBrowserDictationRecorder = TakoBrowserDictationRecorder;
  window.DictationButton = DictationButton;
  window.TakoDictationWave = TakoDictationWave;
})();
