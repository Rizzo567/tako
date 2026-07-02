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
       VAD a energia (vedi caricaEnhancersOpzionali()).

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

/* ─────────── Asset opzionali di qualità (auto-scaricati in /staff/vendor/) ───────────
   - Silero VAD (onnxruntime-web + silero_vad.onnx): VAD neurale robusto a "ehm",
     schiarite di gola, pause. Sostituisce il VAD a energia quando presente.
   - RNNoise (WASM): denoise del parlato a 48 kHz, applicato prima del VAD/ASR.
   Se un asset manca, il pezzo relativo si degrada in silenzio (Silero → VAD a energia;
   RNNoise → nessun denoise). Nessun ESM: tutto caricato come <script> classico. */
const ORT_DIR       = "/staff/vendor/ort/";
const ORT_JS_URL    = ORT_DIR + "ort.min.js";
const SILERO_URL    = "/staff/vendor/silero_vad.onnx";
const RNNOISE_DIR   = "/staff/vendor/rnnoise/";
const RNNOISE_JS_URL = RNNOISE_DIR + "rnnoise.js";

/* Resampler lineare in streaming: mantiene fase e ultimo campione tra i blocchi
   così non introduce click ai bordi frame. Passthrough se in==out. */
class StreamResampler {
  constructor(inRate, outRate) {
    this.inRate = inRate; this.outRate = outRate;
    this.step = inRate / outRate;      // campioni input per campione output
    this.phase = 0;                    // coord estese: 0=ultimo prec., 1=inp[0] … n=inp[n-1]
    this.last = 0; this.hasLast = false;
  }
  process(inp) {
    if (this.inRate === this.outRate) return inp;
    const n = inp.length;
    if (n === 0) return new Float32Array(0);
    const get = (i) => i <= 0 ? (this.hasLast ? this.last : inp[0]) : (i - 1 < n ? inp[i - 1] : inp[n - 1]);
    const out = [];
    let t = this.phase;
    while (t <= n) { const i0 = Math.floor(t), fr = t - i0; out.push(get(i0) * (1 - fr) + get(i0 + 1) * fr); t += this.step; }
    this.phase = t - n;                // riporta l'avanzo al blocco successivo
    this.last = inp[n - 1]; this.hasLast = true;
    return Float32Array.from(out);
  }
}

/* Carica uno <script> classico una sola volta. Risolve true/false (mai throw). */
function loadScriptOnce(src) {
  return new Promise((resolve) => {
    try {
      const found = document.querySelector('script[data-tako-vendor="' + src + '"]');
      if (found) { if (found.dataset.loaded === "1") return resolve(true); found.addEventListener("load", () => resolve(true)); found.addEventListener("error", () => resolve(false)); return; }
      const s = document.createElement("script");
      s.src = src; s.async = true; s.dataset.takoVendor = src;
      s.onload = () => { s.dataset.loaded = "1"; resolve(true); };
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    } catch (_) { resolve(false); }
  });
}

let _ortPromise = null;
function _configOrt(ort) {
  try { ort.env.wasm.wasmPaths = ORT_DIR; ort.env.wasm.numThreads = 1; ort.env.wasm.simd = true; ort.env.logLevel = "error"; } catch (_) {}
}
async function loadOrtRuntime() {
  if (typeof window.ort !== "undefined") { _configOrt(window.ort); return window.ort; }
  if (!_ortPromise) _ortPromise = loadScriptOnce(ORT_JS_URL);
  const ok = await _ortPromise;
  if (!ok || typeof window.ort === "undefined") return null;
  _configOrt(window.ort);
  return window.ort;
}

/* Silero VAD (onnxruntime-web). Ritorna { process(win512)->prob, reset() } o null.
   Modello v5: input {input[1,N], state[2,1,128], sr scalar}, output {output, stateN}. */
