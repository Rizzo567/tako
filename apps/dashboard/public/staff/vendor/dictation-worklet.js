// AudioWorklet per la dettatura Tako. Gira nel thread audio: riceve i quanti da
// 128 campioni, li accumula in frame da 1024 (mono, Float32 @ sample-rate nativo)
// e li invia al thread principale, che fa resampling a 16 kHz + VAD + invio.
// Tenere il worklet minimale: nessun calcolo pesante qui.
class TakoCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Float32Array(1024);
    this._n = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const ch = input[0]; // canale 0 (mono)
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this._buf[this._n++] = ch[i];
      if (this._n === this._buf.length) {
        // Copia trasferibile: evita GC churn nel thread audio.
        const out = this._buf.slice(0);
        this.port.postMessage(out, [out.buffer]);
        this._n = 0;
      }
    }
    return true;
  }
}
registerProcessor('tako-capture', TakoCaptureProcessor);
