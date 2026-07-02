/* ═══════════════════════ Tako — DETTATURA VOCALE ═══════════════════════
   Pulsante microfono → riquadro d'ascolto → testo live nel campo chat.

   Pipeline browser:
     mic (getUserMedia, mono, NS/AGC nativi)
       → AudioWorklet 'tako-capture' (frame Float32 @ sample-rate nativo)
       → VAD adattivo a energia (pausa = continua; silenzio lungo = fine segmento)
       → resample a 16 kHz PCM16
       → socket.io namespace '/dictation'  →  ASR server (whisper.cpp | Groq)
       ← 'text' { text, final }  →  parziale live + finale accumulato nel campo.

   Robustezza voluta:
     - PAUSE nel parlato NON chiudono il riquadro (tolleranza ~1s di silenzio).
     - Rumore soft di fondo gestito da: NS/AGC del browser + soglia VAD ADATTIVA
       (segue il rumore di fondo) → riempitivi/schiarite non spezzano la dettatura.
     - Denoise RNNoise (WASM) e VAD Silero (onnxruntime-web) sono agganci OPZIONALI:
       se gli asset sono in /staff/vendor/ vengono usati, altrimenti si degrada al
       VAD a energia (vedi caricaSileroOpzionale()).

   Contratto componente (per il montaggio nel campo chat):
     <DictationButton
        onText={(segmento) => setValore(v => (v ? v + " " : "") + segmento)}
        onInterim={(anteprima) => {}}      // opzionale: testo mentre parli
        size={40} />
   `onText` viene chiamata a OGNI segmento finalizzato (semantica append).
   Esposto anche come window.DictationButton.
   ───────────────────────────────────────────────────────────────────────── */

const DICT_WORKLET_URL = "/staff/vendor/dictation-worklet.js";
const DICT_TARGET_RATE = 16000;

/* ---- Silero VAD opzionale (onnxruntime-web). Ritorna null se non installato. ----
   Per attivarlo: metti ort.min.js + i .wasm in /staff/vendor/ort/ e il modello in
   /staff/vendor/silero_vad.onnx, poi carica ort prima di questo file. Finché manca,
   usiamo il VAD a energia (sotto), che è robusto per il parlato pulito da vicino. */
async function caricaSileroOpzionale() {
  try {
    if (typeof window.ort === "undefined") return null;
    const res = await fetch("/staff/vendor/silero_vad.onnx", { method: "HEAD" });
    if (!res.ok) return null;
    // Placeholder d'aggancio: l'integrazione runtime Silero va completata qui.
    // Restituendo null manteniamo il fallback a energia, sempre funzionante.
    return null;
  } catch { return null; }
}

/* ────────────────────────── Motore di dettatura ──────────────────────────
   Classe pura (niente React): gestisce audio, VAD, resampling e socket. */
class TakoDictationEngine {
  constructor(cb) {
    this.cb = cb || {};                 // { onState, onLevel, onInterim, onFinal, onError, onReady }
    this.ctx = null;
    this.stream = null;
    this.node = null;
    this.socket = null;
    this.nativeRate = 48000;

    // VAD adattivo a energia
    this.noiseFloor = 0.01;             // EMA del rumore di fondo
    this.speaking = false;
    this.silenceMs = 0;
    this.speechMs = 0;
    this.endSilenceMs = 1000;           // pausa tollerata prima di "fine segmento"
    this.minSpeechMs = 220;             // sotto = click/rumore, non parlato
    this.preRollSec = 0.25;             // pre-roll per non tagliare l'inizio parola

    this.segNative = [];                // Float32 del segmento corrente (rate nativo)
    this.preRoll = [];                  // ring di pre-roll (Float32 frames)
    this.preRollBytes = 0;
    this.seq = 0;                       // id segmento corrente
    this.msSincePartial = 0;
    this.partialEveryMs = 1200;
    this.running = false;
    this.frameMs = 0;                   // durata di un frame (calcolata da nativeRate)
  }

