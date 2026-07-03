/* ═══════════════════════ Tako — DETTATURA VOCALE (push-to-talk) ═══════════════
   MVP batch: premi (Cmd+K o click sul mic) → parli → ripremi → il segmento va
   al server via socket.io '/dictation' → ASR dual-mode (mlx locale ⇄ Groq
   cloud) → cleanup LLM (Ollama ⇄ Groq) → testo pulito nel campo del copilot.

   Pipeline client volutamente minimale (lo streaming è fase 2):
     mic (getUserMedia, mono, NS/AGC nativi)
       → AudioWorklet 'tako-capture' (frame Float32 @ sample-rate nativo)
         [fallback ScriptProcessor se il worklet non carica]
       → accumulo in RAM → allo stop: downsample 16 kHz + PCM16 → 'finalize'

   Espone:
     window.TakoDictationRecorder  — classe riusabile (start/stop/cancel)
     window.DictationButton        — bottone React autonomo (stati: idle/rec/busy)
     window.takoDictationToggle()  — registrata dal bottone montato (per Cmd+K)
   ─────────────────────────────────────────────────────────────────────────── */
(function () {
  const WORKLET_URL = "/staff/vendor/dictation-worklet.js";
  const TARGET_SR = 16000;
  const MAX_RECORD_MS = 90_000;    // auto-stop di sicurezza
  const RESULT_TIMEOUT_MS = 120_000;

  /* ── Recorder: cattura → PCM16 16k → socket → risultato ─────────────────── */
  class TakoDictationRecorder {
    constructor() {
      this.socket = null;
      this.stream = null;
      this.ctx = null;
      this.node = null;
      this.source = null;
      this.chunks = [];            // Float32Array @ ctx.sampleRate
      this.recording = false;
      this.status = null;          // {local, cloud, engine} dal server
      this._autoStop = null;
    }

    _ensureSocket() {
      if (this.socket) return this.socket;
      this.socket = window.io("/dictation", { withCredentials: true, transports: ["websocket", "polling"] });
      this.socket.on("ready", (s) => { this.status = s; });
      this.socket.on("disconnect", () => { this.status = null; });  // ri-attende ready dopo reconnect
      return this.socket;
    }

    // Il server attacca il listener 'finalize' solo DOPO l'auth (evento 'ready'):
    // emettere prima = evento perso. Attendiamo 'ready' (max 8s) prima di inviare.
    _waitReady(socket) {
      if (this.status) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => { cleanup(); reject(new Error("Server dettatura non pronto (login scaduto?).")); }, 8000);
        const onReady = () => { cleanup(); resolve(); };
        const onErr = (e) => { cleanup(); reject(new Error((e && e.message) || "Errore dettatura")); };
        const cleanup = () => { clearTimeout(t); socket.off("ready", onReady); socket.off("asr:error", onErr); };
        socket.on("ready", onReady);
        socket.on("asr:error", onErr);
      });
    }

    async start() {
      if (this.recording) return;
      this._ensureSocket();
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const AC = window.AudioContext || window.webkitAudioContext;
      try { this.ctx = new AC({ sampleRate: 48000 }); } catch (_) { this.ctx = new AC(); }
      if (this.ctx.state === "suspended") { try { await this.ctx.resume(); } catch (_) {} }
      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.chunks = [];

      let usedWorklet = false;
      try {
        await this.ctx.audioWorklet.addModule(WORKLET_URL);
        this.node = new AudioWorkletNode(this.ctx, "tako-capture");
        this.node.port.onmessage = (e) => { if (this.recording) this.chunks.push(e.data); };
        this.source.connect(this.node);
        usedWorklet = true;
      } catch (_) { usedWorklet = false; }
      if (!usedWorklet) {
        // Fallback: ScriptProcessor (deprecato ma ovunque disponibile)
        this.node = this.ctx.createScriptProcessor(2048, 1, 1);
        this.node.onaudioprocess = (e) => {
          if (this.recording) this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        };
        this.source.connect(this.node);
        this.node.connect(this.ctx.destination); // richiesto da alcuni browser
      }

      this.recording = true;
      this._autoStop = setTimeout(() => { this.stop().catch(() => {}); }, MAX_RECORD_MS);
    }

    _teardownAudio() {
      clearTimeout(this._autoStop);
      try { this.source && this.source.disconnect(); } catch (_) {}
      try { this.node && this.node.disconnect(); } catch (_) {}
      try { this.stream && this.stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
      try { this.ctx && this.ctx.close(); } catch (_) {}
      this.source = this.node = this.stream = this.ctx = null;
    }

    cancel() {
      this.recording = false;
      this._teardownAudio();
      this.chunks = [];
    }

    /** Ferma la registrazione e trascrive. Risolve {text, raw, asrEngine, ...}. */
    async stop() {
      if (!this.recording) throw new Error("Nessuna registrazione in corso.");
      this.recording = false;
      const srcRate = this.ctx ? this.ctx.sampleRate : 48000;
      this._teardownAudio();

      const total = this.chunks.reduce((n, c) => n + c.length, 0);
      const all = new Float32Array(total);
      let off = 0;
      for (const c of this.chunks) { all.set(c, off); off += c.length; }
      this.chunks = [];
      if (total === 0) throw new Error("Nessun audio registrato.");

      const pcm = downsampleToPcm16(all, srcRate, TARGET_SR);
      const socket = this._ensureSocket();
      await this._waitReady(socket);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanupHandlers();
          reject(new Error("Timeout trascrizione."));
        }, RESULT_TIMEOUT_MS);
        const onResult = (r) => { cleanupHandlers(); resolve(r); };
        const onError = (e) => { cleanupHandlers(); reject(new Error((e && e.message) || "Errore trascrizione")); };
        const cleanupHandlers = () => {
          clearTimeout(timer);
          socket.off("result", onResult);
          socket.off("asr:error", onError);
        };
        socket.on("result", onResult);
        socket.on("asr:error", onError);
        socket.emit("finalize", { pcm: pcm.buffer, sampleRate: TARGET_SR });
      });
    }
  }

  function downsampleToPcm16(f32, fromRate, toRate) {
    let mono = f32;
    if (fromRate !== toRate) {
      const nOut = Math.round(f32.length * toRate / fromRate);
      mono = new Float32Array(nOut);
      const ratio = (f32.length - 1) / Math.max(1, nOut - 1);
      for (let i = 0; i < nOut; i++) {
        const x = i * ratio, i0 = Math.floor(x), i1 = Math.min(f32.length - 1, i0 + 1), t = x - i0;
        mono[i] = f32[i0] * (1 - t) + f32[i1] * t;
      }
    }
    const out = new Int16Array(mono.length);
    for (let i = 0; i < mono.length; i++) {
      const s = Math.max(-1, Math.min(1, mono[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out;
  }

  /* ── Bottone mic autonomo (React) ────────────────────────────────────────── */
  // Stati: idle → rec (pulsante rosso) → busy (trascrizione) → idle.
  // Registra window.takoDictationToggle mentre è montato (usata da Cmd+K).
  function DictationButton({ onText, onStateChange, size }) {
    const { useState, useRef, useEffect } = React;
    const [state, setState] = useState("idle"); // idle | rec | busy
    const recRef = useRef(null);
    const px = size || 44;

    const set = (s) => { setState(s); onStateChange && onStateChange(s); };

    const toggle = async () => {
      if (!recRef.current) recRef.current = new TakoDictationRecorder();
      const rec = recRef.current;
      if (state === "busy") return;
      if (state === "idle") {
        try { await rec.start(); set("rec"); }
        catch (e) {
          const denied = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
          window.toast && window.toast(denied
            ? "Microfono negato. Consenti il microfono a Tako nelle impostazioni di sistema."
            : "Impossibile avviare il microfono: " + (e.message || e.name), "error");
        }
        return;
      }
      // state === "rec" → stop & trascrivi
      set("busy");
      try {
        const r = await rec.stop();
        if (r && r.text) onText && onText(r.text, r);
        else window.toast && window.toast("Non ho sentito nulla: riprova parlando più vicino al microfono.", "error");
      } catch (e) {
        window.toast && window.toast("Dettatura fallita: " + (e.message || e), "error");
      } finally {
        set("idle");
      }
    };

    useEffect(() => {
      window.takoDictationToggle = toggle;
      return () => {
        if (window.takoDictationToggle === toggle) delete window.takoDictationToggle;
        // smonta a metà registrazione → libera il mic
        if (recRef.current && recRef.current.recording) recRef.current.cancel();
      };
    });

    const bg = state === "rec" ? "#E5484D" : state === "busy" ? "#F5D90A" : "var(--surface2,#F4EFE8)";
    const fg = state === "rec" ? "#fff" : "#2A1F1A";
    return React.createElement("button", {
      onClick: toggle,
      title: state === "rec" ? "Ferma e trascrivi (Cmd+K)" : "Detta (Cmd+K)",
      "aria-label": "Dettatura vocale",
      style: {
        width: px, height: px, minWidth: px, borderRadius: "50%", border: "1px solid var(--hairline,#E5DDD3)",
        background: bg, color: fg, cursor: state === "busy" ? "wait" : "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        animation: state === "rec" ? "takoDictPulse 1.2s ease-in-out infinite" : "none",
        transition: "background .15s",
      },
    },
      state === "busy"
        ? React.createElement("span", { style: { fontSize: px * 0.42 } }, "…")
        : React.createElement("svg", { width: px * 0.5, height: px * 0.5, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
            React.createElement("rect", { x: 9, y: 2, width: 6, height: 12, rx: 3 }),
            React.createElement("path", { d: "M5 10v1a7 7 0 0 0 14 0v-1" }),
            React.createElement("line", { x1: 12, y1: 18, x2: 12, y2: 22 }),
          )
    );
  }

  // keyframes del pulse (una volta sola)
  if (!document.getElementById("tako-dict-style")) {
    const st = document.createElement("style");
    st.id = "tako-dict-style";
    st.textContent = "@keyframes takoDictPulse{0%,100%{box-shadow:0 0 0 0 rgba(229,72,77,.45)}50%{box-shadow:0 0 0 10px rgba(229,72,77,0)}}";
    document.head.appendChild(st);
  }

  window.TakoDictationRecorder = TakoDictationRecorder;
  window.DictationButton = DictationButton;
})();
