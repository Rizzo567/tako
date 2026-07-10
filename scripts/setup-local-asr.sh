#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Setup del motore ASR locale di Tako (mlx-whisper su Apple Silicon).
# Idempotente. NON richiede Homebrew né cmake: usa uv (binario standalone).
#
#   1. installa uv se manca (~/.local/bin)
#   2. crea il venv Python 3.12 in ~/.tako/asr-venv
#   3. installa mlx-whisper
#   4. pre-scarica il modello whisper (default large-v3-turbo MLX)
#
# Uso:  sh scripts/setup-local-asr.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e
export PATH="$HOME/.local/bin:$PATH"
MODEL="${TAKO_MLX_MODEL:-mlx-community/whisper-large-v3-turbo}"
VENV="$HOME/.tako/asr-venv"

if ! command -v uv >/dev/null 2>&1; then
  echo "▶ installo uv (standalone, niente Homebrew)"
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi

if [ ! -x "$VENV/bin/python" ]; then
  echo "▶ creo venv Python 3.12 in $VENV"
  uv venv --python 3.12 "$VENV"
fi

echo "▶ installo mlx-whisper nel venv"
uv pip install --python "$VENV/bin/python" mlx-whisper

echo "▶ pre-scarico il modello $MODEL (una tantum, ~1.6 GB)"
"$VENV/bin/python" - <<PY
from huggingface_hub import snapshot_download
snapshot_download("$MODEL")
print("modello pronto")
PY

echo "✓ ASR locale pronto: $VENV + $MODEL"