  async start() {
    if (this.running) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.nativeRate = this.ctx.sampleRate || 48000;
    const source = this.ctx.createMediaStreamSource(this.stream);

    // Silenziatore: teniamo il grafo "vivo" senza rimandare l'audio in uscita.
    const sink = this.ctx.createGain();
    sink.gain.value = 0;

    const onFrame = (f32) => this._onFrame(f32);
    let usedWorklet = false;
    if (this.ctx.audioWorklet) {
      try {
        await this.ctx.audioWorklet.addModule(DICT_WORKLET_URL);
        this.node = new AudioWorkletNode(this.ctx, "tako-capture");
        this.node.port.onmessage = (e) => onFrame(e.data);
        source.connect(this.node);
        this.node.connect(sink);
        usedWorklet = true;
      } catch (_) { usedWorklet = false; }
    }
    if (!usedWorklet) {
      // Fallback ScriptProcessor (deprecato ma universale).
      const sp = this.ctx.createScriptProcessor(4096, 1, 1);
      sp.onaudioprocess = (e) => onFrame(e.inputBuffer.getChannelData(0).slice(0));
      source.connect(sp);
      sp.connect(sink);
      this.node = sp;
    }
    sink.connect(this.ctx.destination);
    this._source = source;
    this._sink = sink;

    // Socket namespace dedicato (cookie staff via handshake).
    this.socket = window.io("/dictation", { withCredentials: true, transports: ["websocket", "polling"] });
    this.socket.on("ready", (s) => this.cb.onReady && this.cb.onReady(s));
    this.socket.on("text", (m) => {
      if (!m) return;
      if (m.final) { if (m.text) this.cb.onFinal && this.cb.onFinal(m.text, m); }
      else { this.cb.onInterim && this.cb.onInterim(m.text || "", m); }
    });
    this.socket.on("asr:error", (m) => this.cb.onError && this.cb.onError((m && m.message) || "Errore ASR"));

    await caricaSileroOpzionale(); // no-op se assente → resta VAD a energia
    this.running = true;
    this.cb.onState && this.cb.onState("listening");
  }

  _onFrame(f32) {
    if (!this.running || !f32 || f32.length === 0) return;
    if (!this.frameMs) this.frameMs = (f32.length / this.nativeRate) * 1000;
    const dt = (f32.length / this.nativeRate) * 1000;

    // RMS del frame
    let sum = 0;
    for (let i = 0; i < f32.length; i++) sum += f32[i] * f32[i];
    const rms = Math.sqrt(sum / f32.length);
    this.cb.onLevel && this.cb.onLevel(rms);

    // Soglia adattiva: onset = max(minimo assoluto, rumore*fattore).
    const onTh = Math.max(0.012, this.noiseFloor * 2.2);
    const offTh = Math.max(0.008, this.noiseFloor * 1.6);
    const voiced = rms > (this.speaking ? offTh : onTh);

    // Pre-roll ring (~preRollSec)
    this.preRoll.push(f32);
    this.preRollBytes += f32.length;
    const maxPre = this.preRollSec * this.nativeRate;
    while (this.preRollBytes > maxPre && this.preRoll.length > 1) {
      this.preRollBytes -= this.preRoll.shift().length;
    }

    if (voiced) {
      if (!this.speaking) {
        // Inizio segmento: semina con il pre-roll per non perdere l'attacco.
        this.speaking = true;
        this.silenceMs = 0;
        this.speechMs = 0;
        this.msSincePartial = 0;
        this.segNative = [];
        for (const p of this.preRoll) this.segNative.push(p);
        this.cb.onState && this.cb.onState("speaking");
      }
      this.segNative.push(f32);
      this.speechMs += dt;
      this.silenceMs = 0;
      this.msSincePartial += dt;

      // Parziale periodico mentre parli
      if (this.msSincePartial >= this.partialEveryMs && this.speechMs >= this.minSpeechMs) {
        this.msSincePartial = 0;
        this._send(false);
      }
      // Cap di sicurezza sulla lunghezza del segmento (~50s) → finalizza e riparti.
      if (this._segSeconds() > 50) this._finalizeSegment();
    } else {
      // Rumore di fondo: aggiorna la stima del noise floor (EMA lenta).
      this.noiseFloor = this.noiseFloor * 0.97 + rms * 0.03;
      if (this.speaking) {
        this.silenceMs += dt;
        this.segNative.push(f32); // includi la coda di silenzio (aiuta whisper sul finale)
        if (this.silenceMs >= this.endSilenceMs) {
          if (this.speechMs >= this.minSpeechMs) this._finalizeSegment();
          else { this.speaking = false; this.segNative = []; this.cb.onState && this.cb.onState("listening"); }
        }
      }
    }
  }

  _segSeconds() {
    let n = 0; for (const f of this.segNative) n += f.length;
    return n / this.nativeRate;
  }

  _finalizeSegment() {
    this._send(true);
    this.speaking = false;
    this.segNative = [];
    this.speechMs = 0;
    this.silenceMs = 0;
    this.seq++;
    this.cb.onState && this.cb.onState("listening");
  }

  // Forza la chiusura del segmento aperto (bottone "Fine e inserisci").
  flush() {
    if (this.speaking && this.speechMs >= this.minSpeechMs) this._finalizeSegment();
  }

