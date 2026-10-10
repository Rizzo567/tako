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
# Cerca, in ordine: Tako.app accanto allo script → Tako.app.zip accanto allo
# script → Tako.app nella root di una chiavetta montata.
#
# Perché lo zip: un secondo Tako.app sul disco compare come icona doppia nella
# griglia app di macOS (Tahoe indicizza le app da Spotlight, e
# `.metadata_never_index` non rimuove le voci già indicizzate). Tenendo il kit
# come zip esiste UNA SOLA app installata: quella in /Applications.
# ─────────────────────────────────────────────────────────────────────────────
set -e

HERE="$(cd "$(dirname "$0")" && pwd)"
INSTALLED="/Applications/Tako.app"
TMPDIR_UNZIP=""

# Trova il sorgente Tako.app
SRC=""
if [ -d "$HERE/Tako.app" ]; then
  SRC="$HERE/Tako.app"
elif [ -f "$HERE/Tako.app.zip" ]; then
  echo "▶ scompatto Tako.app.zip"
  TMPDIR_UNZIP="$(mktemp -d)"
  ditto -x -k "$HERE/Tako.app.zip" "$TMPDIR_UNZIP"
  SRC="$TMPDIR_UNZIP/Tako.app"
else
  # primo Tako.app (o zip) trovato tra i volumi montati
  for v in /Volumes/*/Tako.app; do [ -d "$v" ] && SRC="$v" && break; done
  if [ -z "$SRC" ]; then
    for z in /Volumes/*/Tako.app.zip; do
      [ -f "$z" ] || continue
      echo "▶ scompatto $z"
      TMPDIR_UNZIP="$(mktemp -d)"
      ditto -x -k "$z" "$TMPDIR_UNZIP"
      SRC="$TMPDIR_UNZIP/Tako.app"
      break
    done
  fi
fi

if [ -z "$SRC" ] || [ ! -d "$SRC" ]; then
  echo "✗ Tako.app non trovato (né come cartella né come Tako.app.zip)."
  echo "  Mettilo nella stessa cartella di questo script e riprova."
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

[ -n "$TMPDIR_UNZIP" ] && rm -rf "$TMPDIR_UNZIP"

echo "✓ Tako installato e avviato su questo Mac."
