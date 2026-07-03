#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# Worker ASR locale di Tako — daemon mlx-whisper su Apple Silicon.
#
# Protocollo JSONL su stdio (una riga = un messaggio):
#   stdin  ← {"id": str, "wav_b64": str, "language": "it"}
#   stdout → {"ready": true, "model": str}            (una volta, all'avvio)
#   stdout → {"id": str, "text": str, "ms": int}      (risposta)
#   stdout → {"id": str, "error": str}                (errore per-richiesta)
#
# Il modello resta caricato in memoria tra le richieste (il costo di load si
# paga una volta). L'audio arriva come WAV PCM16 mono: lo decodifichiamo con
# la stdlib (wave) e passiamo a mlx_whisper un array float32 — così NON serve
# ffmpeg (che sulla macchina non c'è).
#
# Lanciato da apps/server/src/lib/asr-local.ts con il python del venv
# ~/.tako/asr-venv (creato da scripts/setup-local-asr.sh).
# ─────────────────────────────────────────────────────────────────────────────
import base64
import io
import json
import os
import sys
import time
import wave

MODEL = os.environ.get("TAKO_MLX_MODEL", "mlx-community/whisper-large-v3-turbo")
TARGET_SR = 16000  # mlx_whisper si aspetta 16 kHz


def log(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def wav_to_float32(wav_bytes):
    """WAV PCM16 → (np.float32 mono -1..1, sample_rate). Solo stdlib + numpy."""
    import numpy as np

    with wave.open(io.BytesIO(wav_bytes), "rb") as w:
        sr = w.getframerate()
        ch = w.getnchannels()
        sw = w.getsampwidth()
        raw = w.readframes(w.getnframes())
    if sw != 2:
        raise ValueError(f"solo PCM16 supportato (sampwidth={sw})")
    audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if ch > 1:  # downmix a mono
        audio = audio.reshape(-1, ch).mean(axis=1)
    if sr != TARGET_SR:  # resample lineare (adeguato per il parlato)
        n_out = int(round(len(audio) * TARGET_SR / sr))
        x_old = np.linspace(0.0, 1.0, num=len(audio), endpoint=False)
        x_new = np.linspace(0.0, 1.0, num=n_out, endpoint=False)
        audio = np.interp(x_new, x_old, audio).astype(np.float32)
    return audio


def main():
    import numpy as np  # noqa: F401 — fallisce subito se il venv è rotto
    import mlx_whisper

    # Warm-up: mezzo secondo di silenzio. Scarica/carica il modello ADESSO,
    # così la prima dettatura vera non paga il cold start.
    silence = __import__("numpy").zeros(TARGET_SR // 2, dtype="float32")
    mlx_whisper.transcribe(silence, path_or_hf_repo=MODEL, language="it", fp16=True)
    log({"ready": True, "model": MODEL})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            wav = base64.b64decode(req["wav_b64"])
            language = req.get("language") or "it"
            audio = wav_to_float32(wav)
            started = time.time()
            result = mlx_whisper.transcribe(
                audio,
                path_or_hf_repo=MODEL,
                language=language,
                fp16=True,
                # niente timestamps: solo testo, più veloce
                word_timestamps=False,
            )
            text = (result.get("text") or "").strip()
            log({"id": req_id, "text": text, "ms": int((time.time() - started) * 1000)})
        except Exception as e:  # per-richiesta: il daemon resta vivo
            log({"id": req_id, "error": f"{type(e).__name__}: {e}"})


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # errore fatale (import/modello): esci con messaggio
        log({"fatal": f"{type(e).__name__}: {e}"})
        sys.exit(1)