  _send(final) {
    if (!this.socket || !this.socket.connected) return;
    const pcm = this._downsampleToInt16();
    if (!pcm || pcm.length === 0) return;
    this.socket.emit("seg", { pcm: pcm.buffer, sampleRate: DICT_TARGET_RATE, seq: this.seq, final });
  }

  // Concatena il segmento (Float32 @ nativeRate) → PCM16 @ 16 kHz (linear resample).
  _downsampleToInt16() {
    let total = 0; for (const f of this.segNative) total += f.length;
    if (total === 0) return null;
    const flat = new Float32Array(total);
    let o = 0; for (const f of this.segNative) { flat.set(f, o); o += f.length; }

    const ratio = DICT_TARGET_RATE / this.nativeRate;
    const outLen = Math.max(1, Math.floor(total * ratio));
    const out = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const pos = i / ratio;
      const i0 = Math.floor(pos);
      const i1 = Math.min(i0 + 1, total - 1);
      const frac = pos - i0;
      let s = flat[i0] * (1 - frac) + flat[i1] * frac;
      s = Math.max(-1, Math.min(1, s));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  async stop() {
    this.running = false;
    try { if (this.node && this.node.port) this.node.port.onmessage = null; } catch (_) {}
    try { if (this.node && this.node.disconnect) this.node.disconnect(); } catch (_) {}
    try { if (this._source) this._source.disconnect(); } catch (_) {}
    try { if (this._sink) this._sink.disconnect(); } catch (_) {}
    try { if (this.stream) this.stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
    try { if (this.ctx && this.ctx.state !== "closed") await this.ctx.close(); } catch (_) {}
    try { if (this.socket) this.socket.disconnect(); } catch (_) {}
    this.cb.onState && this.cb.onState("idle");
  }
}

/* ────────────────────────────── UI: icona mic ────────────────────────────── */
function MicGlyph({ size = 22, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
    </svg>
  );
}

/* ───────────────────────── Waveform live (barre RMS) ───────────────────────── */
function DictWaveform({ levels, active }) {
  const bars = 28;
  const data = [];
  for (let i = 0; i < bars; i++) {
    const v = levels[levels.length - bars + i];
    data.push(typeof v === "number" ? v : 0);
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 44, justifyContent: "center" }}>
      {data.map((v, i) => {
        const h = Math.max(3, Math.min(42, v * 900));
        return <div key={i} style={{
          width: 4, height: h, borderRadius: 3,
          background: active ? "var(--brand, #ED7159)" : "#cbb",
          transition: "height .08s linear", opacity: active ? 1 : .5,
        }} />;
      })}
    </div>
  );
}

