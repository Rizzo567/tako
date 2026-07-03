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

    _clog(where, message) {
      try { this.socket && this.socket.emit("clientlog", { where, message: String(message) }); } catch (_) {}
    }

    _ensureSocket() {
      if (this.socket) return this.socket;
      this.socket = window.io("/dictation", { withCredentials: true, transports: ["websocket", "polling"] });
      this.socket.on("ready", (s) => { this.status = s; this._clog("socket", "ready engine=" + (s && s.engine)); });
      this.socket.on("disconnect", (r) => { this.status = null; this._clog("socket", "disconnect " + r); });
      this.socket.on("connect", () => { this._clog("socket", "connect id=" + this.socket.id); });
      this.socket.on("connect_error", (e) => { this._clog("socket", "connect_error " + (e && e.message)); });
      return this.socket;
    }

    // Il server attacca il listener 'finalize' solo DOPO l'auth (evento 'ready'):
    // emettere prima = evento perso. Attendiamo 'ready' (max 8s) prima di inviare.
    _waitReady(socket) {
      this._clog("waitReady", "enter status=" + (this.status ? "set" : "null") + " connected=" + socket.connected);
      if (this.status) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => { cleanup(); this._clog("waitReady", "TIMEOUT"); reject(new Error("Connessione al motore vocale non pronta.")); }, 8000);
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
      this._clog("stop", "frames=" + total + " pcmBytes=" + pcm.byteLength + " srcRate=" + srcRate);
      const socket = this._ensureSocket();
      await this._waitReady(socket);
      this._clog("stop", "emit finalize");
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
      const rec = new TakoDictationRecorder({
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
      window.takoDictationToggle = toggle;
      return () => {
        if (window.takoDictationToggle === toggle) delete window.takoDictationToggle;
        if (rec.recording) rec.cancel();
        try { rec.socket && rec.socket.close(); } catch (_) {}
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

  window.TakoDictationRecorder = TakoDictationRecorder;
  window.DictationButton = DictationButton;
  window.TakoDictationWave = TakoDictationWave;
})();
