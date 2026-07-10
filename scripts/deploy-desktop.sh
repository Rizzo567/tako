#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Deploy dell'app desktop Tako — in place su /Applications/Tako.app.
# Garantisce UN SOLO Tako sul Mac: builda solo il .app (niente DMG), aggiorna
# l'app esistente con rsync, e RIMUOVE+DEREGISTRA il build-output così non
# appare mai un secondo Tako fantasma in Launchpad.
#
# Uso:  sh scripts/deploy-desktop.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPDIR="$ROOT/apps/app"
BUILDOUT="$APPDIR/src-tauri/target/release/bundle/macos/Tako.app"
INSTALLED="/Applications/Tako.app"
LSREG="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

echo "▶ build (solo .app, niente DMG)"
( cd "$APPDIR" && pnpm desktop:build )

if [ ! -d "$BUILDOUT" ]; then echo "✗ build-output non trovato: $BUILDOUT"; exit 1; fi

echo "▶ chiudo Tako se aperto"
osascript -e 'quit app "Tako"' 2>/dev/null || true
sleep 1

echo "▶ aggiorno /Applications/Tako.app in place (rsync)"
rsync -a --delete "$BUILDOUT/" "$INSTALLED/"
xattr -dr com.apple.quarantine "$INSTALLED" 2>/dev/null || true

echo "▶ pulizia: rimuovo e deregistro il build-output (evita il 2° Tako)"
"$LSREG" -u "$BUILDOUT" 2>/dev/null || true
rm -rf "$BUILDOUT"
# smonta eventuali DMG residui (per sicurezza, anche se --bundles app non li crea)
for v in /Volumes/dmg.*; do [ -d "$v" ] && hdiutil detach "$v" -quiet 2>/dev/null || true; done

echo "✓ deploy fatto. Tako.app installati:"
find /Applications ~/Applications -maxdepth 2 -iname 'Tako*.app' 2>/dev/null