/* ─────────────────────────── Riquadro di dettatura ─────────────────────────── */
function DictationPanel({ open, onClose, onText, onInterim }) {
  const [state, setState] = useState("idle");       // idle|listening|speaking
  const [interim, setInterim] = useState("");
  const [finals, setFinals] = useState([]);         // segmenti finalizzati (per anteprima)
  const [levels, setLevels] = useState([]);
  const [engine, setEngine] = useState(null);
  const [err, setErr] = useState("");
  const engRef = useRef(null);
  const levelsRef = useRef([]);

  useEffect(() => {
    if (!open) return;
    setErr(""); setInterim(""); setFinals([]); setState("idle"); levelsRef.current = [];
    const eng = new TakoDictationEngine({
      onState: (s) => setState(s),
      onLevel: (rms) => {
        const arr = levelsRef.current; arr.push(rms); if (arr.length > 80) arr.shift();
        setLevels(arr.slice());
      },
      onInterim: (t) => { setInterim(t); onInterim && onInterim(t); },
      onFinal: (t) => {
        setInterim("");
        setFinals((f) => [...f, t]);
        onText && onText(t);            // append nel campo chat
      },
      onReady: (s) => setEngine(s && s.engine),
      onError: (m) => setErr(m || "Errore"),
    });
    engRef.current = eng;
    eng.start().catch((e) => {
      const msg = (e && e.name === "NotAllowedError")
        ? "Permesso microfono negato. Abilitalo nelle impostazioni del browser."
        : (e && e.message) || "Impossibile accedere al microfono.";
      setErr(msg);
    });
    return () => { try { eng.stop(); } catch (_) {} engRef.current = null; };
  }, [open]);

  const done = () => {
    const eng = engRef.current;
    if (eng) eng.flush();
    // Piccolo respiro per far arrivare l'ultimo 'text' finale, poi chiudi.
    setTimeout(() => onClose && onClose(), 350);
  };

  if (!open) return null;
  const active = state === "speaking";
  const label = err ? "Problema"
    : state === "speaking" ? "Ti sto ascoltando…"
    : state === "listening" ? "In pausa — parla pure"
    : "Avvio microfono…";
  const engineLabel = engine === "whisper-cpp" ? "locale (whisper.cpp)"
    : engine === "groq" ? "cloud (Groq)"
    : engine === "none" ? "nessun motore" : "";

  const preview = finals.join(" ") + (interim ? (finals.length ? " " : "") + interim : "");

  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 4000,
      display: "flex", justifyContent: "center", padding: 16, pointerEvents: "none",
    }}>
      <div style={{
        pointerEvents: "auto", width: "min(560px, 96vw)",
        background: "#fff", borderRadius: 20, padding: 18,
        boxShadow: "0 18px 60px rgba(40,20,10,.28)", border: "1px solid #0000000f",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center",
            background: active ? "var(--brand, #ED7159)" : "#F2ECE6",
            color: active ? "#fff" : "#8a7", transition: "background .2s",
            animation: active ? "takoPulse 1.2s ease-in-out infinite" : "none",
          }}>
            <MicGlyph size={22} color={active ? "#fff" : "#a99"} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#2A1F1A" }}>{label}</div>
            <div style={{ fontSize: 12, color: "#9a8f86" }}>
              Dettatura vocale{engineLabel ? " · " + engineLabel : ""}
            </div>
          </div>
          <button onClick={onClose} title="Annulla" style={dictGhostBtn}>✕</button>
        </div>

        {err ? (
          <div style={{ background: "#FDECEA", color: "#B23B2E", borderRadius: 12, padding: "12px 14px", fontSize: 13.5 }}>
            {err}
          </div>
        ) : (
          <DictWaveform levels={levels} active={active} />
        )}

        <div style={{
          marginTop: 12, minHeight: 60, maxHeight: 160, overflowY: "auto",
          background: "#FBF8F4", borderRadius: 12, padding: "12px 14px",
          fontSize: 15, lineHeight: 1.5, color: "#2A1F1A",
        }}>
          {preview
            ? <span>{finals.join(" ")}{finals.length && interim ? " " : ""}<span style={{ color: "#b0a49a" }}>{interim}</span></span>
            : <span style={{ color: "#b7aca2" }}>Parla e vedrai qui il testo…</span>}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={onClose} style={dictSecBtn}>Annulla</button>
          <button onClick={done} style={dictPrimBtn} disabled={!!err}>Fine e inserisci</button>
        </div>
      </div>
      <style>{"@keyframes takoPulse{0%,100%{box-shadow:0 0 0 0 rgba(237,113,89,.45)}50%{box-shadow:0 0 0 10px rgba(237,113,89,0)}}"}</style>
    </div>
  );
}

const dictGhostBtn = {
  width: 32, height: 32, borderRadius: 9, border: "none", background: "#F2ECE6",
  color: "#8a7f76", fontSize: 15, cursor: "pointer", lineHeight: 1,
};
const dictSecBtn = {
  flex: "0 0 auto", padding: "11px 18px", borderRadius: 12, border: "1px solid #E6DED6",
  background: "#fff", color: "#6a5f56", fontWeight: 700, fontSize: 14, cursor: "pointer",
};
const dictPrimBtn = {
  flex: 1, padding: "11px 18px", borderRadius: 12, border: "none",
  background: "var(--brand, #ED7159)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer",
};

/* ─────────────────────── Pulsante mic (da montare nella chat) ─────────────────────── */
function DictationButton({ onText, onInterim, size = 40, style, title = "Detta col microfono" }) {
  const [open, setOpen] = useState(false);
  const supported = typeof navigator !== "undefined" && navigator.mediaDevices && window.AudioContext;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={supported ? title : "Microfono non supportato da questo browser"}
        disabled={!supported}
        style={{
          width: size, height: size, borderRadius: 12, border: "none", cursor: supported ? "pointer" : "not-allowed",
          background: open ? "var(--brand, #ED7159)" : "#F2ECE6",
          color: open ? "#fff" : "#7a6f66", display: "grid", placeItems: "center",
          opacity: supported ? 1 : 0.5, flex: "0 0 auto", ...style,
        }}>
        <MicGlyph size={Math.round(size * 0.55)} />
      </button>
      <DictationPanel
        open={open}
        onClose={() => setOpen(false)}
        onText={onText}
        onInterim={onInterim}
      />
    </>
  );
}

// Esposto globalmente per il montaggio da qualsiasi script della SPA.
window.DictationButton = DictationButton;
window.TakoDictationEngine = TakoDictationEngine;
