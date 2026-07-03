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
  const MAX_RECORD_MS = 90_000;    // tetto di sicurezza
  const RESULT_TIMEOUT_MS = 120_000;
  // Endpointing stile Wispr Flow (hands-free): quando l'utente ha parlato e poi
  // resta in silenzio per SILENCE_STOP_MS, la dettatura si chiude da sola.
  const SILENCE_STOP_MS = 1500;
  const NO_SPEECH_TIMEOUT_MS = 8000; // mai parlato → annulla (mic muto/sbagliato)
  const SPEECH_RMS_MIN = 0.007;      // soglia assoluta minima di "voce"

  /* ── Recorder: cattura → PCM16 16k → socket → risultato ─────────────────── */
  class TakoDictationRecorder {
    constructor(opts) {
      opts = opts || {};
      this.socket = null;
      this.stream = null;
      this.ctx = null;
      this.node = null;
      this.source = null;
      this.chunks = [];            // Float32Array @ ctx.sampleRate
      this.recording = false;
      this.status = null;          // {local, cloud, engine} dal server
      this._autoStop = null;
      // Endpointing: rileva voce→silenzio e chiama onSpeechEnd (il chiamante
      // esegue lo stesso flusso dello stop manuale). Energia RMS con noise
      // floor adattivo: robusto a rumori di fondo costanti (frigo, sala).
      this.onSpeechEnd = opts.onSpeechEnd || null;
      this.onNoSpeech = opts.onNoSpeech || null;
      this._spokeAt = 0;           // ultimo frame con voce
      this._startedAt = 0;
      this._floor = 0.003;         // noise floor adattivo
      this._endTimer = null;
      this._level = 0;             // livello audio smussato 0..1 (per la waveform)
    }

    // Livello audio corrente 0..1 per la visualizzazione (waveform reattiva).
    getLevel() { return this._level; }

    // Un frame Float32 dal thread audio: accumula + endpointing + livello.
    _ingest(frame) {
      if (!this.recording) return;
      this.chunks.push(frame);
      let sum = 0;
      for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
      const rms = Math.sqrt(sum / frame.length);
      // Livello per la UI: gain + smoothing asimmetrico (attacco veloce, rilascio
      // lento) → barre vivaci che scattano sulla voce e scendono morbide.
      const target = Math.min(1, rms * 9);
      this._level = target > this._level ? this._level * 0.4 + target * 0.6 : this._level * 0.82 + target * 0.18;
      // floor: scende subito sui frame quieti, sale lentissimo (evita di
      // "imparare" la voce come rumore)
      this._floor = rms < this._floor ? rms : this._floor * 1.002;
      const speaking = rms > Math.max(this._floor * 3.5, SPEECH_RMS_MIN);
      const now = Date.now();
      if (speaking) this._spokeAt = now;
      else if (this._spokeAt && now - this._spokeAt > SILENCE_STOP_MS) {
        // voce c'è stata, poi silenzio prolungato → fine frase
        this._spokeAt = 0;
        this.onSpeechEnd && this.onSpeechEnd();
      } else if (!this._spokeAt && now - this._startedAt > NO_SPEECH_TIMEOUT_MS) {
        this._startedAt = now + 86400000; // non ri-triggerare
        this.onNoSpeech && this.onNoSpeech();
      }
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
        this.node.port.onmessage = (e) => this._ingest(e.data);
        this.source.connect(this.node);
        usedWorklet = true;
      } catch (_) { usedWorklet = false; }
      if (!usedWorklet) {
        // Fallback: ScriptProcessor (deprecato ma ovunque disponibile)
        this.node = this.ctx.createScriptProcessor(2048, 1, 1);
        this.node.onaudioprocess = (e) => this._ingest(new Float32Array(e.inputBuffer.getChannelData(0)));
        this.source.connect(this.node);
      }
      // CRITICO per WebKit/WKWebView: un nodo senza percorso verso destination
      // non viene "pullato" dal grafo → process()/onaudioprocess mai chiamati →
      // zero audio ("Dettatura fallita: nessun audio"). Colleghiamo via gain a 0:
      // il grafo renderizza, ma non si sente nulla (niente feedback dal mic).
      this._mute = this.ctx.createGain();
      this._mute.gain.value = 0;
      this.node.connect(this._mute);
      this._mute.connect(this.ctx.destination);

      this.recording = true;
      this._spokeAt = 0;
      this._startedAt = Date.now();
      this._floor = 0.003;
      this._level = 0;
      this._autoStop = setTimeout(() => { this.onSpeechEnd && this.onSpeechEnd(); }, MAX_RECORD_MS);

      // Watchdog frames: se dopo 2.5s non è arrivato NESSUN frame audio, il
      // grafo WebKit non sta renderizzando (context sospeso / worklet muto).
      // Diagnostica via clientlog + tentativo di recupero (resume + fallback
      // ScriptProcessor se era in uso il worklet).
      const self = this;
      this._watchdog = setTimeout(function () {
        if (!self.recording || self.chunks.length > 0) return;
        const st = self.ctx ? self.ctx.state : "no-ctx";
        try {
          self.socket && self.socket.emit("clientlog", {
            where: "watchdog", name: "NoFrames",
            message: "0 frame dopo 2.5s — ctx.state=" + st + " worklet=" + usedWorklet + " sr=" + (self.ctx && self.ctx.sampleRate),
          });
        } catch (_) {}
        if (self.ctx && self.ctx.state === "suspended") { try { self.ctx.resume(); } catch (_) {} }
        // ultimo tentativo: rimpiazza il worklet con ScriptProcessor
        if (usedWorklet && self.ctx && self.source) {
          try {
            self.node.disconnect();
            self.node = self.ctx.createScriptProcessor(2048, 1, 1);
            self.node.onaudioprocess = function (e) { self._ingest(new Float32Array(e.inputBuffer.getChannelData(0))); };
            self.source.connect(self.node);
            self.node.connect(self._mute);
          } catch (_) {}
        }
      }, 2500);
    }

    _teardownAudio() {
      clearTimeout(this._autoStop);
      clearTimeout(this._watchdog);
      try { this.source && this.source.disconnect(); } catch (_) {}
      try { this.node && this.node.disconnect(); } catch (_) {}
      try { this._mute && this._mute.disconnect(); } catch (_) {}
      try { this.stream && this.stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
      try { this.ctx && this.ctx.close(); } catch (_) {}
      this.source = this.node = this._mute = this.stream = this.ctx = null;
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
    if (/login scaduto|sessione staff/i.test(msg))
      return "Sessione scaduta: rientra e riprova la dettatura.";
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

  // Waveform reattiva: 5 barre le cui altezze seguono il livello audio (come la
  // tastiera iOS di Wispr Flow). Legge rec.getLevel() via requestAnimationFrame.
  const N_BARS = 5;
  function Waveform({ recRef, px }) {
    const { useRef, useEffect } = React;
    const barsRef = useRef([]);
    useEffect(() => {
      let raf = 0;
      const phases = [0.0, 1.1, 2.2, 3.3, 4.4]; // offset → onda che "respira"
      const tick = () => {
        const rec = recRef.current;
        const lvl = rec ? rec.getLevel() : 0;
        const t = Date.now() / 220;
        for (let i = 0; i < N_BARS; i++) {
          const el = barsRef.current[i];
          if (!el) continue;
          // barre centrali più alte; modulazione sinusoidale per vivacità
          const center = 1 - Math.abs(i - (N_BARS - 1) / 2) / N_BARS;
          const wob = 0.55 + 0.45 * Math.sin(t + phases[i]);
          const h = Math.max(0.14, Math.min(1, lvl * (0.6 + center) * wob + 0.12));
          el.style.transform = "scaleY(" + h.toFixed(3) + ")";
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, []);
    const bw = Math.max(2, px * 0.06);
    return React.createElement("div", {
      style: { display: "flex", alignItems: "center", justifyContent: "center", gap: bw * 0.7, height: px * 0.5 },
    }, Array.from({ length: N_BARS }, (_, i) =>
      React.createElement("span", {
        key: i,
        ref: (el) => { barsRef.current[i] = el; },
        style: { display: "block", width: bw, height: px * 0.5, borderRadius: bw, background: "#fff", transformOrigin: "center", transform: "scaleY(0.14)", transition: "transform .06s linear" },
      })
    ));
  }

  function DictationButton({ onText, onStateChange, size }) {
    const { useState, useRef, useEffect } = React;
    const [state, setState] = useState("idle"); // idle | rec | busy
    const recRef = useRef(null);
    const stateRef = useRef("idle");
    const px = size || 44;

    const set = (s) => { stateRef.current = s; setState(s); onStateChange && onStateChange(s); };

    // Stop + trascrizione: unico flusso per stop manuale (click/Cmd+K) e
    // auto-stop su silenzio (endpointing).
    const stopAndTranscribe = async () => {
      const rec = recRef.current;
      if (!rec || stateRef.current !== "rec") return;
      set("busy");
      try {
        const r = await rec.stop();
        if (r && r.text) onText && onText(r.text, r);
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
      if (!recRef.current) {
        recRef.current = new TakoDictationRecorder({
          onSpeechEnd: () => stopAndTranscribe(),          // silenzio → fine frase
          onNoSpeech: () => {                              // mai parlato → annulla
            const rec = recRef.current;
            if (rec && stateRef.current === "rec") {
              rec.cancel(); set("idle");
              window.toast && window.toast("Nessuna voce rilevata: microfono muto o troppo lontano.", "error");
            }
          },
        });
      }
      const rec = recRef.current;
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

    // Deps [] OBBLIGATORIE: senza, il cleanup gira a OGNI render e appena lo
    // stato passa a "rec" (re-render) cancella la registrazione appena partita
    // → "Dettatura fallita: Nessuna registrazione in corso." (bug trovato via
    // clientlog). Il toggle legge stateRef, quindi non soffre di stale state.
    useEffect(() => {
      window.takoDictationToggle = toggle;
      // Esposta SOLO durante la registrazione: il copilot usa la sua presenza
      // per decidere se Esc annulla la dettatura o chiude il pannello.
      return () => {
        if (window.takoDictationToggle === toggle) delete window.takoDictationToggle;
        if (recRef.current && recRef.current.recording) recRef.current.cancel();
      };
    }, []);

    useEffect(() => {
      if (state === "rec") window.takoDictationCancel = cancel;
      else if (window.takoDictationCancel === cancel) delete window.takoDictationCancel;
    }, [state]);

    const bg = state === "rec" ? "#E5484D" : state === "busy" ? "var(--surface2,#F4EFE8)" : "var(--surface2,#F4EFE8)";
    const fg = state === "rec" ? "#fff" : "#2A1F1A";
    const title = state === "rec" ? "Ferma e trascrivi · Esc per annullare"
      : state === "busy" ? "Trascrizione in corso…" : "Detta (Cmd+K)";
    return React.createElement("button", {
      onClick: toggle,
      title: title,
      "aria-label": "Dettatura vocale",
      "aria-busy": state === "busy",
      style: {
        width: px, height: px, minWidth: px, borderRadius: "50%", border: "1px solid var(--hairline,#E5DDD3)",
        background: bg, color: fg, cursor: state === "busy" ? "wait" : "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        animation: state === "rec" ? "takoDictPulse 1.2s ease-in-out infinite" : "none",
        transition: "background .15s",
      },
    },
      state === "rec"
        ? React.createElement(Waveform, { recRef, px })
        : state === "busy"
          ? React.createElement("span", { className: "tako-dict-shimmer", style: { display: "inline-flex", gap: px * 0.06 } },
              React.createElement("i", { style: { width: px * 0.1, height: px * 0.1, borderRadius: "50%", background: "#B9AEA1", animation: "takoDictDot 1s ease-in-out infinite" } }),
              React.createElement("i", { style: { width: px * 0.1, height: px * 0.1, borderRadius: "50%", background: "#B9AEA1", animation: "takoDictDot 1s ease-in-out .16s infinite" } }),
              React.createElement("i", { style: { width: px * 0.1, height: px * 0.1, borderRadius: "50%", background: "#B9AEA1", animation: "takoDictDot 1s ease-in-out .32s infinite" } }),
            )
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

  window.TakoDictationRecorder = TakoDictationRecorder;
  window.DictationButton = DictationButton;
})();
