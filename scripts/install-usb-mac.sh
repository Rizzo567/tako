#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Installazione Tako da CHIAVETTA su un Mac cliente — SENZA Apple Developer.
# Copia il .app in /Applications, toglie la quarantena (sblocca Gatekeeper) e
# applica una firma AD-HOC gratuita (apertura pulita + auto-update liscio).
#
# Uso (sul Mac del cliente, chiavetta inserita):
#   sh /Volumes/NOME_CHIAVETTA/install-usb-mac.sh
# oppure, se lanci dalla cartella della chiavetta:
#   sh install-usb-mac.sh
#
# Cerca Tako.app: 1) accanto a questo script  2) nella root della chiavetta.
# ─────────────────────────────────────────────────────────────────────────────
set -e

HERE="$(cd "$(dirname "$0")" && pwd)"
INSTALLED="/Applications/Tako.app"

# Trova il sorgente Tako.app
SRC=""
if [ -d "$HERE/Tako.app" ]; then
  SRC="$HERE/Tako.app"
else
  # primo Tako.app trovato tra i volumi montati
  for v in /Volumes/*/Tako.app; do [ -d "$v" ] && SRC="$v" && break; done
fi

if [ -z "$SRC" ] || [ ! -d "$SRC" ]; then
  echo "✗ Tako.app non trovato (accanto allo script o sulla chiavetta)."
  echo "  Metti Tako.app nella stessa cartella di questo script e riprova."
  exit 1
fi

echo "▶ sorgente: $SRC"
echo "▶ chiudo Tako se aperto"
osascript -e 'quit app "Tako"' 2>/dev/null || true
sleep 1

echo "▶ copio in /Applications (in place, no doppioni)"
rsync -a --delete "$SRC/" "$INSTALLED/"

echo "▶ tolgo la quarantena (sblocca Gatekeeper)"
xattr -dr com.apple.quarantine "$INSTALLED" 2>/dev/null || true

echo "▶ firma ad-hoc gratuita (apertura pulita + relaunch updater)"
codesign --force --deep --sign - "$INSTALLED" 2>/dev/null || \
  echo "  (firma ad-hoc saltata: non critica, l'app apre lo stesso)"

echo "▶ verifico che il sistema la accetti"
spctl --add "$INSTALLED" 2>/dev/null || true

echo "▶ avvio Tako"
open "$INSTALLED"

echo "✓ Tako installato e avviato su questo Mac."