async function loadSilero() {
  try {
    const ort = await loadOrtRuntime();
    if (!ort) return null;
    try { const head = await fetch(SILERO_URL, { method: "HEAD" }); if (!head.ok) return null; } catch (_) { return null; }
    const session = await ort.InferenceSession.create(SILERO_URL, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
    const inN = session.inputNames || ["input", "state", "sr"];
    const outN = session.outputNames || ["output", "stateN"];
    const inputName = inN.find((n) => /input/i.test(n)) || inN[0];
    const stateName = inN.find((n) => /state/i.test(n)) || "state";
    const srName = inN.find((n) => /^sr$/i.test(n)) || "sr";
    const probOut = outN.find((n) => /^output$/i.test(n)) || outN[0];
    const stateOut = outN.find((n) => /stateN|state/i.test(n)) || outN[outN.length - 1];
    const mkState = () => new ort.Tensor("float32", new Float32Array(2 * 1 * 128), [2, 1, 128]);
    let state = mkState();
    const sr = new ort.Tensor("int64", BigInt64Array.from([16000n]), []);
    const process = async (win) => {
      const feeds = {};
      feeds[inputName] = new ort.Tensor("float32", win, [1, win.length]);
      feeds[stateName] = state;
      feeds[srName] = sr;
      const r = await session.run(feeds);
      if (r[stateOut]) state = r[stateOut];
      return r[probOut].data[0];
    };
    await process(new Float32Array(512)); // warm-up: se fallisce → catch → null
    return { process, reset: () => { state = mkState(); } };
  } catch (_) { return null; }
}

/* RNNoise (WASM). Ritorna { FRAME:480, denoise(frame480@48k)->Float32, destroy() } o null.
   RNNoise lavora a 48 kHz, frame da 480, campioni in scala short (±32768). */
async function loadRNNoise() {
  try {
    if (typeof window.createRNNWasmModule === "undefined") {
      const ok = await loadScriptOnce(RNNOISE_JS_URL);
      if (!ok || typeof window.createRNNWasmModule === "undefined") return null;
    }
    const mod = await window.createRNNWasmModule({ locateFile: (p) => RNNOISE_DIR + p });
    const FRAME = 480;
    const st = mod._rnnoise_create(0);
    const inPtr = mod._malloc(FRAME * 4), outPtr = mod._malloc(FRAME * 4);
    const denoise = (frame) => {
      let h = mod.HEAPF32; const ib = inPtr >> 2;
      for (let i = 0; i < FRAME; i++) h[ib + i] = frame[i] * 32768;
      mod._rnnoise_process_frame(st, outPtr, inPtr);
      h = mod.HEAPF32; const ob = outPtr >> 2; // riacquisisci: la heap può crescere
      const out = new Float32Array(FRAME);
      for (let i = 0; i < FRAME; i++) out[i] = h[ob + i] / 32768;
      return out;
    };
    return { FRAME, denoise, destroy: () => { try { mod._rnnoise_destroy(st); mod._free(inPtr); mod._free(outPtr); } catch (_) {} } };
  } catch (_) { return null; }
}

/* Carica in parallelo i due enhancer opzionali. Nessun throw: campi null se assenti. */
async function caricaEnhancersOpzionali() {
  const [silero, rnnoise] = await Promise.all([
    loadSilero().catch(() => null),
    loadRNNoise().catch(() => null),
  ]);
  return { silero, rnnoise };
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

    // ── Percorso neurale (Silero VAD + RNNoise), attivo solo se gli asset caricano ──
    this.silero = null;                 // { process, reset } o null
    this.rnnoise = null;                // { FRAME, denoise, destroy } o null
    this.neural = false;                // true = usa Silero al posto del VAD a energia
    this.rs_to48 = null;                // resampler native → 48 kHz (per RNNoise)
    this.rs_48to16 = null;              // resampler 48 kHz → 16 kHz (post-denoise)
    this.rs_to16 = null;                // resampler native → 16 kHz (senza denoise)
    this.buf48 = []; this.buf48Len = 0; // accumulo campioni 48 kHz (framing RNNoise)
    this.buf16 = []; this.buf16Len = 0; // accumulo campioni 16 kHz (finestre Silero)
    this.seg16 = [];                    // segmento corrente: Float32 @16 kHz (denoised)
    this.preRoll16 = []; this.preRoll16Len = 0; // pre-roll @16 kHz anti-taglio
    this._pumping = false;              // guardia: una sola inferenza Silero alla volta
    this.windowMs = (512 / DICT_TARGET_RATE) * 1000;  // 32 ms per finestra Silero
    this.endSilenceMsNeural = 1200;     // silenzio continuo prima di "fine segmento"
    this.onProb = 0.5;                  // soglia voce (ingresso)
    this.offProb = 0.35;                // soglia voce (isteresi in parlato)
  }

  async start() {
    if (this.running) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const AC = window.AudioContext || window.webkitAudioContext;
    // Proviamo a fissare 48 kHz: così RNNoise non richiede resampling in ingresso.
    // Se il browser non onora l'opzione, usiamo il rate nativo (gestito dai resampler).
    try { this.ctx = new AC({ sampleRate: 48000 }); } catch (_) { this.ctx = new AC(); }
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

    // Enhancer opzionali: Silero VAD (neurale) + RNNoise (denoise). Se assenti,
    // restiamo sul VAD a energia — trasparente per l'utente (cambia solo la qualità).
    try {
      const enh = await caricaEnhancersOpzionali();
      this.silero = enh.silero || null;
      this.rnnoise = enh.rnnoise || null;
    } catch (_) { this.silero = null; this.rnnoise = null; }
    this.neural = !!this.silero;
    if (this.neural) {
      this.rs_to48 = new StreamResampler(this.nativeRate, 48000);
      this.rs_48to16 = new StreamResampler(48000, DICT_TARGET_RATE);
      this.rs_to16 = new StreamResampler(this.nativeRate, DICT_TARGET_RATE);
      this.cb.onState && this.cb.onState("listening");
    }

    this.running = true;
    this.cb.onState && this.cb.onState("listening");
  }

  _onFrame(f32) {
    if (!this.running || !f32 || f32.length === 0) return;
    if (this.neural) return this._onFrameNeural(f32);
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

  /* ──────────────────── Percorso neurale: RNNoise → Silero VAD ────────────────────
     mic(native) → [resample 48k → RNNoise denoise] → resample 16k → finestre 512
     → Silero (prob voce) → macchina a stati parlato/pausa/fine. Il segmento inviato
     a whisper è già denoised @16 kHz. Le micro-pause NON chiudono (endSilenceMsNeural). */
  _onFrameNeural(f32) {
    // Livello per la waveform (indipendente dal denoise: mostra il segnale reale)
    let sum = 0; for (let i = 0; i < f32.length; i++) sum += f32[i] * f32[i];
    this.cb.onLevel && this.cb.onLevel(Math.sqrt(sum / f32.length));

    if (this.rnnoise) {
      const x48 = this.rs_to48.process(f32);
      this.buf48.push(x48); this.buf48Len += x48.length;
      const F = this.rnnoise.FRAME;
      while (this.buf48Len >= F) {
        const frame = this._take(this.buf48, F); this.buf48Len -= F;
        const clean = this.rnnoise.denoise(frame);
        const y16 = this.rs_48to16.process(clean);
        this.buf16.push(y16); this.buf16Len += y16.length;
      }
    } else {
      const y16 = this.rs_to16.process(f32);
      this.buf16.push(y16); this.buf16Len += y16.length;
    }
    this._pumpNeural();
  }

  // Estrae n campioni dalla testa di una lista di Float32Array (senza aggiornare il contatore).
  _take(list, n) {
    const out = new Float32Array(n); let got = 0;
    while (got < n && list.length) {
      const head = list[0], need = n - got;
      if (head.length <= need) { out.set(head, got); got += head.length; list.shift(); }
      else { out.set(head.subarray(0, need), got); list[0] = head.subarray(need); got += need; }
    }
    return out;
  }

  // Drena le finestre da 512 e le passa a Silero in sequenza (mai inferenze sovrapposte).
  async _pumpNeural() {
    if (this._pumping) return;
    this._pumping = true;
    try {
      while (this.running && this.neural && this.buf16Len >= 512) {
        const win = this._take(this.buf16, 512); this.buf16Len -= 512;
        let prob;
        try { prob = await this.silero.process(win); }
        catch (_) { this._degradeToEnergy(); return; }   // Silero rotto a caldo → energia
        this._vadStepNeural(prob, win);
      }
    } finally { this._pumping = false; }
  }

  _vadStepNeural(prob, win) {
    const ms = this.windowMs;
    // Pre-roll ring (~preRollSec) con audio già denoised @16 kHz
    this.preRoll16.push(win); this.preRoll16Len += win.length;
    const maxPre = this.preRollSec * DICT_TARGET_RATE;
    while (this.preRoll16Len > maxPre && this.preRoll16.length > 1) this.preRoll16Len -= this.preRoll16.shift().length;

    const voiced = prob > (this.speaking ? this.offProb : this.onProb);
    if (voiced) {
      if (!this.speaking) {
        this.speaking = true; this.silenceMs = 0; this.speechMs = 0; this.msSincePartial = 0;
        this.seg16 = [];
        for (const p of this.preRoll16) this.seg16.push(p);  // semina con il pre-roll
        this.cb.onState && this.cb.onState("speaking");
      }
      this.seg16.push(win); this.speechMs += ms; this.silenceMs = 0; this.msSincePartial += ms;
      if (this.msSincePartial >= this.partialEveryMs && this.speechMs >= this.minSpeechMs) { this.msSincePartial = 0; this._sendNeural(false); }
      if (this._seg16Seconds() > 50) this._finalizeNeural();
    } else if (this.speaking) {
      this.silenceMs += ms;
      this.seg16.push(win);                    // includi la coda di silenzio (aiuta whisper)
      if (this.silenceMs >= this.endSilenceMsNeural) {
        if (this.speechMs >= this.minSpeechMs) this._finalizeNeural();
        else { this.speaking = false; this.seg16 = []; this.cb.onState && this.cb.onState("listening"); }
      }
    }
  }

  _seg16Seconds() { let n = 0; for (const f of this.seg16) n += f.length; return n / DICT_TARGET_RATE; }

  _finalizeNeural() {
    this._sendNeural(true);
    this.speaking = false; this.seg16 = []; this.speechMs = 0; this.silenceMs = 0; this.seq++;
    if (this.silero && this.silero.reset) this.silero.reset();   // stato Silero pulito per il prossimo
    this.cb.onState && this.cb.onState("listening");
  }

  _sendNeural(final) {
    if (!this.socket || !this.socket.connected) return;
    let total = 0; for (const f of this.seg16) total += f.length;
    if (total === 0) return;
    const out = new Int16Array(total); let o = 0;
    for (const f of this.seg16) for (let i = 0; i < f.length; i++) {
      let s = Math.max(-1, Math.min(1, f[i]));
      out[o++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this.socket.emit("seg", { pcm: out.buffer, sampleRate: DICT_TARGET_RATE, seq: this.seq, final });
  }

  // Se Silero fallisce a caldo: passa al VAD a energia senza interrompere la sessione.
  _degradeToEnergy() {
    this.neural = false;
    this.speaking = false; this.seg16 = []; this.segNative = [];
    this.buf16 = []; this.buf16Len = 0; this.buf48 = []; this.buf48Len = 0;
    this.silenceMs = 0; this.speechMs = 0; this.msSincePartial = 0;
    this.cb.onState && this.cb.onState("listening");
  }

  // Forza la chiusura del segmento aperto (bottone "Fine e inserisci").
  flush() {
    if (this.speaking && this.speechMs >= this.minSpeechMs) {
      if (this.neural) this._finalizeNeural(); else this._finalizeSegment();
    }
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
    this.neural = false;
    try { if (this.rnnoise && this.rnnoise.destroy) this.rnnoise.destroy(); } catch (_) {}
    this.rnnoise = null; this.silero = null;
    this.buf16 = []; this.buf16Len = 0; this.buf48 = []; this.buf48Len = 0; this.seg16 = []; this.preRoll16 = []; this.preRoll16Len = 0;
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
